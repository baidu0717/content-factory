import { NextResponse } from 'next/server'
import { getUserAccessToken } from '@/lib/feishuAuth'

/**
 * GET /api/feishu/token-status
 * 检查飞书 Token 状态
 */
export async function GET() {
  try {
    console.log('[Token状态] 开始检查...')

    // 尝试获取 user_access_token（这会触发刷新）
    const token = await getUserAccessToken()

    console.log('[Token状态] ✅ Token 有效')

    return NextResponse.json({
      success: true,
      status: 'valid',
      message: 'Token 状态正常',
      tokenPreview: token.substring(0, 20) + '...'
    })

  } catch (error) {
    console.error('[Token状态] ❌ Token 失效:', error)

    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const isTokenExpired = errorMessage.includes('过期') || errorMessage.includes('expired') || errorMessage.includes('invalid')

    return NextResponse.json({
      success: false,
      status: isTokenExpired ? 'expired' : 'error',
      message: errorMessage,
      needReauth: isTokenExpired,
      authUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/feishu-auth`
    }, { status: isTokenExpired ? 401 : 500 })
  }
}
