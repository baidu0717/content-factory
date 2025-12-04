import { getDb } from './db'

/**
 * 图片历史记录数据结构
 */
export interface ImageHistoryItem {
  id: number
  session_id: string | null
  turn_number: number
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  image_url: string
  aspect_ratio: string | null
  resolution: string | null
  duration: number | null  // 生成耗时（毫秒）
  created_at: number
}

/**
 * 保存图片生成记录到历史
 * @param data 历史记录数据
 * @returns 新创建的历史记录ID
 */
export function saveHistory(data: {
  session_id?: string | null
  turn_number?: number
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  image_url: string
  aspect_ratio?: string
  resolution?: string
  duration?: number
}): number {
  const db = getDb()
  const now = Date.now()

  const stmt = db.prepare(`
    INSERT INTO image_history (
      session_id, turn_number, model, mode, prompt,
      image_url, aspect_ratio, resolution, duration, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    data.session_id || null,
    data.turn_number || 1,
    data.model,
    data.mode,
    data.prompt,
    data.image_url,
    data.aspect_ratio || null,
    data.resolution || null,
    data.duration || null,
    now
  )

  const historyId = Number(result.lastInsertRowid)

  console.log(`[历史记录] 保存记录 #${historyId}: ${data.model} ${data.mode}`)

  return historyId
}

/**
 * 获取所有历史记录
 * @param options 查询选项
 * @returns 历史记录列表
 */
export function getHistory(options?: {
  model?: 'gemini' | 'imagen'
  mode?: 'text-to-image' | 'image-to-image'
  limit?: number
  offset?: number
}): ImageHistoryItem[] {
  const db = getDb()

  let sql = `SELECT * FROM image_history WHERE 1=1`
  const params: any[] = []

  if (options?.model) {
    sql += ` AND model = ?`
    params.push(options.model)
  }

  if (options?.mode) {
    sql += ` AND mode = ?`
    params.push(options.mode)
  }

  sql += ` ORDER BY created_at DESC`

  if (options?.limit) {
    sql += ` LIMIT ?`
    params.push(options.limit)

    if (options?.offset) {
      sql += ` OFFSET ?`
      params.push(options.offset)
    }
  }

  const stmt = db.prepare(sql)
  const rows = stmt.all(...params) as any[]

  return rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    turn_number: row.turn_number,
    model: row.model,
    mode: row.mode,
    prompt: row.prompt,
    image_url: row.image_url,
    aspect_ratio: row.aspect_ratio,
    resolution: row.resolution,
    duration: row.duration,
    created_at: row.created_at
  }))
}

/**
 * 获取特定会话的所有历史记录
 * @param sessionId 会话ID
 * @returns 该会话的所有历史记录，按 turn_number 排序
 */
export function getSessionHistory(sessionId: string): ImageHistoryItem[] {
  const db = getDb()

  const stmt = db.prepare(`
    SELECT * FROM image_history
    WHERE session_id = ?
    ORDER BY turn_number ASC, created_at ASC
  `)

  const rows = stmt.all(sessionId) as any[]

  console.log(`[历史记录] 查询会话 ${sessionId} 的历史: ${rows.length} 条记录`)

  return rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    turn_number: row.turn_number,
    model: row.model,
    mode: row.mode,
    prompt: row.prompt,
    image_url: row.image_url,
    aspect_ratio: row.aspect_ratio,
    resolution: row.resolution,
    duration: row.duration,
    created_at: row.created_at
  }))
}

/**
 * 获取按会话分组的历史记录
 * @param limit 限制返回的会话数量
 * @returns 按会话分组的历史记录
 */
export function getHistoryGroupedBySession(limit: number = 20): {
  session_id: string | null
  model: string
  mode: string
  total_turns: number
  first_prompt: string
  last_image_url: string
  created_at: number
  updated_at: number
  items: ImageHistoryItem[]
}[] {
  const db = getDb()

  // 先获取每个会话的汇总信息
  const summaryStmt = db.prepare(`
    SELECT
      session_id,
      model,
      mode,
      COUNT(*) as total_turns,
      MIN(prompt) as first_prompt,
      MAX(image_url) as last_image_url,
      MIN(created_at) as created_at,
      MAX(created_at) as updated_at
    FROM image_history
    GROUP BY session_id
    ORDER BY updated_at DESC
    LIMIT ?
  `)

  const summaries = summaryStmt.all(limit) as any[]

  // 为每个会话获取详细记录
  const result = summaries.map(summary => {
    let items: ImageHistoryItem[] = []

    if (summary.session_id) {
      items = getSessionHistory(summary.session_id)
    } else {
      // 无会话ID的记录（独立生成）
      const itemStmt = db.prepare(`
        SELECT * FROM image_history
        WHERE session_id IS NULL AND model = ? AND mode = ?
        ORDER BY created_at DESC
      `)
      const rows = itemStmt.all(summary.model, summary.mode) as any[]
      items = rows.map(row => ({
        id: row.id,
        session_id: row.session_id,
        turn_number: row.turn_number,
        model: row.model,
        mode: row.mode,
        prompt: row.prompt,
        image_url: row.image_url,
        aspect_ratio: row.aspect_ratio,
        resolution: row.resolution,
        duration: row.duration,
        created_at: row.created_at
      }))
    }

    return {
      session_id: summary.session_id,
      model: summary.model,
      mode: summary.mode,
      total_turns: summary.total_turns,
      first_prompt: summary.first_prompt,
      last_image_url: summary.last_image_url,
      created_at: summary.created_at,
      updated_at: summary.updated_at,
      items
    }
  })

  console.log(`[历史记录] 查询分组历史: ${result.length} 个会话`)

  return result
}

