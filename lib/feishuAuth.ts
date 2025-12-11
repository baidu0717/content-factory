// 飞书应用认证工具函数

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_REFRESH_TOKEN = process.env.FEISHU_REFRESH_TOKEN || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 内存缓存（生产环境应该用 Redis 或数据库）
let cachedAppAccessToken: string | null = null
let cachedUserAccessToken: string | null = null
let appTokenExpireTime: number = 0
let userTokenExpireTime: number = 0

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
 */
export async function getUserAccessToken(): Promise<string> {
  // 检查缓存（提前5分钟刷新）
  const now = Date.now()
  if (cachedUserAccessToken && userTokenExpireTime > now + 5 * 60 * 1000) {
    console.log('[飞书Auth] 使用缓存的 user_access_token')
    return cachedUserAccessToken
  }

  console.log('[飞书Auth] 刷新 user_access_token...')

  if (!FEISHU_REFRESH_TOKEN) {
    throw new Error('未配置 FEISHU_REFRESH_TOKEN')
  }

  try {
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
        refresh_token: FEISHU_REFRESH_TOKEN
      })
    })

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书Auth] 刷新user_access_token失败:', data)
      throw new Error(`刷新token失败: ${data.msg || data.message || JSON.stringify(data)}`)
    }

    const { access_token, expires_in } = data.data

    // 缓存 token
    cachedUserAccessToken = access_token
    userTokenExpireTime = now + expires_in * 1000

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
  formData.append('parent_type', parentType)
  if (parentNode) {
    formData.append('parent_node', parentNode)
  }
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
