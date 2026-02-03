# 飞书 Token 自动更新配置指南

## 问题背景

飞书的 `FEISHU_REFRESH_TOKEN` 有效期通常为 30 天，过期后需要重新获取。频繁手动更新token会很麻烦。

## 解决方案

我们创建了一个自动化的授权流程，让你可以通过网页一键获取新的 token。

---

## 📋 配置步骤

### 1. 在飞书开放平台配置回调地址

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 进入你的应用（App ID: `cli_a9bac6be07789cc4`）
3. 找到 **安全设置** → **重定向URL**
4. 添加以下回调地址：

```
本地开发:
http://localhost:3000/api/feishu/auth/callback

生产环境 (部署到 Vercel 后):
https://你的域名.vercel.app/api/feishu/auth/callback
```

5. 保存配置

### 2. 使用授权页面获取 Token

#### 本地开发环境:

1. 确保开发服务器正在运行:
   ```bash
   npm run dev
   ```

2. 在浏览器中打开:
   ```
   http://localhost:3000/feishu-auth
   ```

3. 点击 **"开始授权"** 按钮

4. 跳转到飞书登录页面，使用有权限的账号登录并授权

5. 授权成功后会自动跳转回应用，显示新的 `REFRESH_TOKEN`

6. 复制新的 token，更新 `.env.local` 文件:
   ```bash
   FEISHU_REFRESH_TOKEN=ur-xxxxxxxxxxxxx
   ```

7. 重启开发服务器（如果需要）

#### 生产环境:

部署到 Vercel 后，访问:
```
https://你的域名.vercel.app/feishu-auth
```

---

## 🔄 Token 刷新流程

### 自动刷新机制

应用已经实现了自动刷新逻辑（在 `lib/feishuAuth.ts` 中）:

1. **内存缓存**: token 会缓存在内存中
2. **提前刷新**: 在 token 过期前 5 分钟自动刷新
3. **新 token 提示**: 如果获得新的 refresh_token，会在日志中提示

### 查看日志中的新 token

当应用检测到新的 refresh_token 时，会在控制台输出:

```
[飞书Auth] ⚠️  检测到新的 refresh_token，请更新环境变量:
FEISHU_REFRESH_TOKEN=ur-xxxxxxxxxxxxx
```

你可以：
1. 复制日志中的新 token
2. 更新 `.env.local` 文件
3. 重启开发服务器

---

## 🚨 Token 过期处理

### 识别 Token 过期

当看到以下错误时，说明 token 已过期:

```
[飞书Auth] 刷新user_access_token失败: {
  code: 20038,
  message: 'The refresh token passed is invalid. It may have been used.'
}
```

### 快速解决

1. 访问 `http://localhost:3000/feishu-auth`
2. 重新授权获取新 token
3. 更新 `.env.local` 文件
4. 重启服务器

**建议**: 将授权页面加入浏览器书签，方便快速访问

---

## 📝 技术细节

### API 端点

1. **GET /api/feishu/auth/url**
   - 生成飞书 OAuth 授权链接
   - 返回授权URL和回调地址

2. **GET /api/feishu/auth/callback**
   - 接收飞书授权回调
   - 使用授权码换取 refresh_token
   - 重定向到结果页面

### 授权流程

```
用户访问 /feishu-auth
    ↓
点击"开始授权"
    ↓
GET /api/feishu/auth/url (获取授权链接)
    ↓
跳转到飞书授权页面
    ↓
用户登录并授权
    ↓
飞书回调 /api/feishu/auth/callback?code=xxx
    ↓
后端用 code 换取 refresh_token
    ↓
重定向到 /feishu-auth?success=true&refresh_token=xxx
    ↓
页面展示新 token，用户复制并更新配置
```

---

## 🎯 最佳实践

1. **定期更新**: 建议每 2-3 周主动刷新一次 token，避免过期
2. **监控日志**: 关注日志中的 token 更新提示
3. **备份 token**: 将当前有效的 token 备份，以防意外
4. **Vercel 环境变量**: 部署到 Vercel 后，记得在 Vercel 后台同步更新环境变量

---

## ❓ 常见问题

### Q: 为什么需要配置回调地址?

A: 飞书 OAuth 流程要求回调地址必须在开放平台白名单中，否则授权会失败。

### Q: 本地开发的回调地址可以用吗?

A: 可以！飞书支持 `localhost` 回调地址，方便本地开发测试。

### Q: 如果忘记更新 Vercel 环境变量会怎样?

A: 本地更新的 token 不会自动同步到 Vercel。部署的应用会继续使用旧 token，直到过期。记得手动在 Vercel 后台更新。

### Q: Token 过期会影响正在进行的操作吗?

A: 会的。如果操作过程中 token 过期，会导致 API 调用失败。建议定期检查并更新。

---

## 📚 相关文档

- [飞书开放平台 - OAuth 2.0](https://open.feishu.cn/document/common-capabilities/sso/api/get-user-access-token)
- [飞书开放平台 - 刷新 access_token](https://open.feishu.cn/document/common-capabilities/sso/api/refresh-access-token)

---

## 🆘 需要帮助?

如果遇到问题，请检查:

1. 飞书开放平台是否正确配置了回调地址
2. `.env.local` 中的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确
3. 授权时使用的账号是否有访问多维表格的权限
4. 浏览器控制台和服务器日志中的错误信息
