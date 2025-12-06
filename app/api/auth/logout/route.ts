import { NextResponse } from 'next/server'
import { unlinkSync, existsSync } from 'fs'
import { join } from 'path'

const TOKEN_FILE = join(process.cwd(), '.feishu-token.json')

/**
 * POST /api/auth/logout
 * 退出登录，删除token文件
 */
export async function POST() {
  try {
    console.log('[飞书登出] 开始退出登录...')

    if (existsSync(TOKEN_FILE)) {
      unlinkSync(TOKEN_FILE)
      console.log('[飞书登出] Token文件已删除')
    } else {
      console.log('[飞书登出] Token文件不存在')
    }

    return NextResponse.json({
      success: true,
      message: '退出登录成功',
    })
  } catch (error) {
    console.error('[飞书登出] 退出登录失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}
