import { NextRequest, NextResponse } from 'next/server'
import { createXiaohongshuCollectTable } from '@/lib/feishu-bitable'

/**
 * 创建小红书笔记采集表格
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🚀 [API] 接收到创建表格请求')

    const result = await createXiaohongshuCollectTable()

    console.log('✅ [API] 表格创建成功')
    console.log('📋 App Token:', result.app_token)
    console.log('📊 Table ID:', result.table_id)
    console.log('🔗 访问链接:', result.url)

    return NextResponse.json({
      success: true,
      data: result,
      message: '表格创建成功',
    })
  } catch (error) {
    console.error('❌ [API] 创建表格失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建表格失败',
      },
      { status: 500 }
    )
  }
}
