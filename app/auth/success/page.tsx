'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

// 禁用静态生成，因为使用了 useSearchParams
export const dynamic = 'force-dynamic'

function AuthSuccessContent() {
  const searchParams = useSearchParams()
  const refreshToken = searchParams.get('refresh_token') || ''
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`FEISHU_REFRESH_TOKEN=${refreshToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">授权成功！</h1>
          <p className="text-gray-600">
            现在需要将 refresh_token 添加到环境变量中
          </p>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">复制 Refresh Token</h3>
                <div className="bg-white border border-blue-300 rounded p-3 mb-3">
                  <code className="text-sm text-gray-800 break-all">
                    FEISHU_REFRESH_TOKEN={refreshToken}
                  </code>
                </div>
                <button
                  onClick={handleCopy}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-2"
                >
                  {copied ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>已复制!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>复制到剪贴板</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">更新环境变量</h3>
                <p className="text-sm text-orange-800 mb-3">
                  打开项目根目录的 <code className="bg-white px-2 py-1 rounded">.env.local</code> 文件，
                  将上面复制的内容粘贴进去（如果已有 FEISHU_REFRESH_TOKEN，请替换）
                </p>
                <div className="bg-white border border-orange-300 rounded p-3 text-sm text-gray-700">
                  <p className="font-mono mb-1"># 项目根目录/.env.local</p>
                  <p className="font-mono text-gray-500">FEISHU_APP_ID=...</p>
                  <p className="font-mono text-gray-500">FEISHU_APP_SECRET=...</p>
                  <p className="font-mono text-orange-600">FEISHU_REFRESH_TOKEN={refreshToken.substring(0, 30)}...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-2">重启开发服务器</h3>
                <p className="text-sm text-purple-800 mb-3">
                  在终端中停止当前服务器（Ctrl+C），然后重新启动：
                </p>
                <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-sm">
                  npm run dev
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">完成！</h3>
                <p className="text-sm text-green-800 mb-3">
                  重启后即可使用飞书多维表格功能
                </p>
                <a
                  href="/collect"
                  className="inline-flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>前往采集页面</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            <strong>重要提示：</strong>refresh_token 是敏感信息，请勿分享给他人。
            <br />
            Token 会自动刷新，无需手动更新。
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <AuthSuccessContent />
    </Suspense>
  )
}
