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
      <div className="flex items-center justify-end gap-2 p-2 bg-gray-50 border-2 border-gray-200 border-b-0 rounded-t-xl">
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

    </div>
  )
}
