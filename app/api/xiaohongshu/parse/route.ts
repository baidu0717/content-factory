import { NextRequest, NextResponse } from 'next/server'

// 哼哼猫 API 配置
const MEOWLOAD_API_KEY = 'nzlniaj8tyxkw0e7-16x5ek0gd6qr'
const MEOWLOAD_API_URL = 'https://api.meowload.net/openapi/extract/post'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    // 参数验证
    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { success: false, error: '请提供有效的小红书链接' },
        { status: 400 }
      )
    }

    // 验证是否为小红书链接
    const isXiaohongshuUrl = url.includes('xiaohongshu.com') ||
                              url.includes('xhslink.com') ||
                              url.includes('xhs.cn')

    if (!isXiaohongshuUrl) {
      return NextResponse.json(
        { success: false, error: '请提供小红书链接（支持 xiaohongshu.com、xhslink.com、xhs.cn）' },
        { status: 400 }
      )
    }

    console.log('[小红书解析] 开始解析链接:', url)

    // 调用哼哼猫 API
    const response = await fetch(MEOWLOAD_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MEOWLOAD_API_KEY,
        'accept-language': 'zh'
      },
      body: JSON.stringify({ url: url.trim() })
    })

    // 获取响应文本（用于调试）
    const responseText = await response.text()
    console.log('[小红书解析] API响应状态:', response.status)
    console.log('[小红书解析] API响应内容:', responseText)

    // 处理非 200 响应
    if (!response.ok) {
      let errorMessage = '解析失败'

      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.message || errorMessage
      } catch {
        // 如果无法解析为 JSON，使用默认错误消息
      }

      // 根据状态码返回不同的错误信息
      switch (response.status) {
        case 400:
          errorMessage = errorMessage || '解析失败，请检查链接是否包含有效内容'
          break
        case 422:
          errorMessage = '链接格式错误，请检查后重试'
          break
        case 401:
          errorMessage = 'API密钥无效，请联系管理员'
          break
        case 402:
          errorMessage = 'API调用次数已用完，请联系管理员'
          break
        case 500:
          errorMessage = '服务器错误，请稍后重试'
          break
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      )
    }

    // 解析成功的响应
    const data = JSON.parse(responseText)

    // 提取标题、正文和图片
    const title = data.text || '未获取到标题'
    const content = data.text || ''

    // 只提取图片类型的 media
    const images = data.medias
      ?.filter((media: any) => media.media_type === 'image')
      .map((media: any) => media.resource_url)
      .filter(Boolean) || []

    // 如果没有图片，检查是否有视频封面
    if (images.length === 0) {
      const videoCovers = data.medias
        ?.filter((media: any) => media.media_type === 'video' && media.preview_url)
        .map((media: any) => media.preview_url)
        .filter(Boolean) || []

      images.push(...videoCovers)
    }

    console.log('[小红书解析] 解析成功')
    console.log('[小红书解析] 标题:', title)
    console.log('[小红书解析] 图片数量:', images.length)

    // 返回格式化的数据
    return NextResponse.json({
      success: true,
      data: {
        title,
        content,
        images,
        id: data.id,
        createdAt: data.created_at,
        rawData: data // 保留原始数据供调试
      }
    })

  } catch (error) {
    console.error('[小红书解析] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '解析过程中发生未知错误'
      },
      { status: 500 }
    )
  }
}
