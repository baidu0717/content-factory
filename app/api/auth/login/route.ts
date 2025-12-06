import { NextRequest, NextResponse } from 'next/server'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  : 'http://localhost:3000/api/auth/callback'

/**
 * GET /api/auth/login
 * 引导用户跳转到飞书授权页面
 */
export async function GET(request: NextRequest) {
  console.log('[飞书登录] 开始OAuth授权流程')
  console.log('[飞书登录] 回调地址:', REDIRECT_URI)

  // 飞书授权页面URL
  const authUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/authorize')

  authUrl.searchParams.append('app_id', FEISHU_APP_ID)
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.append('state', 'STATE') // 可以用随机字符串防止CSRF攻击

  console.log('[飞书登录] 跳转到:', authUrl.toString())

  // 重定向到飞书授权页面
  return NextResponse.redirect(authUrl.toString())
}
