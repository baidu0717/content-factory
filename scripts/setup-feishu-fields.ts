import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { getAppAccessToken } from '../lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || 'NNd8bJYazaBwHAsZ2z2cqsvmnqf'
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || 'tblu1m2GPcFRNSPE'

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
  fieldType: number,
  uiType?: string
) {
  console.log(`📝 创建字段: ${fieldName} (类型: ${fieldType})`)

  const body: any = {
    field_name: fieldName,
    type: fieldType,
  }

  // 如果是按钮字段，需要额外配置
  if (uiType) {
    body.ui_type = uiType
  }

  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
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
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始配置飞书表格字段...')
    console.log(`📊 App Token: ${APP_TOKEN}`)
    console.log(`📊 Table ID: ${TABLE_ID}`)

    // 1. 获取访问令牌
    console.log('\n🔑 获取访问令牌...')
    const accessToken = await getAppAccessToken()
    console.log('✅ 访问令牌获取成功')

    // 2. 获取当前字段列表
    console.log('\n📋 获取当前字段列表...')
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

    console.log('\n📝 准备创建以下字段:')
    for (const field of fieldsToCreate) {
      if (existingFieldNames.includes(field.name)) {
        console.log(`⏭️  跳过已存在的字段: ${field.name}`)
      } else {
        console.log(`➕ 将创建字段: ${field.name}`)
      }
    }

    // 4. 创建新字段
    console.log('\n🔨 开始创建字段...')
    for (const field of fieldsToCreate) {
      if (!existingFieldNames.includes(field.name)) {
        await createField(APP_TOKEN, TABLE_ID, accessToken, field.name, field.type)
        // 延迟500ms，避免频率限制
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log('\n✅ 表格字段配置完成!')
    console.log('\n📝 提示:')
    console.log('1. 请手动将"笔记链接"列拖到第1列位置')
    console.log('2. 可以手动添加"去复刻"按钮字段（类型：按钮），配置链接为:')
    console.log('   https://content-factory-jade-nine.vercel.app/rewrite?title={{标题}}&content={{正文内容}}&tags={{话题标签}}')

  } catch (error) {
    console.error('❌ 配置失败:', error)
    process.exit(1)
  }
}

main()
