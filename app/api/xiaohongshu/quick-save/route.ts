import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu } from '@/lib/feishuAuth'

// 极致了 API 配置
const JIZHILE_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY || 'JZL1b7f46d7a6b92240'
const JIZHILE_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE || 'https://www.dajiala.com/fbmain/monitor/v3/xhs'

// 飞书 API 配置
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * 从短链接获取完整URL和note_id
 */
async function getFullUrlAndNoteId(shortUrl: string): Promise<{ fullUrl: string; noteId: string }> {
  console.log('[快捷保存-解析] 跟随短链接重定向:', shortUrl)

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
  console.log('[快捷保存-解析] 完整URL:', fullUrl)

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
      console.log('[快捷保存-解析] 从redirect_uri提取:', redirectUri)
      const redirectMatch = redirectUri.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
      if (redirectMatch) {
        noteId = redirectMatch[1]
      }
    }
  }

  // 如果还是没找到，尝试从响应体中提取
  if (!noteId) {
    console.log('[快捷保存-解析] 尝试从响应体提取note_id...')
    const html = await response.text()

    // 尝试从HTML中查找小红书链接
    const htmlMatch = html.match(/https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
    if (htmlMatch) {
      noteId = htmlMatch[1]
      console.log('[快捷保存-解析] 从HTML中提取到note_id:', noteId)
    }
  }

  if (!noteId) {
    console.error('[快捷保存-解析] 无法提取note_id，URL:', fullUrl)
    throw new Error(`无法从URL中提取note_id: ${fullUrl}`)
  }

  console.log('[快捷保存-解析] 提取到note_id:', noteId)

  return { fullUrl, noteId }
}

/**
 * 解析小红书链接（使用极致了API）
 */
async function parseXiaohongshu(url: string) {
  console.log('[快捷保存-解析] 开始解析链接:', url)

  // 1. 获取note_id
  const { noteId } = await getFullUrlAndNoteId(url)

  // 2. 调用极致了API（type=11详情接口，测试xsec_token为空）
  console.log('[快捷保存-解析] 调用极致了API...')
  const response = await fetch(JIZHILE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: JIZHILE_API_KEY,
      type: 11,
      note_id: noteId,
      xsec_token: ''  // 测试空值
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[快捷保存-解析] API错误:', errorText)
    throw new Error(`解析失败: HTTP ${response.status}`)
  }

  const data = await response.json()

  // 详细日志
  console.log('[快捷保存-解析] API 完整响应:', JSON.stringify(data, null, 2))

  // 检查API返回码（极致了API返回码是0表示成功）
  if (data.code !== 0) {
    console.error('[快捷保存-解析] API返回错误:', data)
    throw new Error(`API错误: ${data.msg || data.message || '未知错误'}`)
  }

  // 极致了 type=11 API 数据在 note_list[0] 中
  const noteData = data.note_list?.[0]
  if (!noteData) {
    throw new Error('API返回数据格式错误')
  }

  console.log('[快捷保存-解析] 笔记数据:', JSON.stringify(noteData, null, 2))

  // 提取数据
  const title = noteData.title || ''
  const content = noteData.desc || ''
  const tags = noteData.hash_tag?.map((tag: any) => `#${tag.name}#`).join(' ') || ''
  const authorName = noteData.user?.nickname || noteData.user?.nick_name || noteData.user?.name || ''

  // 互动数据
  const viewCount = noteData.view_count || 0
  const likedCount = noteData.liked_count || 0
  const collectedCount = noteData.collected_count || 0
  const commentCount = noteData.comments_count || 0
  const publishTime = noteData.time || noteData.create_time || ''

  // 提取图片（极致了API的图片在images_list中）
  const images = noteData.images_list?.map((img: any) => {
    // 使用original或url字段获取图片链接
    return img.original || img.url || img.url_default || ''
  }).filter(Boolean) || []

  console.log('[快捷保存-解析] 解析成功 - 标题:', title, '图片数:', images.length, '作者:', authorName)

  return {
    title,
    content,
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
 * 下载图片（需要添加 Referer header，否则小红书服务器会返回 403）
 */
async function downloadImage(url: string): Promise<Buffer> {
  console.log('[图片下载] 下载图片:', url)
  const response = await fetch(url, {
    headers: {
      'Referer': 'https://www.xiaohongshu.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
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

    // 1. 下载图片（最多重试3次）
    let imageBuffer: Buffer | null = null
    for (let retry = 0; retry < 3; retry++) {
      try {
        imageBuffer = await downloadImage(imageUrl)
        console.log(`[图片处理] 图片 ${index + 1} 下载成功，大小: ${imageBuffer.length} bytes`)
        break
      } catch (error) {
        if (retry < 2) {
          console.log(`[图片处理] 图片 ${index + 1} 下载失败，${retry + 1}/3 次重试...`)
          await delay(1000) // 等待1秒后重试
        } else {
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

  // 构建记录字段（按新的列顺序）
  // 注意：数字字段转换为字符串，因为飞书表格中可能是文本类型
  const fields: any = {
    '笔记链接': url,                     // 第1列
    '作者昵称': authorName,              // 第2列
    '标题': title,                       // 第3列
    '正文': content,                     // 第4列
    // 第5-7列：封面、图片2、后续图片（下面处理）
    '话题标签': tags,                    // 第8列
    '浏览数': String(viewCount),         // 第9列（转字符串）
    '点赞数': String(likedCount),        // 第10列（转字符串）
    '收藏数': String(collectedCount),    // 第11列（转字符串）
    '评论数': String(commentCount),      // 第12列（转字符串）
    '发布时间': String(publishTime)      // 第13列（转字符串）
    // 第14列：去复刻按钮（飞书表格中配置按钮字段）
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
    const { url, appToken, tableId } = body

    console.log('[快捷保存] 收到请求:', { url, appToken, tableId })
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

    // 1. 解析小红书链接
    const { title, content, tags, images, authorName, viewCount, likedCount, collectedCount, commentCount, publishTime } = await parseXiaohongshu(url)

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
    return NextResponse.json({
      success: true,
      message: `✅ 保存成功!\n\n📝 ${title}\n👤 ${authorName}\n📸 ${successImages}/${images.length}张图片\n👁️ ${viewCount} 浏览\n⏱️ 耗时${duration}ms`,
      data: {
        title,
        authorName,
        imageCount: successImages,
        totalImages: images.length,
        viewCount,
        likedCount,
        collectedCount,
        commentCount,
        duration
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
