import { NextResponse } from 'next/server'
import { isUserLoggedIn, loadToken } from '@/lib/feishu-auth'

/**
 * GET /api/auth/status
 * 检查用户登录状态
 */
export async function GET() {
  try {
    const isLoggedIn = await isUserLoggedIn()
    const token = loadToken()

    if (isLoggedIn && token) {
      return NextResponse.json({
        loggedIn: true,
        expiresAt: token.expires_at,
        expiresIn: Math.floor((token.expires_at - Date.now()) / 1000), // 剩余秒数
      })
    }

    return NextResponse.json({
      loggedIn: false,
    })
  } catch (error) {
    console.error('[Auth Status] 检查登录状态失败:', error)
    return NextResponse.json({
      loggedIn: false,
      error: String(error),
    })
  }
}
