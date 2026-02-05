import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''

/**
 * GET /api/feishu/auth/callback
 * 飞书 OAuth 授权回调
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    console.log('[飞书回调] 收到授权回调')
    console.log('[飞书回调] code:', code ? '已获取' : '未获取')
    console.log('[飞书回调] state:', state)

    if (!code) {
      return NextResponse.redirect(
        new URL(`/feishu-auth?error=${encodeURIComponent('未获取到授权码')}`, request.url)
      )
    }

    // 1. 获取 app_access_token
    const appAccessToken = await getAppAccessToken()

    // 2. 使用 code 换取 user_access_token 和 refresh_token
    console.log('[飞书回调] 使用授权码换取 token...')
    const response = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code
      })
    })

    const data = await response.json()

    console.log('[飞书回调] API响应:', JSON.stringify(data, null, 2))

    if (data.code !== 0) {
      console.error('[飞书回调] 获取token失败:', data)
      return NextResponse.redirect(
        new URL(`/feishu-auth?error=${encodeURIComponent(data.msg || data.message || '获取token失败')}`, request.url)
      )
    }

    const { access_token, refresh_token, expires_in } = data.data

    console.log('[飞书回调] ✅ 成功获取 token')
    console.log('[飞书回调] access_token 有效期:', expires_in, '秒')
    console.log('[飞书回调] refresh_token:', refresh_token)

    // 自动更新 Vercel 环境变量（如果在生产环境）
    const currentToken = process.env.FEISHU_REFRESH_TOKEN
    if (refresh_token && refresh_token !== currentToken) {
      console.log('[飞书回调] 检测到新的 refresh_token，准备自动更新...')

      if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_TOKEN) {
        console.log('[飞书回调] 生产环境，触发自动更新...')

        // 异步调用更新 API，不等待结果
        const updateUrl = 'https://content-factory-jade-nine.vercel.app/api/feishu/update-vercel-token'
        fetch(updateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newRefreshToken: refresh_token })
        }).then(res => res.json()).then(result => {
          if (result.success) {
            console.log('[飞书回调] ✅ 自动更新成功')
          } else {
            console.error('[飞书回调] ❌ 自动更新失败:', result.error)
          }
        }).catch(err => {
          console.error('[飞书回调] ❌ 自动更新异常:', err)
        })
      } else {
        console.log('[飞书回调] 非生产环境或未配置 VERCEL_TOKEN，请手动更新')
      }
    } else {
      console.log('[飞书回调] Token 未变化，无需更新')
    }

    // 重定向到结果页面，带上 refresh_token
    const resultUrl = new URL('/feishu-auth', request.url)
    resultUrl.searchParams.set('success', 'true')
    resultUrl.searchParams.set('refresh_token', refresh_token)
    resultUrl.searchParams.set('expires_in', expires_in.toString())

    return NextResponse.redirect(resultUrl)

  } catch (error) {
    console.error('[飞书回调] 处理失败:', error)

    return NextResponse.redirect(
      new URL(`/feishu-auth?error=${encodeURIComponent(error instanceof Error ? error.message : '授权失败')}`, request.url)
    )
  }
}
