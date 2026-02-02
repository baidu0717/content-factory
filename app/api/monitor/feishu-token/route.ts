// 飞书 Token 过期监控 API
// 用于检查 refresh_token 是否即将过期，并发送邮件提醒

import { NextRequest, NextResponse } from 'next/server'

const FEISHU_REFRESH_TOKEN = process.env.FEISHU_REFRESH_TOKEN || ''
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 邮件配置
const ALERT_EMAIL = process.env.ALERT_EMAIL || '' // 接收告警的邮箱
const RESEND_API_KEY = process.env.RESEND_API_KEY || '' // Resend API Key

/**
 * GET /api/monitor/feishu-token
 * 检查飞书 refresh_token 状态
 */
export async function GET(req: NextRequest) {
  try {
    // 验证请求来源（防止被恶意调用）
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || 'your-secret-token'

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!FEISHU_REFRESH_TOKEN) {
      return NextResponse.json({
        error: 'FEISHU_REFRESH_TOKEN 未配置',
        status: 'error'
      }, { status: 500 })
    }

    // 尝试刷新 token 以验证是否有效
    const result = await checkTokenValidity()

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[Token Monitor] 检查失败:', error)
    return NextResponse.json({
      error: error.message,
      status: 'error'
    }, { status: 500 })
  }
}

/**
 * 检查 Token 有效性
 */
async function checkTokenValidity() {
  try {
    // 第一步：获取 app_access_token
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
      throw new Error(`获取 app_access_token 失败: ${appTokenData.msg}`)
    }

    const appAccessToken = appTokenData.app_access_token

    // 第二步：尝试刷新 user_access_token
    const refreshResponse = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/refresh_access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: FEISHU_REFRESH_TOKEN
      })
    })

    const refreshData = await refreshResponse.json()

    if (refreshData.code !== 0) {
      // Token 已失效，发送告警邮件
      await sendAlertEmail('EXPIRED')

      return {
        status: 'expired',
        message: 'refresh_token 已失效，请立即更新！',
        error: refreshData.msg || refreshData.message,
        timestamp: new Date().toISOString()
      }
    }

    // Token 有效
    const { expires_in } = refreshData.data
    const daysRemaining = Math.floor(expires_in / 86400) // 转换为天数

    // 如果少于7天，发送提前提醒
    if (daysRemaining <= 7) {
      await sendAlertEmail('WARNING', daysRemaining)
    }

    return {
      status: 'valid',
      message: `Token 有效，剩余 ${daysRemaining} 天`,
      expires_in,
      daysRemaining,
      timestamp: new Date().toISOString()
    }

  } catch (error: any) {
    // 网络错误或其他异常
    await sendAlertEmail('ERROR', 0, error.message)
    throw error
  }
}

/**
 * 发送告警邮件
 */
async function sendAlertEmail(
  alertType: 'EXPIRED' | 'WARNING' | 'ERROR',
  daysRemaining: number = 0,
  errorMessage?: string
) {
  if (!ALERT_EMAIL || !RESEND_API_KEY) {
    console.warn('[Token Monitor] 未配置邮件服务，跳过发送告警')
    return
  }

  let subject = ''
  let html = ''

  switch (alertType) {
    case 'EXPIRED':
      subject = '⚠️ 飞书 Token 已失效 - 需要立即更新'
      html = `
        <h2>⚠️ 飞书 refresh_token 已失效</h2>
        <p>你的飞书 <code>FEISHU_REFRESH_TOKEN</code> 已经过期，内容工厂的飞书功能将无法使用。</p>
        <h3>立即处理步骤：</h3>
        <ol>
          <li>登录飞书开放平台获取新的 refresh_token</li>
          <li>更新本地 <code>.env.local</code> 文件</li>
          <li>更新 Vercel 环境变量 <code>FEISHU_REFRESH_TOKEN</code></li>
          <li>重新部署应用</li>
        </ol>
        <p><strong>检测时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
      `
      break

    case 'WARNING':
      subject = `⏰ 飞书 Token 将在 ${daysRemaining} 天后过期`
      html = `
        <h2>⏰ 飞书 refresh_token 即将过期</h2>
        <p>你的飞书 <code>FEISHU_REFRESH_TOKEN</code> 将在 <strong>${daysRemaining} 天</strong>后过期。</p>
        <h3>建议尽快更新：</h3>
        <ol>
          <li>登录飞书开放平台获取新的 refresh_token</li>
          <li>更新本地 <code>.env.local</code> 文件</li>
          <li>更新 Vercel 环境变量 <code>FEISHU_REFRESH_TOKEN</code></li>
          <li>重新部署应用</li>
        </ol>
        <p><strong>检测时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
      `
      break

    case 'ERROR':
      subject = '❌ 飞书 Token 监控检测失败'
      html = `
        <h2>❌ Token 监控检测失败</h2>
        <p>在检测飞书 Token 状态时发生错误，请手动检查。</p>
        <p><strong>错误信息：</strong></p>
        <pre>${errorMessage || '未知错误'}</pre>
        <p><strong>检测时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
      `
      break
  }

  try {
    // 使用 Resend 发送邮件
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Content Factory Alert <noreply@yourdomain.com>',
        to: ALERT_EMAIL,
        subject,
        html
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[Token Monitor] 发送邮件失败:', error)
    } else {
      console.log('[Token Monitor] 告警邮件已发送')
    }
  } catch (error) {
    console.error('[Token Monitor] 发送邮件异常:', error)
  }
}
