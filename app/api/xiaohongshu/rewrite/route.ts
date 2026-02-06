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
        // 构建完整的提示词
        const fullPrompt = `${titlePrompt}

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
        // 构建完整的提示词
        const fullContentPrompt = `${contentPrompt}

原正文：${content}

请输出改写后的正文：`

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
