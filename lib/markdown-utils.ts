/**
 * Markdown 处理工具
 * 用于提取图片、转换纯文本等操作
 */

/**
 * 从 Markdown 内容中提取所有图片 URLs
 * 支持格式：![alt](url)
 * @param markdown Markdown 格式的内容
 * @returns 图片 URL 数组
 */
export function extractImagesFromMarkdown(markdown: string): string[] {
  if (!markdown) return []

  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const images: string[] = []
  let match

  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[2].trim()
    if (url) {
      images.push(url)
    }
  }

  return images
}

/**
 * 将 Markdown 内容转换为纯文本
 * 移除所有 Markdown 语法标记
 * @param markdown Markdown 格式的内容
 * @returns 纯文本内容
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return ''

  let text = markdown

  // 移除图片语法 ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')

  // 移除链接语法，保留链接文本 [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')

  // 移除标题标记 # ## ###
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 移除粗体标记 **text** 或 __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')

  // 移除斜体标记 *text* 或 _text_
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')

  // 移除删除线标记 ~~text~~
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // 移除代码块标记 ```code```
  text = text.replace(/```[\s\S]*?```/g, '')

  // 移除行内代码标记 `code`
  text = text.replace(/`([^`]+)`/g, '$1')

  // 移除列表标记 - 或 * 或 1.
  text = text.replace(/^[\s]*[-*+]\s+/gm, '')
  text = text.replace(/^[\s]*\d+\.\s+/gm, '')

  // 移除引用标记 >
  text = text.replace(/^>\s+/gm, '')

  // 移除分隔线 --- 或 ***
  text = text.replace(/^[-*_]{3,}$/gm, '')

  // 移除多余的空行（超过2个连续换行符）
  text = text.replace(/\n{3,}/g, '\n\n')

  // 移除首尾空白
  text = text.trim()

  return text
}

/**
 * 获取第一张图片作为封面
 * @param markdown Markdown 格式的内容
 * @param images 额外的图片数组（从数据库中获取）
 * @returns 封面图片 URL，如果没有则返回默认占位图
 */
export function getFirstImageAsCover(markdown: string, images?: string[]): string {
  // 优先从 Markdown 中提取
  const markdownImages = extractImagesFromMarkdown(markdown)
  if (markdownImages.length > 0) {
    return markdownImages[0]
  }

  // 其次从额外的图片数组中获取
  if (images && images.length > 0) {
    return images[0]
  }

  // 返回默认占位图
  return 'https://via.placeholder.com/800x600.png?text=No+Cover+Image'
}

/**
 * 从 Markdown 中提取所有图片，排除封面图
 * @param markdown Markdown 格式的内容
 * @param coverImage 封面图 URL
 * @returns 除封面外的其他图片 URL 数组
 */
export function extractImagesExcludingCover(
  markdown: string,
  coverImage: string
): string[] {
  const allImages = extractImagesFromMarkdown(markdown)
  return allImages.filter(img => img !== coverImage)
}

/**
 * 验证图片 URL 是否有效
 * @param url 图片 URL
 * @returns 是否为有效的图片 URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    // 检查协议是否为 http 或 https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    // 简单检查是否包含常见图片扩展名（可选）
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const hasImageExt = imageExtensions.some(ext =>
      url.toLowerCase().includes(ext)
    )
    // 注意：某些图片 URL 可能不包含扩展名，所以这里不强制要求
    return true
  } catch {
    return false
  }
}

/**
 * 清洗并准备小红书发布的内容
 * @param markdown Markdown 格式的内容
 * @param maxLength 最大长度限制
 * @returns 清洗后的纯文本
 */
export function prepareXiaohongshuContent(
  markdown: string,
  maxLength: number = 1000
): string {
  const plainText = markdownToPlainText(markdown)

  if (plainText.length <= maxLength) {
    return plainText
  }

  // 超过长度限制时截断，并添加省略号
  return plainText.substring(0, maxLength - 3) + '...'
}
