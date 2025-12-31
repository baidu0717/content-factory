# Content Factory - 项目状态说明

**更新时间**: 2025-12-31
**部署状态**: ✅ 生产环境运行中
**项目网址**: https://content-factory-git-main-baidu0717s-projects.vercel.app

---

## 🎯 项目概述

小红书笔记智能采集和复刻系统，支持：
- 小红书笔记内容提取
- 自动保存到飞书多维表格
- AI内容改写（基于 Gemini）
- 一键发布到小红书

---

## ✅ 核心功能状态

### 1. 小红书笔记采集
- **状态**: ✅ 正常工作
- **API**: 哼哼猫 API (Meowload)
- **支持**: 标题、正文、图片、话题标签提取
- **注意**: 当前API不提供作者信息

### 2. 飞书多维表格集成
- **状态**: ✅ 正常工作
- **认证方式**: OAuth 2.0 + Vercel KV 自动刷新
- **存储字段**:
  - 笔记链接（多行文本）
  - 标题（文本）
  - 正文（多行文本）
  - 话题标签（文本）
  - 封面（附件）
  - 图片2（附件）
  - 图片3（附件）

### 3. 图片上传
- **状态**: ✅ 正常工作
- **并行处理**: 3张图片同时上传
- **格式**: 自动上传到飞书云文档，获取 file_token

### 4. AI内容改写
- **状态**: ✅ 正常工作
- **模型**: Google Gemini (gemini-3-pro-preview)
- **功能**: 标题改写、正文改写
- **自定义**: 支持自定义改写提示词

### 5. 小红书发布
- **状态**: ✅ 正常工作
- **API**: MyAIBot API
- **支持**: 标题、正文、图片（最多18张）

---

## 🔧 技术架构

### 前端
- **框架**: Next.js 15+ (App Router)
- **UI**: React + TailwindCSS
- **动画**: Framer Motion
- **部署**: Vercel

### 后端
- **运行环境**: Vercel Serverless Functions
- **数据库**:
  - SQLite (本地开发)
  - Vercel KV (生产环境 - Token存储)
- **认证**: 飞书 OAuth 2.0

### 关键依赖
- `@google/genai` - Gemini AI
- `@vercel/kv` - KV 数据库
- `better-sqlite3` - 本地SQLite
- `axios` + `form-data` - 文件上传

---

## 🔑 环境变量配置

### AI服务
```
GEMINI_TEXT_API_KEY=AIzaSy...
GEMINI_TEXT_MODEL=gemini-3-pro-preview
```

### 小红书服务
```
# 发布API
MYAIBOT_API_KEY=rn_95b1c43...

# 采集API（前端变量）
NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY=JZL1b7f...
NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE=https://www.dajiala.com/...
NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY=341289-...
NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE=https://api.meowload.net/...
```

### 飞书服务
```
FEISHU_APP_ID=cli_a9bac...
FEISHU_APP_SECRET=kqcP7odJ...
FEISHU_REFRESH_TOKEN=ur-7nOi_... (自动刷新，存储在KV中)
FEISHU_API_URL=https://open.feishu.cn/open-apis

# 飞书表格默认配置（前端变量）
NEXT_PUBLIC_FEISHU_DEFAULT_APP_TOKEN=NNd8bJYaza...
NEXT_PUBLIC_FEISHU_DEFAULT_TABLE_ID=tblu1m2GP...
```

### KV数据库
```
KV_REST_API_URL=https://native-bluegill-23247.upstash.io
KV_REST_API_TOKEN=AVrPAAI...
KV_REST_API_READ_ONLY_TOKEN=A1rPAAI...
KV_URL=redis://default:...
REDIS_URL=redis://default:...
```

### 应用配置
```
NEXT_PUBLIC_APP_URL=https://content-factory-git-main-baidu0717s-projects.vercel.app
```

---

## 🎊 重要突破 - KV 数据库自动刷新

### 问题背景
之前 refresh_token 需要频繁手动更新，每次部署后都会失效。

### 解决方案
✅ 配置了 Vercel KV (Upstash Redis)
✅ refresh_token 自动保存到 KV
✅ 每次刷新时自动更新 KV 中的 token
✅ **不再需要手动更新环境变量**

### 技术实现
- 位置: `lib/feishuAuth.ts`
- 优先级: KV 存储 > 环境变量
- 自动保存: 每次 token 刷新后自动写入 KV
- 日志标识: `[飞书Auth] 新 token 已保存到 KV`

---

## 📁 项目结构

