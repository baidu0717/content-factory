/**
 * 定时调度器核心逻辑
 * 负责执行定时分析任务并推送到飞书
 */

import { getDb } from './db'
import { searchWeChatArticles } from './wechat-api'
import { searchXiaohongshuNotes, transformToNotes, fetchNotesWithDetails } from './xiaohongshu-api'
import { WeChatArticle } from '@/types/wechat-api'
import { XiaohongshuNote } from '@/types/xiaohongshu-api'
import { AIInsightsResult } from '@/types/insights'
import { pushToFeishu, FeishuAnalysisReport } from './feishu-webhook'

interface MonitoredKeyword {
  id: number
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  enabled: number
  last_run_at: number | null
}

interface AnalysisResult {
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  articles: WeChatArticle[] | XiaohongshuNote[]
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
  topCommentsArticles: Array<{
    title: string
    comments: number
    likes: number
    reads?: number
    collected?: number
    url?: string
  }>
  aiInsights?: AIInsightsResult
}

/**
 * 执行单个关键词的分析任务
 */
async function analyzeKeyword(
  keyword: string,
  platform: 'wechat' | 'xiaohongshu'
): Promise<AnalysisResult> {
  console.log(`\n[调度器] 开始分析关键词: ${keyword} (${platform})`)

  let articles: WeChatArticle[] = []
  let notes: XiaohongshuNote[] = []

  // 1. 获取数据
  if (platform === 'wechat') {
    const response = await searchWeChatArticles({
      kw: keyword,
      sort_type: 1,
      mode: 1,
      period: 7,
      page: 1,
      type: 1,
    })
    articles = response.data || []
    console.log(`[调度器] 获取到 ${articles.length} 篇公众号文章`)
  } else {
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
    const transformedNotes = transformToNotes(response)
    notes = await fetchNotesWithDetails(transformedNotes)
    console.log(`[调度器] 获取到 ${notes.length} 篇小红书笔记`)
  }

  // 2. 计算统计数据
  const stats = calculateStats(platform, articles, notes)

  // 3. 获取 TOP 文章
  const topLikesArticles = getTopLikesArticles(platform, articles, notes)
  const topEngagementArticles = getTopEngagementArticles(platform, articles, notes)
  const topCommentsArticles = getTopCommentsArticles(platform, articles, notes)

  // 4. 调用 AI 分析
  let aiInsights: AIInsightsResult | undefined = undefined
  try {
    const topArticles = prepareTopArticlesForAI(
      platform,
      articles,
      notes,
      topLikesArticles,
      topEngagementArticles
    )

    if (topArticles.length > 0) {
      console.log(`[调度器] 准备 ${topArticles.length} 篇文章进行 AI 分析`)

      // 调用 AI 洞察 API（通过内部 HTTP 请求）
      const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword,
          platform,
          articles: topArticles,
        }),
      })

      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        if (aiData.success && aiData.data) {
          aiInsights = aiData.data
          console.log('[调度器] AI 洞察生成成功')
        }
      }
    }
  } catch (error) {
    console.error('[调度器] AI 分析失败:', error)
  }

  return {
    keyword,
    platform,
    articles: platform === 'wechat' ? articles : notes,
    stats,
    topLikesArticles,
    topEngagementArticles,
    topCommentsArticles,
    aiInsights,
  }
}

/**
 * 计算统计数据
 */
