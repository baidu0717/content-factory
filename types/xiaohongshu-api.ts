// 小红书笔记API接口类型定义

export interface XiaohongshuApiResponse {
  code: number;
  cost: number;
  has_more: boolean;
  items: XiaohongshuItem[];
  remain_money: number;
  [property: string]: any;
}

export interface XiaohongshuItem {
  id: string;
  model_type: string;
  note_card?: XiaohongshuNoteCard;
  xsec_token: string;
  [property: string]: any;
}

export interface XiaohongshuNoteCard {
  corner_tag_info: CornerTagInfo[];
  cover: Cover;
  display_title?: string;
  image_list: ImageList[];
  interact_info: InteractInfo;
  type: string;
  user: User;
  [property: string]: any;
}

export interface CornerTagInfo {
  text: string;
  type: string;
  [property: string]: any;
}

export interface Cover {
  height: number;
  url_default: string;
  url_pre: string;
  width: number;
  [property: string]: any;
}

export interface ImageList {
  height: number;
  info_list: InfoList[];
  width: number;
  [property: string]: any;
}

export interface InfoList {
  image_scene: string;
  url: string;
  [property: string]: any;
}

export interface InteractInfo {
  collected: boolean;
  collected_count: string;
  comment_count: string;
  liked: boolean;
  liked_count: string;
  shared_count: string;
  [property: string]: any;
}

export interface User {
  avatar: string;
  nick_name: string;
  nickname: string;
  user_id: string;
  xsec_token: string;
  [property: string]: any;
}

export interface XiaohongshuSearchParams {
  /**
   * API密钥
   */
  key: string;
  /**
   * 类型 1-搜索笔记
   */
  type: number;
  /**
   * 搜索关键词
   */
  keyword: string;
  /**
   * 页码
   */
  page: number;
  /**
   * 排序方式 general-综合, time_descending-最新, popularity_descending-最热
   */
  sort: string;
  /**
   * 笔记类型 image-图文, video-视频
   */
  note_type: string;
  /**
   * 发布时间 不限, 一天内, 一周内, 三个月内, 半年内
   */
  note_time: string;
  /**
   * 笔记范围 不限
   */
  note_range: string;
  /**
   * 代理
   */
  proxy: string;
}

// 标准化的笔记数据结构，便于前端统一处理
export interface XiaohongshuNote {
  /**
   * 笔记ID
   */
  id: string;
  /**
   * xsec_token（用于获取详情）
   */
  xsec_token: string;
  /**
   * 笔记标题
   */
  title: string;
  /**
   * 封面图片URL
   */
  cover: string;
  /**
   * 点赞数
   */
  liked_count: number;
  /**
   * 收藏数
   */
  collected_count: number;
  /**
   * 评论数
   */
  comment_count: number;
  /**
   * 分享数
   */
  shared_count: number;
  /**
   * 互动数（点赞+收藏+评论）
   */
  interact_count: number;
  /**
   * 用户昵称
   */
  user_name: string;
  /**
   * 用户头像
   */
  user_avatar: string;
  /**
   * 笔记类型
   */
  type: string;
  /**
   * 笔记正文内容（从详情接口获取）
   */
  content?: string;
  [property: string]: any;
}

// 笔记详情接口类型定义（哼哼猫API）
export interface XiaohongshuDetailParams {
  /**
   * 小红书笔记分享链接
   */
  url: string;
}

// 哼哼猫API返回的媒体信息
export interface MediaInfo {
  /**
   * 媒体类型: video, image, audio
   */
  media_type: string;
  /**
   * 资源URL
   */
  resource_url: string;
  /**
   * 预览URL（封面）
   */
  preview_url?: string;
  /**
   * 下载时需要的请求头
   */
  headers?: {
    [key: string]: string;
  };
  /**
   * 视频多清晰度列表（可选）
   */
  formats?: any[];
}

export interface XiaohongshuDetailResponse {
  /**
   * 笔记正文内容
   */
  text: string;
  /**
   * 媒体列表（视频/图片/音频）
   */
  medias: MediaInfo[];
  /**
   * 笔记ID
   */
  id?: string;
  /**
   * 创建时间
   */
  created_at?: string;
  [property: string]: any;
}

// 哼哼猫API错误响应
export interface XiaohongshuDetailErrorResponse {
  /**
   * 错误信息
   */
  message: string;
}
