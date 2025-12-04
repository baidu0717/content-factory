# 快速实现指南

## ✅ 已完成

1. **数据库表设计** - 已在 `lib/db.ts` 中添加
   - `image_sessions` - 会话表
   - `image_history` - 历史记录表
   - 重启应用后自动创建

## 📝 待实现清单

### 步骤 1：创建工具函数（1-2小时）

**文件**: `lib/imageSession.ts`
- [ ] `createSession()` - 创建新会话
- [ ] `loadSession()` - 加载会话
- [ ] `updateSession()` - 更新会话
- [ ] `cleanupExpiredSessions()` - 清理过期会话

**文件**: `lib/imageHistory.ts`
- [ ] `saveHistory()` - 保存历史记录
- [ ] `getHistory()` - 获取历史列表
- [ ] `getSessionHistory()` - 获取会话历史
- [ ] `deleteHistory()` - 删除记录
- [ ] `cleanupOldHistory()` - 清理旧记录

**参考**: 详见 `docs/IMAGE_GENERATION_REFACTOR.md` 的代码示例部分

### 步骤 2：实现 Gemini API（2-3小时）

**文件**: `app/api/imagen/gemini/route.ts`

**核心逻辑**:
```typescript
1. 解析请求参数（mode, prompt, sessionId, uploadedImage, ...）
2. 加载或创建会话
3. 解析对话历史
4. 使用 chat.startChat() 创建会话，传入历史
5. 调用 chat.sendMessage() 发送新消息
6. 提取图片，保存到本地
7. 更新会话历史（包含 Thought Signatures）
8. 保存到历史记录表
9. 返回响应
```

**关键点**:
- 使用 `genAI.models.startChat({ history: [...] })` 恢复上下文
- `chat.getHistory()` 获取更新后的历史（包含 Thought Signatures）
- Thought Signatures 由 SDK 自动处理

### 步骤 3：实现 Imagen API（1-2小时）

**文件**: `app/api/imagen/imagen/route.ts`