function calculateStats(
  platform: 'wechat' | 'xiaohongshu',
  articles: WeChatArticle[],
  notes: XiaohongshuNote[]
) {
  if (platform === 'wechat') {
    if (!articles || articles.length === 0) {
      return {
        totalArticles: 0,
        avgReads: 0,
        avgLikes: 0,
        avgEngagement: '0%',
      }
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
    if (!notes || notes.length === 0) {
      return {
        totalArticles: 0,
        avgReads: 0,
        avgLikes: 0,
        avgEngagement: '0',
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
      avgReads: avgCollects,
      avgLikes,
      avgEngagement: avgInteract.toString(),
    }
  }
}

/**
 * 获取点赞 TOP5 文章
 */
function getTopLikesArticles(
  platform: 'wechat' | 'xiaohongshu',
  articles: WeChatArticle[],
  notes: XiaohongshuNote[]
) {
  if (platform === 'wechat') {
    if (!articles || articles.length === 0) return []

    return [...articles]
      .sort((a, b) => (b.praise || 0) - (a.praise || 0))
      .slice(0, 5)
      .map((article) => ({
        title: article.title,
        likes: article.praise || 0,
        reads: article.read || 0,
        engagement: article.read > 0 ? ((article.praise / article.read) * 100).toFixed(0) + '%' : '0%',
        url: article.url || article.short_link || '',
      }))
  } else {
    if (!notes || notes.length === 0) return []

    return [...notes]
      .sort((a, b) => (b.liked_count || 0) - (a.liked_count || 0))
      .slice(0, 5)
      .map((note) => ({
        title: note.title,
        likes: note.liked_count || 0,
        reads: note.collected_count || 0,
        engagement: note.interact_count.toString(),
        url: `https://www.xiaohongshu.com/explore/${note.id}`,
      }))
  }
}

/**
 * 获取互动率 TOP5 文章
 */
function getTopEngagementArticles(
  platform: 'wechat' | 'xiaohongshu',
  articles: WeChatArticle[],
  notes: XiaohongshuNote[]
) {
  if (platform === 'wechat') {
    if (!articles || articles.length === 0) return []

    return [...articles]
      .filter((article) => article.read > 0)
      .sort((a, b) => {
        const engagementA = a.praise / a.read
        const engagementB = b.praise / b.read
        return engagementB - engagementA
      })
      .slice(0, 5)
      .map((article) => ({
        title: article.title,
        likes: article.praise || 0,
        reads: article.read || 0,
        engagement: ((article.praise / article.read) * 100).toFixed(0) + '%',
        url: article.url || article.short_link || '',
      }))
  } else {
    if (!notes || notes.length === 0) return []

    return [...notes]
      .sort((a, b) => (b.interact_count || 0) - (a.interact_count || 0))
      .slice(0, 5)
      .map((note) => ({
        title: note.title,
        likes: note.liked_count || 0,
        reads: note.collected_count || 0,
        engagement: note.interact_count.toString(),
        url: `https://www.xiaohongshu.com/explore/${note.id}`,
      }))
  }
}

/**
 * 获取评论 TOP5 文章
 */
function getTopCommentsArticles(
  platform: 'wechat' | 'xiaohongshu',
  articles: WeChatArticle[],
  notes: XiaohongshuNote[]
) {
  if (platform === 'wechat') {
    if (!articles || articles.length === 0) return []

    return [...articles]
      .sort((a, b) => (b.comment || 0) - (a.comment || 0))
      .slice(0, 5)
      .map((article) => ({
        title: article.title,
        comments: article.comment || 0,
        likes: article.praise || 0,
        reads: article.read || 0,
        url: article.url || article.short_link || '',
      }))
  } else {
    if (!notes || notes.length === 0) return []

    return [...notes]
      .sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0))
      .slice(0, 5)
      .map((note) => ({
        title: note.title,
        comments: note.comment_count || 0,
        likes: note.liked_count || 0,
        collected: note.collected_count || 0,
        url: `https://www.xiaohongshu.com/explore/${note.id}`,
      }))
  }
}

/**
 * 准备 TOP 文章用于 AI 分析
 */
function prepareTopArticlesForAI(
  platform: 'wechat' | 'xiaohongshu',
  articles: WeChatArticle[],
  notes: XiaohongshuNote[],
  topLikesArticles: any[],
  topEngagementArticles: any[]
) {
  if (platform === 'wechat' && articles.length > 0) {
    const articlesWithEngagement = articles.map((article) => ({
      ...article,
      engagement: article.read > 0 ? article.praise / article.read : 0,
    }))

    const topLikes = [...articlesWithEngagement].sort((a, b) => b.praise - a.praise).slice(0, 5)
    const topEngagement = [...articlesWithEngagement].sort((a, b) => b.engagement - a.engagement).slice(0, 5)

    const uniqueArticles = new Map()
    ;[...topLikes, ...topEngagement].forEach((article) => {
      uniqueArticles.set(article.title, {
        title: article.title,
        content: article.content || '',
        likes: article.praise || 0,
        reads: article.read || 0,
        url: article.url || article.short_link,
      })
    })

    return Array.from(uniqueArticles.values())
  } else if (platform === 'xiaohongshu' && notes.length > 0) {
    const notesWithEngagement = notes.map((note) => ({
      ...note,
      engagement: note.liked_count / (note.liked_count + note.collected_count + note.comment_count),
    }))

    const topLikes = [...notesWithEngagement].sort((a, b) => b.liked_count - a.liked_count).slice(0, 5)
    const topEngagement = [...notesWithEngagement].sort((a, b) => b.engagement - a.engagement).slice(0, 5)

    const uniqueNotes = new Map()
    ;[...topLikes, ...topEngagement].forEach((note) => {
      uniqueNotes.set(note.id, {
        title: note.title,
        content: note.content || '',
        likes: note.liked_count || 0,
        reads: note.interact_count || 0,
        url: `https://www.xiaohongshu.com/explore/${note.id}`,
      })
    })

    return Array.from(uniqueNotes.values())
  }

  return []
}

/**
 * 执行每日分析任务
 */
