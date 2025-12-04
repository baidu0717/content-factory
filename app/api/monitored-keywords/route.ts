/**
 * 监控关键词管理 API
 * GET /api/monitored-keywords - 获取所有监控关键词
 * POST /api/monitored-keywords - 添加新的监控关键词
 * PUT /api/monitored-keywords - 更新监控关键词
 * DELETE /api/monitored-keywords - 删除监控关键词
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface MonitoredKeyword {
  id: number
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  enabled: number
  last_run_at: number | null
  created_at: number
  updated_at: number
}

/**
 * GET - 获取所有监控关键词
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const keywords = db
      .prepare('SELECT * FROM monitored_keywords ORDER BY created_at DESC')
      .all() as MonitoredKeyword[]

    return NextResponse.json({
      success: true,
      keywords,
    })
  } catch (error) {
    console.error('[API] 获取监控关键词失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - 添加新的监控关键词
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword, platform, enabled = 1 } = body

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: '关键词不能为空',
        },
        { status: 400 }
      )
    }

    if (platform !== 'wechat' && platform !== 'xiaohongshu') {
      return NextResponse.json(
        {
          success: false,
          error: '平台类型无效',
        },
        { status: 400 }
      )
    }

    const db = getDb()

    // 检查是否已存在相同的关键词和平台组合
    const existing = db
      .prepare('SELECT * FROM monitored_keywords WHERE keyword = ? AND platform = ?')
      .get(keyword.trim(), platform) as MonitoredKeyword | undefined

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: '该关键词已存在',
        },
        { status: 400 }
      )
    }

    // 插入新关键词
    const now = Date.now()
    const result = db
      .prepare(
        'INSERT INTO monitored_keywords (keyword, platform, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(keyword.trim(), platform, enabled ? 1 : 0, now, now)

    const newKeyword = db
      .prepare('SELECT * FROM monitored_keywords WHERE id = ?')
      .get(result.lastInsertRowid) as MonitoredKeyword

    return NextResponse.json({
      success: true,
      keyword: newKeyword,
    })
  } catch (error) {
    console.error('[API] 添加监控关键词失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '添加失败',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - 更新监控关键词
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, keyword, platform, enabled } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少关键词 ID',
        },
        { status: 400 }
      )
    }

    const db = getDb()

    // 检查关键词是否存在
    const existing = db
      .prepare('SELECT * FROM monitored_keywords WHERE id = ?')
      .get(id) as MonitoredKeyword | undefined

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: '关键词不存在',
        },
        { status: 404 }
      )
    }

    // 构建更新语句
    const updates: string[] = []
    const values: any[] = []

    if (keyword !== undefined && keyword.trim()) {
      updates.push('keyword = ?')
      values.push(keyword.trim())
    }

    if (platform !== undefined) {
      if (platform !== 'wechat' && platform !== 'xiaohongshu') {
        return NextResponse.json(
          {
            success: false,
            error: '平台类型无效',
          },
          { status: 400 }
        )
      }
      updates.push('platform = ?')
      values.push(platform)
    }

    if (enabled !== undefined) {
      updates.push('enabled = ?')
      values.push(enabled ? 1 : 0)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '没有需要更新的字段',
        },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    // 执行更新
    db.prepare(`UPDATE monitored_keywords SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updatedKeyword = db
      .prepare('SELECT * FROM monitored_keywords WHERE id = ?')
      .get(id) as MonitoredKeyword

    return NextResponse.json({
      success: true,
      keyword: updatedKeyword,
    })
  } catch (error) {
    console.error('[API] 更新监控关键词失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新失败',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - 删除监控关键词
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少关键词 ID',
        },
        { status: 400 }
      )
    }

    const db = getDb()

    // 检查关键词是否存在
    const existing = db
      .prepare('SELECT * FROM monitored_keywords WHERE id = ?')
      .get(id) as MonitoredKeyword | undefined

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: '关键词不存在',
        },
        { status: 404 }
      )
    }

    // 删除关键词
    db.prepare('DELETE FROM monitored_keywords WHERE id = ?').run(id)

    return NextResponse.json({
      success: true,
      message: '删除成功',
    })
  } catch (error) {
    console.error('[API] 删除监控关键词失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    )
  }
}
