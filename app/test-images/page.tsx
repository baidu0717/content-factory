'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, ExternalLink } from 'lucide-react'

interface ImageField {
  file_token: string
  name: string
  size: number
  url: string
  tmp_url: string
  type: string
}

interface Record {
  record_id: string
  fields: {
    笔记链接?: string
    标题?: string
    封面?: ImageField[]
    图片2?: ImageField[]
    后续图片?: ImageField[]
  }
}

export default function TestImagesPage() {
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchRecords = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/feishu/get-records')
      const data = await response.json()

      if (data.success) {
        setRecords(data.data.records)
      } else {
        setError(data.error || '获取失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">飞书表格图片测试</h1>
            <p className="text-gray-600 mt-1">查看图片是否正常上传</p>
          </div>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* 记录列表 */}
        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">加载中...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {records.map((record) => (
              <div key={record.record_id} className="bg-white rounded-lg shadow-lg p-6">
                {/* 标题和链接 */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {record.fields.标题 || '无标题'}
                  </h3>
                  {record.fields.笔记链接 && (
                    <a
                      href={record.fields.笔记链接}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      查看原笔记
                    </a>
                  )}
                </div>

                {/* 图片展示 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 封面 */}
                  <ImageCard
                    title="封面"
                    images={record.fields.封面}
                  />

                  {/* 图片2 */}
                  <ImageCard
                    title="图片2"
                    images={record.fields.图片2}
                  />

                  {/* 后续图片 */}
                  <ImageCard
                    title="后续图片"
                    images={record.fields.后续图片}
                  />
                </div>
              </div>
            ))}

            {records.length === 0 && !loading && (
              <div className="text-center py-20 text-gray-500">
                暂无记录
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ImageCard({ title, images }: { title: string; images?: ImageField[] }) {
  if (!images || images.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-700 mb-2">{title}</h4>
        <div className="aspect-square bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">
          无图片
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="space-y-2">
        {images.map((img, index) => (
          <div key={index} className="space-y-2">
            <div className="aspect-square bg-gray-100 rounded overflow-hidden">
              <img
                src={`/api/feishu/proxy-image?file_token=${img.file_token}`}
                alt={img.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = `https://via.placeholder.com/300x300/e5e7eb/6b7280?text=加载失败`
                }}
              />
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>大小:</span>
                <span>{(img.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Token:</span>
                <code className="text-xs bg-gray-100 px-1 rounded">
                  {img.file_token.substring(0, 10)}...
                </code>
              </div>
              <a
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline text-center"
              >
                下载原图
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
