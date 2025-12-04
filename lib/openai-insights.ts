/**
 * AI 洞察分析工具函数
 * 使用 OpenAI 兼容的 API 或 Gemini API 进行文章摘要和选题洞察分析
 */

import { ArticleSummary, EnhancedInsight, AIInsightsResult } from '@/types/insights'
import { cleanHtmlContent } from './html-cleaner'
import { GoogleGenAI } from '@google/genai'
import { setGlobalDispatcher, ProxyAgent } from 'undici'

// OpenAI API 配置
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o'

// Gemini API 配置
const GEMINI_TEXT_API_KEY = process.env.GEMINI_TEXT_API_KEY || ''
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro-preview'

// 配置 Undici 全局代理（用于 Gemini SDK）
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7897'
const proxyAgent = new ProxyAgent(HTTPS_PROXY)
setGlobalDispatcher(proxyAgent)

console.log(`[代理配置] 使用代理: ${HTTPS_PROXY}`)

// 初始化 Gemini 客户端
const geminiClient = new GoogleGenAI({
  apiKey: GEMINI_TEXT_API_KEY
})

/**
 * 调用 OpenAI 兼容的 API
 */
async function callOpenAI(messages: Array<{ role: string; content: string }>, temperature: number = 0.7): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('未配置 OPENAI_API_KEY，请在 .env.local 文件中配置')
  }

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API 调用失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

/**
 * 调用 Gemini 3 Pro API（使用新的 @google/genai SDK）
 */
async function callGemini(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!GEMINI_TEXT_API_KEY) {
    throw new Error('未配置 GEMINI_TEXT_API_KEY，请在 .env.local 文件中配置')
  }

  console.log('[Gemini] 开始调用 Gemini 3 Pro API（使用新 SDK）...')
  console.log(`[Gemini] 使用代理: ${HTTPS_PROXY}`)
  console.log(`[Gemini] 模型: ${GEMINI_TEXT_MODEL}`)

  try {
    // 将 OpenAI 格式的 messages 转换为 Gemini 格式
    const contents = messages
      .filter(msg => msg.role === 'user' || msg.role === 'model')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))

    // 如果有 system message，合并到第一个 user message
    const systemMessage = messages.find(msg => msg.role === 'system')
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`
    }

    // 使用新的 SDK 调用 API
    const response = await geminiClient.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: contents,
      config: {
        temperature: 1.0,
        maxOutputTokens: 8192,
      }
    })

    console.log('[Gemini] API 调用成功')

    // 提取响应文本
    const text = response.text || ''

    if (!text) {
      throw new Error('Gemini API 返回的内容为空')
    }

    return text

  } catch (error) {
    console.error('[Gemini] 调用失败:', error)
    if (error instanceof Error) {
      throw new Error(`Gemini API 调用失败: ${error.message}`)
    }
    throw error
  }
}

/**
 * 步骤1：批量分析文章，生成结构化摘要
 */
export async function generateArticleSummaries(
  articles: Array<{
    title: string
    content: string
    likes: number
    reads: number
    url?: string
  }>,
  platform: 'wechat' | 'xiaohongshu',
  keyword: string
): Promise<ArticleSummary[]> {
  console.log(`[AI洞察] 开始批量分析 ${articles.length} 篇文章...`)

  // 清洗文章内容
  const cleanedArticles = articles.map(article => ({
    ...article,
    content: platform === 'wechat' ? cleanHtmlContent(article.content) : article.content,
  }))

  // 构建批量分析的 Prompt
  const articlesText = cleanedArticles.map((article, index) => `
【文章 ${index + 1}】
标题：${article.title}
内容：${article.content.substring(0, 3000)}${article.content.length > 3000 ? '...' : ''}
阅读量：${article.reads}
点赞数：${article.likes}
`).join('\n---\n')

  const prompt = `你是一位专业的内容分析师。请分析以下 ${articles.length} 篇关于"${keyword}"的${platform === 'wechat' ? '公众号文章' : '小红书笔记'}。

${articlesText}

请对每篇文章进行详细分析，并以 JSON 数组格式返回结果。每个分析对象应包含以下字段：

{
  "articleTitle": "文章标题",
  "summary": "内容摘要（200-300字，概括文章核心内容和主要观点）",
  "keywords": ["关键词1", "关键词2", ...],  // 5-10个关键词
  "highlights": ["亮点1", "亮点2", ...],  // 3-5个核心观点或创新点
  "targetAudience": "目标受众描述",
  "contentType": "内容类型（如：教程、案例分析、观点评论、工具介绍、行业报告等）"
}

