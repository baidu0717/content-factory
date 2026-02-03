# 飞书 Token 管理指南

## 🎯 概述

本项目使用飞书 OAuth 2.0 授权流程来访问用户的多维表格。Token 管理已完全自动化,避免频繁手动更换。

---

## 📍 快速链接

| 功能 | 链接 | 说明 |
|------|------|------|
| **Token 状态检查** | `/token-status` | 查看当前 token 是否有效 |
| **重新授权** | `/feishu-auth` | 获取新的 refresh_token |
| **Token 状态 API** | `/api/feishu/token-status` | API 接口检查 token |

---

## 🔄 Token 工作流程

### 1. Token 类型

```
refresh_token (30天有效)
    ↓ 刷新
user_access_token (数小时有效)
    ↓ 用于
访问飞书多维表格 API
```

### 2. 自动刷新机制

- **自动检测**: 每次 API 调用时自动检查 token 是否过期
- **内存缓存**: token 缓存在内存中,提前 5 分钟刷新
- **错误提示**: 当 refresh_token 过期时,返回友好错误消息并提供授权链接

### 3. Token 过期处理

当 `refresh_token` 过期时:
1. API 返回错误: `Refresh Token 已过期或无效，请重新授权`
2. 自动提供授权链接: `/feishu-auth`
3. 用户点击授权,获取新的 `refresh_token`

---

## 🛠️ 如何重新授权

### 方法 1: 使用 Token 状态页面 (推荐)

1. 访问 `/token-status` 页面
2. 点击"重新检查"查看状态
3. 如果显示"Token 已过期",点击"立即授权"
4. 在飞书授权页面登录并同意授权
5. 自动获取新的 `refresh_token`
6. 复制 token 并更新到 `.env.local` 文件

### 方法 2: 直接访问授权页面

1. 访问 `/feishu-auth` 页面
2. 点击"开始授权"
3. 完成飞书登录和授权
4. 复制新的 `refresh_token`
5. 更新环境变量

### 方法 3: API 检查

```bash
curl https://your-domain.com/api/feishu/token-status
```

返回示例:
```json
{
  "success": false,
  "status": "expired",
  "message": "Refresh Token 已过期或无效",
  "needReauth": true,
  "authUrl": "https://your-domain.com/feishu-auth"
}
```

---

## 📝 更新环境变量

### 开发环境 (.env.local)

```bash
# 1. 获取新的 refresh_token
# 2. 打开 .env.local 文件
# 3. 找到 FEISHU_REFRESH_TOKEN 这一行
FEISHU_REFRESH_TOKEN=ur-xxxxxxxxxxxxx

# 4. 替换为新的 token
FEISHU_REFRESH_TOKEN=ur-yyyyyyyyyyyy

# 5. 保存文件
# 6. 重启开发服务器 (如果正在运行)
```

### 生产环境 (Vercel)

```bash
# 方法1: Vercel Dashboard
1. 登录 Vercel Dashboard
2. 选择项目
3. 进入 Settings → Environment Variables
4. 找到 FEISHU_REFRESH_TOKEN
5. 点击 Edit 更新值
6. 保存后自动重新部署

# 方法2: Vercel CLI
vercel env add FEISHU_REFRESH_TOKEN
# 输入新的 token
# 选择环境: Production
```

---

## 🔍 常见问题

### Q1: Token 多久过期一次?

- **refresh_token**: 约 30 天
- **user_access_token**: 自动刷新,无需关心

### Q2: 如何知道 token 快过期了?

- 方法1: 定期访问 `/token-status` 检查
- 方法2: 设置提醒(每月检查一次)
- 方法3: 当 API 返回错误时会提示

### Q3: 可以自动更新环境变量吗?

目前不支持自动更新 `.env.local` 或 Vercel 环境变量。需要手动更新:
- **原因**: 安全考虑,避免应用自行修改敏感配置
- **建议**: 将授权页面加入书签,方便快速更新

### Q4: 更新 token 后需要重启吗?

- **开发环境**: 需要重启 `npm run dev`
- **生产环境**: Vercel 会自动重新部署

### Q5: 如何测试 token 是否工作?

```bash
# 开发环境
curl http://localhost:3000/api/feishu/token-status

# 生产环境
curl https://your-domain.vercel.app/api/feishu/token-status
```

---

## 🚨 错误代码

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| 10012 | refresh_token 无效 | 重新授权 |
| 99991400 | refresh_token 过期 | 重新授权 |
| 401 | 未授权 | 检查环境变量配置 |
| 403 | 权限不足 | 检查飞书应用权限 |

---

## 📚 相关文档

- [飞书 OAuth 文档](https://open.feishu.cn/document/common-capabilities/sso/api/get-user-access-token)
- [飞书多维表格 API](https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview)
- 项目文档: `docs/FEISHU_TOKEN_SETUP.md`

---

## 🎨 用户体验优化

### Token 状态页面特点

- ✅ 实时检查 token 状态
- ✅ 可视化状态展示
- ✅ 一键重新授权
- ✅ 自动显示授权链接
- ✅ 响应式设计,移动端友好

### 错误提示优化

```typescript
// 旧版本: 晦涩的错误
"刷新token失败: code 10012"

// 新版本: 友好的提示
"Refresh Token 已过期或无效，请重新授权。
访问: https://your-domain.com/feishu-auth"
```

---

## 🔐 安全建议

1. **不要提交 token 到 Git**
   - `.env.local` 已在 `.gitignore` 中
   - 生产环境使用 Vercel 环境变量

2. **定期轮换 token**
   - 建议每 25 天重新授权一次
   - 避免 token 突然过期

3. **最小权限原则**
   - 只授予必要的飞书权限
   - 当前需要: `bitable:app` (多维表格)

---

*最后更新: 2026-02-04*
