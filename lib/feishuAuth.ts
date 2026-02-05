// 飞书应用认证工具函数
// 使用环境变量 + 内存缓存管理 token

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_REFRESH_TOKEN = process.env.FEISHU_REFRESH_TOKEN || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 内存缓存
let cachedAppAccessToken: string | null = null
let cachedUserAccessToken: string | null = null
let appTokenExpireTime: number = 0
let userTokenExpireTime: number = 0

/**
 * 自动更新Vercel环境变量中的refresh_token
 */
async function updateVercelToken(newToken: string): Promise<void> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://content-factory-jade-nine.vercel.app'}/api/feishu/update-vercel-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newRefreshToken: newToken })
    })

    const data = await response.json()
    if (data.success) {
      console.log('[飞书Auth] ✅ Vercel环境变量已自动更新')
    } else {
      console.error('[飞书Auth] ❌ 自动更新失败:', data.error)
    }
  } catch (error) {
    console.error('[飞书Auth] 自动更新异常:', error)
  }
}

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
 * 使用环境变量 + 内存缓存
 */
export async function getUserAccessToken(): Promise<string> {
  const now = Date.now()

  // 检查内存缓存（提前5分钟刷新）
  if (cachedUserAccessToken && userTokenExpireTime > now + 5 * 60 * 1000) {
    console.log('[飞书Auth] 使用缓存的 user_access_token')
    return cachedUserAccessToken
  }

  console.log('[飞书Auth] 刷新 user_access_token...')

  try {
    if (!FEISHU_REFRESH_TOKEN) {
      throw new Error('未配置 FEISHU_REFRESH_TOKEN（请检查环境变量）')
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
        refresh_token: FEISHU_REFRESH_TOKEN
      })
    })

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书Auth] 刷新user_access_token失败:', data)

      // 检查是否是 refresh_token 过期或无效
      if (data.code === 10012 || data.code === 99991400 || data.msg?.includes('invalid') || data.msg?.includes('expired')) {
        const errorMsg = `Refresh Token 已过期或无效，请重新授权。访问: ${process.env.NEXT_PUBLIC_APP_URL}/feishu-auth`
        console.error('[飞书Auth] ❌', errorMsg)
        throw new Error(errorMsg)
      }

      throw new Error(`刷新token失败: ${data.msg || data.message || JSON.stringify(data)}`)
    }

    const { access_token, expires_in, refresh_token: newRefreshToken } = data.data

    // 缓存到内存
    cachedUserAccessToken = access_token
    userTokenExpireTime = now + expires_in * 1000

    console.log('[飞书Auth] user_access_token 刷新成功，有效期:', expires_in, '秒')

    // 如果获得了新的 refresh_token，自动更新到Vercel
    if (newRefreshToken && newRefreshToken !== FEISHU_REFRESH_TOKEN) {
      console.warn('[飞书Auth] ⚠️  检测到新的 refresh_token')
      console.warn('[飞书Auth] 旧token:', FEISHU_REFRESH_TOKEN.substring(0, 20) + '...')
      console.warn('[飞书Auth] 新token:', newRefreshToken.substring(0, 20) + '...')

      // 在生产环境(Vercel)自动更新环境变量
      if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_TOKEN) {
        console.log('[飞书Auth] 生产环境,尝试自动更新Vercel环境变量...')
        updateVercelToken(newRefreshToken).catch(err => {
          console.error('[飞书Auth] 自动更新Vercel token失败:', err)
        })
      } else {
        console.warn('[飞书Auth] 请手动更新环境变量:')
        console.warn(`FEISHU_REFRESH_TOKEN=${newRefreshToken}`)
      }
    }

    return access_token

  } catch (error) {
    console.error('[飞书Auth] 刷新user_access_token失败:', error)
    throw error
  }
}

/**
 * 检测图片格式
 */
function detectImageFormat(buffer: Buffer): 'heif' | 'jpeg' | 'png' | 'webp' | 'unknown' {
  // HEIF/HEIC: 前12字节包含 'ftyp' 和 'heic'/'mif1'
  if (buffer.length > 12) {
    const header = buffer.toString('ascii', 4, 12)
    if (header.includes('ftyp') && (buffer.toString('ascii', 8, 12) === 'heic' || buffer.toString('ascii', 8, 12) === 'mif1')) {
      return 'heif'
    }
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg'
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png'
  }

  // WebP: RIFF ... WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp'
  }

  return 'unknown'
}

/**
 * 将HEIF格式转换为JPEG（使用Canvas API）
 */
async function convertHeifToJpeg(heifBuffer: Buffer): Promise<Buffer> {
  try {
    console.log('[图片转换] HEIF格式检测，尝试转换为JPEG...')

    // 方案：直接修改URL参数，让小红书服务器返回JPEG
    // 但这里我们已经下载了HEIF，需要在Node.js中转换
    // 由于Node.js环境没有Canvas/Image API，我们需要使用sharp库
    // 但为了避免额外依赖，我们采用替代方案：修改下载时的URL

    throw new Error('HEIF格式需要转换，建议在下载时就请求JPEG格式')
  } catch (error) {
    console.error('[图片转换] 转换失败:', error)
    throw error
  }
}

/**
 * 上传文件到飞书云文档
 * 参考官方SDK示例：使用 bitable_image 作为 parent_type
 */
export async function uploadFileToFeishu(
  fileBuffer: Buffer,
  fileName: string,
  appToken: string
): Promise<string> {
  const userAccessToken = await getUserAccessToken()

  console.log('[飞书文件上传] 开始上传:', fileName)
  console.log('[飞书文件上传] 文件大小:', fileBuffer.length, 'bytes')

  // 检测图片格式
  const format = detectImageFormat(fileBuffer)
  console.log('[飞书文件上传] 检测到图片格式:', format)

  // 如果是HEIF格式，记录警告（理论上不应该出现，因为下载时已经转换为JPEG）
  if (format === 'heif') {
    console.warn('[飞书文件上传] ⚠️  检测到HEIF格式，这不应该发生（下载时应已转换为JPEG）')
    console.warn('[飞书文件上传] 尝试以 image/jpeg MIME 类型上传...')
  }

  // 根据格式设置MIME类型
  let mimeType = 'image/jpeg'
  if (format === 'png') mimeType = 'image/png'
  if (format === 'webp') mimeType = 'image/webp'

  console.log('[飞书文件上传] 使用 MIME 类型:', mimeType)
  console.log('[飞书文件上传] 使用 user_access_token')
  console.log('[飞书文件上传] parent_type: bitable_image')
  console.log('[飞书文件上传] parent_node (appToken):', appToken)

  // 构建 multipart/form-data
  const formData = new FormData()
  const uint8Array = new Uint8Array(fileBuffer)
  const blob = new Blob([uint8Array], { type: mimeType })

  // 使用正确的参数（参考官方SDK示例）
  formData.append('file_name', fileName)
  formData.append('parent_type', 'bitable_image')  // 关键修正！
  formData.append('parent_node', appToken)          // 传递 appToken
  formData.append('size', String(fileBuffer.length))
  formData.append('file', blob, fileName)

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

  console.log('[飞书文件上传] ✅ 上传成功，file_token:', fileToken)

  return fileToken
}
