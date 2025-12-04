'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Sparkles,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Download,
  RefreshCw,
  Globe,
  Wand2,
  Info,
  Paintbrush,
  MessageSquare,
  Layers,
  History,
  Clock
} from 'lucide-react'
import { motion } from 'framer-motion'
import GlassCard from '@/components/GlassCard'
import ImageUploader from '@/components/ImageUploader'
import ImageHistoryDrawer from '@/components/ImageHistoryDrawer'

// 生成模式
type GenerateMode = 'text-to-image' | 'image-to-image'
type ModelChoice = 'imagen' | 'gemini'

// 生成结果
interface GenerateResult {
  images: string[]
  sessionId?: string
  turnNumber?: number
  prompt: string
  mode: string
  model?: string
  duration: number
  conversationLength?: number
}

export default function ImageGeneratePage() {
  // 获取URL参数
  const searchParams = useSearchParams()

  // 状态管理
  const [modelChoice, setModelChoice] = useState<ModelChoice>('imagen')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '16:9' | '9:16'>('16:9')
  const [uploadedImage, setUploadedImage] = useState<string>('')
  const [resolution, setResolution] = useState<'2k' | '4k'>('2k')

  // 会话管理
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [turnNumber, setTurnNumber] = useState(1)

  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateResult | null>(null)

  // 历史记录抽屉
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // 检测URL参数，如果有history=true则打开抽屉
  useEffect(() => {
    if (searchParams.get('history') === 'true') {
      setIsHistoryOpen(true)
      // 清除URL参数（可选，保持URL干净）
      window.history.replaceState({}, '', '/image-generate')
    }
  }, [searchParams])

  // 生成图片
  const handleGenerate = async (continueSession: boolean = false) => {
    if (!prompt.trim()) {
      setError('请输入提示词或位置信息')
      return
    }

    // 自动判断生成模式：有图片 = 图生图，无图片 = 文字生图
    const actualMode: GenerateMode = (uploadedImage && !continueSession) ? 'image-to-image' : 'text-to-image'

    setIsGenerating(true)
    setError('')

    // 如果不是继续会话，清除旧结果
    if (!continueSession) {
      setResult(null)
      setCurrentSessionId(null)
      setTurnNumber(1)
    }

    try {
      console.log('[生图] 开始生成...')
      console.log('[生图] 参数:', {
        actualMode,
        modelChoice,
        prompt,
        aspectRatio,
        resolution,
        sessionId: continueSession ? currentSessionId : null
      })

      let response
      let data

      // 根据模型和模式选择不同的 API
      if (modelChoice === 'imagen') {
        // Imagen 4.0 模型
        if (actualMode === 'text-to-image') {
          // 文字生图：使用 generate API
          console.log('[生图] 使用 Imagen 4.0 文字生图')
          response = await fetch('/api/imagen/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              isTravelMode: false,
              aspectRatio,
              numberOfImages: 1,
              resolution
            })
          })
        } else {
          // 图生图：使用 edit API
          console.log('[生图] 使用 Imagen 4.0 图生图')
          response = await fetch('/api/imagen/edit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mode: 'image-to-image',
              prompt: prompt.trim(),
              uploadedImage: uploadedImage,
              aspectRatio,
              resolution,
              useImagen: true  // 标记使用 Imagen 4.0
            })
          })
        }
        data = await response.json()
      } else {
        // Gemini 3 Pro Image 模型（支持多轮对话）
        console.log('[生图] 使用 Gemini 3 Pro Image（支持联网+多轮对话）')
        const requestBody: any = {
          mode: actualMode,
          prompt: prompt.trim(),
          aspectRatio,
          resolution
        }

        // 添加会话ID（如果是继续编辑）
        if (continueSession && currentSessionId) {
          requestBody.sessionId = currentSessionId
        }

        // 添加图片（仅图生图模式的第一轮）
        if (actualMode === 'image-to-image' && uploadedImage && !continueSession) {
          requestBody.uploadedImage = uploadedImage
        }

        response = await fetch('/api/imagen/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })
        data = await response.json()
      }

      if (!data.success) {
        throw new Error(data.error || '生成失败')
      }

      console.log('[生图] 生成成功:', data.data)

      // 保存会话信息（仅 Gemini 模式）
      if (data.data.sessionId) {
        setCurrentSessionId(data.data.sessionId)
        setTurnNumber(data.data.turnNumber || 1)
      } else {
        // Imagen 模式不支持多轮对话，清除会话
        setCurrentSessionId(null)
        setTurnNumber(1)
      }

      setResult(data.data)

    } catch (err) {
      console.error('[生图] 生成失败:', err)
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 继续编辑
  const handleContinueEdit = () => {
    handleGenerate(true)
  }

  // 新建会话
  const handleNewSession = () => {
    setCurrentSessionId(null)
    setTurnNumber(1)
    setResult(null)
    setPrompt('')
    setUploadedImage('')
    setError('')
  }

  // 下载图片
  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `gemini-${Date.now()}-${index + 1}.png`
    link.click()
  }

  // 从历史记录继续会话
  const handleContinueFromHistory = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    // 可以选择性地加载会话信息
    console.log('[历史记录] 继续会话:', sessionId)
  }

  // 查看历史图片
  const handleViewHistoryImage = (imageUrl: string) => {
    // 在新标签页打开图片
    window.open(imageUrl, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8 relative">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 mr-3 text-blue-500" />
            AI 图片生成
          </h1>
          <p className="text-gray-600">
            使用 Google Imagen 4.0 和 Gemini 3 Pro Image 双引擎，支持多轮对话式编辑
          </p>
        </div>

        {/* 会话信息卡片（仅支持多轮对话的模式） */}
        {currentSessionId && modelChoice === 'gemini' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <GlassCard className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <MessageSquare className="w-5 h-5 text-blue-500 mr-2" />
                    <span className="text-sm font-medium text-gray-900">
                      会话 ID: <span className="font-mono text-xs">{currentSessionId.substring(0, 8)}...</span>
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Layers className="w-5 h-5 text-purple-500 mr-2" />
                    <span className="text-sm font-medium text-gray-900">
                      第 {turnNumber} 轮编辑
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleNewSession}
                  className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  disabled={isGenerating}
                >
                  新建会话
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：输入和设置 */}
          <div className="space-y-6">
            {/* 模型选择 */}
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                选择模型
              </h2>
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setModelChoice('imagen')
                      // Imagen 4.0 不支持多轮对话，清除会话
                      if (modelChoice !== 'imagen') {
                        handleNewSession()
                      }
                    }}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      modelChoice === 'imagen'
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300'
                    }`}
                    disabled={isGenerating}
                  >
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Imagen 4.0
                    <p className="text-[10px] mt-0.5 opacity-80">生图更精细</p>
                    <p className="text-[10px] mt-0.5 opacity-70">不支持联网和多轮对话</p>
                  </button>
                  <button
                    onClick={() => setModelChoice('gemini')}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      modelChoice === 'gemini'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }`}
                    disabled={isGenerating}
                  >
                    <Globe className="w-4 h-4 inline mr-1" />
                    Gemini 3 Pro Image
                    <p className="text-[10px] mt-0.5 opacity-80">支持联网，多轮对话</p>
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* 图片上传（可选，上传后自动切换为图生图模式） */}
            {!currentSessionId && (
              <GlassCard className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-green-500" />
                  上传图片（可选）
                </h2>
                <p className="text-xs text-gray-600 mb-3">
                  {uploadedImage ? '✓ 已上传图片，将使用图生图模式' : '上传图片后将自动切换为图生图模式'}
                </p>
                <ImageUploader
                  onImageSelect={setUploadedImage}
                  disabled={isGenerating}
                />
              </GlassCard>
            )}

            {/* 提示词输入 */}
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Wand2 className="w-5 h-5 mr-2 text-blue-500" />
                {currentSessionId ? '继续编辑指令' : uploadedImage ? '修改指令' : '输入提示词'}
              </h2>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  uploadedImage
                    ? '输入修改指令...\n例如：\n- 转成水彩画风格\n- 改成夜景\n- 添加雪景效果\n- 转成黑白照片'
                    : modelChoice === 'gemini'
                    ? '输入描述（支持联网）...\n例如：\n- 48.8584, 2.2945\n- 巴黎埃菲尔铁塔\n- 我想看东京春天的樱花'
                    : '输入图片描述...\n例如：A beautiful sunset over the ocean with sailing boats'
                }
                className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={6}
                disabled={isGenerating}
              />
            </GlassCard>

            {/* 图片设置 */}
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-purple-500" />
                图片设置
              </h2>

              {/* 宽高比 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  宽高比
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { value: '1:1', label: '1:1', desc: '正方形' },
                    { value: '3:4', label: '3:4', desc: '竖屏' },
                    { value: '4:3', label: '4:3', desc: '横屏' },
                    { value: '16:9', label: '16:9', desc: '宽屏' },
                    { value: '9:16', label: '9:16', desc: '手机' }
                  ].map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value as any)}
                      className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                        aspectRatio === ratio.value
                          ? 'bg-purple-500 text-white border-purple-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300'
                      }`}
                      disabled={isGenerating}
                      title={ratio.desc}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 分辨率选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分辨率
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: '2k', label: '2K', desc: '超清 (2560×1440)' },
                    { value: '4k', label: '4K', desc: '超高清 (3840×2160)' }
                  ].map((res) => (
                    <button
                      key={res.value}
                      onClick={() => setResolution(res.value as any)}
                      className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                        resolution === res.value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                      disabled={isGenerating}
                      title={res.desc}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 提示：分辨率越高，图片越清晰，但生成时间更长
                </p>
              </div>
            </GlassCard>

            {/* 生成按钮 */}
            <div className="space-y-2">
              {!currentSessionId || modelChoice === 'imagen' ? (
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 flex items-center justify-center shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      开始生成
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleContinueEdit}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-700 flex items-center justify-center shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      编辑中...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-5 h-5 mr-2" />
                      继续编辑（第 {turnNumber + 1} 轮）
                    </>
                  )}
                </button>
              )}
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 右侧：生成结果 */}
          <div>
            <GlassCard className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-green-500" />
                生成结果
              </h2>

              {!result && !isGenerating && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <ImageIcon className="w-16 h-16 mb-4" />
                  <p className="text-sm">暂无生成结果</p>
                  <p className="text-xs mt-1">输入提示词后点击"开始生成"</p>
                </div>
              )}

              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-sm text-gray-600">正在生成图片...</p>
                  <p className="text-xs text-gray-400 mt-1">预计需要 30-60 秒</p>
                </div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* 元信息 */}
                  <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                    {result.sessionId && (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium mr-2">会话 ID:</span>
                          <span className="font-mono">{result.sessionId.substring(0, 16)}...</span>
                        </div>
                        <div>
                          <span className="font-medium mr-2">第</span>
                          <span className="font-bold text-blue-600">{result.turnNumber}</span>
                          <span className="font-medium ml-1">轮</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="font-medium">模式:</span> {result.mode === 'text-to-image' ? '文字生图' : '图生图'}
                    </div>
                    <div>
                      <span className="font-medium">模型:</span> {result.model || 'Gemini 3 Pro Image'}
                    </div>
                    <div>
                      <span className="font-medium">提示词:</span> {result.prompt.substring(0, 100)}
                      {result.prompt.length > 100 && '...'}
                    </div>
                    <div>
                      <span className="font-medium">耗时:</span> {(result.duration / 1000).toFixed(1)}秒
                    </div>
                    {result.conversationLength && (
                      <div>
                        <span className="font-medium">对话历史:</span> {result.conversationLength} 条消息
                      </div>
                    )}
                  </div>

                  {/* 图片网格 */}
                  <div className={`grid gap-4 ${
                    result.images.length === 1 ? 'grid-cols-1' :
                    result.images.length === 2 ? 'grid-cols-2' :
                    'grid-cols-2'
                  }`}>
                    {result.images.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`生成图片 ${index + 1}`}
                          className="w-full h-auto rounded-lg shadow-md"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                          <button
                            onClick={() => handleDownload(imageUrl, index)}
                            className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-white text-gray-900 rounded-lg flex items-center shadow-lg transition-all hover:scale-105"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            下载
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </GlassCard>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8">
          <GlassCard className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <Info className="w-4 h-4 mr-2 text-blue-500" />
              使用说明
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                  <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                  Imagen 4.0 模型
                </h4>
                <p>专业生图模型，<span className="text-purple-600 font-semibold">生图更精细</span>。支持文字生图和图生图。<span className="text-orange-600">（不支持多轮对话）</span></p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                  <Globe className="w-3 h-3 mr-1 text-blue-500" />
                  Gemini 3 Pro Image 模型
                </h4>
                <p>多模态大模型，<span className="text-blue-600 font-semibold">支持联网</span>。支持文字生图和图生图。<span className="text-green-600">支持多轮对话式编辑。</span></p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                  <Paintbrush className="w-3 h-3 mr-1 text-green-500" />
                  图生图功能
                </h4>
                <p>两个模型都支持图生图。上传图片后，输入修改指令即可编辑。Gemini 模型支持多轮连续编辑。</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                  <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                  多轮对话
                </h4>
                <p>Gemini 3 Pro Image 支持多轮对话。使用 Thought Signatures 技术，每次生成都会记住之前的修改。</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* 历史记录抽屉 */}
      <ImageHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onContinueSession={handleContinueFromHistory}
        onViewImage={handleViewHistoryImage}
      />
    </div>
  )
}
