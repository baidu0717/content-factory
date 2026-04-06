import { NextRequest, NextResponse } from 'next/server'
import { addRecords } from '@/lib/feishu-bitable'

/**
 * 导出笔记到飞书多维表格
 */
export async function POST(req: NextRequest) {
  try {
    const { appToken, tableId, notes } = await req.json()

    console.log(`📤 [导出] 开始导出 ${notes.length} 条笔记到飞书...`)
    console.log(`📋 App Token: ${appToken}`)
    console.log(`📊 Table ID: ${tableId}`)

    // 构建记录数据
    const records = notes.map((note: any) => {
      const levelMap: Record<string, string> = {
        hot: '🔥 小爆款',
        'high-comment': '💬 高评论',
        normal: '📝 普通',
      }

      const link = note.xsec_token
        ? `https://www.xiaohongshu.com/explore/${note.id}?xsec_token=${note.xsec_token}`
        : `https://www.xiaohongshu.com/explore/${note.id}`

      return {
        '笔记链接': link,
        '标题': note.title,
        '作者': note.user_name,
        '分级': levelMap[note.level] || '📝 普通',
        '点赞数': note.liked_count,
        '收藏数': note.collected_count,
        '评论数': note.comment_count,
        '总互动数': note.interact_count,
        '评论占比': note.commentRatio ? `${note.commentRatio.toFixed(2)}%` : '0%',
        '提取状态': '⏳ 待提取',
      }
    })

    // 批量添加记录（飞书API限制每次最多500条）
    const batchSize = 500
    const batches = []

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      batches.push(addRecords(appToken, tableId, batch))
    }

    await Promise.all(batches)

    console.log(`✅ [导出] 成功导出 ${records.length} 条笔记`)

    return NextResponse.json({
      success: true,
      count: records.length,
      message: `成功导出 ${records.length} 条笔记`,
    })
  } catch (error) {
    console.error('❌ [导出] 导出失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导出失败',
      },
      { status: 500 }
    )
  }
}
