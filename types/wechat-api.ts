// 公众号文章API接口类型定义

export interface WeChatArticleApiResponse {
  code: number;
  cost_money: number;
  cut_words: string;
  data: WeChatArticle[];
  data_number: number;
  msg: string;
  page: number;
  remain_money: number;
  total: number;
  total_page: number;
  [property: string]: any;
}

export interface WeChatArticle {
  /**
   * 封面
   */
  avatar: string;
  /**
   * 分类
   */
  classify: string;
  /**
   * 正文
   */
  content: string;
  /**
   * 原始id
   */
  ghid: string;
  /**
   * 发布地址
   */
  ip_wording: string;
  /**
   * 是否原创
   */
  is_original: number;
  /**
   * 再看数
   */
  looking: number;
  /**
   * 点赞数
   */
  praise: number;
  /**
   * 发布时间
   */
  publish_time: number;
  publish_time_str: string;
  /**
   * 阅读数
   */
  read: number;
  /**
   * 文章原始短链接
   */
  short_link: string;
  /**
   * 文章标题
   */
  title: string;
  /**
   * 更新时间
   */
  update_time: number;
  update_time_str: string;
  /**
   * 文章长连接
   */
  url: string;
  /**
   * wxid
   */
  wx_id: string;
  /**
   * 公众号名字
   */
  wx_name: string;
  [property: string]: any;
}

export interface WeChatArticleSearchParams {
  /**
   * 关键词
   */
  kw: string;
  /**
   * 排序类型 1-按时间排序
   */
  sort_type?: number;
  /**
   * 搜索模式 1-标题+内容
   */
  mode?: number;
  /**
   * 时间范围（天数）
   */
  period?: number;
  /**
   * 页码
   */
  page?: number;
  /**
   * API密钥
   */
  key: string;
  /**
   * 任意关键词
   */
  any_kw?: string;
  /**
   * 排除关键词
   */
  ex_kw?: string;
  /**
   * 验证码
   */
  verifycode?: string;
  /**
   * 类型
   */
  type?: number;
}
