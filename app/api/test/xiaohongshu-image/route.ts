import { NextRequest, NextResponse } from 'next/server'

// 极致了 API 配置
const JIZHILE_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY || 'JZL1b7f46d7a6b92240'
const JIZHILE_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE || 'https://www.dajiala.com/fbmain/monitor/v3/xhs'

/**
 * 从短链接获取完整URL和note_id
 */
async function getFullUrlAndNoteId(shortUrl: string): Promise<{ fullUrl: string; noteId: string }> {
  console.log('[测试] 跟随短链接重定向:', shortUrl)
  const startTime = Date.now()

  const response = await fetch(shortUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38(0x1800262c) NetType/WIFI Language/zh_CN',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  })

  const duration = Date.now() - startTime
  console.log(`[测试] 重定向完成，耗时: ${duration}ms`)

  const fullUrl = response.url
  console.log('[测试] 完整URL:', fullUrl)

  // 提取note_id
  let noteId: string | null = null
  let noteIdMatch = fullUrl.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)

  if (noteIdMatch) {
    noteId = noteIdMatch[1]
  } else {
    const redirectUriMatch = fullUrl.match(/redirect_uri=([^&]+)/)
    if (redirectUriMatch) {
      const redirectUri = decodeURIComponent(redirectUriMatch[1])
      const redirectMatch = redirectUri.match(/\/(?:explore|discovery\/item)\/([a-f0-9]+)/)
      if (redirectMatch) {
        noteId = redirectMatch[1]
      }
    }
  }

  if (!noteId) {
    throw new Error(`无法从URL中提取note_id: ${fullUrl}`)
  }

  console.log('[测试] 提取到note_id:', noteId)
  return { fullUrl, noteId }
}

/**
 * 解析小红书链接（使用极致了API）
 */
async function parseXiaohongshu(url: string) {
  console.log('[测试] 开始解析链接:', url)
  const startTime = Date.now()

  // 1. 获取note_id
  const { noteId } = await getFullUrlAndNoteId(url)

  // 2. 调用极致了API
  console.log('[测试] 调用极致了API...')
  const apiStartTime = Date.now()

  const response = await fetch(JIZHILE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: JIZHILE_API_KEY,
      type: 11,
      note_id: noteId,
      xsec_token: ''
    })
  })

  const apiDuration = Date.now() - apiStartTime
  console.log(`[测试] 极致了API响应，耗时: ${apiDuration}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[测试] API错误:', errorText)
    throw new Error(`解析失败: HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.code !== 0) {
    console.error('[测试] API返回错误:', data)
    throw new Error(`API错误: ${data.msg || data.message || '未知错误'}`)
  }

  const noteData = data.note_list?.[0]
  if (!noteData) {
    throw new Error('API返回数据格式错误')
  }

  // 提取图片
  const images = noteData.images_list?.map((img: any) => {
    return img.original || img.url || img.url_default || ''
  }).filter(Boolean) || []

  const duration = Date.now() - startTime
  console.log(`[测试] 解析完成，耗时: ${duration}ms`)
  console.log(`[测试] 找到 ${images.length} 张图片`)

  return {
    title: noteData.title || '',
    images,
  }
}

/**
 * 下载图片
 */
async function downloadImage(url: string, index: number): Promise<{ success: boolean; size?: number; error?: string; duration: number; format?: string }> {
  console.log(`[测试] 开始下载图片 ${index + 1}:`, url)
  const startTime = Date.now()

  try {
    // 将 HEIF 格式的图片 URL 转换为 JPEG 格式
    let processedUrl = url
    let convertedFormat = 'original'
    if (url.includes('format/heif')) {
      processedUrl = url.replace(/format\/heif/g, 'format/jpg')
      convertedFormat = 'heif→jpg'
      console.log(`[测试] 图片 ${index + 1} 检测到HEIF格式，转换为JPEG`)
    }

    const response = await fetch(processedUrl, {
      headers: {
        'Referer': 'https://www.xiaohongshu.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      console.error(`[测试] ❌ 图片 ${index + 1} 下载失败: HTTP ${response.status}`)
      return { success: false, error: `HTTP ${response.status}`, duration }
    }

    const arrayBuffer = await response.arrayBuffer()
    const size = arrayBuffer.byteLength

    console.log(`[测试] ✅ 图片 ${index + 1} 下载成功: ${size} bytes, 耗时: ${duration}ms, 格式转换: ${convertedFormat}`)
    return { success: true, size, duration, format: convertedFormat }

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : '未知错误'
    console.error(`[测试] ❌ 图片 ${index + 1} 下载异常:`, errorMsg)
    return { success: false, error: errorMsg, duration }
  }
}

/**
 * POST /api/test/xiaohongshu-image
 * 测试小红书图片下载
 */
export async function POST(request: NextRequest) {
  const totalStartTime = Date.now()

  try {
    const body = await request.json()
    const { url } = body

    console.log('\n========== 开始测试 ==========')
    console.log('[测试] 小红书链接:', url)

    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        message: '请提供小红书链接'
      }, { status: 400 })
    }

    // 1. 解析小红书链接
    console.log('\n--- 步骤1: 解析链接 ---')
    const { title, images } = await parseXiaohongshu(url)

    console.log(`\n✅ 解析成功: ${title}`)
    console.log(`📸 图片数量: ${images.length}`)

    // 2. 测试下载每张图片
    console.log('\n--- 步骤2: 测试图片下载 ---')
    const downloadResults = []

    for (let i = 0; i < images.length; i++) {
      const result = await downloadImage(images[i], i)
      downloadResults.push({
        index: i + 1,
        url: images[i],
        ...result
      })
    }

    // 3. 统计结果
    const totalDuration = Date.now() - totalStartTime
    const successCount = downloadResults.filter(r => r.success).length
    const failedCount = downloadResults.filter(r => !r.success).length
    const totalSize = downloadResults.reduce((sum, r) => sum + (r.size || 0), 0)
    const avgDuration = downloadResults.reduce((sum, r) => sum + r.duration, 0) / downloadResults.length

    console.log('\n========== 测试完成 ==========')
    console.log(`✅ 成功: ${successCount}/${images.length}`)
    console.log(`❌ 失败: ${failedCount}/${images.length}`)
    console.log(`📦 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`⏱️  平均耗时: ${avgDuration.toFixed(0)}ms/张`)
    console.log(`⏱️  总耗时: ${totalDuration}ms`)
    console.log('================================\n')

    return NextResponse.json({
      success: true,
      data: {
        title,
        totalImages: images.length,
        successCount,
        failedCount,
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        avgDuration: Math.round(avgDuration),
        totalDuration,
        results: downloadResults.map(r => ({
          index: r.index,
          success: r.success,
          size: r.size,
          sizeMB: r.size ? (r.size / 1024 / 1024).toFixed(2) : undefined,
          duration: r.duration,
          format: r.format,
          error: r.error,
          url: r.url
        }))
      }
    })

  } catch (error) {
    const totalDuration = Date.now() - totalStartTime
    console.error('\n========== 测试失败 ==========')
    console.error('[测试] 错误:', error)
    console.error(`⏱️  总耗时: ${totalDuration}ms`)
    console.error('================================\n')

    return NextResponse.json({
      success: false,
      message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      duration: totalDuration
    }, { status: 500 })
  }
}
