import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const apiKey = process.env.WECHAT_API_KEY
    const apiBase = process.env.WECHAT_API_BASE

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API密钥未配置',
          code: 'API_KEY_MISSING',
        },
        { status: 500 }
      )
    }

    // 调用外部 API
    const response = await fetch(`${apiBase}/wechat-accounts`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('获取公众号列表失败:', errorText)
      return NextResponse.json(
        {
          success: false,
          error: `外部API错误: ${response.status}`,
          code: 'EXTERNAL_API_ERROR',
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('获取公众号列表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