/**
 * 删除单条历史记录
 * @param id 历史记录ID
 * @returns 是否删除成功
 */
export function deleteHistory(id: number): boolean {
  const db = getDb()

  // 先获取记录信息以便删除图片文件
  const selectStmt = db.prepare(`
    SELECT image_url FROM image_history WHERE id = ?
  `)
  const record = selectStmt.get(id) as any

  if (!record) {
    console.log(`[历史记录] 记录不存在: ${id}`)
    return false
  }

  // 删除数据库记录
  const deleteStmt = db.prepare(`
    DELETE FROM image_history WHERE id = ?
  `)
  const result = deleteStmt.run(id)

  const success = result.changes > 0

  if (success) {
    console.log(`[历史记录] 删除记录 #${id}`)
    // TODO: 删除图片文件
    // 可以在这里添加文件删除逻辑
  }

  return success
}

/**
 * 删除特定会话的所有历史记录
 * @param sessionId 会话ID
 * @returns 删除的记录数量
 */
export function deleteSessionHistory(sessionId: string): number {
  const db = getDb()

  // 先获取所有记录以便删除图片文件
  const records = getSessionHistory(sessionId)

  // 删除数据库记录
  const stmt = db.prepare(`
    DELETE FROM image_history WHERE session_id = ?
  `)
  const result = stmt.run(sessionId)

  const deletedCount = result.changes

  if (deletedCount > 0) {
    console.log(`[历史记录] 删除会话 ${sessionId} 的 ${deletedCount} 条记录`)
    // TODO: 删除图片文件
    // 可以遍历 records 删除对应的图片文件
  }

  return deletedCount
}

/**
 * 清理超过指定天数的历史记录
 * @param days 保留天数，默认30天
 * @returns 清理的记录数量
 */
export function cleanupOldHistory(days: number = 30): number {
  const db = getDb()
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

  // 先查询要删除的记录
  const selectStmt = db.prepare(`
    SELECT id, image_url FROM image_history
    WHERE created_at < ?
  `)
  const oldRecords = selectStmt.all(cutoffTime) as any[]

  if (oldRecords.length === 0) {
    console.log('[历史记录] 没有需要清理的旧记录')
    return 0
  }

  // 删除记录
  const deleteStmt = db.prepare(`
    DELETE FROM image_history WHERE created_at < ?
  `)
  const result = deleteStmt.run(cutoffTime)

  const deletedCount = result.changes

  console.log(`[历史记录] 清理了 ${deletedCount} 条超过 ${days} 天的记录`)

  // TODO: 删除图片文件
  // 可以遍历 oldRecords 删除对应的图片文件

  return deletedCount
}

/**
 * 获取历史记录统计信息
 * @returns 统计数据
 */
export function getHistoryStats(): {
  total: number
  byModel: { model: string; count: number }[]
  byMode: { mode: string; count: number }[]
  sessionsWithHistory: number
  standaloneGenerations: number
} {
  const db = getDb()

  // 总记录数
  const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM image_history`)
  const totalResult = totalStmt.get() as any
  const total = totalResult.count

  // 按模型统计
  const byModelStmt = db.prepare(`
    SELECT model, COUNT(*) as count
    FROM image_history
    GROUP BY model
  `)
  const byModel = byModelStmt.all() as any[]

  // 按模式统计
  const byModeStmt = db.prepare(`
    SELECT mode, COUNT(*) as count
    FROM image_history
    GROUP BY mode
  `)
  const byMode = byModeStmt.all() as any[]

  // 有会话ID的记录数（多轮对话）
  const sessionsStmt = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count
    FROM image_history
    WHERE session_id IS NOT NULL
  `)
  const sessionsResult = sessionsStmt.get() as any
  const sessionsWithHistory = sessionsResult.count

  // 无会话ID的记录数（独立生成）
  const standaloneStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM image_history
    WHERE session_id IS NULL
  `)
  const standaloneResult = standaloneStmt.get() as any
  const standaloneGenerations = standaloneResult.count

  return {
    total,
    byModel,
    byMode,
    sessionsWithHistory,
    standaloneGenerations
  }
}
