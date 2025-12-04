import { NextRequest, NextResponse } from 'next/server'
import type { WechatPublishRequest } from '@/types/wechat-publish'

export async function POST(request: NextRequest) {
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

    // 解析请求体
    const body: WechatPublishRequest = await request.json()

    // 验证必填字段
    if (!body.wechatAppid || !body.title || !body.content) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填参数：wechatAppid, title, content',
          code: 'INVALID_PARAMETER',
        },
        { status: 400 }
      )
    }

    // 设置默认值
    const publishData: WechatPublishRequest = {
      wechatAppid: body.wechatAppid,
      title: body.title,
      content: body.content,
      summary: body.summary,
      coverImage: body.coverImage,
      author: body.author,
      contentFormat: body.contentFormat || 'markdown',
      articleType: body.articleType || 'news',
    }

    // 调用外部 API
    const response = await fetch(`${apiBase}/wechat-publish`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(publishData),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('发布文章失败:', data)
      return NextResponse.json(
        {
          success: false,
          error: data.error || `外部API错误: ${response.status}`,
          code: data.code || 'EXTERNAL_API_ERROR',
        },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('发布文章失败:', error)
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
