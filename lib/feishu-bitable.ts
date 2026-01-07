/**
 * 飞书多维表格 API 封装
 * 文档：https://open.feishu.cn/document/server-docs/docs/bitable-v1/app/create
 */

import { HttpsProxyAgent } from 'https-proxy-agent'
import { getUserAccessToken } from './feishuAuth'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const proxyAgent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined

/**
 * 获取 app_access_token（应用级别token，不需要用户授权）
 */
async function getAppAccessToken(): Promise<string> {
  const response = await fetch(`${FEISHU_API_URL}/auth/v3/app_access_token/internal`, {
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
    throw new Error(`获取app_access_token失败: ${data.msg}`)
  }

  return data.app_access_token
}

/**
 * 创建多维表格（使用应用身份，支持上传图片）
 */
export async function createBitable(name: string, folderId?: string): Promise<{ app_token: string; url: string }> {
  const token = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      folder_token: folderId,
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`创建多维表格失败: ${data.msg}`)
  }

  const app_token = data.data.app.app_token
  const url = data.data.app.url

  // 使用应用身份创建后，设置为任何人可编辑
  console.log('✅ 表格已使用应用身份创建（支持上传图片）')
  console.log('📝 正在设置权限为"任何人可编辑"...')

  try {
    await setPublicPermission(app_token, 'anyone_editable')
    console.log('✅ 权限设置成功：任何人可编辑')
  } catch (error) {
    console.warn('⚠️ 权限设置失败，表格可能无法编辑:', error)
  }

  return {
    app_token,
    url,
  }
}

/**
 * 设置多维表格的公开权限
 */
async function setPublicPermission(appToken: string, permission: 'tenant_editable' | 'anyone_editable' | 'tenant_readable' | 'anyone_readable'): Promise<void> {
  const token = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/drive/v2/permissions/${appToken}/public?type=bitable`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      link_share_entity: permission,
      external_access_entity: permission === 'anyone_editable' || permission === 'anyone_readable' ? 'open' : 'closed',
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    console.error('权限设置失败详情:', JSON.stringify(data, null, 2))
    throw new Error(`设置权限失败: ${data.msg} (code: ${data.code})`)
  }
}

/**
 * 创建数据表（在多维表格中）
 */
export async function createTable(appToken: string, tableName: string, fields: any[]): Promise<string> {
  const token = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      table: {
        name: tableName,
        fields,
      },
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`创建数据表失败: ${data.msg}`)
  }

  return data.data.table_id
}

/**
 * 批量添加记录
 */
export async function addRecords(appToken: string, tableId: string, records: any[]): Promise<any> {
  const token = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      records: records.map(fields => ({ fields })),
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`批量添加记录失败: ${data.msg}`)
  }

  return data.data.records
}

/**
 * 更新记录
 */
export async function updateRecord(appToken: string, tableId: string, recordId: string, fields: any): Promise<any> {
  const token = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      fields,
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    console.error('❌ 更新记录失败详情:', JSON.stringify(data, null, 2))
    console.error('❌ 发送的字段:', JSON.stringify(fields, null, 2))
    throw new Error(`更新记录失败: ${data.msg}`)
  }

  return data.data.record
}

/**
 * 上传图片到飞书云空间（用于附件字段）
 * 参考：https://blog.csdn.net/juxiaoyu/article/details/153772805
 */
export async function uploadImage(imageUrl: string, appToken: string): Promise<string> {
  const token = await getAppAccessToken()

  // 1. 下载图片
  const imageResponse = await fetch(imageUrl, {
    // @ts-ignore
    agent: proxyAgent,
  })
  const imageBuffer = await imageResponse.arrayBuffer()

  // 2. 上传到飞书云空间（使用 medias API）
  const formData = new FormData()
  formData.append('file_name', `image_${Date.now()}.jpg`)
  formData.append('parent_type', 'bitable_image')  // 固定值：bitable_image
  formData.append('parent_node', appToken)         // 多维表格的 app_token
  formData.append('size', imageBuffer.byteLength.toString())
  formData.append('file', new Blob([imageBuffer]), 'image.jpg')

  const uploadResponse = await fetch(`${FEISHU_API_URL}/drive/v1/medias/upload_all`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
    // @ts-ignore
    agent: proxyAgent,
  })

  const uploadData = await uploadResponse.json()

  if (uploadData.code !== 0) {
    console.error('❌ 上传图片失败详情:', JSON.stringify(uploadData, null, 2))
    throw new Error(`上传图片失败: ${uploadData.msg}`)
  }

  return uploadData.data.file_token
}

/**
 * 获取记录列表
 */
export async function getRecords(appToken: string, tableId: string, pageSize: number = 20): Promise<any[]> {
  const token = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=${pageSize}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`获取记录失败: ${data.msg}`)
  }

  return data.data.items || []
}

/**
 * 创建小红书笔记采集专用表格
 */
export async function createXiaohongshuCollectTable(): Promise<{ app_token: string; table_id: string; url: string }> {
  console.log('📋 开始创建小红书笔记采集表格...')

  // 1. 创建多维表格
  const { app_token, url } = await createBitable('小红书笔记采集')
  console.log('✅ 多维表格创建成功:', app_token)

  // 2. 定义字段（按显示顺序排列）
  const fields = [
    {
      field_name: '笔记链接',
      type: 1, // 文本（存储URL）
    },
    {
      field_name: '标题',
      type: 1, // 文本
    },
    {
      field_name: '作者',
      type: 1, // 文本
    },
    {
      field_name: '分级',
      type: 3, // 单选
      property: {
        options: [
          { name: '🔥 小爆款' },
          { name: '💬 高评论' },
          { name: '📝 普通' },
        ],
      },
    },
    {
      field_name: '点赞数',
      type: 2, // 数字
      property: {
        formatter: '0', // 整数格式，0位小数
      },
    },
    {
      field_name: '收藏数',
      type: 2, // 数字
      property: {
        formatter: '0', // 整数格式，0位小数
      },
    },
    {
      field_name: '评论数',
      type: 2, // 数字
      property: {
        formatter: '0', // 整数格式，0位小数
      },
    },
    {
      field_name: '总互动数',
      type: 2, // 数字
      property: {
        formatter: '0', // 整数格式，0位小数
      },
    },
    {
      field_name: '评论占比',
      type: 1, // 文本
    },
    {
      field_name: '需要提取',
      type: 3, // 单选
      property: {
        options: [
          { name: '✅ 是' },
          { name: '⬜ 否' },
        ],
      },
    },
    {
      field_name: '封面',
      type: 17, // 附件（图片）
    },
    {
      field_name: '所有图片',
      type: 17, // 附件（所有图片）
    },
    {
      field_name: '正文内容',
      type: 1, // 多行文本
    },
    {
      field_name: '话题标签',
      type: 1, // 文本
    },
    {
      field_name: '提取状态',
      type: 3, // 单选
      property: {
        options: [
          { name: '⏳ 待提取' },
          { name: '✅ 已提取' },
          { name: '❌ 提取失败' },
        ],
      },
    },
  ]

  // 3. 创建数据表
  const table_id = await createTable(app_token, '笔记列表', fields)
  console.log('✅ 数据表创建成功:', table_id)

  return {
    app_token,
    table_id,
    url,
  }
}
