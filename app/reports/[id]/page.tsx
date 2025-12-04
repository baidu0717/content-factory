'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  BarChart3,
  Loader2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Hash,
  Clock,
  Award,
  Zap,
  Target,
  ArrowLeft,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { AIInsightsResult } from '@/types/insights'

interface ReportData {
  id: number
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  created_at: number
  stats: {
    totalArticles: number
    avgReads: number
    avgLikes: number
    avgEngagement: string
  }
  topLikesArticles: Array<{
    title: string
    likes: number
    reads: number
    engagement: string
    url?: string
  }>
  topEngagementArticles: Array<{
    title: string
    likes: number
    reads: number
    engagement: string
    url?: string
  }>
  aiInsights?: AIInsightsResult
}

const mockChartData = [
  { name: '0-1k', value: 12 },
  { name: '1k-5k', value: 34 },
  { name: '5k-10k', value: 45 },
  { name: '10k-20k', value: 38 },
  { name: '20k+', value: 27 },
]

export default function ReportDetailPage() {
  const params = useParams()
  const reportId = params.id as string
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/scheduled-reports?limit=1000`)
        const data = await response.json()

        if (data.success) {
          const foundReport = data.reports.find((r: any) => r.id === parseInt(reportId))
          if (foundReport && foundReport.analysis_result) {
            setReport({
              id: foundReport.id,
              keyword: foundReport.keyword,
              platform: foundReport.platform,
              created_at: foundReport.created_at,
              ...foundReport.analysis_result,
            })
          } else {
            setError('报告不存在或数据不完整')
          }
        } else {
          setError('加载失败')
        }
      } catch (err) {
        setError('加载失败')
      } finally {
        setLoading(false)
      }
    }

    if (reportId) {
      loadReport()
    }
  }, [reportId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 text-lg">加载失败</h3>
              <p className="text-red-700 mt-1">{error || '未知错误'}</p>
              <Link
                href="/monitoring"
                className="mt-4 inline-flex items-center text-red-600 hover:text-red-700"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回监控页面
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const platformName = report.platform === 'wechat' ? '公众号' : '小红书'
  const platformColor = report.platform === 'wechat' ? 'blue' : 'red'

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <Link
          href="/monitoring"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回监控页面
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  report.platform === 'wechat'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {platformName}
              </span>
              <h1 className="text-2xl font-bold text-gray-900">{report.keyword} - 选题分析报告</h1>
            </div>
            <p className="text-gray-500">
              生成时间：{new Date(report.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">
                {report.platform === 'wechat' ? '分析文章数' : '分析笔记数'}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.stats.totalArticles}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">
                {report.platform === 'wechat' ? '平均阅读量' : '平均收藏数'}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {report.stats.avgReads.toLocaleString()}
              </p>
            </div>
            <Eye className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">平均点赞数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {report.stats.avgLikes.toLocaleString()}
              </p>
            </div>
            <Heart className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">
                {report.platform === 'wechat' ? '平均互动率' : '平均互动数'}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{report.stats.avgEngagement}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* TOP 文章 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 点赞TOP5 */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Award className="w-5 h-5 mr-2 text-yellow-500" />
              点赞量TOP5
            </h2>
          </div>
          <div className="space-y-3">
            {report.topLikesArticles.map((article, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start">
                  <span className="text-lg font-bold text-yellow-500 mr-2 flex-shrink-0">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 line-clamp-2">
                      {article.url ? (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 inline-flex items-center"
                        >
                          {article.title}
                          <ExternalLink className="w-4 h-4 ml-1 flex-shrink-0" />
                        </a>
                      ) : (
                        article.title
                      )}
                    </h3>
                    <div className="flex items-center mt-2 gap-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {article.reads.toLocaleString()}
                      </span>
                      <span className="flex items-center">
                        <Heart className="w-4 h-4 mr-1 text-red-500" />
                        {article.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1 text-green-500" />
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
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-purple-500" />
              互动率TOP5
            </h2>
          </div>
          <div className="space-y-3">
            {report.topEngagementArticles.map((article, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start">
                  <span className="text-lg font-bold text-purple-500 mr-2 flex-shrink-0">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 line-clamp-2">
                      {article.url ? (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 inline-flex items-center"
                        >
                          {article.title}
                          <ExternalLink className="w-4 h-4 ml-1 flex-shrink-0" />
                        </a>
                      ) : (
                        article.title
                      )}
                    </h3>
                    <div className="flex items-center mt-2 gap-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {article.reads.toLocaleString()}
                      </span>
                      <span className="flex items-center">
                        <Heart className="w-4 h-4 mr-1 text-red-500" />
                        {article.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center text-purple-600 font-semibold">
                        <TrendingUp className="w-4 h-4 mr-1" />
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

      {/* AI 洞察 */}
      {report.aiInsights && report.aiInsights.insights && report.aiInsights.insights.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
              AI 选题洞察
            </h2>
          </div>

          {/* 整体趋势 */}
          {report.aiInsights.overallTrends && report.aiInsights.overallTrends.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-orange-600" />
                整体趋势
              </h3>
              <ul className="space-y-2">
                {report.aiInsights.overallTrends.map((trend, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-orange-500 mr-2 font-bold">•</span>
                    <span>{trend}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 洞察列表 */}
          <div className="space-y-4 mb-6">
            {report.aiInsights.insights.map((insight, index) => (
              <div
                key={index}
                className="p-5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-100"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-lg">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{insight.title}</h3>
                      {insight.trend && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            insight.trend === 'rising'
                              ? 'bg-green-100 text-green-700'
                              : insight.trend === 'declining'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {insight.trend === 'rising'
                            ? '📈 上升'
                            : insight.trend === 'declining'
                            ? '📉 下降'
                            : '➡️ 稳定'}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed mb-3">
                      {insight.description}
                    </p>

                    {insight.creativeAdvice && (
                      <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600 font-medium mb-1 flex items-center">
                          <Target className="w-4 h-4 mr-1 text-green-600" />
                          创作建议:
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {insight.creativeAdvice}
                        </p>
                      </div>
                    )}

                    {insight.relatedKeywords && insight.relatedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-gray-600 font-medium">🏷️ 相关:</span>
                        {insight.relatedKeywords.map((keyword, kidx) => (
                          <span
                            key={kidx}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                          >
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

          {/* 推荐选题 */}
          {report.aiInsights.recommendedTopics && report.aiInsights.recommendedTopics.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-purple-600" />
                推荐选题方向
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.aiInsights.recommendedTopics.map((topic, index) => (
                  <div
                    key={index}
                    className="p-3 bg-white rounded-lg border border-purple-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-800 font-medium">{topic}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
