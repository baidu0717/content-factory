# 图片生成功能重构设计文档

## 📋 目录
1. [需求概述](#需求概述)
2. [技术调研结果](#技术调研结果)
3. [架构设计](#架构设计)
4. [数据库设计](#数据库设计)
5. [API 接口设计](#api-接口设计)
6. [实现步骤](#实现步骤)
7. [前端 UI 设计](#前端-ui-设计)
8. [代码示例](#代码示例)

---

## 需求概述

### 需求 1：上下文生图（多轮对话）
- 用户可以在上一次生成的图片基础上继续修改
- 保持对话上下文，实现迭代编辑
- 仅 Gemini 3 Pro Image 支持此功能

### 需求 2：历史记录
- 记录每次生成的图片
- 显示同一会话的多轮编辑历史
- 支持从历史记录继续编辑
- 30 天自动清理

---

## 技术调研结果

### ✅ Gemini 3 Pro Image
- **完全支持**多轮对话和迭代编辑
- 通过 **Thought Signatures** 保持上下文
- 官方 SDK 自动处理 Thought Signatures
- 支持：文本生图 + 图生图

**参考文档**：
- [Gemini 3 Pro Image Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
- [Image Generation with Gemini](https://ai.google.dev/gemini-api/docs/image-generation)

### ✅ Imagen 4
- 支持 **mask-free editing**（无需 mask 的图生图）
- **不支持**多轮对话（每次独立生成）
- 支持：文本生图 + 图生图（mask-free）

**参考文档**：
- [Imagen Mask-Free Editing](https://cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-imagen-edit-image-mask-free)
- [Edit Images with Imagen](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api-edit)

---

## 架构设计

### 当前架构问题
- 有 3 个独立端点：`/api/imagen/generate`、`/api/imagen/edit`
- 创意模式、云旅游模式、图生图模式分开
- 代码重复，不利于维护

### 优化后架构

**2 个统一端点**：

#### 1. Gemini 端点：`/api/imagen/gemini`
```
功能：
  - 文本生图（原云旅游模式）
  - 图生图（原图生图模式）
  - ✨ 多轮对话上下文编辑（新功能）

特点：
  - 带联网功能
  - 支持实时信息查询
  - 支持迭代编辑
```

#### 2. Imagen 端点：`/api/imagen/imagen`
```
功能：
  - 文本生图（原创意模式）
  - 图生图（mask-free editing）
  - ❌ 不支持多轮对话

特点：
  - 速度快
  - 质量高
  - 每次独立生成
```

---

## 数据库设计

### 表 1：image_sessions（会话表）

用于存储多轮对话的会话信息。

```sql
CREATE TABLE image_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,           -- UUID 格式的会话 ID
  model TEXT NOT NULL CHECK(model IN ('gemini', 'imagen')),  -- 使用的模型
  mode TEXT NOT NULL CHECK(mode IN ('text-to-image', 'image-to-image')),  -- 生成模式
  conversation_history TEXT,                  -- JSON 格式的对话历史（包含 Thought Signatures）
  last_image_url TEXT,                        -- 最后生成的图片 URL
  created_at INTEGER NOT NULL,                -- 创建时间戳
  updated_at INTEGER NOT NULL,                -- 更新时间戳
  expires_at INTEGER NOT NULL                 -- 过期时间（30 天后）
);

-- 索引
CREATE INDEX idx_image_sessions_session_id ON image_sessions(session_id);
CREATE INDEX idx_image_sessions_expires_at ON image_sessions(expires_at);
```

**字段说明**：
- `conversation_history`: 存储完整的对话历史，JSON 格式：
  ```json
  {
    "turns": [
      {
        "role": "user",
        "parts": [{"text": "生成一个日落的图片"}]
      },
      {
        "role": "model",
        "parts": [{"inlineData": {"data": "...", "mimeType": "image/png"}}],
        "thoughtSignature": "encrypted_signature_data"
      }
    ]
  }
  ```

### 表 2：image_history（历史记录表）

存储每次生成的图片记录。

```sql
CREATE TABLE image_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,                            -- 关联的会话 ID（可为空，表示单次生成）
  turn_number INTEGER NOT NULL DEFAULT 1,     -- 在会话中的轮次（1, 2, 3...）
  model TEXT NOT NULL CHECK(model IN ('gemini', 'imagen')),
  mode TEXT NOT NULL CHECK(mode IN ('text-to-image', 'image-to-image')),
  prompt TEXT NOT NULL,                       -- 用户输入的提示词
  image_url TEXT NOT NULL,                    -- 生成的图片路径
  aspect_ratio TEXT,                          -- 宽高比
  resolution TEXT,                            -- 分辨率
  duration INTEGER,                           -- 生成耗时（毫秒）
  created_at INTEGER NOT NULL,                -- 创建时间戳
  FOREIGN KEY (session_id) REFERENCES image_sessions(session_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_image_history_session_id ON image_history(session_id);
CREATE INDEX idx_image_history_created_at ON image_history(created_at DESC);
CREATE INDEX idx_image_history_model ON image_history(model);
```

---

## API 接口设计

### 1. Gemini 生成接口

**端点**: `POST /api/imagen/gemini`

**请求参数**:
```typescript
interface GeminiGenerateRequest {
  mode: 'text-to-image' | 'image-to-image'
  prompt: string                    // 提示词或编辑指令
  sessionId?: string                // 可选：会话 ID（继续编辑时提供）
  uploadedImage?: string            // 图生图模式必填：base64 图片
  aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  resolution?: '2k' | '4k'
  numberOfImages?: number           // 仅首次生成时有效
}
```

**响应**:
```typescript
interface GeminiGenerateResponse {
  success: boolean
  data?: {
    sessionId: string               // 会话 ID（用于继续编辑）
    turnNumber: number              // 当前轮次
    images: string[]                // 生成的图片 URL
    prompt: string                  // 使用的提示词
    model: 'gemini-3-pro-image-preview'
    duration: number
    canContinue: true               // Gemini 总是支持继续编辑
  }
  error?: string
}
```

**关键逻辑**:
1. 如果有 `sessionId`，从数据库加载会话历史
2. 使用 Google GenAI SDK 的 chat session 功能
3. 保存新的对话历史（包括 Thought Signatures）
4. 更新会话的 `last_image_url` 和 `updated_at`
5. 保存到历史记录表

### 2. Imagen 生成接口

**端点**: `POST /api/imagen/imagen`

**请求参数**:
```typescript
interface ImagenGenerateRequest {
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  uploadedImage?: string            // 图生图模式必填
  aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  resolution?: '2k'                 // Imagen 4 仅支持 2K
  numberOfImages?: number
}
```

**响应**:
```typescript
interface ImagenGenerateResponse {
  success: boolean
  data?: {
    sessionId: null                 // Imagen 不支持会话
    turnNumber: 1                   // 总是第一轮
    images: string[]
    prompt: string
    model: 'imagen-4.0-generate-001'
    duration: number
    canContinue: false              // Imagen 不支持继续编辑
  }
  error?: string
}
```

### 3. 会话管理接口

#### 获取会话详情
**端点**: `GET /api/imagen/sessions/:sessionId`

**响应**:
```typescript
{
  success: boolean
  session?: {
    sessionId: string
    model: 'gemini' | 'imagen'
    mode: 'text-to-image' | 'image-to-image'
    lastImageUrl: string
    turnCount: number
    createdAt: number
    updatedAt: number
    expiresAt: number
  }
}
```

#### 删除会话
**端点**: `DELETE /api/imagen/sessions/:sessionId`

### 4. 历史记录接口

#### 获取历史列表
**端点**: `GET /api/imagen/history`

**查询参数**:
- `limit`: 返回数量（默认 50）
- `model`: 筛选模型（gemini/imagen）
- `mode`: 筛选模式

**响应**:
```typescript
{
  success: boolean
  history?: Array<{
    id: number
    sessionId: string | null
    turnNumber: number
    model: 'gemini' | 'imagen'
    mode: 'text-to-image' | 'image-to-image'
    prompt: string
    imageUrl: string
    aspectRatio: string
    resolution: string
    duration: number
    createdAt: number
  }>
}
```

#### 获取会话的所有图片
**端点**: `GET /api/imagen/history/session/:sessionId`

**响应**: 同上，但只返回该会话的记录

#### 删除历史记录
**端点**: `DELETE /api/imagen/history/:id`

### 5. 清理过期数据接口

**端点**: `POST /api/imagen/cleanup`

**功能**:
- 删除 30 天前的会话
- 删除对应的历史记录
- 删除本地图片文件

---

## 实现步骤

### 阶段 1：创建 API 文件结构 ⏱️ 30分钟

```
app/api/imagen/
├── gemini/
│   └── route.ts          # 新建：Gemini 统一端点
├── imagen/
│   └── route.ts          # 新建：Imagen 统一端点
├── sessions/
│   ├── route.ts          # 新建：会话列表
│   └── [id]/
│       └── route.ts      # 新建：会话详情/删除
├── history/
│   ├── route.ts          # 新建：历史记录列表/创建
│   ├── [id]/
│   │   └── route.ts      # 新建：删除单条记录
│   └── session/
│       └── [sessionId]/
│           └── route.ts  # 新建：获取会话历史
└── cleanup/
    └── route.ts          # 新建：清理过期数据
```

### 阶段 2：实现 Gemini 端点核心逻辑 ⏱️ 2-3小时

**文件**: `app/api/imagen/gemini/route.ts`

**核心流程**:
```typescript
// 1. 解析请求参数
const { mode, prompt, sessionId, uploadedImage, aspectRatio, resolution } = body

// 2. 加载或创建会话
let session
if (sessionId) {
  // 加载现有会话
  session = await loadSession(sessionId)
  if (!session) throw new Error('会话不存在或已过期')
} else {
  // 创建新会话
  session = await createSession('gemini', mode)
}

// 3. 构建对话历史
const conversationHistory = session.conversation_history
  ? JSON.parse(session.conversation_history)
  : { turns: [] }

// 4. 调用 Gemini API（使用 chat session）
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
const chat = genAI.models.startChat({
  model: 'gemini-3-pro-image-preview',
  history: conversationHistory.turns  // 传入历史
})

// 5. 发送新消息
const result = await chat.sendMessage({
  parts: mode === 'image-to-image'
    ? [
        { inlineData: { data: uploadedImage, mimeType: 'image/jpeg' } },
        { text: prompt }
      ]
    : [{ text: prompt }],
  config: {
    responseModalities: ['IMAGE'],
    imageConfig: {
      aspectRatio,
      imageSize: resolution === '4k' ? '4K' : '2K'
    }
  }
})

// 6. 提取图片和更新历史
const images = extractImages(result)
conversationHistory.turns.push(...chat.getHistory())

// 7. 保存会话和历史记录
await updateSession(session.session_id, {
  conversation_history: JSON.stringify(conversationHistory),
  last_image_url: images[0],
  updated_at: Date.now()
})

await saveToHistory({
  session_id: session.session_id,
  turn_number: conversationHistory.turns.length / 2,
  model: 'gemini',
  mode,
  prompt,
  image_url: images[0],
  // ...
})

// 8. 返回响应
return { sessionId: session.session_id, images, ... }
```

### 阶段 3：实现 Imagen 端点 ⏱️ 1-2小时

**文件**: `app/api/imagen/imagen/route.ts`

**mask-free editing 实现**:
```typescript
if (mode === 'image-to-image') {
  // Imagen 4 的 mask-free editing
  const response = await imageAI.models.editImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    referenceImage: {
      imageBytes: uploadedImage  // base64
    },
    config: {
      editMode: 'MASK_FREE',
      numberOfImages: 1,
      aspectRatio,
      imageSize: '2K'
    }
  })
}
```

**注意**: 每次都是独立生成，不保存会话。

### 阶段 4：实现辅助 API ⏱️ 1-2小时

**会话管理、历史记录、清理功能**

参考标准 CRUD 实现即可。

### 阶段 5：前端 UI 改造 ⏱️ 2-3小时

详见下一节。

---

## 前端 UI 设计

### 页面结构调整

```
app/image-generate/page.tsx
├── 模型选择（Gemini / Imagen）
├── 模式选择（文本生图 / 图生图）
├── 提示词输入
├── 参数设置
├── [新增] 会话管理区域
│   ├── 当前会话信息
│   ├── 轮次显示
│   └── "继续编辑" 按钮
├── 生成按钮
├── 结果展示
└── [新增] 历史记录抽屉
    ├── 按会话分组
    ├── 时间线展示
    └── 操作按钮（继续编辑/下载/删除）
```

### 关键组件

#### 1. 会话卡片
```tsx
<SessionCard>
  <Badge>第 {turnNumber} 轮</Badge>
  <p>会话 ID: {sessionId.slice(0, 8)}...</p>
  <p>创建时间: {formatDate(createdAt)}</p>
  {canContinue && (
    <Button onClick={continueEditing}>
      继续编辑
    </Button>
  )}
</SessionCard>
```

#### 2. 历史记录时间线
```tsx
<HistoryTimeline>
  {sessions.map(session => (
    <SessionGroup key={session.id}>
      <SessionHeader>
        会话 {session.sessionId.slice(0, 8)}
        <span>{session.turnCount} 轮编辑</span>
      </SessionHeader>
      {session.history.map((item, index) => (
        <HistoryItem key={item.id}>
          <TurnBadge>第 {index + 1} 轮</TurnBadge>
          <Image src={item.imageUrl} />
          <Prompt>{item.prompt}</Prompt>
          <Actions>
            <Button onClick={() => continueFrom(item)}>
              从这里继续
            </Button>
            <Button onClick={() => download(item)}>
              下载
            </Button>
          </Actions>
        </HistoryItem>
      ))}
    </SessionGroup>
  ))}
</HistoryTimeline>
```

### 状态管理

```typescript
const [model, setModel] = useState<'gemini' | 'imagen'>('gemini')
const [mode, setMode] = useState<'text-to-image' | 'image-to-image'>('text-to-image')
const [currentSession, setCurrentSession] = useState<Session | null>(null)
const [turnNumber, setTurnNumber] = useState(1)
const [history, setHistory] = useState<HistoryItem[]>([])
const [showHistory, setShowHistory] = useState(false)
```

### 交互流程

1. **首次生成**:
   ```
   用户输入提示词 → 点击生成 → API 返回 sessionId → 保存到 state
   → 显示"第 1 轮"标识 → 展示"继续编辑"按钮（仅 Gemini）
   ```

2. **继续编辑**:
   ```
   用户点击"继续编辑" → 输入新指令 → 带上 sessionId 调用 API
   → 返回新图片和 turnNumber → 更新 UI
   ```

3. **从历史继续**:
   ```
   用户在历史记录点击"从这里继续" → 加载该会话 → 设置为当前会话
   → 用户可以继续编辑
   ```

---

## 代码示例

### 1. Session 管理工具函数

**文件**: `lib/imageSession.ts`

```typescript
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

// 创建新会话
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

// 加载会话
export function loadSession(sessionId: string): ImageSession | null {
  const db = getDb()
  const now = Date.now()

  const session = db.prepare(`
    SELECT * FROM image_sessions
    WHERE session_id = ? AND expires_at > ?
  `).get(sessionId, now) as ImageSession | undefined

  return session || null
}

// 更新会话
export function updateSession(
  sessionId: string,
  updates: {
    conversation_history?: string
    last_image_url?: string
    updated_at: number
  }
) {
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

// 删除过期会话
export function cleanupExpiredSessions() {
  const db = getDb()
  const now = Date.now()

  // 获取过期的会话
  const expiredSessions = db.prepare(`
    SELECT session_id FROM image_sessions WHERE expires_at <= ?
  `).all(now) as Array<{ session_id: string }>

  // 删除会话
  db.prepare(`
    DELETE FROM image_sessions WHERE expires_at <= ?
  `).run(now)

  // 返回被删除的会话 ID（用于删除图片文件）
  return expiredSessions.map(s => s.session_id)
}
```

### 2. History 管理工具函数

**文件**: `lib/imageHistory.ts`

```typescript
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

// 保存历史记录
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

// 获取历史记录列表
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

// 获取会话的所有历史
export function getSessionHistory(sessionId: string): ImageHistory[] {
  const db = getDb()

  return db.prepare(`
    SELECT * FROM image_history
    WHERE session_id = ?
    ORDER BY turn_number ASC
  `).all(sessionId) as ImageHistory[]
}

// 删除历史记录
export function deleteHistory(id: number): string | null {
  const db = getDb()

  // 先获取图片 URL（用于删除文件）
  const record = db.prepare(`
    SELECT image_url FROM image_history WHERE id = ?
  `).get(id) as { image_url: string } | undefined

  if (!record) return null

  // 删除记录
  db.prepare('DELETE FROM image_history WHERE id = ?').run(id)

  return record.image_url
}

// 清理 30 天前的历史
export function cleanupOldHistory(): string[] {
  const db = getDb()
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

  // 获取要删除的图片 URL
  const oldRecords = db.prepare(`
    SELECT image_url FROM image_history WHERE created_at < ?
  `).all(thirtyDaysAgo) as Array<{ image_url: string }>

  // 删除记录
  db.prepare(`
    DELETE FROM image_history WHERE created_at < ?
  `).run(thirtyDaysAgo)

  return oldRecords.map(r => r.image_url)
}
```

### 3. Gemini API 核心实现片段

```typescript
// app/api/imagen/gemini/route.ts

import { GoogleGenAI } from '@google/genai'
import { createSession, loadSession, updateSession } from '@/lib/imageSession'
import { saveHistory } from '@/lib/imageHistory'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode, prompt, sessionId, uploadedImage, aspectRatio = '16:9', resolution = '2k' } = body

    // 1. 加载或创建会话
    let session
    if (sessionId) {
      session = loadSession(sessionId)
      if (!session) {
        return NextResponse.json(
          { success: false, error: '会话不存在或已过期' },
          { status: 404 }
        )
      }
    } else {
      session = createSession('gemini', mode)
    }

    // 2. 解析对话历史
    const conversationHistory = session.conversation_history
      ? JSON.parse(session.conversation_history)
      : { turns: [] }

    // 3. 初始化 Gemini API
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_TEXT_API_KEY! })

    // 4. 创建或恢复 chat session
    const chat = genAI.models.startChat({
      model: 'gemini-3-pro-image-preview',
      history: conversationHistory.turns  // 传入历史对话
    })

    // 5. 构建消息内容
    const messageParts = mode === 'image-to-image'
      ? [
          { inlineData: { data: uploadedImage.replace(/^data:image\/\w+;base64,/, ''), mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      : [{ text: prompt }]

    // 6. 发送消息
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

    // 7. 提取生成的图片
    const images = extractImagesFromResponse(result)

    // 8. 保存图片到本地
    const savedUrls = await Promise.all(
      images.map((img, i) => saveImageToLocal(img, `gemini-${session.session_id}-${Date.now()}-${i}`))
    )

    // 9. 更新会话历史（包含 Thought Signatures）
    conversationHistory.turns = chat.getHistory()

    await updateSession(session.session_id, {
      conversation_history: JSON.stringify(conversationHistory),
      last_image_url: savedUrls[0],
      updated_at: Date.now()
    })

    // 10. 保存到历史记录
    const turnNumber = Math.ceil(conversationHistory.turns.length / 2)

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

    // 11. 返回响应
    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.session_id,
        turnNumber,
        images: savedUrls,
        prompt,
        model: 'gemini-3-pro-image-preview',
        duration: Date.now() - startTime,
        canContinue: true
      }
    })

  } catch (error) {
    console.error('[Gemini API] 错误:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    )
  }
}

function extractImagesFromResponse(response: any): string[] {
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
```

---

## 测试计划

### 单元测试

1. **Session 管理**
   - 创建会话
   - 加载会话
   - 更新会话
   - 过期检查

2. **History 管理**
   - 保存记录
   - 查询记录
   - 删除记录
   - 清理旧记录

### 集成测试

1. **Gemini 多轮对话**
   ```
   第1轮：生成一个日落图片
   → 检查返回 sessionId 和 turnNumber=1

   第2轮：把天空改成更红的颜色
   → 使用 sessionId，检查 turnNumber=2
   → 验证图片确实基于上一轮修改

   第3轮：添加一些云彩
   → 使用 sessionId，检查 turnNumber=3
   → 验证上下文保持
   ```

2. **历史记录**
   ```
   生成多张图片
   → 查询历史列表
   → 按会话分组显示
   → 从历史继续编辑
   ```

3. **过期清理**
   ```
   创建过期会话（修改 expires_at）
   → 运行清理任务
   → 验证会话和历史被删除
   → 验证图片文件被删除
   ```

---

## 性能优化

### 1. 数据库索引
- 已创建必要的索引（session_id, created_at, expires_at）
- 查询时使用索引字段

### 2. 图片存储
- 使用时间戳 + UUID 避免文件名冲突
- 定期清理过期图片释放空间

### 3. API 响应
- 图片使用 URL 而非 base64（减少响应体积）
- 历史记录分页加载

### 4. 前端优化
- 历史记录使用虚拟滚动
- 图片懒加载
- 会话信息本地缓存

---

## 安全考虑

1. **会话劫持防护**
   - sessionId 使用 UUID v4（足够随机）
   - 验证会话是否过期

2. **文件上传安全**
   - 验证图片格式和大小
   - 限制文件上传频率

3. **API 访问控制**
   - 可选：添加 API 密钥验证
   - 可选：添加用户认证

---

## 迁移指南

### 从旧系统迁移

1. **API 兼容性**
   - 保留旧端点一段时间（标记为 deprecated）
   - 前端逐步迁移到新端点

2. **数据迁移**
   - 现有的图片历史不需要迁移（可选）
   - 新功能从0开始

3. **渐进式部署**
   ```
   阶段1：部署新 API，前端保持使用旧 API
   阶段2：前端开启新功能的 feature flag
   阶段3：全量切换到新 API
   阶段4：删除旧 API 代码
   ```

---

## 参考资料

### 官方文档
1. [Gemini 3 Pro Image Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image)
2. [Image Generation with Gemini](https://ai.google.dev/gemini-api/docs/image-generation)
3. [Imagen Mask-Free Editing](https://cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-imagen-edit-image-mask-free)
4. [Multi-turn Conversations](https://www.cursor-ide.com/blog/gemini-3-pro-image-api)

### 代码示例
- [Google GenAI SDK Examples](https://googleapis.github.io/js-genai/)
- [Imagen Editing Samples](https://cloud.google.com/vertex-ai/generative-ai/docs/samples)

---

## 下一步行动

### 立即开始（优先级高）

1. ✅ **数据库表已创建** - 重启应用即可生效
2. **创建工具函数** - `lib/imageSession.ts` 和 `lib/imageHistory.ts`
3. **实现 Gemini API** - `app/api/imagen/gemini/route.ts`

### 后续实现（优先级中）

4. **实现 Imagen API** - `app/api/imagen/imagen/route.ts`
5. **实现辅助 API** - 会话管理、历史记录等
6. **前端 UI 改造** - 添加会话管理和历史记录

### 可选优化（优先级低）

7. **添加清理定时任务** - 每天自动清理过期数据
8. **性能监控** - 记录生成时长、成功率等
9. **用户反馈** - 收集用户使用情况

---

## 预估工作量

| 任务 | 时间 | 难度 |
|------|------|------|
| 工具函数实现 | 1-2h | ⭐⭐ |
| Gemini API 实现 | 2-3h | ⭐⭐⭐ |
| Imagen API 实现 | 1-2h | ⭐⭐ |
| 辅助 API 实现 | 1-2h | ⭐⭐ |
| 前端 UI 改造 | 2-3h | ⭐⭐⭐ |
| 测试和调试 | 1-2h | ⭐⭐ |
| **总计** | **8-14h** | **⭐⭐⭐** |

---

**最后更新**: 2025-12-02
**文档版本**: 1.0
**作者**: Claude Code Agent
