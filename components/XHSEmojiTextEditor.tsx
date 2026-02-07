'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import XHSEmojiPicker from './XHSEmojiPicker'
import { type XHSEmoji, hasXHSEmoji, extractEmojis } from '@/lib/xiaohongshu-emojis'

interface XHSEmojiTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  rows?: number
  maxLength?: number
  showEmojiButton?: boolean
  showStats?: boolean
}

export default function XHSEmojiTextEditor({
  value,
  onChange,
  placeholder = '输入内容...',
  label,
  rows = 10,
  maxLength = 1000,
  showEmojiButton = true,
  showStats = true
}: XHSEmojiTextEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiButtonRef = useRef<HTMLDivElement>(null)

  // 插入表情代码
  const handleEmojiSelect = (emoji: XHSEmoji) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + emoji.code + value.substring(end)

    onChange(newValue)

    // 设置光标位置到表情代码后面
    setTimeout(() => {
      if (textarea) {
        const newPosition = start + emoji.code.length
        textarea.focus()
        textarea.setSelectionRange(newPosition, newPosition)
      }
    }, 0)
  }

  // 点击外部关闭表情选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false)
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  // 统计信息
  const stats = {
    totalChars: value.length,
    emojis: extractEmojis(value),
    hasEmoji: hasXHSEmoji(value)
  }

  return (
    <div className="space-y-2">
      {/* 标签和统计信息 */}
      {(label || showStats) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-gray-700">{label}</label>
          )}
          {showStats && (
            <div className="flex items-center gap-3 text-xs">
              {stats.hasEmoji && (
                <span className="text-red-500 font-medium">
                  🥔 {stats.emojis.length} 个表情
                </span>
              )}
              <span className={`${value.length > maxLength ? 'text-red-500' : 'text-gray-500'}`}>
                {value.length} / {maxLength}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 border-2 border-gray-200 border-b-0 rounded-t-xl">
        {showEmojiButton && (
          <div ref={emojiButtonRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
              title="添加表情"
            >
              <span className="text-lg">😊</span>
            </button>

            {/* 表情选择器 */}
            <AnimatePresence>
              {showEmojiPicker && (
                <XHSEmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 文本编辑区 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className="w-full px-4 py-3 border-2 border-gray-200 border-t-0 rounded-b-xl focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all resize-none font-['PingFang_SC'] text-gray-800 leading-relaxed"
        />
      </div>

      {/* 使用提示和预览 */}
      <div className="space-y-2">
        {/* 快捷提示 */}
        {showEmojiButton && !stats.hasEmoji && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>💡</span>
            <span>提示：使用小红书官方表情可以让你的笔记更生动，提升互动率</span>
          </div>
        )}

        {/* 表情预览 */}
        {stats.hasEmoji && (
          <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-100">
            <div className="flex items-start gap-2">
              <span className="text-sm">🎨</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  已添加的表情（共 {stats.emojis.length} 个）：
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.emojis.map((code, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-white text-xs text-red-600 font-mono rounded border border-red-200"
                    >
                      {code}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  ✓ 这些表情在小红书 app 中会自动显示为可爱的图片
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
