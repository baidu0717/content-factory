import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { HttpsProxyAgent } from 'https-proxy-agent'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 代理配置
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const proxyAgent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined

// Token存储文件路径
const TOKEN_FILE = join(process.cwd(), '.feishu-token.json')

/**
 * 获取 app_access_token（应用级别token）
 */
async function getAppAccessToken(): Promise<string> {
  console.log('[飞书OAuth] 获取app_access_token...')

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
    console.error('[飞书OAuth] 获取app_access_token失败:', data)
    throw new Error(`获取app_access_token失败: ${data.msg}`)
  }

  console.log('[飞书OAuth] app_access_token获取成功')
  return data.app_access_token
}

/**
 * 用code换取user_access_token
 */
async function getUserAccessToken(code: string) {
  console.log('[飞书OAuth] 用code换取user_access_token...')

  // 先获取 app_access_token
  const appAccessToken = await getAppAccessToken()

  const requestBody = {
    grant_type: 'authorization_code',
    code: code,
  }

  const response = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appAccessToken}`,
    },
    body: JSON.stringify(requestBody),
    // @ts-ignore
    agent: proxyAgent,
  })

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[飞书OAuth] 换取user_access_token失败:', data)
    throw new Error(`换取token失败: ${data.message || data.msg}`)
  }

  console.log('[飞书OAuth] 成功获取user_access_token')
  return data.data
}

/**
 * 保存token到文件
 */
function saveToken(tokenData: any) {
  console.log('[Token存储] 保存token到文件...')

  const tokenInfo = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in, // 秒数
    expires_at: Date.now() + tokenData.expires_in * 1000, // 过期时间戳
    refresh_expires_in: tokenData.refresh_expires_in,
    refresh_expires_at: Date.now() + tokenData.refresh_expires_in * 1000,
    created_at: Date.now(),
  }

  try {
    writeFileSync(TOKEN_FILE, JSON.stringify(tokenInfo, null, 2), 'utf-8')
    console.log('[Token存储] Token保存成功')
  } catch (error) {
    console.error('[Token存储] 保存失败:', error)
    throw error
  }
}

/**
 * GET /api/auth/callback?code=xxx
 * 处理飞书OAuth回调
 */
export async function GET(request: NextRequest) {
  console.log('='.repeat(80))
  console.log('[飞书OAuth] 收到授权回调')

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      console.error('[飞书OAuth] 缺少code参数')
      return NextResponse.json(
        { success: false, error: '授权失败：缺少code参数' },
        { status: 400 }
      )
    }

    console.log('[飞书OAuth] 授权码:', code.substring(0, 20) + '...')

    // 用code换取token
    const tokenData = await getUserAccessToken(code)

    // 保存token
    saveToken(tokenData)

    console.log('[飞书OAuth] 授权流程完成！')
    console.log('='.repeat(80))

    // 重定向回采集页面
    return NextResponse.redirect(new URL('/xiaohongshu-extract?auth=success', request.url))
  } catch (error) {
    console.error('[飞书OAuth] 授权失败:', error)
    console.log('='.repeat(80))

    return NextResponse.redirect(
      new URL('/xiaohongshu-extract?auth=error&message=' + encodeURIComponent(String(error)), request.url)
    )
  }
}