请直接返回 JSON 数组，不要包含任何其他文字说明。`

  const messages = [
    {
      role: 'system',
      content: '你是一位专业的内容分析师，擅长提取文章的核心信息和价值点。请始终以 JSON 格式返回结构化的分析结果。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await callOpenAI(messages, 0.5)
    console.log('[AI洞察] AI 响应原始内容:', response)

    // 提取 JSON 内容（可能包含在代码块中）
    let jsonText = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const parsedSummaries = JSON.parse(jsonText)

    // 添加指标数据
    const summaries: ArticleSummary[] = parsedSummaries.map((summary: any, index: number) => {
      const article = articles[index]
      return {
        ...summary,
        articleUrl: article.url,
        metrics: {
          likes: article.likes,
          reads: article.reads,
          engagement: article.reads > 0 ? ((article.likes / article.reads) * 100).toFixed(1) + '%' : '0%'
        }
      }
    })

    console.log(`[AI洞察] 成功生成 ${summaries.length} 篇文章摘要`)
    return summaries

  } catch (error) {
    console.error('[AI洞察] 生成文章摘要失败:', error)
    throw new Error(`生成文章摘要失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 步骤2：基于文章摘要生成选题洞察
 */
export async function generateTopicInsights(
  summaries: ArticleSummary[],
  platform: 'wechat' | 'xiaohongshu',
  keyword: string
): Promise<{ insights: EnhancedInsight[]; overallTrends: string[]; recommendedTopics: string[] }> {
  console.log(`[AI洞察] 基于 ${summaries.length} 篇文章摘要生成选题洞察...`)

  // 构建摘要文本
  const summariesText = summaries.map((s, index) => `
【文章 ${index + 1}】${s.articleTitle}
摘要：${s.summary}
关键词：${s.keywords.join('、')}
亮点：${s.highlights.join('；')}
目标受众：${s.targetAudience}
内容类型：${s.contentType}
数据表现：阅读 ${s.metrics.reads}，点赞 ${s.metrics.likes}，互动率 ${s.metrics.engagement}
`).join('\n---\n')

  const prompt = `你是一位资深的内容策略专家。基于以下 ${summaries.length} 篇关于"${keyword}"的${platform === 'wechat' ? '公众号文章' : '小红书笔记'}摘要，请进行深度的选题洞察分析。

${summariesText}

请从以下角度进行分析：
1. 识别内容趋势和热点话题
2. 分析读者关注点和痛点
3. 发现内容差异化机会
4. 提供具体的创作建议

请生成至少 5 条（可以更多）结构化的选题洞察，并以 JSON 格式返回：

{
  "insights": [
    {
      "title": "洞察标题（简洁有力，10-20字）",
      "description": "详细描述（100-200字，深入分析这个洞察背后的原因和价值）",
      "supportingArticles": ["支撑文章1的标题", "支撑文章2的标题"],  // 引用了哪些文章
      "creativeAdvice": "创作建议（具体可执行的内容创作建议，50-100字）",
      "relatedKeywords": ["相关关键词1", "相关关键词2"],
      "trend": "rising"  // 或 "stable" 或 "declining"
    }
  ],
  "overallTrends": ["整体趋势1", "整体趋势2", "整体趋势3"],  // 3-5个整体趋势总结
  "recommendedTopics": ["推荐选题1", "推荐选题2", "推荐选题3"]  // 3-5个具体的推荐选题方向
}

请确保：
- 洞察数量至少 5 条，每条都有实际价值
- supportingArticles 中的文章标题必须来自上述文章列表
- creativeAdvice 要具体可执行，不要泛泛而谈
- 直接返回 JSON，不要包含任何其他文字说明`

  const messages = [
    {
      role: 'system',
      content: '你是一位资深的内容策略专家，擅长从大量内容中提炼出有价值的选题洞察和创作建议。请始终以 JSON 格式返回结构化的分析结果。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await callOpenAI(messages, 0.7)
    console.log('[AI洞察] AI 响应原始内容:', response)

    // 提取 JSON 内容
    let jsonText = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const result = JSON.parse(jsonText)

    console.log(`[AI洞察] 成功生成 ${result.insights?.length || 0} 条选题洞察`)
    return result

  } catch (error) {
    console.error('[AI洞察] 生成选题洞察失败:', error)
    throw new Error(`生成选题洞察失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 完整的 AI 洞察分析流程
 */
export async function generateAIInsights(
  articles: Array<{
    title: string
    content: string
    likes: number
    reads: number
    url?: string
  }>,
  platform: 'wechat' | 'xiaohongshu',
  keyword: string
): Promise<AIInsightsResult> {
  console.log('[AI洞察] 开始完整的 AI 洞察分析流程...')
  console.log(`[AI洞察] 关键词: ${keyword}, 平台: ${platform}, 文章数: ${articles.length}`)

  try {
    // 步骤1：生成文章摘要
    console.log('[AI洞察] 步骤1/2: 生成文章摘要...')
    const summaries = await generateArticleSummaries(articles, platform, keyword)

    // 步骤2：生成选题洞察
    console.log('[AI洞察] 步骤2/2: 生成选题洞察...')
    const { insights, overallTrends, recommendedTopics } = await generateTopicInsights(summaries, platform, keyword)

    const result: AIInsightsResult = {
      summaries,
      insights,
      overallTrends,
      recommendedTopics
    }

    console.log('[AI洞察] 完整分析流程成功完成')
    return result

  } catch (error) {
    console.error('[AI洞察] AI 洞察分析失败:', error)
    throw error
  }
}

/**
 * 生成文章内容
 */
export async function generateArticle(
  topic: {
    title: string
    description: string
    fullDescription?: string
    creativeAdvice?: string
    relatedKeywords?: string[]
  },
  params: {
    length: string
    style: string
    imageCount: number
    platform?: 'wechat' | 'xiaohongshu'
  }
): Promise<{ title: string; content: string }> {
  console.log('[AI生成] 开始生成文章...')
  console.log(`[AI生成] 选题: ${topic.title}`)
  console.log(`[AI生成] 参数: 长度=${params.length}, 风格=${params.style}`)

  // 风格映射
  const styleMap: Record<string, string> = {
    'professional': '专业严谨，使用规范的行业术语',
    'casual': '轻松活泼，使用通俗易懂的语言',
    'storytelling': '故事叙述，通过故事和案例来表达观点',
    'educational': '教育科普，系统地讲解知识点',
    'emotional': '情感共鸣，触动读者情感'
  }

  const styleDescription = styleMap[params.style] || '专业严谨'

  // 构建提示词
  const prompt = `请基于以下选题信息创作一篇高质量的文章：

**选题标题**：${topic.title}

**选题洞察**：${topic.fullDescription || topic.description}

${topic.creativeAdvice ? `**创作建议**：${topic.creativeAdvice}` : ''}

${topic.relatedKeywords && topic.relatedKeywords.length > 0 ? `**相关关键词**：${topic.relatedKeywords.join('、')}` : ''}

**创作要求**：
1. 文章长度：${params.length}字左右
2. 写作风格：${styleDescription}
3. 目标平台：${params.platform === 'xiaohongshu' ? '小红书' : '公众号'}
4. 内容结构：
   - 吸引人的标题
   - 清晰的小标题（使用 ## 或 ### 标记）
   - 逻辑清晰的段落
   - 适当使用列表（使用 - 或数字标记）
5. 内容要求：
   - 有实际价值，不要泛泛而谈
   - 包含具体的案例、数据或方法
   - 结尾有总结或行动建议
   - 适合${params.platform === 'xiaohongshu' ? '小红书' : '公众号'}平台的阅读习惯

请返回JSON格式：
{
  "title": "吸引人的文章标题（15-30字）",
  "content": "完整的文章正文（使用Markdown格式，包含## 小标题、列表等）"
}

注意：直接返回JSON，不要包含任何其他文字说明。`

  const messages = [
    {
      role: 'system',
      content: `你是一位专业的内容创作者，擅长撰写${params.platform === 'xiaohongshu' ? '小红书笔记' : '公众号文章'}。你的文章总是有价值、有深度、可读性强。`
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    // 使用 Gemini 3 Pro 生成文章
    const response = await callGemini(messages)
    console.log('[AI生成] Gemini 响应原始内容:', response.substring(0, 200) + '...')

    // 提取 JSON 内容
    let jsonText = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const article = JSON.parse(jsonText)

    console.log('[AI生成] 文章生成成功')
    console.log(`[AI生成] 标题: ${article.title}`)
    console.log(`[AI生成] 内容长度: ${article.content.length} 字符`)

    return {
      title: article.title,
      content: article.content
    }

  } catch (error) {
    console.error('[AI生成] 生成文章失败:', error)
    throw new Error(`生成文章失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
