/**
 * 文章生成 API 端点
 * POST /api/generate-article
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateArticle } from '@/lib/openai-insights'
import { generateArticleImages } from '@/lib/siliconflow-image'
import { ArticleGenerationRequest, GeneratedArticle, Topic } from '@/types/insights'

/**
 * 计算字数（中文和英文都支持）
 */
function countWords(text: string): number {
  // 移除Markdown标记
  const plainText = text
    .replace(/#{1,6}\s/g, '') // 移除标题标记
    .replace(/\*\*|\*|_/g, '') // 移除加粗和斜体标记
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 移除链接，保留文本
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // 移除代码块
    .replace(/^\s*[-*+]\s/gm, '') // 移除列表标记
    .replace(/^\s*\d+\.\s/gm, '') // 移除有序列表标记

  // 计算中文字符数
  const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g) || []
  // 计算英文单词数
  const englishWords = plainText.match(/[a-zA-Z]+/g) || []

  return chineseChars.length + englishWords.length
}

/**
 * 计算预计阅读时间（分钟）
 * 假设中文阅读速度：400字/分钟
 */
function calculateReadingTime(wordCount: number): number {
  const wordsPerMinute = 400
  return Math.ceil(wordCount / wordsPerMinute)
}

/**
 * 将图片URL以Markdown格式嵌入到文章内容中
 * @param content 原始文章内容
 * @param images 图片URL数组
 * @returns 嵌入图片后的文章内容
 */
function embedImagesToContent(content: string, images: string[]): string {
  if (images.length === 0) return content

  // 按段落分割内容（双换行符分隔）
  const paragraphs = content.split('\n\n')
  const totalParagraphs = paragraphs.length

  // 计算图片插入位置（平均分配在段落之间）
  const imagePositions = new Map<number, number>() // 段落索引 -> 图片索引

  if (totalParagraphs > 0) {
    const interval = Math.floor(totalParagraphs / (images.length + 1))
    for (let i = 0; i < images.length; i++) {
      // 在段落之后插入图片
      const position = interval * (i + 1)
      if (position < totalParagraphs) {
        imagePositions.set(position, i)
      } else {
        // 如果超出范围，放在最后
        imagePositions.set(totalParagraphs - 1, i)
      }
    }
  }

  // 重组内容，插入图片
  const newParagraphs: string[] = []
  let usedImages = new Set<number>()

  paragraphs.forEach((paragraph, index) => {
    newParagraphs.push(paragraph)

    // 检查是否需要在此处插入图片
    if (imagePositions.has(index)) {
      const imageIndex = imagePositions.get(index)!
      if (!usedImages.has(imageIndex)) {
        const imageUrl = images[imageIndex]
        // 插入Markdown格式的图片
        newParagraphs.push(`![配图 ${imageIndex + 1}](${imageUrl})`)
        usedImages.add(imageIndex)
      }
    }
  })

  // 如果还有未插入的图片，追加到文章末尾
  for (let i = 0; i < images.length; i++) {
    if (!usedImages.has(i)) {
      newParagraphs.push(`![配图 ${i + 1}](${images[i]})`)
    }
  }

  return newParagraphs.join('\n\n')
}

export async function POST(request: NextRequest) {
  try {
    const body: ArticleGenerationRequest = await request.json()
    const { topic, params } = body

    console.log('[API] 收到文章生成请求')
    console.log('[API] 选题:', topic.title)
    console.log('[API] 参数:', params)

    // 参数验证
    if (!topic || !topic.title) {
      return NextResponse.json(
        { success: false, error: '缺少选题信息' },
        { status: 400 }
      )
    }

    if (!params || !params.length || !params.style) {
      return NextResponse.json(
        { success: false, error: '缺少创作参数' },
        { status: 400 }
      )
    }

    // 调用 AI 生成文章
    console.log('[API] 调用 AI 生成文章...')
    const { title, content } = await generateArticle(topic, params)

    // 使用硅基流动生成配图
    console.log('[API] 开始生成文章配图...')
    const images = params.imageCount > 0
      ? await generateArticleImages(title, content, params.imageCount)
      : []

    // 将图片嵌入到文章内容中
    let finalContent = content
    if (images.length > 0) {
      finalContent = embedImagesToContent(content, images)
      console.log('[API] 已将 ' + images.length + ' 张图片嵌入到文章内容中')
    }

    // 计算字数和阅读时间
    const wordCount = countWords(finalContent)
    const readingTime = calculateReadingTime(wordCount)

    const result: GeneratedArticle = {
      title,
      content: finalContent,
      wordCount,
      readingTime,
      images
    }

    console.log('[API] 文章生成成功')
    console.log(`[API] 标题: ${title}`)
    console.log(`[API] 字数: ${wordCount}`)
    console.log(`[API] 配图数量: ${images.length}`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('[API] 文章生成失败:', error)

    const errorMessage = error instanceof Error ? error.message : '未知错误'

    return NextResponse.json(
      {
        success: false,
        error: `文章生成失败: ${errorMessage}`
      },
      { status: 500 }
    )
  }
}
