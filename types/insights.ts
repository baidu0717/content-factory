/**
 * AI 洞察分析相关的数据类型定义
 */

// 文章结构化摘要
export interface ArticleSummary {
  articleTitle: string        // 文章标题
  articleUrl?: string          // 文章链接
  summary: string              // 内容摘要 (200-300字)
  keywords: string[]           // 关键词 (5-10个)
  highlights: string[]         // 文章亮点 (3-5个核心观点)
  targetAudience: string       // 目标受众
  contentType: string          // 内容类型（教程/案例/观点/工具介绍等）
  metrics: {                   // 数据指标
    likes: number              // 点赞数
    reads: number              // 阅读数
    engagement: string         // 互动率
  }
}

// 增强的选题洞察（去掉置信度）
export interface EnhancedInsight {
  title: string                // 洞察标题
  description: string          // 详细描述
  supportingArticles: string[] // 支撑文章标题列表
  creativeAdvice: string       // 创作建议
  relatedKeywords: string[]    // 相关关键词
  trend?: 'rising' | 'stable' | 'declining' // 趋势（可选）
}

// AI 洞察分析完整结果
export interface AIInsightsResult {
  summaries: ArticleSummary[]     // 所有文章的结构化摘要
  insights: EnhancedInsight[]     // 选题洞察 (至少5条)
  overallTrends: string[]         // 整体趋势总结
  recommendedTopics: string[]     // 推荐选题方向
}

// AI API 请求参数
export interface AIInsightsRequest {
  keyword: string                 // 搜索关键词
  platform: 'wechat' | 'xiaohongshu' // 平台
  articles: Array<{
    title: string
    content: string
    likes: number
    reads: number
    url?: string
  }>
}

// AI API 响应
export interface AIInsightsResponse {
  success: boolean
  data?: AIInsightsResult
  error?: string
}

// ============ 内容创作相关类型 ============

// 选题数据结构（用于创作页面）
export interface Topic {
  id: string                      // 唯一ID
  title: string                   // 选题标题
  description: string             // 简短描述
  fullDescription?: string        // 完整描述（用于详情）
  creativeAdvice?: string         // 创作建议
  relatedKeywords?: string[]      // 相关关键词
  supportingArticles?: string[]   // 支撑文章
  trend?: 'rising' | 'stable' | 'declining' // 趋势
  timestamp: number               // 生成时间戳
  source: string                  // 来源（洞察报告/推荐选题）
  type: 'insight' | 'recommended' // 类型
}

// 洞察报告数据结构（用于下拉菜单）
export interface InsightReport {
  id: number                      // 历史记录ID
  keyword: string                 // 搜索关键词
  platform: 'wechat' | 'xiaohongshu' // 平台
  timestamp: number               // 生成时间
  insightCount: number            // 洞察数量
  aiInsights: AIInsightsResult    // AI洞察结果
}

// 文章生成请求参数
export interface ArticleGenerationRequest {
  topic: Topic                    // 选题信息
  params: {
    length: string                // 文章长度（如"1000-1500"）
    style: string                 // 写作风格
    imageCount: number            // 图片数量
    platform?: 'wechat' | 'xiaohongshu' // 目标平台
  }
}

// 生成的文章结构
export interface GeneratedArticle {
  title: string                   // 文章标题
  content: string                 // 文章正文（Markdown格式）
  wordCount?: number              // 字数
  readingTime?: number            // 预计阅读时间（分钟）
  images?: string[]               // 配图URL列表
}
