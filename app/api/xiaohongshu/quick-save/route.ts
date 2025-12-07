import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/feishu-auth'

/**
 * POST /api/xiaohongshu/quick-save
 * iOS快捷指令专用API - 一键保存小红书笔记到飞书
 *
 * 请求参数:
 * - url: 小红书笔记链接
 * - appToken: 飞书表格app_token (可选,使用环境变量默认值)
 * - tableId: 飞书表格table_id (可选,使用环境变量默认值)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, appToken, tableId } = body

    console.log('[快捷保存] 收到请求:', { url, appToken, tableId })

    // 验证URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({
        success: false,
        message: '❌ 请提供小红书链接'
      }, { status: 400 })
    }

    // 获取表格配置 (优先使用参数，其次使用环境变量)
    const finalAppToken = appToken || process.env.FEISHU_DEFAULT_APP_TOKEN
    const finalTableId = tableId || process.env.FEISHU_DEFAULT_TABLE_ID

    if (!finalAppToken || !finalTableId) {
      return NextResponse.json({
        success: false,
        message: '❌ 未配置飞书表格信息，请在快捷指令中添加appToken和tableId参数'
      }, { status: 400 })
    }

    // 检查用户登录状态
    const accessToken = await getValidAccessToken()
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        message: '❌ 用户未登录，请先在网页端登录飞书账号'
      }, { status: 401 })
    }

    console.log('[快捷保存] 开始解析小红书链接...')

    // 1. 调用小红书解析API
    const parseResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/xiaohongshu/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })

    if (!parseResponse.ok) {
      const errorData = await parseResponse.json()
      return NextResponse.json({
        success: false,
        message: `❌ 解析失败: ${errorData.error || '未知错误'}`
      }, { status: parseResponse.status })
    }

    const parseData = await parseResponse.json()
    if (!parseData.success) {
      return NextResponse.json({
        success: false,
        message: `❌ 解析失败: ${parseData.error}`
      }, { status: 400 })
    }

    const { title, content, tags, images } = parseData.data
    console.log('[快捷保存] 解析成功:', { title, imageCount: images.length })

    // 2. 保存到飞书表格
    console.log('[快捷保存] 开始保存到飞书...')
    const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/feishu/append-row`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content,
        tags,
        images,
        url,
        appToken: finalAppToken,
        tableId: finalTableId,
      })
    })

    const saveData = await saveResponse.json()

    if (!saveResponse.ok || !saveData.success) {
      return NextResponse.json({
        success: false,
        message: `❌ 保存失败: ${saveData.error || '未知错误'}`
      }, { status: saveResponse.status })
    }

    console.log('[快捷保存] 保存成功!')

    // 3. 返回成功消息
    return NextResponse.json({
      success: true,
      message: `✅ 保存成功!\n\n📝 ${title}\n📸 ${images.length}张图片\n⏱️ 耗时${saveData.data.duration}ms`,
      data: {
        title,
        imageCount: images.length,
        duration: saveData.data.duration,
        tableUrl: `https://ai.feishu.cn/base/${finalAppToken}`
      }
    })

  } catch (error) {
    console.error('[快捷保存] 错误:', error)
    return NextResponse.json({
      success: false,
      message: `❌ 发生错误: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 })
  }
}

/**
 * GET /api/xiaohongshu/quick-save
 * 支持通过URL参数调用 (方便快捷指令使用)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  const appToken = searchParams.get('appToken')
  const tableId = searchParams.get('tableId')

  // 转发到POST处理
  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, appToken, tableId })
  }))
}