export async function runDailyAnalysis(): Promise<{
  success: boolean
  results: Array<{
    keyword: string
    platform: string
    success: boolean
    error?: string
    reportId?: number
  }>
}> {
  console.log('\n' + '='.repeat(80))
  console.log('[调度器] 开始执行每日分析任务')
  console.log('[调度器] 时间:', new Date().toLocaleString('zh-CN'))
  console.log('='.repeat(80) + '\n')

  const db = getDb()
  const results: Array<{
    keyword: string
    platform: string
    success: boolean
    error?: string
    reportId?: number
  }> = []

  try {
    // 1. 获取飞书 Webhook 地址
    const webhookSetting = db
      .prepare('SELECT value FROM system_settings WHERE key = ?')
      .get('feishu_webhook') as { value: string } | undefined

    if (!webhookSetting || !webhookSetting.value) {
      throw new Error('飞书 Webhook 地址未配置')
    }

    const webhookUrl = webhookSetting.value

    // 2. 获取所有启用的监控关键词
    const keywords = db
      .prepare('SELECT * FROM monitored_keywords WHERE enabled = 1')
      .all() as MonitoredKeyword[]

    console.log(`[调度器] 找到 ${keywords.length} 个启用的监控关键词`)

    // 3. 逐个分析关键词
    for (const keywordConfig of keywords) {
      try {
        console.log(`\n[调度器] 处理关键词: ${keywordConfig.keyword} (${keywordConfig.platform})`)

        // 执行分析
        const analysisResult = await analyzeKeyword(keywordConfig.keyword, keywordConfig.platform)

        // 先保存报告记录，获取 reportId
        const reportId = db
          .prepare(
            `INSERT INTO scheduled_reports
            (keyword_id, keyword, platform, analysis_result, feishu_pushed, feishu_push_at, feishu_response, error, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            keywordConfig.id,
            keywordConfig.keyword,
            keywordConfig.platform,
            JSON.stringify(analysisResult),
            0, // 初始状态为未推送
            null,
            null,
            null,
            Date.now()
          ).lastInsertRowid as number

        // 生成报告 URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        const reportUrl = `${appUrl}/reports/${reportId}`

        // 构建飞书报告（包含报告链接）
        const feishuReport: FeishuAnalysisReport = {
          keyword: analysisResult.keyword,
          platform: analysisResult.platform,
          reportId: reportId as number,
          reportUrl,
          stats: analysisResult.stats,
          topLikesArticles: analysisResult.topLikesArticles,
          topEngagementArticles: analysisResult.topEngagementArticles,
          topCommentsArticles: analysisResult.topCommentsArticles,
          aiInsights: analysisResult.aiInsights,
        }

        // 推送到飞书
        console.log('[调度器] 推送到飞书...')
        console.log('[调度器] 报告链接:', reportUrl)
        const pushResult = await pushToFeishu(webhookUrl, feishuReport)

        // 更新报告的推送状态
        db.prepare(
          `UPDATE scheduled_reports
           SET feishu_pushed = ?, feishu_push_at = ?, feishu_response = ?, error = ?
           WHERE id = ?`
        ).run(
          pushResult.success ? 1 : 0,
          pushResult.success ? Date.now() : null,
          pushResult.response ? JSON.stringify(pushResult.response) : null,
          pushResult.error || null,
          reportId
        )

        // 更新关键词的最后执行时间
        db.prepare('UPDATE monitored_keywords SET last_run_at = ?, updated_at = ? WHERE id = ?').run(
          Date.now(),
          Date.now(),
          keywordConfig.id
        )

        results.push({
          keyword: keywordConfig.keyword,
          platform: keywordConfig.platform,
          success: pushResult.success,
          error: pushResult.error,
          reportId,
        })

        console.log(
          `[调度器] ✅ ${keywordConfig.keyword} 分析完成${pushResult.success ? '并成功推送' : '但推送失败'}`
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        console.error(`[调度器] ❌ ${keywordConfig.keyword} 分析失败:`, errorMessage)

        // 保存失败记录
        db.prepare(
          `INSERT INTO scheduled_reports
          (keyword_id, keyword, platform, analysis_result, feishu_pushed, error, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(keywordConfig.id, keywordConfig.keyword, keywordConfig.platform, null, 0, errorMessage, Date.now())

        results.push({
          keyword: keywordConfig.keyword,
          platform: keywordConfig.platform,
          success: false,
          error: errorMessage,
        })
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('[调度器] 每日分析任务执行完成')
    console.log(`[调度器] 成功: ${results.filter((r) => r.success).length} / ${results.length}`)
    console.log('='.repeat(80) + '\n')

    return {
      success: true,
      results,
    }
  } catch (error) {
    console.error('[调度器] 执行失败:', error)
    return {
      success: false,
      results,
    }
  }
}
