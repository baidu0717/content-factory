import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''

/**
 * 获取表格当前字段列表
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
 * 创建新字段
 */
async function createField(
  appToken: string,
  tableId: string,
  accessToken: string,
  fieldName: string,
  fieldType: number
) {
  console.log(`📝 创建字段: ${fieldName} (类型: ${fieldType})`)

  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        field_name: fieldName,
        type: fieldType,
      }),
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    console.error(`❌ 创建字段失败: ${fieldName}`, data)
    throw new Error(`创建字段失败: ${data.msg}`)
  }

  console.log(`✅ 字段创建成功: ${fieldName}`)
  return data.data.field
}

/**
 * GET /api/feishu/setup-fields
 * 配置飞书表格字段
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 开始配置飞书表格字段...')
    console.log(`📊 App Token: ${APP_TOKEN}`)
    console.log(`📊 Table ID: ${TABLE_ID}`)

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

    // 2. 获取当前字段列表
    console.log('📋 获取当前字段列表...')
    const fields = await getTableFields(APP_TOKEN, TABLE_ID, accessToken)
    console.log(`当前字段数量: ${fields.length}`)
    console.log('现有字段:', fields.map((f: any) => f.field_name).join(', '))

    // 3. 检查哪些字段需要创建
    const existingFieldNames = fields.map((f: any) => f.field_name)
    const fieldsToCreate = [
      { name: '作者昵称', type: 1 },  // 1=文本
      { name: '浏览数', type: 2 },    // 2=数字
      { name: '点赞数', type: 2 },
      { name: '收藏数', type: 2 },
      { name: '评论数', type: 2 },
      { name: '发布时间', type: 1 },  // 1=文本
    ]

    const results = []

    // 4. 创建新字段
    console.log('🔨 开始创建字段...')
    for (const field of fieldsToCreate) {
      if (existingFieldNames.includes(field.name)) {
        console.log(`⏭️  跳过已存在的字段: ${field.name}`)
        results.push({ field: field.name, status: 'exists' })
      } else {
        console.log(`➕ 创建字段: ${field.name}`)
        try {
          await createField(APP_TOKEN, TABLE_ID, accessToken, field.name, field.type)
          results.push({ field: field.name, status: 'created' })
          // 延迟500ms，避免频率限制
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`❌ 创建字段失败: ${field.name}`, error)
          results.push({ field: field.name, status: 'failed', error: String(error) })
        }
      }
    }

    console.log('✅ 表格字段配置完成!')

    return NextResponse.json({
      success: true,
      message: '表格字段配置完成',
      results,
      tips: [
        '请手动将"笔记链接"列拖到第1列位置',
        '',
        '📌 手动创建"去复刻"按钮字段的步骤：',
        '1. 在表格中点击"+"添加新字段',
        '2. 字段名称：去复刻',
        '3. 字段类型：选择"按钮"',
        '4. 按钮类型：打开链接',
        '5. 按钮文字：去复刻',
        '6. 链接地址：https://content-factory-jade-nine.vercel.app/rewrite?title={{标题}}&content={{正文}}&tags={{话题标签}}',
        '7. 勾选"在新标签页打开"',
        '',
        '注意：按钮字段无法通过API自动创建，必须手动在飞书界面中添加',
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
