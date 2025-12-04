/**
 * Gemini API 图片生成工具
 * 使用 gemini-3-pro-image-preview 模型生成文章配图（支持联网功能）
 */

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { fetch as undiciFetch, Agent } from 'undici'

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_IMAGE_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// 配置 Undici Agent，增加连接和请求超时
const agent = new Agent({
  connect: {
    timeout: 120000, // 连接超时 120 秒
  },
  bodyTimeout: 120000, // 请求体超时 120 秒
  headersTimeout: 120000, // 响应头超时 120 秒
})

// OpenAI API 配置（用于生成图片提示词和翻译）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o'

/**
 * 调用 OpenAI API 生成图片提示词（中文）
 */
async function generateImagePrompts(
  articleTitle: string,
  articleContent: string,
  imageCount: number
): Promise<string[]> {
  if (imageCount === 0) return []

  console.log(`[图片生成] 开始生成 ${imageCount} 个图片提示词...`)

  if (!OPENAI_API_KEY) {
    throw new Error('未配置 OPENAI_API_KEY')
  }

  // 截取文章内容（避免太长）
  const contentPreview = articleContent.substring(0, 2000)

  const prompt = `请根据以下文章内容，生成 ${imageCount} 个高质量的图片提示词（prompt），用于生成文章配图。

**文章标题**：${articleTitle}

**文章内容摘要**：
${contentPreview}${articleContent.length > 2000 ? '...' : ''}

**要求**：
1. 每个提示词应该描述一个与文章内容相关的场景、概念或视觉元素
2. 提示词使用中文，描述要具体、生动
3. 提示词应该适合生成插图风格的图片
4. 每个提示词描述一个不同的场景，覆盖文章的不同部分
5. 避免人物肖像，优先选择场景、物品、概念图等

请返回 JSON 格式：
{
  "prompts": [${Array(imageCount).fill(0).map((_, i) => `"提示词${i + 1}"`).join(', ')}]
}

注意：必须严格返回 ${imageCount} 个提示词，直接返回 JSON，不要包含任何其他文字说明。`

  const messages = [
    {
      role: 'system',
      content: '你是一位专业的视觉设计师，擅长为文章内容设计配图方案。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 调用失败: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    // 提取 JSON 内容
    let jsonText = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const result = JSON.parse(jsonText)
    const prompts = result.prompts || []

    console.log(`[图片生成] 成功生成 ${prompts.length} 个中文提示词`)
    prompts.forEach((p: string, i: number) => {
      console.log(`[图片生成] 提示词 ${i + 1}: ${p}`)
    })

    return prompts

  } catch (error) {
    console.error('[图片生成] 生成提示词失败:', error)
    throw new Error(`生成图片提示词失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 将中文提示词翻译为英文（Gemini API 仅支持英文）
 */
async function translateToEnglish(chinesePrompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('未配置 OPENAI_API_KEY')
  }

  console.log(`[翻译] 翻译提示词: ${chinesePrompt}`)

  const messages = [
    {
      role: 'system',
      content: 'You are a professional translator. Translate Chinese image generation prompts to English, keeping the description vivid and detailed.'
    },
    {
      role: 'user',
      content: `请将以下中文图片提示词翻译成英文，保持描述的生动性和细节：\n\n${chinesePrompt}`
    }
  ]

  try {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`翻译API调用失败: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const englishPrompt = data.choices[0]?.message?.content?.trim() || chinesePrompt

    console.log(`[翻译] 英文提示词: ${englishPrompt}`)
    return englishPrompt

  } catch (error) {
    console.error('[翻译] 翻译失败:', error)
    // 翻译失败则返回原文
    return chinesePrompt
  }
}

/**
 * 调用 Gemini API 生成单张图片（支持联网）
 */
async function generateSingleImage(prompt: string, retryCount = 0): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    throw new Error('未配置 GEMINI_IMAGE_API_KEY')
  }

  const maxRetries = 2
  const timeout = 60000 // 60秒超时

  console.log(`[Gemini] 生成图片，提示词: ${prompt.substring(0, 100)}...`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // 构建请求体
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '2K'
        }
      },
      tools: [
        { google_search: {} }  // 启用 Google Search grounding
      ]
    }

    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`

    console.log(`[Gemini] API URL: ${url}`)
    console.log(`[Gemini] 请求配置:`, JSON.stringify(requestBody, null, 2))

    const response = await undiciFetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      dispatcher: agent
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Gemini] API 调用失败: ${response.status} ${errorText}`)

      // 如果是频控错误（429）且还有重试次数，等待后重试
      if (response.status === 429 && retryCount < maxRetries) {
        const waitTime = (retryCount + 1) * 2000
        console.log(`[Gemini] 遇到频控限制，等待 ${waitTime}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return generateSingleImage(prompt, retryCount + 1)
      }

      throw new Error(`Gemini API 调用失败: ${response.status}`)
    }

    const data = await response.json()
    console.log(`[Gemini] 响应数据:`, JSON.stringify(data, null, 2))

    // 从响应中提取 Base64 图片数据
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inline_data
    )

    if (!imagePart || !imagePart.inline_data?.data) {
      throw new Error('未能从响应中获取图片数据')
    }

    const base64Data = imagePart.inline_data.data
    const mimeType = imagePart.inline_data.mime_type || 'image/png'

    console.log(`[Gemini] 成功获取图片数据，MIME类型: ${mimeType}，数据长度: ${base64Data.length}`)

    // 保存 Base64 图片到本地文件
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const extension = mimeType.split('/')[1] || 'png'
    const filename = `gemini-${timestamp}-${randomStr}.${extension}`
    const filepath = join(process.cwd(), 'public', 'generated-images', filename)

    // 将 Base64 转换为 Buffer 并保存
    const buffer = Buffer.from(base64Data, 'base64')
    await writeFile(filepath, buffer)

    const publicUrl = `/generated-images/${filename}`
    console.log(`[Gemini] 图片已保存: ${publicUrl}`)

    return publicUrl

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Gemini] 请求超时')
    } else {
      console.error('[Gemini] 生成图片失败:', error)
    }

    // 如果还有重试次数，重试
    if (retryCount < maxRetries) {
      console.log(`[Gemini] 重试生成图片 (${retryCount + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return generateSingleImage(prompt, retryCount + 1)
    }

    // 达到最大重试次数，返回 null
    return null
  }
}

/**
 * 批量生成文章配图（主函数）
 * @param articleTitle 文章标题
 * @param articleContent 文章内容
 * @param imageCount 图片数量
 * @returns 图片URL数组
 */
export async function generateArticleImages(
  articleTitle: string,
  articleContent: string,
  imageCount: number
): Promise<string[]> {
  if (imageCount === 0) return []

  console.log(`[图片生成] 开始为文章生成 ${imageCount} 张配图`)
  console.log(`[图片生成] 文章标题: ${articleTitle}`)

  try {
    // Step 1: 生成中文图片提示词
    const chinesePrompts = await generateImagePrompts(articleTitle, articleContent, imageCount)

    if (chinesePrompts.length === 0) {
      console.warn('[图片生成] 未生成任何提示词，跳过图片生成')
      return []
    }

    // Step 2: 翻译为英文
    console.log(`[图片生成] 开始翻译 ${chinesePrompts.length} 个提示词为英文...`)
    const englishPrompts: string[] = []
    for (const chinesePrompt of chinesePrompts) {
      const englishPrompt = await translateToEnglish(chinesePrompt)
      englishPrompts.push(englishPrompt)
    }

    // Step 3: 顺序生成所有图片（避免频控）
    console.log(`[图片生成] 开始生成 ${englishPrompts.length} 张图片...`)
    const imageUrls: string[] = []

    for (let i = 0; i < englishPrompts.length; i++) {
      const prompt = englishPrompts[i]
      console.log(`[图片生成] 生成第 ${i + 1}/${englishPrompts.length} 张图片...`)

      const imageUrl = await generateSingleImage(prompt)

      if (imageUrl) {
        imageUrls.push(imageUrl)
      } else {
        console.warn(`[图片生成] 第 ${i + 1} 张图片生成失败，跳过`)
      }

      // 如果不是最后一张，等待一小段时间避免频控
      if (i < englishPrompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2秒间隔
      }
    }

    console.log(`[图片生成] 成功生成 ${imageUrls.length}/${imageCount} 张图片`)
    return imageUrls

  } catch (error) {
    console.error('[图片生成] 生成配图失败:', error)
    // 不抛出错误，返回空数组，不影响文章生成流程
    return []
  }
}
