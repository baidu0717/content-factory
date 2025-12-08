import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { setGlobalDispatcher, ProxyAgent } from 'undici'
import fs from 'fs'
import path from 'path'
import { createSession, loadSession, updateSession } from '@/lib/imageSession'
import { saveHistory } from '@/lib/imageHistory'

// 配置代理
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7897'
const proxyAgent = new ProxyAgent(HTTPS_PROXY)
setGlobalDispatcher(proxyAgent)

// API 配置
const GEMINI_TEXT_API_KEY = process.env.GEMINI_TEXT_API_KEY || ''
const GEMINI_PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview'

// 调试：输出环境变量状态
console.log('[Gemini API Debug] GEMINI_TEXT_API_KEY exists:', !!GEMINI_TEXT_API_KEY)
console.log('[Gemini API Debug] GEMINI_TEXT_API_KEY length:', GEMINI_TEXT_API_KEY.length)
console.log('[Gemini API Debug] All GEMINI env vars:', Object.keys(process.env).filter(key => key.includes('GEMINI')))

// 初始化客户端
const genAI = new GoogleGenAI({
  apiKey: GEMINI_TEXT_API_KEY
})

// 请求参数类型
interface GeminiImageRequest {
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  sessionId?: string           // 可选，用于多轮对话
  uploadedImage?: string       // 图生图模式必需
  aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  resolution?: '2k' | '4k'
  isTravelMode?: boolean       // 云旅游模式
  style?: string               // 创意模式的风格
}

/**
 * 根据分辨率和宽高比计算具体的像素尺寸
 */
