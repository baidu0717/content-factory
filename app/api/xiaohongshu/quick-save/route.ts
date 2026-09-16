import { NextRequest, NextResponse, after } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu } from '@/lib/feishuAuth'
import axios from 'axios'

// apizero.cn video-parse API 配置（主力）
const APIZERO_API_KEY = process.env.APIZERO_API_KEY || ''
const APIZERO_API_BASE = 'https://v1.apizero.cn/api/video-parse'

// apizero 单次请求超时：它自身失败要烧 9~13 秒（内部代理竞速两轮），
// 超时设太短会把真实错误码掐成 timeout，反而看不出失败原因
// 8 秒（原 25 秒）。同步模式下 Vercel 函数上限是 10 秒，25 秒的单次超时
// 本来就不可能等到——超时前函数已经被平台掐断了。
const APIZERO_TIMEOUT_MS = 8000
// 最多 2 次（间隔 1 秒）。
//
// ⚠️ 2026-09-17 从 4 次调回 2 次。昨天加到 4 次的理由是「哼哼猫停用后时间预算腾出来了」，
// 但那个判断基于一个错误的前提——我以为失败是「上游代理池整体空了」，重试能撞窗口。
//
// 实际是**按笔记限流**：同一条笔记被反复打就会被针对性拦截。今天的数据很整齐——
// 每条没打过的新笔记第一次调用都成功，反复打之后就持续 empty_pool。
// （我还用连打同一条笔记 30 次的探针「证明」了池子是空的，等于自己制造了证据。）
//
// 在这个前提下多重试是有害的：用户按一次快捷指令 = 对同一条笔记连打 4 次，
// 正好是触发风控的做法，而且后面几次几乎不可能成功。
//
// 有效的做法是「过几分钟手动重跑」，不是「同一秒内多打几次」。
// 失败的代价现在已经很低（不留垃圾记录、提示看得见），所以把重试的活交回给人。
const APIZERO_MAX_ATTEMPTS = 2

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

// 哼哼猫 API 配置
//
// ⚠️ 2026-09-16 用户决定停用。原因：
//   服务端返 HTTP 522（连续重试 4 次全失败），而它在并行链里是最慢的一环——
//   实测一次采集耗时 201 秒，其中绝大部分耗在等它重试超时。
//   apizero 单家已经能出「图文 + 互动数」（走下面「情况2」分支），
//   图片经 toOriginalImageUrl 拿无签名原图，实测 9/9 成功、bpp 0.108~0.166。
//
// 想恢复：把 HENGHENGMAO_ENABLED 改回 true 即可，解析函数原样保留没删。
const HENGHENGMAO_ENABLED = false
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
  if (!body) return false
  // 官方错误码表（2026-09-16 从 apizero.cn/aidocs/video-parse 抄来的）：
  //   4000 参数错 / 4011 Key无效 / 4013 Key暂停 / 4014 IP不在白名单 / 4015 需要Key
  //   4022 余额不足 / 4029 QPS超限 / 4030 今日免费额度用完
  //   4040 接口下线 / 4041 接口不存在 / 5000 服务器内部错
  //   5020 上游暂时不可用 / 5021 上游返回格式异常 / 5030 暂无可用节点
  // 只有「上游/限速」这几类重试才有意义，鉴权和额度类重试多少次都一样。
  if (body.code === 4029) return true                       // QPS 超了，退避后能过
  if (![5020, 5021, 5030].includes(body.code)) return false // 其余一律不重试
  return body?.data?.reason !== 'note_unavailable'          // 笔记本身没了，重试无意义
}

/**
 * 这次失败是不是「暂时性」的——决定要不要往飞书写兜底空记录。
 *
 * 2026-09-16 加：上游故障时不该建空记录。
 * 当天 apizero 的小红书通道整体挂掉（持续返 5020 empty_pool，连它自己文档里的
 * 示例笔记都解析不了），每试一次就往飞书塞一条「⚠️ 待补充」，用户手动删了 10 条。
 * 这类故障过一阵就好，正确做法是让用户稍后重试，而不是留一条要人工清理的垃圾。
 */
