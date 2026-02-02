# 20260202 - 移除 Redis 依赖 + 添加 Token 监控

## 📅 更新时间
2026年2月2日 23:30

---

## 🎯 本次更新目标

1. ✅ 移除 Upstash Redis (KV) 依赖，简化架构
2. ✅ 创建飞书 Token 过期监控系统
3. ✅ 配置自动邮件提醒功能

---

## ✅ 已完成的工作

### 1. 移除 Upstash Redis 依赖

**背景：**
- Upstash Redis 数据库因长期未使用被归档
- 项目使用 Redis 仅用于缓存飞书 token
- 代码已有完整的降级机制（环境变量 + 内存缓存）

**执行步骤：**
1. ✅ 删除 `@vercel/kv` npm 包
2. ✅ 简化 `lib/feishuAuth.ts`，移除所有 KV 相关代码
3. ✅ 更新 `.env.local`，注释掉 KV 配置

**代码变更：**

**package.json:**
```diff
- "@vercel/kv": "^3.0.0",
```

**lib/feishuAuth.ts:**
- 删除 `import { createClient } from '@vercel/kv'`
- 删除 KV 客户端初始化代码
- 简化 `getUserAccessToken()` 函数，仅使用内存缓存
- 添加新 refresh_token 检测和警告日志

**优点：**
- ✅ 架构更简单，无需维护外部数据库
- ✅ 本地和线上配置一致
- ✅ 成本为零
- ✅ 代码更易理解和维护

**注意事项：**
- ⚠️ refresh_token 需要每 30 天手动更新一次
- ⚠️ Vercel 实例重启后需要重新刷新 token（首次请求稍慢）

---

### 2. 创建 Token 过期监控 API

**新文件：** `app/api/monitor/feishu-token/route.ts`

**功能：**
- 每天自动检查 `FEISHU_REFRESH_TOKEN` 是否有效
- 支持三种告警类型：
  - ⚠️ **EXPIRED** - Token 已失效（立即告警）
  - ⏰ **WARNING** - Token 将在 7 天内过期（提前提醒）
  - ❌ **ERROR** - 检测失败（网络错误等）

**API 端点：**
```
GET /api/monitor/feishu-token
Authorization: Bearer <CRON_SECRET>
```

**响应示例：**
```json
{
  "status": "valid",
  "message": "Token 有效，剩余 25 天",
  "expires_in": 2160000,
  "daysRemaining": 25,
  "timestamp": "2026-02-02T09:00:00.000Z"
}
```

**安全措施：**
- 使用 `CRON_SECRET` 验证请求来源
- 防止未授权访问

---

### 3. 配置 Vercel Cron Job

**文件：** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/monitor/feishu-token",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**说明：**
- 每天 UTC 09:00 自动执行（北京时间 17:00）
- Vercel 免费计划支持 Cron Jobs
- 自动调用监控 API 检查 token 状态

---

### 4. 集成邮件告警服务

