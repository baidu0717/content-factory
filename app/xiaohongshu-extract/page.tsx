'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  Loader2,
  Link as LinkIcon,
  Image as ImageIcon,
  User,
  Calendar,
  Heart,
  MessageCircle,
  Hash,
  FileText,
  CheckCircle,
  ArrowRight,
  Trash2,
  ExternalLink,
  Database,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from '@/components/GlassCard'

// 小红书笔记数据类型
interface XiaohongshuNote {
  title: string
  desc: string
  images: string[]
  user: {
    nickname: string
    avatar: string
  }
  interactInfo: {
    likedCount: string
    collectedCount: string
    commentCount: string
  }
  tagList: Array<{ name: string }>
  time: number
  url: string
}

// 采集历史记录类型
interface HistoryItem {
  id: string
  title: string
  url: string
  timestamp: number
  savedToFeishu: boolean
}

export default function XiaohongshuExtractPage() {
  const router = useRouter()

  // 状态管理
  const [inputUrl, setInputUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSavingToFeishu, setIsSavingToFeishu] = useState(false)
  const [extractedData, setExtractedData] = useState<XiaohongshuNote | null>(null)
  const [error, setError] = useState('')
  const [savedToFeishu, setSavedToFeishu] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])

  // 飞书登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingLogin, setIsCheckingLogin] = useState(true)

  // 飞书表格配置
  const [appToken, setAppToken] = useState('')
  const [tableId, setTableId] = useState('')

  // 从 localStorage 加载历史记录
  useEffect(() => {
    const savedHistory = localStorage.getItem('xiaohongshu_extract_history')
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (e) {
        console.error('加载历史记录失败:', e)
      }
    }

    // 加载飞书表格配置
    const savedAppToken = localStorage.getItem('feishu_app_token')
    const savedTableId = localStorage.getItem('feishu_table_id')
    if (savedAppToken) setAppToken(savedAppToken)
    if (savedTableId) setTableId(savedTableId)
  }, [])

  // 检查登录状态
  useEffect(() => {
    checkLoginStatus()

    // 检查URL参数中的认证状态
    const params = new URLSearchParams(window.location.search)
    const authStatus = params.get('auth')

    if (authStatus === 'success') {
      setError('')
      // 清除URL参数
      window.history.replaceState({}, '', window.location.pathname)
    } else if (authStatus === 'error') {
      const message = params.get('message') || '登录失败'
      setError(`飞书登录失败: ${message}`)
      // 清除URL参数
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // 检查登录状态
  const checkLoginStatus = async () => {
    try {
      const response = await fetch('/api/auth/status')
      const data = await response.json()
      setIsLoggedIn(data.loggedIn || false)
    } catch (err) {
      console.error('检查登录状态失败:', err)
      setIsLoggedIn(false)
    } finally {
      setIsCheckingLogin(false)
    }
  }

  // 登录飞书
  const handleFeishuLogin = () => {
    window.location.href = '/api/auth/login'
  }

  // 退出登录
  const handleFeishuLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setIsLoggedIn(false)
        setAppToken('')
        setTableId('')
        localStorage.removeItem('feishu_app_token')
        localStorage.removeItem('feishu_table_id')
        console.log('退出登录成功')
      }
    } catch (err) {
      console.error('退出登录失败:', err)
    }
  }

  // 保存历史记录到 localStorage
  const saveToHistory = (note: XiaohongshuNote, url: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      title: note.title,
      url: url,
      timestamp: Date.now(),
      savedToFeishu: false,
    }

    const updatedHistory = [newItem, ...history].slice(0, 20) // 只保留最近20条
    setHistory(updatedHistory)
    localStorage.setItem('xiaohongshu_extract_history', JSON.stringify(updatedHistory))
  }

  // 更新历史记录的飞书保存状态
  const updateHistoryFeishuStatus = (url: string) => {
    const updatedHistory = history.map((item) =>
      item.url === url ? { ...item, savedToFeishu: true } : item
    )
    setHistory(updatedHistory)
    localStorage.setItem('xiaohongshu_extract_history', JSON.stringify(updatedHistory))
  }

  // 删除历史记录
  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter((item) => item.id !== id)
    setHistory(updatedHistory)
    localStorage.setItem('xiaohongshu_extract_history', JSON.stringify(updatedHistory))
  }

  // 提取小红书笔记
  const handleExtract = async () => {
    if (!inputUrl.trim()) {
      setError('请输入小红书链接')
      return
    }

    setIsExtracting(true)
    setError('')
    setExtractedData(null)
    setSavedToFeishu(false)

    try {
      console.log('[提取] 开始提取:', inputUrl)

      const response = await fetch('/api/xiaohongshu/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: inputUrl.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '提取失败')
      }

      console.log('[提取] 提取成功:', data.data)
      setExtractedData(data.data)

      // 保存到历史记录
      saveToHistory(data.data, inputUrl.trim())
    } catch (err) {
      console.error('[提取] 错误:', err)
      setError(err instanceof Error ? err.message : '提取失败，请重试')
    } finally {
      setIsExtracting(false)
    }
  }

  // 保存到飞书表格
  const handleSaveToFeishu = async () => {
    if (!extractedData) return

    // 检查登录状态
    if (!isLoggedIn) {
      setError('请先登录飞书账号')
      return
    }

    // 检查表格配置
    if (!appToken.trim() || !tableId.trim()) {
      setError('请先配置飞书表格信息')
      return
    }

    setIsSavingToFeishu(true)
    setError('')

    try {
      console.log('[飞书] 开始保存到飞书...')

      // 保存表格配置到 localStorage
      localStorage.setItem('feishu_app_token', appToken.trim())
      localStorage.setItem('feishu_table_id', tableId.trim())

      // 准备数据
      const tags = extractedData.tags || ''

      const response = await fetch('/api/feishu/append-row', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: extractedData.title,
          images: extractedData.images || [],
          content: extractedData.content || '',
          tags: tags,
          url: inputUrl.trim(),
          appToken: appToken.trim(),
          tableId: tableId.trim(),
        }),
      })

      const data = await response.json()

      // 处理需要重新登录的情况
      if (data.needLogin) {
        setIsLoggedIn(false)
        setError('登录已过期，请重新登录')
        return
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || '保存到飞书失败')
      }

      console.log('[飞书] 保存成功')
      setSavedToFeishu(true)

      // 更新历史记录状态
      updateHistoryFeishuStatus(inputUrl.trim())
    } catch (err) {
      console.error('[飞书] 错误:', err)
      setError(err instanceof Error ? err.message : '保存到飞书失败')
    } finally {
      setIsSavingToFeishu(false)
    }
  }

  // 跳转到复刻页面
  const handleGoToRewrite = () => {
    if (!inputUrl) return
    router.push(`/rewrite?url=${encodeURIComponent(inputUrl.trim())}`)
  }

  // 从历史记录中加载
  const handleLoadFromHistory = (item: HistoryItem) => {
    setInputUrl(item.url)
    setExtractedData(null)
    setSavedToFeishu(item.savedToFeishu)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center">
            <Database className="w-10 h-10 mr-3 text-blue-500" />
            小红书笔记智能采集
          </h1>
          <p className="text-gray-600">
            提取笔记内容 · 保存到飞书表格 · 一键跳转复刻
          </p>
        </div>

        {/* 飞书登录和配置区域 */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Database className="w-5 h-5 mr-2 text-blue-500" />
              飞书配置
            </h2>
            {isCheckingLogin ? (
              <span className="text-sm text-gray-500">检查登录状态...</span>
            ) : isLoggedIn ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  已登录
                </span>
                <button
                  onClick={handleFeishuLogout}
                  className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all text-sm"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <button
                onClick={handleFeishuLogin}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center transition-all text-sm"
              >
                <User className="w-4 h-4 mr-1" />
                登录飞书
              </button>
            )}
          </div>

          {isLoggedIn && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  表格 App Token
                </label>
                <input
                  type="text"
                  value={appToken}
                  onChange={(e) => setAppToken(e.target.value)}
                  placeholder="NNd8bJYazaBwHAsZ2z2cqsvmnqf"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  表格 Table ID
                </label>
                <input
                  type="text"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  placeholder="tblu1m2GPcFRNSPE"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {!isLoggedIn && !isCheckingLogin && (
            <p className="text-sm text-gray-500 mt-2">
              请先登录飞书账号以使用保存到表格功能
            </p>
          )}
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：输入和操作 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 输入区域 */}
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <LinkIcon className="w-5 h-5 mr-2 text-blue-500" />
                输入小红书链接
              </h2>

              <div className="space-y-3">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                  placeholder="粘贴小红书笔记链接..."
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isExtracting}
                />

                <button
                  onClick={handleExtract}
                  disabled={isExtracting || !inputUrl.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 flex items-center justify-center shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      提取中...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      提取内容
                    </>
                  )}
                </button>
              </div>
            </GlassCard>

            {/* 错误提示 */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* 提取结果 */}
            <AnimatePresence>
              {extractedData && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <GlassCard className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-green-500" />
                      提取结果
                      {savedToFeishu && (
                        <span className="ml-auto text-sm text-green-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          已保存到飞书
                        </span>
                      )}
                    </h2>

                    {/* 图片预览 */}
                    {extractedData.images && extractedData.images.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <ImageIcon className="w-4 h-4 mr-1" />
                          图片（{extractedData.images.length}张）
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                          {extractedData.images.slice(0, 9).map((img, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={img}
                                alt={`图片${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <a
                                href={img}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg"
                              >
                                <ExternalLink className="w-6 h-6 text-white" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 基本信息 */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">标题</h3>
                        <p className="text-base font-semibold text-gray-900">
                          {extractedData.title}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1 flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            作者
                          </h3>
                          <p className="text-sm text-gray-700">
                            {extractedData.user?.nickname || '未知'}
                          </p>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            发布时间
                          </h3>
                          <p className="text-sm text-gray-700">
                            {extractedData.time
                              ? new Date(extractedData.time).toLocaleDateString('zh-CN')
                              : '未知'}
                          </p>
                        </div>
                      </div>

                      {/* 互动数据 */}
                      {extractedData.interactInfo && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">互动数据</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-700">
                            <span className="flex items-center">
                              <Heart className="w-4 h-4 mr-1 text-red-500" />
                              {extractedData.interactInfo.likedCount || '0'}
                            </span>
                            <span className="flex items-center">
                              <MessageCircle className="w-4 h-4 mr-1 text-blue-500" />
                              {extractedData.interactInfo.commentCount || '0'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 正文 */}
                      {extractedData.desc && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">正文内容</h3>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                            {extractedData.desc}
                          </p>
                        </div>
                      )}

                      {/* 话题标签 */}
                      {extractedData.tagList && extractedData.tagList.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                            <Hash className="w-3 h-3 mr-1" />
                            话题标签
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {extractedData.tagList.map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full"
                              >
                                #{tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        onClick={handleSaveToFeishu}
                        disabled={isSavingToFeishu || savedToFeishu}
                        className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingToFeishu ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : savedToFeishu ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            已保存到飞书
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4 mr-2" />
                            保存到飞书表格
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleGoToRewrite}
                        className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center transition-all"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        立即复刻
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 右侧：采集历史 */}
          <div className="lg:col-span-1">
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-500" />
                采集历史
                <span className="ml-auto text-sm text-gray-500">最近{history.length}条</span>
              </h2>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无采集记录</p>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white bg-opacity-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3
                          className="text-sm font-medium text-gray-900 line-clamp-2 flex-1 cursor-pointer hover:text-blue-600"
                          onClick={() => handleLoadFromHistory(item)}
                        >
                          {item.title}
                        </h3>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        >
                          <Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" />
                        </button>
                      </div>

                      <p className="text-xs text-gray-500 mb-2">
                        {new Date(item.timestamp).toLocaleString('zh-CN')}
                      </p>

                      <div className="flex items-center space-x-2">
                        {item.savedToFeishu && (
                          <span className="text-xs text-green-600 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            已保存
                          </span>
                        )}
                        <button
                          onClick={() => handleLoadFromHistory(item)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          重新加载
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  )
}
