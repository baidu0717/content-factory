import { NextRequest, NextResponse } from 'next/server'

// 飞书 OAuth 配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * GET /api/auth/feishu/callback
 * 飞书 OAuth 授权回调
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    console.log('[飞书授权] 收到回调:', { code: code?.substring(0, 20), state })

    if (!code) {
      return NextResponse.json(
        { success: false, error: '未获取到授权码' },
        { status: 400 }
      )
    }

    // 使用 code 换取 access_token 和 refresh_token
    // 必须包含 app_id 和 app_secret 进行身份验证
    const tokenResponse = await fetch(`${FEISHU_API_URL}/authen/v1/oidc/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        client_id: FEISHU_APP_ID,
        client_secret: FEISHU_APP_SECRET
      })
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.code !== 0) {
      console.error('[飞书授权] 获取token失败:', tokenData)
      return NextResponse.json(
        { success: false, error: `获取token失败: ${tokenData.msg}` },
        { status: 500 }
      )
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      refresh_expires_in
    } = tokenData.data

    console.log('[飞书授权] 授权成功')
    console.log('[飞书授权] access_token 有效期:', expires_in, '秒')
    console.log('[飞书授权] refresh_token 有效期:', refresh_expires_in, '秒')

    // 返回成功页面，显示 refresh_token
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>飞书授权成功</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #00b96b;
            margin-bottom: 20px;
          }
          .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .token-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            word-break: break-all;
            font-family: monospace;
            font-size: 14px;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .steps {
            background: #e7f5ff;
            border-left: 4px solid #1890ff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .steps ol {
            margin: 10px 0 0 0;
            padding-left: 20px;
          }
          .steps li {
            margin: 8px 0;
          }
          button {
            background: #1890ff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
          }
          button:hover {
            background: #096dd9;
          }
          .copied {
            background: #52c41a !important;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>飞书授权成功！</h1>
          <p>已成功获取到长期有效的 refresh_token，现在需要将它配置到 Vercel 环境变量中。</p>

          <div class="warning">
            <strong>⚠️ 重要：</strong>请妥善保管此 token，不要泄露给他人！
          </div>

          <div>
            <strong>Refresh Token：</strong>
            <div class="token-box" id="refreshToken">${refresh_token}</div>
            <button onclick="copyToken()">📋 复制 Token</button>
          </div>

          <div class="steps">
            <strong>📝 接下来的配置步骤：</strong>
            <ol>
              <li>点击上面的"复制 Token"按钮</li>
              <li>打开 Vercel 项目设置：<a href="https://vercel.com/dashboard" target="_blank">Vercel Dashboard</a></li>
              <li>进入你的项目 → Settings → Environment Variables</li>
              <li>添加新的环境变量：
                <ul>
                  <li>Name: <code>FEISHU_REFRESH_TOKEN</code></li>
                  <li>Value: (粘贴刚才复制的 token)</li>
                  <li>Environment: 全选（Production, Preview, Development）</li>
                </ul>
              </li>
              <li>点击 Save 保存</li>
              <li>触发重新部署（Redeploy）</li>
              <li>完成！之后就可以使用快捷指令了</li>
            </ol>
          </div>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            配置完成后，你可以关闭此页面。
          </p>
        </div>

        <script>
          function copyToken() {
            const token = document.getElementById('refreshToken').textContent;
            navigator.clipboard.writeText(token).then(() => {
              const btn = event.target;
              const originalText = btn.textContent;
              btn.textContent = '✅ 已复制！';
              btn.classList.add('copied');
              setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
              }, 2000);
            });
          }
        </script>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (error) {
    console.error('[飞书授权] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '授权失败'
      },
      { status: 500 }
    )
  }
}
