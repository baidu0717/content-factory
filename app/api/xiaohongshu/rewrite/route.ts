import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { setGlobalDispatcher, ProxyAgent } from 'undici'

// 配置代理（仅在本地开发环境使用）
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (HTTPS_PROXY) {
  console.log('[Gemini API] 使用代理:', HTTPS_PROXY)
  const proxyAgent = new ProxyAgent(HTTPS_PROXY)
  setGlobalDispatcher(proxyAgent)
} else {
  console.log('[Gemini API] 直接访问（无代理）')
}

// Gemini API 配置
const GEMINI_TEXT_API_KEY = process.env.GEMINI_TEXT_API_KEY || ''
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3-pro-preview'

// 初始化 Gemini 客户端
const geminiClient = new GoogleGenAI({
  apiKey: GEMINI_TEXT_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { title, content, titlePrompt, contentPrompt } = await request.json()

    // 参数验证
    if (!title && !content) {
      return NextResponse.json(
        { success: false, error: '请提供标题或正文' },
        { status: 400 }
      )
    }

    // 检查 API Key
    if (!GEMINI_TEXT_API_KEY) {
      console.error('[内容改写] 错误: GEMINI_TEXT_API_KEY 未配置')
      return NextResponse.json(
        { success: false, error: 'API配置错误，请联系管理员' },
        { status: 500 }
      )
    }

    console.log('[内容改写] 开始改写')
    console.log('[内容改写] 使用模型:', GEMINI_TEXT_MODEL)
    console.log('[内容改写] 原标题:', title)
    console.log('[内容改写] 原正文长度:', content?.length || 0)

    let newTitle = title
    let newContent = content

    // 改写标题
    if (title && titlePrompt) {
      console.log('[内容改写] 正在改写标题...')
      console.log('[内容改写] 标题提示词:', titlePrompt.substring(0, 100) + '...')
      console.log('[内容改写] 原标题:', title)
      try {
        // 小红书标题表情指南
        const titleEmojiGuide = `
提示：可以在标题中适当添加小红书表情，但要注意：
- 标题建议 0-2 个表情
- 常用表情：[火R] [炸裂R] [赞R] [萌萌哒R] [笑哭R] [派对R]
- 表情位置：建议在标题末尾或关键词后
- 示例：这个宝藏好物太好用了[笑哭R] | 3个超小众景点[火R]人少景美
`

        // 构建完整的提示词
        const fullPrompt = `${titlePrompt}

${titleEmojiGuide}

原标题：${title}

新标题：`

        console.log('[内容改写] 发送到Gemini的完整提示:', fullPrompt)

        const titleResponse = await geminiClient.models.generateContent({
          model: GEMINI_TEXT_MODEL,
          contents: fullPrompt,         // 直接传字符串，而不是复杂对象
          config: {
            temperature: 1.0,           // 提高到 1.0，增加创造性
            topP: 0.95,                 // 增加输出多样性
            topK: 40,                   // 扩大候选词范围
            maxOutputTokens: 2000
            // 移除 candidateCount - 可能导致问题
          }
        })

        // 提取生成的文本
        const titleCandidate = titleResponse.candidates?.[0]
        const generatedText = titleCandidate?.content?.parts?.[0]?.text
        newTitle = generatedText?.trim() || title
        console.log('[内容改写] 新标题:', newTitle)
        console.log('[内容改写] 标题完成原因:', titleCandidate?.finishReason)
        console.log('[内容改写] 标题是否改变:', newTitle !== title)
      } catch (error) {
        console.error('[内容改写] 标题改写失败:', error)
        if (error instanceof Error) {
          console.error('[内容改写] 错误详情:', error.message)
          console.error('[内容改写] 错误堆栈:', error.stack)
        }
        // 标题改写失败不影响继续处理正文
      }
    } else {
      console.log('[内容改写] 跳过标题改写 - title:', !!title, 'titlePrompt:', !!titlePrompt)
    }

    // 改写正文
    if (content && contentPrompt) {
      console.log('[内容改写] 正在改写正文...')
      try {
        // 小红书表情库（自动添加模式）
        const emojiGuide = `
【重要】在改写后的文本中，在合适的位置添加小红书官方表情代码，让内容更生动有趣。

小红书表情格式：[表情名R]

常用表情列表：
1. 表情类：[萌萌哒R] [哈哈R] [笑哭R] [害羞R] [微笑R] [偷笑R] [大笑R]
2. 手势类：[比心R] [点赞R] [赞R] [加油R] [好的R] [飞吻R] [笔芯R]
3. 动作类：[吃瓜R] [冲鸭R] [打卡R] [派对R] [暗中观察R] [拿走R]
4. 强调类：[惊讶R] [思考R] [疑问R] [炸裂R] [酷盖R]

使用原则（必须遵守）：
1. 每段建议 1-2 个表情，全文 5-8 个表情
2. 表情要与内容相关，不要随意堆砌
3. 在关键位置使用：
   - 开头：吸引注意（[派对R] [炸裂R]）
   - 重点句：强调信息（[笑哭R] [赞R] [萌萌哒R]）
   - 结尾：行动号召（[拿走R] [比心R] [冲鸭R]）
4. 表情前后不需要空格，直接紧跟文字

正确示例：
"这款面膜真的太好用了[笑哭R]用了一个月皮肤水嫩嫩的[萌萌哒R]姐妹们快囤货[拿走R]"
"这个小众景点人少景美[派对R]拍照超出片[炸裂R]周末约起来[冲鸭R]"

错误示例（不要这样）：
"这个好物 [火R] [火R] [火R] 真的很不错"  ❌ 不要堆砌同一个表情
"今天天气不错[萌萌哒R]"  ❌ 表情与内容不匹配
`

        // 构建完整的提示词
        const fullContentPrompt = `${contentPrompt}

${emojiGuide}

原正文：${content}

请输出改写后的正文（记得添加小红书表情）：`

        const contentResponse = await geminiClient.models.generateContent({
          model: GEMINI_TEXT_MODEL,
          contents: fullContentPrompt,  // 直接传字符串
          config: {
            temperature: 0.9,           // 提高创造性（正文保持稍低于标题）
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192
          }
        })

        // 提取生成的文本
        const candidate = contentResponse.candidates?.[0]
        const generatedText = candidate?.content?.parts?.[0]?.text
        newContent = generatedText?.trim() || content

        // 调试：检查是否被截断
        console.log('[内容改写] 新正文长度:', newContent.length)
        console.log('[内容改写] 完成原因:', candidate?.finishReason)
        if (candidate?.finishReason === 'MAX_TOKENS') {
          console.warn('[内容改写] ⚠️ 内容被截断：达到最大token限制')
        }
      } catch (error) {
        console.error('[内容改写] 正文改写失败:', error)
        if (error instanceof Error) {
          console.error('[内容改写] 错误详情:', error.message)
          console.error('[内容改写] 错误堆栈:', error.stack)
        }
        throw new Error(`正文改写失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    // 计算字数和阅读时间（如果有正文的话）
    const wordCount = newContent ? newContent.replace(/\s/g, '').length : 0
    const readingTime = Math.ceil(wordCount / 400) // 假设每分钟阅读400字

    return NextResponse.json({
      success: true,
      data: {
        newTitle,
        newContent,
        wordCount,
        readingTime
      }
    })

  } catch (error) {
    console.error('[内容改写] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '改写过程中发生未知错误'
      },
      { status: 500 }
    )
  }
}
