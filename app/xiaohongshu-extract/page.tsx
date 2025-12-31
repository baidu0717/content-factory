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
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from '@/components/GlassCard'

// 小红书笔记数据类型
interface XiaohongshuNote {
  title: string
  desc?: string
  content?: string
  images: string[]
  user?: {
    nickname: string
    avatar: string
  }
  interactInfo?: {
    likedCount: string
    collectedCount: string
    commentCount: string
  }
  tagList?: Array<{ name: string }>
  tags?: string
  time?: number
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
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  // 复刻相关状态
  const [isRewriting, setIsRewriting] = useState(false)
  const [rewriteProgress, setRewriteProgress] = useState(0)
  const [rewriteStep, setRewriteStep] = useState('')
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [titlePrompt, setTitlePrompt] = useState('请将以下标题改写为全新的、吸引人的标题。保持核心主题不变，但用更有创意的表达方式。')
  const [contentPrompt, setContentPrompt] = useState('请将以下正文改写为全新的、高质量的原创内容。保持核心观点和价值不变，但要用完全不同的表达方式和结构。')
  const [rewriteResult, setRewriteResult] = useState<{
    title: string
    content: string
  } | null>(null)
  const [editableTitle, setEditableTitle] = useState('')
  const [editableContent, setEditableContent] = useState('')
  const [isSavingArticle, setIsSavingArticle] = useState(false)

  // 飞书登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isCheckingLogin, setIsCheckingLogin] = useState(true)

  // 飞书表格配置
  const [appToken, setAppToken] = useState('')
  const [tableId, setTableId] = useState('')

