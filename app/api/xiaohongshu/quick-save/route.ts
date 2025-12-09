import { NextRequest, NextResponse } from 'next/server'

// 哼哼猫 API 配置
const MEOWLOAD_API_KEY = 'nzlniaj8tyxkw0e7-16x5ek0gd6qr'
const MEOWLOAD_API_URL = 'https://api.meowload.net/openapi/extract/post'

// 飞书 API 配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * 获取飞书 app_access_token
 */
async function getAppAccessToken(): Promise<string> {
  const response = await fetch(`${FEISHU_API_URL}/auth/v3/app_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  })

  const data = await response.json()
  if (data.code !== 0) {
    throw new Error(`获取app_access_token失败: ${data.msg}`)
  }

  return data.app_access_token
}

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
 * 保存到飞书表格
 */
async function saveToFeishu(
  appToken: string,
  tableId: string,
  title: string,
  content: string,
  tags: string,
  images: string[],
  url: string
) {
  console.log('[快捷保存-飞书] 开始保存...')

  const accessToken = await getAppAccessToken()

  // 准备图片附件
  const imageAttachments = images.map(imageUrl => ({
    file_token: imageUrl,
    name: imageUrl.split('/').pop() || 'image.jpg'
  }))

  // 构建记录字段
  const fields: any = {
    '标题': title,
    '正文': content,
    '话题标签': tags,
    '笔记链接': url,
    '来源': '小红书'
  }

  if (imageAttachments.length > 0) {
    fields['图片'] = imageAttachments
  }

  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ fields })
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[快捷保存-飞书] 保存失败:', data)
    throw new Error(`保存失败: ${data.msg || '未知错误'}`)
  }

  console.log('[快捷保存-飞书] 保存成功')
  return data
}

/**
 * POST /api/xiaohongshu/quick-save
 * iOS快捷指令专用API - 一键保存小红书笔记到飞书
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { url, appToken, tableId } = body

    console.log('[快捷保存] 收到请求:', { url, appToken, tableId })

    // 验证URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        message: '❌ 请提供小红书链接'
      }, { status: 400 })
    }

    // 获取表格配置
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

    // 2. 保存到飞书表格
    await saveToFeishu(finalAppToken, finalTableId, title, content, tags, images, url)

    const duration = Date.now() - startTime

    console.log('[快捷保存] 保存成功! 耗时:', duration + 'ms')

    // 3. 返回成功消息
    return NextResponse.json({
      success: true,
      message: `✅ 保存成功!\n\n📝 ${title}\n📸 ${images.length}张图片\n⏱️ 耗时${duration}ms`,
      data: {
        title,
        imageCount: images.length,
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
