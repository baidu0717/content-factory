// 飞书应用认证工具函数
// 使用 KV 存储动态刷新的 refresh_token
import { createClient } from '@vercel/kv'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_REFRESH_TOKEN = process.env.FEISHU_REFRESH_TOKEN || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 配置 KV 客户端使用 STORAGE_ 前缀（Upstash 连接时的自定义前缀）
const kv = createClient({
  url: process.env.STORAGE_REST_API_URL || process.env.KV_REST_API_URL || '',
  token: process.env.STORAGE_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || ''
})

// 内存缓存（用于本地开发，生产环境使用 KV）
let cachedAppAccessToken: string | null = null
let cachedUserAccessToken: string | null = null
let appTokenExpireTime: number = 0
let userTokenExpireTime: number = 0

// KV 存储键名
const KV_KEY_USER_ACCESS_TOKEN = 'feishu:user_access_token'
const KV_KEY_USER_TOKEN_EXPIRE = 'feishu:user_token_expire'
const KV_KEY_REFRESH_TOKEN = 'feishu:refresh_token'

/**
 * 获取 app_access_token（应用级别的访问令牌）
 */
export async function getAppAccessToken(): Promise<string> {
  // 检查缓存（提前5分钟刷新）
  const now = Date.now()
  if (cachedAppAccessToken && appTokenExpireTime > now + 5 * 60 * 1000) {
    console.log('[飞书Auth] 使用缓存的 app_access_token')
    return cachedAppAccessToken
  }

  console.log('[飞书Auth] 获取 app_access_token...')

  try {
    const response = await fetch(`${FEISHU_API_URL}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      })
    })

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书Auth] 获取app_access_token失败:', data)
      throw new Error(`获取app_access_token失败: ${data.msg}`)
    }

    const { app_access_token, expire } = data

    // 缓存 token
    cachedAppAccessToken = app_access_token
    appTokenExpireTime = now + expire * 1000

    console.log('[飞书Auth] app_access_token 获取成功，有效期:', expire, '秒')

    return app_access_token

  } catch (error) {
    console.error('[飞书Auth] 获取app_access_token失败:', error)
    throw error
  }
}

/**
 * 获取 user_access_token（用户级别的访问令牌）
 * 用于访问个人多维表格
 * 使用 Vercel KV 存储 refresh_token 以支持动态更新
 */
export async function getUserAccessToken(): Promise<string> {
  const now = Date.now()

  try {
    // 尝试从 KV 读取缓存的 token（生产环境）
    const kvToken = await kv.get<string>(KV_KEY_USER_ACCESS_TOKEN)
    const kvExpire = await kv.get<number>(KV_KEY_USER_TOKEN_EXPIRE)

    if (kvToken && kvExpire && kvExpire > now + 5 * 60 * 1000) {
      console.log('[飞书Auth] 使用 KV 缓存的 user_access_token')
      return kvToken
    }
  } catch (error) {
    // KV 不可用（本地开发），使用内存缓存
    if (cachedUserAccessToken && userTokenExpireTime > now + 5 * 60 * 1000) {
      console.log('[飞书Auth] 使用内存缓存的 user_access_token')
      return cachedUserAccessToken
    }
  }

  console.log('[飞书Auth] 刷新 user_access_token...')

  try {
    // 获取 refresh_token（优先从 KV，降级到环境变量）
    let refreshToken: string | null = null
    try {
      refreshToken = await kv.get<string>(KV_KEY_REFRESH_TOKEN)
      if (refreshToken) {
        console.log('[飞书Auth] 从 KV 读取 refresh_token')
      } else {
        // KV 里没有值，降级到环境变量
        refreshToken = FEISHU_REFRESH_TOKEN
        console.log('[飞书Auth] KV 为空，从环境变量读取 refresh_token')
      }
    } catch (error) {
      // KV 不可用，降级到环境变量
      refreshToken = FEISHU_REFRESH_TOKEN
      console.log('[飞书Auth] KV 读取失败，从环境变量读取 refresh_token')
    }

    if (!refreshToken) {
      throw new Error('未配置 FEISHU_REFRESH_TOKEN（请检查环境变量或 KV 存储）')
    }

    // 第一步：获取 app_access_token
    const appAccessToken = await getAppAccessToken()

    // 第二步：使用 refresh_token 刷新 user_access_token
    const response = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/refresh_access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书Auth] 刷新user_access_token失败:', data)
      throw new Error(`刷新token失败: ${data.msg || data.message || JSON.stringify(data)}`)
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = data.data

    // 保存新的 token 到 KV（如果可用）
    try {
      await Promise.all([
        kv.set(KV_KEY_USER_ACCESS_TOKEN, access_token),
        kv.set(KV_KEY_USER_TOKEN_EXPIRE, now + expires_in * 1000),
        kv.set(KV_KEY_REFRESH_TOKEN, newRefreshToken)
      ])
      console.log('[飞书Auth] 新 token 已保存到 KV')
    } catch {
      // KV 不可用，降级到内存缓存
      cachedUserAccessToken = access_token
      userTokenExpireTime = now + expires_in * 1000
      console.log('[飞书Auth] KV 不可用，使用内存缓存')
    }

    console.log('[飞书Auth] user_access_token 刷新成功，有效期:', expires_in, '秒')

    return access_token

  } catch (error) {
    console.error('[飞书Auth] 刷新user_access_token失败:', error)
    throw error
  }
}

/**
 * 上传文件到飞书云文档
 * 使用 user_access_token 上传到个人表格
 */
export async function uploadFileToFeishu(
  fileBuffer: Buffer,
  fileName: string,
  fileType: string = 'image',
  parentType: string = 'bitable',
  parentNode?: string
): Promise<string> {
  // 使用 user_access_token 上传到个人表格
  const userAccessToken = await getUserAccessToken()

  console.log('[飞书文件上传] 开始上传:', fileName)
  console.log('[飞书文件上传] 使用 user_access_token')
  console.log('[飞书文件上传] parent_type:', parentType)
  console.log('[飞书文件上传] parent_node:', parentNode || '(未指定)')

  // 构建 multipart/form-data
  const formData = new FormData()
  // 将 Buffer 转为 Uint8Array 再创建 Blob
  const uint8Array = new Uint8Array(fileBuffer)
  const blob = new Blob([uint8Array], { type: 'image/jpeg' })
  formData.append('file', blob, fileName)
  formData.append('file_name', fileName)
  formData.append('file_type', fileType)
  // 不指定 parent_type 和 parent_node，直接上传到用户云空间
  // 然后通过 file_token 在附件字段中引用
  formData.append('duration', '0')

  const response = await fetch(`${FEISHU_API_URL}/drive/v1/files/upload_all`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAccessToken}`
    },
    body: formData
  })

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[飞书文件上传] 上传失败:', data)
    throw new Error(`文件上传失败: ${data.msg}`)
  }

  const fileToken = data.data.file_token

  console.log('[飞书文件上传] 上传成功:', fileToken)

  return fileToken
}
