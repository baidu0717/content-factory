/**
 * AI 洞察分析 API 端点
 * POST /api/ai-insights - 生成 AI 洞察分析
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateAIInsights } from '@/lib/openai-insights'
import { AIInsightsRequest, AIInsightsResponse } from '@/types/insights'

export async function POST(request: NextRequest) {
  try {
    const body: AIInsightsRequest = await request.json()

    console.log('[AI洞察API] 收到请求:', {
      keyword: body.keyword,
      platform: body.platform,
      articlesCount: body.articles?.length || 0
    })

    // 验证请求参数
    if (!body.keyword || !body.platform || !body.articles || body.articles.length === 0) {
      return NextResponse.json<AIInsightsResponse>(
        {
          success: false,
          error: '缺少必要参数：keyword, platform, articles'
        },
        { status: 400 }
      )
    }

    // 调用 AI 分析函数
    const startTime = Date.now()
    const result = await generateAIInsights(body.articles, body.platform, body.keyword)
    const duration = Date.now() - startTime

    console.log(`[AI洞察API] 分析完成，耗时: ${duration}ms`)
    console.log(`[AI洞察API] 生成了 ${result.summaries.length} 篇摘要和 ${result.insights.length} 条洞察`)

    return NextResponse.json<AIInsightsResponse>({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('[AI洞察API] 处理请求失败:', error)

    const errorMessage = error instanceof Error ? error.message : '未知错误'

    return NextResponse.json<AIInsightsResponse>(
      {
        success: false,
        error: `AI 分析失败: ${errorMessage}`
      },
      { status: 500 }
    )
  }
}

// 支持 OPTIONS 请求（CORS）
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200 })
}
