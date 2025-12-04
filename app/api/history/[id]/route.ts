import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET - 获取单条历史记录详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: '无效的历史记录ID' },
        { status: 400 }
      )
    }

    const db = getDb()

    const stmt = db.prepare(`
      SELECT
        id,
        keyword,
        platform,
        timestamp,
        result_count as resultCount,
        articles_data as articlesData,
        api_response as apiResponse,
        created_at as createdAt
      FROM search_history
      WHERE id = ?
    `)

    const row = stmt.get(parseInt(id))

    if (!row) {
      return NextResponse.json(
        { error: '历史记录不存在' },
        { status: 404 }
      )
    }

    // 将 JSON 字符串解析回对象
    const history = {
      ...(row as any),
      articlesData: (row as any).articlesData ? JSON.parse((row as any).articlesData) : null,
      apiResponse: (row as any).apiResponse ? JSON.parse((row as any).apiResponse) : null,
    }

    return NextResponse.json({
      success: true,
      history
    })

  } catch (error) {
    console.error('获取历史记录详情失败:', error)
    return NextResponse.json(
      { error: '获取历史记录详情失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// DELETE - 删除单条历史记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: '无效的历史记录ID' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 先检查记录是否存在
    const checkStmt = db.prepare('SELECT id FROM search_history WHERE id = ?')
    const exists = checkStmt.get(parseInt(id))

    if (!exists) {
      return NextResponse.json(
        { error: '历史记录不存在' },
        { status: 404 }
      )
    }

    // 删除记录
    const deleteStmt = db.prepare('DELETE FROM search_history WHERE id = ?')
    const result = deleteStmt.run(parseInt(id))

    return NextResponse.json({
      success: true,
      deleted: result.changes,
      message: '历史记录已删除'
    })

  } catch (error) {
    console.error('删除历史记录失败:', error)
    return NextResponse.json(
      { error: '删除历史记录失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
