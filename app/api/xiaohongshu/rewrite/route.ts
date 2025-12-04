import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  baseURL: process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENAI_API_KEY,
})

const MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o'

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
        const titleResponse = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的文案改写专家，擅长创作吸引人的标题。'
            },
            {
              role: 'user',
              content: `${titlePrompt}\n\n原标题：${title}`
            }
          ],
          temperature: 0.8,
          max_tokens: 200
        })

        newTitle = titleResponse.choices[0]?.message?.content?.trim() || title
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
        const contentResponse = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的内容创作者，擅长将内容改写为全新的、高质量的原创文章，同时保持核心观点和价值。'
            },
            {
              role: 'user',
              content: `${contentPrompt}\n\n原正文：${content}`
            }
          ],
          temperature: 0.8,
          max_tokens: 2000
        })

        newContent = contentResponse.choices[0]?.message?.content?.trim() || content
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
