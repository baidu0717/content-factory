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
const GEMINI_PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const IMAGEN_MODEL = 'imagen-4.0-generate-001'

// 初始化客户端
const genAI = new GoogleGenAI({
  apiKey: GEMINI_TEXT_API_KEY
})

const imageAI = new GoogleGenAI({
  apiKey: GEMINI_IMAGE_API_KEY
})

// 请求参数类型
interface ImageEditRequest {
  mode: 'image-to-image'  // 暂时只支持图生图模式
  prompt: string           // 修改指令
  uploadedImage: string    // base64 格式的图片
  aspectRatio: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  resolution?: '2k' | '4k'  // 分辨率选项
  useImagen?: boolean      // 是否使用 Imagen 4.0
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
 * 图生图：使用 Gemini 3 Pro Image 编辑图片
 */
async function generateImageToImage(
  uploadedImageBase64: string,
  prompt: string,
  aspectRatio: string,
  resolution: '2k' | '4k' = '2k'
): Promise<string[]> {
  console.log('[图生图] 使用 Gemini 3 Pro Image 编辑图片...')
  console.log('[图生图] 修改指令:', prompt)
  console.log('[图生图] 目标宽高比:', aspectRatio)
  console.log('[图生图] 分辨率:', resolution)

  // 获取具体的分辨率尺寸
  const { width, height, description } = getResolutionDimensions(aspectRatio, resolution)
  console.log('[图生图] 目标尺寸:', description)

  // 处理 base64 数据
  const base64Data = uploadedImageBase64.replace(/^data:image\/\w+;base64,/, '')

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

  // 构建系统提示词
  const systemPrompt = `You are a professional image editor with internet access. The user will provide an image and editing instructions.

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
- Use real-time information from internet search when relevant to the editing instruction

User's editing instruction: ${prompt}`

  try {
    // 设置重试机制
    let retries = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[图生图] 第 ${attempt + 1} 次尝试...`)
        }

        // 将分辨率转换为 API 格式（必须大写 K）
        const apiImageSize = resolution === '2k' ? '2K' : '4K'
        console.log('[图生图] API 分辨率参数:', apiImageSize)

        const response = await genAI.models.generateContent({
          model: GEMINI_PRO_IMAGE_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: 'image/jpeg'
                  }
                },
                { text: systemPrompt }
              ]
            }
          ],
          config: {
            temperature: 0.7,
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: apiImageSize,  // 添加分辨率参数
            }
          }
        })

        console.log('[图生图] Gemini 3 Pro Image API 调用成功')

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

        console.log(`[图生图] 成功生成 ${imageDataList.length} 张图片`)
        return imageDataList

      } catch (error) {
        lastError = error as Error
        console.error(`[图生图] 第 ${attempt + 1} 次尝试失败:`, error)

        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          const waitTime = (attempt + 1) * 2000 // 递增等待时间：2s, 4s
          console.log(`[图生图] 等待 ${waitTime}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }
    }

