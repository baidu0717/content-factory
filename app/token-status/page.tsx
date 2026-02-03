'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface TokenStatus {
  success: boolean
  status?: 'valid' | 'expired' | 'error'
  message?: string
  tokenPreview?: string
  needReauth?: boolean
  authUrl?: string
}

export default function TokenStatusPage() {
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const checkToken = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/feishu/token-status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : '检查失败'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkToken()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">飞书 Token 状态</h1>
          <p className="text-gray-600">检查和管理飞书授权状态</p>
        </div>

        {/* 状态卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">正在检查 Token 状态...</p>
            </div>
          ) : status ? (
            <div>
              {/* 状态图标和标题 */}
              <div className="flex items-center mb-6">
                {status.success ? (
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Token 正常</h2>
                      <p className="text-gray-600">当前授权有效，可以正常使用</p>
                    </div>
                  </div>
                ) : status.status === 'expired' ? (
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Token 已过期</h2>
                      <p className="text-gray-600">需要重新授权</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">检查失败</h2>
                      <p className="text-gray-600">无法验证 Token 状态</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 详细信息 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">状态:</span>
                    <span className={`font-medium ${
                      status.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {status.success ? '✓ 有效' : '✗ 失效'}
                    </span>
                  </div>
                  {status.message && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">消息:</span>
                      <span className="font-medium text-gray-900">{status.message}</span>
                    </div>
                  )}
                  {status.tokenPreview && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Token:</span>
                      <code className="font-mono text-xs text-gray-700">{status.tokenPreview}</code>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">检查时间:</span>
                    <span className="font-medium text-gray-700">
                      {new Date().toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={checkToken}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  重新检查
                </button>

                {status.needReauth && status.authUrl && (
                  <a
                    href={status.authUrl}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    立即授权
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              暂无数据
            </div>
          )}
        </div>

        {/* 快捷链接 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">快捷操作</h3>
          <div className="space-y-3">
            <a
              href="/feishu-auth"
              className="block w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">重新授权</div>
              <div className="text-sm text-gray-500">获取新的 Refresh Token</div>
            </a>
            <a
              href="/"
              className="block w-full px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">返回首页</div>
              <div className="text-sm text-gray-500">回到主页面</div>
            </a>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 提示</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Refresh Token 通常有效期为 30 天</li>
            <li>• 当 Token 过期时会自动跳转到授权页面</li>
            <li>• 建议将此页面加入书签，方便快速检查</li>
            <li>• 授权链接: <code className="bg-blue-100 px-1 rounded">/feishu-auth</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
