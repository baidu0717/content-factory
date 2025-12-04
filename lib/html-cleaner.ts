/**
 * HTML 内容清洗工具
 * 用于将公众号文章的 HTML 内容转换为纯文本
 */

/**
 * 清洗 HTML 内容，提取纯文本
 * @param html HTML 字符串
 * @returns 清洗后的纯文本
 */
export function cleanHtmlContent(html: string): string {
  if (!html) return ''

  try {
    // 移除 script 和 style 标签及其内容
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // 移除所有 HTML 标签
    text = text.replace(/<[^>]+>/g, ' ')

    // 解码 HTML 实体
    text = decodeHtmlEntities(text)

    // 移除多余的空白字符
    text = text.replace(/\s+/g, ' ')
    text = text.trim()

    // 限制长度（防止内容过长）
    const maxLength = 8000 // 限制为 8000 字符
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...'
    }

    return text
  } catch (error) {
    console.error('清洗 HTML 内容失败:', error)
    return ''
  }
}

/**
 * 解码 HTML 实体
 * @param text 包含 HTML 实体的文本
 * @returns 解码后的文本
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': '\u2018',  // 左单引号
    '&rsquo;': '\u2019',  // 右单引号
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
  }

  let result = text
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char)
  }

  // 处理数字实体 (&#数字;)
  result = result.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10))
  })

  // 处理十六进制实体 (&#x十六进制;)
  result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16))
  })

  return result
}

/**
 * 提取文章摘要
 * @param content 文章内容
 * @param maxLength 最大长度
 * @returns 摘要文本
 */
export function extractSummary(content: string, maxLength: number = 300): string {
  if (!content) return ''

  const summary = content.substring(0, maxLength)
  return summary.length < content.length ? summary + '...' : summary
}

/**
 * 清洗文章标题（移除特殊字符和表情符号）
 * @param title 原始标题
 * @returns 清洗后的标题
 */
export function cleanTitle(title: string): string {
  if (!title) return ''

  // 移除表情符号（保留中文、英文、数字、常用标点）
  return title
    .replace(/[\uD800-\uDFFF]/g, '') // 移除 emoji
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\.,!?;:'"()[\]{}\-—]/g, '')
    .trim()
}
