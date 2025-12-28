'use client'

import React from 'react'
import { X, Type, BookOpen, Calendar, Tag, Copy, Check } from 'lucide-react'
import { renderMarkdownContent } from '@/lib/markdown-renderer'

interface Article {
  id: number
  title: string
  content: string
  status: string
  platforms: string[]
  source: string
  createdAt: string
  publishedAt: string | null
  stats: { views: number; likes: number; comments: number } | null
  tags: string[]
  wordCount?: number
  readingTime?: number
  images?: string[]
}

interface ArticlePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  article: Article
}

export default function ArticlePreviewModal({ isOpen, onClose, article }: ArticlePreviewModalProps) {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(article.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-gray-900">文章预览</h2>
            <div className="flex items-center space-x-3 text-sm text-gray-500">
              {article.wordCount && (
                <>
                  <div className="flex items-center">
                    <Type className="w-4 h-4 mr-1" />
                    <span>{article.wordCount}字</span>
                  </div>
                  <span className="text-gray-300">•</span>
                </>
              )}
              {article.readingTime && (
                <>
                  <div className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-1" />
                    <span>约{article.readingTime}分钟</span>
                  </div>
                  <span className="text-gray-300">•</span>
                </>
              )}
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>{article.createdAt}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1.5 text-green-500" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  复制
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* 标题 */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {article.title}
          </h1>

          {/* 标签 */}
          {Array.isArray(article.tags) && article.tags.length > 0 && (
            <div className="flex items-center mb-6 space-x-2">
              <Tag className="w-4 h-4 text-gray-400" />
              {article.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 正文 */}
          <div className="prose prose-lg max-w-none">
            {renderMarkdownContent(article.content)}
          </div>
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {article.publishedAt ? (
              <span>发布于 {article.publishedAt}</span>
            ) : (
              <span>创建于 {article.createdAt}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