```
app/
├── api/
│   ├── auth/
│   │   ├── login/route.ts          # OAuth登录入口
│   │   ├── status/route.ts         # 登录状态检查
│   │   └── feishu/callback/route.ts # OAuth回调（获取refresh_token）
│   ├── feishu/
│   │   └── append-row/route.ts     # 保存到飞书表格
│   ├── feishu-notes/
│   │   ├── route.ts                # 本地笔记记录（Vercel环境降级）
│   │   └── [id]/route.ts           # 更新/删除笔记记录
│   └── xiaohongshu/
│       ├── parse/route.ts          # 解析小红书链接
│       ├── rewrite/route.ts        # AI内容改写
│       └── publish/route.ts        # 发布到小红书
├── xiaohongshu-extract/page.tsx    # 采集页面（主功能）
├── publish/page.tsx                # 发布页面
└── page.tsx                        # 首页

lib/
├── feishuAuth.ts                   # 飞书认证（KV版本，生产环境）
├── feishu-auth.ts                  # 飞书认证（文件版本，本地开发）
├── db.ts                           # SQLite数据库
└── imageUtils.ts                   # 图片处理工具

components/
├── GlassCard.tsx                   # 玻璃态卡片组件
├── ArticleEditModal.tsx            # 文章编辑弹窗
├── ArticlePreviewModal.tsx         # 文章预览弹窗
├── ImageUploader.tsx               # 图片上传组件
└── XiaohongshuPublishModal.tsx     # 小红书发布弹窗
```

---

## 🐛 已知问题和限制

### 1. 作者昵称字段
- **状态**: 已移除
- **原因**: 当前使用的小红书提取API不提供作者信息
- **解决**: 如需此功能，需更换提供作者信息的API

### 2. 本地数据库在Vercel环境
- **状态**: 降级处理
- **影响**: Vercel环境下 SQLite 不持久化
- **解决**: 已添加 try-catch，失败时返回空数据
- **核心功能不受影响**: 数据已保存到飞书表格

### 3. 图片数量限制
- **限制**: 最多处理3张图片保存到飞书
- **原因**: 飞书表格字段限制（封面 + 图片2 + 图片3）
- **发布限制**: 小红书发布支持最多18张

---

## 🚀 部署流程

### 自动部署
- 每次 `git push` 到 main 分支
- Vercel 自动检测并部署
- 部署时间: 约1-2分钟

### 手动部署
1. 访问: https://vercel.com/baidu0717s-projects/content-factory/deployments
2. 点击最新部署 → ⋯ → Redeploy

### 环境变量更新
1. 修改环境变量后需要重新部署才能生效
2. **refresh_token 除外** - 自动保存到 KV，无需重新部署

---

## 📊 性能优化

### 图片上传优化
- ✅ 并行处理3张图片（之前是串行）
- ✅ 性能提升: 从 ~15秒 降至 ~5秒

### 代理配置
- 本地开发: 使用 HTTP_PROXY 环境变量
- 生产环境: 直接访问（Vercel 网络环境良好）

---

## 🔄 更新日志

### 2025-12-31
- ✅ 成功配置 Vercel KV 数据库
- ✅ 实现 refresh_token 自动刷新机制
- ✅ 移除作者昵称功能（API不支持）
- ✅ 修正 OAuth 回调路径
- ✅ 优化图片上传性能（并行处理）
- ✅ 完成 Vercel 生产环境部署

### 2025-12-10
- ✅ 迁移从 OpenAI 到 Gemini AI
- ✅ 更换小红书发布API（MyAIBot）
- ✅ 添加飞书笔记记录功能
- ✅ 添加本地 SQLite 数据库

---

## 📝 使用说明

### 基本流程
1. 访问采集页面
2. 输入小红书链接
3. 点击"提取内容"
4. 查看提取结果
5. 点击"保存到飞书" → 自动保存到飞书表格
6. （可选）使用 AI 改写
7. （可选）发布到小红书

### 注意事项
- 首次使用需要登录飞书账号
- 表格配置会自动从环境变量加载
- refresh_token 会自动刷新，无需手动更新

---

## 🔗 相关链接

- **GitHub 仓库**: https://github.com/baidu0717/content-factory
- **Vercel 项目**: https://vercel.com/baidu0717s-projects/content-factory
- **飞书开放平台**: https://open.feishu.cn/
- **Gemini API**: https://ai.google.dev/
- **MyAIBot**: https://www.myaibot.vip/

---

## 👤 维护信息

- **项目所有者**: baidu0717
- **主要技术栈**: Next.js + Vercel + 飞书 + Gemini
- **最后更新**: 2025-12-31
- **状态**: ✅ 生产环境稳定运行

---

**注意**: 本文档记录了项目的最新状态，包括所有配置、功能和已解决的问题。
