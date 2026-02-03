import { NextRequest, NextResponse } from 'next/server'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET /api/feishu/auth/url
 * 生成飞书 OAuth 授权链接
 */
export async function GET(request: NextRequest) {
  try {
    if (!FEISHU_APP_ID) {
      return NextResponse.json({
        success: false,
        error: '未配置 FEISHU_APP_ID',
      }, { status: 400 })
    }

    // 构建回调URL
    const redirectUri = `${BASE_URL}/api/feishu/auth/callback`

    // 生成飞书授权链接
    // 参考: https://open.feishu.cn/document/common-capabilities/sso/api/get-user-access-token
    const authUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/authorize')
    authUrl.searchParams.set('app_id', FEISHU_APP_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'bitable:app') // 多维表格权限
    authUrl.searchParams.set('state', 'STATE') // 可选，用于防CSRF攻击

    console.log('[飞书授权] 生成授权链接:', authUrl.toString())
    console.log('[飞书授权] 回调地址:', redirectUri)

    return NextResponse.json({
      success: true,
      data: {
        authUrl: authUrl.toString(),
        redirectUri,
        appId: FEISHU_APP_ID,
      },
    })

  } catch (error) {
    console.error('[飞书授权] 生成授权链接失败:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '生成授权链接失败',
    }, { status: 500 })
  }
}
