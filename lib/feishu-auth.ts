import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { HttpsProxyAgent } from 'https-proxy-agent'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const proxyAgent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined

const TOKEN_FILE = join(process.cwd(), '.feishu-token.json')

interface TokenInfo {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  refresh_expires_in: number
  refresh_expires_at: number
  created_at: number
}

/**
 * 读取保存的token
 */
export function loadToken(): TokenInfo | null {
  try {
    if (!existsSync(TOKEN_FILE)) {
      return null
    }

    const content = readFileSync(TOKEN_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Token] 读取token失败:', error)
    return null
  }
}

/**
 * 保存token
 */
export function saveToken(tokenData: any) {
  const tokenInfo: TokenInfo = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    expires_at: Date.now() + tokenData.expires_in * 1000,
    refresh_expires_in: tokenData.refresh_expires_in,
    refresh_expires_at: Date.now() + tokenData.refresh_expires_in * 1000,
    created_at: Date.now(),
  }

  writeFileSync(TOKEN_FILE, JSON.stringify(tokenInfo, null, 2), 'utf-8')
}

/**
 * 检查token是否过期
 */
export function isTokenExpired(token: TokenInfo): boolean {
  // 提前5分钟判定为过期
  return token.expires_at - 5 * 60 * 1000 < Date.now()
}

/**
 * 获取 app_access_token（应用级别token）
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
 * 刷新access_token
 */
export async function refreshAccessToken(refreshToken: string): Promise<any> {
  console.log('[Token] 刷新access_token...')

  // 先获取 app_access_token
  const appAccessToken = await getAppAccessToken()

  const response = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/refresh_access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appAccessToken}`,
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[Token] 刷新token失败:', data)
    throw new Error(`刷新token失败: ${data.message || data.msg}`)
  }

  console.log('[Token] Token刷新成功')
  return data.data
}

/**
 * 获取有效的access_token（自动刷新）
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = loadToken()

  if (!token) {
    console.log('[Token] 未找到token，用户需要登录')
    return null
  }

  // 检查access_token是否过期
  if (isTokenExpired(token)) {
    console.log('[Token] Access token已过期，开始刷新...')

    // 检查refresh_token是否也过期了
    if (token.refresh_expires_at < Date.now()) {
      console.log('[Token] Refresh token也已过期，用户需要重新登录')
      return null
    }

    try {
      // 刷新token
      const newTokenData = await refreshAccessToken(token.refresh_token)
      saveToken(newTokenData)
      return newTokenData.access_token
    } catch (error) {
      console.error('[Token] 刷新token失败:', error)
      return null
    }
  }

  return token.access_token
}

/**
 * 检查用户是否已登录
 */
export async function isUserLoggedIn(): Promise<boolean> {
  const token = await getValidAccessToken()
  return token !== null
}
