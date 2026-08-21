import { NextRequest, NextResponse, after } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu } from '@/lib/feishuAuth'
import axios from 'axios'

// apizero.cn video-parse API 配置（主力）
const APIZERO_API_KEY = process.env.APIZERO_API_KEY || ''
const APIZERO_API_BASE = 'https://v1.apizero.cn/api/video-parse'

// apizero 单次请求超时：它自身失败要烧 9~13 秒（内部代理竞速两轮），
// 超时设太短会把真实错误码掐成 timeout，反而看不出失败原因
const APIZERO_TIMEOUT_MS = 25000

// Just One API 配置（主力）
// 一家同时给标题/正文/结构化标签/原图/作者/赞藏评/发布时间，实测比哼哼猫+apizero 两家加起来还全。
// 鉴权是 query 参数 token=，不是 Bearer header。
const JUSTONE_API_BASE = 'https://api.justoneapi.com'
const JUSTONE_API_TOKEN = process.env.JUSTONE_API_TOKEN || ''
// v2~v5 都写「包括媒体和互动指标」，v3 实测字段齐全；v6 是视频笔记专用
const JUSTONE_NOTE_PATH = '/api/xiaohongshu/get-note-detail/v3'
const JUSTONE_SHARE_PATH = '/api/xiaohongshu/share-url-transfer/v1'
// 官方建议 120s，至少 60s。这里取 60s：解析跑在 after() 后台，但也不能无限占着
const JUSTONE_TIMEOUT_MS = 60000
// code 301 是「采集失败，请重试」，属于瞬时；其余（100 token无效 / 302 超速率 /
// 303 超日配额 / 400 参数错 / 601 余额不足 / 602 TOKEN限额）重试没有意义
const JUSTONE_MAX_ATTEMPTS = 3

