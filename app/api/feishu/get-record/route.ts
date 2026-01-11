import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'

/**
 * GET /api/feishu/get-record?app_token=xxx&table_id=xxx&record_id=xxx
 * 根据记录ID获取飞书多维表格记录详情
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const appToken = searchParams.get('app_token') || process.env.FEISHU_DEFAULT_APP_TOKEN
    const tableId = searchParams.get('table_id') || process.env.FEISHU_DEFAULT_TABLE_ID
    const recordId = searchParams.get('record_id')

    if (!appToken || !tableId || !recordId) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数：app_token, table_id, record_id',
      }, { status: 400 })
    }

    console.log('[飞书获取记录] 开始获取记录')
    console.log('[飞书获取记录] App Token:', appToken)
    console.log('[飞书获取记录] Table ID:', tableId)
    console.log('[飞书获取记录] Record ID:', recordId)

    // 1. 获取访问令牌
    const accessToken = await getAppAccessToken()

    // 2. 获取记录详情
    const response = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书获取记录] 失败:', data)
      return NextResponse.json({
        success: false,
        error: `获取记录失败: ${data.msg}`,
      }, { status: 500 })
    }

    const record = data.data.record
    const fields = record.fields

    console.log('[飞书获取记录] 成功获取记录')
    console.log('[飞书获取记录] 字段:', Object.keys(fields).join(', '))

    // 3. 提取需要的字段
    const title = fields['标题'] || ''
    const content = fields['正文'] || fields['正文内容'] || ''
    const tags = fields['话题标签'] || ''

    return NextResponse.json({
      success: true,
      data: {
        title,
        content,
        tags,
        record_id: recordId,
        all_fields: fields, // 返回所有字段供调试
      },
    })

  } catch (error) {
    console.error('[飞书获取记录] 异常:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取记录失败',
    }, { status: 500 })
  }
}
