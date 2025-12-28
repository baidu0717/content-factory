import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  extractImagesFromMarkdown,
  markdownToPlainText,
  getFirstImageAsCover,
  extractImagesExcludingCover,
  prepareXiaohongshuContent
} from '@/lib/markdown-utils'

// 从环境变量获取小红书API配置 (myaibot.vip)
const MYAIBOT_API_KEY = process.env.MYAIBOT_API_KEY || ''
const MYAIBOT_API_BASE = 'https://www.myaibot.vip/api/rednote/publish'

/**
 * POST /api/xiaohongshu/publish - 发布文章到小红书
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(80))
  console.log('📝 [小红书发布] 开始处理发布请求')

  try {
    // 解析请求体
    const body = await req.json()
    const { articleId } = body

    console.log('文章ID:', articleId)

    // 验证参数
    if (!articleId) {
      console.log('❌ 缺少文章ID')
      return NextResponse.json(
        { success: false, error: '缺少文章ID' },
        { status: 400 }
      )
    }

    // 验证API密钥
    if (!MYAIBOT_API_KEY) {
      console.log('❌ MyAIBot API密钥未配置')
      return NextResponse.json(
        { success: false, error: 'MyAIBot API密钥未配置，请在环境变量中设置 MYAIBOT_API_KEY' },
        { status: 500 }
      )
    }

    // 从数据库获取文章
    console.log('📖 从数据库读取文章...')
    const db = getDb()
    const stmt = db.prepare('SELECT * FROM articles WHERE id = ?')
    const article: any = stmt.get(articleId)

    if (!article) {
      console.log('❌ 文章不存在')
      return NextResponse.json(
        { success: false, error: '文章不存在' },
        { status: 404 }
      )
    }

    console.log('✅ 文章读取成功:')
    console.log('  - 标题:', article.title)
    console.log('  - 内容长度:', article.content?.length || 0)

    // 提取文章数据
    const { title, content, tags: tagsJson, images: imagesJson } = article

    // 解析 JSON 字段
    const tags = tagsJson ? JSON.parse(tagsJson) : []
    const imagesFromDb = imagesJson ? JSON.parse(imagesJson) : []

    console.log('  - 标签数量:', tags.length)
    console.log('  - 数据库图片数量:', imagesFromDb.length)

    // 1. 从 Markdown 中提取图片
    console.log('\n🖼️  提取图片...')
    const imagesFromMarkdown = extractImagesFromMarkdown(content)
    console.log('  - Markdown中的图片数量:', imagesFromMarkdown.length)

    // 合并所有图片（去重）
    const allImages = Array.from(new Set([...imagesFromMarkdown, ...imagesFromDb]))
    console.log('  - 合并后总图片数量:', allImages.length)

    // 2. 获取封面图（第一张图片）
    const coverImage = getFirstImageAsCover(content, imagesFromDb)
    console.log('  - 封面图:', coverImage)

    // 3. 获取其他图片（排除封面）
    const otherImages = extractImagesExcludingCover(content, coverImage)
    console.log('  - 其他图片数量:', otherImages.length)

    // 4. 将 Markdown 转换为纯文本
    console.log('\n📄 转换内容为纯文本...')
    const plainTextContent = prepareXiaohongshuContent(content, 1000)
    console.log('  - 纯文本长度:', plainTextContent.length)
    console.log('  - 纯文本预览:', plainTextContent.substring(0, 100) + '...')

    // 5. 准备请求数据 (myaibot.vip 格式)
    // myaibot.vip 需要所有图片放在一个 images 数组中（最多18张）
    const publishData = {
      api_key: MYAIBOT_API_KEY,
      type: 'normal',  // 图文笔记
      title: title,
      content: plainTextContent,
      images: allImages.slice(0, 18)  // 最多18张图片
    }

    console.log('\n📤 准备发送到 MyAIBot API...')
    console.log('API地址:', MYAIBOT_API_BASE)
    console.log('请求数据:', JSON.stringify({
      ...publishData,
      api_key: '***已隐藏***'  // 隐藏API密钥
    }, null, 2))
    console.log('图片数量:', publishData.images.length)

    // 6. 调用小红书发布API
    console.log('\n⏰ 发起HTTP请求...')
    const apiStartTime = Date.now()

    const response = await fetch(MYAIBOT_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(publishData)
    })

    const apiEndTime = Date.now()
    const apiDuration = apiEndTime - apiStartTime

    console.log('📡 API响应返回 (耗时 ' + apiDuration + 'ms)')
    console.log('状态码:', response.status)
    console.log('状态文本:', response.statusText)

    // 解析响应
    const responseData = await response.json()
    console.log('响应数据:', JSON.stringify(responseData, null, 2))

    // 检查响应状态
    if (!response.ok) {
      console.log('❌ API调用失败')
      return NextResponse.json(
        {
          success: false,
          error: responseData.error || responseData.message || '发布到小红书失败'
        },
        { status: response.status }
      )
    }

    // 检查业务状态
    if (!responseData.success) {
      console.log('❌ 业务处理失败')
      return NextResponse.json(
        {
          success: false,
          error: responseData.error || '发布到小红书失败'
        },
        { status: 400 }
      )
    }

    // 7. 更新数据库中的文章状态
    console.log('\n💾 更新数据库文章状态...')
    try {
      // 先获取当前的 platforms 数组
      const articleStmt = db.prepare('SELECT platforms FROM articles WHERE id = ?')
      const article = articleStmt.get(articleId) as { platforms: string } | undefined
      const currentPlatforms = article?.platforms ? JSON.parse(article.platforms) : []

      // 如果 xiaohongshu 不在数组中，才添加
      if (!currentPlatforms.includes('xiaohongshu')) {
        currentPlatforms.push('xiaohongshu')
      }

      const updateStmt = db.prepare(`
        UPDATE articles
        SET status = 'published',
            platforms = ?,
            published_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      updateStmt.run(JSON.stringify(currentPlatforms), Date.now(), articleId)
      console.log('✅ 数据库更新成功')
    } catch (dbError) {
      console.error('⚠️  数据库更新失败（不影响发布）:', dbError)
    }

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    console.log('\n✅ 发布成功!')
    console.log('总耗时:', totalDuration + 'ms')
    console.log('二维码URL:', responseData.data?.xiaohongshu_qr_image_url)
    console.log('发布URL:', responseData.data?.publish_url)
    console.log('='.repeat(80))

    // 8. 返回成功结果
    return NextResponse.json({
      success: true,
      data: {
        id: responseData.data?.id,
        noteId: responseData.data?.note_id,
        title: responseData.data?.title,
        qrCodeUrl: responseData.data?.xiaohongshu_qr_image_url,
        publishUrl: responseData.data?.publish_url,
        coverImage: responseData.data?.cover_image,
        createdAt: responseData.data?.created_at
      },
      message: '发布成功！请扫描二维码在手机端完成发布'
    })

  } catch (error) {
    const endTime = Date.now()
    const totalDuration = endTime - startTime

    console.error('❌ 发布失败! 耗时:', totalDuration + 'ms')
    console.error('错误信息:', error)
    console.log('='.repeat(80))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '发布到小红书时发生错误'
      },
      { status: 500 }
    )
  }
}
