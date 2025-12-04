/**
 * 定时报告管理 API
 * GET /api/scheduled-reports - 获取定时报告列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface ScheduledReport {
  id: number
  keyword_id: number | null
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  analysis_result: string | null
  feishu_pushed: number
  feishu_push_at: number | null
  feishu_response: string | null
  error: string | null
  created_at: number
}

/**
 * GET - 获取定时报告列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const keywordId = searchParams.get('keyword_id')
    const platform = searchParams.get('platform')

    const db = getDb()

    // 构建查询条件
    let query = 'SELECT * FROM scheduled_reports WHERE 1=1'
    const params: any[] = []

    if (keywordId) {
      query += ' AND keyword_id = ?'
      params.push(keywordId)
    }

    if (platform && (platform === 'wechat' || platform === 'xiaohongshu')) {
      query += ' AND platform = ?'
      params.push(platform)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const reports = db.prepare(query).all(...params) as ScheduledReport[]

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM scheduled_reports WHERE 1=1'
    const countParams: any[] = []

    if (keywordId) {
      countQuery += ' AND keyword_id = ?'
      countParams.push(keywordId)
    }

    if (platform && (platform === 'wechat' || platform === 'xiaohongshu')) {
      countQuery += ' AND platform = ?'
      countParams.push(platform)
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number }

    // 解析 JSON 字段
    const reportsWithParsedData = reports.map((report) => ({
      ...report,
      analysis_result: report.analysis_result ? JSON.parse(report.analysis_result) : null,
      feishu_response: report.feishu_response ? JSON.parse(report.feishu_response) : null,
    }))

    return NextResponse.json({
      success: true,
      reports: reportsWithParsedData,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[API] 获取定时报告失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      },
      { status: 500 }
    )
  }
}
