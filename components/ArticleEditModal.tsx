'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, Loader2, Tag, Image as ImageIcon, Plus, Edit3, Eye } from 'lucide-react'
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

interface ArticleEditModalProps {
  isOpen: boolean
  onClose: () => void
  article: Article
  onSave: () => void
}

export default function ArticleEditModal({ isOpen, onClose, article, onSave }: ArticleEditModalProps) {
  const [title, setTitle] = useState(article.title)
  const [content, setContent] = useState(article.content)
  const [tags, setTags] = useState<string[]>(article.tags || [])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    setTitle(article.title)
    setContent(article.content)
    setTags(article.tags || [])
  }, [article])

  if (!isOpen) return null

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const calculateWordCount = (text: string) => {
    // 简单计算：中文字符 + 英文单词
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0
    const englishWords = text.match(/[a-zA-Z]+/g)?.length || 0
    return chineseChars + englishWords
  }

  const calculateReadingTime = (wordCount: number) => {
    // 假设阅读速度：中文500字/分钟
    return Math.ceil(wordCount / 500)
  }

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('标题和内容不能为空')
      return
    }

    setSaving(true)

    try {
      const wordCount = calculateWordCount(content)
      const readingTime = calculateReadingTime(wordCount)

      const response = await fetch('/api/articles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: article.id,
          title: title.trim(),
          content: content.trim(),
          status: article.status,
          platforms: article.platforms,
          tags,
          wordCount,
          readingTime,
          images: article.images || []
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('保存成功!')
        onSave()
        onClose()
      } else {
        alert('保存失败: ' + data.error)
      }
    } catch (error) {
      console.error('[保存文章] 错误:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">编辑文章</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存
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

          {/* 标签页切换 */}
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                viewMode === 'edit'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              编辑
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                viewMode === 'preview'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-4 h-4 mr-2" />
              预览
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {viewMode === 'edit' ? (
            /* 编辑模式 */
            <>
              {/* 标题输入 */}
              <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入文章标题..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
            />
          </div>

          {/* 标签管理 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Tag className="w-4 h-4 mr-1" />
              标签
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="添加标签..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加
              </button>
            </div>
          </div>

          {/* 正文输入 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              正文内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请输入文章内容..."
              rows={20}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm leading-relaxed"
            />
            <div className="mt-2 text-sm text-gray-500 flex items-center justify-between">
              <span>支持 Markdown 格式（图片已嵌入在正文中）</span>
              <span>{calculateWordCount(content)} 字 · 约 {calculateReadingTime(calculateWordCount(content))} 分钟阅读</span>
            </div>
          </div>
            </>
          ) : (
            /* 预览模式 */
            <>
              {/* 标题 */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {title || '（无标题）'}
              </h1>

              {/* 标签 */}
              {tags && tags.length > 0 && (
                <div className="flex items-center mb-6 space-x-2">
                  <Tag className="w-4 h-4 text-gray-400" />
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 正文渲染 */}
              <div className="prose prose-lg max-w-none">
                {renderMarkdownContent(content)}
              </div>
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            文章ID: {article.id} · 创建于 {article.createdAt}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存更改
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
