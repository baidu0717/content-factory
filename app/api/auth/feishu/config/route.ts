import { NextResponse } from 'next/server'

/**
 * GET /api/auth/feishu/config
 * 获取飞书 OAuth 配置
 */
export async function GET() {
  const appId = process.env.FEISHU_APP_ID || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const redirectUri = `${appUrl}/api/auth/feishu/callback`

  return NextResponse.json({
    appId,
    redirectUri
  })
}
