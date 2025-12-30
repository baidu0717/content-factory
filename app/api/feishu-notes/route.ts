import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

/**
 * POST /api/feishu-notes
 * 保存笔记记录到本地数据库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, url, tags, images } = body

    // 参数验证
    if (!title || !content || !url) {
      return NextResponse.json(
        { success: false, error: '标题、正文和URL是必填项' },
        { status: 400 }
      )
    }

    console.log('[飞书笔记记录] 保存新记录:', title)

    const now = Date.now()
    let noteId: number | bigint = Date.now() // 默认使用时间戳作为ID

    // 尝试保存到数据库（Vercel环境下可能失败）
    try {
      const db = getDb()

      // 插入记录
      const stmt = db.prepare(`
        INSERT INTO feishu_notes (title, content, url, tags, images, rewrite_status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `)

      const result = stmt.run(
        title,
        content,
        url,
        tags || null,
        images ? JSON.stringify(images) : null,
        now
      )

      noteId = result.lastInsertRowid
      console.log('[飞书笔记记录] 保存成功，ID:', noteId)
    } catch (dbError) {
      console.warn('[飞书笔记记录] 数据库不可用（Vercel环境），跳过本地保存:', dbError)
      // 在Vercel环境下，数据库不持久化，但仍然返回成功
      // 重要数据已保存到飞书表格
    }

    return NextResponse.json({
      success: true,
      data: {
        id: noteId,
        title,
        content,
        url,
        tags,
        images,
        rewrite_status: 'pending',
        created_at: now
      }
    })

  } catch (error) {
    console.error('[飞书笔记记录] 保存失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存失败'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/feishu-notes
 * 获取笔记记录列表
 * 查询参数：
 * - status: 过滤状态 (pending/done/skip)
 * - limit: 返回记录数量 (默认50)
 * - offset: 分页偏移量 (默认0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('[飞书笔记记录] 查询记录 - 状态:', status, '限制:', limit, '偏移:', offset)

    // Vercel环境下数据库可能不可用，返回空数据
    let processedNotes: any[] = []

    try {
      const db = getDb()

      // 构建查询
      let query = 'SELECT * FROM feishu_notes'
      const params: any[] = []

      if (status && ['pending', 'done', 'skip'].includes(status)) {
        query += ' WHERE rewrite_status = ?'
        params.push(status)
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
      params.push(limit, offset)

      const stmt = db.prepare(query)
      const notes = stmt.all(...params)

      // 解析 JSON 字段
      processedNotes = notes.map((note: any) => ({
        ...note,
        images: note.images ? JSON.parse(note.images) : null
      }))
    } catch (dbError) {
      console.warn('[飞书笔记记录] 数据库不可用（Vercel环境），返回空数据:', dbError)
      // 在Vercel环境下，数据库不持久化，返回空数组
      processedNotes = []
    }

    console.log('[飞书笔记记录] 查询成功，返回', processedNotes.length, '条记录')

    return NextResponse.json({
      success: true,
      data: processedNotes,
      pagination: {
        limit,
        offset,
        total: processedNotes.length
      }
    })

  } catch (error) {
    console.error('[飞书笔记记录] 查询失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      },
      { status: 500 }
    )
  }
}
