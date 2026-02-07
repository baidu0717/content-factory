/**
 * 小红书官方表情库
 *
 * 小红书的表情是通过文本代码实现的，格式：[表情名R]
 * 在小红书 app 中，这些代码会自动渲染成对应的表情图片
 *
 * 参考资料：
 * - https://blog.csdn.net/weixin_42217359/article/details/144842589
 * - https://fe-static.xhscdn.com/formula-static/walle-eva/public/img/xy_emotion_redclub_*.png
 */

export interface XHSEmoji {
  code: string          // 文本代码，如：[萌萌哒R]
  name: string          // 中文名称，如：萌萌哒
  pinyin: string        // 拼音（用于 CDN 图片链接）
  imageUrl?: string     // CDN 图片链接（可选）
  category: string      // 分类
  tags?: string[]       // 标签
}

/**
 * 小红书官方表情分类
 */
export const XHS_EMOJI_CATEGORIES = {
  expression: '😊 表情',
  gesture: '👋 手势',
  action: '🎯 动作',
  object: '🎁 物品',
  other: '✨ 其他'
} as const

/**
 * 小红书官方表情库
 *
 * 注意：这些是从社区收集的常用表情，可能不完整
 * 实际使用时，小红书 app 会自动识别 [表情名R] 格式的代码
 */
