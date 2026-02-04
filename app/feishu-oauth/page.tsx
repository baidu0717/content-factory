'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Copy, RefreshCw } from 'lucide-react'

export default function FeishuOAuthPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  // 从URL中获取code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authCode = params.get('code')
    if (authCode) {
      setCode(authCode)
      exchangeCode(authCode)
    }
  }, [])

  const exchangeCode = async (authCode: string) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/feishu/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || '获取失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  const startAuth = () => {
    const appId = 'cli_a9bac6be07789cc4'
    const redirectUri = encodeURIComponent(`${window.location.origin}/feishu-oauth`)
    const authUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&scope=bitable:app`
    window.location.href = authUrl
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    alert('已复制到剪贴板')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">飞书OAuth授权</h1>

          {!code && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">授权说明</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 点击下方按钮进行飞书授权</li>
                  <li>• 授权成功后会自动获取 refresh_token</li>
                  <li>• 复制 refresh_token 更新到环境变量</li>
                </ul>
              </div>

              <button
                onClick={startAuth}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                开始授权
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">正在获取 refresh_token...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-red-800">{error}</div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-green-800">授权成功!</div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Refresh Token (复制此token)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={result.refresh_token}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToken(result.refresh_token)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      复制
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2">下一步操作:</h4>
                  <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
                    <li>复制上面的 refresh_token</li>
                    <li>更新 .env.local 文件中的 FEISHU_REFRESH_TOKEN</li>
                    <li>重启本地开发服务器</li>
                  </ol>
                </div>

                {result.user_info && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      用户信息
                    </label>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                      <div><span className="text-gray-600">用户名:</span> {result.user_info.name}</div>
                      <div><span className="text-gray-600">邮箱:</span> {result.user_info.email}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
