import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { setGlobalDispatcher, ProxyAgent } from 'undici'
import fs from 'fs'
import path from 'path'

// 配置代理
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7897'
const proxyAgent = new ProxyAgent(HTTPS_PROXY)
setGlobalDispatcher(proxyAgent)

// API 配置
const GEMINI_TEXT_API_KEY = process.env.GEMINI_TEXT_API_KEY || ''
const GEMINI_IMAGE_API_KEY = process.env.GEMINI_IMAGE_API_KEY || ''
const GEMINI_PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview' // 云旅游模式：带联网功能的多模态模型
const IMAGEN_MODEL = 'imagen-4.0-generate-001' // 创意模式：Imagen 4 专业生图

// 调试：输出环境变量状态
console.log('[Imagen Generate API Debug] GEMINI_TEXT_API_KEY exists:', !!GEMINI_TEXT_API_KEY)
console.log('[Imagen Generate API Debug] GEMINI_TEXT_API_KEY length:', GEMINI_TEXT_API_KEY.length)
console.log('[Imagen Generate API Debug] GEMINI_IMAGE_API_KEY exists:', !!GEMINI_IMAGE_API_KEY)
console.log('[Imagen Generate API Debug] GEMINI_IMAGE_API_KEY length:', GEMINI_IMAGE_API_KEY.length)

// 初始化客户端
const genAI = new GoogleGenAI({
  apiKey: GEMINI_TEXT_API_KEY
})

const imageAI = new GoogleGenAI({
  apiKey: GEMINI_IMAGE_API_KEY
})

// 请求参数类型
interface ImageGenerateRequest {
  prompt: string
  isTravelMode: boolean
  aspectRatio: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  numberOfImages: number
  style?: string
  resolution?: '2k' | '4k'
}

/**
 * 根据分辨率和宽高比计算具体的像素尺寸
 */
