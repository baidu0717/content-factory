'use client'

import { useEffect, useState } from 'react'

export default function AuthPage() {
  const [appId, setAppId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 从环境变量读取 APP_ID（通过 API）
    fetch('/api/auth/config')
      .then((res) => res.json())
      .then((data) => {
        setAppId(data.appId)
        setLoading(false)
      })
      .catch((err) => {
        console.error('获取配置失败:', err)
        setLoading(false)
      })
  }, [])

  const handleAuth = () => {
    if (!appId) {
      alert('应用ID未配置')
      return
    }

    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback`)
    const scope = 'bitable:app'
    const authUrl = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}`

    window.location.href = authUrl
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">飞书授权</h1>
          <p className="text-gray-600">
            需要授权才能创建和管理飞书多维表格
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">为什么需要授权？</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 创建多维表格（您将是表格所有者）</li>
              <li>• 添加和更新记录</li>
              <li>• 上传图片附件</li>
            </ul>
          </div>

          <button
            onClick={handleAuth}
            disabled={loading || !appId}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>加载中...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>开始授权</span>
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            授权后将跳转到飞书登录页面，<br />
            登录并同意授权后将自动返回
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <a
            href="/collect"
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回采集页面
          </a>
        </div>
      </div>
    </div>
  )
}
