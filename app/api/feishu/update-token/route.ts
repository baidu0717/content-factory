import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * POST /api/feishu/update-token
 * 更新 .env.local 中的 FEISHU_REFRESH_TOKEN
 *
 * 注意: 这个API只在开发环境使用，生产环境需要手动在Vercel中配置
 */
export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请提供有效的 refresh_token'
      }, { status: 400 })
    }

    if (!refreshToken.startsWith('ur-')) {
      return NextResponse.json({
        success: false,
        error: 'refresh_token 格式不正确，应该以 ur- 开头'
      }, { status: 400 })
    }

    // 只在开发环境允许更新
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        success: false,
        error: '生产环境不支持此操作，请在 Vercel Dashboard 中手动更新环境变量'
      }, { status: 403 })
    }

    // 读取 .env.local 文件
    const envPath = join(process.cwd(), '.env.local')
    let envContent: string

    try {
      envContent = readFileSync(envPath, 'utf-8')
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: '无法读取 .env.local 文件'
      }, { status: 500 })
    }

    // 替换 FEISHU_REFRESH_TOKEN 的值
    const regex = /^FEISHU_REFRESH_TOKEN=.*/m

    if (regex.test(envContent)) {
      // 如果存在，就替换
      envContent = envContent.replace(regex, `FEISHU_REFRESH_TOKEN=${refreshToken}`)
    } else {
      // 如果不存在，就添加
      envContent += `\n\n# 飞书 OAuth refresh_token（自动更新于 ${new Date().toISOString()}）\nFEISHU_REFRESH_TOKEN=${refreshToken}\n`
    }

    // 写入文件
    try {
      writeFileSync(envPath, envContent, 'utf-8')
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: '无法写入 .env.local 文件'
      }, { status: 500 })
    }

    console.log('[Token更新] ✅ FEISHU_REFRESH_TOKEN 已更新到 .env.local')
    console.log('[Token更新] ⚠️  请重启开发服务器使新配置生效')

    return NextResponse.json({
      success: true,
      message: 'Token 已更新到 .env.local，请重启开发服务器'
    })

  } catch (error) {
    console.error('[Token更新] 更新失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
