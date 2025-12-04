import type {
  WechatAccountsResponse,
  WechatPublishRequest,
  WechatPublishResponse,
} from '@/types/wechat-publish'

/**
 * 获取当前用户授权的所有微信公众号信息
 */
export async function getWechatAccounts(): Promise<WechatAccountsResponse> {
  try {
    const response = await fetch('/api/wechat/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('获取公众号列表失败:', error)
    return {
      success: false,
      data: { accounts: [], total: 0 },
      error: error instanceof Error ? error.message : '获取公众号列表失败',
    }
  }
}

/**
 * 发布文章到指定的微信公众号
 */
export async function publishToWechat(
  params: WechatPublishRequest
): Promise<WechatPublishResponse> {
  try {
    const response = await fetch('/api/wechat/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('发布文章失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '发布文章失败',
      code: 'NETWORK_ERROR',
    }
  }
}
