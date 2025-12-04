import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// POST - 保存搜索历史
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword, platform, timestamp, resultCount, articlesData, apiResponse, aiInsights } = body

    // 验证必填字段
    if (!keyword || !platform || !timestamp) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    // 验证平台类型
    if (platform !== 'wechat' && platform !== 'xiaohongshu') {
      return NextResponse.json(
        { error: '无效的平台类型' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 将数据转换为 JSON 字符串存储
    const articlesJson = articlesData ? JSON.stringify(articlesData) : null
    const apiResponseJson = apiResponse ? JSON.stringify(apiResponse) : null
    const aiInsightsJson = aiInsights ? JSON.stringify(aiInsights) : null

    // 插入历史记录
    const stmt = db.prepare(`
      INSERT INTO search_history
        (keyword, platform, timestamp, result_count, articles_data, api_response, ai_insights)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      keyword,
      platform,
      timestamp,
      resultCount || 0,
      articlesJson,
      apiResponseJson,
      aiInsightsJson
    )

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid,
      message: '历史记录保存成功'
    })

  } catch (error) {
    console.error('保存历史记录失败:', error)
    return NextResponse.json(
      { error: '保存历史记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// GET - 获取搜索历史列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const platform = searchParams.get('platform') // 可选的平台过滤

    const db = getDb()

    let query = `
      SELECT
        id,
        keyword,
        platform,
        timestamp,
        result_count as resultCount,
        articles_data as articlesData,
        api_response as apiResponse,
        ai_insights as aiInsights,
        created_at as createdAt
      FROM search_history
    `

    const params: any[] = []

    // 如果指定了平台，添加过滤条件
    if (platform === 'wechat' || platform === 'xiaohongshu') {
      query += ' WHERE platform = ?'
      params.push(platform)
    }

    query += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    const stmt = db.prepare(query)
    const rows = stmt.all(...params)

    // 将 JSON 字符串解析回对象
    const history = rows.map((row: any) => ({
      ...row,
      articlesData: row.articlesData ? JSON.parse(row.articlesData) : null,
      apiResponse: row.apiResponse ? JSON.parse(row.apiResponse) : null,
      aiInsights: row.aiInsights ? JSON.parse(row.aiInsights) : null,
    }))

    return NextResponse.json({
      success: true,
      history,
      total: history.length
    })

  } catch (error) {
    console.error('获取历史记录失败:', error)
    return NextResponse.json(
      { error: '获取历史记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// DELETE - 清空所有历史记录
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb()

    const stmt = db.prepare('DELETE FROM search_history')
    const result = stmt.run()

    return NextResponse.json({
      success: true,
      deleted: result.changes,
      message: '历史记录已清空'
    })

  } catch (error) {
    console.error('清空历史记录失败:', error)
    return NextResponse.json(
      { error: '清空历史记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
