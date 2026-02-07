/**
 * 小红书表情使用记录和学习系统
 *
 * 功能：
 * 1. 记录用户使用的表情
 * 2. 分析用户的表情使用偏好
 * 3. 为 AI 改写提供个性化的表情建议
 */

import { extractEmojis } from './xiaohongshu-emojis'

// 表情使用记录
export interface EmojiUsageRecord {
  emoji: string          // 表情代码，如：[萌萌哒R]
  count: number          // 使用次数
  lastUsed: number       // 最后使用时间戳
  contexts: string[]     // 使用场景（最多保存5个）
}

// 表情使用统计
export interface EmojiUsageStats {
  totalUsage: number     // 总使用次数
  uniqueEmojis: number   // 不同表情数量
  favoriteEmojis: string[]  // 最常用的表情（前10）
  recentEmojis: string[]    // 最近使用的表情（前10）
}

const STORAGE_KEY = 'xhs-emoji-usage'
const MAX_CONTEXTS = 5
const MAX_RECORDS = 100  // 最多保存100个表情记录

/**
 * 记录表情使用
 */
export function recordEmojiUsage(text: string, context?: string) {
  try {
    // 提取文本中的表情
    const emojis = extractEmojis(text)
    if (emojis.length === 0) return

    // 获取现有记录
    const records = getEmojiUsageRecords()

    // 更新记录
    emojis.forEach(emoji => {
      const existingRecord = records.find(r => r.emoji === emoji)

      if (existingRecord) {
        // 更新已有记录
        existingRecord.count++
        existingRecord.lastUsed = Date.now()

        // 添加使用场景
        if (context) {
          existingRecord.contexts.unshift(context)
          existingRecord.contexts = existingRecord.contexts.slice(0, MAX_CONTEXTS)
        }
      } else {
        // 创建新记录
        records.push({
          emoji,
          count: 1,
          lastUsed: Date.now(),
          contexts: context ? [context] : []
        })
      }
    })

    // 保存记录（按使用频率排序，只保留前 MAX_RECORDS 个）
    const sortedRecords = records
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_RECORDS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedRecords))

    console.log('[表情学习] 已记录', emojis.length, '个表情使用')
  } catch (error) {
    console.error('[表情学习] 记录失败:', error)
  }
}

/**
 * 获取表情使用记录
 */
export function getEmojiUsageRecords(): EmojiUsageRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []

    return JSON.parse(data) as EmojiUsageRecord[]
  } catch (error) {
    console.error('[表情学习] 读取记录失败:', error)
    return []
  }
}

/**
 * 获取表情使用统计
 */
export function getEmojiUsageStats(): EmojiUsageStats {
  const records = getEmojiUsageRecords()

  const totalUsage = records.reduce((sum, r) => sum + r.count, 0)
  const uniqueEmojis = records.length

  // 最常用的表情（按使用次数排序）
  const favoriteEmojis = records
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(r => r.emoji)

  // 最近使用的表情（按最后使用时间排序）
  const recentEmojis = records
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 10)
    .map(r => r.emoji)

  return {
    totalUsage,
    uniqueEmojis,
    favoriteEmojis,
    recentEmojis
  }
}

/**
 * 获取用户偏好的表情提示词
 * 用于 AI 改写时的个性化建议
 */
export function getUserEmojiPreferences(): string {
  const stats = getEmojiUsageStats()

  if (stats.totalUsage === 0) {
    return '用户暂无表情使用记录，请使用通用表情建议。'
  }

  return `
用户表情使用偏好（根据历史记录）：
- 总使用次数：${stats.totalUsage}
- 常用表情数量：${stats.uniqueEmojis}

用户最常用的表情（优先使用）：
${stats.favoriteEmojis.slice(0, 8).join(' ')}

用户最近使用的表情（推荐使用）：
${stats.recentEmojis.slice(0, 5).join(' ')}

建议：在改写时，优先使用用户常用的表情，保持用户的个性化风格。
`
}

/**
 * 清除表情使用记录
 */
export function clearEmojiUsageRecords() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('[表情学习] 已清除所有记录')
  } catch (error) {
    console.error('[表情学习] 清除记录失败:', error)
  }
}

/**
 * 导出表情使用记录（用于备份或分析）
 */
export function exportEmojiUsageRecords(): string {
  const records = getEmojiUsageRecords()
  return JSON.stringify(records, null, 2)
}

/**
 * 导入表情使用记录
 */
export function importEmojiUsageRecords(data: string) {
  try {
    const records = JSON.parse(data) as EmojiUsageRecord[]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    console.log('[表情学习] 已导入', records.length, '条记录')
  } catch (error) {
    console.error('[表情学习] 导入失败:', error)
    throw new Error('导入失败：数据格式不正确')
  }
}

/**
 * 分析表情使用趋势
 */
export function analyzeEmojiTrends() {
  const records = getEmojiUsageRecords()

  // 按类别统计
  const categories = {
    expression: [] as string[],  // 表情类
    gesture: [] as string[],      // 手势类
    action: [] as string[],       // 动作类
    other: [] as string[]         // 其他
  }

  records.forEach(record => {
    const emoji = record.emoji.replace(/\[|\]/g, '').replace('R', '')

    // 简单的分类逻辑（可以根据 xiaohongshu-emojis.ts 中的分类来优化）
    if (['萌萌哒', '哈哈', '笑哭', '害羞', '微笑'].some(e => emoji.includes(e))) {
      categories.expression.push(record.emoji)
    } else if (['比心', '点赞', '赞', '加油'].some(e => emoji.includes(e))) {
      categories.gesture.push(record.emoji)
    } else if (['吃瓜', '冲鸭', '打卡', '派对'].some(e => emoji.includes(e))) {
      categories.action.push(record.emoji)
    } else {
      categories.other.push(record.emoji)
    }
  })

  return {
    totalRecords: records.length,
    categories,
    mostUsedCategory: Object.entries(categories)
      .sort((a, b) => b[1].length - a[1].length)[0]?.[0] || 'unknown'
  }
}

/**
 * 获取表情使用建议（基于当前内容）
 */
export function getEmojiSuggestions(content: string, context: 'title' | 'content'): string[] {
  const stats = getEmojiUsageStats()

  // 如果用户有使用记录，返回用户偏好的表情
  if (stats.favoriteEmojis.length > 0) {
    return context === 'title'
      ? stats.favoriteEmojis.slice(0, 3)  // 标题推荐3个
      : stats.favoriteEmojis.slice(0, 8)  // 正文推荐8个
  }

  // 否则返回通用推荐
  const commonTitleEmojis = ['[火R]', '[炸裂R]', '[赞R]']
  const commonContentEmojis = ['[萌萌哒R]', '[笑哭R]', '[赞R]', '[拿走R]', '[比心R]', '[冲鸭R]', '[派对R]', '[哈哈R]']

  return context === 'title' ? commonTitleEmojis : commonContentEmojis
}
