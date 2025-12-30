import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

/**
 * PATCH /api/feishu-notes/:id
 * 更新笔记的复刻状态
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const noteId = parseInt(params.id)
    const body = await request.json()
    const { rewrite_status, article_id } = body

    // 参数验证
    if (isNaN(noteId)) {
      return NextResponse.json(
        { success: false, error: '无效的笔记ID' },
        { status: 400 }
      )
    }

    if (rewrite_status && !['pending', 'done', 'skip'].includes(rewrite_status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态值' },
        { status: 400 }
      )
    }

    console.log('[飞书笔记记录] 更新记录 ID:', noteId, '状态:', rewrite_status)

    const db = getDb()

    // 检查记录是否存在
    const checkStmt = db.prepare('SELECT * FROM feishu_notes WHERE id = ?')
    const existingNote = checkStmt.get(noteId)

    if (!existingNote) {
      return NextResponse.json(
        { success: false, error: '笔记记录不存在' },
        { status: 404 }
      )
    }

    // 构建更新语句
    const updates: string[] = []
    const updateParams: any[] = []

    if (rewrite_status) {
      updates.push('rewrite_status = ?')
      updateParams.push(rewrite_status)

      // 如果状态改为 done，记录完成时间
      if (rewrite_status === 'done') {
        updates.push('rewritten_at = ?')
        updateParams.push(Date.now())
      }
    }

    if (article_id !== undefined) {
      updates.push('article_id = ?')
      updateParams.push(article_id)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有提供要更新的字段' },
        { status: 400 }
      )
    }

    // 执行更新
    updateParams.push(noteId)
    const updateStmt = db.prepare(`
      UPDATE feishu_notes
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    updateStmt.run(...updateParams)

    // 返回更新后的记录
    const updatedNote = checkStmt.get(noteId) as any

    console.log('[飞书笔记记录] 更新成功')

    return NextResponse.json({
      success: true,
      data: {
        ...updatedNote,
        images: updatedNote?.images ? JSON.parse(updatedNote.images) : null
      }
    })

  } catch (error) {
    console.error('[飞书笔记记录] 更新失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新失败'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/feishu-notes/:id
 * 删除笔记记录
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const noteId = parseInt(params.id)

    if (isNaN(noteId)) {
      return NextResponse.json(
        { success: false, error: '无效的笔记ID' },
        { status: 400 }
      )
    }

    console.log('[飞书笔记记录] 删除记录 ID:', noteId)

    const db = getDb()

    // 检查记录是否存在
    const checkStmt = db.prepare('SELECT * FROM feishu_notes WHERE id = ?')
    const existingNote = checkStmt.get(noteId)

    if (!existingNote) {
      return NextResponse.json(
        { success: false, error: '笔记记录不存在' },
        { status: 404 }
      )
    }

    // 删除记录
    const deleteStmt = db.prepare('DELETE FROM feishu_notes WHERE id = ?')
    deleteStmt.run(noteId)

    console.log('[飞书笔记记录] 删除成功')

    return NextResponse.json({
      success: true,
      message: '删除成功'
    })

  } catch (error) {
    console.error('[飞书笔记记录] 删除失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败'
      },
      { status: 500 }
    )
  }
}