**邮件服务：** Resend (https://resend.com)
- 免费计划：每月 100 封邮件
- 对于监控告警完全够用

**新增环境变量：**

```bash
# Cron Job 密钥（用于验证定时任务请求）
CRON_SECRET=your-random-secret-token-here

# 接收告警邮件的邮箱
ALERT_EMAIL=your-email@example.com

# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxx
```

**邮件模板：**

**1. Token 即将过期（7天提醒）：**
```
主题：⏰ 飞书 Token 将在 5 天后过期

你的飞书 FEISHU_REFRESH_TOKEN 将在 5 天后过期。

建议尽快更新：
1. 登录飞书开放平台获取新的 refresh_token
2. 更新本地 .env.local 文件
3. 更新 Vercel 环境变量 FEISHU_REFRESH_TOKEN
4. 重新部署应用
```

**2. Token 已失效（立即告警）：**
```
主题：⚠️ 飞书 Token 已失效 - 需要立即更新

你的飞书 FEISHU_REFRESH_TOKEN 已经过期，内容工厂的飞书功能将无法使用。

立即处理步骤：
1. 登录飞书开放平台获取新的 refresh_token
2. 更新本地 .env.local 文件
3. 更新 Vercel 环境变量 FEISHU_REFRESH_TOKEN
4. 重新部署应用
```

---

## 🧪 测试结果

### 本地测试

```bash
# 启动开发服务器
npm run dev

# 测试监控 API
curl -X GET 'http://localhost:3000/api/monitor/feishu-token' \
  -H 'Authorization: Bearer your-random-secret-token-here'
```

**测试结果：**
```json
{
  "status": "expired",
  "message": "refresh_token 已失效，请立即更新！",
  "error": "The refresh token passed is invalid. It may have been used.",
  "timestamp": "2026-02-02T15:29:04.428Z"
}
```

✅ **API 工作正常！**
- 成功检测到当前 token 已失效
- 邮件服务未配置，跳过发送（符合预期）

---

## 📋 待完成的配置步骤

### 步骤 1：注册 Resend 邮件服务

1. 访问 https://resend.com
2. 注册账号（支持 GitHub 登录）
3. 创建 API Key
4. 复制保存 API Key

### 步骤 2：生成 CRON_SECRET

```bash
# macOS/Linux
openssl rand -base64 32

# 或访问 https://www.random.org/strings/
```

### 步骤 3：配置 Vercel 环境变量

访问 https://vercel.com/dashboard，在项目设置中添加：

| 变量名 | 值 | 环境 |
|--------|---|------|
| `CRON_SECRET` | `生成的随机字符串` | Production, Preview, Development |
| `ALERT_EMAIL` | `你的邮箱` | Production, Preview, Development |
| `RESEND_API_KEY` | `Resend API Key` | Production, Preview, Development |

**同时删除以下旧变量：**
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### 步骤 4：更新 FEISHU_REFRESH_TOKEN

当前 token 已失效，需要更新：

1. 登录飞书开放平台：https://open.feishu.cn/app
2. 选择应用，进入权限管理
3. 重新授权获取新的 `refresh_token`
4. 更新本地 `.env.local`
5. 更新 Vercel 环境变量
6. 提交代码并部署

### 步骤 5：部署到 Vercel

```bash
git add .
git commit -m "feat: 移除Redis依赖，添加Token过期监控和邮件提醒"
git push
```

---

## 📊 架构对比

### 之前（使用 Redis）

```
用户请求
  ↓
飞书 API
  ↓
Vercel Serverless Function
  ↓
Upstash Redis (缓存 token)
  ↓
返回结果
```

**问题：**
- 依赖外部 Redis 服务
- 数据库长期不用会被归档
- 需要管理 Redis 连接配置

### 现在（环境变量 + 监控）

```
用户请求
  ↓
飞书 API
  ↓
Vercel Serverless Function (内存缓存)
  ↓
返回结果

每天 17:00
  ↓
Vercel Cron Job
  ↓
监控 API
  ↓
邮件告警（如需要）
```

**优点：**
- ✅ 无外部依赖
- ✅ 配置简单
- ✅ 自动监控提醒
- ✅ 成本为零

---

## 🗂️ 文件变更清单

### 新增文件
- `app/api/monitor/feishu-token/route.ts` - Token 监控 API
- `docs/20260202_飞书Token监控配置指南.md` - 详细配置文档
- `docs/20260202_移除Redis依赖_添加Token监控.md` - 本文档

### 修改文件
- `package.json` - 删除 `@vercel/kv` 依赖
- `lib/feishuAuth.ts` - 简化认证逻辑，移除 KV 代码
- `.env.local` - 注释 KV 配置，添加监控配置说明
- `vercel.json` - 添加 Cron Job 配置

### 删除依赖
- `@vercel/kv` - Redis 客户端库

---

## 🔄 Token 更新流程

当收到邮件提醒后，按照以下步骤操作：

### 1. 获取新的 refresh_token
- 访问飞书开放平台
- 重新授权应用

### 2. 更新本地环境变量
```bash
# 编辑 .env.local
FEISHU_REFRESH_TOKEN=ur-xxxxxxxxxx  # 新 token
```

### 3. 更新 Vercel 环境变量
- 进入项目设置
- 更新 `FEISHU_REFRESH_TOKEN`

### 4. 提交并部署
```bash
git add .env.local
git commit -m "chore: 更新飞书 refresh_token"
git push
```

---

## 📈 监控计划

**检查频率：** 每天 17:00（北京时间）
**提醒策略：**
- Token 剩余 ≤ 7 天：每天提醒
- Token 已过期：立即告警
- 检测失败：错误通知

**邮件配额：**
- Resend 免费计划：100 封/月
- 预计使用：~30 封/月（每天检查）
- 完全够用

---

## 🚨 故障排查

### 问题：没有收到邮件

**检查清单：**
- [ ] Resend API Key 是否配置正确
- [ ] ALERT_EMAIL 是否配置正确
- [ ] 检查垃圾邮件文件夹
- [ ] 查看 Vercel 部署日志
- [ ] 在 Resend Dashboard 查看发送记录

### 问题：Cron Job 没有执行

**检查清单：**
- [ ] `vercel.json` 格式是否正确
- [ ] 是否已部署到 Vercel
- [ ] 在 Vercel Dashboard > Cron Jobs 查看状态
- [ ] 查看部署日志

### 问题：Token 检查失败

**检查清单：**
- [ ] `FEISHU_REFRESH_TOKEN` 是否配置
- [ ] 手动调用 API 查看详细错误
- [ ] 检查飞书 API 网络连接
- [ ] 尝试更新 refresh_token

---

## 💡 后续优化建议

### P0 - 立即执行
1. ✅ 配置 Resend 邮件服务
2. ✅ 更新 Vercel 环境变量
3. ✅ 更新飞书 refresh_token
4. ✅ 部署到 Vercel

### P1 - 近期优化
1. 添加 Slack/企业微信告警通道
2. 创建监控面板页面
3. 记录 Token 更新历史

### P2 - 可选功能
1. 监控其他 API Token（Gemini, MyAIBot）
2. Token 健康度报告
3. 短信告警（使用阿里云 SMS）

---

## 📝 维护清单

### 每月检查
- [ ] Resend 邮件配额使用情况
- [ ] Vercel Cron Job 执行记录
- [ ] 告警邮件接收测试

### Token 过期前
- [ ] 获取新 token
- [ ] 更新环境变量
- [ ] 重新部署并测试

---

## 🔗 相关链接

- **Resend：** https://resend.com
- **Vercel Cron Jobs：** https://vercel.com/docs/cron-jobs
- **飞书开放平台：** https://open.feishu.cn
- **配置指南：** docs/20260202_飞书Token监控配置指南.md

---

## 📞 支持

如有问题，请查看：
1. `docs/20260202_飞书Token监控配置指南.md` - 详细配置文档
2. Vercel 部署日志
3. Resend 发送记录

---

**文档创建时间：** 2026-02-02 23:30
**Git Commit：** 待提交
**开发状态：** 核心功能完成，待配置邮件服务
