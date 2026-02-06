import { NextRequest, NextResponse } from 'next/server'

// 从环境变量获取小红书API配置 (myaibot.vip)
const MYAIBOT_API_KEY = process.env.MYAIBOT_API_KEY || ''
const MYAIBOT_API_BASE = 'https://www.myaibot.vip/api/rednote/publish'

/**
 * POST /api/xiaohongshu/publish-direct - 直接发布到小红书（不保存到数据库）
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log('\n' + '='.repeat(80))
  console.log('📝 [小红书直接发布] 开始处理发布请求')

  try {
    // 解析请求体
    const body = await req.json()
    const { title, content, images } = body

    console.log('标题:', title)
    console.log('正文长度:', content?.length || 0)
    console.log('图片数量:', images?.length || 0)

    // 验证参数
    if (!title || !content) {
      console.log('❌ 缺少标题或正文')
      return NextResponse.json(
        { success: false, error: '标题和正文不能为空' },
        { status: 400 }
      )
    }

    if (!images || images.length === 0) {
      console.log('❌ 缺少图片')
      return NextResponse.json(
        { success: false, error: '至少需要一张图片' },
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

    // 准备请求数据 (myaibot.vip 格式)
    const publishData = {
      api_key: MYAIBOT_API_KEY,
      type: 'normal',  // 图文笔记
      title: title.substring(0, 20),  // 标题限制20字符
      content: content.substring(0, 1000),  // 内容限制1000字符
      images: images.slice(0, 18)  // 最多18张图片
    }

    console.log('\n📤 准备发送到 MyAIBot API...')
    console.log('API地址:', MYAIBOT_API_BASE)
    console.log('请求数据:', JSON.stringify({
      ...publishData,
      api_key: '***已隐藏***'  // 隐藏API密钥
    }, null, 2))
    console.log('图片数量:', publishData.images.length)

    // 调用小红书发布API
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

    const endTime = Date.now()
    const totalDuration = endTime - startTime

    console.log('\n✅ 发布成功!')
    console.log('总耗时:', totalDuration + 'ms')
    console.log('二维码URL:', responseData.data?.xiaohongshu_qr_image_url)
    console.log('发布URL:', responseData.data?.publish_url)
    console.log('='.repeat(80))

    // 返回成功结果
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
