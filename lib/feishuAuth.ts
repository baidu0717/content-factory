// 飞书 OAuth 工具函数

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_REFRESH_TOKEN = process.env.FEISHU_REFRESH_TOKEN || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 内存缓存（生产环境应该用 Redis 或数据库）
let cachedUserAccessToken: string | null = null
let tokenExpireTime: number = 0

/**
 * 使用 refresh_token 获取 user_access_token
 */
export async function getUserAccessToken(): Promise<string> {
  // 检查缓存（提前5分钟刷新）
  const now = Date.now()
  if (cachedUserAccessToken && tokenExpireTime > now + 5 * 60 * 1000) {
    console.log('[飞书Auth] 使用缓存的 user_access_token')
    return cachedUserAccessToken
  }

  console.log('[飞书Auth] 刷新 user_access_token...')

  if (!FEISHU_REFRESH_TOKEN) {
    throw new Error('未配置 FEISHU_REFRESH_TOKEN，请先完成 OAuth 授权')
  }

  try {
    // 第一步：获取 app_access_token
    const appTokenResponse = await fetch(`${FEISHU_API_URL}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      })
    })

    const appTokenData = await appTokenResponse.json()

    if (appTokenData.code !== 0) {
      console.error('[飞书Auth] 获取app_access_token失败:', appTokenData)
      throw new Error(`获取app_access_token失败: ${appTokenData.msg}`)
    }

    const appAccessToken = appTokenData.app_access_token

    // 第二步：使用 app_access_token 刷新 user_access_token
    const response = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/refresh_access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: FEISHU_REFRESH_TOKEN
      })
    })

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书Auth] 刷新token失败:', data)
      throw new Error(`刷新token失败: ${data.msg}`)
    }

    const { access_token, expires_in } = data.data

    // 缓存 token
    cachedUserAccessToken = access_token
    tokenExpireTime = now + expires_in * 1000

    console.log('[飞书Auth] user_access_token 刷新成功，有效期:', expires_in, '秒')

    return access_token

  } catch (error) {
    console.error('[飞书Auth] 获取user_access_token失败:', error)
    throw error
  }
}

/**
 * 上传文件到飞书云文档
 */
export async function uploadFileToFeishu(
  fileBuffer: Buffer,
  fileName: string,
  fileType: string = 'image'
): Promise<string> {
  const userAccessToken = await getUserAccessToken()

  console.log('[飞书文件上传] 开始上传:', fileName)

  // 构建 multipart/form-data
  const formData = new FormData()
  // 将 Buffer 转为 Uint8Array 再创建 Blob
  const uint8Array = new Uint8Array(fileBuffer)
  const blob = new Blob([uint8Array], { type: 'image/jpeg' })
  formData.append('file', blob, fileName)
  formData.append('file_name', fileName)
  formData.append('file_type', fileType)
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
