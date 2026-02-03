'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, AlertCircle, ArrowRight } from 'lucide-react'

export default function ManualAuthPage() {
  const [refreshToken, setRefreshToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<string>('')

  const appId = 'cli_a9bac6be07789cc4'
  const appSecret = 'kqcP7odJy9x0AhtNMR5FYg4KPXs5lwRJ'

  // 飞书OAuth授权URL - 用户授权后可以获取code，然后换取refresh_token
  const scope = 'bitable:app'
  const redirectUri = 'http://localhost:3000/api/feishu/auth/callback'
  const feishuOAuthUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=manual`

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdate = async () => {
    if (!refreshToken.trim()) {
      alert('请输入 refresh_token')
      return
    }

    if (!refreshToken.startsWith('ur-')) {
      alert('refresh_token 格式不正确，应该以 ur- 开头')
      return
    }

    setUpdating(true)
    setUpdateResult('')

    try {
      // 调用API更新token
      const response = await fetch('/api/feishu/update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken.trim() })
      })

      const data = await response.json()

      if (data.success) {
        setUpdateResult('✅ Token 更新成功！环境变量已更新，请重启开发服务器。')
        setTimeout(() => {
          window.location.href = '/token-status'
        }, 2000)
      } else {
        setUpdateResult(`❌ 更新失败: ${data.error}`)
      }
    } catch (error) {
      setUpdateResult(`❌ 更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">获取飞书 Refresh Token</h1>
          <p className="text-gray-600">最简单的方式 - 使用飞书 API Explorer</p>
        </div>

        {/* 主要步骤 */}
        <div className="space-y-6">
          {/* 步骤1 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-3">
                1
              </div>
              <h2 className="text-xl font-bold text-gray-900">准备你的应用凭证</h2>
            </div>

            <div className="space-y-3 ml-11">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">App ID:</span>
                  <button
                    onClick={() => copyText(appId)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code className="block bg-white p-2 rounded border text-sm">{appId}</code>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">App Secret:</span>
                  <button
                    onClick={() => copyText(appSecret)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code className="block bg-white p-2 rounded border text-sm">{appSecret}</code>
              </div>
            </div>
          </div>

          {/* 步骤2 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold mr-3">
                2
              </div>
              <h2 className="text-xl font-bold text-gray-900">使用飞书 API 调试工具</h2>
            </div>

            <div className="ml-11 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">使用官方API调试工具获取 refresh_token</p>
                    <p>这是最简单的方法，不需要配置 redirect_uri</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* 方法1: 配置redirect_uri后使用 */}
                <div>
                  <a
                    href={feishuOAuthUrl}
                    className="block w-full"
                  >
                    <button className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center justify-center text-lg font-semibold">
                      <ExternalLink className="w-6 h-6 mr-2" />
                      方法1: 一键授权获取 (推荐)
                      <ArrowRight className="w-6 h-6 ml-2" />
                    </button>
                  </a>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    需要先配置 redirect_uri，否则会报错
                  </p>
                </div>

                {/* 方法2: 使用API Explorer */}
                <div>
                  <a
                    href="https://open.feishu.cn/api-explorer/cli_a9bac6be07789cc4?apiName=authorize&project=authen&resource=authen&version=v1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <button className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center justify-center text-lg font-semibold">
                      <ExternalLink className="w-6 h-6 mr-2" />
                      方法2: 使用 API Explorer
                      <ArrowRight className="w-6 h-6 ml-2" />
                    </button>
                  </a>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    无需配置，但步骤稍多
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">在 API Explorer 中的操作:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                  <li>页面会自动打开 "刷新access_token" 接口</li>
                  <li>点击右上角的 <strong>"获取调试用户授权"</strong></li>
                  <li>登录你的飞书账号并授权</li>
                  <li>授权成功后，在返回结果中找到 <code className="bg-blue-100 px-1 rounded">refresh_token</code></li>
                  <li>复制 refresh_token 的值（以 <code className="bg-blue-100 px-1 rounded">ur-</code> 开头）</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 步骤3 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold mr-3">
                3
              </div>
              <h2 className="text-xl font-bold text-gray-900">输入获取到的 Refresh Token</h2>
            </div>

            <div className="ml-11 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Token (以 ur- 开头):
                </label>
                <input
                  type="text"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="ur-xxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <button
                onClick={handleUpdate}
                disabled={updating || !refreshToken.trim()}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {updating ? '更新中...' : '更新 Token'}
              </button>

              {updateResult && (
                <div className={`p-4 rounded-lg ${
                  updateResult.startsWith('✅')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {updateResult}
                </div>
              )}
            </div>
          </div>

          {/* 手动更新说明 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">或者手动更新 .env.local 文件:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>打开项目根目录的 <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> 文件</li>
              <li>找到 <code className="bg-gray-100 px-2 py-1 rounded">FEISHU_REFRESH_TOKEN=</code> 这一行</li>
              <li>将等号后面的值替换为你获取到的 refresh_token</li>
              <li>保存文件</li>
              <li>重启开发服务器: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
