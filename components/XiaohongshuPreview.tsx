'use client'

import React, { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 内容区域 */}
          <div className="max-h-[90vh] overflow-y-auto">
            {/* 图片轮播 */}
            {images.length > 0 && (
              <div className="relative aspect-[3/4] bg-gray-100">
                <img
                  src={images[currentImageIndex]}
                  alt={`预览 ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* 图片导航 */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* 图片指示器 */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, index) => (
                        <div
                          key={index}
                          className={`h-1.5 rounded-full transition-all ${
                            index === currentImageIndex
                              ? 'w-6 bg-white'
                              : 'w-1.5 bg-white bg-opacity-50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 标题和内容 */}
            <div className="p-4">
              {/* 标题 */}
              <h2 className="text-lg font-bold text-gray-900 mb-3 leading-tight">
                {title}
              </h2>

              {/* 正文 */}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                {content}
              </p>

              {/* 标签 */}
              {tagsArray.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tagsArray.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
