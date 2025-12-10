// 飞书应用认证工具函数

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 内存缓存（生产环境应该用 Redis 或数据库）
let cachedAppAccessToken: string | null = null
let tokenExpireTime: number = 0

/**
 * 获取 app_access_token（应用级别的访问令牌）
 */
export async function getAppAccessToken(): Promise<string> {
  // 检查缓存（提前5分钟刷新）
  const now = Date.now()
  if (cachedAppAccessToken && tokenExpireTime > now + 5 * 60 * 1000) {
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
    tokenExpireTime = now + expire * 1000

    console.log('[飞书Auth] app_access_token 获取成功，有效期:', expire, '秒')

    return app_access_token

  } catch (error) {
    console.error('[飞书Auth] 获取app_access_token失败:', error)
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
  const appAccessToken = await getAppAccessToken()

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
      'Authorization': `Bearer ${appAccessToken}`
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