export const XHS_EMOJIS: XHSEmoji[] = [
  // 😊 表情类
  {
    code: '[萌萌哒R]',
    name: '萌萌哒',
    pinyin: 'mengmengda',
    imageUrl: 'https://fe-static.xhscdn.com/formula-static/walle-eva/public/img/xy_emotion_redclub_mengmengda.5f09740.png',
    category: 'expression',
    tags: ['可爱', '萌']
  },
  {
    code: '[暗中观察R]',
    name: '暗中观察',
    pinyin: 'anzhongguancha',
    imageUrl: 'https://fe-static.xhscdn.com/formula-static/walle-eva/public/img/xy_emotion_redclub_anzhongguancha.6a025d0.png',
    category: 'expression',
    tags: ['观察', '偷看']
  },
  {
    code: '[吧唧R]',
    name: '吧唧',
    pinyin: 'baji',
    category: 'expression',
    tags: ['亲亲', '么么哒']
  },
  {
    code: '[笔芯R]',
    name: '笔芯',
    pinyin: 'bixin',
    category: 'gesture',
    tags: ['爱心', '喜欢']
  },
  {
    code: '[比心R]',
    name: '比心',
    pinyin: 'bixin',
    category: 'gesture',
    tags: ['爱心', '喜欢']
  },
  {
    code: '[鄙视R]',
    name: '鄙视',
    pinyin: 'bishi',
    category: 'expression',
    tags: ['不屑']
  },
  {
    code: '[并不简单R]',
    name: '并不简单',
    pinyin: 'bingbujiandan',
    category: 'expression',
    tags: ['深思']
  },
  {
    code: '[藏狐R]',
    name: '藏狐',
    pinyin: 'canghu',
    category: 'expression',
    tags: ['狐狸', '动物']
  },
  {
    code: '[嘲笑R]',
    name: '嘲笑',
    pinyin: 'chaoxiao',
    category: 'expression',
    tags: ['笑']
  },
  {
    code: '[吃瓜R]',
    name: '吃瓜',
    pinyin: 'chigua',
    category: 'action',
    tags: ['围观', '看热闹']
  },
  {
    code: '[冲鸭R]',
    name: '冲鸭',
    pinyin: 'chongya',
    category: 'action',
    tags: ['加油', '努力']
  },
  {
    code: '[大笑R]',
    name: '大笑',
    pinyin: 'daxiao',
    category: 'expression',
    tags: ['哈哈', '笑']
  },
  {
    code: '[点赞R]',
    name: '点赞',
    pinyin: 'dianzan',
    category: 'gesture',
    tags: ['赞', '好评']
  },
  {
    code: '[飞吻R]',
    name: '飞吻',
    pinyin: 'feiwen',
    category: 'gesture',
    tags: ['亲亲', '爱你']
  },
  {
    code: '[哈哈R]',
    name: '哈哈',
    pinyin: 'haha',
    category: 'expression',
    tags: ['笑', '开心']
  },
  {
    code: '[害羞R]',
    name: '害羞',
    pinyin: 'haixiu',
    category: 'expression',
    tags: ['脸红', '不好意思']
  },
  {
    code: '[憨笑R]',
    name: '憨笑',
    pinyin: 'hanxiao',
    category: 'expression',
    tags: ['傻笑', '开心']
  },
  {
    code: '[好的R]',
    name: '好的',
    pinyin: 'haode',
    category: 'gesture',
    tags: ['OK', '同意']
  },
  {
    code: '[黑脸R]',
    name: '黑脸',
    pinyin: 'heilian',
    category: 'expression',
    tags: ['生气', '不爽']
  },
  {
    code: '[红包R]',
    name: '红包',
    pinyin: 'hongbao',
    category: 'object',
    tags: ['钱', '福利']
  },
  {
    code: '[加油R]',
    name: '加油',
    pinyin: 'jiayou',
    category: 'gesture',
    tags: ['努力', '鼓励']
  },
  {
    code: '[惊恐R]',
    name: '惊恐',
    pinyin: 'jingkong',
    category: 'expression',
    tags: ['害怕', '恐惧']
  },
  {
    code: '[惊讶R]',
    name: '惊讶',
    pinyin: 'jingya',
    category: 'expression',
    tags: ['吃惊', 'wow']
  },
  {
    code: '[酷盖R]',
    name: '酷盖',
    pinyin: 'kugai',
    category: 'expression',
    tags: ['墨镜', '帅']
  },
  {
    code: '[流泪R]',
    name: '流泪',
    pinyin: 'liulei',
    category: 'expression',
    tags: ['哭', '难过']
  },
  {
    code: '[拿走R]',
    name: '拿走',
    pinyin: 'nazou',
    category: 'gesture',
    tags: ['收藏', '保存']
  },
  {
    code: '[派对R]',
    name: '派对',
    pinyin: 'paidui',
    category: 'action',
    tags: ['庆祝', '开心']
  },
  {
    code: '[捧腹R]',
    name: '捧腹',
    pinyin: 'pengfu',
    category: 'expression',
    tags: ['大笑', '搞笑']
  },
  {
    code: '[气愤R]',
    name: '气愤',
    pinyin: 'qifen',
    category: 'expression',
    tags: ['生气', '愤怒']
  },
  {
    code: '[色色R]',
    name: '色色',
    pinyin: 'sese',
    category: 'expression',
    tags: ['猥琐', '坏笑']
  },
  {
    code: '[生气R]',
    name: '生气',
    pinyin: 'shengqi',
    category: 'expression',
    tags: ['愤怒', '不爽']
  },
  {
    code: '[失望R]',
    name: '失望',
    pinyin: 'shiwang',
    category: 'expression',
    tags: ['沮丧', '难过']
  },
  {
    code: '[石化R]',
    name: '石化',
    pinyin: 'shihua',
    category: 'expression',
    tags: ['震惊', '呆住']
  },
  {
    code: '[思考R]',
    name: '思考',
    pinyin: 'sikao',
    category: 'expression',
    tags: ['想', '疑问']
  },
  {
    code: '[酸了R]',
    name: '酸了',
    pinyin: 'suanle',
    category: 'expression',
    tags: ['羡慕', '嫉妒']
  },
  {
    code: '[叹气R]',
    name: '叹气',
    pinyin: 'tanqi',
    category: 'expression',
    tags: ['无奈', '唉']
  },
  {
    code: '[偷笑R]',
    name: '偷笑',
    pinyin: 'touxiao',
    category: 'expression',
    tags: ['坏笑', '得意']
  },
  {
    code: '[委屈R]',
    name: '委屈',
    pinyin: 'weiqu',
    category: 'expression',
    tags: ['难过', '可怜']
  },
  {
    code: '[微笑R]',
    name: '微笑',
    pinyin: 'weixiao',
    category: 'expression',
    tags: ['笑', '开心']
  },
  {
    code: '[捂脸R]',
    name: '捂脸',
    pinyin: 'wulian',
    category: 'gesture',
    tags: ['尴尬', '无语']
  },
  {
    code: '[喜欢R]',
    name: '喜欢',
    pinyin: 'xihuan',
    category: 'expression',
    tags: ['爱', '喜爱']
  },
  {
    code: '[笑哭R]',
    name: '笑哭',
    pinyin: 'xiaoku',
    category: 'expression',
    tags: ['笑到流泪', '太好笑']
  },
  {
    code: '[斜眼R]',
    name: '斜眼',
    pinyin: 'xieyan',
    category: 'expression',
    tags: ['不屑', '鄙视']
  },
  {
    code: '[疑问R]',
    name: '疑问',
    pinyin: 'yiwen',
    category: 'expression',
    tags: ['问号', '不懂']
  },
  {
    code: '[阴险R]',
    name: '阴险',
    pinyin: 'yinxian',
    category: 'expression',
    tags: ['坏笑', '邪恶']
  },
  {
    code: '[允悲R]',
    name: '允悲',
    pinyin: 'yunbei',
    category: 'expression',
    tags: ['悲伤', '难过']
  },
  {
    code: '[赞R]',
    name: '赞',
    pinyin: 'zan',
    category: 'gesture',
    tags: ['点赞', '好评']
  },
  {
    code: '[炸裂R]',
    name: '炸裂',
    pinyin: 'zhalie',
    category: 'action',
    tags: ['爆炸', '震撼']
  },
  {
    code: '[中毒R]',
    name: '中毒',
    pinyin: 'zhongdu',
    category: 'expression',
    tags: ['晕', '昏']
  },
  {
    code: '[抓狂R]',
    name: '抓狂',
    pinyin: 'zhuakuang',
    category: 'expression',
    tags: ['抓狂', '疯了']
  },
  {
    code: '[紫薯R]',
    name: '紫薯',
    pinyin: 'zishu',
    category: 'other',
    tags: ['薯', '吉祥物']
  },
  {
    code: '[左上R]',
    name: '左上',
    pinyin: 'zuoshang',
    category: 'gesture',
    tags: ['指向', '方向']
  },
  {
    code: '[打卡R]',
    name: '打卡',
    pinyin: 'daka',
    category: 'action',
    tags: ['签到', '记录']
  }
]