    // 所有重试都失败
    throw new Error(`图生图模式生成失败（已重试${retries}次）: ${lastError?.message || '未知错误'}`)

  } catch (error) {
    console.error('[图生图] Gemini 3 Pro Image 生成失败:', error)
    throw new Error(`图生图模式生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 图生图：使用 Imagen 4.0 编辑图片
 */
async function generateImageToImageWithImagen(
  uploadedImageBase64: string,
  prompt: string,
  aspectRatio: string,
  resolution: '2k' | '4k' = '2k'
): Promise<string[]> {
  console.log('[图生图 Imagen] 使用 Imagen 4.0 编辑图片...')
  console.log('[图生图 Imagen] 修改指令:', prompt)
  console.log('[图生图 Imagen] 目标宽高比:', aspectRatio)
  console.log('[图生图 Imagen] 分辨率:', resolution)

  // 获取具体的分辨率尺寸
  const { width, height, description } = getResolutionDimensions(aspectRatio, resolution)
  console.log('[图生图 Imagen] 目标尺寸:', description)

  // 处理 base64 数据
  const base64Data = uploadedImageBase64.replace(/^data:image\/\w+;base64,/, '')

  try {
    // 将分辨率转换为 API 格式（必须大写 K）
    const apiImageSize = resolution === '2k' ? '2K' : '4K'
    console.log('[图生图 Imagen] API 分辨率参数:', apiImageSize)

    const response = await imageAI.models.editImage({
      model: IMAGEN_MODEL,
      prompt: prompt,
      referenceImage: {
        imageBytes: base64Data
      },
      config: {
        editMode: 'MASK_FREE' as any,  // 无遮罩编辑
        numberOfImages: 1,
        aspectRatio: aspectRatio,
        imageSize: apiImageSize
      }
    }) as any

    console.log('[图生图 Imagen] Imagen 4.0 API 调用成功')

    // 提取图片数据
    const imageDataList: string[] = []

    if (response.candidates && response.candidates.length > 0) {
      for (const candidate of response.candidates) {
        if (candidate.image && candidate.image.imageBytes) {
          const base64Data = candidate.image.imageBytes
          const dataUrl = `data:image/png;base64,${base64Data}`
          imageDataList.push(dataUrl)
        }
      }
    }

    if (imageDataList.length === 0) {
      throw new Error('Imagen 4.0 未返回任何图片')
    }

    console.log(`[图生图 Imagen] 成功生成 ${imageDataList.length} 张图片`)
    return imageDataList

  } catch (error) {
    console.error('[图生图 Imagen] Imagen 4.0 生成失败:', error)
    throw new Error(`Imagen 4.0 图生图失败: ${error instanceof Error ? error.message : '未知错误'}`)
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
 * POST /api/imagen/edit
 * 图生图功能
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('='.repeat(80))
    console.log('[Imagen Edit API] 收到图生图请求')

    // 验证 API Key
    if (!GEMINI_TEXT_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置 API Key，请检查环境变量'
        },
        { status: 500 }
      )
    }

    // 解析请求参数
    const body: ImageEditRequest = await request.json()
    const {
      mode,
      prompt,
      uploadedImage,
      aspectRatio = '16:9',
      resolution = '2k',
      useImagen = false
    } = body

    // 参数验证
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: '请提供修改指令' },
        { status: 400 }
      )
    }

    if (!uploadedImage) {
      return NextResponse.json(
        { success: false, error: '请上传图片' },
        { status: 400 }
      )
    }

    if (mode !== 'image-to-image') {
      return NextResponse.json(
        { success: false, error: '暂时只支持 image-to-image 模式' },
        { status: 400 }
      )
    }

    console.log('[Imagen Edit API] 参数:', {
      mode,
      prompt: prompt.substring(0, 100),
      aspectRatio,
      resolution,
      imageSize: (uploadedImage.length / 1024 / 1024 * 0.75).toFixed(2) + 'MB'
    })

    // 调用图生图（根据模型选择）
    const imageDataList = useImagen
      ? await generateImageToImageWithImagen(uploadedImage, prompt, aspectRatio, resolution)
      : await generateImageToImage(uploadedImage, prompt, aspectRatio, resolution)

    // 保存图片到本地
    const savedUrls: string[] = []
    for (let i = 0; i < imageDataList.length; i++) {
      const filename = `image-to-image-${i + 1}`
      const url = await saveImageToLocal(imageDataList[i], filename)
      savedUrls.push(url)
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('[Imagen Edit API] 生成成功')
    console.log('[Imagen Edit API] 模式:', mode)
    console.log('[Imagen Edit API] 耗时:', duration + 'ms')
    console.log('[Imagen Edit API] 生成图片数:', savedUrls.length)
    console.log('='.repeat(80))

    return NextResponse.json({
      success: true,
      data: {
        images: savedUrls,
        prompt: prompt,
        mode: mode,
        model: useImagen ? IMAGEN_MODEL : GEMINI_PRO_IMAGE_MODEL,
        duration: duration
      }
    })

  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime

    console.error('[Imagen Edit API] 错误:', error)
    console.log('[Imagen Edit API] 失败耗时:', duration + 'ms')
    console.log('='.repeat(80))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图片编辑失败'
      },
      { status: 500 }
    )
  }
}
