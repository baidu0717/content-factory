'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react'

export default function GetTokenPage() {
  const [copied, setCopied] = useState(false)

  const appId = process.env.NEXT_PUBLIC_FEISHU_APP_ID || 'cli_a9bac6be07789cc4'

  // 飞书开放平台的授权URL - 不需要配置redirect_uri
  const manualAuthUrl = `https://open.feishu.cn/app/${appId}`

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">获取飞书 Refresh Token</h1>
          <p className="text-gray-600">手动获取 Token 的简单方法</p>
        </div>

        {/* 主要内容 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">为什么需要手动获取？</h2>
            </div>
            <p className="text-gray-600">
              自动授权流程需要在飞书开放平台配置 redirect_uri 白名单。如果你遇到 "redirect_uri 请求不合法" 错误，可以使用这个手动方法。
            </p>
          </div>

          {/* 步骤 */}
          <div className="space-y-6">
            {/* 步骤1 */}
            <div className="border-l-4 border-blue-600 pl-4">
              <h3 className="font-bold text-gray-900 mb-2">步骤 1: 打开飞书开放平台</h3>
              <a
                href={manualAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                打开飞书开放平台
              </a>
            </div>

            {/* 步骤2 */}
            <div className="border-l-4 border-green-600 pl-4">
              <h3 className="font-bold text-gray-900 mb-2">步骤 2: 获取 Refresh Token</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>在飞书开放平台找到你的应用</li>
                <li>进入 <strong>权限管理</strong> → <strong>用户数据权限</strong></li>
                <li>确保已开启 <code className="bg-gray-100 px-2 py-1 rounded">bitable:app</code> 权限</li>
                <li>进入 <strong>凭证与基础信息</strong></li>
                <li>找到 <strong>用户凭证</strong> 部分</li>
                <li>点击 <strong>获取用户 refresh_token</strong></li>
                <li>登录并授权</li>
                <li>复制获得的 refresh_token</li>
              </ol>
            </div>

            {/* 步骤3 */}
            <div className="border-l-4 border-purple-600 pl-4">
              <h3 className="font-bold text-gray-900 mb-3">步骤 3: 更新环境变量</h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">在 .env.local 中添加/更新：</span>
                  <button
                    onClick={() => copyText('FEISHU_REFRESH_TOKEN=你的refresh_token')}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                  >
                    {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <code className="block bg-white p-3 rounded border border-gray-200 text-sm font-mono text-gray-800">
                  FEISHU_REFRESH_TOKEN=你的refresh_token
                </code>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                <li>打开项目根目录的 <code className="bg-gray-100 px-1 rounded">.env.local</code> 文件</li>
                <li>找到 <code className="bg-gray-100 px-1 rounded">FEISHU_REFRESH_TOKEN=</code> 这一行</li>
                <li>将旧的 token 替换为新的 token</li>
                <li>保存文件</li>
              </ol>
            </div>

            {/* 步骤4 */}
            <div className="border-l-4 border-orange-600 pl-4">
              <h3 className="font-bold text-gray-900 mb-2">步骤 4: 重启服务器</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="block text-sm font-mono text-gray-800">
                  # 停止当前服务器 (Ctrl+C)<br />
                  # 然后重新启动<br />
                  npm run dev
                </code>
              </div>
            </div>

            {/* 步骤5 */}
            <div className="border-l-4 border-teal-600 pl-4">
              <h3 className="font-bold text-gray-900 mb-2">步骤 5: 验证 Token</h3>
              <a
                href="/token-status"
                className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                检查 Token 状态 →
              </a>
            </div>
          </div>
        </div>

        {/* 额外提示 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            重要提示
          </h3>
          <ul className="space-y-2 text-sm text-yellow-800">
            <li>• Refresh Token 有效期约 30 天，过期后需要重新获取</li>
            <li>• 不要将 Token 提交到 Git 仓库（.env.local 已在 .gitignore 中）</li>
            <li>• 生产环境需要在 Vercel Dashboard 中配置环境变量</li>
            <li>• 建议将此页面加入书签，方便下次使用</li>
          </ul>
        </div>

        {/* 自动授权配置说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">想要使用自动授权？</h3>
          <p className="text-sm text-blue-800 mb-3">
            如果想使用自动授权流程（/feishu-auth），需要在飞书开放平台配置 redirect_uri：
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>访问 <a href="https://open.feishu.cn/app" target="_blank" className="underline">飞书开放平台</a></li>
            <li>进入应用 → 安全设置 → 重定向URL</li>
            <li>添加：<code className="bg-blue-100 px-2 py-1 rounded text-xs">http://localhost:3000/api/feishu/auth/callback</code></li>
            <li>生产环境还需添加：<code className="bg-blue-100 px-2 py-1 rounded text-xs">https://你的域名/api/feishu/auth/callback</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
