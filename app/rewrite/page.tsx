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
  X,
  Smile
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from '@/components/GlassCard'
import XiaohongshuPreview from '@/components/XiaohongshuPreview'
import XHSEmojiTextEditor from '@/components/XHSEmojiTextEditor'
import { recordEmojiUsage } from '@/lib/emoji-learning'

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
  onLoad,
  onArticleId
}: {
  onLoad: (note: OriginalNote) => void
  onArticleId: (id: number) => void
}) {
  const searchParams = useSearchParams()
  const loadedRef = React.useRef(false)

  useEffect(() => {
    // 防止重复加载
    if (loadedRef.current) {
      console.log('[URL参数] 已经加载过，跳过')
      return
    }

    // 支持 article_id 参数（从发布页跳转编辑）
    const articleIdParam = searchParams.get('article_id')
    if (articleIdParam) {
      loadedRef.current = true
      const id = parseInt(articleIdParam)
      onArticleId(id)
      fetch(`/api/articles/${id}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            onLoad({
              title: data.data.title,
              content: data.data.content,
              tags: Array.isArray(data.data.tags) ? data.data.tags.join(' ') : '',
              images: data.data.images || []
            })
          } else {
            console.error('[URL参数] 获取文章失败:', data.error)
          }
        })
        .catch(e => console.error('[URL参数] 获取文章异常:', e))
      return
    }

    // 支持 record_id 参数（短链接模式，避免超长URL被CDN拦截）
    const recordId = searchParams.get('record_id')
    if (recordId) {
      loadedRef.current = true
      const params = new URLSearchParams({ record_id: recordId })
      const appToken = searchParams.get('app_token')
      const tableId = searchParams.get('table_id')
      if (appToken) params.set('app_token', appToken)
      if (tableId) params.set('table_id', tableId)

      console.log('[URL参数] 从 record_id 加载笔记数据:', recordId)
      fetch(`/api/feishu/get-record?${params}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            onLoad({
              title: data.data.title,
              content: data.data.content,
              tags: data.data.tags || '',
              images: []
            })
          } else {
            console.error('[URL参数] 获取记录失败:', data.error)
          }
        })
        .catch(e => console.error('[URL参数] 获取记录异常:', e))
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
  const [articleId, setArticleId] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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

  // 表情编辑模式
  const [isEditingEmoji, setIsEditingEmoji] = useState(false)

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

  // ===== 拖拽排序图片 =====
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
    console.log('[拖拽] 开始拖拽图片', index + 1)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    // 交换图片位置
    const newFiles = [...uploadedFiles]
    const newUrls = [...previewUrls]

    const draggedFile = newFiles[draggedIndex]
    const draggedUrl = newUrls[draggedIndex]

    newFiles.splice(draggedIndex, 1)
    newUrls.splice(draggedIndex, 1)

    newFiles.splice(index, 0, draggedFile)
    newUrls.splice(index, 0, draggedUrl)

    setUploadedFiles(newFiles)
    setPreviewUrls(newUrls)
    setDraggedIndex(index)
  }, [draggedIndex, uploadedFiles, previewUrls])

  const handleDragEnd = useCallback(() => {
    console.log('[拖拽] 拖拽结束')
    setDraggedIndex(null)
  }, [])

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
      setUploadProgress(60)

      // 步骤2：调用小红书发布API（直接发布，不保存到数据库）
      setPublishStep('正在发布到小红书...')
      setUploadProgress(75)

      const publishResponse = await fetch('/api/xiaohongshu/publish-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editableTitle,
          content: editableTags ? `${editableContent}\n\n${editableTags}` : editableContent,
          images: imageUrls
        })
      })

      const publishResult = await publishResponse.json()

      if (!publishResult.success) {
        throw new Error(publishResult.error || '发布到小红书失败')
      }

      console.log('[发布] 发布成功:', publishResult.data)
      setUploadProgress(100)

      // 步骤4：显示二维码
      setPublishResult({
        qrCodeUrl: publishResult.data.qrCodeUrl,
        noteId: publishResult.data.noteId
      })

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
  const [titlePrompt, setTitlePrompt] = useState(`你是小红书爆款标题创作专家。

【重要】必须创作一个与原标题完全不同的新标题！严禁直接复制原标题！

要求：
1) 完全不使用原标题的任何词汇
2) 必须使用数字、emoji或悬念手法
3) 长度10-20字
4) 只输出新标题，不要其他内容

示例1：
原标题：周末去哪玩
新标题：🔥3个超小众景点，人少景美还免费！

示例2：
原标题：分享一个好物
新标题：💰这个宝藏好物，我用了5年才敢推荐！

现在轮到你创作：`)

  const [contentPrompt, setContentPrompt] = useState(`你是一个专业的内容创作者，擅长将内容改写为全新的、高质量的原创文章，同时保持核心观点和价值。

请将以下小红书正文改写为全新的内容，保持核心观点但使用完全不同的表达方式、案例和结构。直接输出改写后的完整正文，不要有任何策略说明或解释，只输出正文内容本身。`)
  const [imagePrompt, setImagePrompt] = useState('基于原图的主题和构图，生成一张风格相似但内容不同的新图片')
  const [imageStyle, setImageStyle] = useState('original')

  // 生图模式设置
  const [isTravelMode, setIsTravelMode] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '16:9' | '9:16'>('3:4')

  // 复刻结果
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null)
  const [processingStep, setProcessingStep] = useState('')
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 })

  // 独立的按钮加载状态
  const [isRewritingTitle, setIsRewritingTitle] = useState(false)
  const [isRewritingContent, setIsRewritingContent] = useState(false)
  const [isRewritingAll, setIsRewritingAll] = useState(false)

  // 复制状态
  const [copied, setCopied] = useState(false)

  // ===== 一键改写标题 =====
  const handleRewriteTitle = useCallback(async () => {
    console.log('[改写标题] 开始改写标题')
    console.log('[改写标题] 当前标题:', editableTitle)
    setIsRewritingTitle(true)
    try {
      const response = await fetch('/api/xiaohongshu/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editableTitle,
          // 不传 content 和 contentPrompt，只改写标题
          titlePrompt: titlePrompt
        })
      })
      const result = await response.json()
      console.log('[改写标题] API返回结果:', result)
      if (result.success) {
        console.log('[改写标题] 新标题:', result.data.newTitle)
        setEditableTitle(result.data.newTitle)
        // 创建历史版本
        createHistoryVersion(result.data.newTitle, editableContent, editableTags, 'ai-rewrite')
      } else {
        console.error('[改写标题] 改写失败:', result.error)
        alert(`改写标题失败: ${result.error}`)
      }
    } catch (error) {
      console.error('改写标题失败:', error)
      alert('改写标题失败，请重试')
    } finally {
      setIsRewritingTitle(false)
    }
  }, [editableTitle, titlePrompt, editableContent, editableTags, createHistoryVersion])

  // ===== 一键改写全部（标题+正文） =====
  const handleRewriteAll = useCallback(async () => {
    console.log('[一键改写] 开始改写标题和正文')
    console.log('[一键改写] 当前标题:', editableTitle?.substring(0, 50))
    console.log('[一键改写] 当前正文长度:', editableContent?.length)
    console.log('[一键改写] 当前正文前100字:', editableContent?.substring(0, 100))

    setIsRewritingAll(true)
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
      setIsRewritingAll(false)
    }
  }, [editableTitle, editableContent, editableTags, titlePrompt, contentPrompt, createHistoryVersion])

  // ===== 一键改写正文 =====
  const handleRewriteContent = useCallback(async () => {
    console.log('[改写正文] 开始改写正文')
    console.log('[改写正文] 当前正文长度:', editableContent?.length)

    setIsRewritingContent(true)
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
      setIsRewritingContent(false)
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

  // ===== 保存到发布页 =====
  const handleSave = useCallback(async () => {
    if (!editableTitle || !editableContent) return
    setSaveStatus('saving')
    try {
      const tags = editableTags
        ? editableTags.split(/\s+/).map(t => t.replace(/^#/, '')).filter(Boolean)
        : []

      let response: Response
      if (articleId) {
        response = await fetch('/api/articles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: articleId,
            title: editableTitle,
            content: editableContent,
            status: 'draft',
            platforms: [],
            tags,
            wordCount: editableContent.length,
            images: []
          })
        })
      } else {
        response = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: editableTitle,
            content: editableContent,
            status: 'draft',
            platforms: [],
            source: 'rewrite',
            tags,
            wordCount: editableContent.length,
            images: []
          })
        })
        const result = await response.json()
        if (result.success) setArticleId(result.data.id)
      }

      const result = await response.json()
      if (result.success) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[保存] 失败:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }, [articleId, editableTitle, editableContent, editableTags])

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
        <URLParamsLoader onLoad={handleURLParamsLoad} onArticleId={setArticleId} />
      </Suspense>

      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Sparkles className="w-7 h-7 mr-2 text-pink-500" />
          小红书复刻
        </h1>
        <p className="text-gray-500 mt-1">一键复刻小红书笔记，AI智能改写标题、正文并复刻图片</p>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* 图片上传和设置区域 */}
        <div className="space-y-6">
          {/* 图片上传 */}
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
                    <div className="grid grid-cols-6 gap-2 mt-4">
                      {previewUrls.map((url, index) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-move transition-all ${
                            draggedIndex === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                          }`}
                        >
                          <img src={url} alt={`预览 ${index + 1}`} className="w-full h-full object-cover pointer-events-none" />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 text-center">
                            {index + 1}
                          </div>
                          {/* 拖拽指示器 */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 pointer-events-none">
                            <div className="text-white text-xs bg-black bg-opacity-60 px-2 py-1 rounded">
                              拖动排序
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
          </motion.div>

          {/* 改写设置 */}
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

        </div>

        {/* 内容编辑区域 */}
        <div>
          <GlassCard className="p-6">
            {/* 解析成功状态或空状态 - 都显示编辑界面 */}
            {(pageState === 'empty' || (pageState === 'parsed' && originalNote)) && (
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
                      disabled={!editableTitle || !editableContent || isRewritingAll}
                      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg font-medium"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      {isRewritingAll ? '改写中...' : '一键改写全部'}
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
                          disabled={!editableTitle || isRewritingTitle}
                          className="px-3 py-1 text-xs bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          {isRewritingTitle ? '改写中...' : '改写标题'}
                        </button>
                      </div>
                      <XHSEmojiTextEditor
                        value={editableTitle}
                        onChange={setEditableTitle}
                        placeholder="输入标题..."
                        rows={2}
                        maxLength={50}
                        showEmojiButton={true}
                        showStats={false}
                      />
                    </div>

                    {/* 正文编辑框 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center">
                          <AlignLeft className="w-4 h-4 mr-1 text-blue-600" />
                          正文
                          <span className="ml-2 text-xs text-gray-500">
                            ({(editableContent?.length || 0) + (editableTags ? editableTags.length + 2 : 0)} 字)
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
                            disabled={!editableContent || isRewritingContent}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          >
                            <Wand2 className="w-3 h-3 mr-1" />
                            {isRewritingContent ? '改写中...' : '改写正文'}
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

                      <XHSEmojiTextEditor
                        value={editableContent}
                        onChange={setEditableContent}
                        placeholder="输入正文，可以添加小红书表情..."
                        rows={14}
                        maxLength={1000}
                        showEmojiButton={true}
                        showStats={true}
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
                  {originalNote && originalNote.images.length > 0 && (
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

                  {/* 操作按钮 */}
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={handleSave}
                        disabled={!editableTitle || !editableContent || saveStatus === 'saving'}
                        className={`px-4 py-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          saveStatus === 'saved'
                            ? 'bg-green-500 text-white'
                            : saveStatus === 'error'
                            ? 'bg-red-500 text-white'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {saveStatus === 'saving' ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />保存中</>
                        ) : saveStatus === 'saved' ? (
                          <><Check className="w-4 h-4 mr-1.5" />已保存</>
                        ) : saveStatus === 'error' ? (
                          <><X className="w-4 h-4 mr-1.5" />失败</>
                        ) : (
                          <><Save className="w-4 h-4 mr-1.5" />保存</>
                        )}
                      </button>
                      <button
                        onClick={() => setShowPreview(true)}
                        disabled={!editableTitle || !editableContent}
                        className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-1.5" />
                        预览
                      </button>
                      <button
                        onClick={handlePublish}
                        disabled={!editableTitle || !editableContent || uploadedFiles.length === 0 || isPublishing}
                        className="px-4 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isPublishing ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{publishStep || '发布中'}</>
                        ) : (
                          <><Send className="w-4 h-4 mr-1.5" />发布</>
                        )}
                      </button>
                    </div>

                    {/* 提示信息 */}
                    {uploadedFiles.length === 0 && (
                      <p className="text-xs text-amber-600 text-center flex items-center justify-center gap-1">
                        <Info className="w-3 h-3" />
                        发布功能需要上传至少一张图片
                      </p>
                    )}
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
            {pageState === 'completed' && rewriteResult && !isEditingEmoji && (
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
                  <div className="pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        className={`px-6 py-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                          saveStatus === 'saved' ? 'bg-green-500 text-white'
                          : saveStatus === 'error' ? 'bg-red-500 text-white'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {saveStatus === 'saving' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中</> :
                         saveStatus === 'saved' ? <><Check className="w-4 h-4 mr-2" />已保存</> :
                         saveStatus === 'error' ? <><X className="w-4 h-4 mr-2" />失败</> :
                         <><Save className="w-4 h-4 mr-2" />保存</>}
                      </button>
                      <button
                        onClick={() => setShowPreview(true)}
                        className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        预览
                      </button>
                      <button
                        onClick={handleRegenerate}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新复刻
                      </button>
                      <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="px-6 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isPublishing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {publishStep || '发布中...'}
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
              </motion.div>
            )}

            {/* 表情编辑模式 */}
            <AnimatePresence>
              {(pageState === 'parsed' || pageState === 'completed') && isEditingEmoji && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* 标题 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
                        <Smile className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">添加小红书官方表情</h3>
                        <p className="text-sm text-gray-500">在关键位置添加表情，让笔记更生动有趣</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditingEmoji(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 标题编辑 */}
                  <div className="p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border-2 border-pink-100">
                    <XHSEmojiTextEditor
                      value={editableTitle}
                      onChange={setEditableTitle}
                      placeholder="编辑标题..."
                      label="标题"
                      rows={2}
                      maxLength={50}
                      showEmojiButton={true}
                      showStats={true}
                    />
                  </div>

                  {/* 正文编辑 */}
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-100">
                    <XHSEmojiTextEditor
                      value={editableContent}
                      onChange={setEditableContent}
                      placeholder="编辑正文，可以添加小红书表情..."
                      label="正文内容"
                      rows={14}
                      maxLength={1000}
                      showEmojiButton={true}
                      showStats={true}
                    />
                  </div>

                  {/* 使用提示 */}
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-800 mb-2">💡 表情使用建议</h4>
                        <ul className="text-xs text-gray-600 space-y-1">
                          <li>• <strong>开头</strong>：使用吸引眼球的表情（如 [派对R] [炸裂R]）</li>
                          <li>• <strong>重点</strong>：强调关键信息（如 [笑哭R] [赞R]）</li>
                          <li>• <strong>结尾</strong>：行动号召（如 [拿走R] [比心R]）</li>
                          <li>• <strong>频率</strong>：建议全文 5-8 个表情，每段 1-2 个</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="space-y-3 pt-4">
                    {/* 主要操作 */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          // 记录表情使用（用于学习用户偏好）
                          recordEmojiUsage(editableTitle, 'title')
                          recordEmojiUsage(editableContent, 'content')

                          // 保存更改
                          createHistoryVersion(
                            editableTitle,
                            editableContent,
                            editableTags,
                            'manual-edit'
                          )
                          setIsEditingEmoji(false)
                          alert('✅ 表情已添加，内容已保存！\n\n系统已记录你的表情使用偏好，下次 AI 改写会更符合你的风格。')
                        }}
                        className="flex-1 px-6 py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        保存表情
                      </button>
                      <button
                        onClick={() => setIsEditingEmoji(false)}
                        className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                      >
                        取消
                      </button>
                    </div>

                    {/* 快捷操作 */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          // 记录表情使用
                          recordEmojiUsage(editableTitle, 'title')
                          recordEmojiUsage(editableContent, 'content')
                          createHistoryVersion(editableTitle, editableContent, editableTags, 'manual-edit')
                          setIsEditingEmoji(false)
                          setShowPreview(true)
                        }}
                        disabled={!editableTitle || !editableContent}
                        className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        保存并预览
                      </button>
                      <button
                        onClick={() => {
                          // 记录表情使用
                          recordEmojiUsage(editableTitle, 'title')
                          recordEmojiUsage(editableContent, 'content')
                          createHistoryVersion(editableTitle, editableContent, editableTags, 'manual-edit')
                          setIsEditingEmoji(false)
                          handlePublish()
                        }}
                        disabled={!editableTitle || !editableContent || uploadedFiles.length === 0 || isPublishing}
                        className="px-4 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        保存并发布
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* 发布成功 - 二维码弹窗 */}
      {publishResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setPublishResult(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setPublishResult(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 成功图标 */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">发布成功！</h3>
              <p className="text-sm text-gray-600 mb-6 text-center">
                请使用手机微信扫描下方二维码，在手机端完成发布
              </p>

              {/* 二维码 */}
              <div className="w-full max-w-xs aspect-square bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200 mb-4">
                <img
                  src={publishResult.qrCodeUrl}
                  alt="发布二维码"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* 笔记ID */}
              {publishResult.noteId && (
                <p className="text-xs text-gray-500 mb-4">
                  笔记ID: {publishResult.noteId}
                </p>
              )}

              {/* 关闭按钮 */}
              <button
                onClick={() => setPublishResult(null)}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg hover:from-pink-600 hover:to-red-600 transition-all shadow-lg"
              >
                完成
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

// 主导出组件
export default function RewritePage() {
  return <RewritePageContent />
}
