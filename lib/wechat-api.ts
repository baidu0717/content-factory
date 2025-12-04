import { WeChatArticleApiResponse, WeChatArticleSearchParams } from '@/types/wechat-api'

// API配置
const API_URL = process.env.NEXT_PUBLIC_WECHAT_SEARCH_API_BASE || 'https://www.dajiala.com/fbmain/monitor/v3/kw_search'
const API_KEY = process.env.NEXT_PUBLIC_WECHAT_SEARCH_API_KEY || ''

/**
 * 搜索公众号文章
 * @param params 搜索参数
 * @returns Promise<WeChatArticleApiResponse>
 */
export async function searchWeChatArticles(
  params: Omit<WeChatArticleSearchParams, 'key'>
): Promise<WeChatArticleApiResponse> {
  const requestBody: WeChatArticleSearchParams = {
    kw: params.kw,
    sort_type: params.sort_type || 1,
    mode: params.mode || 1,
    period: params.period || 7,
    page: params.page || 1,
    key: API_KEY,
    any_kw: params.any_kw || '',
    ex_kw: params.ex_kw || '',
    verifycode: params.verifycode || '',
    type: params.type || 1,
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: WeChatArticleApiResponse = await response.json()

    // 检查API返回的状态码（成功时code为0）
    if (data.code !== 0) {
      throw new Error(data.msg || 'API请求失败')
    }

    return data
  } catch (error) {
    console.error('搜索公众号文章失败:', error)
    throw error
  }
}

/**
 * 批量搜索多页文章
 * @param keyword 关键词
 * @param totalPages 总页数
 * @returns Promise<WeChatArticleApiResponse[]>
 */
export async function searchMultiplePages(
  keyword: string,
  totalPages: number = 1
): Promise<WeChatArticleApiResponse[]> {
  const promises: Promise<WeChatArticleApiResponse>[] = []

  for (let page = 1; page <= totalPages; page++) {
    promises.push(
      searchWeChatArticles({
        kw: keyword,
        page,
      })
    )
  }

  return Promise.all(promises)
}