function isTransientFailure(errMsg: string): boolean {
  return /\b(5020|5021|5030|4029)\b/.test(errMsg || '')
}

/**
 * 这次失败是不是「配置错误」——同样不该写兜底空记录，但原因和处理方式都不同。
 *
 * 2026-09-17 加：用户升级会员后旧的 sk_test_ 密钥被轮换失效，而 Vercel 环境变量
 * 还是旧值，于是每采一条就往飞书写一条「⚠️ 待补充」。
 *
 * 这类和「笔记被删」有本质区别：
 *   笔记被删   → 建记录留住链接是对的，内容确实要人工补
 *   密钥失效   → 每采一条就产生一条垃圾记录，而真正该做的是去改配置
 * 所以要单独分出来，提示「去更新密钥」而不是「去飞书补内容」。
 *
 *   4011 API Key 无效 / 4013 Key 已暂停 / 4014 IP 不在白名单 / 4015 此接口需要 Key
 *   4022 余额不足 / 4030 今日免费额度已用完   ← 这两个也是「去后台处理」，不是「补内容」
 */
function isConfigFailure(errMsg: string): boolean {
  return /\b(4011|4013|4014|4015|4022|4030)\b/.test(errMsg || '')
}

/**
 * 解析小红书链接（使用 apizero.cn video-parse API - 主力）
 */