// 哼哼猫 API 配置（图文主力）
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
  // apizero 给的一律是 !nd_prv_ 预览档，统一过一遍 toOriginalImageUrl 换成原图
  let images: string[] = []
  if (d.type === '视频') {
    if (d.cover_url) images = [d.cover_url]
  } else {
    images = (d.imagelist || []).filter((u: string) => {
      const path = u.split('?')[0].toLowerCase()
      return !path.endsWith('.mp4') && !path.endsWith('.mov')
    })
  }
  const prvCount = images.filter(u => u.includes('!nd_')).length
  images = images.map(toOriginalImageUrl)
  if (prvCount > 0) {
    console.log(`[快捷保存-apizero] ${prvCount} 张预览档已改写为无签名原图地址`)
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
 * 把 apizero 的预览档图片 URL 归一成原图 URL
 *
 * 2026-08-22 实测发现的关键事实：小红书 CDN 上
 *   https://ci.xiaohongshu.com/<路径>/<图片ID>?imageView2/2/w/0/format/jpg
 * 是**无签名**的原图地址，三个主机（ci.xiaohongshu.com / sns-img-qc /
 * sns-na-i14）都通。所以只要拿到图片 ID，就能拿到真原图。
 *
 * apizero 给的是 `.../<签名时间戳>/<签名hash>/notes_pre_post/<图片ID>!nd_prv_wlteh_jpg_3`，
 * `!nd_prv_` 是预览档（实测 1080x1440 仅 13.6KB，bpp 0.0089，肉眼马赛克），
 * 而签名把后缀一起签了，所以直接改后缀会 403。
 * 但把签名段丢掉、只留 `notes_pre_post/<图片ID>` 重新拼一个无签名地址就行——
 * 实测 18/18 全部拿到原图，长边中位 1800、体积中位 336.3KB、bpp 0.1421，
 * 与哼哼猫 / yddm 拿到的**逐字节相同**（本来就是同一份文件）。
 *
 * 注意：哼哼猫的 URL 已经是 `?imageView2/2/w/0`（原图档），且路径前缀有两种形态
 * （带 notes_pre_post/ 和不带），所以不去动它，原样放过最稳。
 */
function toOriginalImageUrl(url: string): string {
  if (!url || !url.includes('!nd_')) return url   // 只处理 apizero 那种形态

  try {
    const u = new URL(url)
    // 路径形如 /<时间戳>/<hash>/notes_pre_post/<id>!nd_prv_wlteh_jpg_3
    // 丢掉前两段签名，保留其余目录 + 图片ID，去掉 ! 之后的档位后缀
    const segs = u.pathname.replace(/^\//, '').split('/')
    if (segs.length < 3) return url
    const kept = segs.slice(2)
    kept[kept.length - 1] = kept[kept.length - 1].split('!')[0]
    if (!kept[kept.length - 1]) return url
    return `https://ci.xiaohongshu.com/${kept.join('/')}?imageView2/2/w/0/format/jpg`
  } catch {
    return url
  }
}

/**
 * 清洗小红书正文
 * 去掉 #xxx[话题]# 标记和末尾裸标签，压缩行内空格但保留换行。
 * Just One API 和哼哼猫的 desc/text 是同一种格式，所以共用这套。
 */
function cleanXhsBody(raw: string): string {
  let out = raw || ''
  out = out.replace(/#[^#]+\[话题\]#/g, ' ')       // #xxx[话题]# 整段去掉
  out = out.replace(/(\s+[@#]\S+)+\s*$/g, '')     // 末尾的 @用户 / #标签
  out = out.replace(/[^\S\n]+/g, ' ').trim()      // 只压行内空白，保留换行
  return out
}

/**
 * 短链兜底解析：本地跟跳转失败时，用 Just One API 自己的端点换出完整 URL。
 * 和笔记详情一样，code 301（采集失败请重试）是瞬时的，要退避重试。
 */
async function resolveNoteIdViaJustOne(shareUrl: string): Promise<string> {
  let redirect = ''
  for (let attempt = 1; attempt <= JUSTONE_MAX_ATTEMPTS; attempt++) {
    const resp = await axios.get(`${JUSTONE_API_BASE}${JUSTONE_SHARE_PATH}`, {
      params: { token: JUSTONE_API_TOKEN, shareUrl },
      timeout: JUSTONE_TIMEOUT_MS,
      validateStatus: () => true,
    })
    const code = resp.data?.code
    if (code === 0) { redirect = resp.data?.data?.redirect_url || ''; break }

    const msg = `code=${code} ${resp.data?.message || ''}`
    if (code !== 301 || attempt === JUSTONE_MAX_ATTEMPTS) {
      throw new Error(`短链解析失败: ${msg}`)
    }
    console.warn(`[JustOne] 短链解析第${attempt}次 ${msg}，退避重试`)
    await delay(1000 * attempt)
  }

  const m = redirect.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
  if (!m) throw new Error(`短链解析结果里没有 note_id: ${redirect.substring(0, 120)}`)
  console.log('[JustOne] 短链经 API 解析到 note_id:', m[1])
  return m[1]
}

/**
 * 解析小红书链接（Just One API - 主力）
 *
 * 2026-08-22 实测（对照组 3UnKNOLDPvh 的答案早已知晓，逐项吻合）：
 *   标题/作者/赞8/藏4/评2/发布日期/18张图 全中，正文 736 字与哼哼猫一致，
 *   标签是 hash_tag[] 结构化数组，不用从正文正则提取。
 *   apizero 稳定失败的 AAU8Hy9edzM 和 8Lhddcw3G8Y 它都成功。
 *
 * 图片有个和哼哼猫 preview_url 一样的陷阱：
 *   images_list[].url 是 w/576 sc=PREVIEW 预览档，
 *   url_multi_level 的 high/medium/low 三个值完全相同、也都是 w/576，名字骗人。
 *   只有 images_list[].original 是 w/5000 sc=ORIGINAL。
 *   签名 sign= 不覆盖 imageView2 参数，所以能把 format/webp 改成 format/jpg
 *   直接下（实测 200），正好接上现有 .jpg 命名。
 *   实测 original→jpg：长边中位 1800、体积中位 451KB、bpp 0.18~0.20，
 *   比哼哼猫（0.1465）高约 1.26 倍，比 apizero 预览档（0.0089）高 20 倍。
 *
 * view_count 恒为 0，浏览数拿不到——这一项三家都拿不到。
 */
async function parseXiaohongshuWithJustOne(url: string) {
  if (!JUSTONE_API_TOKEN) {
    // 前缀 NOT_CONFIGURED 供上层区分「没启用」和「调用失败」——
    // 两者都会退到哼哼猫，但排查方向完全不同，备注里不能混着说
    throw new Error('NOT_CONFIGURED: 服务端未配置 JUSTONE_API_TOKEN')
  }

  // note_id 优先本地跟跳转拿（免费），失败再用它的短链端点（消耗一次调用）
  let noteId = ''
  try {
    noteId = (await getFullUrlAndNoteId(url)).noteId
  } catch (e: any) {
    console.warn('[JustOne] 本地短链解析失败，改用 API 解析:', (e?.message || '').substring(0, 80))
    noteId = await resolveNoteIdViaJustOne(url)
  }

  let payload: any = null
  for (let attempt = 1; attempt <= JUSTONE_MAX_ATTEMPTS; attempt++) {
    console.log(`[JustOne] 调用笔记详情（第${attempt}/${JUSTONE_MAX_ATTEMPTS}次）, noteId=${noteId}`)
    const resp = await axios.get(`${JUSTONE_API_BASE}${JUSTONE_NOTE_PATH}`, {
      params: { token: JUSTONE_API_TOKEN, noteId },
      timeout: JUSTONE_TIMEOUT_MS,
      validateStatus: () => true,
    })
    const body = resp.data
    const code = body?.code

    if (code === 0) { payload = body; break }

    const msg = `code=${code} ${body?.message || ''}`
    console.error(`[JustOne] 业务错误（第${attempt}次）:`, msg)
    // 301 = 采集失败请重试，瞬时；其余重试没意义
    if (code !== 301 || attempt === JUSTONE_MAX_ATTEMPTS) {
      throw new Error(`JustOne 失败: ${msg}`)
    }
    await delay(1000 * attempt)
  }

  const item = payload?.data?.[0]
  const note = item?.note_list?.[0]
  if (!note) throw new Error('JustOne: 响应里没有 note_list')

  const title = (note.title || '').trim()
  const content = cleanXhsBody(note.desc || '')
  const tags = (note.hash_tag || [])
    .map((h: any) => h?.name)
    .filter(Boolean)
    .map((n: string) => '#' + n)
    .join(' ')

  // 只取 original，并把 webp 换成 jpg
  const images: string[] = (note.images_list || [])
    .map((im: any) => im?.original || '')
    .filter(Boolean)
    // 实测同一个接口会按笔记/CDN 返回不同格式：对照组给的是 format/webp，
    // 另一条给的是 format/heif。两种都要转成 jpg，否则下游按 .jpg 命名会名不副实。
    // 签名 sign= 不覆盖 imageView2 参数，所以改格式不会让 URL 失效。
    .map((u: string) => u.replace(/format\/(webp|heif|avif|png)/g, 'format/jpg'))

  const dropped = (note.images_list || []).length - images.length
  if (dropped > 0) {
    console.warn(`[JustOne] ⚠️  ${dropped} 张图没有 original 字段，已跳过（绝不退到 url/url_multi_level 的预览档）`)
  }

  const authorName = item?.user?.nickname || note?.user?.nickname || ''
  const publishTime = note.time ? new Date(note.time * 1000).toISOString().slice(0, 10) : ''

  const out = {
    title,
    content,
    tags,
    images,
    authorName,
    viewCount: Number(note.view_count) || 0,   // 恒为 0
    likedCount: Number(note.liked_count) || 0,
    collectedCount: Number(note.collected_count) || 0,
    commentCount: Number(note.comments_count) || 0,
    sharedCount: Number(note.shared_count) || 0,
    publishTime,
  }
  console.log('[JustOne] ✅ 解析成功 -', title, '| 作者', authorName,
    '| 赞', out.likedCount, '藏', out.collectedCount, '评', out.commentCount,
    '| 图', images.length, '张 | 正文', content.length, '字')
  return out
}

/**
 * 组装备注栏内容
 *
 * 降级情况必须写进备注，否则记录看起来是"满的"、看不出哪里缺：
 * Just One 挂的时候作者和互动数是空的，退到 apizero 的时候图是预览档，
 * 两种都不影响记录建立，肉眼扫表格发现不了。
 *
 * 用户自己填的 remark（「模板」「采集开头」这类采集指令）永远放最前面，
 * 不能被覆盖 —— 后续 /分析笔记 要从备注里读这些指令。
 *
 * compareNote 是 apizero 并行对照行，取数正常时也会写，用来攒决策数据。
 */
function buildRemark(
  apiUsed: string | undefined,
  apiError: string | undefined,
  userRemark?: string,
  compareNote?: string,
  dupNote?: string
): string {
  const parts: string[] = []
  if (userRemark) parts.push(userRemark)

  if (apiUsed === 'fallback') {
    parts.push('⚠️ 自动采集失败，请手动补充内容')
  } else if (apiUsed === 'henghengmao') {
    // 图文和原图都齐，只缺互动数。这是 0.02 元双家方案下的常见结果
    // （apizero 成功率约 38%），不是故障——抄 4 个数字就完整了。
    // 所以措辞用"待补"而不是"失败"，避免每次看到都以为坏了。
    parts.push('📌 待补互动数：作者昵称/点赞/收藏/评论/发布时间为空，去原帖抄一下即可（图文和原图都已齐全）')
  }
  // 其余情况（henghengmao+apizero / henghengmao+justone / apizero / justone）
  // 数据都是齐的，不加警告

  if (dupNote) parts.push(dupNote)
  if (apiError) parts.push(apiError)
  if (compareNote) parts.push(compareNote)

  return parts.join('\n')
}

/**
 * 把分享链接归一化成干净地址：`https://www.xiaohongshu.com/discovery/item/<note_id>`
 *
 * 为什么要做（2026-08-22）：
 * 小红书 App 复制出来的分享链展开后带一串标识，其中
 *   shareRedId —— **账号级、跨笔记恒定**，实测同一账号分享的三条链这个值完全相同，
 *                 换账号才变。等于把"哪个账号在采这些笔记"一起送给了第三方，
 *                 也让小红书那边能把"陌生IP高频抓取"和这个账号对上。
 *   xsec_token —— 该笔记的读取凭证（笔记级，不是账号级）
 *   share_id / apptime / app_version / app_platform —— 单次分享标识和客户端指纹
 *
 * 而这些**一个都不需要**：实测哼哼猫和 apizero 只给 note_id 都能正常返回
 * （哼哼猫三种形态都是正文52字/图2张，apizero 连 xsec_token 都不要）。
 * 纯属白送，所以剥掉。
 *
 * 附带好处：同一篇笔记重新分享一次就是一条新短链，归一化之后链接稳定，
 * 重复采集能当场认出来（法意瑞表里就有 9 组"同一篇笔记不同短链"）。
 *
 * 解析失败时返回原始链接 —— 隐私加固不能反过来降低成功率。
 */
async function normalizeXhsUrl(url: string): Promise<{ cleanUrl: string; noteId: string }> {
  try {
    const { noteId } = await getFullUrlAndNoteId(url)
    if (noteId) {
      return { cleanUrl: `https://www.xiaohongshu.com/discovery/item/${noteId}`, noteId }
    }
  } catch (e: any) {
    console.warn('[快捷保存] 链接归一化失败，退回原始链接（本次会带上账号标识）:',
      (e?.message || String(e)).substring(0, 100))
  }
  return { cleanUrl: url, noteId: '' }
}

/** 查这篇笔记在目标表里是否已经采过（只提示，不拦截） */
async function findExistingRecord(
  appToken: string, tableId: string, noteUrl: string
): Promise<string | null> {
  if (!noteUrl) return null
  try {
    const token = await getAppAccessToken()
    const resp = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search?page_size=5`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          filter: {
            conjunction: 'and',
            conditions: [{ field_name: '笔记链接', operator: 'is', value: [noteUrl] }],
          },
        }),
      }
    )
    const data = await resp.json() as any
    const hit = data?.data?.items?.[0]
    return hit?.record_id || null
  } catch (e: any) {
    console.warn('[快捷保存] 查重失败（不影响采集）:', (e?.message || String(e)).substring(0, 80))
    return null
  }
}

type XhsStats = {
  authorName: string
  viewCount: number
  likedCount: number
  collectedCount: number
  commentCount: number
  publishTime: string
}

function pickStats(o: any): XhsStats | null {
  if (!o) return null
  // 作者名和互动数全空就当没拿到（apizero 偶尔返回结构完整但字段全空）
  const has = o.authorName || o.likedCount || o.collectedCount || o.commentCount
  if (!has) return null
  return {
    authorName: o.authorName || '',
    viewCount: o.viewCount || 0,
    likedCount: o.likedCount || 0,
    collectedCount: o.collectedCount || 0,
    commentCount: o.commentCount || 0,
    publishTime: o.publishTime || '',
  }
}

/** 调 Just One 只为补互动数；没配 token 或余额不足都会抛，这里一律吞掉 */
async function tryJustOne(url: string) {
  try {
    return await parseXiaohongshuWithJustOne(url)
  } catch (e: any) {
    const msg = (e?.message || String(e)).substring(0, 100)
    console.warn('[快捷保存] 第三级 JustOne 未取到:', msg)
    return null
  }
}

/**
 * 解析小红书链接（统一入口）
 *
 * 2026-08-22 定稿的分工，依据是这天跑出来的两个事实：
 *
 * ① 图片来源不值钱。小红书 CDN 上
 *    `ci.xiaohongshu.com/<路径>/<图片ID>?imageView2/2/w/0/format/jpg` 是无签名原图，
 *    所以任何一家只要给出图片 ID，图片质量就有保证（见 toOriginalImageUrl）。
 *    哼哼猫、yddm、apizero 三家拿到的是同一份文件，逐字节相同。
 *    值钱的只剩「作者+互动数」和「成功率」。
 *
 * ② 降级链只看条件成功率，即"前一级失败的那些它能不能成"。实测：
 *    apizero 能读的 4 条，yddm 4/4 也能读；apizero 读不了的 2 条，yddm 0/2 也读不了
 *    —— 完全重合，所以 yddm 放在 apizero 后面救不回任何一条，还贵 10 倍且失败扣费，已弃用。
 *    同样这 2 条 Just One 是 2/2 成功，是真互补，所以留它做第三级。
 *
 * 分工：
 *   哼哼猫 (0.01元) —— 图文/标签，成功率最高、正文最全（736 字 vs apizero 708）
 *   apizero (0.01元) —— 作者+互动数，实测成功率约 38%，但便宜，能白捡就捡
 *   Just One (0.15元) —— 只在前两者都没给互动数时才调。**没配 JUSTONE_API_TOKEN 时
 *                       整段跳过**，所以默认是 0.02元/条的双家方案，手填那 62% 的互动数。
 *                       哪天觉得手填烦了，填个环境变量就自动启用，不用改代码。
 *
 * 浏览数三家都拿不到，恒为 0。
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
  apiUsed?: 'henghengmao+apizero' | 'henghengmao+justone' | 'henghengmao' | 'apizero' | 'justone' | 'fallback'
  apiError?: string
  compareNote?: string
  normalizedUrl?: string
  noteId?: string
}> {
  console.log('[快捷保存] 开始解析链接:', url)
  console.log('[快捷保存] 策略: 哼哼猫(图文) ‖ apizero(互动数)，缺互动数才动第三级 JustOne')

  // 先归一化，剥掉 shareRedId / xsec_token / share_id 等标识再往外发
  const { cleanUrl, noteId } = await normalizeXhsUrl(url)
  if (noteId) {
    console.log('[快捷保存] 已归一化，note_id =', noteId, '（账号标识未外发）')
  }

  const [hhmSettled, azSettled] = await Promise.allSettled([
    parseXiaohongshuWithHenghengmao(cleanUrl),
    parseXiaohongshuWithApiZero(cleanUrl),
  ])
  const hhm = hhmSettled.status === 'fulfilled' ? hhmSettled.value : null
  const az  = azSettled.status  === 'fulfilled' ? azSettled.value  : null
  const hhmErr = hhmSettled.status === 'rejected' ? (hhmSettled.reason?.message || String(hhmSettled.reason)) : ''
  const azErr  = azSettled.status  === 'rejected' ? (azSettled.reason?.message  || String(azSettled.reason))  : ''

  // ── 情况1：哼哼猫拿到图文（主路径）──
  if (hhm) {
    const azStats = pickStats(az)
    if (azStats) {
      console.log('[快捷保存] ✅ 哼哼猫图文 + apizero互动数（0.02元，最优）')
      return {
        ...hhm, ...azStats,
        apiUsed: 'henghengmao+apizero',
        normalizedUrl: cleanUrl,
        noteId,
        compareNote: '采集来源: 哼哼猫图文 + apizero互动数',
      }
    }

    // apizero 没给互动数，才动第三级
    console.warn('[快捷保存] ⚠️  apizero 未取到互动数，尝试第三级 JustOne:', azErr.substring(0, 80))
    const joStats = pickStats(await tryJustOne(cleanUrl))
    if (joStats) {
      console.log('[快捷保存] ✅ 哼哼猫图文 + JustOne互动数')
      return {
        ...hhm, ...joStats,
        apiUsed: 'henghengmao+justone',
        normalizedUrl: cleanUrl,
        noteId,
        compareNote: '采集来源: 哼哼猫图文 + JustOne互动数（apizero未取到）',
      }
    }
    return {
      ...hhm,
      apiUsed: 'henghengmao',
        normalizedUrl: cleanUrl,
        noteId,
      apiError: `apizero未取到互动数: ${azErr.substring(0, 160)}`,
      compareNote: '采集来源: 哼哼猫图文（apizero和JustOne都未取到互动数）',
    }
  }

  // ── 情况2：哼哼猫挂了，apizero 活 —— 图文也用它（图片已改写成原图）──
  if (az) {
    console.warn('[快捷保存] ⚠️  哼哼猫失败，图文改用 apizero（图片已改写为原图）:', hhmErr.substring(0, 80))
    return {
      ...az,
      apiUsed: 'apizero',
        normalizedUrl: cleanUrl,
        noteId,
      apiError: `哼哼猫失败(图文改用apizero): ${hhmErr.substring(0, 160)}`,
      compareNote: '采集来源: apizero 图文+互动数（哼哼猫未取到）',
    }
  }

  // ── 情况3：两家都挂 —— 第三级顶上 ──
  console.warn('[快捷保存] ⚠️  哼哼猫和 apizero 都失败，尝试第三级 JustOne')
  const jo = await tryJustOne(cleanUrl)
  if (jo) {
    return {
      ...jo,
      apiUsed: 'justone',
        normalizedUrl: cleanUrl,
        noteId,
      apiError: `哼哼猫: ${hhmErr.substring(0, 80)} | apizero: ${azErr.substring(0, 80)}`,
      compareNote: '采集来源: JustOne 全套（前两家都未取到）',
    }
  }

  // ── 情况4：全挂 —— 兜底空记录，至少留下链接 ──
  console.error('[快捷保存] ❌ 三家均失败，启用兜底保存（飞书留空记录）')
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
        normalizedUrl: cleanUrl,
        noteId,
    apiError: `哼哼猫: ${hhmErr} | apizero: ${azErr} | JustOne 也未取到`,
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

    // tableId 必须显式传入，不再回落到 FEISHU_DEFAULT_TABLE_ID。
    //
    // 2026-08-22 踩过一次：快捷指令新加了「自发笔记」分支，但 requestBody 词典里
    // 的 tableId 没绑到命名变量，发出来是空的。服务端静默用了默认表，18 张图全
    // 写进了 cynid，用户在自发笔记表里等半天以为是采集失败。
    // 写错表比当场报错难查得多——报错至少快捷指令会弹通知。
    if (typeof tableId !== 'string' || !tableId.trim()) {
      console.error('[快捷保存] ❌ 请求未带 tableId，拒绝执行（不再回落默认表）')
      return NextResponse.json({
        success: false,
        message: '❌ 请求里没有 tableId\n\n检查快捷指令 requestBody 词典：tableId 那一栏要绑「命名变量 tableId」，不能绑某个「文本」动作的输出（换分支就会变空）。\n\n服务端已不再静默使用默认表，避免笔记写错表。'
      }, { status: 400 })
    }

    const finalTableId = tableId.trim()
    const finalAppToken = (typeof appToken === 'string' && appToken.trim())
      ? appToken.trim()
      : process.env.FEISHU_DEFAULT_APP_TOKEN

    if (!finalAppToken) {
      return NextResponse.json({
        success: false,
        message: '❌ 请求里没有 appToken，且服务端未配置 FEISHU_DEFAULT_APP_TOKEN'
      }, { status: 400 })
    }

    // 异步模式：立即返回响应，所有耗时操作（解析+保存+图片）全部在后台执行
    // 解决 Vercel 10s 函数限制 + 中国网络延迟导致的超时问题
    if (isAsync) {
      console.log('[快捷保存] 🚀 全异步模式：立即返回，后台完成所有操作')

      // 所有耗时操作移到 after() 后台执行（响应发出后才开始）
      after(async () => {
        try {
          const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError, compareNote, normalizedUrl } = await parseXiaohongshu(url)
          // 入库用归一化后的链接：稳定、可去重，也不把账号标识留在自己表里
          const saveUrl = normalizedUrl || url
          // 查重只提示不拦截——有时你是故意重采的
          const dupId = await findExistingRecord(finalAppToken, finalTableId, saveUrl)
          const dupNote = dupId ? `♻️ 这篇之前采过（record_id=${dupId}），本条是重复记录` : undefined
          // 把降级情况写入备注，方便飞书里识别（不只是兜底那一种）
          const finalRemark = buildRemark(apiUsed, apiError, remark, compareNote, dupNote)
          const { recordId } = await saveToFeishu(
            finalAppToken, finalTableId,
            title, content, tags,
            [],
            saveUrl, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime,
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
    const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError, compareNote, normalizedUrl } = await parseXiaohongshu(url)

    const saveUrl = normalizedUrl || url
    const dupId = await findExistingRecord(finalAppToken, finalTableId, saveUrl)
    const dupNote = dupId ? `♻️ 这篇之前采过（record_id=${dupId}），本条是重复记录` : undefined

    // 把降级情况写入备注（不只是兜底那一种）
    const finalRemark = buildRemark(apiUsed, apiError, remark, compareNote, dupNote)

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
      saveUrl,
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
      apiInfo = '\n🎯 哼哼猫图文 + apizero互动数（完整，0.02元）'
    } else if (apiUsed === 'henghengmao+justone') {
      apiInfo = '\n🎯 哼哼猫图文 + JustOne互动数（完整）'
    } else if (apiUsed === 'henghengmao') {
      apiInfo = '\n📌 图文和原图已齐，互动数待补（去原帖抄4个数字）'
    } else if (apiUsed === 'apizero') {
      apiInfo = '\n⚠️ 哼哼猫挂了，图文改用apizero（图片已改写为原图）'
    } else if (apiUsed === 'justone') {
      apiInfo = '\n⚠️ 前两家都挂，JustOne 顶上'
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
