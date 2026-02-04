import { NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''

/**
 * GET /api/feishu/get-records?page_size=5
 * 获取飞书表格记录（用于测试）
 */
export async function GET(request: Request) {
  try {
    console.log('[获取记录] 开始获取飞书表格记录...')

    if (!APP_TOKEN || !TABLE_ID) {
      return NextResponse.json({
        success: false,
        error: '未配置飞书表格信息'
      }, { status: 400 })
    }

    // 从URL参数获取page_size,默认500条
    const { searchParams } = new URL(request.url)
    const pageSize = searchParams.get('page_size') || '500'

    const appAccessToken = await getAppAccessToken()

    // 获取记录
    const response = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records?page_size=${pageSize}`,
      {
        headers: {
          'Authorization': `Bearer ${appAccessToken}`
        }
      }
    )

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[获取记录] 失败:', data)
      return NextResponse.json({
        success: false,
        error: `飞书API错误: ${data.msg}`
      }, { status: 500 })
    }

    const records = data.data.items

    console.log('[获取记录] ✅ 成功获取', records.length, '条记录')

    return NextResponse.json({
      success: true,
      data: {
        records,
        total: records.length
      }
    })

  } catch (error) {
    console.error('[获取记录] 错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
