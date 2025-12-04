/**
 * 定时分析任务 API
 * POST /api/cron/daily-analysis - 执行每日分析任务
 *
 * 安全说明：此 API 应该通过 API 密钥保护，防止被恶意调用
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyAnalysis } from '@/lib/scheduler'

/**
 * POST - 执行每日分析任务
 */
export async function POST(request: NextRequest) {
  try {
    // API 密钥验证（可选，建议启用）
    const apiKey = request.headers.get('x-api-key')
    const expectedApiKey = process.env.CRON_API_KEY || 'your-secret-key'

    if (apiKey !== expectedApiKey) {
      console.warn('[Cron API] 未授权的访问尝试')
      return NextResponse.json(
        {
          success: false,
          error: '未授权',
        },
        { status: 401 }
      )
    }

    console.log('[Cron API] 收到定时分析任务请求')

    // 执行分析任务
    const result = await runDailyAnalysis()

    if (result.success) {
      const successCount = result.results.filter((r) => r.success).length
      const totalCount = result.results.length

      return NextResponse.json({
        success: true,
        message: `分析任务执行完成，成功 ${successCount}/${totalCount}`,
        results: result.results,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: '分析任务执行失败',
          results: result.results,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Cron API] 执行失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - 获取任务状态（可选，用于健康检查）
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    const expectedApiKey = process.env.CRON_API_KEY || 'your-secret-key'

    if (apiKey !== expectedApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: '未授权',
        },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      status: 'ready',
      message: '定时任务服务正常',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务异常',
      },
      { status: 500 }
    )
  }
}
