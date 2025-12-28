import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// POST /api/articles - 保存文章草稿
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      title,
      content,
      status = 'draft',
      platforms = [],
      source = 'ai_generated',
      tags = [],
      wordCount,
      readingTime,
      images = []
    } = body

    // 验证必填字段
    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '标题和内容不能为空' },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = Date.now()

    // 插入文章
    const stmt = db.prepare(`
      INSERT INTO articles (
        title, content, status, platforms, source,
        created_at, tags, word_count, reading_time, images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      title,
      content,
      status,
      JSON.stringify(platforms),
      source,
      now,
      JSON.stringify(tags),
      wordCount || null,
      readingTime || null,
      JSON.stringify(images)
    )

    return NextResponse.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        title,
        content,
        status,
        platforms,
        source,
        createdAt: now,
        tags,
        wordCount,
        readingTime,
        images
      }
    })
  } catch (error) {
    console.error('[保存文章] 错误:', error)
    return NextResponse.json(
      { success: false, error: '保存文章失败' },
      { status: 500 }
    )
  }
}

// GET /api/articles - 获取文章列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const db = getDb()

    // 构建查询
    let query = 'SELECT * FROM articles'
    const params: any[] = []

    if (status && status !== 'all') {
      query += ' WHERE status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const stmt = db.prepare(query)
    const articles = stmt.all(...params)

    // 解析 JSON 字段
    const parsedArticles = articles.map((article: any) => {
      // 安全解析 tags 字段
      let tags = []
      try {
        const parsedTags = JSON.parse(article.tags || '[]')
        tags = Array.isArray(parsedTags) ? parsedTags : []
      } catch (e) {
        console.error('[解析tags失败] Article ID:', article.id, 'Tags值:', article.tags)
        tags = []
      }

      return {
        id: article.id,
        title: article.title,
        content: article.content,
        status: article.status,
        platforms: JSON.parse(article.platforms || '[]'),
        source: article.source,
        createdAt: new Date(article.created_at).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        publishedAt: article.published_at
          ? new Date(article.published_at).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : null,
        stats: article.stats ? JSON.parse(article.stats) : null,
        tags,
        error: article.error,
        wordCount: article.word_count,
        readingTime: article.reading_time,
        images: JSON.parse(article.images || '[]')
      }
    })

    // 获取总数
    const countStmt = db.prepare(
      status && status !== 'all'
        ? 'SELECT COUNT(*) as total FROM articles WHERE status = ?'
        : 'SELECT COUNT(*) as total FROM articles'
    )
    const countResult: any = status && status !== 'all'
      ? countStmt.get(status)
      : countStmt.get()

    return NextResponse.json({
      success: true,
      data: {
        articles: parsedArticles,
        total: countResult.total,
        limit,
        offset
      }
    })
  } catch (error) {
    console.error('[获取文章列表] 错误:', error)
    return NextResponse.json(
      { success: false, error: '获取文章列表失败' },
      { status: 500 }
    )
  }
}

// PUT /api/articles - 更新文章
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      title,
      content,
      status,
      platforms,
      tags,
      wordCount,
      readingTime,
      images
    } = body

    // 验证必填字段
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少文章ID' },
        { status: 400 }
      )
    }

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '标题和内容不能为空' },
        { status: 400 }
      )
    }

    const db = getDb()

    // 更新文章
    const stmt = db.prepare(`
      UPDATE articles SET
        title = ?,
        content = ?,
        status = ?,
        platforms = ?,
        tags = ?,
        word_count = ?,
        reading_time = ?,
        images = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    const result = stmt.run(
      title,
      content,
      status || 'draft',
      JSON.stringify(platforms || []),
      JSON.stringify(tags || []),
      wordCount || null,
      readingTime || null,
      JSON.stringify(images || []),
      id
    )

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: '文章不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '文章已更新'
    })
  } catch (error) {
    console.error('[更新文章] 错误:', error)
    return NextResponse.json(
      { success: false, error: '更新文章失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/articles - 删除文章
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少文章ID' },
        { status: 400 }
      )
    }

    const db = getDb()
    const stmt = db.prepare('DELETE FROM articles WHERE id = ?')
    const result = stmt.run(id)

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: '文章不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '文章已删除'
    })
  } catch (error) {
    console.error('[删除文章] 错误:', error)
    return NextResponse.json(
      { success: false, error: '删除文章失败' },
      { status: 500 }
    )
  }
}
