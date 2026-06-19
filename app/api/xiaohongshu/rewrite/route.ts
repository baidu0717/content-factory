import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryContent, type AudienceType } from '@/lib/library-loader'

async function callLLM(model: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const isDeepSeek = model.startsWith('deepseek-')
  const apiKey = isDeepSeek
    ? (process.env.DEEPSEEK_API_KEY || '').trim()
    : (process.env.OPENROUTER_API_KEY || '').trim()
  const baseUrl = isDeepSeek
    ? 'https://api.deepseek.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions'

  const response = await fetch(baseUrl, {
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
    const REWRITE_MODEL = (process.env.REWRITE_MODEL || 'deepseek-v4-pro').trim()

    const { title, content, titlePrompt, contentPrompt, audienceType, travelGroup, model } = await request.json()
    const selectedModel = (model || REWRITE_MODEL).trim()

    if (!title && !content) {
      return NextResponse.json(
        { success: false, error: '请提供标题或正文' },
        { status: 400 }
      )
    }

    console.log('[内容改写] 开始改写，使用模型:', selectedModel)

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
        newTitle = await callLLM(selectedModel, fullPrompt, 200, 1.0) || title
        console.log('[内容改写] 新标题:', newTitle)
      } catch (error) {
        console.error('[内容改写] 标题改写失败:', error)
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
        const NARRATOR_BACKGROUNDS: Partial<Record<AudienceType, string>> = {
          '带父母': '【叙事背景】这篇笔记的作者刚陪长辈完成了一趟欧洲旅行。出发前的担心是具体的：长辈的体力、健康状况、能不能跟下来、会不会拖累行程。改写时「值了」「没白花」这类收尾，必须回应开头提到的那些具体担心——是哪个担心最后消解了，怎么消解的；不能用「大家都很开心」「笑得合不拢嘴」这类空泛表达代替。写的时候像在跟朋友说这趟经历，带着「终于做成了这件事」的轻松感，不是在写旅行攻略，也不是在打广告。',
          '带妈妈': '【叙事背景】这篇笔记的作者是一个女儿，刚带妈妈完成了一趟欧洲旅行。出发前的担心是双重的：一是妈妈身体能不能撑——长途坐车会不会难受、异国饮食习不习惯、体力够不够；二是情绪上的——妈妈这辈子没出过远门，一直想带她出去看看，这个愿望能不能圆得好。改写时「值了」的收尾，要回应这两个担心的其中之一：妈妈身体上的某个顾虑没发生，或者妈妈某个真实反应让她觉得这趟没白来；不能用「妈妈玩得很开心」代替。语气像女儿在跟朋友说，有点骄傲，有点感慨。',
          '带孩子': '【叙事背景】这篇笔记的作者是一位妈妈，刚带孩子（小学到高中，未满18岁）从欧洲回来。出发前最怕的是：孩子体力跟不上、饮食不适应、因为早起闹情绪、旅途中突然闹起来收不住，以及自己被累垮。改写时「值了」的收尾，要回应这些担心——那个预期会出问题的点没出问题，或者孩子某个反应让她觉得带出来是对的；不能用「孩子玩得很开心」代替。语气带一点「没想到还行」的真实感，不是推广文案。',
          '三代同游·带父母带孩子': '【叙事背景】这篇笔记的作者是30-40岁的中间这代人，带了老人和孩子一起出欧洲。平时工作忙，没时间做攻略，把行程全交出去了。操心的事分两头：老人体力节奏跟不跟得上、饮食能不能适应；孩子那边，希望他们在欧洲开开眼界多长见识，又怕他们体力不够、饮食挑剔。改写时「值了」的收尾，要同时照顾两头——老人那边哪件担心的事没发生，孩子那边有没有让她觉得这趟没白带；不能只说「大家都很开心」。语气是张罗了所有人之后终于松了口气的人在说话。',
          '情侣·夫妻': '【叙事背景】这篇笔记的作者是女方（二十八九到三十出头），刚和男友或老公完成了蜜月或情侣旅行，这趟是拼小团。出发前担心的是：跟陌生团友会不会尴尬或有摩擦、行程够不够浪漫、酒店品质能不能达到蜜月的标准。她们这个年纪也想体验刺激的户外项目，不只是拍照打卡。改写时「值了」的收尾，要回应她出发前的担心——团友相处怎么样、最在意的浪漫时刻有没有出现、酒店有没有惊到她；不能用「两个人玩得很开心」代替。语气像在跟闺蜜炫耀，带一点「没想到真的很好」的惊喜感。',
        }
        const narratorBackground = audienceType ? (NARRATOR_BACKGROUNDS[audienceType as AudienceType] ?? '') : ''
        const narratorSection = narratorBackground ? `\n\n${narratorBackground}` : ''
        console.log('[内容改写] 叙事背景注入:', narratorBackground ? '是' : '否', '受众:', audienceType)

        const libraryContent = audienceType
          ? loadLibraryContent(audienceType as AudienceType)
          : ''
        const librarySection = libraryContent ? `\n\n---\n\n${libraryContent}\n\n---` : ''
        console.log('[内容改写] 素材库注入长度:', libraryContent.length, '受众:', audienceType)
        const groupSection = travelGroup ? `\n\n【出行人员】${travelGroup}（请在改写中体现这个人物组合，调整人称和人数描述）` : ''
        const fullContentPrompt = `${contentPrompt}${narratorSection}${librarySection}${groupSection}\n\n${emojiGuide}\n\n原正文：${content}\n\n请输出改写后的正文（记得添加小红书表情）：`
        newContent = await callLLM(selectedModel, fullContentPrompt, 8192, 0.9) || content
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
