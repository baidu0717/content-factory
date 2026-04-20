'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XHS_EMOJIS,
  XHS_EMOJI_CATEGORIES,
  UNICODE_EMOJI_CATEGORIES,
  getEmojisByCategory,
  getHotEmojis,
  searchEmojisByName,
  getUnicodeEmojisByCategory,
  getHotUnicodeEmojis,
  searchUnicodeEmojis,
  type XHSEmoji,
  type UnicodeEmoji,
} from '@/lib/xiaohongshu-emojis'

interface XHSEmojiPickerProps {
  onEmojiSelect: (emoji: XHSEmoji | { code: string; name: string }) => void
  onClose: () => void
}

type TopTab = 'xhs' | 'unicode'

export default function XHSEmojiPicker({ onEmojiSelect, onClose }: XHSEmojiPickerProps) {
  const [topTab, setTopTab] = useState<TopTab>('xhs')
  const [activeCategory, setActiveCategory] = useState<string>('hot')
  const [searchKeyword, setSearchKeyword] = useState('')

  // 切换顶层 tab 时重置子分类
  const handleTopTabChange = (tab: TopTab) => {
    setTopTab(tab)
    setActiveCategory('hot')
    setSearchKeyword('')
  }

  // ─── XHS 官方表情 ───────────────────────────────────────────
  const getXHSEmojis = (): XHSEmoji[] => {
    if (searchKeyword) return searchEmojisByName(searchKeyword)
    if (activeCategory === 'hot') return getHotEmojis()
    return getEmojisByCategory(activeCategory)
  }

  // ─── 通用 Unicode 表情 ──────────────────────────────────────
  const getUnicodeEmojis = (): UnicodeEmoji[] => {
    if (searchKeyword) return searchUnicodeEmojis(searchKeyword)
    if (activeCategory === 'hot') return getHotUnicodeEmojis()
    return getUnicodeEmojisByCategory(activeCategory)
  }

  const subCategories = topTab === 'xhs' ? XHS_EMOJI_CATEGORIES : UNICODE_EMOJI_CATEGORIES

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
      className="w-[340px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
    >
      {/* 顶层 Tab + 关闭按钮 */}
      <div className="flex items-center justify-between px-3 pt-2 pb-0 bg-gradient-to-r from-red-50 to-pink-50 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => handleTopTabChange('xhs')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${
              topTab === 'xhs'
                ? 'bg-white text-red-600 border border-b-white border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🥔 小红书官方
          </button>
          <button
            onClick={() => handleTopTabChange('unicode')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all ${
              topTab === 'unicode'
                ? 'bg-white text-red-600 border border-b-white border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            😊 通用表情
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm mb-1"
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

      {/* 子分类标签 */}
      {!searchKeyword && (
        <div className="flex overflow-x-auto px-2 py-1.5 bg-gray-50 border-b border-gray-200 scrollbar-hide gap-0.5">
          <button
            onClick={() => setActiveCategory('hot')}
            className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded-full transition-all ${
              activeCategory === 'hot'
                ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            🔥 热门
          </button>
          {Object.entries(subCategories).map(([key, name]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded-full transition-all ${
                activeCategory === key
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {name as string}
            </button>
          ))}
        </div>
      )}

      {/* 表情列表 */}
      <div className="p-2 max-h-56 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={topTab + activeCategory + searchKeyword}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {topTab === 'xhs' ? (
              // 小红书官方表情
              (() => {
                const emojis = getXHSEmojis()
                return emojis.length > 0 ? (
                  <div className="grid grid-cols-8 gap-1">
                    {emojis.map((emoji, i) => (
                      <motion.button
                        key={`${emoji.code}-${i}`}
                        onClick={() => { onEmojiSelect(emoji); onClose() }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-red-50 transition-all group"
                        title={emoji.name}
                      >
                        {emoji.imageUrl ? (
                          <img
                            src={emoji.imageUrl}
                            alt={emoji.name}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              const sibling = e.currentTarget.nextElementSibling as HTMLElement | null
                              if (sibling) sibling.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <span className={`text-[10px] text-gray-700 leading-tight text-center ${emoji.imageUrl ? 'hidden' : ''}`}>
                          {emoji.name}
                        </span>
                        <span className="text-[8px] text-gray-400 text-center leading-tight mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
                          {emoji.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )
              })()
            ) : (
              // 通用 Unicode 表情
              (() => {
                const emojis = getUnicodeEmojis()
                return emojis.length > 0 ? (
                  <div className="grid grid-cols-8 gap-1">
                    {emojis.map((emoji, i) => (
                      <motion.button
                        key={`${emoji.char}-${i}`}
                        onClick={() => {
                          onEmojiSelect({ code: emoji.char, name: emoji.name })
                          onClose()
                        }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex flex-col items-center justify-center p-1.5 rounded-lg hover:bg-red-50 transition-all group"
                        title={emoji.name}
                      >
                        <span className="text-xl leading-none">{emoji.char}</span>
                        <span className="text-[8px] text-gray-400 text-center leading-tight mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-1">
                          {emoji.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )
              })()
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-6 text-gray-400">
      <div className="text-2xl mb-1">🔍</div>
      <p className="text-xs">没有找到相关表情</p>
    </div>
  )
}
