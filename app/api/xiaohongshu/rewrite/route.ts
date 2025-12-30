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

    console.log('[内容改写] 开始改写')
    console.log('[内容改写] 原标题:', title)
    console.log('[内容改写] 原正文长度:', content?.length || 0)

    let newTitle = title
    let newContent = content

    // 改写标题
    if (title && titlePrompt) {
      console.log('[内容改写] 正在改写标题...')
      try {
        const titleContents = [
          {
            role: 'user',
            parts: [{
              text: `你是一个专业的文案改写专家，擅长创作吸引人的标题。\n\n${titlePrompt}\n\n原标题：${title}`
            }]
          }
        ]

        const titleResponse = await geminiClient.models.generateContent({
          model: GEMINI_TEXT_MODEL,
          contents: titleContents,
          config: {
            temperature: 0.8,
            maxOutputTokens: 200
          }
        })

        // 提取生成的文本
        const generatedText = titleResponse.candidates?.[0]?.content?.parts?.[0]?.text
        newTitle = generatedText?.trim() || title
        console.log('[内容改写] 新标题:', newTitle)
      } catch (error) {
        console.error('[内容改写] 标题改写失败:', error)
        // 标题改写失败不影响继续处理正文
      }
    }

    // 改写正文
    if (content && contentPrompt) {
      console.log('[内容改写] 正在改写正文...')
      try {
        const contentContents = [
          {
            role: 'user',
            parts: [{
              text: `你是一个专业的内容创作者，擅长将内容改写为全新的、高质量的原创文章，同时保持核心观点和价值。\n\n${contentPrompt}\n\n原正文：${content}`
            }]
          }
        ]

        const contentResponse = await geminiClient.models.generateContent({
          model: GEMINI_TEXT_MODEL,
          contents: contentContents,
          config: {
            temperature: 0.8,
            maxOutputTokens: 2000
          }
        })

        // 提取生成的文本
        const generatedText = contentResponse.candidates?.[0]?.content?.parts?.[0]?.text
        newContent = generatedText?.trim() || content
        console.log('[内容改写] 新正文长度:', newContent.length)
      } catch (error) {
        console.error('[内容改写] 正文改写失败:', error)
        throw new Error('正文改写失败，请重试')
      }
    }

    // 计算字数和阅读时间
    const wordCount = newContent.replace(/\s/g, '').length
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
