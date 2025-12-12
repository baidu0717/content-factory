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
 * 下载图片
 */
async function downloadImage(url: string): Promise<Buffer> {
  console.log('[图片下载] 下载图片:', url)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 处理图片：下载并上传到飞书，获取 file_token
 */
async function processImages(imageUrls: string[], appToken: string): Promise<string[]> {
  console.log('[图片处理] 需要处理', imageUrls.length, '张图片')

  // 只取前3张图片（封面、图片2、图片3）
  const imagesToProcess = imageUrls.slice(0, 3)
  const fileTokens: string[] = []

  for (let i = 0; i < imagesToProcess.length; i++) {
    try {
      const imageUrl = imagesToProcess[i]
      console.log(`[图片处理] 处理第 ${i + 1} 张图片...`)

      // 1. 下载图片
      const imageBuffer = await downloadImage(imageUrl)
      console.log(`[图片处理] 图片下载成功，大小: ${imageBuffer.length} bytes`)

      // 2. 上传到飞书
      const fileName = `image_${Date.now()}_${i}.jpg`
      const fileToken = await uploadFileToFeishu(imageBuffer, fileName, appToken)

      fileTokens.push(fileToken)
      console.log(`[图片处理] 第 ${i + 1} 张图片处理完成，file_token: ${fileToken}`)
    } catch (error) {
      console.error(`[图片处理] 第 ${i + 1} 张图片处理失败:`, error)
      // 继续处理下一张图片
    }
  }

  console.log(`[图片处理] 共成功处理 ${fileTokens.length}/${imagesToProcess.length} 张图片`)
  return fileTokens
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
  fileTokens: string[],
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

  // 将图片保存到附件字段（使用 file_token）
  if (fileTokens.length > 0) {
    fields['封面'] = [{ file_token: fileTokens[0] }]
    console.log('[快捷保存-飞书] 封面 file_token:', fileTokens[0])
  }

  if (fileTokens.length > 1) {
    fields['图片2'] = [{ file_token: fileTokens[1] }]
    console.log('[快捷保存-飞书] 图片2 file_token:', fileTokens[1])
  }

  if (fileTokens.length > 2) {
    fields['图片3'] = [{ file_token: fileTokens[2] }]
    console.log('[快捷保存-飞书] 图片3 file_token:', fileTokens[2])
  }

  if (fileTokens.length > 0) {
    console.log('[快捷保存-飞书] 共保存', fileTokens.length, '个图片到附件字段')
  }

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
    return NextResponse.json({
      success: true,
      message: `✅ 保存成功!\n\n📝 ${title}\n📸 ${fileTokens.length}/${images.length}张图片\n⏱️ 耗时${duration}ms`,
      data: {
        title,
        imageCount: fileTokens.length,
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
