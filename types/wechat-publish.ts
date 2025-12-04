// 微信公众号账号信息
export interface WechatAccount {
  name: string
  wechatAppid: string
  username: string
  avatar: string
  type: 'subscription' | 'service'
  verified: boolean
  status: 'active' | 'revoked'
  lastAuthTime: string
  createdAt: string
}

// 获取公众号列表响应
export interface WechatAccountsResponse {
  success: boolean
  data: {
    accounts: WechatAccount[]
    total: number
  }
  error?: string
}

// 文章类型
export type ArticleType = 'news' | 'newspic'

// 内容格式
export type ContentFormat = 'markdown' | 'html'

// 发布请求参数
export interface WechatPublishRequest {
  wechatAppid: string
  title: string
  content: string
  summary?: string
  coverImage?: string
  author?: string
  contentFormat?: ContentFormat
  articleType?: ArticleType
}

// 发布响应
export interface WechatPublishResponse {
  success: boolean
  data?: {
    publicationId: string
    materialId: string
    mediaId: string
    status: string
    message: string
  }
  error?: string
  code?: string
}
