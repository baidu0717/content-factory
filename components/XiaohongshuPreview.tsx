'use client'

import React, { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Heart, Star, MessageCircle, Share2, MoreHorizontal } from 'lucide-react'
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
        className="fixed inset-0 z-50 bg-black"
        onClick={onClose}
      >
        {/* 主容器 */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full h-full bg-black overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* iOS 顶部状态栏区域 */}
          <div className="absolute top-0 left-0 right-0 h-11 bg-gradient-to-b from-black/50 to-transparent z-20 pointer-events-none" />

          {/* 顶部操作栏 */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-2">
            <button
              onClick={onClose}
              className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* 主内容区域 */}
          <div className="h-full flex flex-col overflow-hidden">
          {/* 图片区域 */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            {images.length > 0 && (
              <>
                <img
                  src={images[currentImageIndex]}
                  alt={`预览 ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                />

                {/* 图片计数器 */}
                {images.length > 1 && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                    {currentImageIndex + 1}/{images.length}
                  </div>
                )}

                {/* 左右切换手势区域 */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-4"
                      style={{ background: 'transparent' }}
                    >
                      <div className="w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity">
                        <ChevronLeft className="w-5 h-5" />
                      </div>
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-4"
                      style={{ background: 'transparent' }}
                    >
                      <div className="w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </button>
                  </>
                )}

                {/* 图片指示器 */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
                    {images.map((_, index) => (
                      <div
                        key={index}
                        className={`h-1 rounded-full transition-all ${
                          index === currentImageIndex
                            ? 'w-6 bg-white'
                            : 'w-1 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 内容卡片 */}
          <div className="bg-white rounded-t-3xl overflow-y-auto flex-shrink-0 max-h-[50vh]">
            {/* 用户信息栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-red-400 rounded-full flex items-center justify-center text-white font-bold">
                  A
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">AI 创作者</div>
                  <div className="text-xs text-gray-500">刚刚</div>
                </div>
              </div>
              <button className="px-4 py-1.5 bg-red-500 text-white text-sm font-medium rounded-full hover:bg-red-600 transition-colors">
                关注
              </button>
            </div>

            {/* 标题 */}
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-base font-bold text-gray-900 leading-snug">
                {title}
              </h2>
            </div>

            {/* 正文 */}
            <div className="px-4 pb-3">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {content}
              </p>
            </div>

            {/* 话题标签 */}
            {tagsArray.length > 0 && (
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                {tagsArray.map((tag, index) => (
                  <span
                    key={index}
                    className="text-sm text-blue-500 font-medium cursor-pointer hover:text-blue-600"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}

            {/* 互动数据 */}
            <div className="px-4 pb-3 flex items-center gap-4 text-xs text-gray-500">
              <span>点赞 0</span>
              <span>收藏 0</span>
              <span>评论 0</span>
            </div>

            {/* 底部交互按钮 */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setLiked(!liked)}
                  className="flex flex-col items-center gap-1 transition-transform active:scale-95"
                >
                  <Heart
                    className={`w-6 h-6 transition-colors ${
                      liked ? 'fill-red-500 text-red-500' : 'text-gray-600'
                    }`}
                  />
                  <span className="text-xs text-gray-600">
                    {liked ? '已赞' : '点赞'}
                  </span>
                </button>
                <button
                  onClick={() => setCollected(!collected)}
                  className="flex flex-col items-center gap-1 transition-transform active:scale-95"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      collected ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'
                    }`}
                  />
                  <span className="text-xs text-gray-600">
                    {collected ? '已收藏' : '收藏'}
                  </span>
                </button>
                <button className="flex flex-col items-center gap-1 transition-transform active:scale-95">
                  <MessageCircle className="w-6 h-6 text-gray-600" />
                  <span className="text-xs text-gray-600">评论</span>
                </button>
                <button className="flex flex-col items-center gap-1 transition-transform active:scale-95">
                  <Share2 className="w-6 h-6 text-gray-600" />
                  <span className="text-xs text-gray-600">分享</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
