/**
 * Markdown 渲染工具
 * 用于在预览组件中渲染带图片的 Markdown 内容
 */

import React from 'react'

/**
 * 渲染 Markdown 内容为 React 元素
 * 支持：标题、列表、段落、图片
 */
export function renderMarkdownContent(content: string): React.JSX.Element[] {
  if (!content.trim()) {
    return [<p key="empty" className="text-gray-400 italic">（无内容）</p>]
  }

  const paragraphs = content.split('\n\n')
  const elements: React.JSX.Element[] = []

  paragraphs.forEach((paragraph, index) => {
    const trimmed = paragraph.trim()
    if (!trimmed) return

    // 检查是否是 Markdown 图片 ![alt](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imageMatch) {
      const [, alt, url] = imageMatch
      elements.push(
        <div key={`img-${index}`} className="my-6">
          <img
            src={url}
            alt={alt || '配图'}
            className="w-full rounded-lg shadow-md"
            onError={(e) => {
              console.error('图片加载失败:', url)
              e.currentTarget.style.display = 'none'
            }}
          />
          {alt && (
            <p className="text-center text-sm text-gray-500 mt-2">{alt}</p>
          )}
        </div>
      )
      return
    }

    // 检查是否是标题
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)?.[0].length || 2
      const text = trimmed.replace(/^#+\s/, '')
      const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements
      elements.push(
        <HeadingTag key={`heading-${index}`} className="text-xl font-bold text-gray-900 mt-6 mb-3">
          {text}
        </HeadingTag>
      )
      return
    }

    // 检查是否是列表项
    if (trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
      const items = trimmed.split('\n').map(item => item.replace(/^[-\d+.]\s+/, ''))
      const isOrdered = trimmed.match(/^\d+\./)
      const ListTag = isOrdered ? 'ol' : 'ul'
      elements.push(
        <ListTag key={`list-${index}`} className={`space-y-2 my-4 text-gray-700 ${isOrdered ? 'list-decimal list-inside' : 'list-disc list-inside'}`}>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ListTag>
      )
      return
    }

    // 普通段落（可能包含行内图片）
    const parts = parseInlineMarkdown(trimmed)
    elements.push(
      <p key={`p-${index}`} className="text-gray-700 leading-relaxed mb-4">
        {parts}
      </p>
    )
  })

  return elements
}

/**
 * 解析段落中的行内 Markdown（粗体、斜体等）
 */
function parseInlineMarkdown(text: string): React.ReactNode {
  // 简单处理：粗体 **text**
  const boldRegex = /\*\*([^*]+)\*\*/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = boldRegex.exec(text)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    // 添加粗体文本
    parts.push(<strong key={match.index}>{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? parts : text
}
