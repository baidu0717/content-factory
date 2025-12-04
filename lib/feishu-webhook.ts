/**
 * 飞书 Webhook 推送模块
 * 用于将选题分析报告推送到飞书群组
 */

import { AIInsightsResult } from '@/types/insights'

export interface FeishuAnalysisReport {
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  reportId?: number
  reportUrl?: string
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
 * 推送分析报告到飞书
 */
export async function pushToFeishu(
  webhookUrl: string,
  report: FeishuAnalysisReport
): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    const messageCard = buildFeishuMessageCard(report)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageCard),
    })

    const result = await response.json()

    if (!response.ok || result.code !== 0) {
      throw new Error(result.msg || `飞书推送失败: ${response.status}`)
    }

    return {
      success: true,
      response: result,
    }
  } catch (error) {
    console.error('[飞书推送] 推送失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}

/**
 * 构建飞书消息卡片
 */
function buildFeishuMessageCard(report: FeishuAnalysisReport) {
  const platformName = report.platform === 'wechat' ? '公众号' : '小红书'
  const platformEmoji = report.platform === 'wechat' ? '📱' : '📕'
  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // 构建 TOP5 文章内容
  const topLikesContent = report.topLikesArticles
    .slice(0, 5)
    .map((article, index) => {
      const articleLink = article.url
        ? `[${article.title}](${article.url})`
        : article.title
      return `**${index + 1}. ${articleLink}**\n   👍 ${article.likes.toLocaleString()} | 👀 ${article.reads.toLocaleString()} | 📊 ${article.engagement}`
    })
    .join('\n\n')

  // 构建评论 TOP5 内容
  const topCommentsContent = report.topCommentsArticles
    .slice(0, 5)
    .map((article, index) => {
      const articleLink = article.url
        ? `[${article.title}](${article.url})`
        : article.title
      if (report.platform === 'wechat') {
        return `**${index + 1}. ${articleLink}**\n   💬 ${article.comments.toLocaleString()} | 👍 ${article.likes.toLocaleString()} | 👀 ${(article.reads || 0).toLocaleString()}`
      } else {
        return `**${index + 1}. ${articleLink}**\n   💬 ${article.comments.toLocaleString()} | 👍 ${article.likes.toLocaleString()} | ⭐ ${(article.collected || 0).toLocaleString()}`
      }
    })
    .join('\n\n')

  // 构建 AI 洞察内容
  let aiInsightsContent = ''
  if (report.aiInsights && report.aiInsights.insights && report.aiInsights.insights.length > 0) {
    aiInsightsContent = report.aiInsights.insights
      .slice(0, 5)
      .map((insight, index) => {
        const trendEmoji =
          insight.trend === 'rising' ? '📈' : insight.trend === 'declining' ? '📉' : '➡️'
        return `**${index + 1}. ${trendEmoji} ${insight.title}**\n${insight.description}`
      })
      .join('\n\n')
  }

  // 构建推荐选题
  let recommendedTopicsContent = ''
  if (
    report.aiInsights &&
    report.aiInsights.recommendedTopics &&
    report.aiInsights.recommendedTopics.length > 0
  ) {
    recommendedTopicsContent = report.aiInsights.recommendedTopics
      .slice(0, 5)
      .map((topic, index) => `${index + 1}. ${topic}`)
      .join('\n')
  }

  // 飞书消息卡片结构
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: `${platformEmoji} ${platformName}选题分析日报 - ${report.keyword}`,
        },
        template: report.platform === 'wechat' ? 'blue' : 'red',
      },
      elements: [
        // 日期标签
        {
          tag: 'div',
          text: {
            tag: 'plain_text',
            content: `📅 ${currentDate}`,
          },
        },
        {
          tag: 'hr',
        },
        // 统计概览
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**📊 数据概览**\n\n分析${platformName === '公众号' ? '文章' : '笔记'}数：**${report.stats.totalArticles}** 篇\n平均${platformName === '公众号' ? '阅读量' : '收藏数'}：**${report.stats.avgReads.toLocaleString()}**\n平均点赞数：**${report.stats.avgLikes.toLocaleString()}**\n平均互动率：**${report.stats.avgEngagement}**`,
          },
        },
        {
          tag: 'hr',
        },
        // 点赞 TOP5
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**🏆 点赞量TOP5**\n\n${topLikesContent}`,
          },
        },
        {
          tag: 'hr',
        },
        // 评论 TOP5
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**💬 评论数TOP5**\n\n${topCommentsContent}`,
          },
        },
        {
          tag: 'hr',
        },
        // AI 洞察
        ...(aiInsightsContent
          ? [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content: `**✨ AI 选题洞察**\n\n${aiInsightsContent}`,
                },
              },
              {
                tag: 'hr',
              },
            ]
          : []),
        // 推荐选题
        ...(recommendedTopicsContent
          ? [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content: `**🎯 推荐选题方向**\n\n${recommendedTopicsContent}`,
                },
              },
              {
                tag: 'hr',
              },
            ]
          : []),
        // 底部提示
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '💡 本报告由 AI 智能分析生成，数据来源于最近7天热门内容',
            },
          ],
        },
        // 查看完整报告按钮
        ...(report.reportUrl
          ? [
              {
                tag: 'hr',
              },
              {
                tag: 'action',
                actions: [
                  {
                    tag: 'button',
                    text: {
                      tag: 'plain_text',
                      content: '📊 查看完整报告',
                    },
                    type: 'primary',
                    url: report.reportUrl,
                  },
                ],
              },
            ]
          : []),
      ],
    },
  }
}

/**
 * 测试飞书 Webhook 连接
 */
export async function testFeishuWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const testMessage = {
      msg_type: 'text',
      content: {
        text: '✅ 飞书 Webhook 连接测试成功！',
      },
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    })

    const result = await response.json()

    if (!response.ok || result.code !== 0) {
      throw new Error(result.msg || `测试失败: ${response.status}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}