function getResolutionDimensions(
  aspectRatio: string,
  resolution: '2k' | '4k' = '2k'
): { width: number; height: number; description: string } {
  const resolutions: Record<string, Record<string, { width: number; height: number }>> = {
    '1080p': {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '4:3': { width: 1440, height: 1080 },
      '3:4': { width: 1080, height: 1440 },
      '1:1': { width: 1080, height: 1080 }
    },
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
 * 云旅游模式：使用 Gemini 3 Pro Image 直接生成实景图片（带联网功能）
 */
async function generateTravelImage(
  userInput: string,
  aspectRatio: string,
  numberOfImages: number,
  resolution: '2k' | '4k' = '2k'
): Promise<string[]> {
  console.log('[云旅游模式] 使用 Gemini 3 Pro Image 生成实景图片...')
  console.log('[云旅游模式] 用户输入:', userInput)
  console.log('[云旅游模式] 目标宽高比:', aspectRatio)
  console.log('[云旅游模式] 数量:', numberOfImages)
  console.log('[云旅游模式] 分辨率:', resolution)

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

  // 获取具体的分辨率尺寸
  const { width, height, description } = getResolutionDimensions(aspectRatio, resolution)
  console.log('[云旅游模式] 目标尺寸:', description)

  const systemPrompt = `你是一个专业的地理和环境分析专家，擅长根据地理位置和时间信息生成真实的实景照片。

用户输入可能是：
1. 地理坐标（如 "48.8584, 2.2945"）
2. 地名（如 "巴黎埃菲尔铁塔"）
3. 自然语言（如 "我想看东京春天的樱花"）

${dateTimeInfo}

请根据以下要求生成高度写实的实景照片：
1. **实时信息查询**：使用联网功能查询该地点当前的真实天气、季节状况
2. **环境还原**：准确还原该地点在当前时间的真实环境（天气、光线、植被、人群等）
3. **地标识别**：如果是著名地标，确保准确还原其真实外观
4. **摄影风格**：采用专业摄影风格，photorealistic，自然光照
5. **细节丰富**：包含真实的环境细节（建筑、植被、天空、人群活动等）
6. **图片分辨率**：生成高质量 ${description} 图片
7. **图片尺寸**：精确 ${width}×${height} 像素

CRITICAL REQUIREMENTS:
- Output resolution must be EXACTLY ${width}×${height} pixels
- Ultra-high quality at ${resolution.toUpperCase()} standard
- Maximum sharpness and clarity, no compression artifacts
- Professional color grading and dynamic range

生成真实的实景照片，就像现在在该地点用专业相机拍摄的高清照片一样。`

  try {
    // 设置较长的超时时间，并添加重试机制
    let retries = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[云旅游模式] 第 ${attempt + 1} 次尝试...`)
        }

        // 将分辨率转换为 API 格式（必须大写 K）
        const apiImageSize = resolution === '2k' ? '2K' : '4K'
        console.log('[云旅游模式] API 分辨率参数:', apiImageSize)

        const response = await genAI.models.generateContent({
          model: GEMINI_PRO_IMAGE_MODEL,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n用户输入: ${userInput}` }]
            }
          ],
          config: {
            temperature: 0.7,
            responseModalities: ['IMAGE'], // 指定返回图片
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: apiImageSize,  // 添加分辨率参数
            }
          }
        })

        console.log('[云旅游模式] Gemini 3 Pro Image API 调用成功')

        // 提取图片数据
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
          throw new Error('Gemini 3 Pro Image 未返回任何图片')
        }

        console.log(`[云旅游模式] 成功生成 ${imageDataList.length} 张图片`)
        return imageDataList

      } catch (error) {
        lastError = error as Error
        console.error(`[云旅游模式] 第 ${attempt + 1} 次尝试失败:`, error)

        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          const waitTime = (attempt + 1) * 2000 // 递增等待时间：2s, 4s
          console.log(`[云旅游模式] 等待 ${waitTime}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    // 所有重试都失败
    throw new Error(`云旅游模式生成失败（已重试${retries}次）: ${lastError?.message || '未知错误'}`)

  } catch (error) {
    console.error('[云旅游模式] Gemini 3 Pro Image 生成失败:', error)
    throw new Error(`云旅游模式生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 创意模式：使用 Imagen 4 生成高质量创意图片
 */
async function generateCreativeImage(
  prompt: string,
  aspectRatio: string,
  numberOfImages: number,
  resolution: '2k' | '4k' = '2k'
): Promise<string[]> {
  console.log('[创意模式] 使用 Imagen 4 生成图片...')
  console.log('[创意模式] 提示词:', prompt)
  console.log('[创意模式] 宽高比:', aspectRatio)
  console.log('[创意模式] 数量:', numberOfImages)
  console.log('[创意模式] 分辨率:', resolution)

  // 获取具体的分辨率尺寸
  const { width, height, description } = getResolutionDimensions(aspectRatio, resolution)
  console.log('[创意模式] 目标尺寸:', description)

  // 在提示词中添加分辨率要求
  const enhancedPrompt = `${prompt}. IMPORTANT: Generate at ${description} resolution (${width}×${height} pixels), ultra-high quality, maximum sharpness and detail at ${resolution.toUpperCase()} standard.`

  try {
    // Imagen 4 API 只支持 1K 和 2K，所以 2k 和 4k 都使用 2K（最高质量）
    const apiImageSize = '2K'
    console.log('[创意模式] API 分辨率参数:', apiImageSize)

    const response = await imageAI.models.generateImages({
      model: IMAGEN_MODEL,
      prompt: enhancedPrompt,
      config: {
        numberOfImages: numberOfImages,
        aspectRatio: aspectRatio as any,
        imageSize: apiImageSize,  // 添加分辨率参数
      }
    })

    console.log('[创意模式] Imagen 4 API 调用成功')

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error('Imagen 4 未返回任何图片')
    }

    // 提取 base64 图片数据
    const imageDataList: string[] = []
    for (const img of response.generatedImages) {
      if (img.image?.imageBytes) {
        const base64Data = img.image.imageBytes
        const dataUrl = `data:image/png;base64,${base64Data}`
        imageDataList.push(dataUrl)
      }
    }

    console.log(`[创意模式] 成功生成 ${imageDataList.length} 张图片`)
    return imageDataList

  } catch (error) {
    console.error('[创意模式] Imagen 4 生成失败:', error)
    throw new Error(`创意模式生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 保存图片到本地文件系统
 */
async function saveImageToLocal(base64Data: string, filename: string): Promise<string> {
  try {
    // 移除 data URL 前缀
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Image, 'base64')

    // 创建保存目录
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // 生成文件路径
    const timestamp = Date.now()
    const filepath = path.join(uploadDir, `${timestamp}-${filename}.png`)

    // 保存文件
    fs.writeFileSync(filepath, buffer)

    // 返回公开访问 URL
    const publicUrl = `/uploads/images/${timestamp}-${filename}.png`
    console.log('[文件保存] 图片已保存:', publicUrl)

    return publicUrl

  } catch (error) {
    console.error('[文件保存] 保存失败:', error)
    throw new Error(`图片保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * POST /api/imagen/generate
 * 生成图片（支持双模式）
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('='.repeat(80))
    console.log('[Imagen API] 收到生图请求')

    // 验证 API Key
    if (!GEMINI_TEXT_API_KEY || !GEMINI_IMAGE_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置 API Key，请检查环境变量'
        },
        { status: 500 }
      )
    }

    // 解析请求参数
    const body: ImageGenerateRequest = await request.json()
    const {
      prompt: userInput,
      isTravelMode = false,
      aspectRatio = '16:9',
      numberOfImages = 1,
      style = '',
      resolution = '2k'
    } = body

    // 参数验证
    if (!userInput) {
      return NextResponse.json(
        { success: false, error: '请提供提示词或位置信息' },
        { status: 400 }
      )
    }

    if (numberOfImages < 1 || numberOfImages > 4) {
      return NextResponse.json(
        { success: false, error: '图片数量必须在 1-4 之间' },
        { status: 400 }
      )
    }

    console.log('[Imagen API] 参数:', {
      userInput: userInput.substring(0, 100),
      isTravelMode,
      aspectRatio,
      numberOfImages,
      style,
      resolution
    })

    let imageDataList: string[]
    let finalPrompt = userInput

    if (isTravelMode) {
      // 云旅游模式：使用 Gemini 3 Pro Image（带联网功能）
      console.log('[Imagen API] 使用云旅游模式（Gemini 3 Pro Image）')
      imageDataList = await generateTravelImage(userInput, aspectRatio, numberOfImages, resolution)
      finalPrompt = userInput // 云旅游模式直接使用用户输入作为描述
    } else {
      // 创意模式：使用 Imagen 4
      console.log('[Imagen API] 使用创意模式（Imagen 4）')

      // 如果有风格要求，添加到提示词
      if (style && style !== 'original') {
        const styleDescriptions: Record<string, string> = {
          cartoon: 'in a vibrant cartoon style with bright colors and clear lines',
          realistic: 'photorealistic, high quality photography, professional lighting',
          sketch: 'hand-drawn sketch style, artistic line work, black and white or watercolor'
        }
        if (styleDescriptions[style]) {
          finalPrompt = `${userInput}, ${styleDescriptions[style]}`
        }
      }

      imageDataList = await generateCreativeImage(finalPrompt, aspectRatio, numberOfImages, resolution)
    }

    // 保存图片到本地
    const savedUrls: string[] = []
    for (let i = 0; i < imageDataList.length; i++) {
      const filename = isTravelMode ? `travel-${i + 1}` : `creative-${i + 1}`
      const url = await saveImageToLocal(imageDataList[i], filename)
      savedUrls.push(url)
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('[Imagen API] 生成成功')
    console.log('[Imagen API] 模式:', isTravelMode ? '云旅游（Gemini 3 Pro Image）' : '创意（Imagen 4）')
    console.log('[Imagen API] 耗时:', duration + 'ms')
    console.log('[Imagen API] 生成图片数:', savedUrls.length)
    console.log('='.repeat(80))

    return NextResponse.json({
      success: true,
      data: {
        images: savedUrls,
        prompt: finalPrompt,
        mode: isTravelMode ? 'travel' : 'creative',
        model: isTravelMode ? 'gemini-3-pro-image-preview' : 'imagen-4.0-generate-001',
        duration: duration
      }
    })

  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime

    console.error('[Imagen API] 错误:', error)
    console.log('[Imagen API] 失败耗时:', duration + 'ms')
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
