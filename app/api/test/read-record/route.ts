import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * GET /api/test/read-record
 * 读取飞书表格中的记录，查看附件字段的实际格式
 */
export async function GET(request: NextRequest) {
  try {
    const appToken = process.env.FEISHU_DEFAULT_APP_TOKEN
    const tableId = process.env.FEISHU_DEFAULT_TABLE_ID

    if (!appToken || !tableId) {
      return NextResponse.json({
        success: false,
        message: '未配置表格信息'
      }, { status: 400 })
    }

    const appAccessToken = await getAppAccessToken()

    // 读取表格中的前5条记录
    const response = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=5`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${appAccessToken}`
        }
      }
    )

    const data = await response.json()

    if (data.code !== 0) {
      return NextResponse.json({
        success: false,
        message: '读取失败',
        error: data
      }, { status: 500 })
    }

    // 返回记录，特别关注附件字段
    return NextResponse.json({
      success: true,
      message: '读取成功',
      records: data.data.items.map((item: any) => ({
        record_id: item.record_id,
        fields: item.fields
      }))
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
