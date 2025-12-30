import { NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/feishuAuth'

/**
 * GET /api/auth/status
 * 检查用户登录状态
 *
 * 在Vercel环境下，使用环境变量中的FEISHU_REFRESH_TOKEN
 * 通过Vercel KV自动刷新token，无需手动登录
 */
export async function GET() {
  try {
    // 尝试获取有效的access token
    // 如果FEISHU_REFRESH_TOKEN配置正确，这里会自动刷新并返回token
    const accessToken = await getUserAccessToken()

    if (accessToken) {
      return NextResponse.json({
        loggedIn: true,
        message: '使用环境变量中的refresh_token自动登录'
      })
    }

    return NextResponse.json({
      loggedIn: false,
      message: '请配置FEISHU_REFRESH_TOKEN环境变量'
    })
  } catch (error) {
    console.error('[Auth Status] 检查登录状态失败:', error)
    return NextResponse.json({
      loggedIn: false,
      error: String(error),
    })
  }
}
