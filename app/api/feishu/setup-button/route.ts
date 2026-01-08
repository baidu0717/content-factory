import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://xiaohongshu-collect.vercel.app'

/**
 * 创建按钮字段
 */
async function createButtonField(
  appToken: string,
  tableId: string,
  accessToken: string
) {
  console.log('📝 创建"去复刻"按钮字段...')

  // 飞书按钮字段配置
  // type: 23 = 按钮字段
  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_name: '去复刻',
        type: 23, // 按钮类型
        property: {
          button_action_type: 1, // 1=打开链接
          button_text: '去复刻',
          button_url: `${APP_URL}/rewrite?title={{标题}}&content={{正文}}&tags={{话题标签}}`,
          open_in_new_tab: true
        }
      }),
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    console.error('❌ 创建按钮字段失败:', data)
    throw new Error(`创建按钮字段失败: ${data.msg}`)
  }

  console.log('✅ 按钮字段创建成功')
  return data.data.field
}

/**
 * 获取表格字段列表
 */
async function getTableFields(appToken: string, tableId: string, accessToken: string) {
  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`获取字段列表失败: ${data.msg}`)
  }

  return data.data.items
}

/**
 * GET /api/feishu/setup-button
 * 配置飞书表格"去复刻"按钮
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 开始配置"去复刻"按钮...')
    console.log(`📊 App Token: ${APP_TOKEN}`)
    console.log(`📊 Table ID: ${TABLE_ID}`)
    console.log(`🔗 App URL: ${APP_URL}`)

    if (!APP_TOKEN || !TABLE_ID) {
      return NextResponse.json({
        success: false,
        error: '未配置表格信息',
      }, { status: 400 })
    }

    // 1. 获取访问令牌
    console.log('🔑 获取访问令牌...')
    const accessToken = await getAppAccessToken()
    console.log('✅ 访问令牌获取成功')

    // 2. 检查是否已存在"去复刻"字段
    console.log('📋 检查现有字段...')
    const fields = await getTableFields(APP_TOKEN, TABLE_ID, accessToken)
    const buttonField = fields.find((f: any) => f.field_name === '去复刻')

    if (buttonField) {
      console.log('⏭️  "去复刻"按钮字段已存在，跳过创建')
      return NextResponse.json({
        success: true,
        message: '按钮字段已存在',
        field: buttonField,
        tips: [
          '按钮已配置完成',
          `链接：${APP_URL}/rewrite?title={{标题}}&content={{正文}}&tags={{话题标签}}`,
          '点击按钮将在新标签页打开复刻页面',
        ],
      })
    }

    // 3. 创建按钮字段
    console.log('🔨 创建按钮字段...')
    const field = await createButtonField(APP_TOKEN, TABLE_ID, accessToken)

    console.log('✅ 按钮配置完成!')

    return NextResponse.json({
      success: true,
      message: '按钮字段创建成功',
      field,
      tips: [
        '按钮已配置完成',
        `链接：${APP_URL}/rewrite?title={{标题}}&content={{正文}}&tags={{话题标签}}`,
        '点击按钮将在新标签页打开复刻页面',
      ],
    })

  } catch (error) {
    console.error('❌ 配置失败:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '配置失败',
    }, { status: 500 })
  }
}
