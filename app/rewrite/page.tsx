'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Link as LinkIcon,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Check,
  Settings,
  Type,
  AlignLeft,
  Palette,
  Wand2,
  Copy,
  Download,
  ExternalLink,
  Info,
  X
} from 'lucide-react'
import { motion } from 'framer-motion'
import GlassCard from '@/components/GlassCard'

// 状态类型定义
type PageState = 'empty' | 'parsed' | 'processing' | 'completed'

// 原始笔记数据
interface OriginalNote {
  title: string
  content: string
  tags: string  // 话题标签
  images: string[]
}

// 复刻结果数据
interface RewriteResult {
  newTitle: string
  newContent: string
  newImages: string[]
}

// URL参数加载组件（需要包裹在Suspense中）
function URLParamsLoader({
  onLoad
}: {
  onLoad: (note: OriginalNote) => void
}) {
  const searchParams = useSearchParams()

  useEffect(() => {
    const title = searchParams.get('title')
    const content = searchParams.get('content')
    const tags = searchParams.get('tags')

    if (title && content) {
      console.log('[小红书复刻] 从URL参数加载笔记数据')

      onLoad({
        title,
        content,
        tags: tags || '',
        images: []
      })
    }
  }, [searchParams, onLoad])

  return null
}

function RewritePageContent() {
  // ===== 状态管理 =====
  const [pageState, setPageState] = useState<PageState>('empty')
  const [xiaohongshuUrl, setXiaohongshuUrl] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  // 原始笔记数据
  const [originalNote, setOriginalNote] = useState<OriginalNote | null>(null)

  // 可编辑的内容（用户可以在改写前或改写后编辑）
  const [editableTitle, setEditableTitle] = useState('')
  const [editableContent, setEditableContent] = useState('')
  const [editableTags, setEditableTags] = useState('')

  // ===== 从URL参数预填充数据 =====
  const handleURLParamsLoad = (note: OriginalNote) => {
    setOriginalNote(note)
    setEditableTitle(note.title)
    setEditableContent(note.content)
    setEditableTags(note.tags)
    setPageState('parsed')
  }

  // 提示词设置
  const [titlePrompt, setTitlePrompt] = useState('请将以下小红书标题改写为更吸引人的新标题，保持原意但使用不同的表达方式，避免抄袭：')
  const [contentPrompt, setContentPrompt] = useState('请将以下小红书正文改写为全新的内容，保持核心观点但使用完全不同的表达方式、案例和结构，确保原创性：')
  const [imagePrompt, setImagePrompt] = useState('基于原图的主题和构图，生成一张风格相似但内容不同的新图片')
  const [imageStyle, setImageStyle] = useState('original')

  // 生图模式设置
  const [isTravelMode, setIsTravelMode] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '16:9' | '9:16'>('3:4')

  // 复刻结果
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [processingStep, setProcessingStep] = useState('')
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 })

  // 复制状态
  const [copied, setCopied] = useState(false)

  // ===== 解析小红书链接 =====
  const handleParse = async () => {
    if (!xiaohongshuUrl.trim()) {
      setParseError('请输入小红书链接')
      return
    }

    setIsParsing(true)
    setParseError('')

    try {
      console.log('[小红书复刻] 开始解析链接:', xiaohongshuUrl)

      // 调用解析API
      const response = await fetch('/api/xiaohongshu/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: xiaohongshuUrl.trim() })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '解析失败')
      }

      // 提取解析结果
      const { title, content, images } = result.data

      // 检查是否有有效内容
      if (!title && !content && (!images || images.length === 0)) {
        throw new Error('未能从链接中提取到有效内容')
      }

      const parsedNote: OriginalNote = {
        title: title || '未获取到标题',
        content: content || '未获取到正文内容',
        tags: '',  // 从链接解析时没有tags
        images: images || []
      }

      setOriginalNote(parsedNote)
      setEditableTitle(parsedNote.title)
      setEditableContent(parsedNote.content)
      setEditableTags(parsedNote.tags)
      setPageState('parsed')
      console.log('[小红书复刻] 解析成功')
      console.log('[小红书复刻] 标题:', parsedNote.title)
      console.log('[小红书复刻] 图片数量:', parsedNote.images.length)
    } catch (error) {
      console.error('[小红书复刻] 解析失败:', error)
      setParseError(error instanceof Error ? error.message : '解析失败，请检查链接是否正确')
    } finally {
      setIsParsing(false)
    }
  }

  // ===== 开始复刻 =====
  const handleRewrite = async () => {
    if (!originalNote) return

    setPageState('processing')
    setProcessingStep('正在改写标题和正文...')
    setParseError('')

    try {
      // 1. 改写标题和正文（使用可编辑的内容）
      console.log('[小红书复刻] 开始改写内容')
      const rewriteResponse = await fetch('/api/xiaohongshu/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editableTitle,
          content: editableContent,
          titlePrompt: titlePrompt,
          contentPrompt: contentPrompt
        })
      })

      const rewriteResult = await rewriteResponse.json()

      if (!rewriteResult.success) {
        throw new Error(rewriteResult.error || '内容改写失败')
      }

      const { newTitle, newContent } = rewriteResult.data
      console.log('[小红书复刻] 内容改写完成')
      console.log('[小红书复刻] 新标题:', newTitle)

      // 2. 复刻图片
      setImageProgress({ current: 0, total: originalNote.images.length })
      const newImages: string[] = []

      for (let i = 0; i < originalNote.images.length; i++) {
        setProcessingStep(`正在复刻图片 ${i + 1}/${originalNote.images.length}...`)
        setImageProgress({ current: i + 1, total: originalNote.images.length })

        try {
          console.log(`[小红书复刻] 开始生成第 ${i + 1} 张图片`)

          // 构建图片生成提示词
          const imageGeneratePrompt = `${imagePrompt}。这是第${i + 1}张图片。`

          const imageResponse = await fetch('/api/imagen/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: imageGeneratePrompt,
              isTravelMode: isTravelMode,
              aspectRatio: aspectRatio,
              numberOfImages: 1,
              style: imageStyle
            })
          })

          const imageResult = await imageResponse.json()

          if (imageResult.success && imageResult.data.images && imageResult.data.images.length > 0) {
            newImages.push(imageResult.data.images[0])
            console.log(`[小红书复刻] 第 ${i + 1} 张图片生成成功`)
          } else {
            // 图片生成失败时使用占位图
            console.warn(`[小红书复刻] 第 ${i + 1} 张图片生成失败，使用占位图`)
            const colors = ['FFA07A', 'FFD700', '87CEEB', '98D8C8', 'F7B7D5']
            newImages.push(`https://via.placeholder.com/400x500/${colors[i % colors.length]}/FFFFFF?text=Image+${i + 1}`)
          }
        } catch (imageError) {
          console.error(`[小红书复刻] 第 ${i + 1} 张图片生成失败:`, imageError)
          // 图片生成失败不影响整体流程，使用占位图
          const colors = ['FFA07A', 'FFD700', '87CEEB', '98D8C8', 'F7B7D5']
          newImages.push(`https://via.placeholder.com/400x500/${colors[i % colors.length]}/FFFFFF?text=Image+${i + 1}`)
        }
      }

      // 3. 完成
      setRewriteResult({
        newTitle,
        newContent,
        newImages
      })
      setPageState('completed')
      console.log('[小红书复刻] 复刻完成')
      console.log('[小红书复刻] 成功生成', newImages.length, '张图片')
    } catch (error) {
      console.error('[小红书复刻] 复刻失败:', error)
      setParseError(error instanceof Error ? error.message : '复刻失败，请重试')
      setPageState('parsed')
    }
  }

  // ===== 重新复刻 =====
  const handleRegenerate = () => {
    setRewriteResult(null)
    handleRewrite()
  }

  // ===== 复制内容 =====
  const handleCopy = () => {
    if (!rewriteResult) return
    const text = `${rewriteResult.newTitle}\n\n${rewriteResult.newContent}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ===== 保存草稿 =====
  const handleSave = async () => {
    if (!rewriteResult) return
    alert('保存功能待实现')
  }

  // ===== 重置页面 =====
  const handleReset = () => {
    setXiaohongshuUrl('')
    setOriginalNote(null)
    setRewriteResult(null)
    setPageState('empty')
    setParseError('')
  }

  return (
    <div className="p-6">
      {/* URL参数加载器 */}
      <Suspense fallback={null}>
        <URLParamsLoader onLoad={handleURLParamsLoad} />
      </Suspense>

      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Sparkles className="w-7 h-7 mr-2 text-pink-500" />
          小红书复刻
        </h1>
        <p className="text-gray-500 mt-1">一键复刻小红书笔记，AI智能改写标题、正文并复刻图片</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：输入和设置区域 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 链接输入 */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <LinkIcon className="w-5 h-5 mr-2 text-blue-500" />
              链接输入
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                value={xiaohongshuUrl}
                onChange={(e) => setXiaohongshuUrl(e.target.value)}
                placeholder="请输入小红书链接"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={pageState === 'processing'}
              />
              {parseError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{parseError}</p>
                </div>
              )}
              <button
                onClick={handleParse}
                disabled={isParsing || pageState === 'processing'}
                className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    解析中...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    解析
                  </>
                )}
              </button>
              {pageState !== 'empty' && (
                <button
                  onClick={handleReset}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  重新输入
                </button>
              )}
            </div>
          </GlassCard>

          {/* 改写设置 */}
          {pageState !== 'empty' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-purple-500" />
                  改写设置
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Type className="w-4 h-4 mr-1" />
                      标题改写提示词
                      <button className="ml-auto text-gray-400 hover:text-gray-600">
                        <Info className="w-4 h-4" />
                      </button>
                    </label>
                    <textarea
                      value={titlePrompt}
                      onChange={(e) => setTitlePrompt(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      rows={3}
                      disabled={pageState === 'processing'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <AlignLeft className="w-4 h-4 mr-1" />
                      正文改写提示词
                    </label>
                    <textarea
                      value={contentPrompt}
                      onChange={(e) => setContentPrompt(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      rows={4}
                      disabled={pageState === 'processing'}
                    />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* 图片复刻设置 */}
          {pageState !== 'empty' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <GlassCard className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-green-500" />
                  图片复刻设置
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Palette className="w-4 h-4 mr-1" />
                      图生图提示词
                    </label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                      rows={3}
                      disabled={pageState === 'processing'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      复刻风格
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'original', label: '保持原风格' },
                        { value: 'cartoon', label: '卡通风格' },
                        { value: 'realistic', label: '写实风格' },
                        { value: 'sketch', label: '手绘风格' }
                      ].map((style) => (
                        <label key={style.value} className="flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name="imageStyle"
                            value={style.value}
                            checked={imageStyle === style.value}
                            onChange={(e) => setImageStyle(e.target.value)}
                            className="mr-2"
                            disabled={pageState === 'processing'}
                          />
                          <span className="text-sm text-gray-700">{style.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 云旅游实景模式 */}
                  <div className="border-t pt-4">
                    <label className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-green-200 bg-green-50">
                      <input
                        type="checkbox"
                        checked={isTravelMode}
                        onChange={(e) => setIsTravelMode(e.target.checked)}
                        className="mr-3 w-4 h-4 text-green-600"
                        disabled={pageState === 'processing'}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">开启"云旅游"实景模式</span>
                        <p className="text-xs text-gray-500 mt-1">
                          将提示词视为地理位置，AI 会根据当前时间推演真实环境
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* 图片宽高比 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      图片宽高比
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { value: '1:1', label: '1:1' },
                        { value: '3:4', label: '3:4' },
                        { value: '4:3', label: '4:3' },
                        { value: '16:9', label: '16:9' },
                        { value: '9:16', label: '9:16' }
                      ].map((ratio) => (
                        <button
                          key={ratio.value}
                          onClick={() => setAspectRatio(ratio.value as any)}
                          className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                            aspectRatio === ratio.value
                              ? 'bg-green-500 text-white border-green-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-300'
                          }`}
                          disabled={pageState === 'processing'}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* 开始复刻按钮 */}
          {pageState === 'parsed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <button
                onClick={handleRewrite}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                开始复刻
              </button>
            </motion.div>
          )}
        </div>

        {/* 右侧：预览区域 */}
        <div className="lg:col-span-2">
          <GlassCard className="p-6 min-h-[600px]">
            {/* 空白状态 */}
            {pageState === 'empty' && (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <div className="w-24 h-24 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center mb-6">
                  <LinkIcon className="w-12 h-12 text-pink-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">等待解析小红书链接</h3>
                <p className="text-gray-500 text-center max-w-md">
                  粘贴小红书笔记链接到左侧输入框，点击"解析"开始
                </p>
              </div>
            )}

            {/* 解析成功状态 */}
            {pageState === 'parsed' && originalNote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">内容已加载</h3>
                </div>

                <div className="space-y-6">
                  {/* 可编辑的内容区域 */}
                  <div className="space-y-4">
                    {/* 标题编辑框 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center">
                          <Type className="w-4 h-4 mr-1 text-pink-600" />
                          标题
                        </label>
                        <button
                          onClick={async () => {
                            setProcessingStep('正在改写标题...')
                            try {
                              const response = await fetch('/api/xiaohongshu/rewrite', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  title: editableTitle,
                                  content: editableContent,
                                  titlePrompt: titlePrompt,
                                  contentPrompt: contentPrompt
                                })
                              })
                              const result = await response.json()
                              if (result.success) {
                                setEditableTitle(result.data.newTitle)
                              }
                            } catch (error) {
                              console.error('改写标题失败:', error)
                            }
                          }}
                          className="px-3 py-1 text-xs bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 flex items-center"
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          一键改写
                        </button>
                      </div>
                      <textarea
                        value={editableTitle}
                        onChange={(e) => setEditableTitle(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                        rows={2}
                        placeholder="输入标题..."
                      />
                    </div>

                    {/* 正文编辑框 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center">
                          <AlignLeft className="w-4 h-4 mr-1 text-blue-600" />
                          正文
                        </label>
                        <button
                          onClick={async () => {
                            setProcessingStep('正在改写正文...')
                            try {
                              const response = await fetch('/api/xiaohongshu/rewrite', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  title: editableTitle,
                                  content: editableContent,
                                  titlePrompt: titlePrompt,
                                  contentPrompt: contentPrompt
                                })
                              })
                              const result = await response.json()
                              if (result.success) {
                                setEditableContent(result.data.newContent)
                              }
                            } catch (error) {
                              console.error('改写正文失败:', error)
                            }
                          }}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center"
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          一键改写
                        </button>
                      </div>
                      <textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={8}
                        placeholder="输入正文..."
                      />
                    </div>

                    {/* 话题标签编辑框 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <span className="text-purple-600 mr-1">#</span>
                        话题标签
                        <span className="ml-2 text-xs text-gray-500">（多个标签用空格分隔）</span>
                      </label>
                      <textarea
                        value={editableTags}
                        onChange={(e) => setEditableTags(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                        rows={2}
                        placeholder="例如：#旅行 #美食 #生活记录"
                      />
                    </div>
                  </div>

                  {/* 原始图片 */}
                  {originalNote.images.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <ImageIcon className="w-5 h-5 mr-2 text-purple-600" />
                        原始图片 (共{originalNote.images.length}张)
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {originalNote.images.map((img, index) => (
                          <div key={index} className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-purple-400 transition-colors">
                            <img src={img} alt={`原图 ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-500 text-center">
                      ✨ 编辑好内容后，点击"开始复刻"按钮生成新图片
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 复刻中状态 */}
            {pageState === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-pink-500" />
                    </div>
                    <div className="absolute inset-0 w-24 h-24 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-2">AI正在复刻中...</h3>
                  <p className="text-gray-500 mb-8">请稍候，正在为您生成全新内容</p>

                  <div className="w-full max-w-md">
                    {/* 进度条 */}
                    <div className="mb-6">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-500" style={{ width: '60%' }}></div>
                      </div>
                    </div>

                    {/* 步骤列表 */}
                    <div className="space-y-3">
                      <div className="flex items-center text-sm">
                        <span className="w-2 h-2 bg-pink-500 rounded-full mr-3 animate-pulse"></span>
                        <span className="text-gray-700">{processingStep}</span>
                      </div>
                      {imageProgress.total > 0 && (
                        <div className="flex items-center text-sm">
                          <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                          <span className="text-gray-500">图片复刻进度: {imageProgress.current}/{imageProgress.total}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 复刻完成状态 */}
            {pageState === 'completed' && rewriteResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">复刻完成</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1.5 text-green-500" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1.5" />
                          复制
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* 新标题 */}
                  <div className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Type className="w-5 h-5 mr-2 text-pink-600" />
                      新标题
                    </h4>
                    <p className="text-gray-900 font-medium">{rewriteResult.newTitle}</p>
                  </div>

                  {/* 新正文 */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <AlignLeft className="w-5 h-5 mr-2 text-blue-600" />
                      新正文
                    </h4>
                    <div className="max-h-60 overflow-y-auto">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{rewriteResult.newContent}</p>
                    </div>
                  </div>

                  {/* 新图片 */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <ImageIcon className="w-5 h-5 mr-2 text-green-600" />
                      新图片 (共{rewriteResult.newImages.length}张)
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {rewriteResult.newImages.map((img, index) => (
                        <div key={index} className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-green-400 transition-colors group relative">
                          <img src={img} alt={`新图 ${index + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                            <Download className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      保存草稿
                    </button>
                    <button
                      onClick={handleRegenerate}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重新复刻
                    </button>
                    <button
                      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      发布
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

// 主导出组件
export default function RewritePage() {
  return <RewritePageContent />
}
