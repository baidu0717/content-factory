import { NextRequest, NextResponse } from 'next/server'
import { getRecords } from '@/lib/feishu-bitable'

/**
 * 获取飞书表格中勾选了"需要提取"的笔记
 */
export async function POST(req: NextRequest) {
  try {
    const { appToken, tableId } = await req.json()

    console.log(`📋 [读取] 开始读取勾选的笔记...`)
    console.log(`📋 App Token: ${appToken}`)
    console.log(`📊 Table ID: ${tableId}`)

    // 获取所有记录（飞书API默认分页，可能需要多次请求）
    const allRecords = await getAllRecords(appToken, tableId)

    console.log(`📊 [读取] 共获取 ${allRecords.length} 条记录`)

    // 筛选出勾选了"需要提取"的记录（单选值为"✅ 是"）
    const checkedRecords = allRecords.filter((record: any) => {
      return record.fields['需要提取'] === '✅ 是'
    })

    console.log(`✅ [读取] 找到 ${checkedRecords.length} 条勾选的笔记`)

    // 提取笔记信息（支持完整链接和短链接）
    const notes = checkedRecords.map((record: any) => {
      const linkField = record.fields['笔记链接']
      // 飞书URL字段返回格式: { link: "url", text: "显示文本" } 或 "url"
      let link = ''
      if (typeof linkField === 'string') {
        link = linkField
      } else if (linkField && typeof linkField === 'object') {
        link = linkField.link || linkField.text || ''
      }

      return {
        recordId: record.record_id,
        title: record.fields['标题'] || '',
        link: link,
      }
    })

    // 过滤掉没有链接的记录
    const validNotes = notes.filter((note: any) => note.link && note.link.trim() !== '')

    console.log(`✅ [读取] 有效笔记链接: ${validNotes.length} 条`)

    return NextResponse.json({
      success: true,
      notes: validNotes,
      total: validNotes.length,
    })
  } catch (error) {
    console.error('❌ [读取] 读取失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '读取失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 获取所有记录（处理分页）
 */
async function getAllRecords(appToken: string, tableId: string): Promise<any[]> {
  let allRecords: any[] = []
  let hasMore = true
  let pageToken = ''

  while (hasMore) {
    const records = await getRecords(appToken, tableId, 500)
    allRecords = allRecords.concat(records)

    // 检查是否还有更多数据
    // 注意：getRecords函数需要支持pageToken参数
    hasMore = false // 暂时简化，只获取前500条
  }

  return allRecords
}
