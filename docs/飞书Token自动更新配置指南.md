# 飞书 Token 自动更新配置指南

**日期**: 2026-02-05
**问题**: 为什么飞书 Refresh Token 没有自动更新到 Vercel？

---

## 📋 问题分析

### 当前情况

你已经实现了飞书 Token 自动更新到 Vercel 的功能（`app/api/feishu/update-vercel-token/route.ts`），但实际使用时发现 token 没有自动更新，还需要手动更新。

### 根本原因

**自动更新功能需要满足以下条件**（`lib/feishuAuth.ts:150`）：

```typescript
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_TOKEN) {
  console.log('[飞书Auth] 生产环境,尝试自动更新Vercel环境变量...')
  updateVercelToken(newRefreshToken)
}
```

1. ❌ **本地环境不会触发自动更新** - `VERCEL_ENV !== 'production'`
2. ❌ **缺少必需的环境变量** - 需要 `VERCEL_TOKEN` 和 `VERCEL_PROJECT_ID`

---

## ✅ 解决方案：配置自动更新

### 步骤 1: 获取 Vercel API Token

1. 访问 [Vercel Token 页面](https://vercel.com/account/tokens)
2. 点击 **"Create Token"**
3. 输入 Token 名称，例如：`auto-update-env-token`
4. 选择权限范围（Scope）：
   - ✅ **Full Account** 或
   - ✅ 选择特定项目并授予环境变量修改权限
5. 设置过期时间（建议选择 **No Expiration**）
6. 点击 **"Create"**
7. **立即复制 token**（只会显示一次）

示例 token 格式：
```
iMrS9dEhAbiTvdSpxxx...
```

### 步骤 2: 获取 Vercel Project ID

#### 方法 1：从 Vercel Dashboard

1. 进入你的 Vercel 项目页面
2. 点击 **Settings** → **General**
3. 找到 **Project ID** 字段
4. 复制 Project ID

示例：
```
prj_abc123xyz456
```

#### 方法 2：使用 Vercel CLI

```bash
vercel project ls
```

### 步骤 3: 获取 Vercel Team ID（如果项目在团队下）

如果你的项目属于团队（而不是个人账户），还需要配置 Team ID：

#### 方法 1：从 URL 获取

访问团队设置页面，URL 格式如下：
```
https://vercel.com/teams/[TEAM_SLUG]/settings
```

其中 `[TEAM_SLUG]` 就是你的 Team ID（有时也叫 Team Slug）。

#### 方法 2：使用 Vercel CLI

```bash
vercel teams ls
```

### 步骤 4: 在 Vercel 配置环境变量

登录 Vercel Dashboard，进入项目设置：

1. **Settings** → **Environment Variables**
2. 添加以下环境变量：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `VERCEL_TOKEN` | 你的 Vercel API Token | Production, Preview, Development |
| `VERCEL_PROJECT_ID` | 你的项目 ID | Production, Preview, Development |
| `VERCEL_TEAM_ID` | 你的团队 ID（如果有） | Production, Preview, Development |

**重要**:
- `VERCEL_TOKEN` 选择 **Sensitive** 类型（加密存储）
- 确保 Token 有足够的权限修改环境变量

### 步骤 5: 重新部署

配置完成后，触发一次重新部署：

```bash
git commit --allow-empty -m "chore: 配置自动更新环境变量"
git push
```

或在 Vercel Dashboard 中手动重新部署。

---

## 🔄 自动更新工作流程

配置完成后，以下是自动更新的完整流程：

```
1. 用户访问 /feishu-auth 进行授权
   ↓
2. 飞书返回新的 refresh_token
   ↓
3. 回调 API (/api/feishu/auth/callback) 接收 token
   ↓
4. getUserAccessToken() 检测到新 token
   ↓
5. 判断：是否在生产环境？(VERCEL_ENV === 'production')
   ↓ 是
6. 调用 updateVercelToken(newRefreshToken)
   ↓
7. 使用 VERCEL_TOKEN 调用 Vercel API
   ↓
8. 删除旧的 FEISHU_REFRESH_TOKEN 环境变量
   ↓
9. 创建新的 FEISHU_REFRESH_TOKEN 环境变量
   ↓
10. ✅ 更新成功！（需要重新部署才生效）
```

---

## 🧪 测试自动更新

配置完成后，可以在 Vercel 生产环境测试：

### 1. 触发 Token 刷新

访问 Vercel 生产环境的授权页面：
```
https://your-domain.vercel.app/feishu-auth
```

### 2. 完成授权

点击"开始授权" → 在飞书页面同意授权

### 3. 查看日志

在 Vercel Dashboard 中查看函数日志：

**Settings** → **Functions** → 选择最近的函数调用

应该能看到：
```
[飞书Auth] ⚠️  检测到新的 refresh_token
[飞书Auth] 生产环境,尝试自动更新Vercel环境变量...
[Vercel更新] 开始更新环境变量...
[Vercel更新] 删除旧的环境变量...
[Vercel更新] 创建新的环境变量...
[Vercel更新] ✅ 环境变量更新成功
[飞书Auth] ✅ Vercel环境变量已自动更新
```

### 4. 验证更新

1. 进入 **Settings** → **Environment Variables**
2. 查看 `FEISHU_REFRESH_TOKEN` 的值
3. 确认已更新为新 token（前几位字符应该不同）

---

## ⚠️ 注意事项

### 本地开发环境

**本地环境不会自动更新 Vercel 环境变量**，因为：
- `VERCEL_ENV` 在本地是 `undefined` 或 `development`
- 条件 `process.env.VERCEL_ENV === 'production'` 为 false

**本地测试时的行为**：
- Token 刷新成功后，只会在控制台输出：
  ```
  [飞书Auth] 请手动更新环境变量:
  FEISHU_REFRESH_TOKEN=ur-xxx...
  ```
- 需要手动复制新 token 到 `.env.local`

### Token 过期时间

- Refresh Token 有效期通常为 **30 天**
- 如果自动更新配置正确，token 会在每次刷新时自动更新
- 实际上 token 几乎不会过期（因为定期使用时会自动刷新）

### 权限问题

如果看到错误：
```
[Vercel更新] 错误: 创建环境变量失败: 403
```

说明 `VERCEL_TOKEN` 权限不足，需要：
1. 重新创建一个有完整权限的 token
2. 或在 token 设置中添加修改环境变量的权限

---

## 🔧 故障排查

### 问题 1: 日志中没有看到自动更新相关信息

**可能原因**:
- 不在生产环境（`VERCEL_ENV !== 'production'`）
- 飞书返回的 refresh_token 与当前相同（没有更新）

**解决方法**:
- 确认是在 Vercel 生产环境测试
- 等待 token 过期后重新授权

### 问题 2: 看到"未配置 VERCEL_TOKEN 或 VERCEL_PROJECT_ID"

**原因**: Vercel 环境变量未配置

**解决方法**: 按照"步骤 4"配置环境变量

### 问题 3: 自动更新成功但 token 还是过期

**原因**: 更新环境变量后需要重新部署

**解决方法**:
1. 触发一次新的部署（git push 或手动部署）
2. 或使用 Vercel CLI：`vercel --prod`

---

## 📊 当前状态

### 已配置（本地）

✅ `.env.local` 已更新为最新 token（2026-02-05 18:45）
```
FEISHU_REFRESH_TOKEN=ur-6GrJb9r2V1vVxLqJIplF6ylgmst0g1oNO0waFMs00d.8
```

### 待配置（Vercel）

⚠️ 需要在 Vercel 中手动更新：

1. **立即更新** `FEISHU_REFRESH_TOKEN`:
   ```
   ur-6GrJb9r2V1vVxLqJIplF6ylgmst0g1oNO0waFMs00d.8
   ```

2. **配置自动更新**（可选但推荐）:
   - 获取并配置 `VERCEL_TOKEN`
   - 获取并配置 `VERCEL_PROJECT_ID`
   - 如果项目在团队下，配置 `VERCEL_TEAM_ID`

---

## ✅ 最佳实践

1. **配置自动更新** - 一次配置，终身受益
2. **监控日志** - 定期检查 Vercel 函数日志
3. **备份 Token** - 将 token 保存到安全的地方
4. **设置提醒** - 如果不配置自动更新，在日历中设置 25 天后的提醒

---

**创建时间**: 2026-02-05 18:50
**维护人**: Claude
