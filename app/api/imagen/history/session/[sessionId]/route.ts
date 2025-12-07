import { NextRequest, NextResponse } from 'next/server'
import { deleteSessionHistory } from '@/lib/imageHistory'
import { deleteSession } from '@/lib/imageSession'

/**
 * DELETE /api/imagen/history/session/:sessionId
 * 删除整个会话及其所有历史记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    console.log(`[历史记录 API] 删除会话: ${sessionId}`)

    // 删除会话（会级联删除历史记录）
    const success = deleteSession(sessionId)

    if (success) {
      return NextResponse.json({
        success: true,
        message: '会话删除成功'
      })
    } else {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('[历史记录 API] 删除会话失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除会话失败'
      },
      { status: 500 }
    )
  }
}
