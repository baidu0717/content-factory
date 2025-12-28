'use client'

import React, { useCallback, useState } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { compressImage, uploadOriginalImage, isImageFile, validateFileSize, formatFileSize } from '@/lib/imageUtils'

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void
  disabled?: boolean
  useOriginal?: boolean  // 是否使用原图（不压缩）
}

export default function ImageUploader({ onImageSelect, disabled, useOriginal = true }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  // 处理文件
  const handleFile = async (file: File) => {
    setError('')

    // 验证是否为图片
    if (!isImageFile(file)) {
      setError('请上传图片文件（JPG、PNG、GIF等）')
      return
    }

    // 验证文件大小（最大20MB，原图模式支持更大文件）
    const maxSize = useOriginal ? 20 : 10
    if (!validateFileSize(file, maxSize)) {
      setError(`文件过大（${formatFileSize(file.size)}），最大支持 ${maxSize}MB`)
      return
    }

    try {
      setIsProcessing(true)

      let imageBase64: string

      if (useOriginal) {
        // 使用原图（不压缩）
        imageBase64 = await uploadOriginalImage(file)
        console.log('[ImageUploader] 使用原图模式，不压缩')
      } else {
        // 压缩图片
        imageBase64 = await compressImage(file, 4096, 0.95)
        console.log('[ImageUploader] 使用压缩模式')
      }

      // 设置预览
      setPreview(imageBase64)

      // 回调
      onImageSelect(imageBase64)

    } catch (err) {
      console.error('[图片上传] 处理失败:', err)
      setError('图片处理失败，请重试')
    } finally {
      setIsProcessing(false)
    }
  }

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [disabled])

  // 点击上传
  const handleClick = () => {
    if (disabled) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        handleFile(file)
      }
    }
    input.click()
  }

  // 清除图片
  const handleClear = () => {
    setPreview(null)
    setError('')
  }

  return (
    <div className="space-y-3">
      {!preview ? (
        // 上传区域
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8
            flex flex-col items-center justify-center
            cursor-pointer transition-all
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-600">
                {useOriginal ? '正在读取原图...' : '正在压缩图片...'}
              </p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                点击上传或拖拽图片到这里
              </p>
              <p className="text-xs text-gray-500">
                支持 JPG、PNG、GIF，最大 {useOriginal ? '20MB' : '10MB'}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {useOriginal
                  ? '✨ 原图模式：保持100%质量，适合小红书发布'
                  : '图片会自动压缩到 4096px，质量95%'
                }
              </p>
            </>
          )}
        </div>
      ) : (
        // 预览区域
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img
            src={preview}
            alt="上传预览"
            className="w-full h-auto"
          />
          {!disabled && (
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-all"
              title="清除图片"
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
