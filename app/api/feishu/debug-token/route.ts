import { NextResponse } from 'next/server'

/**
 * GET /api/feishu/debug-token
 * 显示当前使用的 refresh_token 的前后几位（用于调试）
 */
export async function GET() {
  try {
    const refreshToken = process.env.FEISHU_REFRESH_TOKEN

    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        error: '未配置 FEISHU_REFRESH_TOKEN'
      }, { status: 500 })
    }

    // 只显示前8位和后8位，中间用***隐藏
    const tokenPreview = refreshToken.length > 16
      ? `${refreshToken.substring(0, 8)}...${refreshToken.substring(refreshToken.length - 8)}`
      : refreshToken.substring(0, 8) + '...'

    return NextResponse.json({
      success: true,
      tokenPreview,
      tokenLength: refreshToken.length,
      environment: process.env.VERCEL_ENV || 'development'
    })

  } catch (error) {
    console.error('[Token调试] 错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
