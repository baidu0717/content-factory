import { NextRequest, NextResponse } from 'next/server'
import { getHistoryGroupedBySession, getHistoryStats } from '@/lib/imageHistory'

/**
 * GET /api/imagen/history
 * 获取历史记录（按会话分组）
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[历史记录 API] 获取历史记录')

    // 获取分组历史
    const groupedHistory = getHistoryGroupedBySession(50)

    // 获取统计信息
    const stats = getHistoryStats()

    console.log(`[历史记录 API] 返回 ${groupedHistory.length} 个会话组`)

    return NextResponse.json({
      success: true,
      data: {
        groupedHistory,
        stats
      }
    })
  } catch (error) {
    console.error('[历史记录 API] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取历史记录失败'
      },
      { status: 500 }
    )
  }
}
