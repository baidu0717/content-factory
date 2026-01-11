'use client'

import { useState } from 'react'
import { Link as LinkIcon, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function GenerateLinksPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/feishu/generate-rewrite-links', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
      } else {
        setError(data.error || '生成失败')
      }
    } catch (err) {
      console.error('生成链接失败:', err)
      setError('网络错误，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* 返回按钮 */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回首页
        </Link>

        {/* 标题区域 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <LinkIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                生成复刻链接
              </h1>
              <p className="text-sm text-gray-600">
                为飞书表格中的所有笔记自动生成复刻链接
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              📝 功能说明
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 读取飞书表格中所有笔记记录</li>
              <li>• 自动生成包含标题、正文、标签的复刻URL</li>
              <li>• 将生成的链接写入"复刻链接"字段</li>
              <li>• 点击链接即可跳转并自动填充数据</li>
            </ul>
          </div>

          {/* 生成按钮 */}
          {!result && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>正在生成链接...</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-5 h-5" />
                  <span>开始生成</span>
                </>
              )}
            </button>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-900 mb-1">
                  生成失败
                </h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* 成功结果 */}
          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-900 mb-1">
                    生成完成！
                  </h3>
                  <p className="text-sm text-green-700">
                    已成功为飞书表格生成复刻链接
                  </p>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {result.total}
                  </div>
                  <div className="text-sm text-gray-600">总记录数</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {result.success}
                  </div>
                  <div className="text-sm text-gray-600">成功生成</div>
                </div>

                {result.skipped > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                      {result.skipped}
                    </div>
                    <div className="text-sm text-gray-600">跳过（数据不完整）</div>
                  </div>
                )}

                {result.failed > 0 && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {result.failed}
                    </div>
                    <div className="text-sm text-gray-600">生成失败</div>
                  </div>
                )}
              </div>

              {/* 操作提示 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  ✅ 下一步操作
                </h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>打开飞书多维表格</li>
                  <li>查看"复刻链接"列，每行都应该有链接</li>
                  <li>点击任意链接，会自动跳转到复刻页面</li>
                  <li>标题、正文、标签会自动填充</li>
                  <li>点击"一键改写"即可开始复刻</li>
                </ol>
              </div>

              {/* 重新生成按钮 */}
              <button
                onClick={() => {
                  setResult(null)
                  setError('')
                }}
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                重新生成
              </button>
            </div>
          )}
        </div>

        {/* 注意事项 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            ⚠️ 注意事项
          </h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• 生成过程可能需要几分钟，请耐心等待</li>
            <li>• 只会为有标题和正文的记录生成链接</li>
            <li>• 如果表格中有新记录，可以再次运行生成</li>
            <li>• 生成的链接会覆盖原有的"复刻链接"字段内容</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
