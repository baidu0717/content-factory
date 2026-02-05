# Vercel 部署检查清单

**日期**: 2026-02-05
**目的**: 确保小红书解析功能在 Vercel 上正常工作

---

## ✅ 必须配置的环境变量

### 1. 极致了 API 配置（小红书解析）

```bash
NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY=JZL1b7f46d7a6b92240
```

**说明**:
- 用于调用极致了API的笔记详情接口（type=11）
- 获取笔记标题、正文、图片、作者、互动数据

**如何配置**:
1. 登录 Vercel Dashboard
2. 进入项目 → Settings → Environment Variables
3. 添加变量名和值
4. 选择所有环境（Production, Preview, Development）

---

### 2. 飞书应用凭证

```bash
FEISHU_APP_ID=cli_a9bac6be07789cc4
FEISHU_APP_SECRET=kqcP7odJy9x0AhtNMR5FYg4KPXs5lwRJ
```

**说明**: 用于飞书应用认证，上传图片和操作表格

---

### 3. 飞书 Refresh Token（重要！）

```bash
FEISHU_REFRESH_TOKEN=ur-7IkyPjBX59x824j9UgEe1m151sX501MhVwyaVB8029GV
```

**说明**:
- 用于访问用户的飞书多维表格
- **这个 token 会定期自动刷新**
- 最后更新: 2026-02-05 17:30

⚠️ **重要**:
- 如果图片无法显示，很可能是这个 token 过期了
- 需要定期从本地服务器日志中获取最新的 token 并更新到 Vercel

**如何获取最新 token**:
1. 本地运行 `npm run dev`
2. 访问任何需要飞书权限的页面
3. 查看控制台日志中的 `[飞书Auth] 新token: ur-...`
4. 复制完整的新 token
5. 更新到 Vercel 环境变量

---

### 4. 飞书默认表格配置

```bash
FEISHU_DEFAULT_APP_TOKEN=NNd8bJYazaBwHAsZ2z2cqsvmnqf
FEISHU_DEFAULT_TABLE_ID=tblu1m2GPcFRNSPE

NEXT_PUBLIC_FEISHU_DEFAULT_APP_TOKEN=NNd8bJYazaBwHAsZ2z2cqsvmnqf
NEXT_PUBLIC_FEISHU_DEFAULT_TABLE_ID=tblu1m2GPcFRNSPE
```

**说明**: iOS 快捷指令使用的默认表格

---

## ❌ 不需要配置的环境变量

### 已移除的 API

```bash
# ❌ 哼哼猫 API（已移除，不再使用）
# NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY=...
# NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE=...
```

**重要**: 如果 Vercel 上还有这些变量，建议删除

---

### 本地开发专用（不要设置到 Vercel）

```bash
# ❌ 代理配置（Vercel不需要）
# HTTP_PROXY=http://127.0.0.1:6152
# HTTPS_PROXY=http://127.0.0.1:6152
```

**说明**:
- 代理仅用于本地开发访问 Gemini API
- Vercel 部署在国外，不需要代理
- **千万不要**设置到 Vercel 环境变量中

---

## 🔍 图片不显示问题排查

### 问题1: 飞书 Token 过期

**症状**:
- 笔记内容能保存到飞书表格
- 标题、正文、作者、互动数据都正常
- 但图片字段为空

**原因**: `FEISHU_REFRESH_TOKEN` 过期，无法上传图片到飞书

**解决方法**:
1. 从本地日志获取最新 token（见上文）
2. 更新 Vercel 环境变量
3. 重新部署或等待自动部署

**验证方法**:
```bash
# 在 Vercel 部署后，查看函数日志
# 如果看到这样的错误，说明 token 过期了：
[飞书API] 上传图片失败: {"code":99991663,"msg":"token expired"}
```

---

### 问题2: 极致了 API 返回的图片 URL 无效

**症状**: 图片 URL 能保存到飞书，但无法显示

**检查方法**:
1. 在飞书表格中查看图片字段的值
2. 如果是空的，说明极致了 API 没有返回图片
3. 如果有值但无法显示，说明图片 URL 可能失效

**解决方法**:
- 检查极致了 API 的响应数据
- 确认 `note.images_list` 数组不为空

---

### 问题3: 飞书图片上传失败

**症状**: 控制台显示图片下载成功，但上传失败

