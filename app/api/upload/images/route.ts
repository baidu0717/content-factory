import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const maxDuration = 60 // 最长60秒

/**
 * POST /api/upload/images - 上传图片到Vercel Blob
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[图片上传] 开始处理上传请求')

    // 获取表单数据
    const formData = await req.formData()
    const files = formData.getAll('images') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有上传文件' },
        { status: 400 }
      )
    }

    console.log('[图片上传] 收到', files.length, '个文件')

    // 验证文件数量（最多18张）
    if (files.length > 18) {
      return NextResponse.json(
        { success: false, error: '最多只能上传18张图片' },
        { status: 400 }
      )
    }

    // 上传所有图片
    const uploadPromises = files.map(async (file, index) => {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error(`文件 ${file.name} 不是图片`)
      }

      // 验证文件大小（最大10MB）
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        throw new Error(`文件 ${file.name} 超过10MB限制`)
      }

      console.log(`[图片上传] 上传第 ${index + 1}/${files.length} 张图片:`, file.name)

      // 上传到Vercel Blob
      const blob = await put(file.name, file, {
        access: 'public',
        addRandomSuffix: true // 添加随机后缀避免冲突
      })

      console.log(`[图片上传] 第 ${index + 1} 张图片上传成功:`, blob.url)

      return blob.url
    })

    // 等待所有上传完成
    const urls = await Promise.all(uploadPromises)

    console.log('[图片上传] 所有图片上传完成，总数:', urls.length)

    return NextResponse.json({
      success: true,
      data: {
        urls,
        count: urls.length
      }
    })

  } catch (error) {
    console.error('[图片上传] 上传失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图片上传失败'
      },
      { status: 500 }
    )
  }
}
