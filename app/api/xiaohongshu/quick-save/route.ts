import { NextRequest, NextResponse, after } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu } from '@/lib/feishuAuth'
import axios from 'axios'

// apizero.cn video-parse API 配置（主力）
const APIZERO_API_KEY = process.env.APIZERO_API_KEY || ''
const APIZERO_API_BASE = 'https://v1.apizero.cn/api/video-parse'

// apizero 单次请求超时：它自身失败要烧 9~13 秒（内部代理竞速两轮），
// 超时设太短会把真实错误码掐成 timeout，反而看不出失败原因
const APIZERO_TIMEOUT_MS = 25000

// 哼哼猫 API 配置（备用，免费但数据不全）
const HENGHENGMAO_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY || ''
const HENGHENGMAO_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE || 'https://api.meowload.net/openapi/extract/post'

// 飞书 API 配置
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * 从URL中提取note_id（支持完整小红书链接和短链接）
 */
async function getFullUrlAndNoteId(shortUrl: string): Promise<{ fullUrl: string; noteId: string }> {
  console.log('[短链解析] 解析URL:', shortUrl)

  // 从 URL 中提取 note_id 的辅助函数
  function extractNoteId(url: string): string | null {
    // 格式1: https://www.xiaohongshu.com/explore/684aa03a000000002202750b
    // 格式2: https://www.xiaohongshu.com/discovery/item/684aa03a000000002202750b
    const directMatch = url.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
    if (directMatch) return directMatch[1]

    // 格式3: 微信OAuth重定向，note_id 在 redirect_uri 参数里
    const redirectUriMatch = url.match(/redirect_uri=([^&]+)/)
    if (redirectUriMatch) {
      const redirectUri = decodeURIComponent(redirectUriMatch[1])
      console.log('[短链解析] 从redirect_uri提取:', redirectUri)
      const redirectMatch = redirectUri.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
      if (redirectMatch) return redirectMatch[1]
    }

    return null
  }

  // 快速路径：如果已经是完整小红书链接，直接提取 note_id，无需任何网络请求
  const directNoteId = extractNoteId(shortUrl)
  if (directNoteId) {
    console.log('[短链解析] 直接从URL提取到note_id:', directNoteId)
    return { fullUrl: shortUrl, noteId: directNoteId }
  }

  // 慢速路径：短链接，尝试 HEAD 跟随重定向（超时 4 秒，避免 Vercel 10s 限制）
  // 用普通 Safari UA，避免 xhslink 走微信 OAuth 跳转链（海外服务器无法走通）
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }

  // 服务端不受 ATS 限制，xhslink.com 只支持 http，需还原
  const resolveUrl = shortUrl.includes('xhslink.com') && shortUrl.startsWith('https://')
    ? shortUrl.replace('https://', 'http://')
    : shortUrl

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    // xhslink.com 不支持 HEAD，用 GET 跟随跳转（不读 body，只取最终 URL）
    const headResp = await fetch(resolveUrl, { method: 'GET', redirect: 'follow', signal: controller.signal, headers })
    const fullUrl = headResp.url
    console.log('[短链解析] HEAD完整URL:', fullUrl)
    const noteId = extractNoteId(fullUrl)
    if (noteId) {
      return { fullUrl, noteId }
    }
    throw new Error(`无法从重定向URL中提取note_id: ${fullUrl}`)
  } catch (e) {
    throw new Error(`短链解析失败（建议在iOS设备上解析后再发送完整链接）: ${(e as Error).message}`)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * apizero 的失败是否值得重试
 * 5020 = 小红书侧抓取失败，其中只有 note_unavailable（笔记删除/私密）是确定性失败，
 * 其余（proxy_fail / miss / rate_limit 等）换一轮代理往往就成功
 * 无响应（超时、网络错误）不重试：再等一个 25 秒也大概率还是拿不到
 */
function isApiZeroRetryable(body: any): boolean {
  if (!body || body.code !== 5020) return false
  return body?.data?.reason !== 'note_unavailable'
}

/**
 * 解析小红书链接（使用 apizero.cn video-parse API - 主力）
 */
async function parseXiaohongshuWithApiZero(url: string) {
  console.log('[快捷保存-apizero] 开始解析链接:', url)

  // apizero 需要真实小红书链接，先解析短链接
  const { fullUrl } = await getFullUrlAndNoteId(url)

  console.log('[快捷保存-apizero] 调用 apizero API...')

  // 最多两次：上游抓取失败换一轮代理常常就成了，短链无需重新解析
  let data: any
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const axiosResp = await axios.get(APIZERO_API_BASE, {
        params: { url: fullUrl, flat: 1, key: APIZERO_API_KEY },
        timeout: APIZERO_TIMEOUT_MS
      })
      data = axiosResp.data
    } catch (axiosErr: any) {
      const body = axiosErr?.response?.data
      const status = axiosErr?.response?.status || 'timeout'
      const errBody = JSON.stringify(body || {}).substring(0, 200)
      console.error(`[快捷保存-apizero] API错误（第${attempt}次）:`, status, errBody)
      if (attempt === 1 && isApiZeroRetryable(body)) {
        console.warn('[快捷保存-apizero] 上游抓取失败，1秒后重试一次...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      throw new Error(`apizero API请求失败: HTTP ${status} ${errBody}`)
    }

    // HTTP 200 但业务码非 0
    if (data.code !== 0) {
      console.error(`[快捷保存-apizero] 业务错误（第${attempt}次）:`, data.code, data.msg)
      if (attempt === 1 && isApiZeroRetryable(data)) {
        console.warn('[快捷保存-apizero] 上游抓取失败，1秒后重试一次...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      throw new Error(`apizero API错误: ${data.msg || JSON.stringify(data).substring(0, 200)}`)
    }

    break
  }

  const d = data.data
  if (!d) {
    throw new Error('apizero API: 未返回数据')
  }

  console.log('[快捷保存-apizero] ✅ API调用成功, type:', d.type)

  // apizero 返回结构：title = 标题，desc = 正文（含末尾话题标签）
  // 兼容早期结构：若 desc 为空，说明是把三者合并在 title 里的老格式，走下面的智能拆分
  const hasDesc = typeof d.desc === 'string' && d.desc.trim().length > 0
  const rawContent = hasDesc ? d.desc : (d.title || '')

  // 话题标签的合法字符：不含空白、井号、@，也不含中文/英文标点
  // （否则「住的是#3号楼，房间朝南。价格…」整句会被当成一个标签）
  const TAG_BODY = '[^\\s#@，。！？、；：,.!?()（）\\[\\]"\'…]{1,30}'

  let content = rawContent
  content = content.replace(/#[^#]+\[话题\]#/g, ' ')
  // 剥掉末尾的话题标签串。两种写法都要覆盖：
  //   「太贴心了～）#法国旅游#瑞士旅游#…」  紧挨着，标签前没有空白
  //   「…！\n\n#梵蒂冈 #梵蒂冈旅行# …」    换行/空格分隔
  content = content.replace(new RegExp('(?:\\s*[@#]' + TAG_BODY + '#?)+\\s*$'), '')
  content = content.replace(/[^\S\n]+/g, ' ').trim()

  const tagSet = new Set<string>()
  // 用前瞻而不是 `#?` 收尾：标签紧挨着写时（#a#b#c），闭合的井号同时是下一个标签的
  // 开头井号，被吃掉就会隔一个丢一个
  const tagPattern = new RegExp('#(' + TAG_BODY + ')(?:\\[话题\\])?(?=#|\\s|$)', 'g')
  let match
  while ((match = tagPattern.exec(rawContent)) !== null) {
    tagSet.add('#' + match[1])
  }
  const tags = [...tagSet].join(' ')

  // 新格式下标题直接取 title 字段；正文若重复了标题则去掉开头那一段
  let title = hasDesc ? (d.title || '').trim() : ''
  let bodyContent = content

  if (title && content.startsWith(title)) {
    bodyContent = content.slice(title.length).trim()
  }

  // 兜底：title 为空（老格式或无标题笔记）时，沿用智能拆分逻辑
  if (!title) {
    const firstLine = content.split('\n')[0] || ''
    const pipeIndex = firstLine.indexOf('|||')

    if (pipeIndex > 0 && pipeIndex <= 50) {
      title = firstLine.substring(0, pipeIndex).trim()
      const restOfFirstLine = firstLine.substring(pipeIndex + 3).trim()
      const restLines = content.split('\n').slice(1).join('\n')
      bodyContent = (restOfFirstLine + (restLines ? '\n' + restLines : '')).trim()
    } else if (firstLine.length > 30) {
      const truncated = firstLine.substring(0, 30)
      const breakPoints = [
        truncated.lastIndexOf('。'),
        truncated.lastIndexOf('！'),
        truncated.lastIndexOf('？'),
        truncated.lastIndexOf('，'),
        truncated.lastIndexOf(' ')
      ]
      const breakPoint = Math.max(...breakPoints.filter(p => p > 10))
      title = breakPoint > 0 ? firstLine.substring(0, breakPoint + 1) : truncated + '...'
      const restOfFirstLine = firstLine.substring(breakPoint > 0 ? breakPoint + 1 : 30).trim()
      const restLines = content.split('\n').slice(1).join('\n')
      bodyContent = (restOfFirstLine + (restLines ? '\n' + restLines : '')).trim()
    } else {
      title = firstLine
      bodyContent = content.split('\n').slice(1).join('\n').trim()
    }
  }

  if (!title) title = '小红书笔记'
  if (!bodyContent) bodyContent = content

  // 图片列表：图文笔记用 imagelist（过滤掉混在里面的视频片段），视频笔记用封面
  let images: string[] = []
  if (d.type === '视频') {
    if (d.cover_url) images = [d.cover_url]
  } else {
    images = (d.imagelist || []).filter((u: string) => {
      const path = u.split('?')[0].toLowerCase()
      return !path.endsWith('.mp4') && !path.endsWith('.mov')
    })
  }

  const stats = d.stats || {}
  const authorName = stats.author_name || d.source?.author_name || ''
  const viewCount = parseInt(stats.play_count || '0')
  const likedCount = parseInt(stats.like_count || '0')
  const collectedCount = parseInt(stats.collect_count || '0')
  const commentCount = parseInt(stats.comment_count || '0')
  const publishTime = stats.publish_time ? String(stats.publish_time).split(' ')[0] : ''

  console.log('[快捷保存-apizero] 解析成功 - 标题:', title, '图片数:', images.length)
  console.log('[快捷保存-apizero] ✅ 完整数据 - 作者:', authorName, '点赞:', likedCount)

  return {
    title,
    content: bodyContent,
    tags,
    images,
    authorName,
    viewCount,
    likedCount,
    collectedCount,
    commentCount,
    publishTime
  }
}

/**
 * 解析小红书链接（哼哼猫API - 出标题/正文/原图，不出互动数据）
 *
 * 400 ExtractFailed 是瞬时错误，实测同一链接单次成功率低到 58%，退避重试能救；
 * 401/402/403 是 key 无效或额度耗尽，重试没有意义，直接抛。
 */
const HENGHENGMAO_MAX_ATTEMPTS = 4

async function parseXiaohongshuWithHenghengmao(url: string) {
  console.log('[短链解析] 开始解析链接:', url)

  // 哼哼猫API直接支持短链接，无需先解析
  let data: any = null

  for (let attempt = 1; attempt <= HENGHENGMAO_MAX_ATTEMPTS; attempt++) {
    console.log(`[短链解析] 调用哼哼猫API（第${attempt}/${HENGHENGMAO_MAX_ATTEMPTS}次）...`)
    const response = await fetch(HENGHENGMAO_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': HENGHENGMAO_API_KEY,
        'accept-language': 'zh',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url  // 直接使用原始URL（支持短链接）
      })
    })

    if (response.ok) {
      data = await response.json()
      break
    }

    const errorText = await response.text()
    const errorMsg = `HTTP ${response.status} ${errorText.substring(0, 160)}`
    console.error(`[短链解析] API错误（第${attempt}次）:`, errorMsg)

    if (response.status === 401 || response.status === 402 || response.status === 403) {
      throw new Error(`解析失败(不重试): ${errorMsg}`)
    }
    if (attempt === HENGHENGMAO_MAX_ATTEMPTS) {
      throw new Error(`解析失败(已重试${HENGHENGMAO_MAX_ATTEMPTS}次): ${errorMsg}`)
    }

    await delay(1000 * attempt)  // 1s / 2s / 3s 退避
  }

  // 详细日志
  console.log('[短链解析] API 完整响应:', JSON.stringify(data, null, 2))

  // 哼哼猫API返回格式: { text: string, medias: [...] }
  if (!data.text && !data.medias) {
    console.error('[短链解析] API返回数据格式错误:', data)
    throw new Error('API返回数据格式错误')
  }

  console.log('[短链解析] 笔记数据获取成功')

  // 提取正文内容
  const rawContent = data.text || ''

  // 清理正文：移除末尾的话题标签
  let content = rawContent

  // 1. 删除 #xxx[话题]# 格式
  content = content.replace(/#[^#]+\[话题\]#/g, ' ')

  // 2. 删除末尾的标签（@用户名 和 #话题#）
  content = content.replace(/(\s+[@#]\S+)+\s*$/g, '')

  // 只压缩行内多余空格，保留换行符
  content = content.replace(/[^\S\n]+/g, ' ').trim()

  console.log('[短链解析] 原始正文:', rawContent.substring(0, 100) + '...')
  console.log('[短链解析] 清理后正文:', content.substring(0, 100) + '...')

  // 从正文中提取话题标签
  // 匹配 #xxx[话题]# 格式，提取出 #xxx 部分
  const tagPattern = /#([^#\s]+)\[话题\]#/g
  const tagMatches: string[] = []
  let match
  while ((match = tagPattern.exec(rawContent)) !== null) {
    tagMatches.push('#' + match[1])
  }
  const tags = tagMatches.join(' ')

  // 提取标题和纯正文（智能截取）
  let title = ''
  let bodyContent = content // 纯正文（不含标题）

  if (content) {
    // 先按换行符分割，取第一行
    const firstLine = content.split('\n')[0]

    // 优先在 ||| 处截断（小红书常用的标题分隔符）
    const pipeIndex = firstLine.indexOf('|||')
    if (pipeIndex > 0 && pipeIndex <= 50) {
      title = firstLine.substring(0, pipeIndex).trim()
      // 正文：去掉标题和|||后的部分
      const restOfFirstLine = firstLine.substring(pipeIndex + 3).trim()
      const restLines = content.split('\n').slice(1).join('\n')
      bodyContent = (restOfFirstLine + (restLines ? '\n' + restLines : '')).trim()
    } else if (firstLine.length > 30) {
      // 如果第一行太长（超过30字符），智能截断
      const truncated = firstLine.substring(0, 30)
      const breakPoints = [
        truncated.lastIndexOf('。'),
        truncated.lastIndexOf('！'),
        truncated.lastIndexOf('？'),
        truncated.lastIndexOf('，'),
        truncated.lastIndexOf(' ')
      ]
      const breakPoint = Math.max(...breakPoints.filter(p => p > 10)) // 至少保留10个字符
      title = breakPoint > 0 ? firstLine.substring(0, breakPoint + 1) : truncated + '...'
      // 正文：去掉标题部分
      const restOfFirstLine = firstLine.substring(breakPoint > 0 ? breakPoint + 1 : 30).trim()
      const restLines = content.split('\n').slice(1).join('\n')
      bodyContent = (restOfFirstLine + (restLines ? '\n' + restLines : '')).trim()
    } else {
      // 第一行作为标题
      title = firstLine
      // 正文：第二行开始
      bodyContent = content.split('\n').slice(1).join('\n').trim()
    }
  }

  // 如果标题仍然为空，使用默认值
  if (!title) {
    title = '小红书笔记'
  }

  // 如果正文为空，使用原始content（避免丢失内容）
  if (!bodyContent) {
    bodyContent = content
  }

  // 提取图片URL（从medias数组）
  // 只认 resource_url（?imageView2/2/w/0 原图档）。
  // 绝不退到 preview_url —— 它是预览档，实测 1080x1440 只有 15KB（正常 230KB），
  // 存进去以后没人知道这张图是坏的。宁可这张缺失、留给重采。
  const imageMedias = data.medias?.filter((media: any) => media.media_type === 'image') || []
  const images = imageMedias
    .map((media: any) => media.resource_url || '')
    .filter(Boolean)

  const droppedCount = imageMedias.length - images.length
  if (droppedCount > 0) {
    console.warn(`[短链解析] ⚠️  ${droppedCount}/${imageMedias.length} 张图无 resource_url，已跳过（不使用预览档兜底）`)
  }

  console.log('[短链解析] 解析成功 - 标题:', title, '图片数:', images.length)

  // 注意：哼哼猫API不返回以下数据，设为默认值
  const authorName = ''  // 需要手动输入
  const viewCount = 0    // 需要手动输入
  const likedCount = 0   // 需要手动输入
  const collectedCount = 0  // 需要手动输入
  const commentCount = 0    // 需要手动输入
  const publishTime = ''    // 需要手动输入

  console.log('[短链解析] ⚠️  哼哼猫API不提供互动数据，作者昵称、浏览数、点赞数等需要手动填写')

  return {
    title,
    content: bodyContent,
    tags,
    images,
    authorName,
    viewCount,
    likedCount,
    collectedCount,
    commentCount,
    publishTime
  }
}

/**
 * 组装备注栏内容
 *
 * 降级情况必须写进备注，否则记录看起来是"满的"、看不出哪里缺：
 * apizero 挂的时候作者和互动数是空的，哼哼猫挂的时候图是预览档，
 * 两种都不影响记录建立，肉眼扫表格发现不了。
 *
 * 用户自己填的 remark（「模板」「采集开头」这类采集指令）永远放最前面，
 * 不能被覆盖 —— 后续 /分析笔记 要从备注里读这些指令。
 */
function buildRemark(
  apiUsed: string | undefined,
  apiError: string | undefined,
  userRemark?: string
): string {
  const parts: string[] = []
  if (userRemark) parts.push(userRemark)

  if (apiUsed === 'fallback') {
    parts.push('⚠️ 自动采集失败，请手动补充内容')
  } else if (apiUsed === 'henghengmao') {
    parts.push('⚠️ apizero 未取到数据：作者昵称/点赞/收藏/评论/发布时间为空，需手动补充')
  } else if (apiUsed === 'apizero') {
    parts.push('⚠️ 哼哼猫未取到数据：图片为 apizero 预览档（约15KB/张），画质不合格，建议重采')
  } else {
    // henghengmao+apizero：数据完整，不往备注里加噪音
    return userRemark || ''
  }

  if (apiError) parts.push(apiError)
  return parts.join('\n')
}

/**
 * 解析小红书链接（统一入口 - 两家并行互补）
 *
 * 实测结论（2026-08-22，同一篇笔记 18 张图两家各跑一遍）：
 *   哼哼猫  —— 标题/正文/图片都对，resource_url 是 ?imageView2/2/w/0 原图档，
 *             长边中位 1800、体积中位 336KB。但完全不返回作者昵称和互动数据。
 *             单次可能返回 400 ExtractFailed，已在函数内退避重试。
 *   apizero —— stats 里有作者、点赞、收藏、评论、发布时间。
 *             但 imagelist 只给 !nd_prv_ 预览档，同样这 18 张长边中位 1357、
 *             体积中位 13.6KB，肉眼马赛克；且对 2026-08 以后分享的链接成功率为 0。
 *
 * 所以不再串行降级（那样两家长处会互相抵消：apizero 成功则图全糊、
 * apizero 失败才用哼哼猫则互动数全空），改为并行各取所长：
 *   标题/正文/标签/图片 ← 哼哼猫      作者/互动数/发布时间 ← apizero
 */
async function parseXiaohongshu(url: string): Promise<{
  title: string
  content: string
  tags: string
  images: string[]
  authorName: string
  viewCount: number
  likedCount: number
  collectedCount: number
  commentCount: number
  publishTime: string
  apiUsed?: 'henghengmao+apizero' | 'henghengmao' | 'apizero' | 'fallback'
  apiError?: string
}> {
  console.log('[快捷保存] 开始解析链接:', url)
  console.log('[快捷保存] 策略: 哼哼猫(图文) ‖ apizero(互动数据) 并行')

  const [hhmSettled, azSettled] = await Promise.allSettled([
    parseXiaohongshuWithHenghengmao(url),
    parseXiaohongshuWithApiZero(url),
  ])

  const hhm = hhmSettled.status === 'fulfilled' ? hhmSettled.value : null
  const az  = azSettled.status  === 'fulfilled' ? azSettled.value  : null
  const hhmErr = hhmSettled.status === 'rejected'
    ? (hhmSettled.reason?.message || String(hhmSettled.reason)) : ''
  const azErr = azSettled.status === 'rejected'
    ? (azSettled.reason?.message || String(azSettled.reason)) : ''

  // 情况1：哼哼猫成功 —— 图文一律用它（原图），互动数据能拿就拿
  if (hhm) {
    if (az) {
      console.log('[快捷保存] ✅ 两家都成功：图文取哼哼猫(原图)，互动数据取apizero')
      return {
        ...hhm,
        authorName:     az.authorName     || hhm.authorName,
        viewCount:      az.viewCount      || hhm.viewCount,
        likedCount:     az.likedCount     || hhm.likedCount,
        collectedCount: az.collectedCount || hhm.collectedCount,
        commentCount:   az.commentCount   || hhm.commentCount,
        publishTime:    az.publishTime    || hhm.publishTime,
        apiUsed: 'henghengmao+apizero',
      }
    }
    console.warn('[快捷保存] ⚠️  apizero失败，图文已齐全，互动数据留空待手填:', azErr)
    return {
      ...hhm,
      apiUsed: 'henghengmao',
      apiError: `apizero失败(作者/互动数留空待手填): ${azErr}`,
    }
  }

  // 情况2：哼哼猫失败、apizero成功 —— 内容齐全但图是预览档，必须在备注里标出来
  if (az) {
    console.warn('[快捷保存] ⚠️  哼哼猫失败，降级用apizero，图片是预览档:', hhmErr)
    return {
      ...az,
      apiUsed: 'apizero',
      apiError: `哼哼猫失败: ${hhmErr} | ⚠️ 图片为apizero预览档(约15KB/张)，画质不合格，建议哼哼猫恢复后重采`,
    }
  }

  // 情况3：两家都失败 —— 兜底空记录，保证飞书至少留下链接
  console.error('[快捷保存] ❌ 两家均失败，启用兜底保存（飞书留空记录）')
  return {
    title: '⚠️ 待补充',
    content: '',
    tags: '',
    images: [],
    authorName: '',
    viewCount: 0,
    likedCount: 0,
    collectedCount: 0,
    commentCount: 0,
    publishTime: '',
    apiUsed: 'fallback',
    apiError: `哼哼猫: ${hhmErr} | apizero: ${azErr}`,
  }
}

/**
 * 下载图片（需要添加 Referer header，否则小红书服务器会返回 403）
 * 自动将 HEIF 格式转换为 JPEG（修改 URL 参数让小红书服务器返回 JPEG）
 *
 * 🔧 优化策略：
 * 1. 增加超时时间到120秒（302.ai API的图片CDN可能较慢）
 * 2. 添加多个备用User-Agent（避免被CDN识别）
 * 3. 添加详细的错误日志
 */
async function downloadImage(url: string, retryCount: number = 0): Promise<Buffer> {
  // 将 HEIF 格式的图片 URL 转换为 JPEG 格式
  // 小红书 CDN URL 格式: https://sns-img-qc.xhscdn.com/xxx?imageView2/.../format/heif/...
  // 转换策略：将 format/heif 替换为 format/jpg
  let processedUrl = url
  if (url.includes('format/heif')) {
    processedUrl = url.replace(/format\/heif/g, 'format/jpg')
    console.log('[图片下载] 检测到HEIF格式，转换为JPEG')
    console.log('[图片下载] 原始URL:', url.substring(0, 80) + '...')
    console.log('[图片下载] 转换后:', processedUrl.substring(0, 80) + '...')
  }

  console.log('[图片下载] 下载图片 (尝试 #' + (retryCount + 1) + '):', processedUrl.substring(0, 80) + '...')

  // 多个User-Agent轮换（避免被识别为爬虫）
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
  ]
  const userAgent = userAgents[retryCount % userAgents.length]

  // 创建AbortController用于超时控制
  // 降低单次超时到30秒，避免阻塞其他笔记采集
  // 通过10次重试来提高成功率，而不是延长单次等待时间
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时（快速失败）

  try {
    const startTime = Date.now()

    const response = await fetch(processedUrl, {
      headers: {
        'Referer': 'https://www.xiaohongshu.com/',
        'User-Agent': userAgent,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status} ${response.statusText}`
      console.error('[图片下载] ❌ 请求失败:', errorMsg)
      console.error('[图片下载] 响应头:', Object.fromEntries(response.headers.entries()))
      throw new Error(errorMsg)
    }

    const arrayBuffer = await response.arrayBuffer()
    const duration = Date.now() - startTime
    const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2)

    clearTimeout(timeout)

    console.log(`[图片下载] ✅ 下载成功: ${sizeKB}KB, 耗时${duration}ms`)

    return Buffer.from(arrayBuffer)

  } catch (error: any) {
    clearTimeout(timeout)

    if (error.name === 'AbortError') {
      console.error('[图片下载] ❌ 下载超时（120秒）')
      console.error('[图片下载] URL可能过长或CDN响应慢，建议检查URL有效性')
      throw new Error('下载超时（120秒）')
    }

    // 记录详细的错误信息
    console.error('[图片下载] ❌ 下载失败:', error.message)
    console.error('[图片下载] 错误类型:', error.name)
    console.error('[图片下载] User-Agent:', userAgent)

    throw error
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 处理单张图片：下载并上传到飞书，支持重试
 */
async function processImageWithRetry(
  imageUrl: string,
  index: number,
  appToken: string,
  totalCount: number
): Promise<string | null> {
  const imagePreview = imageUrl.substring(0, 80) + '...'
  let lastError: any = null

  try {
    console.log(`[图片处理] 开始处理第 ${index + 1}/${totalCount} 张图片...`)
    console.log(`[图片处理] 图片 ${index + 1} URL: ${imagePreview}`)

    // 1. 下载图片（最多重试10次，提高成功率）
    let imageBuffer: Buffer | null = null
    const MAX_RETRIES = 10 // 从5次增加到10次
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        imageBuffer = await downloadImage(imageUrl, retry)
        console.log(`[图片处理] 图片 ${index + 1} 下载成功，大小: ${imageBuffer.length} bytes`)
        break
      } catch (error: any) {
        lastError = error
        const errorMsg = error?.message || String(error)

        if (retry < MAX_RETRIES - 1) {
          // 渐进式重试延迟：第1次等2秒，第2次等3秒，第3次等5秒...
          const delayTime = Math.min(2000 + retry * 1000, 10000) // 最多等10秒
          console.log(`[图片处理] 图片 ${index + 1} 下载失败(${errorMsg})，等待${delayTime/1000}秒后重试 (${retry + 1}/${MAX_RETRIES})...`)
          await delay(delayTime)
        } else {
          console.error(`[图片处理] ❌❌❌ 图片 ${index + 1} 下载${MAX_RETRIES}次全部失败`)
          console.error(`[图片处理] 最后错误: ${errorMsg}`)
          console.error(`[图片处理] 失败URL: ${imagePreview}`)
          throw error
        }
      }
    }

    if (!imageBuffer) {
      throw new Error('下载失败（未知原因）')
    }

    // 2. 上传到飞书
    const fileName = `image_${Date.now()}_${index}.jpg`
    const fileToken = await uploadFileToFeishu(imageBuffer, fileName, appToken)

    console.log(`[图片处理] ✅ 第 ${index + 1} 张图片处理完成，file_token: ${fileToken}`)
    return fileToken

  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    console.error(`[图片处理] ❌❌❌ 第 ${index + 1} 张图片最终处理失败`)
    console.error(`[图片处理] 错误类型: ${error?.name || 'Unknown'}`)
    console.error(`[图片处理] 错误信息: ${errorMsg}`)
    console.error(`[图片处理] 图片URL: ${imagePreview}`)

    // 分析失败原因
    if (errorMsg.includes('HTTP 403')) {
      console.error(`[图片处理] 💡 原因分析: 小红书CDN拒绝访问（可能URL签名过期）`)
    } else if (errorMsg.includes('HTTP 404')) {
      console.error(`[图片处理] 💡 原因分析: 图片不存在或已删除`)
    } else if (errorMsg.includes('超时')) {
      console.error(`[图片处理] 💡 原因分析: 下载超时（网络慢或CDN限速）`)
    } else if (errorMsg.includes('刷新token失败')) {
      console.error(`[图片处理] 💡 原因分析: 飞书Token问题（需重新授权）`)
    } else {
      console.error(`[图片处理] 💡 原因分析: 未知错误，建议重新采集`)
    }

    return null
  }
}

/**
 * 处理图片：下载并上传到飞书，获取 file_token
 * 返回数组可能包含 null（失败的图片），但保持原始顺序
 * 使用有限并发（每批最多4个），兼顾速度与稳定性
 */
async function processImages(imageUrls: string[], appToken: string): Promise<Array<string | null>> {
  console.log('[图片处理] 需要处理', imageUrls.length, '张图片')
  console.log('[图片处理] 使用有限并发模式，每批最多 4 个并发请求')

  const CONCURRENCY = 4 // 并发数（优化后：提升30%速度）
  const results: Array<string | null> = new Array(imageUrls.length).fill(null)

  // 分批处理，每批最多 CONCURRENCY 个并发
  for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
    const batchEnd = Math.min(i + CONCURRENCY, imageUrls.length)
    const batchSize = batchEnd - i

    console.log(`[图片处理] 📦 处理第 ${Math.floor(i / CONCURRENCY) + 1} 批，包含图片 ${i + 1}-${batchEnd}`)

    // 当前批次的并发请求
    const batchPromises = []
    for (let j = 0; j < batchSize; j++) {
      const idx = i + j
      batchPromises.push(
        processImageWithRetry(imageUrls[idx], idx, appToken, imageUrls.length)
      )
    }

    // 等待当前批次完成
    const batchResults = await Promise.all(batchPromises)

    // 将结果放回正确的索引位置
    batchResults.forEach((result, batchIdx) => {
      results[i + batchIdx] = result
    })

    // 批次间延迟，避免触发频率限制
    if (batchEnd < imageUrls.length) {
      console.log(`[图片处理] ⏸️  批次完成，等待 300ms 后继续...`)
      await delay(300)
    }
  }

  const successCount = results.filter(token => token !== null).length
  const failedCount = imageUrls.length - successCount

  console.log(`[图片处理] 共成功处理 ${successCount}/${imageUrls.length} 张图片`)
  console.log(`[图片处理] 结果数组:`, results.map((t, i) => t ? `图${i+1}:✓` : `图${i+1}:✗`).join(', '))

  // 如果有失败的图片，详细列出
  if (failedCount > 0) {
    console.error(`[图片处理] ⚠️⚠️⚠️ 有 ${failedCount} 张图片处理失败！⚠️⚠️⚠️`)
    console.error(`[图片处理] 失败原因可能：1.302.ai API图片URL失效 2.网络波动 3.CDN限制`)
    results.forEach((token, index) => {
      if (token === null) {
        console.error(`[图片处理] ❌❌❌ 第 ${index + 1} 张图片失败`)
        console.error(`[图片处理] 失败URL: ${imageUrls[index]}`)
        console.error(`[图片处理] 建议：重新采集该笔记，或检查图片URL是否有效`)
      }
    })
    console.error(`[图片处理] 💡 提示：查看上面的详细错误日志了解具体失败原因`)
  }

  return results
}

/**
 * 保存到飞书表格
 */
async function saveToFeishu(
  appToken: string,
  tableId: string,
  title: string,
  content: string,
  tags: string,
  fileTokens: Array<string | null>,
  url: string,
  authorName: string,
  viewCount: number,
  likedCount: number,
  collectedCount: number,
  commentCount: number,
  publishTime: string,
  remark?: string  // 新增：备注字段（可选）
) {
  console.log('[快捷保存-飞书] 开始保存到表格...')

  const appAccessToken = await getAppAccessToken()

  // 构建记录字段
  // 列顺序：笔记链接、作者昵称、封面、图片2、后续图片、标题、正文、话题标签、点赞数、收藏数、评论数、发布时间、备注、复刻情况
  const fields: any = {
    '笔记链接': url,                     // 第1列
    '作者昵称': authorName,              // 第2列
    // 第3-5列：封面、图片2、后续图片（下面处理）
    '标题': title,                       // 第6列
    '正文': content,                     // 第7列
    '话题标签': tags,                    // 第8列
    '点赞数': String(likedCount),        // 第9列
    '收藏数': String(collectedCount),    // 第10列
    '评论数': String(commentCount),      // 第11列
    '发布时间': String(publishTime)      // 第12列
    // 第13列：备注（可选）
    // 第14列：复刻情况（按钮字段，需手动在飞书表格中创建）
  }

  // 添加备注字段（如果提供）
  if (remark) {
    fields['备注'] = remark
    console.log('[快捷保存-飞书] 备注内容:', remark)
  }

  // 将图片保存到附件字段（使用 file_token，跳过失败的图片）
  // 封面 - 第1张（索引0）
  if (fileTokens[0]) {
    fields['封面'] = [{ file_token: fileTokens[0] }]
    console.log('[快捷保存-飞书] 封面(图1) file_token:', fileTokens[0])
  }

  // 图片2 - 第2张（索引1）
  if (fileTokens[1]) {
    fields['图片2'] = [{ file_token: fileTokens[1] }]
    console.log('[快捷保存-飞书] 图片2(图2) file_token:', fileTokens[1])
  }

  // 后续图片 - 第3张及以后（索引2+）
  if (fileTokens.length > 2) {
    // 只保存非null的file_token，但保持顺序
    const remainingTokens = fileTokens
      .slice(2)
      .filter((token): token is string => token !== null)
      .map(token => ({ file_token: token }))

    if (remainingTokens.length > 0) {
      fields['后续图片'] = remainingTokens
      console.log('[快捷保存-飞书] 后续图片(图3+):', remainingTokens.length, '张')
      console.log('[快捷保存-飞书] 后续图片详情:', remainingTokens.map((t, i) => `图${i+3}:${t.file_token.substring(0, 20)}...`).join(', '))

      // 检查是否有图片被过滤掉
      const originalSlice = fileTokens.slice(2)
      const nullCount = originalSlice.filter(t => t === null).length
      if (nullCount > 0) {
        console.warn(`[快捷保存-飞书] ⚠️ 后续图片中有 ${nullCount} 张失败，从第3张开始的索引: ${originalSlice.map((t, i) => t === null ? i+3 : null).filter(x => x !== null).join(', ')}`)
      }
    }
  }

  const totalSaved = [fileTokens[0], fileTokens[1], ...fileTokens.slice(2)].filter(Boolean).length
  const totalImages = fileTokens.length

  console.log('[快捷保存-飞书] 共保存', totalSaved, '/', totalImages, '个图片到附件字段')

  // 打印所有字段数据用于调试
  console.log('[快捷保存-飞书] 字段数据:')
  console.log('  - 笔记链接:', url)
  console.log('  - 作者昵称:', authorName)
  console.log('  - 标题:', title)
  console.log('  - 正文长度:', content?.length || 0, '字符')
  console.log('  - 话题标签:', tags)
  console.log('  - 点赞数:', likedCount, '收藏数:', collectedCount, '评论数:', commentCount)
  console.log('  - 封面:', fileTokens[0] ? '✓' : '✗')
  console.log('  - 图片2:', fileTokens[1] ? '✓' : '✗')
  console.log('  - 后续图片:', fileTokens.length > 2 ? `${fileTokens.slice(2).filter(Boolean).length}张` : '无')

  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({ fields })
    }
  )

  const data = await response.json()

  console.log('[快捷保存-飞书] 飞书 API 响应:', JSON.stringify(data, null, 2))

  if (data.code !== 0) {
    console.error('[快捷保存-飞书] 保存失败:', data)
    throw new Error(`保存失败: ${data.msg || '未知错误'}`)
  }

  const recordId = data.data?.record?.record_id
  console.log('[快捷保存-飞书] 保存成功，记录 ID:', recordId)

  // 自动设置"去复刻"字段（短链接，避免超长URL被CDN拦截）
  if (recordId) {
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://content-factory-jade-nine.vercel.app'
      const rewriteUrl = `${BASE_URL}/rewrite?record_id=${recordId}&app_token=${appToken}&table_id=${tableId}`
      const updateRes = await fetch(
        `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appAccessToken}`
          },
          body: JSON.stringify({ fields: { '去复刻': rewriteUrl } })
        }
      )
      const updateData = await updateRes.json()
      if (updateData.code !== 0) {
        console.warn('[快捷保存-飞书] 去复刻链接设置失败:', updateData.msg)
      } else {
        console.log('[快捷保存-飞书] 去复刻链接已自动设置')
      }
    } catch (e) {
      console.warn('[快捷保存-飞书] 设置去复刻链接失败（非致命）:', e)
    }
  }

  return { recordId }
}

/**
 * POST /api/xiaohongshu/quick-save
 * iOS快捷指令专用API - 一键保存小红书笔记到飞书（含图片）
 */
// 状态机清理：正确追踪 JSON 字符串边界，转义所有控制字符
// 比正则方案可靠：能正确处理 remark 等多行字段里的任意控制字符
function sanitizeJsonControlChars(raw: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    const code = raw.charCodeAt(i)

    if (escaped) {
      result += char
      escaped = false
      continue
    }

    if (char === '\\' && inString) {
      result += char
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      result += char
      continue
    }

    if (inString && (code <= 0x1F || code === 0x7F)) {
      switch (char) {
        case '\t': result += '\\t'; break
        case '\n': result += '\\n'; break
        case '\r': result += '\\r'; break
        default:   result += `\\u${code.toString(16).padStart(4, '0')}`; break
      }
      continue
    }

    result += char
  }

  return result
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const rawBody = await request.text()
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      // iOS 快捷指令有时会在字符串值内嵌入原始控制字符（如 URL 或 remark 末尾的换行等）
      body = JSON.parse(sanitizeJsonControlChars(rawBody))
    }
    const { url, appToken, tableId, async: isAsync, remark } = body  // 新增：remark

    console.log('[快捷保存] 收到请求:', { url, appToken, tableId, async: isAsync, remark })
    console.log('[快捷保存] 环境变量 DEFAULT_APP_TOKEN:', process.env.FEISHU_DEFAULT_APP_TOKEN)
    console.log('[快捷保存] 环境变量 DEFAULT_TABLE_ID:', process.env.FEISHU_DEFAULT_TABLE_ID)

    // 验证URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        message: '❌ 请提供小红书链接'
      }, { status: 400 })
    }

    // 获取表格配置（使用个人表格）
    const finalAppToken = appToken || process.env.FEISHU_DEFAULT_APP_TOKEN
    const finalTableId = tableId || process.env.FEISHU_DEFAULT_TABLE_ID

    if (!finalAppToken || !finalTableId) {
      return NextResponse.json({
        success: false,
        message: '❌ 未配置飞书表格信息'
      }, { status: 400 })
    }

    // 异步模式：立即返回响应，所有耗时操作（解析+保存+图片）全部在后台执行
    // 解决 Vercel 10s 函数限制 + 中国网络延迟导致的超时问题
    if (isAsync) {
      console.log('[快捷保存] 🚀 全异步模式：立即返回，后台完成所有操作')

      // 所有耗时操作移到 after() 后台执行（响应发出后才开始）
      after(async () => {
        try {
          const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError } = await parseXiaohongshu(url)
          // 把降级情况写入备注，方便飞书里识别（不只是兜底那一种）
          const finalRemark = buildRemark(apiUsed, apiError, remark)
          const { recordId } = await saveToFeishu(
            finalAppToken, finalTableId,
            title, content, tags,
            [],
            url, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime,
            finalRemark
          )
          if (images.length > 0 && recordId) {
            await processImagesAndUpdate(recordId, images, finalAppToken, finalTableId)
          }
          console.log('[快捷保存-后台] ✅ 保存成功:', title, apiUsed === 'fallback' ? '（兜底记录）' : '')
        } catch (err) {
          console.error('[快捷保存-后台] ❌ 失败:', err)
        }
      })

      // 立即返回，iOS 不等待
      return NextResponse.json({
        success: true,
        message: `⏳ 正在后台保存到飞书，稍后查看表格...`,
        data: { async: true }
      })
    }

    // 同步模式（原有逻辑）
    // 1. 解析小红书链接（自动选择API）
    const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError } = await parseXiaohongshu(url)

    // 把降级情况写入备注（不只是兜底那一种）
    const finalRemark = buildRemark(apiUsed, apiError, remark)

    // 2. 处理图片：下载并上传到飞书，获取 file_token
    const fileTokens = await processImages(images, finalAppToken)

    // 3. 保存到飞书表格（使用 file_token）
    await saveToFeishu(
      finalAppToken,
      finalTableId,
      title,
      content,
      tags,
      fileTokens,
      url,
      authorName,
      viewCount,
      likedCount,
      collectedCount,
      commentCount,
      publishTime,
      finalRemark
    )

    const duration = Date.now() - startTime

    console.log('[快捷保存] 保存成功! 耗时:', duration + 'ms')

    // 4. 返回成功消息
    const successImages = fileTokens.filter(token => token !== null).length
    const hasFailedImages = successImages < images.length

    // 构建API使用提示
    let apiInfo = ''
    if (apiUsed === 'henghengmao+apizero') {
      apiInfo = '\n🎯 哼哼猫原图 + apizero互动数（完整）'
    } else if (apiUsed === 'henghengmao') {
      apiInfo = '\n⚠️ 哼哼猫原图，apizero挂了：作者/互动数需手填'
    } else if (apiUsed === 'apizero') {
      apiInfo = '\n⚠️ 哼哼猫挂了，图片是apizero预览档（约15KB/张，画质不合格），建议重采'
    } else if (apiUsed === 'fallback') {
      apiInfo = '\n🆘 API全部失败，已创建空记录，请到飞书手动补充内容'
    }

    // 图片状态提示
    let imageInfo = ''
    if (hasFailedImages) {
      const failedCount = images.length - successImages
      imageInfo = `\n\n⚠️ 图片上传失败 ${failedCount}/${images.length} 张\n💡 建议：立即重新运行快捷指令\n（链接已在剪贴板，直接运行即可）`
    } else {
      imageInfo = `\n📸 ${successImages} 张图片全部保存成功`
    }

    return NextResponse.json({
      success: true,
      message: `✅ 保存${hasFailedImages ? '部分' : ''}成功!${apiInfo}\n\n📝 ${title}\n👤 ${authorName || '(待填写)'}${imageInfo}\n👁️ ${viewCount} 浏览\n⏱️ 耗时${duration}ms`,
      data: {
        title,
        authorName,
        imageCount: successImages,
        totalImages: images.length,
        failedImages: images.length - successImages,
        hasFailedImages,
        viewCount,
        likedCount,
        collectedCount,
        commentCount,
        duration,
        apiUsed,
        apiError
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[快捷保存] 错误:', error)

    return NextResponse.json({
      success: false,
      message: `❌ 发生错误: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 })
  }
}

/**
 * 后台图片处理：上传图片并更新飞书记录
 */
async function processImagesAndUpdate(
  recordId: string,
  imageUrls: string[],
  appToken: string,
  tableId: string
): Promise<void> {
  console.log('[快捷保存-图片后台] 开始后台上传图片，记录ID:', recordId)

  // 1. 上传图片获取 file_token
  const fileTokens = await processImages(imageUrls, appToken)

  const successCount = fileTokens.filter(t => t !== null).length
  console.log(`[快捷保存-图片后台] 上传完成: ${successCount}/${imageUrls.length} 张成功`)

  if (successCount === 0) {
    console.error('[快捷保存-图片后台] 所有图片上传失败，跳过更新记录')
    return
  }

  // 2. 构建图片字段
  const fields: any = {}
  if (fileTokens[0]) {
    fields['封面'] = [{ file_token: fileTokens[0] }]
  }
  if (fileTokens[1]) {
    fields['图片2'] = [{ file_token: fileTokens[1] }]
  }
  if (fileTokens.length > 2) {
    const remaining = fileTokens
      .slice(2)
      .filter((t): t is string => t !== null)
      .map(t => ({ file_token: t }))
    if (remaining.length > 0) {
      fields['后续图片'] = remaining
    }
  }

  // 3. 更新飞书记录（添加图片）
  const appAccessToken = await getAppAccessToken()
  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({ fields })
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[快捷保存-图片后台] 更新记录失败:', JSON.stringify(data))
    throw new Error(`更新图片失败: ${data.msg || '未知错误'}`)
  }

  console.log(`[快捷保存-图片后台] ✅ 图片更新成功: ${successCount}/${imageUrls.length} 张`)
}

/**
 * 异步处理函数（后台执行）
 */
async function processAsync(url: string, appToken: string, tableId: string, startTime: number, remark?: string) {
  try {
    console.log('[快捷保存-异步] 开始后台处理...')

    // 1. 解析小红书链接（自动选择API）
    const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed } = await parseXiaohongshu(url)

    // 2. 处理图片
    const fileTokens = await processImages(images, appToken)

    // 3. 保存到飞书表格
    await saveToFeishu(
      appToken,
      tableId,
      title,
      content,
      tags,
      fileTokens,
      url,
      authorName,
      viewCount,
      likedCount,
      collectedCount,
      commentCount,
      publishTime,
      remark  // 新增：传递备注
    )

    const duration = Date.now() - startTime
    console.log('[快捷保存-异步] ✅ 后台处理成功! 耗时:', duration + 'ms')

  } catch (error) {
    console.error('[快捷保存-异步] ❌ 后台处理失败:', error)
    throw error
  }
}
