import { NextRequest, NextResponse } from 'next/server'

const API_302AI_KEY = process.env.API_302AI_KEY || ''
const SEARCH_URL = 'https://api.302ai.cn/tools/xiaohongshu/app/search_notes'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword') || ''
  const page = searchParams.get('page') || '1'
  const sort = searchParams.get('sort') || ''
  const searchId = searchParams.get('searchId') || ''
  const sessionId = searchParams.get('sessionId') || ''

  if (!keyword) {
    return NextResponse.json({ code: -1, msg: '缺少 keyword 参数' }, { status: 400 })
  }

  const params = new URLSearchParams({ keyword, page })
  // V3 参数名为 sort_type；hot 是极致了专用值，302.ai 用 general 代替
  const sortType = sort === 'hot' ? 'general' : sort
  if (sortType) params.set('sort_type', sortType)
  // V3 分页参数名为 search_id / session_id（下划线）
  if (searchId) params.set('search_id', searchId)
  if (sessionId) params.set('session_id', sessionId)

  try {
    const response = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${API_302AI_KEY}` },
    })

    const raw = await response.json()

    if (raw.error) {
      console.error('[302.ai 搜索] 错误:', raw.error)
      return NextResponse.json(
        { code: -1, msg: raw.error.message_cn || '302.ai API 错误' },
        { status: 500 }
      )
    }

    const inner = raw.data || {}
    const items: unknown[] = inner.data?.items || []

    console.log('[302.ai 搜索] 关键词:', keyword, '页码:', page, '结果数:', items.length)

    return NextResponse.json({
      code: 0,
      has_more: items.length >= 20,
      items: [],
      data: { items },
      searchId: inner.searchId || '',
      sessionId: inner.sessionId || '',
    })
  } catch (error) {
    console.error('[302.ai 搜索] 请求异常:', error)
    return NextResponse.json({ code: -1, msg: '搜索请求失败' }, { status: 500 })
  }
}
