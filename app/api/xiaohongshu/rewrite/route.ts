import { NextRequest, NextResponse } from 'next/server'

async function callOpenRouter(apiKey: string, model: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      top_p: 0.95,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`${response.status} ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function POST(request: NextRequest) {
  try {
    const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim()
    const REWRITE_MODEL = (process.env.REWRITE_MODEL || 'anthropic/claude-sonnet-4.6').trim()


    const { title, content, titlePrompt, contentPrompt } = await request.json()

    if (!title && !content) {
      return NextResponse.json(
        { success: false, error: '请提供标题或正文' },
        { status: 400 }
      )
    }

    if (!OPENROUTER_API_KEY) {
      console.error('[内容改写] 错误: OPENROUTER_API_KEY 未配置')
      return NextResponse.json(
        { success: false, error: 'API配置错误，请联系管理员' },
        { status: 500 }
      )
    }

    console.log('[内容改写] 开始改写，使用模型:', REWRITE_MODEL)

    let newTitle = title
    let newContent = content

    // 改写标题
    if (title && titlePrompt) {
      console.log('[内容改写] 正在改写标题...')
      try {
        const titleEmojiGuide = `
提示：可以在标题中适当添加小红书表情，但要注意：
- 标题建议 0-2 个表情
- 常用表情：[火R] [炸裂R] [赞R] [萌萌哒R] [笑哭R] [派对R]
- 表情位置：建议在标题末尾或关键词后
- 示例：这个宝藏好物太好用了[笑哭R] | 3个超小众景点[火R]人少景美
`
        const fullPrompt = `${titlePrompt}\n\n${titleEmojiGuide}\n\n原标题：${title}\n\n新标题：`
        newTitle = await callOpenRouter(OPENROUTER_API_KEY, REWRITE_MODEL, fullPrompt, 200, 1.0) || title
        console.log('[内容改写] 新标题:', newTitle)
      } catch (error) {
        console.error('[内容改写] 标题改写失败:', error)
        // 标题失败不影响正文
      }
    }

    // 改写正文
    if (content && contentPrompt) {
      console.log('[内容改写] 正在改写正文...')
      try {
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
`
        const fullContentPrompt = `${contentPrompt}\n\n${emojiGuide}\n\n原正文：${content}\n\n请输出改写后的正文（记得添加小红书表情）：`
        newContent = await callOpenRouter(OPENROUTER_API_KEY, REWRITE_MODEL, fullContentPrompt, 8192, 0.9) || content
        console.log('[内容改写] 新正文长度:', newContent.length)
      } catch (error) {
        console.error('[内容改写] 正文改写失败:', error)
        throw new Error(`正文改写失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    const wordCount = newContent ? newContent.replace(/\s/g, '').length : 0
    const readingTime = Math.ceil(wordCount / 400)

    return NextResponse.json({
      success: true,
      data: { newTitle, newContent, wordCount, readingTime }
    })

  } catch (error) {
    console.error('[内容改写] 错误:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '改写过程中发生未知错误' },
      { status: 500 }
    )
  }
}
