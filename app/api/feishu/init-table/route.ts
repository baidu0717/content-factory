import { NextRequest, NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

// 飞书API配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 代理配置
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const proxyAgent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined

/**
 * 获取 tenant_access_token
 */
async function getTenantAccessToken(): Promise<string> {
  console.log('[飞书API] 获取 tenant_access_token...')

  const response = await fetch(`${FEISHU_API_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`获取token失败: ${data.msg}`)
  }

  console.log('[飞书API] token获取成功')
  return data.tenant_access_token
}

/**
 * 创建多维表格
 */
async function createBitable(token: string, name: string) {
  console.log('[飞书API] 创建多维表格...')

  const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: name,
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[飞书API] 创建多维表格失败:', data)
    throw new Error(`创建多维表格失败: ${data.msg}`)
  }

  console.log('[飞书API] 多维表格创建成功:', data.data)
  return data.data
}

/**
 * 创建数据表
 */
async function createTable(token: string, appToken: string, tableName: string) {
  console.log('[飞书API] 创建数据表...')

  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        table: {
          name: tableName,
        },
      }),
      // @ts-ignore
      agent: proxyAgent,
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[飞书API] 创建数据表失败:', data)
    throw new Error(`创建数据表失败: ${data.msg}`)
  }

  console.log('[飞书API] 数据表创建成功:', data.data)
  return data.data
}

/**
 * 创建字段
 */
async function createField(
  token: string,
  appToken: string,
  tableId: string,
  fieldName: string,
  fieldType: number
) {
  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        field_name: fieldName,
        type: fieldType,
      }),
      // @ts-ignore
      agent: proxyAgent,
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    console.error(`[飞书API] 创建字段 ${fieldName} 失败:`, data)
    throw new Error(`创建字段失败: ${data.msg}`)
  }

  console.log(`[飞书API] 字段 ${fieldName} 创建成功`)
  return data.data
}

/**
 * POST /api/feishu/init-table
 * 初始化飞书多维表格（由应用创建）
 */
export async function POST(request: NextRequest) {
  try {
    console.log('='.repeat(80))
    console.log('[飞书初始化] 开始初始化多维表格...')

    // 获取token
    const token = await getTenantAccessToken()

    // 1. 创建多维表格
    const bitable = await createBitable(token, '小红书笔记采集')
    const appToken = bitable.app.app_token

    console.log('[飞书初始化] 多维表格创建成功，app_token:', appToken)

    // 2. 获取默认数据表ID（飞书会自动创建一个默认表）
    const tableId = bitable.app.default_table_id

    console.log('[飞书初始化] 使用默认数据表，table_id:', tableId)

    // 3. 创建字段（飞书字段类型：1=文本，15=URL）
    const fields = [
      { name: '笔记链接', type: 15 },    // URL类型
      { name: '封面', type: 15 },         // URL类型
      { name: '图片 2', type: 15 },       // URL类型
      { name: '图片 3', type: 15 },       // URL类型
      { name: '标题', type: 1 },          // 文本类型
      { name: '正文', type: 1 },          // 文本类型
      { name: '话题标签', type: 1 },      // 文本类型
    ]

    console.log('[飞书初始化] 开始创建字段...')
    for (const field of fields) {
      await createField(token, appToken, tableId, field.name, field.type)
    }

    console.log('[飞书初始化] 所有字段创建完成！')
    console.log('='.repeat(80))

    return NextResponse.json({
      success: true,
      data: {
        message: '多维表格初始化成功！',
        appToken,
        tableId,
        url: `https://ai.feishu.cn/base/${appToken}?table=${tableId}`,
        tip: '请将 appToken 和 tableId 更新到 .env.local 文件中',
      },
    })
  } catch (error) {
    console.error('[飞书初始化] 错误:', error)
    console.log('='.repeat(80))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '初始化失败',
      },
      { status: 500 }
    )
  }
}
