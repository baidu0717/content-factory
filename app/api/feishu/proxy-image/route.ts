import { NextRequest, NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'

/**
 * GET /api/feishu/proxy-image?file_token=xxx
 * 代理飞书图片，添加正确的认证头
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileToken = searchParams.get('file_token')

    if (!fileToken) {
      return NextResponse.json({
        success: false,
        error: '缺少 file_token 参数'
      }, { status: 400 })
    }

    // 获取 user_access_token
    const userAccessToken = await getUserAccessToken()

    // 从飞书下载图片
    const imageResponse = await fetch(
      `${FEISHU_API_URL}/drive/v1/medias/${fileToken}/download`,
      {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`
        }
      }
    )

    if (!imageResponse.ok) {
      console.error('[图片代理] 下载失败:', imageResponse.status, imageResponse.statusText)
      return NextResponse.json({
        success: false,
        error: `下载失败: ${imageResponse.status}`
      }, { status: imageResponse.status })
    }

    // 获取图片数据
    const imageBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'

    // 返回图片
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // 缓存1年
      }
    })

  } catch (error) {
    console.error('[图片代理] 错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