**mask-free editing 核心**:
```typescript
if (mode === 'image-to-image') {
  const response = await imageAI.models.editImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    referenceImage: {
      imageBytes: uploadedImage
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

**注意**: Imagen 不支持多轮对话，每次独立生成。

### 步骤 4：实现辅助 API（1-2小时）

**会话管理**:
- [ ] `GET /api/imagen/sessions/:sessionId` - 获取会话详情
- [ ] `DELETE /api/imagen/sessions/:sessionId` - 删除会话

**历史记录**:
- [ ] `GET /api/imagen/history` - 获取历史列表
- [ ] `GET /api/imagen/history/session/:sessionId` - 获取会话历史
- [ ] `DELETE /api/imagen/history/:id` - 删除记录

**清理**:
- [ ] `POST /api/imagen/cleanup` - 清理过期数据

### 步骤 5：前端 UI 改造（2-3小时）

**文件**: `app/image-generate/page.tsx`

**新增状态**:
```typescript
const [model, setModel] = useState<'gemini' | 'imagen'>('gemini')
const [currentSession, setCurrentSession] = useState<Session | null>(null)
const [turnNumber, setTurnNumber] = useState(1)
const [history, setHistory] = useState<HistoryItem[]>([])
const [showHistory, setShowHistory] = useState(false)
```

**UI 组件**:
- [ ] 模型选择器（Gemini / Imagen）
- [ ] 会话信息卡片
- [ ] "继续编辑"按钮（仅 Gemini）
- [ ] 历史记录抽屉/侧边栏
- [ ] 历史记录时间线展示

**交互流程**:
```
首次生成 → 保存 sessionId
点击"继续编辑" → 带上 sessionId 调用 API
查看历史 → 展示按会话分组的记录
从历史继续 → 加载会话，设置为当前
```

### 步骤 6：测试（1-2小时）

**Gemini 多轮对话测试**:
```
1. 生成日落图片 → 检查 sessionId 和 turnNumber=1
2. 把天空改红 → 使用 sessionId，检查 turnNumber=2
3. 添加云彩 → 使用 sessionId，检查 turnNumber=3
```

**历史记录测试**:
```
1. 生成多张图片
2. 查询历史列表
3. 按会话分组显示
4. 从历史继续编辑
```

**清理测试**:
```
1. 修改会话 expires_at 为过去时间
2. 运行清理任务
3. 验证会话、历史、图片文件被删除
```

---

## 🎯 实现优先级

### P0 - 核心功能（必须完成）
1. ✅ 数据库表
2. 工具函数（imageSession.ts, imageHistory.ts）
3. Gemini API 端点
4. 前端基础 UI（模型选择、继续编辑）

### P1 - 重要功能（建议完成）
5. Imagen API 端点（支持 mask-free editing）
6. 历史记录 UI
7. 会话管理 API

### P2 - 辅助功能（可选）
8. 清理过期数据
9. 性能优化
10. 完善的测试

---

## 💡 实现技巧

### 1. 增量开发
- 先实现 Gemini 文本生图（最简单）
- 再实现 Gemini 图生图
- 最后实现多轮对话

### 2. 复用现有代码
- 从 `app/api/imagen/generate/route.ts` 复制 Gemini 调用代码
- 从 `app/api/imagen/edit/route.ts` 复制图生图逻辑
- 修改为 chat session 模式

### 3. 调试技巧
- 打印 `conversation_history` 查看对话历史
- 打印 `chat.getHistory()` 查看 Thought Signatures
- 先用固定提示词测试，确保上下文保持

### 4. 前端开发
- 先实现功能，UI 可以先简单一点
- 使用现有的 GlassCard 组件
- 参考 `app/monitoring/page.tsx` 的弹窗样式

---

## 📚 参考代码位置

### 现有代码（可复用）
- `app/api/imagen/generate/route.ts` - Gemini 调用示例
- `app/api/imagen/edit/route.ts` - 图生图逻辑
- `lib/db.ts` - 数据库操作示例
- `app/monitoring/page.tsx` - 列表和弹窗 UI 示例

### 新建文件
- `lib/imageSession.ts` - 会话管理
- `lib/imageHistory.ts` - 历史记录
- `app/api/imagen/gemini/route.ts` - Gemini 端点
- `app/api/imagen/imagen/route.ts` - Imagen 端点
- `app/api/imagen/sessions/` - 会话 API
- `app/api/imagen/history/` - 历史 API

---

## 🐛 常见问题

### Q: Thought Signatures 丢失？
A: 确保保存和加载会话时包含完整的对话历史，使用 `chat.getHistory()` 获取。

### Q: 图片不基于上一轮修改？
A: 检查 `conversation_history` 是否正确传入 `startChat({ history: [...] })`。

### Q: Imagen 无法图生图？
A: 确认使用 `editImages()` 方法和 `MASK_FREE` 模式，参考文档示例。

### Q: 数据库表没有创建？
A: 重启应用，`lib/db.ts` 的 `initTables()` 会自动创建表。

---

## ⚡ 快速开始命令

```bash
# 1. 确认数据库表已创建
# 重启应用，查看控制台输出 "✅ 数据库表初始化完成"

# 2. 创建工具函数文件
touch lib/imageSession.ts
touch lib/imageHistory.ts

# 3. 创建 API 文件
mkdir -p app/api/imagen/gemini
touch app/api/imagen/gemini/route.ts

mkdir -p app/api/imagen/imagen
touch app/api/imagen/imagen/route.ts

# 4. 开始编码！
```

---

## 📞 需要帮助？

- 详细设计文档：`docs/IMAGE_GENERATION_REFACTOR.md`
- 代码示例：文档中的"代码示例"章节
- API 参考：官方文档链接在设计文档中

---

**预计总时间**: 8-14 小时
**难度**: ⭐⭐⭐ 中等
**最后更新**: 2025-12-02