function getResolutionDimensions(
  aspectRatio: string,
  resolution: '2k' | '4k' = '2k'
): { width: number; height: number; description: string } {
  const resolutions: Record<string, Record<string, { width: number; height: number }>> = {
    '2k': {
      '16:9': { width: 2560, height: 1440 },
      '9:16': { width: 1440, height: 2560 },
      '4:3': { width: 1920, height: 1440 },
      '3:4': { width: 1440, height: 1920 },
      '1:1': { width: 1440, height: 1440 }
    },
    '4k': {
      '16:9': { width: 3840, height: 2160 },
      '9:16': { width: 2160, height: 3840 },
      '4:3': { width: 2880, height: 2160 },
      '3:4': { width: 2160, height: 2880 },
      '1:1': { width: 2160, height: 2160 }
    }
  }

  const dims = resolutions[resolution][aspectRatio] || resolutions['2k']['16:9']
  const description = `${dims.width}×${dims.height} (${resolution.toUpperCase()} ${aspectRatio})`

  return {
    width: dims.width,
    height: dims.height,
    description
  }
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(
  mode: 'text-to-image' | 'image-to-image',
  aspectRatio: string,
  resolution: '2k' | '4k',
  isTravelMode: boolean = false,
  style?: string
): string {
  const { width, height, description } = getResolutionDimensions(aspectRatio, resolution)

  // 获取当前时间信息
  const currentDate = new Date()
  const dateTimeInfo = `当前时间: ${currentDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    timeZone: 'Asia/Shanghai'
  })}`

  let basePrompt = ''

  if (mode === 'text-to-image') {
    if (isTravelMode) {
      // 云旅游模式
      basePrompt = `You are a professional travel photographer with internet access and real-time location awareness.

${dateTimeInfo}

Please follow these requirements:
1. **Use Internet Search**: Use your internet search capabilities to find current real-time information about the location (weather, events, seasonal features, current attractions)
2. **Real-time accuracy**: Generate images that reflect current actual conditions at the destination
3. **Professional quality**: Create stunning travel photography with professional composition
4. **Image resolution**: Generate a high-quality ${description} image
5. **Image dimensions**: Exactly ${width}×${height} pixels
6. **Quality**: Ultra-high quality, sharp details, professional-grade output

CRITICAL REQUIREMENTS:
- Output resolution must be EXACTLY ${width}×${height} pixels
- Maintain maximum sharpness and clarity at ${resolution.toUpperCase()} quality
- Use current real-time data from internet search for accurate representation
- No compression artifacts, preserve fine details
- Professional color accuracy and dynamic range`
    } else {
      // 创意模式
      basePrompt = `You are a professional creative artist with internet access.

${dateTimeInfo}

Please follow these requirements:
1. **Use Internet Search**: Use your internet search capabilities for current trends and references if needed
2. **Creative interpretation**: Transform the text description into stunning visual art
3. **Style**: ${style || 'Professional, high-quality artistic style'}
4. **Image resolution**: Generate a high-quality ${description} image
5. **Image dimensions**: Exactly ${width}×${height} pixels
6. **Quality**: Ultra-high quality, sharp details, professional-grade output

CRITICAL REQUIREMENTS:
- Output resolution must be EXACTLY ${width}×${height} pixels
- Maintain maximum sharpness and clarity at ${resolution.toUpperCase()} quality
- No compression artifacts, preserve fine details
- Professional color accuracy and dynamic range`
    }
  } else {
    // 图生图模式
    basePrompt = `You are a professional image editor with internet access.

${dateTimeInfo}

Please follow these requirements:
1. **Use Internet Search**: Use your internet search capabilities to find real-time information if the instruction requires current data (weather, time-specific scenes, current events, etc.)
2. **Understand the instruction**: Carefully interpret what the user wants to modify
3. **Preserve original content**: Keep elements that aren't mentioned in the instruction
4. **Apply changes**: Make the requested modifications naturally and professionally with accurate real-time information
5. **Image resolution**: Generate a high-quality ${description} image
6. **Image dimensions**: Exactly ${width}×${height} pixels
7. **Quality**: Ultra-high quality, sharp details, professional-grade output

CRITICAL REQUIREMENTS:
- Output resolution must be EXACTLY ${width}×${height} pixels
- Maintain maximum sharpness and clarity at ${resolution.toUpperCase()} quality
- No compression artifacts, preserve fine details
- Professional color accuracy and dynamic range
- Use real-time information from internet search when relevant to the editing instruction`
  }

  return basePrompt
}

/**
 * 保存图片到本地文件系统
 */
async function saveImageToLocal(base64Data: string, filename: string): Promise<string> {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Image, 'base64')

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const filepath = path.join(uploadDir, `${timestamp}-${filename}.png`)

    fs.writeFileSync(filepath, buffer)

    const publicUrl = `/uploads/images/${timestamp}-${filename}.png`
    console.log('[文件保存] 图片已保存:', publicUrl)

    return publicUrl
  } catch (error) {
    console.error('[文件保存] 保存失败:', error)
    throw new Error(`图片保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * POST /api/imagen/gemini
 * Gemini 图片生成 API（支持多轮对话）
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('='.repeat(80))
    console.log('[Gemini API] 收到图片生成请求')

    // 验证 API Key
    if (!GEMINI_TEXT_API_KEY) {
      return NextResponse.json(
        { success: false, error: '未配置 API Key，请检查环境变量' },
        { status: 500 }
      )
    }

    // 解析请求参数
    const body: GeminiImageRequest = await request.json()
    const {
      mode,
      prompt,
      sessionId,
      uploadedImage,
      aspectRatio = '16:9',
      resolution = '2k',
      isTravelMode = false,
      style
    } = body

    // 参数验证
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: '请提供提示词' },
        { status: 400 }
      )
    }

    // 图生图模式在第一轮需要上传图片，后续轮次不需要
    if (mode === 'image-to-image' && !uploadedImage && !sessionId) {
      return NextResponse.json(
        { success: false, error: '图生图模式的第一轮需要上传图片' },
        { status: 400 }
      )
    }

    console.log('[Gemini API] 参数:', {
      mode,
      sessionId: sessionId || '新会话',
      prompt: prompt.substring(0, 100),
      aspectRatio,
      resolution,
      isTravelMode,
      style
    })

    // 1. 加载或创建会话
    let session = sessionId ? loadSession(sessionId) : null
    let turnNumber = 1

    if (session) {
      // 验证会话模型和模式是否匹配
      if (session.model !== 'gemini') {
        return NextResponse.json(
          { success: false, error: '会话模型不匹配，该会话不是 Gemini 创建的' },
          { status: 400 }
        )
      }

      // 计算当前是第几轮
      const conversationHistory = session.conversation_history || []
      // 计算用户消息的数量（不包括模型回复）
      turnNumber = conversationHistory.filter((msg: any) => msg.role === 'user').length + 1

      console.log(`[Gemini API] 继续会话: ${sessionId}, 第 ${turnNumber} 轮`)
    } else {
      // 创建新会话
      session = createSession('gemini', mode)
      console.log(`[Gemini API] 创建新会话: ${session.session_id}`)
    }

    // 2. 准备对话历史
    const conversationHistory = session.conversation_history || []

    // 3. 构建系统提示词
    const systemPrompt = buildSystemPrompt(mode, aspectRatio, resolution, isTravelMode, style)
    const fullPrompt = `${systemPrompt}\n\nUser's request: ${prompt}`

    // 4. 准备消息内容
    const userMessage: any = {
      role: 'user',
      parts: []
    }

    // 如果是图生图模式，添加图片
    if (mode === 'image-to-image' && uploadedImage) {
      const base64Data = uploadedImage.replace(/^data:image\/\w+;base64,/, '')
      userMessage.parts.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg'
        }
      })
    }

    // 添加文本提示词
    userMessage.parts.push({ text: fullPrompt })

    // 5. 调用 Gemini API（使用多轮对话模式）
    console.log('[Gemini API] 调用 Gemini 3 Pro Image...')

    // 将分辨率转换为 API 格式
    const apiImageSize = resolution === '2k' ? '2K' : '4K'

    // 构建完整的对话内容（历史 + 新消息）
    const allContents = [...conversationHistory, userMessage]
    console.log(`[Gemini API] 对话历史长度: ${conversationHistory.length}, 总内容数: ${allContents.length}`)

    // 调用 generateContent API
    const response = await genAI.models.generateContent({
      model: GEMINI_PRO_IMAGE_MODEL,
      contents: allContents,
      config: {
        temperature: 0.7,
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: apiImageSize,
        }
      }
    })

    console.log('[Gemini API] API 调用成功')

    // 6. 提取图片数据
    const imageDataList: string[] = []

    if (response.candidates && response.candidates.length > 0) {
      for (const candidate of response.candidates) {
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const base64Data = part.inlineData.data
              const mimeType = part.inlineData.mimeType || 'image/png'
              const dataUrl = `data:${mimeType};base64,${base64Data}`
              imageDataList.push(dataUrl)
            }
          }
        }
      }
    }

    if (imageDataList.length === 0) {
      throw new Error('Gemini 未返回任何图片')
    }

    console.log(`[Gemini API] 成功生成 ${imageDataList.length} 张图片`)

    // 7. 保存图片到本地
    const savedUrls: string[] = []
    for (let i = 0; i < imageDataList.length; i++) {
      const filename = `gemini-${mode}-turn${turnNumber}-${i + 1}`
      const url = await saveImageToLocal(imageDataList[i], filename)
      savedUrls.push(url)
    }

    // 8. 构建更新后的对话历史（添加模型回复）
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('模型未返回有效响应')
    }
    const modelResponse = response.candidates[0].content
    const updatedHistory = [...conversationHistory, userMessage, modelResponse]
    console.log(`[Gemini API] 更新后对话历史长度: ${updatedHistory.length}`)

    // 9. 更新会话
    updateSession(session.session_id, {
      conversation_history: updatedHistory,
      last_image_url: savedUrls[0]
    })

    // 10. 保存到历史记录
    const duration = Date.now() - startTime

    for (const imageUrl of savedUrls) {
      saveHistory({
        session_id: session.session_id,
        turn_number: turnNumber,
        model: 'gemini',
        mode,
        prompt,
        image_url: imageUrl,
        aspect_ratio: aspectRatio,
        resolution,
        duration
      })
    }

    console.log('[Gemini API] 生成成功')
    console.log('[Gemini API] 会话ID:', session.session_id)
    console.log('[Gemini API] 轮次:', turnNumber)
    console.log('[Gemini API] 耗时:', duration + 'ms')
    console.log('='.repeat(80))

    return NextResponse.json({
      success: true,
      data: {
        images: savedUrls,
        sessionId: session.session_id,
        turnNumber: turnNumber,
        prompt: prompt,
        mode: mode,
        model: GEMINI_PRO_IMAGE_MODEL,
        duration: duration,
        conversationLength: updatedHistory.length
      }
    })

  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime

    console.error('[Gemini API] 错误:', error)
    console.log('[Gemini API] 失败耗时:', duration + 'ms')
    console.log('='.repeat(80))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图片生成失败'
      },
      { status: 500 }
    )
  }
}