/**
 * 根据分类获取表情
 */
export function getEmojisByCategory(category: string): XHSEmoji[] {
  return XHS_EMOJIS.filter(emoji => emoji.category === category)
}

/**
 * 根据标签搜索表情
 */
export function searchEmojisByTag(tag: string): XHSEmoji[] {
  return XHS_EMOJIS.filter(emoji => emoji.tags?.includes(tag))
}

/**
 * 根据名称搜索表情
 */
export function searchEmojisByName(keyword: string): XHSEmoji[] {
  return XHS_EMOJIS.filter(emoji =>
    emoji.name.includes(keyword) || emoji.code.includes(keyword)
  )
}

/**
 * 获取所有表情分类
 */
export function getAllCategories() {
  return Object.entries(XHS_EMOJI_CATEGORIES).map(([key, name]) => ({
    key,
    name
  }))
}

/**
 * 获取热门表情（基于使用频率）
 */
export function getHotEmojis(): XHSEmoji[] {
  // 这里返回一些常用的表情
  const hotCodes = [
    '[萌萌哒R]',
    '[哈哈R]',
    '[笑哭R]',
    '[比心R]',
    '[点赞R]',
    '[吃瓜R]',
    '[冲鸭R]',
    '[加油R]',
    '[打卡R]',
    '[派对R]',
    '[暗中观察R]',
    '[拿走R]'
  ]

  return XHS_EMOJIS.filter(emoji => hotCodes.includes(emoji.code))
}

/**
 * 将文本中的表情代码转换为可显示的格式
 * 注意：在网页中，我们只能显示文本代码，真正的图片渲染只在小红书 app 中生效
 */
export function renderEmojiText(text: string): string {
  // 在网页环境中，我们保持原样
  // 小红书 app 会自动识别并渲染 [表情名R] 格式的代码
  return text
}

/**
 * 检查文本中是否包含小红书表情
 */
export function hasXHSEmoji(text: string): boolean {
  return /\[.+?R\]/.test(text)
}

/**
 * 提取文本中的所有表情代码
 */
export function extractEmojis(text: string): string[] {
  const regex = /\[.+?R\]/g
  return text.match(regex) || []
}
