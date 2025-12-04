'use client'

import { useState } from 'react'
import { X, Loader2, CheckCircle, AlertCircle, Send, Image as ImageIcon, QrCode } from 'lucide-react'

interface XiaohongshuPublishModalProps {
  isOpen: boolean
  onClose: () => void
  article: {
    id: number
    title: string
    content: string
    images?: string[]
  }
  onPublishSuccess: () => void
}

interface PublishResult {
  success: boolean
  qrCodeUrl?: string
  publishUrl?: string
  message?: string
  error?: string
}

export default function XiaohongshuPublishModal({
  isOpen,
  onClose,
  article,
  onPublishSuccess,
}: XiaohongshuPublishModalProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)

  const handlePublish = async () => {
    setIsPublishing(true)
    setPublishResult(null)

    try {
      console.log('开始发布到小红书，文章ID:', article.id)

      const response = await fetch('/api/xiaohongshu/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: article.id,
        }),
      })

      const data = await response.json()
      console.log('发布API响应:', data)

      if (data.success) {
        setPublishResult({
          success: true,
          qrCodeUrl: data.data?.qrCodeUrl,
          publishUrl: data.data?.publishUrl,
          message: data.message || '发布成功！请扫描二维码完成发布',
        })

        // 通知父组件发布成功
        onPublishSuccess()
      } else {
        setPublishResult({
          success: false,
          error: data.error || '发布失败',
        })
      }
    } catch (error) {
      console.error('发布失败:', error)
      setPublishResult({
        success: false,
        error: error instanceof Error ? error.message : '发布失败，请稍后重试',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleClose = () => {
    if (!isPublishing) {
      setPublishResult(null)
      onClose()
    }
  }

  // 计算内容预览（纯文本，前100字符）
  const contentPreview = article.content
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '') // 移除图片
    .replace(/[#*_~`]/g, '') // 移除Markdown标记
    .substring(0, 100)

  // 统计图片数量
  const imageCount = article.images?.length || 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
              <span className="text-red-500 font-bold text-lg">小</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">发布到小红书</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isPublishing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4">
          {/* 未发布状态 - 显示文章信息 */}
          {!publishResult && (
            <>
              {/* 文章标题 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章标题
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                  {article.title}
                </div>
              </div>

              {/* 内容预览 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  内容预览
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 line-clamp-3">
                  {contentPreview}...
                </div>
              </div>

              {/* 图片信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  图片
                </label>
                <div className="flex items-center text-sm text-gray-600 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                  <ImageIcon className="w-4 h-4 mr-2 text-gray-400" />
                  {imageCount > 0 ? (
                    <span>包含 {imageCount} 张图片</span>
                  ) : (
                    <span className="text-orange-600">暂无图片（建议添加封面图）</span>
                  )}
                </div>
              </div>

              {/* 发布说明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm text-blue-800 font-medium mb-1">发布说明</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• 文章内容将自动转换为纯文本格式</li>
                      <li>• 图片将作为笔记配图上传</li>
                      <li>• 发布后会生成二维码，请用手机扫码查看</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 发布成功状态 - 显示二维码 */}
          {publishResult?.success && publishResult.qrCodeUrl && (
            <div className="space-y-4">
              {/* 成功提示 */}
              <div className="flex items-start p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-green-800 font-medium">
                    {publishResult.message}
                  </p>
                </div>
              </div>

              {/* 二维码展示 */}
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border-2 border-red-200">
                <div className="flex items-center justify-center mb-4">
                  <QrCode className="w-5 h-5 text-red-600 mr-2" />
                  <h3 className="text-lg font-bold text-red-800">扫码查看笔记</h3>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-lg">
                  <img
                    src={publishResult.qrCodeUrl}
                    alt="小红书笔记二维码"
                    className="w-full h-auto"
                    onError={(e) => {
                      console.error('二维码加载失败:', publishResult.qrCodeUrl)
                      e.currentTarget.src = 'https://via.placeholder.com/300x300.png?text=QR+Code+Error'
                    }}
                  />
                </div>

                <p className="text-center text-sm text-red-700 mt-4">
                  使用小红书APP扫描二维码即可查看发布的笔记
                </p>
              </div>

              {/* 发布链接 */}
              {publishResult.publishUrl && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    发布链接
                  </label>
                  <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 break-all">
                    {publishResult.publishUrl}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 错误提示 */}
          {publishResult?.success === false && (
            <div className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm text-red-800 font-medium mb-1">发布失败</p>
                <p className="text-sm text-red-700">{publishResult.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          {!publishResult?.success && (
            <>
              <button
                onClick={handleClose}
                disabled={isPublishing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    发布中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    确认发布
                  </>
                )}
              </button>
            </>
          )}

          {publishResult?.success && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              完成
            </button>
          )}

          {publishResult?.success === false && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setPublishResult(null)
                  handlePublish()
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 flex items-center transition-colors"
              >
                <Send className="w-4 h-4 mr-2" />
                重试
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
