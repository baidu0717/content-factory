'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function DebugContent() {
  const searchParams = useSearchParams()

  const allParams: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    allParams[key] = value
  })

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">URL 参数调试</h1>

        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">当前 URL:</h2>
            <code className="block bg-gray-100 p-2 rounded text-sm break-all">
              {typeof window !== 'undefined' ? window.location.href : 'Loading...'}
            </code>
          </div>

          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">接收到的参数:</h2>
            {Object.keys(allParams).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(allParams).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 p-3 rounded">
                    <div className="font-medium text-gray-700">{key}:</div>
                    <div className="text-gray-900 mt-1 break-all">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      长度: {value.length} 字符
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">没有接收到任何参数</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-semibold text-blue-900 mb-2">如何使用:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>修改飞书按钮 URL 为: http://localhost:3000/rewrite/debug?title={'{'}标题{'}'}&content={'{'}正文{'}'}&tags={'{'}话题标签{'}'}</li>
              <li>在飞书表格中点击"去复刻"按钮</li>
              <li>查看这个页面显示的参数</li>
              <li>检查 tags 参数是否存在及其内容</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DebugPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DebugContent />
    </Suspense>
  )
}