  // 笔记记录列表
  const [savedNotes, setSavedNotes] = useState<any[]>([])
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)

  // 右侧Tab切换
  const [rightTab, setRightTab] = useState<'history' | 'notes'>('history')

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

    // 加载飞书表格配置（优先使用 localStorage，其次使用环境变量默认值）
    const savedAppToken = localStorage.getItem('feishu_app_token')
    const savedTableId = localStorage.getItem('feishu_table_id')
    const defaultAppToken = process.env.NEXT_PUBLIC_FEISHU_DEFAULT_APP_TOKEN || ''
    const defaultTableId = process.env.NEXT_PUBLIC_FEISHU_DEFAULT_TABLE_ID || ''

    setAppToken(savedAppToken || defaultAppToken)
    setTableId(savedTableId || defaultTableId)
  }, [])

  // 检查登录状态
  useEffect(() => {
    checkLoginStatus()
    loadSavedNotes()

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

  // 加载笔记记录列表
  const loadSavedNotes = async () => {
    setIsLoadingNotes(true)
    try {
      const response = await fetch('/api/feishu-notes?limit=50')
      const data = await response.json()

      if (data.success) {
        setSavedNotes(data.data || [])
        console.log('[笔记记录] 加载成功，共', data.data?.length || 0, '条')
      }
    } catch (err) {
      console.error('[笔记记录] 加载失败:', err)
    } finally {
      setIsLoadingNotes(false)
    }
  }

  // 更新笔记状态
  const updateNoteStatus = async (noteId: number, status: 'pending' | 'done' | 'skip') => {
    try {
      const response = await fetch(`/api/feishu-notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rewrite_status: status,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // 刷新笔记列表
        await loadSavedNotes()
        console.log('[笔记记录] 更新状态成功')
      }
    } catch (err) {
      console.error('[笔记记录] 更新状态失败:', err)
    }
  }

  // 删除笔记记录
  const deleteNote = async (noteId: number) => {
    if (!confirm('确定要删除这条笔记记录吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/feishu-notes/${noteId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // 刷新笔记列表
        await loadSavedNotes()
        console.log('[笔记记录] 删除成功')
      }
    } catch (err) {
      console.error('[笔记记录] 删除失败:', err)
    }
  }

  // 从笔记记录加载到采集页面
  const loadNoteToEditor = (note: any) => {
    setInputUrl(note.url)
    setExtractedData({
      title: note.title,
      content: note.content,
      desc: note.content,
      images: note.images || [],
      tags: note.tags || '',
      url: note.url,
    })
    setSavedToFeishu(true)
    setSavedNoteId(note.id)
    setRewriteResult(null)
    setEditableTitle('')
    setEditableContent('')

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      const nickname = extractedData.user?.nickname || ''

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
          nickname: nickname,
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

      // 同时保存到本地数据库
      try {
        const noteResponse = await fetch('/api/feishu-notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: extractedData.title,
            content: extractedData.content || extractedData.desc || '',
            url: inputUrl.trim(),
            tags: tags,
            images: extractedData.images || [],
          }),
        })

        const noteData = await noteResponse.json()

        if (noteData.success && noteData.data?.id) {
          setSavedNoteId(noteData.data.id)
          console.log('[本地数据库] 保存笔记记录成功，ID:', noteData.data.id)
        }
      } catch (noteErr) {
        console.error('[本地数据库] 保存笔记记录失败:', noteErr)
        // 不影响主流程，继续
      }

      setSavedToFeishu(true)

      // 更新历史记录状态
      updateHistoryFeishuStatus(inputUrl.trim())

      // 刷新笔记记录列表
      await loadSavedNotes()
    } catch (err) {
      console.error('[飞书] 错误:', err)
      setError(err instanceof Error ? err.message : '保存到飞书失败')
    } finally {
      setIsSavingToFeishu(false)
    }
  }

  // 显示提示词编辑器
  const handleShowPromptEditor = () => {
    if (!extractedData || !savedToFeishu) {
      setError('请先保存到飞书后再进行复刻')
      return
    }
    setShowPromptEditor(true)
  }

  // 直接在当前页面复刻（只复刻文字，不包括图片）
  const handleRewrite = async () => {
    if (!extractedData || !savedToFeishu) {
      setError('请先保存到飞书后再进行复刻')
      return
    }

    setIsRewriting(true)
    setShowPromptEditor(false)
    setError('')
    setRewriteProgress(0)
    setRewriteStep('准备复刻...')

    try {
      console.log('[复刻] 开始复刻文字内容...')

      const title = extractedData.title
      const content = extractedData.content || extractedData.desc || ''

      // 更新进度：开始调用API
      setRewriteProgress(20)
      setRewriteStep('正在调用AI复刻...')

      // 调用复刻 API（使用用户自定义的提示词）
      const response = await fetch('/api/xiaohongshu/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title,
          content: content,
          titlePrompt: titlePrompt,
          contentPrompt: contentPrompt,
        }),
      })

      // 更新进度：等待响应
      setRewriteProgress(60)
      setRewriteStep('正在生成新内容...')

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '复刻失败')
      }

      console.log('[复刻] 复刻成功')

      // 更新进度：处理结果
      setRewriteProgress(80)
      setRewriteStep('正在保存结果...')

      // 设置复刻结果（可编辑）
      setRewriteResult({
        title: data.data.newTitle,
        content: data.data.newContent,
      })
      setEditableTitle(data.data.newTitle)
      setEditableContent(data.data.newContent)

      // 更新笔记状态为已复刻
      if (savedNoteId) {
        try {
          await fetch(`/api/feishu-notes/${savedNoteId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rewrite_status: 'done',
            }),
          })
          console.log('[本地数据库] 更新笔记状态为已复刻')
        } catch (noteErr) {
          console.error('[本地数据库] 更新笔记状态失败:', noteErr)
        }
      }

      // 完成
      setRewriteProgress(100)
      setRewriteStep('复刻完成！')

      // 延迟一下再重置进度
      setTimeout(() => {
        setRewriteProgress(0)
        setRewriteStep('')
      }, 1000)
    } catch (err) {
      console.error('[复刻] 错误:', err)
      setError(err instanceof Error ? err.message : '复刻失败，请重试')
      setRewriteProgress(0)
      setRewriteStep('')
    } finally {
      setIsRewriting(false)
    }
  }

  // 保存文章到数据库并跳转到发布页面
  const handleSaveAndPublish = async () => {
    setIsSavingArticle(true)
    setError('')

    try {
      console.log('[保存文章] 保存到数据库...')

      const now = Date.now()

      // 将 tags 字符串转换为数组
      const tagsString = extractedData?.tags || ''
      const tagsArray = tagsString
        .split(/[#\s]+/)
        .filter(tag => tag.trim().length > 0)
        .map(tag => tag.replace(/\[话题\]/g, '').trim())

      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editableTitle,
          content: editableContent,
          status: 'draft',
          platforms: [],
          source: 'ai_generated',
          created_at: now,
          tags: tagsArray,
          images: extractedData?.images || [],
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '保存失败')
      }

      console.log('[保存文章] 保存成功，ID:', data.data.id)

      // 跳转到发布页面
      router.push(`/publish?articleId=${data.data.id}`)
    } catch (err) {
      console.error('[保存文章] 错误:', err)
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setIsSavingArticle(false)
    }
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
                <div className="relative">
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
                    placeholder="粘贴小红书笔记链接..."
                    className="w-full px-4 py-3 pr-12 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isExtracting}
                  />
                  {inputUrl && (
                    <button
                      onClick={() => setInputUrl('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="清除链接"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

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
                            <div key={index} className="relative group aspect-[3/4] overflow-hidden rounded-lg">
                              <img
                                src={img}
                                alt={`图片${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <a
                                href={img}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
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
                      {(extractedData.content || extractedData.desc) && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">正文内容</h3>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-60 overflow-y-auto">
                            {extractedData.content || extractedData.desc}
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
                    <div className="mt-6 space-y-3">
                      {/* 保存到飞书按钮（或不保存选项） */}
                      {!savedToFeishu ? (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={handleSaveToFeishu}
                            disabled={isSavingToFeishu}
                            className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingToFeishu ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                保存中...
                              </>
                            ) : (
                              <>
                                <Database className="w-4 h-4 mr-2" />
                                保存到飞书
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setExtractedData(null)
                              setInputUrl('')
                            }}
                            className="px-4 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 flex items-center justify-center transition-all"
                          >
                            不保存
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* 复刻按钮或进度条 */}
                          {!rewriteResult && !showPromptEditor && (
                            <>
                              {isRewriting && rewriteProgress > 0 ? (
                                // 复刻进度条
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-700 flex items-center">
                                      <Loader2 className="w-4 h-4 mr-2 text-purple-500 animate-spin" />
                                      {rewriteStep}
                                    </h3>
                                    <span className="text-sm font-semibold text-purple-600">
                                      {rewriteProgress}%
                                    </span>
                                  </div>
                                  {/* 进度条 */}
                                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-gradient-to-r from-purple-500 to-blue-600 rounded-full"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${rewriteProgress}%` }}
                                      transition={{ duration: 0.3 }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                // 复刻按钮
                                <button
                                  onClick={handleShowPromptEditor}
                                  className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center transition-all"
                                >
                                  <ArrowRight className="w-4 h-4 mr-2" />
                                  复刻当前笔记
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 提示词编辑器 */}
            <AnimatePresence>
              {showPromptEditor && !rewriteResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <GlassCard className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-purple-500" />
                      复刻提示词设置
                    </h2>

                    <div className="space-y-4">
                      {/* 原标题 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          原标题
                        </label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                          {extractedData?.title}
                        </div>
                      </div>

                      {/* 标题提示词 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          标题改写提示词
                        </label>
                        <textarea
                          value={titlePrompt}
                          onChange={(e) => setTitlePrompt(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                          placeholder="输入标题改写提示词..."
                        />
                      </div>

                      <div className="border-t border-gray-200 my-4"></div>

                      {/* 原正文 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          原正文
                        </label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {extractedData?.content || extractedData?.desc}
                        </div>
                      </div>

                      {/* 正文提示词 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          正文改写提示词
                        </label>
                        <textarea
                          value={contentPrompt}
                          onChange={(e) => setContentPrompt(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                          placeholder="输入正文改写提示词..."
                        />
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowPromptEditor(false)}
                          className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleRewrite}
                          disabled={isRewriting}
                          className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRewriting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              复刻中...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              确认并开始复刻
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 复刻结果区域（可编辑） */}
            <AnimatePresence>
              {rewriteResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <GlassCard className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-purple-500" />
                      复刻结果
                      <span className="ml-auto text-xs text-gray-500">可编辑</span>
                    </h2>

                    <div className="space-y-4">
                      {/* 复刻后的标题（可编辑） */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          复刻标题
                        </label>
                        <textarea
                          value={editableTitle}
                          onChange={(e) => setEditableTitle(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                        />
                      </div>

                      {/* 复刻后的正文（可编辑） */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          复刻正文
                        </label>
                        <textarea
                          value={editableContent}
                          onChange={(e) => setEditableContent(e.target.value)}
                          rows={12}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                        />
                      </div>

                      {/* 保留原话题标签（只读） */}
                      {extractedData?.tags && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            话题标签（保留原标签）
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                            {extractedData.tags}
                          </div>
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            // 重新复刻 - 显示提示词编辑器
                            setRewriteResult(null)
                            setEditableTitle('')
                            setEditableContent('')
                            setShowPromptEditor(true)
                          }}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center transition-all"
                        >
                          重新复刻
                        </button>
                        <button
                          onClick={handleSaveAndPublish}
                          disabled={isSavingArticle}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingArticle ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              保存中...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              保存草稿并发布
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 右侧：笔记记录（卡片式布局） */}
          <div className="lg:col-span-1">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Database className="w-5 h-5 mr-2 text-blue-500" />
                  笔记记录
                </h2>
                <button
                  onClick={loadSavedNotes}
                  disabled={isLoadingNotes}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center transition-all disabled:opacity-50"
                >
                  {isLoadingNotes ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      刷新中...
                    </>
                  ) : (
                    '刷新'
                  )}
                </button>
              </div>

              <div className="space-y-3 max-h-[900px] overflow-y-auto">
                {isLoadingNotes ? (
                  <div className="py-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </div>
                ) : savedNotes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无笔记记录</p>
                ) : (
                  savedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex gap-3">
                        {/* 左侧：封面缩略图 */}
                        <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-200">
                          {note.images && note.images.length > 0 ? (
                            <img
                              src={note.images[0]}
                              alt="封面"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* 右侧：信息 */}
                        <div className="flex-1 min-w-0">
                          {/* 标题 */}
                          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                            {note.title}
                          </h3>

                          {/* 时间和状态 */}
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span>
                              {new Date(note.created_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <select
                              value={note.rewrite_status}
                              onChange={(e) =>
                                updateNoteStatus(
                                  note.id,
                                  e.target.value as 'pending' | 'done' | 'skip'
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                              className={`px-2 py-0.5 text-xs rounded border cursor-pointer ${
                                note.rewrite_status === 'done'
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : note.rewrite_status === 'skip'
                                  ? 'bg-gray-100 border-gray-300 text-gray-700'
                                  : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                              }`}
                            >
                              <option value="pending">未复刻</option>
                              <option value="done">已复刻</option>
                              <option value="skip">无需复刻</option>
                            </select>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => loadNoteToEditor(note)}
                              className="flex-1 px-3 py-1.5 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-all flex items-center justify-center"
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              加载并复刻
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNote(note.id)
                              }}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-all flex items-center justify-center"
                              title="删除笔记"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
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
