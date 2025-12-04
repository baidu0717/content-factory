import { getDb } from './db'
import { randomUUID } from 'crypto'

/**
 * 图片生成会话数据结构
 */
export interface ImageSession {
  id: number
  session_id: string
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  conversation_history: any[] | null  // JSON 数组，包含对话历史和 Thought Signatures
  last_image_url: string | null
  created_at: number
  updated_at: number
  expires_at: number
}

/**
 * 创建新的图片生成会话
 * @param model 使用的模型 (gemini 或 imagen)
 * @param mode 生成模式 (text-to-image 或 image-to-image)
 * @returns 新创建的会话对象
 */
export function createSession(
  model: 'gemini' | 'imagen',
  mode: 'text-to-image' | 'image-to-image'
): ImageSession {
  const db = getDb()
  const sessionId = randomUUID()
  const now = Date.now()
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000 // 30天后过期

  const stmt = db.prepare(`
    INSERT INTO image_sessions (
      session_id, model, mode, conversation_history,
      last_image_url, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    sessionId,
    model,
    mode,
    null,  // 初始没有对话历史
    null,  // 初始没有图片
    now,
    now,
    expiresAt
  )

  console.log(`[会话管理] 创建新会话: ${sessionId} (${model}, ${mode})`)

  return {
    id: Number(result.lastInsertRowid),
    session_id: sessionId,
    model,
    mode,
    conversation_history: null,
    last_image_url: null,
    created_at: now,
    updated_at: now,
    expires_at: expiresAt
  }
}

/**
 * 根据 session_id 加载会话
 * @param sessionId 会话ID
 * @returns 会话对象，如果不存在或已过期返回 null
 */
export function loadSession(sessionId: string): ImageSession | null {
  const db = getDb()
  const now = Date.now()

  const stmt = db.prepare(`
    SELECT * FROM image_sessions
    WHERE session_id = ? AND expires_at > ?
  `)

  const row = stmt.get(sessionId, now) as any

  if (!row) {
    console.log(`[会话管理] 会话不存在或已过期: ${sessionId}`)
    return null
  }

  // 解析 conversation_history
  let conversationHistory = null
  if (row.conversation_history) {
    try {
      conversationHistory = JSON.parse(row.conversation_history)
    } catch (error) {
      console.error('[会话管理] 解析对话历史失败:', error)
      conversationHistory = null
    }
  }

  console.log(`[会话管理] 加载会话: ${sessionId}`)

  return {
    id: row.id,
    session_id: row.session_id,
    model: row.model,
    mode: row.mode,
    conversation_history: conversationHistory,
    last_image_url: row.last_image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at
  }
}

/**
 * 更新会话信息
 * @param sessionId 会话ID
 * @param updates 要更新的字段
 * @returns 是否更新成功
 */
export function updateSession(
  sessionId: string,
  updates: {
    conversation_history?: any[]
    last_image_url?: string
  }
): boolean {
  const db = getDb()
  const now = Date.now()

  // 构建动态更新语句
  const fields: string[] = []
  const values: any[] = []

  if (updates.conversation_history !== undefined) {
    fields.push('conversation_history = ?')
    values.push(JSON.stringify(updates.conversation_history))
  }

  if (updates.last_image_url !== undefined) {
    fields.push('last_image_url = ?')
    values.push(updates.last_image_url)
  }

  if (fields.length === 0) {
    console.log('[会话管理] 没有要更新的字段')
    return false
  }

  // 总是更新 updated_at
  fields.push('updated_at = ?')
  values.push(now)

  // 添加 WHERE 条件参数
  values.push(sessionId)

  const sql = `
    UPDATE image_sessions
    SET ${fields.join(', ')}
    WHERE session_id = ?
  `

  const stmt = db.prepare(sql)
  const result = stmt.run(...values)

  const success = result.changes > 0

  if (success) {
    console.log(`[会话管理] 更新会话: ${sessionId}`)
  } else {
    console.log(`[会话管理] 会话不存在，无法更新: ${sessionId}`)
  }

  return success
}

/**
 * 删除会话（同时会级联删除关联的历史记录）
 * @param sessionId 会话ID
 * @returns 是否删除成功
 */
export function deleteSession(sessionId: string): boolean {
  const db = getDb()

  const stmt = db.prepare(`
    DELETE FROM image_sessions
    WHERE session_id = ?
  `)

  const result = stmt.run(sessionId)
  const success = result.changes > 0

  if (success) {
    console.log(`[会话管理] 删除会话: ${sessionId}`)
  }

  return success
}

/**
 * 清理过期的会话（同时会级联删除关联的历史记录和图片文件）
 * @returns 清理的会话数量
 */
export function cleanupExpiredSessions(): number {
  const db = getDb()
  const now = Date.now()

  // 先查询过期的会话，以便删除图片文件
  const selectStmt = db.prepare(`
    SELECT session_id, last_image_url FROM image_sessions
    WHERE expires_at <= ?
  `)

  const expiredSessions = selectStmt.all(now) as any[]

  if (expiredSessions.length === 0) {
    console.log('[会话管理] 没有过期的会话需要清理')
    return 0
  }

  // 删除过期会话（数据库会级联删除历史记录）
  const deleteStmt = db.prepare(`
    DELETE FROM image_sessions
    WHERE expires_at <= ?
  `)

  const result = deleteStmt.run(now)
  const deletedCount = result.changes

  console.log(`[会话管理] 清理了 ${deletedCount} 个过期会话`)

  // TODO: 删除关联的图片文件
  // 需要遍历 expiredSessions 和关联的历史记录，删除物理文件
  // 这部分可以在后续实现

  return deletedCount
}

/**
 * 获取会话的详细信息（包含历史记录数量）
 * @param sessionId 会话ID
 * @returns 会话详情，如果不存在返回 null
 */
export function getSessionDetails(sessionId: string): {
  session: ImageSession
  historyCount: number
} | null {
  const session = loadSession(sessionId)
  if (!session) {
    return null
  }

  const db = getDb()
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM image_history
    WHERE session_id = ?
  `)

  const result = stmt.get(sessionId) as any
  const historyCount = result?.count || 0

  return {
    session,
    historyCount
  }
}

/**
 * 列出所有活跃的会话
 * @param model 可选，按模型筛选
 * @param limit 可选，限制返回数量
 * @returns 会话列表
 */
export function listActiveSessions(
  model?: 'gemini' | 'imagen',
  limit: number = 50
): ImageSession[] {
  const db = getDb()
  const now = Date.now()

  let sql = `
    SELECT * FROM image_sessions
    WHERE expires_at > ?
  `
  const params: any[] = [now]

  if (model) {
    sql += ` AND model = ?`
    params.push(model)
  }

  sql += ` ORDER BY updated_at DESC LIMIT ?`
  params.push(limit)

  const stmt = db.prepare(sql)
  const rows = stmt.all(...params) as any[]

  return rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    model: row.model,
    mode: row.mode,
    conversation_history: row.conversation_history ? JSON.parse(row.conversation_history) : null,
    last_image_url: row.last_image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at
  }))
}
