'use client'

import { useState } from 'react'
import { X, Loader2, CheckCircle, AlertCircle, Send, Image as ImageIcon, QrCode, ExternalLink, Copy, Check } from 'lucide-react'

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
  const [copied, setCopied] = useState(false)

  const handleCopyContent = () => {
    const textToCopy = `${article.title}\n\n${article.content}`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
      console.log('二维码URL:', data.data?.qrCodeUrl)

      if (data.success) {
        const result = {
          success: true,
          qrCodeUrl: data.data?.qrCodeUrl,
          publishUrl: data.data?.publishUrl,
          message: data.message || '发布成功！请扫描二维码完成发布',
        }
        console.log('设置publishResult:', result)
        setPublishResult(result)

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
                    <p className="text-sm text-blue-800 font-medium mb-2">💡 两种发布方式</p>

                    <div className="mb-3">
                      <p className="text-xs font-semibold text-blue-900 mb-1">方式1：API自动发布（需要积分）</p>
                      <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside ml-2">
                        <li>点击下方"确认发布"按钮</li>
                        <li>系统自动创建笔记并生成二维码</li>
                        <li>用小红书APP扫码完成发布</li>
                      </ol>
                      <p className="text-xs text-orange-600 mt-1 ml-2">⚠️ 每次发布消耗1个积分</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-green-900 mb-1">方式2：网页手动发布（免费）</p>
                      <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside ml-2">
                        <li>点击下方"打开发布网页"按钮</li>
                        <li>手动复制粘贴内容到网页</li>
                        <li>在网页上点击"小红书扫码发布"</li>
                        <li>用小红书APP扫码完成发布</li>
                      </ol>
                      <p className="text-xs text-green-600 mt-1 ml-2">✅ 完全免费，无需积分</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 复制内容按钮 */}
              <button
                onClick={handleCopyContent}
                className="flex items-center justify-center w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    已复制内容！
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    复制文章内容
                  </>
                )}
              </button>

              {/* 网页发布按钮 */}
              <a
                href="https://note.limyai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                打开发布网页（免费，推荐）
              </a>
            </>
          )}

          {/* 发布成功状态 - 显示二维码 */}
          {publishResult?.success && publishResult.qrCodeUrl && (
            <div className="space-y-4">
              {/* 成功提示 */}
              <div className="flex items-start p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    ✅ 笔记已创建成功！
                  </p>
                  <p className="text-xs text-green-700">
                    请继续下面的步骤，用小红书APP扫码完成发布
                  </p>
                </div>
              </div>

              {/* 二维码展示 */}
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border-2 border-red-200">
                <div className="flex items-center justify-center mb-4">
                  <QrCode className="w-5 h-5 text-red-600 mr-2" />
                  <h3 className="text-lg font-bold text-red-800">📱 扫码完成发布</h3>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-lg space-y-4">
                  {/* 重要提示 */}
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xl font-bold">!</span>
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <p className="text-base font-bold text-red-800 mb-2">
                          ⚠️ 必须使用小红书APP扫码
                        </p>
                        <div className="text-sm text-red-700 space-y-1">
                          <p>❌ 不要用微信扫一扫</p>
                          <p>❌ 不要用其他扫码工具</p>
                          <p className="font-semibold text-red-900 mt-2">✅ 请打开小红书APP，使用APP内的扫一扫功能</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 二维码显示 - 使用iframe加载外部页面 */}
                  <div className="flex justify-center py-4">
                    <div className="relative w-full">
                      <div className="bg-white rounded-xl shadow-md border-4 border-red-200 overflow-hidden">
                        <iframe
                          src={publishResult.qrCodeUrl}
                          title="小红书发布二维码"
                          className="w-full h-[600px] border-0"
                          sandbox="allow-scripts allow-same-origin allow-forms"
                        />
                      </div>
                      {/* 小红书logo标识 */}
                      <div className="absolute -top-3 -right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                        小红书专用
                      </div>
                    </div>
                  </div>

                  {/* 操作步骤 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-bold text-blue-900 mb-3">📱 正确的发布流程：</p>
                    <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                      <li>打开<strong>小红书APP</strong></li>
                      <li>点击右上角"<strong>扫一扫</strong>"（或点击"<strong>我</strong>" → "<strong>扫一扫</strong>"）</li>
                      <li>扫描上方二维码</li>
                      <li>跳转到<strong>小程序发布页面</strong></li>
                      <li>点击"<strong>发布</strong>"按钮完成</li>
                    </ol>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      扫码后会自动跳转到小红书小程序中，在小程序内即可完成发布
                    </p>
                  </div>

                  {/* 可选：在浏览器中打开链接 */}
                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      高级选项：在浏览器中打开
                    </summary>
                    <div className="mt-2">
                      <a
                        href={publishResult.qrCodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full px-4 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors border border-gray-300 rounded-lg hover:border-red-300"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        在浏览器中打开链接
                      </a>
                    </div>
                  </details>
                </div>
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
                <p className="text-sm text-red-800 font-medium mb-2">发布失败</p>
                <p className="text-sm text-red-700 mb-3">{publishResult.error}</p>

                {/* 积分不足特殊提示 */}
                {publishResult.error?.includes('积分') && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-medium mb-2">💡 如何获取积分：</p>
                    <ol className="text-xs text-yellow-700 space-y-2 list-decimal list-inside">
                      <li>访问 <a href="https://note.limyai.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">note.limyai.com</a></li>
                      <li>登录你的账户（使用你的API Key对应的账号）</li>
                      <li>查找"设置"或"账户"页面</li>
                      <li>查看积分余额和充值选项</li>
                      <li>如果找不到充值入口，请联系客服或技术支持</li>
                    </ol>
                    <div className="mt-3 p-2 bg-white border border-yellow-300 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>提示：</strong>测试阶段每次调用API会扣除1积分。你也可以使用下方的"网页手动发布"功能，完全免费。
                      </p>
                    </div>
                  </div>
                )}
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
