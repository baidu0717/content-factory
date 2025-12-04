'use client'

import React, { useState, useEffect } from 'react'
import {
  PenTool,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Loader2,
  ChevronRight,
  RefreshCw,
  Save,
  Send,
  Eye,
  Wand2,
  Settings,
  Hash,
  Type,
  AlignLeft,
  Palette,
  Target,
  BookOpen,
  Lightbulb,
  Copy,
  Check,
  X,
  Info,
  TrendingUp,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { Topic, InsightReport, GeneratedArticle } from '@/types/insights'
import { renderMarkdownContent } from '@/lib/markdown-renderer'

export default function CreatePage() {
  // ===== 状态管理 =====
  const [selectedSource, setSelectedSource] = useState<'insights' | 'custom'>('insights')

  // 洞察报告相关
  const [insightReports, setInsightReports] = useState<InsightReport[]>([])
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [loadingReports, setLoadingReports] = useState(true)

  // 选题相关
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<Topic | null>(null)
  const [showTopicDetailModal, setShowTopicDetailModal] = useState(false)

  // 自定义选题
  const [customTopic, setCustomTopic] = useState('')

  // 创作参数
  const [contentLength, setContentLength] = useState('1000-1500')
  const [writingStyle, setWritingStyle] = useState('professional')
  const [imageCount, setImageCount] = useState('3')

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null)
  const [copied, setCopied] = useState(false)

  // ===== 加载洞察报告 =====
  useEffect(() => {
    loadInsightReports()
  }, [])

  const loadInsightReports = async () => {
    try {
      setLoadingReports(true)
      const response = await fetch('/api/history?limit=100')
      const data = await response.json()

      if (data.success && data.history) {
        // 只保留有AI洞察的记录
        const reportsWithInsights: InsightReport[] = data.history
          .filter((item: any) => item.aiInsights && item.aiInsights.insights)
          .map((item: any) => ({
            id: item.id,
            keyword: item.keyword,
            platform: item.platform,
            timestamp: item.timestamp,
            insightCount: item.aiInsights.insights.length + (item.aiInsights.recommendedTopics?.length || 0),
            aiInsights: item.aiInsights
          }))

        setInsightReports(reportsWithInsights)
        console.log(`[创作页面] 加载了 ${reportsWithInsights.length} 个洞察报告`)
      }
    } catch (error) {
      console.error('[创作页面] 加载洞察报告失败:', error)
    } finally {
      setLoadingReports(false)
    }
  }

  // ===== 选择洞察报告 =====
  const handleReportChange = (reportId: string) => {
    const id = reportId ? parseInt(reportId) : null
    setSelectedReportId(id)

    if (id === null) {
      setTopics([])
      setSelectedTopics([])
      return
    }

    const report = insightReports.find(r => r.id === id)
    if (!report) return

    // 从洞察报告中提取选题
    const extractedTopics: Topic[] = []

    // 从 insights 提取
    if (report.aiInsights.insights) {
      report.aiInsights.insights.forEach((insight, index) => {
        extractedTopics.push({
          id: `insight-${report.id}-${index}`,
          title: insight.title,
          description: insight.description.substring(0, 100) + (insight.description.length > 100 ? '...' : ''),
          fullDescription: insight.description,
          creativeAdvice: insight.creativeAdvice,
          relatedKeywords: insight.relatedKeywords,
          supportingArticles: insight.supportingArticles,
          trend: insight.trend,
          timestamp: report.timestamp,
          source: '洞察报告',
          type: 'insight'
        })
      })
    }

    // 从 recommendedTopics 提取
    if (report.aiInsights.recommendedTopics) {
      report.aiInsights.recommendedTopics.forEach((topicTitle, index) => {
        extractedTopics.push({
          id: `topic-${report.id}-${index}`,
          title: topicTitle,
          description: `基于"${report.keyword}"的分析推荐的选题方向`,
          timestamp: report.timestamp,
          source: '推荐选题',
          type: 'recommended'
        })
      })
    }

    // 按时间倒序排序
    extractedTopics.sort((a, b) => b.timestamp - a.timestamp)

    setTopics(extractedTopics)
    setSelectedTopics([])

    console.log(`[创作页面] 从报告 "${report.keyword}" 提取了 ${extractedTopics.length} 个选题`)
  }

  // ===== 格式化相对时间 =====
  const formatRelativeTime = (timestamp: number): string => {
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

  // ===== 查看选题详情 =====
  const handleViewTopicDetail = (topic: Topic) => {
    setSelectedTopicDetail(topic)
    setShowTopicDetailModal(true)
  }

  // ===== 生成文章 =====
  const handleGenerate = async () => {
    // 参数验证
    if (selectedSource === 'insights' && selectedTopics.length === 0) {
      setGenerationError('请至少选择一个选题')
      return
    }
    if (selectedSource === 'custom' && !customTopic.trim()) {
      setGenerationError('请输入自定义选题内容')
      return
    }

    setIsGenerating(true)
    setGenerationError('')
    setShowPreview(false)

    try {
      let topicToGenerate: Topic

      if (selectedSource === 'custom') {
        // 自定义选题
        topicToGenerate = {
          id: 'custom',
          title: customTopic,
          description: customTopic,
          timestamp: Date.now(),
          source: '自定义输入',
          type: 'recommended'
        }
      } else {
        // 从选中的选题中获取第一个（如果多选，只用第一个）
        const firstSelectedId = selectedTopics[0]
        const topic = topics.find(t => t.id === firstSelectedId)
        if (!topic) {
          throw new Error('未找到选中的选题')
        }
        topicToGenerate = topic
      }

      console.log('[创作页面] 开始生成文章')
      console.log('[创作页面] 选题:', topicToGenerate.title)

      // 调用 API 生成文章
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topicToGenerate,
          params: {
            length: contentLength,
            style: writingStyle,
            imageCount: parseInt(imageCount),
            platform: insightReports.find(r => r.id === selectedReportId)?.platform || 'wechat'
          }
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '生成失败')
      }

      console.log('[创作页面] 文章生成成功')
      setGeneratedArticle(data.data)
      setShowPreview(true)

    } catch (error) {
      console.error('[创作页面] 生成失败:', error)
      setGenerationError(error instanceof Error ? error.message : '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // ===== 复制文章 =====
  const handleCopy = () => {
    if (!generatedArticle) return
    navigator.clipboard.writeText(generatedArticle.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ===== 保存草稿 =====
  const handleSave = async () => {
    if (!generatedArticle) return

    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: generatedArticle.title,
          content: generatedArticle.content,
          status: 'draft',
          platforms: [],
          source: selectedSource === 'custom' ? 'custom' : 'ai_generated',
          tags: [],
          wordCount: generatedArticle.wordCount,
          readingTime: generatedArticle.readingTime,
          images: generatedArticle.images || []
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('文章已保存到发布管理!')
      } else {
        alert('保存失败: ' + data.error)
      }
    } catch (error) {
      console.error('[保存草稿] 错误:', error)
      alert('保存失败，请重试')
    }
  }

  // ===== 重新生成 =====
  const handleRegenerate = () => {
    handleGenerate()
  }

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">内容创作</h1>
        <p className="text-gray-500 mt-1">基于AI智能生成高质量文章，自动配图，一键发布</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：创作设置 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 选题来源 */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
              选题来源
            </h2>
            <div className="space-y-3">
              <label className="flex items-center p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="source"
                  value="insights"
                  checked={selectedSource === 'insights'}
                  onChange={(e) => setSelectedSource(e.target.value as 'insights' | 'custom')}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium">从洞察报告选择</p>
                  <p className="text-sm text-gray-500">基于分析结果创作</p>
                </div>
              </label>
              <label className="flex items-center p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="source"
                  value="custom"
                  checked={selectedSource === 'custom'}
                  onChange={(e) => setSelectedSource(e.target.value as 'insights' | 'custom')}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium">自定义输入</p>
                  <p className="text-sm text-gray-500">输入自己的选题</p>
                </div>
              </label>
            </div>

            {/* 洞察报告下拉菜单 */}
            {selectedSource === 'insights' && (
              <div className="mt-4">
                {loadingReports ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">加载中...</span>
                  </div>
                ) : insightReports.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-600 mb-2">暂无洞察报告</p>
                    <Link href="/analysis" className="text-sm text-blue-600 hover:text-blue-700">
                      去选题分析
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedReportId || ''}
                    onChange={(e) => handleReportChange(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">请选择洞察报告</option>
                    {insightReports.map((report) => (
                      <option key={report.id} value={report.id}>
                        [{report.platform === 'wechat' ? '公众号' : '小红书'}] {report.keyword} - {formatRelativeTime(report.timestamp)} ({report.insightCount}条洞察)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* 选题列表或自定义输入 */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-500" />
              {selectedSource === 'insights' ? '可用选题' : '自定义选题'}
            </h2>
            {selectedSource === 'insights' ? (
              topics.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">请先选择洞察报告</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {topics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <label className="flex items-start cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTopics.includes(topic.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTopics([...selectedTopics, topic.id])
                            } else {
                              setSelectedTopics(selectedTopics.filter(id => id !== topic.id))
                            }
                          }}
                          className="mt-1 mr-3"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 line-clamp-1">{topic.title}</p>
                            {topic.trend && (
                              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${topic.trend === 'rising' ? 'bg-green-100 text-green-700' :
                                topic.trend === 'declining' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                {topic.trend === 'rising' ? '📈' : topic.trend === 'declining' ? '📉' : '➡️'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{topic.description}</p>
                          <div className="flex items-center mt-2 space-x-2 text-xs text-gray-400">
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatRelativeTime(topic.timestamp)}
                            </span>
                            <span>•</span>
                            <span>{topic.source}</span>
                            {topic.type === 'insight' && (
                              <>
                                <span>•</span>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handleViewTopicDetail(topic)
                                  }}
                                  className="text-blue-600 hover:text-blue-700 flex items-center"
                                >
                                  <Info className="w-3 h-3 mr-1" />
                                  详情
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <textarea
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="请输入您的选题内容..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            )}
          </div>

          {/* 创作参数 */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-500" />
              创作参数
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <AlignLeft className="w-4 h-4 inline mr-1" />
                  文章长度
                </label>
                <select
                  value={contentLength}
                  onChange={(e) => setContentLength(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="500-800">500-800字</option>
                  <option value="800-1200">800-1200字</option>
                  <option value="1000-1500">1000-1500字</option>
                  <option value="1500-2000">1500-2000字</option>
                  <option value="2000+">2000字以上</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  写作风格
                </label>
                <select
                  value={writingStyle}
                  onChange={(e) => setWritingStyle(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="professional">专业严谨</option>
                  <option value="casual">轻松活泼</option>
                  <option value="storytelling">故事叙述</option>
                  <option value="educational">教育科普</option>
                  <option value="emotional">情感共鸣</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  图片数量
                </label>
                <select
                  value={imageCount}
                  onChange={(e) => setImageCount(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="0">不插入图片</option>
                  <option value="1">1张</option>
                  <option value="2">2张</option>
                  <option value="3">3张</option>
                  <option value="5">5张</option>
                </select>
              </div>
            </div>

            {generationError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{generationError}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || (selectedSource === 'insights' ? selectedTopics.length === 0 : !customTopic)}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  开始创作
                </>
              )}
            </button>
          </div>
        </div>

        {/* 右侧：预览区 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 h-full">
            {!showPreview && !isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无内容</h3>
                <p className="text-gray-500 max-w-sm">
                  选择选题并设置参数后，点击"开始创作"生成文章
                </p>
              </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full p-12">
                <div className="relative">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-blue-500" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">AI正在创作中</h3>
                <p className="text-gray-500">请稍候，正在为您生成优质内容...</p>
                <div className="mt-6 space-y-2 text-sm text-gray-500">
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                    分析选题要点...
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                    生成文章大纲...
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                    撰写正文内容...
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                    插入相关图片...
                  </p>
                </div>
              </div>
            ) : generatedArticle ? (
              <div className="h-full flex flex-col">
                {/* 预览头部 */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">文章预览</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Type className="w-4 h-4" />
                      <span>{generatedArticle.wordCount}字</span>
                      <span className="text-gray-300">•</span>
                      <BookOpen className="w-4 h-4" />
                      <span>约{generatedArticle.readingTime}分钟</span>
                    </div>
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
                    <button
                      onClick={handleRegenerate}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      重新生成
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                    >
                      <Save className="w-4 h-4 mr-1.5" />
                      保存草稿
                    </button>
                  </div>
                </div>

                {/* 预览内容 */}
                <div className="flex-1 overflow-y-auto p-6">
                  <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    {generatedArticle.title}
                  </h1>

                  <div className="prose prose-lg max-w-none">
                    {renderMarkdownContent(generatedArticle.content)}
                  </div>
                </div>

                {/* 预览底部操作 */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    生成时间：{new Date().toLocaleString('zh-CN')}
                  </div>
                  <div className="flex items-center space-x-3">
                    <Link
                      href="/publish"
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      发布管理
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 选题详情弹窗 */}
      {showTopicDetailModal && selectedTopicDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowTopicDetailModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">选题详情</h2>
              <button
                onClick={() => setShowTopicDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 space-y-6">
              {/* 选题标题 */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedTopicDetail.title}</h3>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {selectedTopicDetail.source}
                  </span>
                  {selectedTopicDetail.trend && (
                    <span className={`px-2 py-1 rounded ${selectedTopicDetail.trend === 'rising' ? 'bg-green-100 text-green-700' :
                      selectedTopicDetail.trend === 'declining' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                      {selectedTopicDetail.trend === 'rising' ? '📈 上升趋势' :
                        selectedTopicDetail.trend === 'declining' ? '📉 下降趋势' : '➡️ 稳定'}
                    </span>
                  )}
                  <span className="text-gray-500 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatRelativeTime(selectedTopicDetail.timestamp)}
                  </span>
                </div>
              </div>

              {/* 详细描述 */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                  洞察描述
                </h4>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedTopicDetail.fullDescription || selectedTopicDetail.description}
                </p>
              </div>

              {/* 创作建议 */}
              {selectedTopicDetail.creativeAdvice && (
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-green-600" />
                    创作建议
                  </h4>
                  <p className="text-gray-700 leading-relaxed">
                    {selectedTopicDetail.creativeAdvice}
                  </p>
                </div>
              )}

              {/* 相关关键词 */}
              {selectedTopicDetail.relatedKeywords && selectedTopicDetail.relatedKeywords.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                    <Hash className="w-5 h-5 mr-2 text-blue-500" />
                    相关关键词
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTopicDetail.relatedKeywords.map((keyword, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 支撑文章 */}
              {selectedTopicDetail.supportingArticles && selectedTopicDetail.supportingArticles.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-purple-500" />
                    支撑文章
                  </h4>
                  <ul className="space-y-2">
                    {selectedTopicDetail.supportingArticles.map((article, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span>{article}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    // 选中这个选题并关闭弹窗
                    if (!selectedTopics.includes(selectedTopicDetail.id)) {
                      setSelectedTopics([...selectedTopics, selectedTopicDetail.id])
                    }
                    setShowTopicDetailModal(false)
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 font-medium"
                >
                  选择此选题
                </button>
                <button
                  onClick={() => setShowTopicDetailModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