async function parseXiaohongshuWithApiZero(url: string) {
  console.log('[快捷保存-apizero] 开始解析链接:', url)

  // apizero 需要真实小红书链接，先解析短链接
  const { fullUrl } = await getFullUrlAndNoteId(url)

  console.log('[快捷保存-apizero] 调用 apizero API...')

  // 2026-09-16 改：4 次退避（1s/2s/4s），原来是 2 次固定 1 秒。
  // 上游代理池是一阵一阵的，多等几秒常常就换到可用节点了；哼哼猫停用后时间预算也腾出来了。
  let data: any
  for (let attempt = 1; attempt <= APIZERO_MAX_ATTEMPTS; attempt++) {
    try {
      const axiosResp = await axios.get(APIZERO_API_BASE, {
        // 鉴权用官方推荐的 Bearer 头（query 的 key= 只是兼容写法，且仅对
        // sk_live_/sk_test_/sk_stag_ 形态生效）。2026-09-16 实测两种等价，从推荐的。
        headers: { Authorization: `Bearer ${APIZERO_API_KEY}` },
        // flat=2：单层 data，type 全平台只出 视频 | 图集 | 实况图集（文档 v1.3 起推荐）。
        // 下面 `d.type === '视频'` 的判断在 flat=2 下依然成立，图集/实况图集都走 imagelist。
        params: { url: fullUrl, flat: 2 },
        timeout: APIZERO_TIMEOUT_MS
      })
      data = axiosResp.data
    } catch (axiosErr: any) {
      const body = axiosErr?.response?.data
      const status = axiosErr?.response?.status || 'timeout'
      const errBody = JSON.stringify(body || {}).substring(0, 200)
      console.error(`[快捷保存-apizero] API错误（第${attempt}次）:`, status, errBody)
      if (attempt < APIZERO_MAX_ATTEMPTS && isApiZeroRetryable(body)) {
        const wait = 1000 * Math.pow(2, attempt - 1)
        console.warn(`[快捷保存-apizero] 上游抓取失败，${wait}ms 后重试（${attempt}/${APIZERO_MAX_ATTEMPTS}）...`)
        await new Promise(resolve => setTimeout(resolve, wait))
        continue
      }
      throw new Error(`apizero API请求失败: HTTP ${status} ${errBody}`)
    }

    // HTTP 200 但业务码非 0
    if (data.code !== 0) {
      console.error(`[快捷保存-apizero] 业务错误（第${attempt}次）:`, data.code, data.msg)
      if (attempt < APIZERO_MAX_ATTEMPTS && isApiZeroRetryable(data)) {
        const wait = 1000 * Math.pow(2, attempt - 1)
        console.warn(`[快捷保存-apizero] 上游抓取失败，${wait}ms 后重试（${attempt}/${APIZERO_MAX_ATTEMPTS}）...`)
        await new Promise(resolve => setTimeout(resolve, wait))
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
  if (!url) return url
  if (url.includes('imageView2')) return url      // 哼哼猫：已经是原图档，别动

  try {
    const u = new URL(url)
    const segs = u.pathname.replace(/^\//, '').split('/')

    // 形态一（2026-08 及以前的 apizero）：
    //   /<签名时间戳>/<签名hash>/notes_pre_post/<图片ID>!nd_prv_wlteh_jpg_3
    // 丢掉前两段签名，保留其余目录 + 图片ID，去掉 ! 之后的档位后缀
    if (url.includes('!nd_')) {
      if (segs.length < 3) return url
      const kept = segs.slice(2)
      kept[kept.length - 1] = kept[kept.length - 1].split('!')[0]
      if (!kept[kept.length - 1]) return url
      return `https://ci.xiaohongshu.com/${kept.join('/')}?imageView2/2/w/0/format/jpg`
    }

    // 形态二（2026-09-16 实测 apizero 改成了这个）：
    //   https://sns-img-hw.xhscdn.com/<图片ID>        ← 裸 ID，无路径前缀、无档位后缀
    // 这种 URL 直接访问返回 404（download origin failed because resource not found），
    // 必须补回 notes_pre_post/ 前缀才拿得到图。实测 9/9 全部成功，
    // 长边 1448~1660、体积 205~334KB、bpp 0.108~0.166，与哼哼猫同档。
    // ⚠️ 旧版这里写的是 `if (!url.includes('!nd_')) return url`，
    //    新格式不含 !nd_ 被原样放过，导致 9/9 图片下载失败。
    if (segs.length === 1 && /^[a-z0-9]{20,}$/i.test(segs[0])) {
      return `https://ci.xiaohongshu.com/notes_pre_post/${segs[0]}?imageView2/2/w/0/format/jpg`
    }

    return url
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
 * 把分享链接拆成两个用途不同的地址
 *
 * 为什么要拆（2026-08-22）：
 * 小红书 App 复制出来的分享链展开后带一串标识：
 *   shareRedId —— **账号级、跨笔记恒定**（实测同一账号三条链该值完全相同，换账号才变）
 *   share_id / apptime / app_version / app_platform —— 单次分享标识和客户端指纹
 *   xsec_token —— 该笔记的读取凭证（笔记级，不是账号级）
 *
 * 前两类纯属白送：实测哼哼猫（原始短链/干净 discovery/explore 三种形态返回一致）
 * 和 apizero（连 xsec_token 都不要）都只需要 note_id。送出去等于让第三方拿到你的
 * 小红书账号身份，也让小红书那边能把"陌生IP高频抓取"和这个账号对上。
 *
 * 但 xsec_token 不能剥：实测裸 `discovery/item/<id>` 在浏览器里会跳到 404
 * （error_msg=当前笔记暂时无法浏览），带上 token 才停在笔记页。
 * 而"飞书表里点链接能打开笔记"是硬要求。
 *
 * 所以拆成两个：
 *   apiUrl  —— 裸 note_id，外发给三家 API 用，零标识
 *   linkUrl —— note_id + xsec_token，存进飞书用，可点击、但不含账号标识
 *
 * 解析失败时两个都退回原始链接 —— 隐私加固不能反过来降低成功率或弄坏点击。
 */
async function normalizeXhsUrl(url: string): Promise<{ apiUrl: string; linkUrl: string; noteId: string }> {
  try {
    const { fullUrl, noteId } = await getFullUrlAndNoteId(url)
    if (noteId) {
      const apiUrl = `https://www.xiaohongshu.com/discovery/item/${noteId}`
      // 从展开后的链接里只挑出 xsec_token，其余参数一律不要
      let token = ''
      try {
        token = new URL(fullUrl).searchParams.get('xsec_token') || ''
      } catch { /* fullUrl 不是标准 URL 就当没有 token */ }
      const linkUrl = token
        ? `${apiUrl}?xsec_token=${encodeURIComponent(token)}&xsec_source=pc_feed`
        : apiUrl
      return { apiUrl, linkUrl, noteId }
    }
  } catch (e: any) {
    console.warn('[快捷保存] 链接归一化失败，退回原始链接（本次会带上账号标识）:',
      (e?.message || String(e)).substring(0, 100))
  }
  return { apiUrl: url, linkUrl: url, noteId: '' }
}

/**
 * 查这篇笔记在目标表里是否已经采过（只提示，不拦截）
 *
 * 按 note_id 模糊匹配，不能按整条链接精确匹配——同一篇笔记每次重新分享
 * xsec_token 都不一样，精确匹配永远查不到重复。
 */
async function findExistingRecord(
  appToken: string, tableId: string, noteId: string
): Promise<string | null> {
  if (!noteId) return null
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
            conditions: [{ field_name: '笔记链接', operator: 'contains', value: [noteId] }],
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

  // 拆成两个：apiUrl 外发给三家（零标识），linkUrl 存飞书（可点击、无账号标识）
  const { apiUrl, linkUrl, noteId } = await normalizeXhsUrl(url)
  if (noteId) {
    console.log('[快捷保存] 已归一化，note_id =', noteId, '（账号标识未外发；入库链接保留 xsec_token 以便点击）')
  }

  const [hhmSettled, azSettled] = await Promise.allSettled([
    HENGHENGMAO_ENABLED
      ? parseXiaohongshuWithHenghengmao(apiUrl)
      : Promise.reject(new Error('哼哼猫已停用（2026-09-16，HTTP 522 且拖慢整条链路）')),
    parseXiaohongshuWithApiZero(apiUrl),
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
        normalizedUrl: linkUrl,
        noteId,
        compareNote: '采集来源: 哼哼猫图文 + apizero互动数',
      }
    }

    // apizero 没给互动数，才动第三级
    console.warn('[快捷保存] ⚠️  apizero 未取到互动数，尝试第三级 JustOne:', azErr.substring(0, 80))
    const joStats = pickStats(await tryJustOne(apiUrl))
    if (joStats) {
      console.log('[快捷保存] ✅ 哼哼猫图文 + JustOne互动数')
      return {
        ...hhm, ...joStats,
        apiUsed: 'henghengmao+justone',
        normalizedUrl: linkUrl,
        noteId,
        compareNote: '采集来源: 哼哼猫图文 + JustOne互动数（apizero未取到）',
      }
    }
    return {
      ...hhm,
      apiUsed: 'henghengmao',
        normalizedUrl: linkUrl,
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
        normalizedUrl: linkUrl,
        noteId,
      apiError: `哼哼猫失败(图文改用apizero): ${hhmErr.substring(0, 160)}`,
      compareNote: '采集来源: apizero 图文+互动数（哼哼猫未取到）',
    }
  }

  // ── 情况3：两家都挂 —— 第三级顶上 ──
  console.warn('[快捷保存] ⚠️  哼哼猫和 apizero 都失败，尝试第三级 JustOne')
  const jo = await tryJustOne(apiUrl)
  if (jo) {
    return {
      ...jo,
      apiUsed: 'justone',
        normalizedUrl: linkUrl,
        noteId,
      apiError: `哼哼猫: ${hhmErr.substring(0, 80)} | apizero: ${azErr.substring(0, 80)}`,
      compareNote: '采集来源: JustOne 全套（前两家都未取到）',
    }
  }

  // ── 情况4：全挂 ──
  // 先分一下是「暂时性故障」还是「这条笔记真的采不到」，两者处理方式不同：
  //   暂时性（5020 上游不可用 / 5021 格式异常 / 5030 无可用节点 / 4029 QPS）
  //     → 直接抛错，让上层提示「稍后重试」。**不写兜底空记录。**
  //   其余（笔记被删、鉴权失效、参数错等）
  //     → 建兜底记录，至少把链接留下来，人工补内容。
  //
  // 2026-09-16 加这个分叉的原因：当天 apizero 小红书通道整体挂了，每试一次就往飞书
  // 塞一条「⚠️ 待补充」，用户手动删了 10 条。上游故障过一阵就好，留垃圾记录没有意义。
  if (isConfigFailure(azErr) || isConfigFailure(hhmErr)) {
    console.error('[快捷保存] 🔑 API 凭据/额度有问题，不建兜底记录，需要去后台处理')
    throw new Error(
      `API_CONFIG_ERROR: 采集 API 的密钥或额度有问题，这条没采到。` +
      `（未写入飞书，避免产生需要手动清理的空记录）\n详情: apizero: ${azErr.substring(0, 160)}`
    )
  }

  if (isTransientFailure(azErr) || isTransientFailure(hhmErr)) {
    console.error('[快捷保存] ⏸ 上游暂时不可用，不建兜底记录，让用户稍后重试')
    throw new Error(
      `UPSTREAM_UNAVAILABLE: 采集服务上游暂时不可用，请过几分钟再试。` +
      `（未写入飞书，避免产生需要手动清理的空记录）\n详情: apizero: ${azErr.substring(0, 160)}`
    )
  }

  console.error('[快捷保存] ❌ 三家均失败且非暂时性故障，启用兜底保存（飞书留空记录）')
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
        normalizedUrl: linkUrl,
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
    // 3 次，退避 1s/2s/3s，单张最坏约 6 秒。
    //
    // ⚠️ 2026-09-17 从 10 次砍到 3 次。原来是「10 次 × 退避最多 10 秒」，
    // 单张图最坏能吃掉 2+3+4+5+6+7+8+9+10+10 ≈ 64 秒——比整个函数的
    // maxDuration(60s) 还长，一张图就能把预算耗光，后面的图和写记录全都执行不到。
    // 实测就踩到了：同步模式跑满 60 秒被平台掐断，飞书里一条记录都没留下。
    //
    // 而且图片下载失败大多不是重试能解决的（URL 格式不对、资源不存在），
    // 真正瞬时的网络抖动 3 次足够覆盖。
    const MAX_RETRIES = 3
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
          const delayTime = Math.min(1000 + retry * 1000, 3000) // 1s/2s/3s，最多等3秒
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

/**
 * 往飞书群发一条通知。只在**异步后台任务**里用。
 *
 * 2026-09-17 加。异步模式的死角：响应 1 秒内就返回 success:true，那时候后台
 * 一点活都没干。之后不管是 apizero 被风控挡下、函数超时被掐、还是图片全部上传
 * 失败，用户在手机上看到的都是同一句「采集成功」——四种结果一个提示，
 * 出了问题完全没有可用信号（after() 的失败分支原来只有一行 console.error，
 * 而 Vercel 日志用户看不到）。
 *
 * 所以：成功进表用户自己看得见，**失败和「存了但图没进去」必须主动推一条**。
 * 通知失败本身不抛错——它只是观测手段，不该反过来影响主流程。
 */
async function notifyFeishu(text: string): Promise<void> {
  const hook = process.env.FEISHU_WEBHOOK_URL
  if (!hook) return
  try {
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } })
    })
  } catch (e) {
    console.warn('[快捷保存-通知] 发送失败（不影响主流程）:', e)
  }
}

// Vercel 函数最长执行时间（秒）。
//
// ⚠️ 2026-09-17 加。此前没设，用的是 Hobby 默认的 10 秒——而 after() 里的后台任务
// 时间是**算进函数总时长**的：解析（最多 17 秒）+ 下载 9 张图 + 逐张上传飞书 +
// 写记录，远超 10 秒，函数在中途被平台掐断，飞书里什么都没写进去。
// 而异步模式的响应「⏳ 正在后台保存」在活干完之前就发出去了，所以用户看到
// 「采集成功」但表里没有记录——两件事对不上，最难查的那种。
//
// Hobby 计划上限是 60 秒，这里取满。图多的笔记（18 张）实测要 40 秒以上。
export const maxDuration = 60

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
    const { url, appToken, tableId, async: rawAsync, remark } = body

    // 异步是默认模式，只有显式传 false / "false" 才走同步。
    //
    // 2026-09-17 改。原来是 `async: isAsync` 直接取值，没传就走同步——而同步模式
    // 要 9~20 秒才返回，快捷指令 3-5 秒就报「网络已中断」，用户根本拿不到结果。
    //
    // 而「没传」几乎都不是有意的：快捷指令 requestBody 词典里那一项绑错了变量
    // （绑成某个「文本」动作的输出，换个分支就变空），发出来就是 undefined。
    // 这个坑在 tableId 上已经踩过一次（见下方注释），不该在 async 上再踩一次。
    //
    // 服务端实测：异步 1.15 秒返回，同步 9~20 秒。对手机端来说异步是唯一可用的模式，
    // 所以把它变成默认值，而不是让调用方记得传。
    const isAsync = rawAsync !== false && rawAsync !== 'false'

    console.log('[快捷保存] 收到请求:', { url, appToken, tableId, rawAsync, 实际模式: isAsync ? '异步' : '同步', remark })
    console.log('[快捷保存] 环境变量 DEFAULT_APP_TOKEN:', process.env.FEISHU_DEFAULT_APP_TOKEN)
    console.log('[快捷保存] 环境变量 DEFAULT_TABLE_ID:', process.env.FEISHU_DEFAULT_TABLE_ID)

    // 验证URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        message: '❌ 请提供小红书链接'
      }, { status: 200 })   // 200：快捷指令读不到非 2xx 的响应体，见文件末尾 catch 处说明
    }

    // tableId 必须显式传入，不再回落到 FEISHU_DEFAULT_TABLE_ID。
    //
    // 2026-08-22 踩过一次：快捷指令新加了「自发笔记」分支，但 requestBody 词典里
    // 的 tableId 没绑到命名变量，发出来是空的。服务端静默用了默认表，18 张图全
    // 写进了 cynid，用户在自发笔记表里等半天以为是采集失败。
    // 写错表比当场报错难查得多——报错至少用户当场能看见。
    // ⚠️ 2026-09-17 修正：原注释写的是「报错至少快捷指令会弹通知」，这个假设是错的。
    //    快捷指令碰到非 2xx 只会报「网络已中断」，下面这段提示一个字都显示不出来。
    //    所以状态码改成 200，靠 success:false 区分。
    if (typeof tableId !== 'string' || !tableId.trim()) {
      console.error('[快捷保存] ❌ 请求未带 tableId，拒绝执行（不再回落默认表）')
      return NextResponse.json({
        success: false,
        message: '❌ 请求里没有 tableId\n\n检查快捷指令 requestBody 词典：tableId 那一栏要绑「命名变量 tableId」，不能绑某个「文本」动作的输出（换分支就会变空）。\n\n服务端已不再静默使用默认表，避免笔记写错表。'
      }, { status: 200 })   // 200：快捷指令读不到非 2xx 的响应体，见文件末尾 catch 处说明
    }

    const finalTableId = tableId.trim()
    const finalAppToken = (typeof appToken === 'string' && appToken.trim())
      ? appToken.trim()
      : process.env.FEISHU_DEFAULT_APP_TOKEN

    if (!finalAppToken) {
      return NextResponse.json({
        success: false,
        message: '❌ 请求里没有 appToken，且服务端未配置 FEISHU_DEFAULT_APP_TOKEN'
      }, { status: 200 })   // 200：快捷指令读不到非 2xx 的响应体，见文件末尾 catch 处说明
    }

    // 异步模式：立即返回响应，所有耗时操作（解析+保存+图片）全部在后台执行
    // 解决 Vercel 10s 函数限制 + 中国网络延迟导致的超时问题
    if (isAsync) {
      console.log('[快捷保存] 🚀 全异步模式：立即返回，后台完成所有操作')

      // 所有耗时操作移到 after() 后台执行（响应发出后才开始）
      after(async () => {
        try {
          const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError, compareNote, normalizedUrl, noteId } = await parseXiaohongshu(url)
          // 入库用归一化后的链接：稳定、可去重，也不把账号标识留在自己表里
          const saveUrl = normalizedUrl || url
          // 查重只提示不拦截——有时你是故意重采的
          const dupId = await findExistingRecord(finalAppToken, finalTableId, noteId || '')
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
          let imgOk = 0
          if (images.length > 0 && recordId) {
            imgOk = await processImagesAndUpdate(recordId, images, finalAppToken, finalTableId)
          }
          console.log('[快捷保存-后台] ✅ 保存成功:', title, apiUsed === 'fallback' ? '（兜底记录）' : '')

          // 只在「存了但图没进全」时提醒——全成功的话表里看得见，不必打扰
          if (images.length > 0 && imgOk < images.length) {
            await notifyFeishu(
              `⚠️ 笔记存进表了，但图片没进全\n\n` +
              `📝 ${title}\n` +
              `📸 图片 ${imgOk}/${images.length} 张成功\n` +
              `🔗 ${saveUrl}\n\n` +
              `可以重跑一次快捷指令补图。`
            )
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[快捷保存-后台] ❌ 失败:', err)

          // ⭐ 这条是整个异步模式的闭环：手机端已经回过「正在后台保存」了，
          // 不推这条通知的话，用户永远不知道它其实失败了。
          let head = '❌ 采集失败，飞书里没有这条记录'
          let tip  = '过几分钟重跑一次快捷指令。'
          if (msg.startsWith('UPSTREAM_UNAVAILABLE')) {
            head = '⏸ 采集失败：解析服务上游暂时不可用'
            tip  = '过几分钟重跑；如果同一条链接一直失败，换一条新链接试（同一篇被反复采会触发风控）。'
          } else if (msg.startsWith('API_CONFIG_ERROR')) {
            head = '🔑 采集失败：API 密钥或额度有问题'
            tip  = '去 apizero 后台确认密钥有效、额度没用完，然后更新 Vercel 环境变量 APIZERO_API_KEY（注意 Production 那一条）。'
          }
          await notifyFeishu(
            `${head}\n\n🔗 ${url}\n\n💡 ${tip}\n\n详情：${msg.substring(0, 300)}`
          )
        }
      })

      // 立即返回，iOS 不等待
      return NextResponse.json({
        success: true,
        // 回显收到的 async 原值：快捷指令那头看得见，能自己确认词典绑对没有。
        // rawAsync=undefined 说明这一项没传到（词典绑错变量），虽然现在不影响
        // 功能（默认就走异步），但值得顺手修掉。
        message: rawAsync === undefined
          ? `⏳ 正在后台保存到飞书，稍后查看表格...\n\n⚠️ 请求里没带 async（已按默认异步执行）\n   快捷指令 requestBody 词典里 async 那一项可能绑错了变量`
          : `⏳ 正在后台保存到飞书，稍后查看表格...`,
        data: { async: true, receivedAsync: rawAsync ?? null }
      })
    }

    // 同步模式（原有逻辑）
    // 1. 解析小红书链接（自动选择API）
    const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError, compareNote, normalizedUrl, noteId } = await parseXiaohongshu(url)

    const saveUrl = normalizedUrl || url
    const dupId = await findExistingRecord(finalAppToken, finalTableId, noteId || '')
    const dupNote = dupId ? `♻️ 这篇之前采过（record_id=${dupId}），本条是重复记录` : undefined

    // 把降级情况写入备注（不只是兜底那一种）
    const finalRemark = buildRemark(apiUsed, apiError, remark, compareNote, dupNote)

    // 2. 先写记录（不带图），3. 再补图 —— 顺序和异步模式对齐
    //
    // ⚠️ 2026-09-17 把顺序调过来了。原来是「先处理图片，再写记录」，
    // 于是图片环节一旦超时，函数被平台掐断，**记录压根没机会写，笔记内容全丢**。
    // 实测踩到：同步模式跑满 60 秒被掐，飞书里一条记录都没有，
    // 用户那头既没有记录也没有响应，完全无从判断发生了什么。
    //
    // 异步模式一直是「先写记录再 processImagesAndUpdate 补图」的正确顺序，
    // 两条路不一致本身就是隐患。现在统一：**先保住文字，图片尽力而为。**
    // 最坏情况也只是「有记录、图没进全」——那种情况可以重跑补图，
    // 比整条丢失好得多。
    const { recordId } = await saveToFeishu(
      finalAppToken,
      finalTableId,
      title,
      content,
      tags,
      [],
      saveUrl,
      authorName,
      viewCount,
      likedCount,
      collectedCount,
      commentCount,
      publishTime,
      finalRemark
    )

    let fileTokens: (string | null)[] = []
    if (images.length > 0 && recordId) {
      const okCount = await processImagesAndUpdate(recordId, images, finalAppToken, finalTableId)
      fileTokens = new Array(okCount).fill('ok')
    }

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
    const msg = error instanceof Error ? error.message : '未知错误'

    // ⚠️ 下面这几种「已知失败」一律返 HTTP 200，靠响应体里的 success:false 区分。
    //
    // 2026-09-17 踩到的坑：原本给配置错误返 502、暂时性故障返 503，语义上更准确，
    // 但 iOS 快捷指令的「获取 URL 内容」碰到非 2xx 会直接报「网络已中断」，
    // **根本不显示响应体**——精心写的人话提示用户一个字都看不到。
    //
    // 而且这套接口本来就是「HTTP 200 + success 字段」的风格（参数错那处是个例外），
    // 引入 502/503 反而破坏了一致性。调用方是手机快捷指令，不是标准 HTTP 客户端，
    // 按调用方的能力来设计，不按 REST 教科书。
    //
    // 真正的意外错误（最下面那个 return）仍然返 500——那种情况用户也没法自助处理。

    // 上游暂时不可用：这不是你的操作问题，也没有产生任何飞书记录。
    // 单独给一条人话提示，别让手机端看到一串错误码就以为要手动补内容。
    // 密钥/额度问题：去后台改配置，不是补内容。也没有产生飞书记录。
    if (msg.startsWith('API_CONFIG_ERROR')) {
      return NextResponse.json({
        success: false,
        configError: true,
        message:
          `🔑 采集 API 的密钥或额度有问题，这条没采到\n\n` +
          `✅ 飞书里没有留下空记录，不用手动清理\n` +
          `💡 去 apizero 后台确认密钥是否有效、额度是否用完，\n` +
          `   然后更新 Vercel 环境变量 APIZERO_API_KEY\n\n` +
          `⏱️ 耗时${duration}ms`,
        detail: msg
      }, { status: 200 })   // ⚠️ 必须 200，见下方说明
    }

    if (msg.startsWith('UPSTREAM_UNAVAILABLE')) {
      return NextResponse.json({
        success: false,
        transient: true,
        message:
          `⏸ 采集服务上游暂时不可用，这条没采到\n\n` +
          `✅ 飞书里没有留下空记录，不用手动清理\n` +
          `💡 过几分钟直接重跑快捷指令即可（链接还在剪贴板）\n\n` +
          `⏱️ 耗时${duration}ms`,
        detail: msg
      }, { status: 200 })   // ⚠️ 必须 200，见下方说明
    }

    return NextResponse.json({
      success: false,
      message: `❌ 发生错误: ${msg}`
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
): Promise<number> {   // 返回成功张数，调用方据此决定要不要推「图没进全」的通知
  console.log('[快捷保存-图片后台] 开始后台上传图片，记录ID:', recordId)

  // 1. 上传图片获取 file_token
  const fileTokens = await processImages(imageUrls, appToken)

  const successCount = fileTokens.filter(t => t !== null).length
  console.log(`[快捷保存-图片后台] 上传完成: ${successCount}/${imageUrls.length} 张成功`)

  if (successCount === 0) {
    console.error('[快捷保存-图片后台] 所有图片上传失败，跳过更新记录')
    return 0
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
  return successCount
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
