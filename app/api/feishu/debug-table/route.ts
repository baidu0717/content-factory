import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''

/**
 * GET /api/feishu/debug-table
 * 调试飞书表格，查看字段和数据
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 调试飞书表格...')

    if (!APP_TOKEN || !TABLE_ID) {
      return NextResponse.json({
        success: false,
        error: '未配置表格信息',
      }, { status: 400 })
    }

    const accessToken = await getAppAccessToken()

    // 1. 获取字段列表
    console.log('📋 获取字段列表...')
    const fieldsResponse = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const fieldsData = await fieldsResponse.json()
    if (fieldsData.code !== 0) {
      throw new Error(`获取字段列表失败: ${fieldsData.msg}`)
    }

    const fields = fieldsData.data.items
    const fieldMap: Record<string, any> = {}
    fields.forEach((field: any) => {
      fieldMap[field.field_name] = {
        field_id: field.field_id,
        type: field.type,
      }
    })

    console.log('✅ 字段列表:', Object.keys(fieldMap))

    // 2. 获取前5条记录作为示例
    console.log('📋 获取示例记录...')
    const recordsResponse = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records?page_size=5`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const recordsData = await recordsResponse.json()

    if (recordsData.code !== 0) {
      throw new Error(`获取记录失败: ${recordsData.msg}`)
    }

    const records = recordsData.data.items

    // 3. 格式化记录，显示字段名称和值
    const formattedRecords = records.map((record: any) => {
      const formattedFields: Record<string, any> = {}

      // 遍历所有字段，转换field_id为field_name
      Object.entries(record.fields).forEach(([fieldId, value]) => {
        const fieldName = fields.find((f: any) => f.field_id === fieldId)?.field_name || fieldId
        formattedFields[fieldName] = value
      })

      return {
        record_id: record.record_id,
        fields: formattedFields,
      }
    })

    console.log('✅ 调试完成')

    return NextResponse.json({
      success: true,
      data: {
        app_token: APP_TOKEN,
        table_id: TABLE_ID,
        field_count: fields.length,
        fields: fieldMap,
        record_count: records.length,
        sample_records: formattedRecords,
      },
    })

  } catch (error) {
    console.error('❌ 调试失败:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '调试失败',
    }, { status: 500 })
  }
}
