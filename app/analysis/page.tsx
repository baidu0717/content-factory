'use client'

import { useState } from 'react'
import {
  Search,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare,
  BarChart3,
  Loader2,
  ChevronRight,
  Download,
  RefreshCw,
  Sparkles,
  Target,
  Award,
  Zap,
  Hash,
  Clock,
  PenTool,
  AlertCircle,
  ExternalLink,
  X,
  Share2,
  Bookmark,
  History,
  Trash2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { searchWeChatArticles } from '@/lib/wechat-api'
import { WeChatArticle, WeChatArticleApiResponse } from '@/types/wechat-api'
import { searchXiaohongshuNotes, transformToNotes, fetchNotesWithDetails } from '@/lib/xiaohongshu-api'
import { XiaohongshuNote, XiaohongshuApiResponse } from '@/types/xiaohongshu-api'
import { AIInsightsResult } from '@/types/insights'
import { useEffect } from 'react'

// 历史记录类型定义
interface SearchHistory {
  id: number
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  timestamp: number
  resultCount: number
  articlesData?: any // 文章/笔记数据
  apiResponse?: any // API 响应数据
  aiInsights?: AIInsightsResult // AI 洞察结果
}

// 模拟的分析结果数据
const mockAnalysisResult = {
  topLikesArticles: [
    { title: '2024年最值得关注的10个营销趋势', likes: 12580, reads: 45000, engagement: '28%', url: '' },
    { title: '小红书爆款笔记创作指南', likes: 10234, reads: 38000, engagement: '27%', url: '' },
    { title: '私域运营：从0到1搭建完整体系', likes: 9876, reads: 35000, engagement: '28%', url: '' },
    { title: 'ChatGPT在内容创作中的实战应用', likes: 8965, reads: 32000, engagement: '28%', url: '' },
    { title: '品牌如何做好用户增长？', likes: 7854, reads: 28000, engagement: '28%', url: '' }
  ],
  topEngagementArticles: [
    { title: '月入10万的自媒体是如何炼成的？', likes: 5432, reads: 15000, engagement: '36%', url: '' },
    { title: '新手做公众号还有机会吗？', likes: 4321, reads: 12000, engagement: '36%', url: '' },
    { title: '内容变现的5种高效模式', likes: 6789, reads: 20000, engagement: '34%', url: '' },
    { title: '如何打造个人IP品牌？', likes: 5678, reads: 18000, engagement: '32%', url: '' },
    { title: '社群运营实战技巧分享', likes: 4567, reads: 15000, engagement: '30%', url: '' }
  ],
  wordCloud: [
    { word: '营销', count: 156, size: 48 },
    { word: '内容', count: 145, size: 46 },
    { word: '用户', count: 134, size: 44 },
    { word: '增长', count: 123, size: 42 },
    { word: '私域', count: 112, size: 40 },
    { word: '品牌', count: 98, size: 38 },
    { word: '流量', count: 87, size: 36 },
    { word: '变现', count: 76, size: 34 },
    { word: 'AI', count: 65, size: 32 },
    { word: '社群', count: 54, size: 30 },
    { word: '直播', count: 43, size: 28 },
    { word: '短视频', count: 42, size: 26 },
    { word: '公众号', count: 41, size: 24 },
    { word: '小红书', count: 40, size: 22 },
    { word: 'IP', count: 39, size: 20 }
  ],
  insights: [
    {
      title: 'AI工具成为内容创作新趋势',
      description: '超过60%的高互动文章提到了AI工具的应用，特别是ChatGPT在内容创作、选题分析等方面的实战经验分享。',
      confidence: 92
    },
    {
      title: '私域运营仍是热门话题',
      description: '私域流量池的搭建和维护依然是品牌方关注的重点，相关内容平均互动率高出其他话题15%。',
      confidence: 88
    },
    {
      title: '个人IP打造需求旺盛',
      description: '关于个人品牌建设、IP变现的内容获得了极高的关注度，说明创作者对个人品牌价值的重视程度不断提升。',
      confidence: 85
    },
    {
      title: '实战案例类内容更受欢迎',
      description: '包含具体数据、实操步骤的文章互动率普遍更高，读者更倾向于学习可落地的方法论。',
      confidence: 90
    },
    {
      title: '视频化内容需求增长',
      description: '提到短视频、直播的文章数量环比增长30%，说明图文创作者也在积极拥抱视频化趋势。',
      confidence: 82
    }
  ],
  stats: {
    totalArticles: 156,
    avgReads: 28500,
    avgLikes: 2340,
    avgEngagement: '8.2%'
  }
}

const chartData = [
  { name: '0-1k', value: 12 },
  { name: '1k-5k', value: 34 },
  { name: '5k-10k', value: 45 },
  { name: '10k-20k', value: 38 },
  { name: '20k+', value: 27 },
]

export default function AnalysisPage() {
  const [platform, setPlatform] = useState<'wechat' | 'xiaohongshu'>('wechat')
  const [keyword, setKeyword] = useState('')
  const [period, setPeriod] = useState(30) // 时间范围（天数）
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [progress, setProgress] = useState(0)
  const [articles, setArticles] = useState<WeChatArticle[]>([])
  const [notes, setNotes] = useState<XiaohongshuNote[]>([])
  const [apiResponse, setApiResponse] = useState<WeChatArticleApiResponse | null>(null)
  const [xhsApiResponse, setXhsApiResponse] = useState<XiaohongshuApiResponse | null>(null)
  const [error, setError] = useState<string>('')
  const [selectedNote, setSelectedNote] = useState<XiaohongshuNote | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [aiInsights, setAiInsights] = useState<AIInsightsResult | null>(null)

  // 从数据库加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/history?limit=50')
        const data = await response.json()

        if (data.success && data.history) {
          setSearchHistory(data.history)
        }
      } catch (error) {
        console.error('加载历史记录失败:', error)
      }
    }
    loadHistory()
  }, [])

  // 保存历史记录到数据库
  const saveSearchHistory = async (historyData: {
    keyword: string
    platform: 'wechat' | 'xiaohongshu'
    timestamp: number
    resultCount: number
    articlesData?: any
    apiResponse?: any
    aiInsights?: AIInsightsResult
  }) => {
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(historyData),
      })

      const data = await response.json()

      if (data.success) {
        // 重新加载历史记录
        const historyResponse = await fetch('/api/history?limit=50')
        const historyData = await historyResponse.json()
        if (historyData.success) {
          setSearchHistory(historyData.history)
        }
      }
    } catch (error) {
      console.error('保存历史记录失败:', error)
    }
  }

  // 清空历史记录
  const clearHistory = async () => {
    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSearchHistory([])
      }
    } catch (error) {
      console.error('清空历史记录失败:', error)
    }
  }

  // 删除单条历史记录
  const deleteHistoryItem = async (id: number) => {
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // 从本地状态中移除
        setSearchHistory(searchHistory.filter(item => item.id !== id))
      }
    } catch (error) {
      console.error('删除历史记录失败:', error)
    }
  }

  // 点击历史记录加载历史数据
  const handleHistoryClick = async (history: SearchHistory) => {
    try {
      setShowHistoryModal(false)
      setKeyword(history.keyword)
      setPlatform(history.platform)

      // 如果有保存的数据，直接加载并显示
      if (history.articlesData) {
        if (history.platform === 'wechat') {
          setArticles(history.articlesData)
          setApiResponse(history.apiResponse)
        } else {
          setNotes(history.articlesData)
          setXhsApiResponse(history.apiResponse)
        }

        // 恢复 AI 洞察数据
        if (history.aiInsights) {
          setAiInsights(history.aiInsights)
          console.log('[历史记录] 已恢复 AI 洞察数据')
        } else {
          setAiInsights(null)
          console.log('[历史记录] 该记录没有 AI 洞察数据')
        }

        setShowResult(true)
      }
    } catch (error) {
      console.error('加载历史记录数据失败:', error)
    }
  }

  // 计算真实统计数据
  const calculateStats = () => {
    if (platform === 'wechat') {
      if (!articles || articles.length === 0) {
        return mockAnalysisResult.stats
      }

      const totalArticles = articles.length
      const totalReads = articles.reduce((sum, article) => sum + (article.read || 0), 0)
      const totalLikes = articles.reduce((sum, article) => sum + (article.praise || 0), 0)
      const avgReads = Math.round(totalReads / totalArticles)
      const avgLikes = Math.round(totalLikes / totalArticles)
      const avgEngagement = totalReads > 0 ? ((totalLikes / totalReads) * 100).toFixed(1) + '%' : '0%'

      return {
        totalArticles,
        avgReads,
        avgLikes,
        avgEngagement,
      }
    } else {
      // 小红书统计
      if (!notes || notes.length === 0) {
        return {
          totalArticles: 0,
          avgReads: 0,
          avgLikes: 0,
          avgEngagement: '0%',
        }
      }

      const totalNotes = notes.length
      const totalLikes = notes.reduce((sum, note) => sum + (note.liked_count || 0), 0)
      const totalCollects = notes.reduce((sum, note) => sum + (note.collected_count || 0), 0)
      const totalInteract = notes.reduce((sum, note) => sum + (note.interact_count || 0), 0)
      const avgLikes = Math.round(totalLikes / totalNotes)
      const avgCollects = Math.round(totalCollects / totalNotes)
      const avgInteract = Math.round(totalInteract / totalNotes)

      return {
        totalArticles: totalNotes,
        avgReads: avgCollects, // 用收藏数代替阅读数
        avgLikes,
        avgEngagement: avgInteract.toString(), // 用互动总数代替互动率
      }
    }
  }

  // 获取点赞TOP5文章
  const getTopLikesArticles = () => {
    if (platform === 'wechat') {
      if (!articles || articles.length === 0) {
        return mockAnalysisResult.topLikesArticles
      }

      return [...articles]
        .sort((a, b) => (b.praise || 0) - (a.praise || 0))
        .slice(0, 5)
        .map(article => ({
          title: article.title,
          likes: article.praise || 0,
          reads: article.read || 0,
          engagement: article.read > 0 ? ((article.praise / article.read) * 100).toFixed(0) + '%' : '0%',
          url: article.url || article.short_link || '',
        }))
    } else {
      // 小红书
      if (!notes || notes.length === 0) {
        return []
      }

      return [...notes]
        .sort((a, b) => (b.liked_count || 0) - (a.liked_count || 0))
        .slice(0, 5)
        .map(note => ({
          id: note.id,
          title: note.title,
          likes: note.liked_count || 0,
          reads: note.collected_count || 0, // 收藏数
          engagement: note.interact_count.toString(), // 互动总数
          url: `https://www.xiaohongshu.com/explore/${note.id}`, // 小红书笔记URL
        }))
    }
  }

  // 获取互动率TOP5文章
  const getTopEngagementArticles = () => {
    if (platform === 'wechat') {
      if (!articles || articles.length === 0) {
        return mockAnalysisResult.topEngagementArticles
      }

      return [...articles]
        .filter(article => article.read > 0)
        .sort((a, b) => {
          const engagementA = a.praise / a.read
          const engagementB = b.praise / b.read
          return engagementB - engagementA
        })
        .slice(0, 5)
        .map(article => ({
          title: article.title,
          likes: article.praise || 0,
          reads: article.read || 0,
          engagement: ((article.praise / article.read) * 100).toFixed(0) + '%',
          url: article.url || article.short_link || '',
        }))
    } else {
      // 小红书
      if (!notes || notes.length === 0) {
        return []
      }

      return [...notes]
        .sort((a, b) => (b.interact_count || 0) - (a.interact_count || 0))
        .slice(0, 5)
        .map(note => ({
          id: note.id,
          title: note.title,
          likes: note.liked_count || 0,
          reads: note.collected_count || 0,
          engagement: note.interact_count.toString(),
          url: `https://www.xiaohongshu.com/explore/${note.id}`,
        }))
    }
  }

  const stats = calculateStats()
  const topLikesArticles = getTopLikesArticles()
  const topEngagementArticles = getTopEngagementArticles()

  // 处理点击笔记/文章
  const handleItemClick = (item: any) => {
    if (platform === 'xiaohongshu' && item.id) {
      // 小红书笔记，显示弹窗
      const fullNote = notes.find(note => note.id === item.id)
      if (fullNote) {
        console.log('🔍 点击查看笔记详情:', {
          id: fullNote.id,
          title: fullNote.title,
          hasContent: !!fullNote.content,
          content: fullNote.content
        })
        setSelectedNote(fullNote)
        setShowNoteModal(true)
      }
    } else if (platform === 'wechat' && item.url) {
      // 公众号文章，直接跳转
      window.open(item.url, '_blank')
    }
  }

  const handleAnalysis = async () => {
    if (!keyword) return

    setIsAnalyzing(true)
    setProgress(0)
    setShowResult(false)
    setError('')

    try {
      // 阶段1: 开始获取数据
      setProgress(10)

      let resultCount = 0
      let savedArticlesData: any = null
      let savedApiResponse: any = null

      if (platform === 'wechat') {
        // 调用API获取公众号文章
        const response = await searchWeChatArticles({
          kw: keyword,
          sort_type: 1,
          mode: 1,
          period: period, // 使用用户选择的时间范围
          page: 1,
          type: 1,
        })

        setProgress(30)
        setApiResponse(response)
        setArticles(response.data || [])
        resultCount = response.data?.length || 0

        // 保存用于历史记录
        savedArticlesData = response.data || []
        savedApiResponse = response
      } else {
        // 调用API获取小红书笔记
        console.log('🔍 开始搜索小红书笔记，关键词:', keyword)
        const response = await searchXiaohongshuNotes({
          type: 1,
          keyword: keyword,
          page: 1,
          sort: 'general',
          note_type: 'image',
          note_time: '不限',
          note_range: '不限',
          proxy: '',
        })

        console.log('📊 搜索结果:', {
          code: response.code,
          itemCount: response.items?.length || 0,
          hasMore: response.has_more
        })

        setProgress(30)
        setXhsApiResponse(response)
        const transformedNotes = transformToNotes(response)
        console.log('✅ 转换后的笔记数量:', transformedNotes.length)

        // 获取笔记详情（正文内容）
        setProgress(40)
        console.log('📝 开始批量获取笔记详情...')
        const notesWithDetails = await fetchNotesWithDetails(transformedNotes)
        console.log('✅ 获取详情完成，笔记列表:', notesWithDetails.map(n => ({
          id: n.id,
          title: n.title,
          hasContent: !!n.content,
          contentLength: n.content?.length || 0
        })))

        setNotes(notesWithDetails)
        resultCount = notesWithDetails.length

        // 保存用于历史记录
        savedArticlesData = notesWithDetails
        savedApiResponse = response
      }

      // 阶段2: 准备 AI 分析数据并调用 AI 分析
      setProgress(40)

      let aiInsightsResult: AIInsightsResult | null = null

      try {
        // 筛选 TOP 10 文章（点赞 TOP5 + 互动率 TOP5）
        let topArticles: Array<{
          title: string
          content: string
          likes: number
          reads: number
          url?: string
        }> = []

        if (platform === 'wechat' && savedArticlesData && savedArticlesData.length > 0) {
          // 公众号文章处理
          const articlesWithEngagement = savedArticlesData.map((article: WeChatArticle) => ({
            ...article,
            engagement: article.read > 0 ? article.praise / article.read : 0
          }))

          // 点赞 TOP5
          const topLikes = [...articlesWithEngagement]
            .sort((a, b) => b.praise - a.praise)
            .slice(0, 5)

          // 互动率 TOP5
          const topEngagement = [...articlesWithEngagement]
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 5)

          // 合并并去重
          const uniqueArticles = new Map()
            ;[...topLikes, ...topEngagement].forEach(article => {
              uniqueArticles.set(article.title, {
                title: article.title,
                content: article.content || '',
                likes: article.praise || 0,
                reads: article.read || 0,
                url: article.url || article.short_link
              })
            })

          topArticles = Array.from(uniqueArticles.values())
          console.log(`[分析] 筛选出 ${topArticles.length} 篇公众号文章进行 AI 分析`)
        } else if (platform === 'xiaohongshu' && savedArticlesData && savedArticlesData.length > 0) {
          // 小红书笔记处理
          const notesWithEngagement = savedArticlesData.map((note: XiaohongshuNote) => ({
            ...note,
            engagement: note.liked_count / (note.liked_count + note.collected_count + note.comment_count)
          }))

          // 点赞 TOP5
          const topLikes = [...notesWithEngagement]
            .sort((a, b) => b.liked_count - a.liked_count)
            .slice(0, 5)

          // 互动率 TOP5
          const topEngagement = [...notesWithEngagement]
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 5)

          // 合并并去重
          const uniqueNotes = new Map()
            ;[...topLikes, ...topEngagement].forEach(note => {
              uniqueNotes.set(note.id, {
                title: note.title,
                content: note.content || '',
                likes: note.liked_count || 0,
                reads: note.interact_count || 0,
                url: `https://www.xiaohongshu.com/explore/${note.id}`
              })
            })

          topArticles = Array.from(uniqueNotes.values())
          console.log(`[分析] 筛选出 ${topArticles.length} 篇小红书笔记进行 AI 分析`)
        }

        // 调用 AI 洞察 API
        if (topArticles.length > 0) {
          console.log('[分析] 开始调用 AI 洞察 API...')
          setProgress(50)

          const aiResponse = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              keyword,
              platform,
              articles: topArticles
            }),
          })

          setProgress(70)

          if (!aiResponse.ok) {
            throw new Error(`AI 分析失败: ${aiResponse.status}`)
          }

          const aiData = await aiResponse.json()

          if (aiData.success && aiData.data) {
            aiInsightsResult = aiData.data
            setAiInsights(aiInsightsResult)
            console.log('[分析] AI 洞察生成成功:', {
              summaries: aiInsightsResult?.summaries?.length,
              insights: aiInsightsResult?.insights?.length
            })
          } else {
            throw new Error(aiData.error || 'AI 分析失败')
          }

          setProgress(90)
        } else {
          console.log('[分析] 没有足够的文章进行 AI 分析，跳过')
          setProgress(90)
        }
      } catch (aiError) {
        console.error('[分析] AI 洞察生成失败:', aiError)
        // AI 分析失败不影响整体流程，继续显示结果
        setError(`AI 洞察生成失败: ${aiError instanceof Error ? aiError.message : '未知错误'}`)
        setProgress(90)
      }

      // 完成
      await new Promise(resolve => setTimeout(resolve, 500))
      setProgress(100)
      setIsAnalyzing(false)
      setShowResult(true)

      // 保存搜索历史（包含 AI 洞察结果）
      await saveSearchHistory({
        keyword,
        platform,
        timestamp: Date.now(),
        resultCount,
        articlesData: savedArticlesData,
        apiResponse: savedApiResponse,
        aiInsights: aiInsightsResult || undefined,
      })
    } catch (err) {
      console.error('分析失败:', err)
      setError(err instanceof Error ? err.message : '分析失败，请重试')
      setIsAnalyzing(false)
      setProgress(0)
    }
  }

  return (
    <div className="p-3 sm:p-6">
      {/* 页面标题 */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">选题分析</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            输入关键词，AI智能分析{platform === 'wechat' ? `公众号文章（最近${period}天）` : '小红书笔记'}，生成选题洞察报告
          </p>
        </div>
        <button
          onClick={() => setShowHistoryModal(true)}
          className="px-3 sm:px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center space-x-2 transition-colors text-sm sm:text-base flex-shrink-0"
        >
          <History className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>历史记录</span>
          {searchHistory.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {searchHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* 搜索区域 */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 mb-4 sm:mb-6">
        {/* 平台选择 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-600 font-medium">选择平台：</span>
          <button
            onClick={() => setPlatform('wechat')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${platform === 'wechat'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            公众号
          </button>
          <button
            onClick={() => setPlatform('xiaohongshu')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${platform === 'xiaohongshu'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            小红书
          </button>
        </div>

        {/* 时间范围选择（仅公众号） */}
        {platform === 'wechat' && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600 font-medium flex items-center">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              时间范围：
            </span>
            {[7, 15, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${period === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {days}天
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start gap-3 sm:space-x-4">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={
                  platform === 'wechat'
                    ? '输入关键词，如：营销、内容运营、私域流量...'
                    : '输入关键词，如：美妆、穿搭、美食、旅行...'
                }
                className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                onKeyPress={(e) => e.key === 'Enter' && handleAnalysis()}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
              <span className="flex-shrink-0">热门关键词：</span>
              {platform === 'wechat'
                ? ['AI创作', '私域运营', '内容营销', '用户增长'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setKeyword(tag)}
                    className="text-blue-500 hover:text-blue-600 whitespace-nowrap"
                  >
                    {tag}
                  </button>
                ))
                : ['美妆', '穿搭', '美食', '旅行'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setKeyword(tag)}
                    className="text-red-500 hover:text-red-600 whitespace-nowrap"
                  >
                    {tag}
                  </button>
                ))}
            </div>
          </div>
          <button
            onClick={handleAnalysis}
            disabled={!keyword || isAnalyzing}
            className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-white hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2 flex-shrink-0 text-sm sm:text-base ${platform === 'wechat' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'
              }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>分析中...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>开始分析</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-start space-x-2 sm:space-x-3">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 text-sm sm:text-base">请求失败</h3>
            <p className="text-xs sm:text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 分析进度 */}
      {isAnalyzing && (
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-gray-700">分析进度</span>
            <span className="text-xs sm:text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-4 space-y-2">
            <div className={`flex items-center text-xs sm:text-sm ${progress >= 20 ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full mr-2 flex items-center justify-center flex-shrink-0 ${progress >= 20 ? 'bg-green-500' : 'bg-gray-300'}`}>
                {progress >= 20 && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="break-words">{platform === 'wechat' ? '正在获取公众号文章...' : '正在获取小红书笔记...'}</span>
            </div>
            <div className={`flex items-center text-xs sm:text-sm ${progress >= 50 ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full mr-2 flex items-center justify-center flex-shrink-0 ${progress >= 50 ? 'bg-green-500' : 'bg-gray-300'}`}>
                {progress >= 50 && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="break-words">{platform === 'wechat' ? 'AI分析文章内容...' : 'AI分析笔记内容...'}</span>
            </div>
            <div className={`flex items-center text-xs sm:text-sm ${progress >= 80 ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full mr-2 flex items-center justify-center flex-shrink-0 ${progress >= 80 ? 'bg-green-500' : 'bg-gray-300'}`}>
                {progress >= 80 && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="break-words">生成选题洞察...</span>
            </div>
            <div className={`flex items-center text-xs sm:text-sm ${progress >= 100 ? 'text-gray-900' : 'text-gray-400'}`}>
              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full mr-2 flex items-center justify-center flex-shrink-0 ${progress >= 100 ? 'bg-green-500' : 'bg-gray-300'}`}>
                {progress >= 100 && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="break-words">报告生成完成</span>
            </div>
          </div>
        </div>
      )}


      {/* 分析结果 */}
      {showResult && (
        <div className="space-y-4 sm:space-y-6">
          {/* 统计概览 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs sm:text-sm">{platform === 'wechat' ? '分析文章数' : '分析笔记数'}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.totalArticles}</p>
                </div>
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mt-2 sm:mt-0" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs sm:text-sm">{platform === 'wechat' ? '平均阅读量' : '平均收藏数'}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.avgReads.toLocaleString()}</p>
                </div>
                <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mt-2 sm:mt-0" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs sm:text-sm">平均点赞数</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.avgLikes.toLocaleString()}</p>
                </div>
                <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 mt-2 sm:mt-0" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <p className="text-gray-500 text-xs sm:text-sm">{platform === 'wechat' ? '平均互动率' : '平均互动数'}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.avgEngagement}</p>
                </div>
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 mt-2 sm:mt-0" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* 点赞TOP5 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-yellow-500" />
                  点赞量TOP5
                </h2>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {topLikesArticles.map((article, index) => (
                  <div
                    key={index}
                    className={`p-2.5 sm:p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group ${platform === 'xiaohongshu' || article.url ? 'cursor-pointer active:bg-gray-200' : ''}`}
                    onClick={() => handleItemClick(article)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start">
                          <span className="text-base sm:text-lg font-bold text-yellow-500 mr-2 flex-shrink-0">#{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-medium text-gray-900 line-clamp-2 sm:line-clamp-1 transition-colors text-sm sm:text-base ${platform === 'xiaohongshu' || article.url ? 'group-hover:text-blue-600' : ''}`}>{article.title}</h3>
                            {(platform === 'xiaohongshu' || article.url) && <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 ml-1 text-gray-400 group-hover:text-blue-600 inline-block flex-shrink-0" />}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center mt-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span className="flex items-center whitespace-nowrap">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {article.reads.toLocaleString()}
                          </span>
                          <span className="flex items-center whitespace-nowrap">
                            <Heart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-red-500" />
                            {article.likes.toLocaleString()}
                          </span>
                          <span className="flex items-center whitespace-nowrap">
                            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-green-500" />
                            {article.engagement}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 互动率TOP5 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-500" />
                  互动率TOP5
                </h2>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {topEngagementArticles.map((article, index) => (
                  <div
                    key={index}
                    className={`p-2.5 sm:p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group ${platform === 'xiaohongshu' || article.url ? 'cursor-pointer active:bg-gray-200' : ''}`}
                    onClick={() => handleItemClick(article)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start">
                          <span className="text-base sm:text-lg font-bold text-purple-500 mr-2 flex-shrink-0">#{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-medium text-gray-900 line-clamp-2 sm:line-clamp-1 transition-colors text-sm sm:text-base ${platform === 'xiaohongshu' || article.url ? 'group-hover:text-blue-600' : ''}`}>{article.title}</h3>
                            {(platform === 'xiaohongshu' || article.url) && <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 ml-1 text-gray-400 group-hover:text-blue-600 inline-block flex-shrink-0" />}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center mt-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <span className="flex items-center whitespace-nowrap">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {article.reads.toLocaleString()}
                          </span>
                          <span className="flex items-center whitespace-nowrap">
                            <Heart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-red-500" />
                            {article.likes.toLocaleString()}
                          </span>
                          <span className="flex items-center text-purple-600 font-semibold whitespace-nowrap">
                            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {article.engagement}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* 高频词云 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                  <Hash className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" />
                  高频词云
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {mockAnalysisResult.wordCloud.map((item, index) => (
                  <span
                    key={index}
                    className="px-2 sm:px-3 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    style={{ fontSize: `${Math.max(10, 10 + item.size / 5)}px` }}
                  >
                    {item.word}
                    <span className="ml-1 text-xs opacity-60">({item.count})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* 阅读量分布 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500" />
                  阅读量分布
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="#999" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#999" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 时间分布 */}
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-orange-500" />
                  发布时间分布
                </h2>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {[
                  { time: '08:00-10:00', percent: 85, count: 23 },
                  { time: '10:00-12:00', percent: 65, count: 18 },
                  { time: '14:00-16:00', percent: 45, count: 12 },
                  { time: '18:00-20:00', percent: 92, count: 25 },
                  { time: '20:00-22:00', percent: 78, count: 21 }
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm text-gray-600 w-20 sm:w-24 flex-shrink-0">{item.time}</span>
                    <div className="flex-1 min-w-0">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 w-6 sm:w-8 text-right flex-shrink-0">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI 文章摘要分析 */}
          {aiInsights && aiInsights.summaries && aiInsights.summaries.length > 0 && (
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center flex-wrap gap-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  <span>AI 文章摘要分析</span>
                  <span className="text-xs sm:text-sm text-gray-500 font-normal">
                    ({aiInsights.summaries.length} 篇 TOP 文章)
                  </span>
                </h2>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {aiInsights.summaries.map((summary, index) => (
                  <div key={index} className="p-3 sm:p-5 rounded-lg sm:rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-colors bg-gradient-to-br from-gray-50 to-blue-50">
                    {/* 文章标题和指标 */}
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <h3 className="font-bold text-gray-900 text-sm sm:text-base break-words">
                            {summary.articleUrl ? (
                              <a href={summary.articleUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 inline-flex items-center flex-wrap gap-1">
                                <span className="break-words">{summary.articleTitle}</span>
                                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              </a>
                            ) : (
                              summary.articleTitle
                            )}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                          <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-100 text-purple-700 rounded-full font-medium whitespace-nowrap">
                            {summary.contentType}
                          </span>
                          <span className="text-gray-600 flex items-center whitespace-nowrap">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {summary.metrics.reads.toLocaleString()}
                          </span>
                          <span className="text-gray-600 flex items-center whitespace-nowrap">
                            <Heart className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            {summary.metrics.likes.toLocaleString()}
                          </span>
                          <span className="text-gray-600 whitespace-nowrap">
                            互动率: {summary.metrics.engagement}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 内容摘要 */}
                    <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-white rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                        {summary.summary}
                      </p>
                    </div>

                    {/* 目标受众 */}
                    <div className="mb-2 sm:mb-3">
                      <span className="text-xs sm:text-sm text-gray-600 font-medium">目标受众: </span>
                      <span className="text-xs sm:text-sm text-gray-800">{summary.targetAudience}</span>
                    </div>

                    {/* 关键词 */}
                    <div className="mb-2 sm:mb-3">
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm text-gray-600 font-medium">关键词:</span>
                        {summary.keywords.map((keyword, kidx) => (
                          <span key={kidx} className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 文章亮点 */}
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 font-medium mb-2">文章亮点:</p>
                      <ul className="space-y-1">
                        {summary.highlights.map((highlight, hidx) => (
                          <li key={hidx} className="text-xs sm:text-sm text-gray-700 flex items-start">
                            <span className="text-blue-500 mr-2 flex-shrink-0">✓</span>
                            <span className="break-words">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 选题洞察 */}
          {aiInsights && aiInsights.insights && aiInsights.insights.length > 0 ? (
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex flex-wrap items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                  <span>AI 选题洞察</span>
                  <span className="text-xs sm:text-sm text-gray-500 font-normal">
                    (生成了 {aiInsights.insights.length} 条洞察)
                  </span>
                </h2>
                <div className="flex gap-2">
                  <button className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 flex items-center">
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    下载报告
                  </button>
                </div>
              </div>

              {/* 整体趋势总结 */}
              {aiInsights.overallTrends && aiInsights.overallTrends.length > 0 && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg sm:rounded-xl border border-yellow-200">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center text-sm sm:text-base">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-orange-600" />
                    整体趋势
                  </h3>
                  <ul className="space-y-1 sm:space-y-2">
                    {aiInsights.overallTrends.map((trend, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-700 flex items-start">
                        <span className="text-orange-500 mr-2 font-bold flex-shrink-0">•</span>
                        <span className="break-words">{trend}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 洞察列表 */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                {aiInsights.insights.map((insight, index) => (
                  <div key={index} className="p-3 sm:p-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-100 hover:border-blue-300 transition-colors">
                    <div className="flex items-start gap-2 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-base sm:text-lg shadow-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 标题和趋势 */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <h3 className="font-bold text-gray-900 text-sm sm:text-lg break-words">{insight.title}</h3>
                          {insight.trend && (
                            <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-semibold self-start ${insight.trend === 'rising' ? 'bg-green-100 text-green-700' :
                                insight.trend === 'declining' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                              }`}>
                              {insight.trend === 'rising' ? '📈 上升' : insight.trend === 'declining' ? '📉 下降' : '➡️ 稳定'}
                            </span>
                          )}
                        </div>

                        {/* 详细描述 */}
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mb-2 sm:mb-3 break-words">
                          {insight.description}
                        </p>

                        {/* 支撑文章 */}
                        {insight.supportingArticles && insight.supportingArticles.length > 0 && (
                          <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-white rounded-lg">
                            <p className="text-xs sm:text-sm text-gray-600 font-medium mb-2">📚 支撑文章:</p>
                            <ul className="space-y-1">
                              {insight.supportingArticles.map((article, aidx) => (
                                <li key={aidx} className="text-xs text-gray-600 flex items-start">
                                  <span className="text-blue-500 mr-2 flex-shrink-0">•</span>
                                  <span className="break-words">{article}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 创作建议 */}
                        {insight.creativeAdvice && (
                          <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                            <p className="text-xs sm:text-sm text-gray-600 font-medium mb-1 flex items-center">
                              <Target className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-green-600" />
                              创作建议:
                            </p>
                            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed break-words">
                              {insight.creativeAdvice}
                            </p>
                          </div>
                        )}

                        {/* 相关关键词 */}
                        {insight.relatedKeywords && insight.relatedKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            <span className="text-xs text-gray-600 font-medium flex-shrink-0">🏷️ 相关:</span>
                            {insight.relatedKeywords.map((keyword, kidx) => (
                              <span key={kidx} className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 推荐选题方向 */}
              {aiInsights.recommendedTopics && aiInsights.recommendedTopics.length > 0 && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg sm:rounded-xl border border-purple-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600" />
                    推荐选题方向
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {aiInsights.recommendedTopics.map((topic, index) => (
                      <div key={index} className="p-2.5 sm:p-3 bg-white rounded-lg border border-purple-100 hover:border-purple-300 active:border-purple-400 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-800 font-medium break-words">{topic}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-center">
                <Link href="/create" className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 active:from-blue-700 active:to-purple-800 flex items-center justify-center shadow-lg text-sm sm:text-base">
                  <PenTool className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  基于洞察创作
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
              <div className="text-center py-6 sm:py-8">
                <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">暂无 AI 洞察数据</p>
                <p className="text-gray-500 text-xs mt-1">AI 分析可能正在进行中或未配置 OpenAI API Key</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 小红书笔记详情弹窗 */}
      {showNoteModal && selectedNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 sm:p-4"
          onClick={() => setShowNoteModal(false)}
        >
          <div
            className="bg-white rounded-xl sm:rounded-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl sm:rounded-t-2xl z-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">笔记详情</h2>
              <button
                onClick={() => setShowNoteModal(false)}
                className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* 笔记标题 */}
              <div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">{selectedNote.title}</h3>
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
                  <span className={`px-2 py-1 rounded text-xs ${selectedNote.type === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {selectedNote.type === 'video' ? '视频笔记' : '图文笔记'}
                  </span>
                </div>
              </div>

              {/* 封面图片 */}
              <div className="w-full rounded-lg sm:rounded-xl overflow-hidden">
                <img
                  src={selectedNote.cover}
                  alt={selectedNote.title}
                  className="w-full h-auto object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/800x600?text=暂无图片'
                  }}
                />
              </div>

              {/* 用户信息 */}
              <div className="flex items-center space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
                <img
                  src={selectedNote.user_avatar}
                  alt={selectedNote.user_name}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/48x48?text=头像'
                  }}
                />
                <div>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{selectedNote.user_name}</p>
                  <p className="text-xs sm:text-sm text-gray-500">作者</p>
                </div>
              </div>

              {/* 笔记正文内容 */}
              {selectedNote.content && (
                <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg sm:rounded-xl border border-blue-100">
                  <div className="flex items-center space-x-2 mb-2 sm:mb-3">
                    <PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-900 text-sm sm:text-base">笔记正文</h4>
                  </div>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                    {selectedNote.content}
                  </div>
                </div>
              )}

              {/* 互动数据 */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3 sm:p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">点赞</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-600">{selectedNote.liked_count.toLocaleString()}</p>
                    </div>
                    <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" fill="currentColor" />
                  </div>
                </div>

                <div className="p-3 sm:p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">收藏</p>
                      <p className="text-lg sm:text-2xl font-bold text-orange-600">{selectedNote.collected_count.toLocaleString()}</p>
                    </div>
                    <Bookmark className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" fill="currentColor" />
                  </div>
                </div>

                <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">评论</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-600">{selectedNote.comment_count.toLocaleString()}</p>
                    </div>
                    <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                  </div>
                </div>

                <div className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg sm:rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600 mb-1">分享</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-600">{selectedNote.shared_count.toLocaleString()}</p>
                    </div>
                    <Share2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                  </div>
                </div>
              </div>

              {/* 互动总数 */}
              <div className="p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg sm:rounded-xl border-2 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">总互动数</p>
                    <p className="text-2xl sm:text-3xl font-bold text-purple-700">{selectedNote.interact_count.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => window.open(`https://www.xiaohongshu.com/explore/${selectedNote.id}`, '_blank')}
                  className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 active:from-red-700 active:to-pink-800 flex items-center justify-center space-x-2 font-medium text-sm sm:text-base"
                >
                  <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>在小红书中查看</span>
                </button>
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 font-medium text-sm sm:text-base"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录弹窗 */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 sm:p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <History className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0" />
                <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">搜索历史记录</h2>
                <span className="px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-600 text-xs sm:text-sm rounded-full flex-shrink-0">
                  {searchHistory.length}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('确定要清空所有历史记录吗？')) {
                        clearHistory()
                      }
                    }}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 flex items-center gap-1 sm:gap-2"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">清空全部</span>
                  </button>
                )}
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* 历史记录列表 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {searchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-gray-400">
                  <History className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-50" />
                  <p className="text-base sm:text-lg">暂无搜索历史</p>
                  <p className="text-xs sm:text-sm mt-2">开始搜索后，历史记录会保存在这里</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {searchHistory.map((history) => {
                    const date = new Date(history.timestamp)
                    const timeStr = date.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    return (
                      <div
                        key={history.id}
                        className="p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex-1 cursor-pointer min-w-0"
                            onClick={() => handleHistoryClick(history)}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                              <span
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full flex-shrink-0 ${history.platform === 'wechat'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-700'
                                  }`}
                              >
                                {history.platform === 'wechat' ? '公众号' : '小红书'}
                              </span>
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-lg group-hover:text-blue-600 transition-colors truncate">
                                {history.keyword}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                              <span className="flex items-center whitespace-nowrap">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {timeStr}
                              </span>
                              <span className="flex items-center whitespace-nowrap">
                                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                找到 {history.resultCount} 条结果
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteHistoryItem(history.id)
                            }}
                            className="p-1.5 sm:p-2 opacity-60 sm:opacity-0 group-hover:opacity-100 hover:bg-red-50 active:bg-red-100 rounded-lg transition-all flex-shrink-0"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 z-10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600">
                <p className="text-center sm:text-left">💡 点击历史记录可快速填充关键词</p>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full sm:w-auto px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 active:bg-gray-200 font-medium"
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