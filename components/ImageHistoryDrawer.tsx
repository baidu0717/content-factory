'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Search,
  Download,
  Trash2,
  Eye,
  MessageSquare,
  Sparkles,
  RotateCcw,
  Image as ImageIcon,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface HistoryItem {
  id: number
  session_id: string | null
  turn_number: number
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  image_url: string
  aspect_ratio: string | null
  resolution: string | null
  created_at: number
}

interface GroupedHistory {
  session_id: string | null
  model: string
  mode: string
  total_turns: number
  first_prompt: string
  last_image_url: string
  created_at: number
  updated_at: number
  items: HistoryItem[]
}

interface ImageHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  onContinueSession?: (sessionId: string) => void
  onViewImage?: (imageUrl: string) => void
}

export default function ImageHistoryDrawer({
  isOpen,
  onClose,
  onContinueSession,
  onViewImage
}: ImageHistoryDrawerProps) {
  const [history, setHistory] = useState<GroupedHistory[]>([])
  const [stats, setStats] = useState({ total: 0, gemini: 0, imagen: 0, sessions: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [clickedPrompt, setClickedPrompt] = useState<{ id: number; text: string; rect: DOMRect } | null>(null)

  // 获取历史记录
  const fetchHistory = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/imagen/history')
      const data = await response.json()

      if (data.success) {
        setHistory(data.data.groupedHistory)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('[历史记录] 获取失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 当抽屉打开时获取历史
  useEffect(() => {
    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen])

  // 删除单条记录
  const handleDeleteItem = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      const response = await fetch(`/api/imagen/history/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchHistory() // 刷新列表
      }
    } catch (error) {
      console.error('[历史记录] 删除失败:', error)
    }
  }

  // 删除整个会话
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('确定要删除整个会话吗？')) return

    try {
      const response = await fetch(`/api/imagen/history/session/${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchHistory() // 刷新列表
      }
    } catch (error) {
      console.error('[历史记录] 删除会话失败:', error)
    }
  }

  // 继续编辑会话
  const handleContinue = (sessionId: string) => {
    onContinueSession?.(sessionId)
    onClose()
  }

  // 复制提示词
  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      // 可以添加一个提示（可选）
      console.log('[历史记录] 提示词已复制')
    } catch (error) {
      console.error('[历史记录] 复制失败:', error)
    }
  }

  // 切换会话展开/折叠
  const toggleSessionExpand = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  // 点击提示词，显示完整内容
  const handlePromptClick = (e: React.MouseEvent, id: number, text: string) => {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    setClickedPrompt({ id, text, rect })
  }

  // 关闭提示词弹窗
  const handleClosePrompt = () => {
    setClickedPrompt(null)
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`

    return new Date(timestamp).toLocaleDateString('zh-CN')
  }

  // 过滤历史记录
  const filteredHistory = history.filter(group => {
    if (!searchTerm) return true
    return group.items.some(item =>
      item.prompt.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 抽屉内容 */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-blue-500" />
                  生图历史
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索历史..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>


            {/* 历史记录列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm">加载中...</p>
                  </div>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p className="text-sm">暂无历史记录</p>
                </div>
              ) : (
                filteredHistory.map((group) => (
                  <div
                    key={group.session_id || group.items[0]?.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                  >
                    {/* 会话头部 */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center text-xs text-gray-600 mb-1">
                          {group.session_id ? (
                            <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                          ) : (
                            <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                          )}
                          <span className="font-medium">
                            {group.session_id ? '会话' : '独立生成'}
                          </span>
                          <span className="mx-1">·</span>
                          <span className={group.model === 'gemini' ? 'text-blue-600' : 'text-purple-600'}>
                            {group.model === 'gemini' ? 'Gemini' : 'Imagen'}
                          </span>
                          <span className="mx-1">·</span>
                          <span>{group.mode === 'text-to-image' ? '文字生图' : '图生图'}</span>
                        </div>
                        {group.session_id && (
                          <div className="text-xs text-gray-500">
                            {group.total_turns}轮 | {formatTime(group.updated_at)}
                          </div>
                        )}
                        {!group.session_id && (
                          <div className="text-xs text-gray-500">
                            {formatTime(group.created_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 图片列表 */}
                    <div className="space-y-2">
                      {(() => {
                        // 判断是否展开
                        const isExpanded = group.session_id ? expandedSessions.has(group.session_id) : true
                        // 决定显示哪些项（多轮对话默认显示2轮）
                        const displayItems = isExpanded || group.items.length <= 2
                          ? group.items
                          : group.items.slice(0, 2)

                        return displayItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-2">
                            {/* 缩略图 */}
                            <div
                              className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                              onClick={() => onViewImage?.(item.image_url)}
                            >
                              <img
                                src={item.image_url}
                                alt={`Turn ${item.turn_number}`}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* 信息 */}
                            <div className="flex-1 min-w-0">
                              {group.session_id && (
                                <div className="text-xs text-gray-500 mb-1">
                                  第{item.turn_number}轮
                                </div>
                              )}
                              <p
                                className="text-xs text-gray-700 line-clamp-2 mb-1 cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 transition-colors"
                                onClick={(e) => handlePromptClick(e, item.id, item.prompt)}
                              >
                                {item.prompt}
                              </p>

                              {/* 操作按钮 */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => onViewImage?.(item.image_url)}
                                  className="p-1 hover:bg-white rounded transition-colors"
                                  title="查看大图"
                                >
                                  <Eye className="w-3 h-3 text-gray-500" />
                                </button>
                                <a
                                  href={item.image_url}
                                  download
                                  className="p-1 hover:bg-white rounded transition-colors"
                                  title="下载"
                                >
                                  <Download className="w-3 h-3 text-gray-500" />
                                </a>
                                <button
                                  onClick={() => handleCopyPrompt(item.prompt)}
                                  className="p-1 hover:bg-white rounded transition-colors"
                                  title="复制提示词"
                                >
                                  <Copy className="w-3 h-3 text-green-500" />
                                </button>
                                {group.session_id && (
                                  <button
                                    onClick={() => handleContinue(item.session_id!)}
                                    className="p-1 hover:bg-white rounded transition-colors"
                                    title="继续编辑"
                                  >
                                    <RotateCcw className="w-3 h-3 text-blue-500" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 hover:bg-white rounded transition-colors ml-auto"
                                  title="删除"
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      })()}

                      {/* 展开/折叠按钮 */}
                      {group.session_id && group.items.length > 2 && (
                        <button
                          onClick={() => toggleSessionExpand(group.session_id!)}
                          className="w-full py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          {expandedSessions.has(group.session_id) ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              展开更多 ({group.items.length - 2}轮)
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* 会话操作 */}
                    {group.session_id && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => handleDeleteSession(group.session_id!)}
                          className="w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          删除整个会话
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* 提示词弹窗 */}
          <AnimatePresence>
            {clickedPrompt && (
              <>
                {/* 透明遮罩层用于关闭弹窗 */}
                <div
                  className="fixed inset-0 z-[60]"
                  onClick={handleClosePrompt}
                />

                {/* 弹窗内容 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-[70] bg-white rounded-lg shadow-2xl border border-gray-300 p-4 max-w-md"
                  style={{
                    left: `${clickedPrompt.rect.left}px`,
                    top: `${clickedPrompt.rect.bottom + 8}px`,
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">完整提示词</h3>
                    <button
                      onClick={handleClosePrompt}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap select-text leading-relaxed">
                    {clickedPrompt.text}
                  </p>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        handleCopyPrompt(clickedPrompt.text)
                        handleClosePrompt()
                      }}
                      className="w-full py-2 px-3 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy className="w-3 h-3" />
                      复制提示词
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
