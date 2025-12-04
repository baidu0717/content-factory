import { NextRequest, NextResponse } from 'next/server'
import { deleteHistory } from '@/lib/imageHistory'

/**
 * DELETE /api/imagen/history/:id
 * 删除单条历史记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '无效的记录 ID' },
        { status: 400 }
      )
    }

    console.log(`[历史记录 API] 删除记录: ${id}`)

    const success = deleteHistory(id)

    if (success) {
      return NextResponse.json({
        success: true,
        message: '删除成功'
      })
    } else {
      return NextResponse.json(
        { success: false, error: '记录不存在' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('[历史记录 API] 删除失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败'
      },
      { status: 500 }
    )
  }
}
