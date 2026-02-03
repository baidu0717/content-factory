import { NextRequest, NextResponse } from 'next/server'
import { getUserAccessToken, getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * GET /api/feishu/redirect-to-rewrite?record_id=xxx
 * 根据记录ID，读取飞书表格数据并重定向到复刻页面
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recordId = searchParams.get('record_id')

    if (!recordId) {
      return NextResponse.json({
        success: false,
        error: '缺少 record_id 参数',
      }, { status: 400 })
    }

    console.log('🔗 准备跳转到复刻页面，记录ID:', recordId)

    // 1. 获取访问令牌
    let accessToken: string
    try {
      accessToken = await getUserAccessToken()
      console.log('[Token] 使用 user_access_token')
    } catch (error) {
      console.log('[Token] user token失败，尝试使用 app_access_token')
      accessToken = await getAppAccessToken()
      console.log('[Token] 使用 app_access_token')
    }

    // 2. 读取指定记录
    console.log('📋 读取记录:', recordId)
    const recordResponse = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const recordData = await recordResponse.json()

    if (recordData.code !== 0) {
      throw new Error(`读取记录失败: ${recordData.msg}`)
    }

    const fields = recordData.data.record.fields

    // 3. 提取标题、正文、话题标签
    const title = fields['标题'] || ''
    const content = fields['正文'] || ''
    const tags = fields['话题标签'] || ''

    console.log('✅ 读取成功')
    console.log('标题:', title)
    console.log('正文:', content.substring(0, 50) + '...')
    console.log('话题标签:', tags)

    // 4. 构建复刻页面URL
    const params = new URLSearchParams()
    params.append('title', title)
    params.append('content', content)
    if (tags) params.append('tags', tags)

    const rewriteUrl = `${BASE_URL}/rewrite?${params.toString()}`

    // 5. 重定向到复刻页面
    return NextResponse.redirect(rewriteUrl)

  } catch (error) {
    console.error('❌ 重定向失败:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '重定向失败',
    }, { status: 500 })
  }
}
