'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

export default function RewriteFromFeishu() {
  const router = useRouter()
  const [recordId, setRecordId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!recordId.trim()) {
      setError('请输入记录ID')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // 从飞书获取记录数据
      const response = await fetch(
        `/api/feishu/get-record?record_id=${encodeURIComponent(recordId.trim())}`
      )

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '获取数据失败')
        setIsLoading(false)
        return
      }

      const { title, content, tags } = result.data

      // 构建URL参数
      const params = new URLSearchParams()
      if (title) params.append('title', title)
      if (content) params.append('content', content)
      if (tags) params.append('tags', tags)

      // 跳转到复刻页面
      router.push(`/rewrite?${params.toString()}`)

    } catch (err) {
      console.error('获取数据失败:', err)
      setError('网络错误，请重试')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            从飞书复刻笔记
          </h1>
          <p className="text-gray-600">
            输入飞书记录ID，自动加载笔记内容
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              飞书记录ID
            </label>
            <input
              type="text"
              value={recordId}
              onChange={(e) => {
                setRecordId(e.target.value)
                setError('')
              }}
              placeholder="例如: recxxxxxx"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-gray-500">
              💡 提示：在飞书表格中，右键点击某一行 → 复制链接，链接中包含记录ID
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !recordId.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>获取数据中...</span>
              </>
            ) : (
              <>
                <span>加载并复刻</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            📖 如何获取记录ID？
          </h3>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>在飞书多维表格中，找到要复刻的笔记</li>
            <li>右键点击该行 → 选择"复制链接"</li>
            <li>粘贴到浏览器地址栏，找到 <code className="bg-gray-100 px-1 rounded">record_id=</code> 后面的值</li>
            <li>复制这个ID，粘贴到上方输入框</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
