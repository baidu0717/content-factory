'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XHS_EMOJIS,
  XHS_EMOJI_CATEGORIES,
  getEmojisByCategory,
  getHotEmojis,
  searchEmojisByName,
  type XHSEmoji
} from '@/lib/xiaohongshu-emojis'

interface XHSEmojiPickerProps {
  onEmojiSelect: (emoji: XHSEmoji) => void
  onClose: () => void
}

export default function XHSEmojiPicker({ onEmojiSelect, onClose }: XHSEmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('hot')
  const [searchKeyword, setSearchKeyword] = useState('')

  // 获取当前显示的表情列表
  const getCurrentEmojis = () => {
    if (searchKeyword) {
      return searchEmojisByName(searchKeyword)
    }
    if (activeCategory === 'hot') {
      return getHotEmojis()
    }
    return getEmojisByCategory(activeCategory)
  }

  const displayEmojis = getCurrentEmojis()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
      className="w-[320px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-red-50 to-pink-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-800">小红薯表情</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="搜索表情..."
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-pink-400 focus:ring-1 focus:ring-pink-100 transition-all"
        />
      </div>

      {/* 分类标签 */}
      {!searchKeyword && (
        <div className="flex overflow-x-auto px-2 py-1.5 bg-gray-50 border-b border-gray-200 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('hot')}
            className={`
              flex-shrink-0 px-2 py-1 mx-0.5 text-[10px] font-medium rounded-full transition-all
              ${activeCategory === 'hot'
                ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            🔥 热门
          </button>
          {Object.entries(XHS_EMOJI_CATEGORIES).map(([key, name]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`
                flex-shrink-0 px-2 py-1 mx-0.5 text-[10px] font-medium rounded-full transition-all
                ${activeCategory === key
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* 表情列表 */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {displayEmojis.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory + searchKeyword}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-8 gap-1"
            >
              {displayEmojis.map((emoji, index) => (
                <motion.button
                  key={`${emoji.code}-${index}`}
                  onClick={() => {
                    onEmojiSelect(emoji)
                    onClose()
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-gray-100 transition-all group"
                  title={emoji.name}
                >
                  {/* 表情代码显示 */}
                  <div className="text-base group-hover:scale-110 transition-transform">
                    {emoji.imageUrl ? (
                      <img
                        src={emoji.imageUrl}
                        alt={emoji.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          // 如果图片加载失败，显示文字
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling!.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <span className={emoji.imageUrl ? 'hidden' : 'text-xs'}>
                      {emoji.name}
                    </span>
                  </div>

                  {/* 表情名称 - 只在hover时显示 */}
                  <span className="text-[9px] text-gray-600 text-center leading-tight mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {emoji.name}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <div className="text-2xl mb-1">🔍</div>
            <p className="text-xs">没有找到相关表情</p>
          </div>
        )}
      </div>

    </motion.div>
  )
}
