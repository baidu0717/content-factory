'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
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
import XiaohongshuPreview from '@/components/XiaohongshuPreview'

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

// 历史记录版本
interface HistoryVersion {
  id: string
  timestamp: number
  title: string
  content: string
  tags: string
  type: 'initial' | 'ai-rewrite' | 'manual-edit'
}

// URL参数加载组件（需要包裹在Suspense中）
function URLParamsLoader({
  onLoad
}: {
  onLoad: (note: OriginalNote) => void
}) {
  const searchParams = useSearchParams()
  const loadedRef = React.useRef(false)

  useEffect(() => {
    // 防止重复加载
    if (loadedRef.current) {
      console.log('[URL参数] 已经加载过，跳过')
      return
    }

    const title = searchParams.get('title')
    const content = searchParams.get('content')
    let tags = searchParams.get('tags')

    // 修复：如果 tags 为空，尝试从 URL hash 中读取
    // 这是因为飞书按钮字段在处理以 # 开头的字段值时，浏览器会将其解析为 URL fragment
    if (!tags && typeof window !== 'undefined' && window.location.hash) {
      let hash = decodeURIComponent(window.location.hash.substring(1)) // 移除 URL 的 #
      console.log('[URL修复] 从 hash 中读取 tags:', hash)

      // 恢复第一个标签的 # 号（因为 hash 移除了 URL 的 # 符号）
      if (hash && !hash.startsWith('#')) {
        hash = '#' + hash
      }

      // 去除 [话题] 标记，只保留纯标签
      // 例如：#黑财香[话题]# → #黑财香
      hash = hash.replace(/\[话题\]#?/g, '')

      console.log('[URL修复] 处理后的 tags:', hash)
      tags = hash
    }

    console.log('[URL参数] title:', title)
    console.log('[URL参数] content:', content)
    console.log('[URL参数] tags:', tags)

    if (title && content) {
      console.log('[小红书复刻] 从URL参数加载笔记数据')
      loadedRef.current = true

      onLoad({
        title,
        content,
        tags: tags || '',
        images: []
      })
    } else {
      console.log('[URL参数] 数据不完整，未加载')
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

  // 本地图片上传
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  // 小红书预览
  const [showPreview, setShowPreview] = useState(false)

  // 历史记录
  const [history, setHistory] = useState<HistoryVersion[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // 发布状态
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishStep, setPublishStep] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [publishResult, setPublishResult] = useState<{
    qrCodeUrl: string
    noteId: string
  } | null>(null)

  // 监听 editableContent 变化
  useEffect(() => {
    console.log('[状态监听] editableContent 已更新，新长度:', editableContent?.length)
    console.log('[状态监听] editableContent 前100字:', editableContent?.substring(0, 100))
  }, [editableContent])

  // ===== 创建历史版本 =====
  const createHistoryVersion = useCallback((title: string, content: string, tags: string, type: HistoryVersion['type']) => {
    const newVersion: HistoryVersion = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      title,
      content,
      tags,
      type
    }
    setHistory(prev => [newVersion, ...prev])
    setCurrentVersionId(newVersion.id)

    // 保存到 localStorage
    try {
      const updatedHistory = [newVersion, ...history]
      localStorage.setItem('rewrite-history', JSON.stringify(updatedHistory.slice(0, 50))) // 最多保留50个版本
      console.log('[历史记录] 已保存版本:', type, '总数:', updatedHistory.length)
    } catch (error) {
      console.error('[历史记录] 保存失败:', error)
    }

    return newVersion.id
  }, [history])

  // ===== 从localStorage加载历史记录 =====
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rewrite-history')
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryVersion[]
        setHistory(parsed)
        console.log('[历史记录] 已加载', parsed.length, '个历史版本')
      }
    } catch (error) {
      console.error('[历史记录] 加载失败:', error)
    }
  }, [])

  // ===== 恢复历史版本 =====
  const restoreVersion = useCallback((version: HistoryVersion) => {
    setEditableTitle(version.title)
    setEditableContent(version.content)
    setEditableTags(version.tags)
    setCurrentVersionId(version.id)
    setShowHistory(false)
    console.log('[历史记录] 已恢复版本:', version.id)
  }, [])

  // ===== 从URL参数预填充数据 =====
  const handleURLParamsLoad = useCallback((note: OriginalNote) => {
    console.log('[复刻页面] 收到URL参数数据:', note)
    setOriginalNote(note)
    setEditableTitle(note.title)
    setEditableContent(note.content)
    setEditableTags(note.tags)
    setPageState('parsed')

    // 创建初始历史版本
    createHistoryVersion(note.title, note.content, note.tags, 'initial')
  }, [createHistoryVersion])

  // ===== 处理图片上传 =====
  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const filesArray = Array.from(files)
    const validFiles = filesArray.filter(file => file.type.startsWith('image/'))

    if (validFiles.length === 0) {
      alert('请选择有效的图片文件')
      return
    }

    // 限制最多18张
    const totalFiles = uploadedFiles.length + validFiles.length
    if (totalFiles > 18) {
      alert('最多只能上传18张图片')
      return
    }

    // 添加新文件
    const newFiles = [...uploadedFiles, ...validFiles]
    setUploadedFiles(newFiles)

    // 生成预览URL
    const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file))
    setPreviewUrls([...previewUrls, ...newPreviewUrls])

    console.log('[图片上传] 已上传', newFiles.length, '张图片')
  }, [uploadedFiles, previewUrls])

  // ===== 删除图片 =====
  const handleRemoveImage = useCallback((index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    const newPreviewUrls = previewUrls.filter((_, i) => i !== index)

    // 释放 URL 对象
    URL.revokeObjectURL(previewUrls[index])

    setUploadedFiles(newFiles)
    setPreviewUrls(newPreviewUrls)

    console.log('[图片删除] 删除第', index + 1, '张图片，剩余', newFiles.length, '张')
  }, [uploadedFiles, previewUrls])

  // ===== 清理 URL 对象 =====
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  // ===== 发布笔记 =====
  const handlePublish = useCallback(async () => {
    if (!editableTitle || !editableContent || uploadedFiles.length === 0) {
      alert('请完善标题、正文和图片')
      return
    }

    setIsPublishing(true)
    setPublishResult(null)

    try {
      // 步骤1：上传图片到Vercel Blob
      setPublishStep('正在上传图片...')
      setUploadProgress(0)

      const formData = new FormData()
      uploadedFiles.forEach(file => {
        formData.append('images', file)
      })

      console.log('[发布] 开始上传', uploadedFiles.length, '张图片')

      const uploadResponse = await fetch('/api/upload/images', {
        method: 'POST',
        body: formData
      })

      const uploadResult = await uploadResponse.json()

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '图片上传失败')
      }

      const imageUrls = uploadResult.data.urls
      console.log('[发布] 图片上传完成，获得', imageUrls.length, '个URL')
      setUploadProgress(100)

      // 步骤2：调用发布API
      setPublishStep('正在发布到小红书...')

      // 先创建临时文章记录
      const article = {
        title: editableTitle,
        content: editableContent,
        tags: editableTags.split(/\s+/).filter(t => t.trim()),
        images: imageUrls
      }

      // 调用发布API（需要先保存到数据库）
      // TODO: 这里需要先创建文章记录，然后调用发布API
      console.log('[发布] 准备发布文章:', article)

      // 暂时直接显示成功（实际需要调用发布API）
      alert('发布功能开发中...')

    } catch (error) {
      console.error('[发布] 发布失败:', error)
      alert(`发布失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsPublishing(false)
      setPublishStep('')
      setUploadProgress(0)
    }
  }, [editableTitle, editableContent, editableTags, uploadedFiles])

  // 提示词设置
  const [titlePrompt, setTitlePrompt] = useState('请将以下小红书标题改写为更吸引人的新标题，保持原意但使用不同的表达方式。直接输出改写后的标题，不要有任何解释：')
  const [contentPrompt, setContentPrompt] = useState('请将以下小红书正文改写为全新的内容，保持核心观点但使用完全不同的表达方式、案例和结构。直接输出改写后的完整正文，不要有任何策略说明或解释，只输出正文内容本身：')
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

  // ===== 一键改写标题 =====
  const handleRewriteTitle = useCallback(async () => {
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
    } finally {
      setProcessingStep('')
    }
  }, [editableTitle, editableContent, titlePrompt, contentPrompt])

  // ===== 一键改写全部（标题+正文） =====
  const handleRewriteAll = useCallback(async () => {
    console.log('[一键改写] 开始改写标题和正文')
    console.log('[一键改写] 当前标题:', editableTitle?.substring(0, 50))
    console.log('[一键改写] 当前正文长度:', editableContent?.length)
    console.log('[一键改写] 当前正文前100字:', editableContent?.substring(0, 100))

    setProcessingStep('正在改写标题和正文...')
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
      console.log('[一键改写] API返回结果:', result)
      if (result.success) {
        console.log('[一键改写] 新标题:', result.data.newTitle)
        console.log('[一键改写] 新正文长度:', result.data.newContent?.length)
        console.log('[一键改写] 新正文前200字:', result.data.newContent?.substring(0, 200))
        console.log('[一键改写] 准备更新状态...')

        // 同时更新标题和正文
        setEditableTitle(result.data.newTitle)
        setEditableContent(result.data.newContent)

        // 创建历史版本（使用新标题）
        createHistoryVersion(result.data.newTitle, result.data.newContent, editableTags, 'ai-rewrite')

        console.log('[一键改写] 状态已更新')
      } else {
        console.error('[一键改写] 改写失败:', result.error)
        alert(`改写失败: ${result.error}`)
      }
    } catch (error) {
      console.error('一键改写失败:', error)
      alert('改写失败，请重试')
    } finally {
      setProcessingStep('')
    }
  }, [editableTitle, editableContent, editableTags, titlePrompt, contentPrompt, createHistoryVersion])

  // ===== 一键改写正文 =====
  const handleRewriteContent = useCallback(async () => {
    console.log('[改写正文] 开始改写正文')
    console.log('[改写正文] 当前正文长度:', editableContent?.length)

    setProcessingStep('正在改写正文...')
    try {
      const response = await fetch('/api/xiaohongshu/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editableTitle,
          content: editableContent,
          contentPrompt: contentPrompt  // 只传正文提示词
        })
      })
      const result = await response.json()
      console.log('[改写正文] API返回结果:', result)
      if (result.success) {
        console.log('[改写正文] 新正文长度:', result.data.newContent?.length)
        setEditableContent(result.data.newContent)

        // 创建历史版本（标题不变）
        createHistoryVersion(editableTitle, result.data.newContent, editableTags, 'ai-rewrite')

        console.log('[改写正文] 状态已更新')
      } else {
        console.error('[改写正文] 改写失败:', result.error)
        alert(`改写失败: ${result.error}`)
      }
    } catch (error) {
      console.error('改写正文失败:', error)
      alert('改写失败，请重试')
    } finally {
      setProcessingStep('')
    }
  }, [editableTitle, editableContent, editableTags, contentPrompt, createHistoryVersion])

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
          {/* 图片上传 */}
          {pageState !== 'empty' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-purple-500" />
                  图片上传
                  <span className="ml-auto text-sm text-gray-500">
                    {uploadedFiles.length}/18
                  </span>
                </h2>
                <div className="space-y-3">
                  <label className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 transition-colors cursor-pointer flex flex-col items-center justify-center bg-gray-50 hover:bg-purple-50">
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">点击或拖拽上传图片</span>
                    <span className="text-xs text-gray-400 mt-1">最多18张，支持JPG、PNG</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                  </label>

                  {/* 图片预览 */}
                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                          <img src={url} alt={`预览 ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 text-center">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          )}

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
                  {/* 一键改写全部按钮 */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleRewriteAll}
                      disabled={!editableTitle || !editableContent || processingStep !== ''}
                      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg font-medium"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      一键改写全部
                    </button>
                  </div>

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
                          onClick={handleRewriteTitle}
                          disabled={!editableTitle || processingStep !== ''}
                          className="px-3 py-1 text-xs bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          改写标题
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
                          <span className="ml-2 text-xs text-gray-500">
                            ({editableContent?.length || 0} 字)
                          </span>
                        </label>
                        <div className="flex gap-2">
                          {history.length > 0 && (
                            <button
                              onClick={() => setShowHistory(!showHistory)}
                              className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              历史记录 ({history.length})
                            </button>
                          )}
                          <button
                            onClick={handleRewriteContent}
                            disabled={!editableContent || processingStep !== ''}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <Wand2 className="w-3 h-3 mr-1" />
                            改写正文
                          </button>
                        </div>
                      </div>

                      {/* 历史记录面板 */}
                      {showHistory && history.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg"
                        >
                          <div className="text-xs font-medium text-gray-700 mb-2">历史版本</div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {history.map((version, index) => (
                              <button
                                key={version.id}
                                onClick={() => restoreVersion(version)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                  version.id === currentVersionId
                                    ? 'bg-purple-200 text-purple-900'
                                    : 'bg-white hover:bg-purple-100 text-gray-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {version.type === 'initial' && '📝 初始版本'}
                                    {version.type === 'ai-rewrite' && '🤖 AI改写'}
                                    {version.type === 'manual-edit' && '✏️ 手动编辑'}
                                  </span>
                                  <span className="text-gray-500">
                                    {new Date(version.timestamp).toLocaleTimeString('zh-CN', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <div className="text-gray-600 truncate mt-1">
                                  {version.content.substring(0, 50)}...
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      <textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[400px] max-h-[800px]"
                        rows={20}
                        placeholder="输入正文..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 提示：编辑框支持手动调整高度，拖拽右下角可调整
                      </p>
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

                  {/* 预览和发布按钮 */}
                  <div className="pt-4 border-t border-gray-200 flex gap-3">
                    <button
                      onClick={() => setShowPreview(true)}
                      disabled={!editableTitle || !editableContent || previewUrls.length === 0}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                    >
                      <ExternalLink className="w-5 h-5 mr-2" />
                      预览笔记
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={!editableTitle || !editableContent || previewUrls.length === 0 || isPublishing}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {publishStep || '发布中...'}
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          发布笔记
                        </>
                      )}
                    </button>
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

      {/* 小红书预览弹窗 */}
      <XiaohongshuPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={editableTitle}
        content={editableContent}
        tags={editableTags}
        images={previewUrls}
      />
    </div>
  )
}

// 主导出组件
export default function RewritePage() {
  return <RewritePageContent />
}
