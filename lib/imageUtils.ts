/**
 * 图片处理工具函数
 */

/**
 * 直接读取原图（不压缩）
 * 用于小红书发布等需要保持原图质量的场景
 * @param file 原始图片文件
 * @returns base64 格式的图片数据
 */
export async function uploadOriginalImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const base64Data = e.target?.result as string

      console.log('[原图上传] 读取成功:')
      console.log('  文件名:', file.name)
      console.log('  原始大小:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      console.log('  文件类型:', file.type)

      resolve(base64Data)
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 压缩图片
 * @param file 原始图片文件
 * @param maxSize 最大尺寸（宽或高，默认4096px）
 * @param quality 压缩质量（0-1，默认0.95）
 * @returns base64 格式的图片数据
 */
export async function compressImage(
  file: File,
  maxSize: number = 4096,
  quality: number = 0.95
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 创建 FileReader 读取文件
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // 计算压缩后的尺寸
          let width = img.width
          let height = img.height

          // 如果图片超过最大尺寸，等比缩放
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height / width) * maxSize)
              width = maxSize
            } else {
              width = Math.round((width / height) * maxSize)
              height = maxSize
            }
          }

          // 创建 canvas 进行压缩
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error('无法获取 canvas context')
          }

          // 绘制图片
          ctx.drawImage(img, 0, 0, width, height)

          // 转换为 base64（JPEG 格式，减小文件大小）
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality)

          console.log('[图片压缩] 压缩完成:')
          console.log('  原始尺寸:', img.width, 'x', img.height)
          console.log('  压缩后:', width, 'x', height)
          console.log('  原始大小:', (file.size / 1024 / 1024).toFixed(2), 'MB')
          console.log('  压缩后:', (compressedBase64.length / 1024 / 1024 * 0.75).toFixed(2), 'MB (估算)')

          resolve(compressedBase64)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 验证文件是否为图片
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * 验证文件大小（默认最大10MB）
 */
export function validateFileSize(file: File, maxSizeMB: number = 10): boolean {
  return file.size <= maxSizeMB * 1024 * 1024
}

/**
 * 格式化文件大小显示
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
