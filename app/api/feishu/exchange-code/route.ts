import { NextRequest, NextResponse } from 'next/server'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''

/**
 * POST /api/feishu/exchange-code
 * 用授权码换取 refresh_token
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json({
        success: false,
        error: '缺少授权码'
      }, { status: 400 })
    }

    console.log('[Exchange Code] 开始用授权码换取token...')

    // 1. 获取 app_access_token
    const appTokenResponse = await fetch(`${FEISHU_API_URL}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      })
    })

    const appTokenData = await appTokenResponse.json()

    if (appTokenData.code !== 0) {
      console.error('[Exchange Code] 获取app token失败:', appTokenData)
      return NextResponse.json({
        success: false,
        error: `获取app token失败: ${appTokenData.msg}`
      }, { status: 500 })
    }

    const appAccessToken = appTokenData.app_access_token

    // 2. 用授权码换取 user_access_token 和 refresh_token
    const userTokenResponse = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code
      })
    })

    const userTokenData = await userTokenResponse.json()

    if (userTokenData.code !== 0) {
      console.error('[Exchange Code] 换取token失败:', userTokenData)
      return NextResponse.json({
        success: false,
        error: `换取token失败: ${userTokenData.msg}`
      }, { status: 500 })
    }

    const { access_token, refresh_token, expires_in } = userTokenData.data

    console.log('[Exchange Code] ✅ 成功获取 refresh_token')

    // 3. 获取用户信息
    const userInfoResponse = await fetch(`${FEISHU_API_URL}/authen/v1/user_info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    const userInfoData = await userInfoResponse.json()
    const userInfo = userInfoData.code === 0 ? userInfoData.data : null

    return NextResponse.json({
      success: true,
      data: {
        refresh_token,
        expires_in,
        user_info: userInfo
      }
    })

  } catch (error) {
    console.error('[Exchange Code] 错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
