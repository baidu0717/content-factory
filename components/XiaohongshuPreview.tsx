'use client'

import React, { useState } from 'react'
import { ChevronLeft, Heart, Star, MessageCircle, Share2, MoreHorizontal, Edit3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface XiaohongshuPreviewProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
  tags: string
  images: string[]
}

export default function XiaohongshuPreview({
  isOpen,
  onClose,
  title,
  content,
  tags,
  images
}: XiaohongshuPreviewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [liked, setLiked] = useState(false)
  const [collected, setCollected] = useState(false)

  if (!isOpen) return null

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const tagsArray = tags.split(/\s+/).filter(tag => tag.trim())

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-white flex items-center justify-center"
      >
        {/* 手机宽度容器 */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[428px] h-full bg-white flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶部标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
            <button onClick={onClose} className="p-1">
              <ChevronLeft className="w-6 h-6 text-gray-900" />
            </button>
            <div className="flex items-center gap-2 flex-1 ml-2">
              <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-red-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                A
              </div>
              <span className="text-sm font-semibold text-gray-900 truncate">{title}</span>
            </div>
            <button className="p-1">
              <MoreHorizontal className="w-6 h-6 text-gray-900" />
            </button>
          </div>

          {/* 可滚动内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {/* 图片区域 */}
            <div className="relative w-full bg-black" style={{ aspectRatio: '1/1' }}>
              {images.length > 0 && (
                <>
                  <img
                    src={images[currentImageIndex]}
                    alt={`预览 ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* 图片计数器 */}
                  {images.length > 1 && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                      {currentImageIndex + 1}/{images.length}
                    </div>
                  )}

                  {/* 左右切换区域 */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-0 top-0 bottom-0 w-1/3"
                        style={{ background: 'transparent' }}
                      />
                      <button
                        onClick={handleNextImage}
                        className="absolute right-0 top-0 bottom-0 w-1/3"
                        style={{ background: 'transparent' }}
                      />
                    </>
                  )}

                  {/* 图片指示器 */}
                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, index) => (
                        <div
                          key={index}
                          className={`h-1 rounded-full transition-all ${
                            index === currentImageIndex
                              ? 'w-4 bg-white'
                              : 'w-1 bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 标题和内容 */}
            <div className="bg-white px-4 py-4">
              <h2 className="text-base font-bold text-gray-900 leading-snug mb-3">
                {title}
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">
                {content}
              </p>

              {/* 话题标签 */}
              {tagsArray.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tagsArray.map((tag, index) => (
                    <span
                      key={index}
                      className="text-sm text-blue-500 font-medium cursor-pointer"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}

              {/* 发布时间和位置 */}
              <div className="text-xs text-gray-400 mb-4">
                刚刚
              </div>
            </div>
          </div>

          {/* 底部固定操作栏 */}
          <div className="bg-white border-t border-gray-100 px-4 py-2 flex items-center gap-3">
            {/* 评论输入框 */}
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
              <Edit3 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">说点什么...</span>
            </div>

            {/* 右侧操作按钮 */}
            <button
              onClick={() => setLiked(!liked)}
              className="flex items-center gap-1"
            >
              <Heart
                className={`w-6 h-6 transition-colors ${
                  liked ? 'fill-red-500 text-red-500' : 'text-gray-600'
                }`}
              />
            </button>
            <button
              onClick={() => setCollected(!collected)}
              className="flex items-center gap-1"
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  collected ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'
                }`}
              />
            </button>
            <button className="flex items-center gap-1">
              <MessageCircle className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