**可能原因**:
1. 图片过大（超过飞书限制）
2. 图片格式不支持
3. 网络超时

**解决方法**:
- 检查 `app/api/feishu/append-row/route.ts` 中的错误日志
- 增加超时时间或添加重试逻辑

---

## 🚀 部署流程

### 1. 提交代码

```bash
git add .
git commit -m "feat: 统一使用极致了API + 修复短链接支持"
git push origin main
```

### 2. Vercel 自动部署

- Vercel 会自动检测到代码更新
- 自动触发构建和部署
- 等待 1-2 分钟

### 3. 验证部署

访问你的 Vercel 域名，例如：
```
https://your-project.vercel.app
```

### 4. 测试功能

使用快捷指令测试：
1. 复制一个小红书笔记链接
2. 运行快捷指令
3. 检查飞书表格中的数据

---

## 📊 环境变量对比

| 变量名 | 本地 (.env.local) | Vercel | 说明 |
|--------|------------------|--------|------|
| `NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY` | ✅ 必需 | ✅ 必需 | 极致了 API Key |
| `FEISHU_APP_ID` | ✅ 必需 | ✅ 必需 | 飞书应用ID |
| `FEISHU_APP_SECRET` | ✅ 必需 | ✅ 必需 | 飞书应用密钥 |
| `FEISHU_REFRESH_TOKEN` | ✅ 必需 | ✅ 必需 | 飞书用户 token（需定期更新）|
| `HTTP_PROXY` | ⚠️  可选 | ❌ 不要设置 | 仅本地需要 |
| `HTTPS_PROXY` | ⚠️  可选 | ❌ 不要设置 | 仅本地需要 |

---

## 🔧 常见错误和解决方法

### 错误1: "获取笔记详情失败"

```json
{
  "success": false,
  "error": "获取笔记详情失败，请稍后重试"
}
```

**可能原因**:
1. 极致了 API Key 未配置或错误
2. 笔记 ID 无效
3. 笔记已被删除

**检查**:
- 确认 `NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY` 已设置
- 测试用一个确定有效的笔记链接

---

### 错误2: "用户未登录或登录已过期"

```json
{
  "success": false,
  "error": "用户未登录或登录已过期，请重新登录",
  "needLogin": true
}
```

**原因**: `FEISHU_REFRESH_TOKEN` 过期

**解决**: 更新 Vercel 环境变量中的 refresh_token

---

### 错误3: 图片字段为空

**原因**: 图片上传过程失败

**检查步骤**:
1. Vercel Dashboard → 项目 → Functions → 查看最近的日志
2. 搜索 `[飞书导出API]` 或 `[图片下载]`
3. 查看具体错误信息

---

## ✅ 最终检查清单

部署前确认：

- [ ] 已移除哼哼猫 API 相关代码
- [ ] `app/api/xiaohongshu/parse/route.ts` 只使用极致了 API
- [ ] `.env.local` 中的 `FEISHU_REFRESH_TOKEN` 已更新为最新
- [ ] 代码已提交到 Git
- [ ] Vercel 环境变量已配置完整（特别是 `FEISHU_REFRESH_TOKEN`）
- [ ] Vercel 上没有设置 `HTTP_PROXY` 或 `HTTPS_PROXY`
- [ ] 本地测试通过

部署后确认：

- [ ] Vercel 构建成功
- [ ] 访问网站正常
- [ ] 使用快捷指令测试通过
- [ ] 飞书表格中所有字段都有值：
  - [ ] 笔记链接
  - [ ] 标题
  - [ ] 正文
  - [ ] 话题标签
  - [ ] 作者昵称
  - [ ] 浏览数、点赞数、收藏数、评论数
  - [ ] 封面图片
  - [ ] 图片2（如果有）

---

## 🆘 获取帮助

如果遇到问题：

1. **查看 Vercel 日志**:
   - Vercel Dashboard → 项目 → Functions
   - 选择最近的函数调用
   - 查看详细日志

2. **本地复现**:
   - 确保本地 `.env.local` 配置与 Vercel 一致
   - 运行 `npm run dev`
   - 测试相同的笔记链接

3. **检查 API 状态**:
   - 极致了 API: https://dajiala.com/
   - 确认 API Key 是否有效
   - 确认 API 配额是否用完

---

**最后更新**: 2026-02-05
**维护人**: Claude
