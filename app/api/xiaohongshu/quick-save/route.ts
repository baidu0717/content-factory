import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu } from '@/lib/feishuAuth'

// 哼哼猫 API 配置
const MEOWLOAD_API_KEY = 'nzlniaj8tyxkw0e7-16x5ek0gd6qr'
const MEOWLOAD_API_URL = 'https://api.meowload.net/openapi/extract/post'

// 飞书 API 配置
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * 解析小红书链接
 */
async function parseXiaohongshu(url: string) {
  console.log('[快捷保存-解析] 开始解析链接:', url)

  const response = await fetch(MEOWLOAD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': MEOWLOAD_API_KEY,
      'accept-language': 'zh'
    },
    body: JSON.stringify({ url: url.trim() })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[快捷保存-解析] API错误:', errorText)
    throw new Error(`解析失败: HTTP ${response.status}`)
  }

  const data = await response.json()

  // 详细日志：打印完整的 API 响应
  console.log('[快捷保存-解析] API 完整响应:', JSON.stringify(data, null, 2))
  console.log('[快捷保存-解析] medias 数组长度:', data.medias?.length || 0)
  console.log('[快捷保存-解析] medias 详情:', JSON.stringify(data.medias, null, 2))

  const rawText = data.text || ''

  // 提取话题标签
  const tagRegex = /#[^#]+?(?:\[话题\])?#/g
  const tags = rawText.match(tagRegex) || []
  const tagsString = tags.join(' ')

  // 移除话题标签
  const textWithoutTags = rawText.replace(tagRegex, '').trim()

  // 分离标题和正文
  let title = ''
  let content = ''

  if (textWithoutTags.includes('|||')) {
    const parts = textWithoutTags.split('|||')
    title = parts[0].trim()
    content = parts.slice(1).join('|||').trim()
  } else {
    const lines = textWithoutTags.split('\n').filter((line: string) => line.trim())
    if (lines.length > 0) {
      title = lines[0].trim()
      content = lines.slice(1).join('\n').trim()
    } else {
      title = textWithoutTags.substring(0, 50).trim()
      content = textWithoutTags.substring(50).trim()
    }
  }

  if (!content) {
    content = title
  }

  // 提取图片
  const images = data.medias
    ?.filter((media: any) => media.media_type === 'image')
    .map((media: any) => media.resource_url)
    .filter(Boolean) || []

  if (images.length === 0) {
    const videoCovers = data.medias
      ?.filter((media: any) => media.media_type === 'video' && media.preview_url)
      .map((media: any) => media.preview_url)
      .filter(Boolean) || []
    images.push(...videoCovers)
  }

  console.log('[快捷保存-解析] 解析成功 - 标题:', title, '图片数:', images.length)

  return { title, content, tags: tagsString, images }
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
  url: string
) {
  console.log('[快捷保存-飞书] 开始保存到表格...')

  const appAccessToken = await getAppAccessToken()

  // 构建记录字段（匹配个人表格的字段名）
  const fields: any = {
    '标题': title,
    '正文': content,
    '话题标签': tags,
    '笔记链接': url
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
    const { title, content, tags, images } = await parseXiaohongshu(url)

    // 2. 处理图片：下载并上传到飞书，获取 file_token
    const fileTokens = await processImages(images, finalAppToken)

    // 3. 保存到飞书表格（使用 file_token）
    await saveToFeishu(finalAppToken, finalTableId, title, content, tags, fileTokens, url)

    const duration = Date.now() - startTime

    console.log('[快捷保存] 保存成功! 耗时:', duration + 'ms')

    // 4. 返回成功消息
    const successImages = fileTokens.filter(token => token !== null).length
    return NextResponse.json({
      success: true,
      message: `✅ 保存成功!\n\n📝 ${title}\n📸 ${successImages}/${images.length}张图片\n⏱️ 耗时${duration}ms`,
      data: {
        title,
        imageCount: successImages,
        totalImages: images.length,
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
