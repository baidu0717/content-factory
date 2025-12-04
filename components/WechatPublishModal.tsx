'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle, AlertCircle, Send } from 'lucide-react'
import { getWechatAccounts, publishToWechat } from '@/lib/wechat-publish-api'
import type { WechatAccount, ArticleType } from '@/types/wechat-publish'

interface WechatPublishModalProps {
  isOpen: boolean
  onClose: () => void
  article: {
    id: number
    title: string
    content: string
  }
  onPublishSuccess: () => void
}

export default function WechatPublishModal({
  isOpen,
  onClose,
  article,
  onPublishSuccess,
}: WechatPublishModalProps) {
  const [accounts, setAccounts] = useState<WechatAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [articleType, setArticleType] = useState<ArticleType>('news')
  const [isLoading, setIsLoading] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishResult, setPublishResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // 加载公众号列表
  useEffect(() => {
    if (isOpen) {
      loadAccounts()
    }
  }, [isOpen])

  const loadAccounts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getWechatAccounts()
      if (response.success) {
        setAccounts(response.data.accounts)
        // 默认选择第一个公众号
        if (response.data.accounts.length > 0) {
          setSelectedAccount(response.data.accounts[0].wechatAppid)
        }
      } else {
        setError(response.error || '获取公众号列表失败')
      }
    } catch (err) {
      setError('获取公众号列表失败')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedAccount) {
      setError('请选择要发布的公众号')
      return
    }

    setIsPublishing(true)
    setError(null)
    setPublishResult(null)

    try {
      const response = await publishToWechat({
        wechatAppid: selectedAccount,
        title: article.title,
        content: article.content,
        contentFormat: 'markdown',
        articleType: articleType,
      })

      if (response.success) {
        setPublishResult({
          success: true,
          message: response.data?.message || '发布成功！',
        })
        // 延迟关闭弹窗，让用户看到成功提示
        setTimeout(() => {
          onPublishSuccess()
          handleClose()
        }, 2000)
      } else {
        setError(response.error || '发布失败')
        setPublishResult({
          success: false,
          message: response.error || '发布失败',
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '发布失败'
      setError(errorMsg)
      setPublishResult({
        success: false,
        message: errorMsg,
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleClose = () => {
    if (!isPublishing) {
      setSelectedAccount('')
      setArticleType('news')
      setError(null)
      setPublishResult(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">发布到公众号</h2>
          <button
            onClick={handleClose}
            disabled={isPublishing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-4 space-y-4">
          {/* 文章标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              文章标题
            </label>
            <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
              {article.title}
            </p>
          </div>

          {/* 公众号选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择公众号
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">加载中...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                暂无可用公众号
              </div>
            ) : (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                disabled={isPublishing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accounts.map((account) => (
                  <option key={account.wechatAppid} value={account.wechatAppid}>
                    {account.name} ({account.username})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 发布类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              发布类型
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="articleType"
                  value="news"
                  checked={articleType === 'news'}
                  onChange={(e) => setArticleType(e.target.value as ArticleType)}
                  disabled={isPublishing}
                  className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">
                  普通文章
                  <span className="text-xs text-gray-500 ml-1">
                    (支持富文本格式)
                  </span>
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="articleType"
                  value="newspic"
                  checked={articleType === 'newspic'}
                  onChange={(e) => setArticleType(e.target.value as ArticleType)}
                  disabled={isPublishing}
                  className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">
                  小绿书
                  <span className="text-xs text-gray-500 ml-1">
                    (图文消息，需包含图片)
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="ml-2 text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* 成功提示 */}
          {publishResult?.success && (
            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="ml-2 text-sm text-green-700">
                {publishResult.message}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || accounts.length === 0 || !selectedAccount}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                发布中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                发布
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
