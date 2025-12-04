# 代码模板

## 1. imageSession.ts 完整代码

```typescript
// lib/imageSession.ts
import { getDb } from './db'
import { randomUUID } from 'crypto'

export interface ImageSession {
  id: number
  session_id: string
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  conversation_history: string | null
  last_image_url: string | null
  created_at: number
  updated_at: number
  expires_at: number
}

/**
 * 创建新会话
 */
export function createSession(
  model: 'gemini' | 'imagen',
  mode: 'text-to-image' | 'image-to-image'
): ImageSession {
  const db = getDb()
  const sessionId = randomUUID()
  const now = Date.now()
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000 // 30 天后

  const result = db.prepare(`
    INSERT INTO image_sessions (
      session_id, model, mode, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, model, mode, now, now, expiresAt)

  return {
    id: result.lastInsertRowid as number,
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
 * 加载会话（验证未过期）
 */
export function loadSession(sessionId: string): ImageSession | null {
  const db = getDb()
  const now = Date.now()

  const session = db.prepare(`
    SELECT * FROM image_sessions
    WHERE session_id = ? AND expires_at > ?
  `).get(sessionId, now) as ImageSession | undefined

  return session || null
}

/**
 * 更新会话
 */
export function updateSession(
  sessionId: string,
  updates: {
    conversation_history?: string
    last_image_url?: string
    updated_at: number
  }
): void {
  const db = getDb()

  const setParts: string[] = []
  const values: any[] = []

  if (updates.conversation_history !== undefined) {
    setParts.push('conversation_history = ?')
    values.push(updates.conversation_history)
  }
  if (updates.last_image_url !== undefined) {
    setParts.push('last_image_url = ?')
    values.push(updates.last_image_url)
  }
  setParts.push('updated_at = ?')
  values.push(updates.updated_at)

  values.push(sessionId)

  db.prepare(`
    UPDATE image_sessions
    SET ${setParts.join(', ')}
    WHERE session_id = ?
  `).run(...values)
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM image_sessions WHERE session_id = ?').run(sessionId)
}

/**
 * 清理过期会话（返回被删除的会话 ID）
 */
export function cleanupExpiredSessions(): string[] {
  const db = getDb()
  const now = Date.now()

  const expiredSessions = db.prepare(`
    SELECT session_id FROM image_sessions WHERE expires_at <= ?
  `).all(now) as Array<{ session_id: string }>

  db.prepare(`
    DELETE FROM image_sessions WHERE expires_at <= ?
  `).run(now)

  return expiredSessions.map(s => s.session_id)
}

/**
 * 获取所有会话列表
 */
export function getAllSessions(limit: number = 50): ImageSession[] {
  const db = getDb()
  const now = Date.now()

  return db.prepare(`
    SELECT * FROM image_sessions
    WHERE expires_at > ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(now, limit) as ImageSession[]
}
```

---

## 2. imageHistory.ts 完整代码

```typescript
// lib/imageHistory.ts
import { getDb } from './db'

export interface ImageHistory {
  id: number
  session_id: string | null
  turn_number: number
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  image_url: string
  aspect_ratio: string | null
  resolution: string | null
  duration: number | null
  created_at: number
}

/**
 * 保存历史记录
 */
export function saveHistory(data: Omit<ImageHistory, 'id'>): number {
  const db = getDb()

  const result = db.prepare(`
    INSERT INTO image_history (
      session_id, turn_number, model, mode, prompt,
      image_url, aspect_ratio, resolution, duration, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.session_id,
    data.turn_number,
    data.model,
    data.mode,
    data.prompt,
    data.image_url,
    data.aspect_ratio,
    data.resolution,
    data.duration,
    data.created_at
  )

  return result.lastInsertRowid as number
}

/**
 * 获取历史记录列表
 */
export function getHistory(options: {
  limit?: number
  model?: 'gemini' | 'imagen'
  mode?: 'text-to-image' | 'image-to-image'
}): ImageHistory[] {
  const db = getDb()
  const { limit = 50, model, mode } = options

  let query = 'SELECT * FROM image_history WHERE 1=1'
  const params: any[] = []

  if (model) {
    query += ' AND model = ?'
    params.push(model)
  }
  if (mode) {
    query += ' AND mode = ?'
    params.push(mode)
  }

  query += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  return db.prepare(query).all(...params) as ImageHistory[]
}

/**
 * 获取会话的所有历史记录
 */
export function getSessionHistory(sessionId: string): ImageHistory[] {
  const db = getDb()

  return db.prepare(`
    SELECT * FROM image_history
    WHERE session_id = ?
    ORDER BY turn_number ASC
  `).all(sessionId) as ImageHistory[]
}

/**
 * 删除历史记录（返回图片 URL 用于删除文件）
 */
export function deleteHistory(id: number): string | null {
  const db = getDb()

  const record = db.prepare(`
    SELECT image_url FROM image_history WHERE id = ?
  `).get(id) as { image_url: string } | undefined

  if (!record) return null

  db.prepare('DELETE FROM image_history WHERE id = ?').run(id)

  return record.image_url
}

/**
 * 清理 30 天前的历史记录（返回图片 URL 列表）
 */
export function cleanupOldHistory(): string[] {
  const db = getDb()
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  const oldRecords = db.prepare(`
    SELECT image_url FROM image_history WHERE created_at < ?
  `).all(thirtyDaysAgo) as Array<{ image_url: string }>

  db.prepare(`
    DELETE FROM image_history WHERE created_at < ?
  `).run(thirtyDaysAgo)

  return oldRecords.map(r => r.image_url)
}

/**
 * 按会话分组获取历史记录
 */
export interface SessionHistoryGroup {
  sessionId: string
  model: 'gemini' | 'imagen'
  mode: 'text-to-image' | 'image-to-image'
  turnCount: number
  firstCreatedAt: number
  lastCreatedAt: number
  history: ImageHistory[]
}

export function getHistoryGroupedBySession(limit: number = 20): SessionHistoryGroup[] {
  const db = getDb()

  // 获取所有有 session_id 的历史记录
  const allHistory = db.prepare(`
    SELECT * FROM image_history
    WHERE session_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit * 5) as ImageHistory[] // 多取一些，用于分组

  // 按 session_id 分组
  const groups = new Map<string, ImageHistory[]>()

  for (const item of allHistory) {
    if (!item.session_id) continue

    if (!groups.has(item.session_id)) {
      groups.set(item.session_id, [])
    }
    groups.get(item.session_id)!.push(item)
  }

  // 转换为结果格式
  const result: SessionHistoryGroup[] = []

  for (const [sessionId, history] of groups.entries()) {
    // 按 turn_number 排序
    history.sort((a, b) => a.turn_number - b.turn_number)

    result.push({
      sessionId,
      model: history[0].model,
      mode: history[0].mode,
      turnCount: history.length,
      firstCreatedAt: history[0].created_at,
      lastCreatedAt: history[history.length - 1].created_at,
      history
    })
  }

  // 按最后创建时间倒序排列
  result.sort((a, b) => b.lastCreatedAt - a.lastCreatedAt)

  return result.slice(0, limit)
}
```

---

## 3. Gemini API 端点框架

```typescript
// app/api/imagen/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { setGlobalDispatcher, ProxyAgent } from 'undici'
import { createSession, loadSession, updateSession } from '@/lib/imageSession'
import { saveHistory } from '@/lib/imageHistory'
import fs from 'fs'
import path from 'path'

// 配置代理
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7897'
const proxyAgent = new ProxyAgent(HTTPS_PROXY)
setGlobalDispatcher(proxyAgent)

// API 配置
const GEMINI_API_KEY = process.env.GEMINI_TEXT_API_KEY || ''
const MODEL = 'gemini-3-pro-image-preview'

// 初始化客户端
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

// 请求参数类型
interface GeminiGenerateRequest {
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  sessionId?: string
  uploadedImage?: string
  aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  resolution?: '2k' | '4k'
  numberOfImages?: number
}

/**
 * 保存图片到本地
 */
async function saveImageToLocal(base64Data: string, filename: string): Promise<string> {
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Image, 'base64')

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images')
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const timestamp = Date.now()
  const filepath = path.join(uploadDir, `${timestamp}-${filename}.png`)
  fs.writeFileSync(filepath, buffer)

  return `/uploads/images/${timestamp}-${filename}.png`
}

/**
 * 从响应中提取图片
 */
function extractImages(response: any): string[] {
  const images: string[] = []

  if (response.candidates && response.candidates.length > 0) {
    for (const candidate of response.candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
            images.push(dataUrl)
          }
        }
      }
    }
  }

  return images
}

/**
 * POST /api/imagen/gemini
 * Gemini 统一生成端点（支持多轮对话）
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('=' * 80)
    console.log('[Gemini API] 收到生成请求')

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: '未配置 API Key' },
        { status: 500 }
      )
    }

    // 1. 解析请求参数
    const body: GeminiGenerateRequest = await request.json()
    const {
      mode,
      prompt,
      sessionId,
      uploadedImage,
      aspectRatio = '16:9',
      resolution = '2k',
      numberOfImages = 1
    } = body

    console.log('[Gemini API] 参数:', { mode, prompt: prompt.substring(0, 50), sessionId, aspectRatio, resolution })

    // 2. 参数验证
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: '请提供提示词' },
        { status: 400 }
      )
    }

    if (mode === 'image-to-image' && !uploadedImage) {
      return NextResponse.json(
        { success: false, error: '图生图模式需要上传图片' },
        { status: 400 }
      )
    }

    // 3. 加载或创建会话
    let session
    let turnNumber = 1

    if (sessionId) {
      console.log('[Gemini API] 加载现有会话:', sessionId)
      session = loadSession(sessionId)

      if (!session) {
        return NextResponse.json(
          { success: false, error: '会话不存在或已过期' },
          { status: 404 }
        )
      }

      // 计算轮次
      if (session.conversation_history) {
        const history = JSON.parse(session.conversation_history)
        turnNumber = Math.ceil(history.turns.length / 2) + 1
      }
    } else {
      console.log('[Gemini API] 创建新会话')
      session = createSession('gemini', mode)
    }

    // 4. 准备对话历史
    const conversationHistory = session.conversation_history
      ? JSON.parse(session.conversation_history)
      : { turns: [] }

    console.log('[Gemini API] 当前轮次:', turnNumber)
    console.log('[Gemini API] 历史轮数:', conversationHistory.turns.length)

    // 5. 创建或恢复 chat session
    const chat = genAI.models.startChat({
      model: MODEL,
      history: conversationHistory.turns  // 传入历史对话（包含 Thought Signatures）
    })

    // 6. 构建消息内容
    const messageParts = mode === 'image-to-image'
      ? [
          {
            inlineData: {
              data: uploadedImage!.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/jpeg'
            }
          },
          { text: prompt }
        ]
      : [{ text: prompt }]

    // 7. 发送消息并生成图片
    console.log('[Gemini API] 调用 Gemini 生成...')

    const result = await chat.sendMessage({
      parts: messageParts,
      config: {
        temperature: 0.7,
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize: resolution === '4k' ? '4K' : '2K'
        }
      }
    })

    console.log('[Gemini API] 生成成功')

    // 8. 提取并保存图片
    const images = extractImages(result)

    if (images.length === 0) {
      throw new Error('未生成任何图片')
    }

    const savedUrls: string[] = []
    for (let i = 0; i < images.length; i++) {
      const filename = `gemini-${session.session_id}-turn${turnNumber}-${i}`
      const url = await saveImageToLocal(images[i], filename)
      savedUrls.push(url)
    }

    console.log('[Gemini API] 保存了', savedUrls.length, '张图片')

    // 9. 更新会话历史（包含 Thought Signatures）
    conversationHistory.turns = chat.getHistory()

    await updateSession(session.session_id, {
      conversation_history: JSON.stringify(conversationHistory),
      last_image_url: savedUrls[0],
      updated_at: Date.now()
    })

    console.log('[Gemini API] 会话已更新')

    // 10. 保存到历史记录
    await saveHistory({
      session_id: session.session_id,
      turn_number: turnNumber,
      model: 'gemini',
      mode,
      prompt,
      image_url: savedUrls[0],
      aspect_ratio: aspectRatio,
      resolution,
      duration: Date.now() - startTime,
      created_at: Date.now()
    })

    console.log('[Gemini API] 历史记录已保存')

    // 11. 返回响应
    const duration = Date.now() - startTime
    console.log('[Gemini API] 完成，耗时:', duration + 'ms')
    console.log('=' * 80)

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.session_id,
        turnNumber,
        images: savedUrls,
        prompt,
        model: MODEL,
        duration,
        canContinue: true  // Gemini 支持继续编辑
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Gemini API] 错误:', error)
    console.log('[Gemini API] 失败耗时:', duration + 'ms')
    console.log('=' * 80)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成失败'
      },
      { status: 500 }
    )
  }
}
```

---

## 4. 会话管理 API

```typescript
// app/api/imagen/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { loadSession, deleteSession } from '@/lib/imageSession'
import { getSessionHistory } from '@/lib/imageHistory'

/**
 * GET /api/imagen/sessions/:id
 * 获取会话详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id
    const session = loadSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { success: false, error: '会话不存在或已过期' },
        { status: 404 }
      )
    }

    // 获取该会话的历史记录
    const history = getSessionHistory(sessionId)

    return NextResponse.json({
      success: true,
      session: {
        sessionId: session.session_id,
        model: session.model,
        mode: session.mode,
        lastImageUrl: session.last_image_url,
        turnCount: history.length,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at
      },
      history
    })

  } catch (error) {
    console.error('[Session API] 错误:', error)
    return NextResponse.json(
      { success: false, error: '获取会话失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/imagen/sessions/:id
 * 删除会话
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id

    // 删除会话（历史记录会自动级联删除）
    deleteSession(sessionId)

    return NextResponse.json({
      success: true,
      message: '会话已删除'
    })

  } catch (error) {
    console.error('[Session API] 错误:', error)
    return NextResponse.json(
      { success: false, error: '删除会话失败' },
      { status: 500 }
    )
  }
}
```

---

## 5. 历史记录 API

```typescript
// app/api/imagen/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getHistory, getHistoryGroupedBySession } from '@/lib/imageHistory'

/**
 * GET /api/imagen/history
 * 获取历史记录列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const model = searchParams.get('model') as 'gemini' | 'imagen' | null
    const mode = searchParams.get('mode') as 'text-to-image' | 'image-to-image' | null
    const grouped = searchParams.get('grouped') === 'true'

    let history

    if (grouped) {
      // 按会话分组
      history = getHistoryGroupedBySession(limit)
    } else {
      // 普通列表
      history = getHistory({
        limit,
        model: model || undefined,
        mode: mode || undefined
      })
    }

    return NextResponse.json({
      success: true,
      history
    })

  } catch (error) {
    console.error('[History API] 错误:', error)
    return NextResponse.json(
      { success: false, error: '获取历史失败' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/imagen/history/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { deleteHistory } from '@/lib/imageHistory'
import fs from 'fs'
import path from 'path'

/**
 * DELETE /api/imagen/history/:id
 * 删除历史记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const imageUrl = deleteHistory(id)

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: '记录不存在' },
        { status: 404 }
      )
    }

    // 删除图片文件
    try {
      const filepath = path.join(process.cwd(), 'public', imageUrl)
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
      }
    } catch (err) {
      console.error('[History API] 删除文件失败:', err)
    }

    return NextResponse.json({
      success: true,
      message: '记录已删除'
    })

  } catch (error) {
    console.error('[History API] 错误:', error)
    return NextResponse.json(
      { success: false, error: '删除记录失败' },
      { status: 500 }
    )
  }
}
```

---

## 6. 前端组件模板

```tsx
// app/image-generate/page.tsx (部分代码)

// 新增状态
const [model, setModel] = useState<'gemini' | 'imagen'>('gemini')
const [currentSession, setCurrentSession] = useState<{
  sessionId: string
  turnNumber: number
} | null>(null)
const [showHistory, setShowHistory] = useState(false)
const [history, setHistory] = useState<any[]>([])

// 生成图片（修改后）
const handleGenerate = async () => {
  // ... 验证参数 ...

  try {
    setIsGenerating(true)

    // 选择端点
    const endpoint = model === 'gemini' ? '/api/imagen/gemini' : '/api/imagen/imagen'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: uploadedImage ? 'image-to-image' : 'text-to-image',
        prompt,
        sessionId: currentSession?.sessionId,  // 传入会话 ID
        uploadedImage,
        aspectRatio,
        resolution
      })
    })

    const data = await response.json()

    if (data.success) {
      // 保存会话信息
      if (data.data.sessionId) {
        setCurrentSession({
          sessionId: data.data.sessionId,
          turnNumber: data.data.turnNumber
        })
      }

      setResult(data.data)
    } else {
      setError(data.error)
    }

  } finally {
    setIsGenerating(false)
  }
}

// 继续编辑
const handleContinueEditing = () => {
  // 保持 currentSession，用户输入新提示词后再次生成
  setPrompt('')
  // 可选：切换到一个"编辑模式"UI
}

// 从历史记录继续
const continueFromHistory = (item: any) => {
  setCurrentSession({
    sessionId: item.sessionId,
    turnNumber: item.turnNumber
  })
  setModel(item.model)
  setPrompt('')
  setShowHistory(false)
}

// 加载历史记录
const loadHistory = async () => {
  const response = await fetch('/api/imagen/history?grouped=true&limit=20')
  const data = await response.json()
  if (data.success) {
    setHistory(data.history)
  }
}

// UI 渲染
<>
  {/* 模型选择 */}
  <div className="flex gap-2">
    <button
      onClick={() => setModel('gemini')}
      className={model === 'gemini' ? 'active' : ''}
    >
      Gemini（支持多轮编辑）
    </button>
    <button
      onClick={() => setModel('imagen')}
      className={model === 'imagen' ? 'active' : ''}
    >
      Imagen（独立生成）
    </button>
  </div>

  {/* 会话信息 */}
  {currentSession && (
    <div className="session-card">
      <p>第 {currentSession.turnNumber} 轮编辑</p>
      <p>会话: {currentSession.sessionId.slice(0, 8)}...</p>
      {model === 'gemini' && (
        <button onClick={handleContinueEditing}>
          继续编辑
        </button>
      )}
    </div>
  )}

  {/* 历史记录按钮 */}
  <button onClick={() => { loadHistory(); setShowHistory(true); }}>
    查看历史
  </button>

  {/* 历史记录抽屉 */}
  {showHistory && (
    <div className="history-drawer">
      {history.map(session => (
        <div key={session.sessionId}>
          <h3>会话 {session.sessionId.slice(0, 8)}</h3>
          <p>{session.turnCount} 轮编辑</p>
          {session.history.map((item: any) => (
            <div key={item.id}>
              <img src={item.imageUrl} />
              <p>第 {item.turnNumber} 轮: {item.prompt}</p>
              <button onClick={() => continueFromHistory(item)}>
                从这里继续
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )}
</>
```

---

## 使用说明

1. 复制对应文件的完整代码到项目中
2. 根据实际需求调整参数和逻辑
3. 测试各个功能点
4. 逐步完善 UI 和错误处理

完整设计文档请参考：`docs/IMAGE_GENERATION_REFACTOR.md`
