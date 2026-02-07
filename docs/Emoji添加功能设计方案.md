# 小红书 Emoji 添加功能设计方案

## 📋 需求背景

在正文改写完成后，需要加入小红书的 Emoji 后再发布，让笔记内容更生动、更吸引用户眼球。

## 🎯 设计目标

1. **时机合适**：在改写完成后、发布前提供 Emoji 添加功能
2. **操作便捷**：提供可视化 Emoji 选择器，点击即可插入
3. **分类清晰**：按小红书常用场景分类（热门、表情、手势、提示等）
4. **实时预览**：即时查看添加效果
5. **保存历史**：添加 Emoji 后的版本自动保存到历史记录

## 🎨 界面设计

### 1. Emoji 选择器 (EmojiPicker)

**位置**：正文编辑框右下角

**布局**：
```
┌─────────────────────────────────────┐
│  选择 Emoji                      ✕  │ ← 标题栏
├─────────────────────────────────────┤
│ 🔥热门 😊表情 👋手势 💡提示 ✨装饰 │ ← 分类标签
├─────────────────────────────────────┤
│  🔥 💥 ✨ 💯 👍 ❤️ 💕 🎉       │
│  ⭐ 💪 🌟 💫 ...               │ ← Emoji 网格
│                                     │
├─────────────────────────────────────┤
│  💡 提示：点击 Emoji 即可插入       │ ← 使用说明
└─────────────────────────────────────┘
```

**交互效果**：
- 分类标签点击切换
- Emoji 悬停放大效果
- 点击后自动插入光标位置
- 插入后自动关闭选择器

### 2. Emoji 文本编辑器 (EmojiTextEditor)

**功能特点**：
- 保留原有的文本编辑功能
- 右下角添加"😊 添加 Emoji"按钮
- 点击按钮弹出 Emoji 选择器
- 支持在任意光标位置插入 Emoji
- 显示字数统计
- 点击外部自动关闭选择器

## 📁 文件结构

```
components/
├── EmojiPicker.tsx           # Emoji 选择器组件
└── EmojiTextEditor.tsx       # 带 Emoji 功能的文本编辑器
```

## 🔧 技术实现

### 1. Emoji 分类数据

```typescript
const EMOJI_CATEGORIES = {
  hot: {
    name: '🔥 热门推荐',
    emojis: ['🔥', '💥', '✨', '💯', '👍', '❤️', '💕', '🎉', ...]
  },
  emotion: {
    name: '😊 表情类',
    emojis: ['😊', '😍', '🥰', '😭', '😂', '🤔', ...]
  },
  gesture: {
    name: '👋 手势类',
    emojis: ['👋', '👏', '🙏', '💪', '👍', '👌', ...]
  },
  hint: {
    name: '💡 提示类',
    emojis: ['⚠️', '💡', '📢', '📣', '🎯', '✅', ...]
  },
  decoration: {
    name: '✨ 装饰类',
    emojis: ['⭐', '🌟', '💫', '✨', '🎀', '🎁', ...]
  },
  life: {
    name: '🏠 生活类',
    emojis: ['🏠', '🏡', '🏢', '☕', '🍕', '🍔', ...]
  },
  travel: {
    name: '✈️ 旅行类',
    emojis: ['✈️', '🚗', '🚇', '🏖️', '🗺️', '📸', ...]
  },
  beauty: {
    name: '💄 美妆类',
    emojis: ['💄', '💅', '👗', '👠', '👜', '💍', ...]
  }
}
```

### 2. 核心功能实现

#### 插入 Emoji 到光标位置

```typescript
const handleEmojiSelect = (emoji: string) => {
  const textarea = textareaRef.current
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const newValue = value.substring(0, start) + emoji + value.substring(end)

  onChange(newValue)

  // 设置光标位置到 Emoji 后面
  setTimeout(() => {
    if (textarea) {
      const newPosition = start + emoji.length
      textarea.focus()
      textarea.setSelectionRange(newPosition, newPosition)
    }
  }, 0)
}
```

#### 点击外部关闭选择器

```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      emojiButtonRef.current &&
      !emojiButtonRef.current.contains(event.target as Node)
    ) {
      setShowEmojiPicker(false)
    }
  }

  if (showEmojiPicker) {
    document.addEventListener('mousedown', handleClickOutside)
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside)
  }
}, [showEmojiPicker])
```

## 🔌 集成到改写页面

### 方案 1：替换现有 textarea

**改动位置**：`app/rewrite/page.tsx` 第 1137-1234 行（改写结果展示区域）

**修改前**：
```tsx
<textarea
  value={editableContent}
  onChange={(e) => setEditableContent(e.target.value)}
  rows={10}
  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
/>
```

**修改后**：
```tsx
import EmojiTextEditor from '@/components/EmojiTextEditor'

<EmojiTextEditor
  value={editableContent}
  onChange={setEditableContent}
  placeholder="在这里编辑你的正文..."
  label="正文内容"
  rows={12}
  maxLength={1000}
  showEmojiButton={true}
/>
```

### 方案 2：添加独立的 Emoji 编辑步骤

在改写完成后、发布前，增加一个"添加 Emoji"的步骤：

**流程设计**：
```
改写完成
  ↓
[预览效果]
  ↓
点击"添加 Emoji"按钮
  ↓
进入 Emoji 编辑模式（使用 EmojiTextEditor）
  ↓
[保存] → 创建历史版本
  ↓
[预览/发布]
```

