import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { setGlobalDispatcher, ProxyAgent } from 'undici'

// 配置代理
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7897'
const proxyAgent = new ProxyAgent(HTTPS_PROXY)
setGlobalDispatcher(proxyAgent)

// API 配置
const GEMINI_TEXT_API_KEY = process.env.GEMINI_TEXT_API_KEY || ''
const GEMINI_IMAGE_API_KEY = process.env.GEMINI_IMAGE_API_KEY || ''

/**
 * GET /api/imagen/test-models
 * 测试 Gemini 和 Imagen 模型是否可以成功调用
 */
export async function GET() {
  console.log('='.repeat(80))
  console.log('[模型测试] 开始测试模型可用性...')

  const results = {
    gemini: { success: false, error: '' },
    imagen: { success: false, error: '' }
  }

  // 测试1: Gemini 3 Pro Preview
  console.log('\n[测试1] 测试 gemini-3-pro-preview 模型...')
  try {
    const genAI = new GoogleGenAI({
      apiKey: GEMINI_TEXT_API_KEY
    })

    const response = await genAI.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Hello, this is a test. Please respond with "OK".' }]
        }
      ],
      config: {
        maxOutputTokens: 10
      }
    })

    const text = response.text || ''
    console.log('[测试1] ✅ Gemini 3 Pro Preview 调用成功')
    console.log('[测试1] 响应:', text.substring(0, 100))
    results.gemini.success = true

  } catch (error) {
    console.error('[测试1] ❌ Gemini 3 Pro Preview 调用失败:', error)
    results.gemini.error = error instanceof Error ? error.message : '未知错误'
  }

  // 测试2: Imagen 4
  console.log('\n[测试2] 测试 imagen-4.0-generate-001 模型...')
  try {
    const imageAI = new GoogleGenAI({
      apiKey: GEMINI_IMAGE_API_KEY
    })

    const response = await imageAI.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: 'A simple red circle on white background',
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1'
      }
    })

    if (response.generatedImages && response.generatedImages.length > 0) {
      console.log('[测试2] ✅ Imagen 4 调用成功')
      console.log('[测试2] 成功生成图片数量:', response.generatedImages.length)
      results.imagen.success = true
    } else {
      throw new Error('Imagen 4 未返回任何图片')
    }

  } catch (error) {
    console.error('[测试2] ❌ Imagen 4 调用失败:', error)
    results.imagen.error = error instanceof Error ? error.message : '未知错误'
  }

  console.log('\n' + '='.repeat(80))
  console.log('[模型测试] 测试结果汇总:')
  console.log('  - Gemini 3 Pro Preview:', results.gemini.success ? '✅ 可用' : '❌ 不可用')
  console.log('  - Imagen 4:', results.imagen.success ? '✅ 可用' : '❌ 不可用')
  console.log('='.repeat(80))

  return NextResponse.json({
    success: results.gemini.success && results.imagen.success,
    models: {
      'gemini-3-pro-preview': results.gemini,
      'imagen-4.0-generate-001': results.imagen
    },
    summary: {
      allPassed: results.gemini.success && results.imagen.success,
      geminiAvailable: results.gemini.success,
      imagenAvailable: results.imagen.success
    }
  })
}
