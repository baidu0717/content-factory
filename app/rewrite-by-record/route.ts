import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'

/**
 * GET /api/rewrite-by-record?record_id=xxx
 * 根据飞书记录ID获取笔记数据，然后重定向到复刻页面
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // 支持两种方式：直接的 record_id 或者 link (记录链接)
    let recordId = searchParams.get('record_id')
    const recordLink = searchParams.get('link')

    console.log('[复刻记录] 收到参数 - record_id:', recordId, 'link:', recordLink)

    // 如果没有直接的 record_id，尝试从 link 中提取
    if (!recordId && recordLink) {
      // Extract record ID from URL format: https://ai.feishu.cn/record/{record_id}
      recordId = recordLink.split('/').pop() || ''
      console.log('[复刻记录] 从链接中提取的记录ID:', recordId)
    }

    if (!recordId) {
      return NextResponse.json({
        success: false,
        error: '缺少记录ID或记录链接参数',
      }, { status: 400 })
    }

    // 使用环境变量中的默认表格信息
    const appToken = process.env.FEISHU_DEFAULT_APP_TOKEN
    const tableId = process.env.FEISHU_DEFAULT_TABLE_ID

    console.log('[复刻记录] App Token:', appToken)
    console.log('[复刻记录] Table ID:', tableId)
    console.log('[复刻记录] Record ID:', recordId)

    if (!appToken || !tableId) {
      return NextResponse.json({
        success: false,
        error: '未配置飞书表格信息',
      }, { status: 500 })
    }

    // 获取访问令牌
    const accessToken = await getAppAccessToken()

    // 获取记录详情
    const response = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[复刻记录] 获取记录失败:', data)
      return NextResponse.json({
        success: false,
        error: `获取记录失败: ${data.msg}`,
      }, { status: 500 })
    }

    const record = data.data.record
    const fields = record.fields

    console.log('[复刻记录] 记录字段:', fields)

    // 直接从 fields 对象提取数据（fields的key就是字段名）
    const title = (fields['标题'] as string) || ''
    const content = (fields['正文'] as string) || ''
    const tags = (fields['话题标签'] as string) || ''

    console.log('[复刻记录] 提取的数据:')
    console.log('  标题:', title?.substring(0, 50))
    console.log('  正文:', content?.substring(0, 50))
    console.log('  标签:', tags)

    // 构建重定向URL
    const rewriteUrl = new URL('/rewrite', request.url)
    if (title) rewriteUrl.searchParams.append('title', title)
    if (content) rewriteUrl.searchParams.append('content', content)
    if (tags) rewriteUrl.searchParams.append('tags', tags)

    console.log('[复刻记录] 重定向到:', rewriteUrl.toString())

    // 重定向到复刻页面
    return NextResponse.redirect(rewriteUrl.toString())

  } catch (error) {
    console.error('[复刻记录] 异常:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '处理记录链接失败',
    }, { status: 500 })
  }
}
