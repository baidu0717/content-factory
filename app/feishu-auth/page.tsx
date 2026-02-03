'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function FeishuAuthContent() {
  const searchParams = useSearchParams()
  const [authUrl, setAuthUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const success = searchParams.get('success')
  const refreshToken = searchParams.get('refresh_token')
  const expiresIn = searchParams.get('expires_in')
  const error = searchParams.get('error')

  // 获取授权链接
  const getAuthUrl = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/feishu/auth/url')
      const data = await response.json()

      if (data.success) {
        setAuthUrl(data.data.authUrl)
        // 自动跳转到飞书授权页面
        window.location.href = data.data.authUrl
      } else {
        alert(`获取授权链接失败: ${data.error}`)
      }
    } catch (err) {
      alert(`请求失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 复制 token 到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('复制失败，请手动复制')
    }
  }

  // 如果已经有授权成功的结果，显示成功页面
  if (success && refreshToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">授权成功！</h1>
            <p className="text-gray-600">已成功获取新的 Refresh Token</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">新的 REFRESH_TOKEN：</h2>
              <button
                onClick={() => copyToClipboard(refreshToken)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {copied ? '✓ 已复制' : '复制'}
              </button>
            </div>
            <code className="block bg-white p-4 rounded border border-gray-200 text-sm break-all font-mono text-gray-800">
              {refreshToken}
            </code>
            {expiresIn && (
              <p className="text-xs text-gray-500 mt-2">
                Access Token 有效期: {expiresIn} 秒 (约 {Math.round(Number(expiresIn) / 3600)} 小时)
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              接下来的步骤：
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>复制上面的 token（点击"复制"按钮）</li>
              <li>打开项目根目录的 <code className="bg-blue-100 px-1 rounded">.env.local</code> 文件</li>
              <li>找到 <code className="bg-blue-100 px-1 rounded">FEISHU_REFRESH_TOKEN=</code> 这一行</li>
              <li>将旧的 token 替换为新的 token</li>
              <li>保存文件，重启开发服务器（如果正在运行）</li>
            </ol>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              重要提示：
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
              <li>Refresh Token 有效期通常为 30 天</li>
              <li>当 token 过期时，重新访问此页面进行授权</li>
              <li>建议将此页面加入浏览器书签</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // 如果有错误，显示错误页面
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">授权失败</h1>
            <p className="text-gray-600 mb-4">{decodeURIComponent(error)}</p>
            <button
              onClick={() => window.location.href = '/feishu-auth'}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 默认：显示开始授权页面
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">飞书授权</h1>
          <p className="text-gray-600">获取新的 Refresh Token</p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">为什么需要授权？</h3>
          <p className="text-sm text-blue-800">
            应用需要访问您的飞书多维表格数据。Refresh Token 用于定期刷新访问令牌，有效期通常为 30 天。
          </p>
        </div>

        <button
          onClick={getAuthUrl}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在跳转...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              开始授权
            </>
          )}
        </button>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>点击后将跳转到飞书授权页面</p>
          <p className="mt-1">请使用有权限访问多维表格的账号登录</p>
        </div>
      </div>
    </div>
  )
}

export default function FeishuAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <FeishuAuthContent />
    </Suspense>
  )
}
