import Database from 'better-sqlite3'
import path from 'path'

// 获取数据库路径
const DB_PATH = path.join(process.cwd(), 'data', 'app.db')

// 初始化数据库连接
let db: Database.Database | null = null

export function getDb() {
  if (!db) {
    // 确保数据目录存在
    const fs = require('fs')
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')

    // 初始化表结构
    initTables()
  }
  return db
}

// 初始化数据库表
function initTables() {
  if (!db) return

  // 创建搜索历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('wechat', 'xiaohongshu')),
      timestamp INTEGER NOT NULL,
      result_count INTEGER DEFAULT 0,
      articles_data TEXT,
      api_response TEXT,
      ai_insights TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 为已存在的表添加 ai_insights 字段（如果不存在）
  try {
    db.exec(`
      ALTER TABLE search_history
      ADD COLUMN ai_insights TEXT
    `)
    console.log('✅ 已添加 ai_insights 字段到 search_history 表')
  } catch (error) {
    // 字段已存在时会抛出错误，忽略即可
    // console.log('ai_insights 字段已存在')
  }

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_timestamp
    ON search_history(timestamp DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_platform
    ON search_history(platform)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_keyword
    ON search_history(keyword)
  `)

  // 创建文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_review', 'published', 'failed')),
      platforms TEXT DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'ai_generated' CHECK(source IN ('ai_generated', 'imported', 'custom')),
      created_at INTEGER NOT NULL,
      published_at INTEGER,
      stats TEXT,
      tags TEXT DEFAULT '[]',
      error TEXT,
      word_count INTEGER,
      reading_time INTEGER,
      images TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建文章表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_created_at
    ON articles(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_status
    ON articles(status)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_source
    ON articles(source)
  `)

  // 创建飞书笔记记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS feishu_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      url TEXT NOT NULL,
      tags TEXT,
      images TEXT,
      rewrite_status TEXT DEFAULT 'pending' CHECK(rewrite_status IN ('pending', 'done', 'skip')),
      created_at INTEGER NOT NULL,
      rewritten_at INTEGER,
      article_id INTEGER
    )
  `)

  // 创建飞书笔记表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feishu_notes_created_at
    ON feishu_notes(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feishu_notes_status
    ON feishu_notes(rewrite_status)
  `)

  // 创建监控关键词表
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('wechat', 'xiaohongshu')),
      enabled INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
      last_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // 创建监控关键词索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_monitored_keywords_enabled
    ON monitored_keywords(enabled)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_monitored_keywords_platform
    ON monitored_keywords(platform)
  `)

  // 创建定时报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword_id INTEGER,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('wechat', 'xiaohongshu')),
      analysis_result TEXT,
      feishu_pushed INTEGER DEFAULT 0 CHECK(feishu_pushed IN (0, 1)),
      feishu_push_at INTEGER,
      feishu_response TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (keyword_id) REFERENCES monitored_keywords(id) ON DELETE SET NULL
    )
  `)

  // 创建定时报告索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_at
    ON scheduled_reports(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_keyword_id
    ON scheduled_reports(keyword_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_platform
    ON scheduled_reports(platform)
  `)

  // 创建系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at INTEGER NOT NULL
    )
  `)

  // 初始化飞书 Webhook 设置
  const checkFeishuWebhook = db.prepare('SELECT * FROM system_settings WHERE key = ?').get('feishu_webhook')
  if (!checkFeishuWebhook) {
    db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'feishu_webhook',
      'https://open.feishu.cn/open-apis/bot/v2/hook/a6d38d40-9f30-4996-ab6f-cd1ab8c1b058',
      Date.now()
    )
  }

  // 初始化定时执行时间设置（默认早上8点）
  const checkCronTime = db.prepare('SELECT * FROM system_settings WHERE key = ?').get('cron_time')
  if (!checkCronTime) {
    db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      'cron_time',
      '0 8 * * *', // 每天早上8点
      Date.now()
    )
  }

  // 创建图片生成会话表（用于多轮对话）
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL CHECK(model IN ('gemini', 'imagen')),
      mode TEXT NOT NULL CHECK(mode IN ('text-to-image', 'image-to-image')),
      conversation_history TEXT,
      last_image_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `)

  // 创建会话表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_sessions_session_id
    ON image_sessions(session_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_sessions_expires_at
    ON image_sessions(expires_at)
  `)

  // 创建图片历史记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      turn_number INTEGER NOT NULL DEFAULT 1,
      model TEXT NOT NULL CHECK(model IN ('gemini', 'imagen')),
      mode TEXT NOT NULL CHECK(mode IN ('text-to-image', 'image-to-image')),
      prompt TEXT NOT NULL,
      image_url TEXT NOT NULL,
      aspect_ratio TEXT,
      resolution TEXT,
      duration INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES image_sessions(session_id) ON DELETE CASCADE
    )
  `)

  // 创建历史记录表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_history_session_id
    ON image_history(session_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_history_created_at
    ON image_history(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_image_history_model
    ON image_history(model)
  `)

  console.log('✅ 数据库表初始化完成')
}

// 关闭数据库连接
export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