**代码实现**：
```tsx
// 添加状态
const [isEditingEmoji, setIsEditingEmoji] = useState(false)

// 在改写结果展示区域添加按钮
{pageState === 'completed' && !isEditingEmoji && (
  <button
    onClick={() => setIsEditingEmoji(true)}
    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
  >
    😊 添加 Emoji
  </button>
)}

// Emoji 编辑模式
{isEditingEmoji && (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-6 bg-white rounded-2xl shadow-lg"
  >
    <h3 className="text-lg font-bold text-gray-800 mb-4">
      添加 Emoji 让内容更生动
    </h3>

    <EmojiTextEditor
      value={editableContent}
      onChange={setEditableContent}
      label="正文内容"
      rows={12}
      maxLength={1000}
      showEmojiButton={true}
    />

    <div className="flex gap-3 mt-4">
      <button
        onClick={() => {
          setIsEditingEmoji(false)
          // 创建历史版本
          createHistoryVersion(
            editableTitle,
            editableContent,
            editableTags,
            'manual-edit'
          )
        }}
        className="flex-1 px-6 py-3 bg-pink-500 text-white rounded-xl font-semibold hover:bg-pink-600 transition-all"
      >
        保存
      </button>
      <button
        onClick={() => setIsEditingEmoji(false)}
        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-all"
      >
        取消
      </button>
    </div>
  </motion.div>
)}
```

## 💡 使用建议

### 推荐的 Emoji 使用场景

1. **标题优化**
   - 热门类：🔥💥✨💯
   - 强调类：⚠️💡📢🎯
   - 装饰类：⭐🌟💫

2. **正文段落**
   - **开头**：💡📢 引起注意
   - **重点**：⚠️✅❌ 强调要点
   - **结尾**：🎉💪👍 行动号召

3. **分点列举**
   ```
   🔥 第一点：...
   💡 第二点：...
   ✨ 第三点：...
   ```

4. **场景分类**
   - 美妆：💄💅👗💍
   - 旅行：✈️🏖️📸🗺️
   - 美食：☕🍕🍰🍔
   - 生活：🏠💰🛒💳

## 🎨 样式定制

### 自定义 Emoji 选择器样式

```tsx
// 修改 EmojiPicker.tsx 中的样式类
<motion.div
  className="absolute z-50 mt-2 w-96 bg-white rounded-2xl shadow-2xl"
  style={{
    // 可以添加自定义样式
    maxHeight: '400px',
    width: '420px',
  }}
>
```

### 自定义按钮样式

```tsx
// 修改 EmojiTextEditor.tsx 中的按钮样式
<button
  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg"
>
  <span className="text-lg">😊</span>
  <span>添加 Emoji</span>
</button>
```

## 📊 预期效果

### 改写前
```
这款面膜真的很好用，用了一个月皮肤变好了很多，
推荐大家试试。价格也不贵，性价比很高。
```

### 添加 Emoji 后
```
这款面膜真的很好用✨用了一个月皮肤变好了很多💕
推荐大家试试👍价格也不贵💰性价比很高🔥
```

## 🚀 扩展功能

### 1. AI 智能推荐 Emoji

在改写 API 中，让 AI 直接推荐合适的 Emoji 位置：

```typescript
// 在 contentPrompt 中添加指令
const contentPrompt = `
...原有提示词...

在关键位置适当添加 Emoji：
- 开头使用提示类 Emoji（💡📢）
- 重点句子使用强调类 Emoji（🔥✨）
- 结尾使用行动号召类 Emoji（👍💪）
`
```

### 2. 热门 Emoji 统计

记录用户常用的 Emoji，显示在"热门推荐"分类中：

```typescript
// 在 localStorage 中保存使用频率
const saveEmojiUsage = (emoji: string) => {
  const usage = JSON.parse(localStorage.getItem('emoji_usage') || '{}')
  usage[emoji] = (usage[emoji] || 0) + 1
  localStorage.setItem('emoji_usage', JSON.stringify(usage))
}

// 获取热门 Emoji
const getHotEmojis = () => {
  const usage = JSON.parse(localStorage.getItem('emoji_usage') || '{}')
  return Object.entries(usage)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 12)
    .map(([emoji]) => emoji)
}
```

### 3. Emoji 预设模板

提供常见场景的 Emoji 组合模板：

```typescript
const EMOJI_TEMPLATES = {
  beauty: ['💄', '✨', '💕', '👍'],
  food: ['🍕', '🍰', '☕', '🔥'],
  travel: ['✈️', '📸', '🏖️', '🌟'],
  shopping: ['🛒', '💰', '💳', '💯']
}
```

## 📝 测试清单

- [ ] Emoji 选择器正常打开/关闭
- [ ] 各个分类切换正常
- [ ] 点击 Emoji 能插入到光标位置
- [ ] 点击外部选择器自动关闭
- [ ] 插入后光标位置正确
- [ ] 字数统计更新正确
- [ ] 支持多次插入 Emoji
- [ ] 移动端触摸操作正常
- [ ] 历史版本保存正确
- [ ] 发布时 Emoji 显示正确

## 🎯 后续优化方向

1. **性能优化**
   - Emoji 图片懒加载
   - 虚拟滚动（Emoji 较多时）

2. **交互优化**
   - 添加搜索功能
   - 支持键盘快捷键
   - 最近使用的 Emoji

3. **智能化**
   - AI 自动推荐 Emoji
   - 根据内容智能插入
   - 学习用户偏好

## 📚 参考资料

- [小红书内容创作规范](https://www.xiaohongshu.com)
- [Emoji Unicode 标准](https://unicode.org/emoji/)
- [Framer Motion 动画库](https://www.framer.com/motion/)
