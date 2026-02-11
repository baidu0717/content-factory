import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu } from '@/lib/feishuAuth'

// 极致了 API 配置（优先使用，数据完整）
const JIZHILE_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY || ''
const JIZHILE_API_BASE = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE || 'https://www.dajiala.com/fbmain/monitor/v3/xhs'

// 哼哼猫 API 配置（备用，免费但数据不全）
const HENGHENGMAO_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY || ''
const HENGHENGMAO_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE || 'https://api.meowload.net/openapi/extract/post'

// 飞书 API 配置
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * 从短链接获取完整URL和note_id
 */
async function getFullUrlAndNoteId(shortUrl: string): Promise<{ fullUrl: string; noteId: string }> {
  console.log('[快捷保存-哼哼猫] 跟随短链接重定向:', shortUrl)

  // 跟随重定向获取完整URL（使用GET方法并允许自动跟随重定向）
  const response = await fetch(shortUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38(0x1800262c) NetType/WIFI Language/zh_CN',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  })

  const fullUrl = response.url
  console.log('[快捷保存-哼哼猫] 完整URL:', fullUrl)

  // 从URL中提取note_id
  // 格式1: https://www.xiaohongshu.com/explore/684aa03a000000002202750b
  // 格式2: https://www.xiaohongshu.com/discovery/item/684aa03a000000002202750b
  // 格式3: https://open.weixin.qq.com/...?redirect_uri=https%3A%2F%2Fwww.xiaohongshu.com%2Fdiscovery%2Fitem%2F695d3ed2000000000c0371c9...

  let noteId: string | null = null

  // 尝试直接从URL提取
  let noteIdMatch = fullUrl.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
  if (noteIdMatch) {
    noteId = noteIdMatch[1]
  } else {
    // 尝试从URL参数中提取（微信OAuth重定向的情况）
    const redirectUriMatch = fullUrl.match(/redirect_uri=([^&]+)/)
    if (redirectUriMatch) {
      const redirectUri = decodeURIComponent(redirectUriMatch[1])
      console.log('[快捷保存-哼哼猫] 从redirect_uri提取:', redirectUri)
      const redirectMatch = redirectUri.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
      if (redirectMatch) {
        noteId = redirectMatch[1]
      }
    }
  }

  // 如果还是没找到，尝试从响应体中提取
  if (!noteId) {
    console.log('[快捷保存-哼哼猫] 尝试从响应体提取note_id...')
    const html = await response.text()

    // 尝试从HTML中查找小红书链接
    const htmlMatch = html.match(/https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
    if (htmlMatch) {
      noteId = htmlMatch[1]
      console.log('[快捷保存-哼哼猫] 从HTML中提取到note_id:', noteId)
    }
  }

  if (!noteId) {
    console.error('[快捷保存-哼哼猫] 无法提取note_id，URL:', fullUrl)
    throw new Error(`无法从URL中提取note_id: ${fullUrl}`)
  }

  console.log('[快捷保存-哼哼猫] 提取到note_id:', noteId)

  return { fullUrl, noteId }
}

/**
 * 解析小红书链接（使用极致了API - 数据完整）
 */
async function parseXiaohongshuWithJizhile(url: string) {
  console.log('[快捷保存-极致了] 开始解析链接:', url)

  // 极致了API需要note_id，先解析短链接获取
  const { noteId } = await getFullUrlAndNoteId(url)

  console.log('[快捷保存-极致了] 调用极致了API...')
  console.log('[快捷保存-极致了] note_id:', noteId)

  const response = await fetch(JIZHILE_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 11,
      note_id: noteId,
      key: JIZHILE_API_KEY
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[快捷保存-极致了] API错误:', errorText)
    throw new Error(`极致了API请求失败: HTTP ${response.status}`)
  }

  const data = await response.json()

  // 检查返回码（极致了API成功返回 code: 0）
  if (data.code !== 0) {
    console.error('[快捷保存-极致了] API返回错误:', data)
    if (data.code === 1001) {
      throw new Error('极致了API: 所有渠道不可用（临时问题）')
    } else if (data.code === 1002) {
      throw new Error('极致了API: 登录已过期，需要刷新KEY')
    } else {
      throw new Error(`极致了API错误: ${data.msg || '未知错误'}`)
    }
  }

  console.log('[快捷保存-极致了] ✅ API调用成功')

  // 极致了API返回的数据结构
  const noteList = data.note_list || []
  if (noteList.length === 0) {
    throw new Error('极致了API: 未找到笔记数据')
  }

  const noteData = noteList[0]
  const userInfo = noteData.user || {}
  const imageList = noteData.images_list || []

  // 提取正文和话题标签
  const rawContent = noteData.desc || ''

  // 清理正文：移除末尾的话题标签
  let content = rawContent
  content = content.replace(/#[^#]+\[话题\]#/g, ' ')
  content = content.replace(/(\s+[@#]\S+)+\s*$/g, '')
  content = content.replace(/\s+/g, ' ').trim()

  // 提取话题标签
  const tagPattern = /#([^#\s]+)\[话题\]#/g
  const tagMatches: string[] = []
  let match
  while ((match = tagPattern.exec(rawContent)) !== null) {
    tagMatches.push('#' + match[1])
  }
  const tags = tagMatches.join(' ')

  // 提取标题和纯正文（智能截取）
  let title = noteData.title || ''
  let bodyContent = content

  if (!title && content) {
    // 如果API没有返回标题，从正文提取
    const firstLine = content.split('\n')[0]
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
  } else if (title && content) {
    // 如果API返回了标题，从正文中移除标题部分
    if (content.startsWith(title)) {
      bodyContent = content.substring(title.length).trim()
    }
  }

  if (!title) {
    title = '小红书笔记'
  }

  if (!bodyContent) {
    bodyContent = content
  }

  // 提取图片URL（优先使用original，其次url）
  const images = imageList
    .map((img: any) => img.original || img.url || '')
    .filter(Boolean)

  // 提取互动数据（极致了API的优势）
  const authorName = userInfo.nickname || userInfo.name || ''
  const viewCount = parseInt(noteData.view_count || '0')
  const likedCount = parseInt(noteData.liked_count || '0')
  const collectedCount = parseInt(noteData.collected_count || '0')
  const commentCount = parseInt(noteData.comments_count || '0')

  // 转换时间戳为日期字符串
  const timestamp = noteData.time || noteData.create_time || 0
  const publishTime = timestamp ? new Date(timestamp * 1000).toISOString().split('T')[0] : ''

  console.log('[快捷保存-极致了] 解析成功 - 标题:', title, '图片数:', images.length)
  console.log('[快捷保存-极致了] ✅ 完整数据 - 作者:', authorName, '浏览:', viewCount, '点赞:', likedCount)

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
 * 解析小红书链接（使用哼哼猫API - 免费但数据不全）
 */
async function parseXiaohongshuWithHenghengmao(url: string) {
  console.log('[快捷保存-哼哼猫] 开始解析链接:', url)

  // 哼哼猫API直接支持短链接，无需先解析
  console.log('[快捷保存-哼哼猫] 调用哼哼猫API...')
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

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[快捷保存-哼哼猫] API错误:', errorText)
    throw new Error(`解析失败: HTTP ${response.status}`)
  }

  const data = await response.json()

  // 详细日志
  console.log('[快捷保存-哼哼猫] API 完整响应:', JSON.stringify(data, null, 2))

  // 哼哼猫API返回格式: { text: string, medias: [...] }
  if (!data.text && !data.medias) {
    console.error('[快捷保存-哼哼猫] API返回数据格式错误:', data)
    throw new Error('API返回数据格式错误')
  }

  console.log('[快捷保存-哼哼猫] 笔记数据获取成功')

  // 提取正文内容
  const rawContent = data.text || ''

  // 清理正文：移除末尾的话题标签
  let content = rawContent

  // 1. 删除 #xxx[话题]# 格式
  content = content.replace(/#[^#]+\[话题\]#/g, ' ')

  // 2. 删除末尾的标签（@用户名 和 #话题#）
  content = content.replace(/(\s+[@#]\S+)+\s*$/g, '')

  // 清理多余的空格
  content = content.replace(/\s+/g, ' ').trim()

  console.log('[快捷保存-哼哼猫] 原始正文:', rawContent.substring(0, 100) + '...')
  console.log('[快捷保存-哼哼猫] 清理后正文:', content.substring(0, 100) + '...')

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
  const images = data.medias
    ?.filter((media: any) => media.media_type === 'image')
    .map((media: any) => media.resource_url || media.preview_url || '')
    .filter(Boolean) || []

  console.log('[快捷保存-哼哼猫] 解析成功 - 标题:', title, '图片数:', images.length)

  // 注意：哼哼猫API不返回以下数据，设为默认值
  const authorName = ''  // 需要手动输入
  const viewCount = 0    // 需要手动输入
  const likedCount = 0   // 需要手动输入
  const collectedCount = 0  // 需要手动输入
  const commentCount = 0    // 需要手动输入
  const publishTime = ''    // 需要手动输入

  console.log('[快捷保存-哼哼猫] ⚠️  哼哼猫API不提供互动数据，作者昵称、浏览数、点赞数等需要手动填写')

  return {
    title,
    content: bodyContent, // 使用纯正文（不含标题）
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
 * 解析小红书链接（统一入口 - 自动回退机制）
 * 优先使用极致了API（完整数据），失败则回退到哼哼猫API（免费但数据不全）
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
  apiUsed?: 'jizhile' | 'henghengmao'
  apiError?: string
}> {
  console.log('[快捷保存] 开始解析链接:', url)
  console.log('[快捷保存] 策略: 优先极致了(完整数据) → 回退哼哼猫(免费)')

  // 尝试1: 极致了API（优先）
  try {
    console.log('[快捷保存] 🎯 尝试使用极致了API...')
    const result = await parseXiaohongshuWithJizhile(url)
    console.log('[快捷保存] ✅ 极致了API成功！使用完整数据')
    return {
      ...result,
      apiUsed: 'jizhile'
    }
  } catch (jizhileError: any) {
    const errorMsg = jizhileError?.message || String(jizhileError)
    console.warn('[快捷保存] ⚠️  极致了API失败:', errorMsg)
    console.warn('[快捷保存] 准备回退到哼哼猫API...')

    // 尝试2: 哼哼猫API（备用）
    try {
      console.log('[快捷保存] 🔄 使用哼哼猫API...')
      const result = await parseXiaohongshuWithHenghengmao(url)
      console.log('[快捷保存] ✅ 哼哼猫API成功！数据不全，需手动填写')
      return {
        ...result,
        apiUsed: 'henghengmao',
        apiError: `极致了失败: ${errorMsg}`
      }
    } catch (henghengmaoError: any) {
      const henghengmaoMsg = henghengmaoError?.message || String(henghengmaoError)
      console.error('[快捷保存] ❌ 哼哼猫API也失败:', henghengmaoMsg)
      console.error('[快捷保存] 所有API都失败，无法继续')
      throw new Error(`解析失败 - 极致了: ${errorMsg}, 哼哼猫: ${henghengmaoMsg}`)
    }
  }
}

/**
 * 下载图片（需要添加 Referer header，否则小红书服务器会返回 403）
 * 自动将 HEIF 格式转换为 JPEG（修改 URL 参数让小红书服务器返回 JPEG）
 */
async function downloadImage(url: string): Promise<Buffer> {
  // 将 HEIF 格式的图片 URL 转换为 JPEG 格式
  // 小红书 CDN URL 格式: https://sns-img-qc.xhscdn.com/xxx?imageView2/.../format/heif/...
  // 转换策略：将 format/heif 替换为 format/jpg
  let processedUrl = url
  if (url.includes('format/heif')) {
    processedUrl = url.replace(/format\/heif/g, 'format/jpg')
    console.log('[图片下载] 检测到HEIF格式，转换为JPEG')
    console.log('[图片下载] 原始URL:', url)
    console.log('[图片下载] 转换后:', processedUrl)
  }

  console.log('[图片下载] 下载图片:', processedUrl.substring(0, 80) + '...')

  // 创建AbortController用于超时控制
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时

  try {
    const response = await fetch(processedUrl, {
      headers: {
        'Referer': 'https://www.xiaohongshu.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    clearTimeout(timeout)
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      throw new Error('下载超时（30秒）')
    }
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
  try {
    console.log(`[图片处理] 开始处理第 ${index + 1}/${totalCount} 张图片...`)

    // 1. 下载图片（最多重试5次，提高成功率）
    let imageBuffer: Buffer | null = null
    for (let retry = 0; retry < 5; retry++) {
      try {
        imageBuffer = await downloadImage(imageUrl)
        console.log(`[图片处理] 图片 ${index + 1} 下载成功，大小: ${imageBuffer.length} bytes`)
        break
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        if (retry < 4) {
          console.log(`[图片处理] 图片 ${index + 1} 下载失败(${errorMsg})，${retry + 1}/5 次重试...`)
          await delay(2000) // 等待2秒后重试（增加延迟避免频繁请求）
        } else {
          console.error(`[图片处理] 图片 ${index + 1} 下载最终失败: ${errorMsg}`)
          throw error
        }
      }
    }

    if (!imageBuffer) {
      throw new Error('下载失败')
    }

    // 2. 上传到飞书
    const fileName = `image_${Date.now()}_${index}.jpg`
    const fileToken = await uploadFileToFeishu(imageBuffer, fileName, appToken)

    console.log(`[图片处理] ✅ 第 ${index + 1} 张图片处理完成，file_token: ${fileToken}`)
    return fileToken

  } catch (error) {
    console.error(`[图片处理] ❌ 第 ${index + 1} 张图片处理失败:`, error)
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
  console.log(`[图片处理] 共成功处理 ${successCount}/${imageUrls.length} 张图片`)
  console.log(`[图片处理] 结果数组:`, results.map((t, i) => t ? `图${i+1}:✓` : `图${i+1}:✗`).join(', '))

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
  publishTime: string
) {
  console.log('[快捷保存-飞书] 开始保存到表格...')

  const appAccessToken = await getAppAccessToken()

  // 构建记录字段
  // 列顺序：笔记链接、作者昵称、封面、图片2、后续图片、标题、正文、话题标签、浏览数、点赞数、收藏数、评论数、发布时间、复刻情况
  const fields: any = {
    '笔记链接': url,                     // 第1列
    '作者昵称': authorName,              // 第2列
    // 第3-5列：封面、图片2、后续图片（下面处理）
    '标题': title,                       // 第6列
    '正文': content,                     // 第7列
    '话题标签': tags,                    // 第8列
    '浏览数': String(viewCount),         // 第9列
    '点赞数': String(likedCount),        // 第10列
    '收藏数': String(collectedCount),    // 第11列
    '评论数': String(commentCount),      // 第12列
    '发布时间': String(publishTime)      // 第13列
    // 第14列：复刻情况（按钮字段，需手动在飞书表格中创建）
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
    }
  }

  const totalSaved = [fileTokens[0], fileTokens[1], ...fileTokens.slice(2)].filter(Boolean).length
  console.log('[快捷保存-飞书] 共保存', totalSaved, '个图片到附件字段')

  // 打印所有字段数据用于调试
  console.log('[快捷保存-飞书] 字段数据:')
  console.log('  - 笔记链接:', url)
  console.log('  - 作者昵称:', authorName)
  console.log('  - 标题:', title)
  console.log('  - 正文长度:', content?.length || 0, '字符')
  console.log('  - 话题标签:', tags)
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

  console.log('[快捷保存-飞书] 保存成功，记录 ID:', data.data?.record_id)
  return data
}

/**
 * POST /api/xiaohongshu/quick-save
 * iOS快捷指令专用API - 一键保存小红书笔记到飞书（含图片）
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { url, appToken, tableId, async: isAsync } = body

    console.log('[快捷保存] 收到请求:', { url, appToken, tableId, async: isAsync })
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

    // 如果是异步模式，立即返回成功响应，后台继续处理
    if (isAsync) {
      console.log('[快捷保存] 🚀 异步模式：立即返回，后台处理')

      // 在后台异步处理（不等待）
      processAsync(url, finalAppToken, finalTableId, startTime).catch(error => {
        console.error('[快捷保存-异步] 后台处理失败:', error)
      })

      return NextResponse.json({
        success: true,
        message: `✅ 收到请求，正在后台保存...\n\n稍后请刷新飞书表格查看结果`,
        data: { async: true }
      })
    }

    // 同步模式（原有逻辑）
    // 1. 解析小红书链接（自动选择API）
    const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime, apiUsed, apiError } = await parseXiaohongshu(url)

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
      publishTime
    )

    const duration = Date.now() - startTime

    console.log('[快捷保存] 保存成功! 耗时:', duration + 'ms')

    // 4. 返回成功消息
    const successImages = fileTokens.filter(token => token !== null).length

    // 构建API使用提示
    let apiInfo = ''
    if (apiUsed === 'jizhile') {
      apiInfo = '\n🎯 极致了API (完整数据)'
    } else if (apiUsed === 'henghengmao') {
      apiInfo = '\n⚠️ 哼哼猫API (需手动填写互动数)'
      if (apiError) {
        apiInfo += `\n💡 ${apiError.split(':')[0]}`
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ 保存成功!${apiInfo}\n\n📝 ${title}\n👤 ${authorName || '(待填写)'}\n📸 ${successImages}/${images.length}张图片\n👁️ ${viewCount} 浏览\n⏱️ 耗时${duration}ms`,
      data: {
        title,
        authorName,
        imageCount: successImages,
        totalImages: images.length,
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
 * 异步处理函数（后台执行）
 */
async function processAsync(url: string, appToken: string, tableId: string, startTime: number) {
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
      publishTime
    )

    const duration = Date.now() - startTime
    console.log('[快捷保存-异步] ✅ 后台处理成功! 耗时:', duration + 'ms')

  } catch (error) {
    console.error('[快捷保存-异步] ❌ 后台处理失败:', error)
    throw error
  }
}
