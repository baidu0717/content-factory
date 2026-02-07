# Vercel 部署指南

## 一、快速部署步骤

### 步骤1：访问 Vercel

1. 打开浏览器，访问：https://vercel.com
2. 使用GitHub账号登录（baidu0717）

### 步骤2：导入项目

1. 点击 "Add New..." → "Project"
2. 在导入页面找到 `baidu0717/content-factory`
3. 点击 "Import"

### 步骤3：配置项目

**Framework Preset**: Next.js（自动检测）
**Root Directory**: ./
**Build Command**: npm run build
**Output Directory**: .next

点击 "Deploy" 开始第一次部署（会失败，因为缺少环境变量，这是正常的）

### 步骤4：配置环境变量

在项目设置中，找到 "Environment Variables"，添加以下变量：

---

## 二、必需环境变量清单

**复制以下内容，逐个添加到Vercel环境变量**

```bash
# ==================== AI服务 ====================
GEMINI_TEXT_API_KEY
你的Gemini密钥（从 https://aistudio.google.com/app/apikey 获取）

GEMINI_TEXT_MODEL
gemini-3-pro-preview

# ==================== 小红书发布 ====================
MYAIBOT_API_KEY
rn_95b1c43fa86396bbb84b2a1c86863d7303c6d40cc217e69ea7133296cff2

# ==================== 小红书采集 ====================
NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY
341289-ql9bvro52phb

NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE
https://api.meowload.net/openapi/extract/post

NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY
JZL1b7f46d7a6b92240

NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE
https://www.dajiala.com/fbmain/monitor/v3/xhs

# ==================== 飞书多维表格 ====================
FEISHU_APP_ID
cli_a9bac6be07789cc4

FEISHU_APP_SECRET
kqcP7odJy9x0AhtNMR5FYg4KPXs5lwRJ

FEISHU_REFRESH_TOKEN
ur-eXY9DxjJ55Irn0rDlBh7sz115gM0lgUpo82aVQk00Cjt

FEISHU_DEFAULT_APP_TOKEN
NNd8bJYazaBwHAsZ2z2cqsvmnqf

FEISHU_DEFAULT_TABLE_ID
tblu1m2GPcFRNSPE

FEISHU_API_URL
https://open.feishu.cn/open-apis

# ==================== Vercel KV（token存储）====================
# 这两个在后面步骤中获取
STORAGE_REST_API_URL
（稍后填写）

STORAGE_REST_API_TOKEN
（稍后填写）
```

**注意**：每个变量分两行：
- 第一行：变量名
- 第二行：变量值

### 步骤5：创建 Vercel KV 存储

1. 在项目页面，点击 "Storage" Tab
2. 点击 "Create Database"
3. 选择 "KV" (Key-Value Store)
4. 数据库名称：`content-factory-kv`
5. 选择区域：Hong Kong（香港，延迟最低）
6. 点击 "Create"
7. 创建完成后，点击 "Connect to Project"
8. 选择你的项目，点击 "Connect"
9. 系统会自动添加 `STORAGE_REST_API_URL` 和 `STORAGE_REST_API_TOKEN` 环境变量

### 步骤6：重新部署

1. 返回 "Deployments" Tab
2. 点击最新的部署
3. 点击右上角的 "..." → "Redeploy"
4. 确认 "Redeploy"

等待2-3分钟，部署完成！

---

## 三、部署后的访问地址

部署成功后，你会得到一个URL，格式类似：

```
https://content-factory-xxx.vercel.app
```

或者自定义域名（如果你配置了的话）：
```
https://你的域名.com
```

---

## 四、主要页面访问路径

部署成功后，访问以下路径：

### 1. 小红书采集页面
```
https://你的域名.vercel.app/xiaohongshu-extract
```

### 2. 文章发布管理
```
https://你的域名.vercel.app/publish
```

### 3. 文章创作
```
https://你的域名.vercel.app/create
```

### 4. 首页
```
https://你的域名.vercel.app
```

---

## 五、重要提醒：数据库限制

⚠️ **关于SQLite数据库**

你的项目使用SQLite数据库（`data.db`），但Vercel的Serverless环境**不支持持久化文件系统**。

这意味着：
- ✅ **飞书多维表格数据**：正常保存（在飞书云端）
- ❌ **本地articles表数据**：每次重新部署会丢失
- ❌ **本地feishu_notes表数据**：每次重新部署会丢失

### 解决方案

有三个选择：

#### 方案A：暂时接受限制（推荐测试阶段）
- 重点功能不受影响：小红书采集 → 飞书存储 → 发布
- articles表和feishu_notes表用于临时中转
- 重要数据都在飞书多维表格中

#### 方案B：迁移到Vercel Postgres（推荐长期）
- 免费版：256MB存储
- 持久化存储
- 需要修改代码（从SQLite改为PostgreSQL）

#### 方案C：使用Vercel KV存储
- 键值存储
- 需要重构数据访问层

**我的建议**：先用方案A测试线上功能，如果确定长期使用，再实施方案B。

---

## 六、手机访问配置

部署成功后，可以在手机上使用：

### 1. 手机浏览器直接访问
```
在Safari/Chrome中打开：https://你的域名.vercel.app/xiaohongshu-extract
```

### 2. 添加到主屏幕（iOS）
1. 在Safari中打开网站
2. 点击底部分享按钮
3. 选择"添加到主屏幕"
4. 像App一样使用

### 3. iOS快捷指令配置

部署后可以创建快捷指令：

```
快捷指令步骤：
1. 获取剪贴板
2. 获取URL内容
   URL: https://你的域名.vercel.app/api/xiaohongshu/quick-save
   方法: POST
   请求体: JSON
   {
     "url": "剪贴板内容",
     "appToken": "你的飞书APP_TOKEN",
     "tableId": "你的飞书TABLE_ID"
   }
3. 显示通知：已保存到飞书
```

---

## 七、更新代码流程

以后修改代码后，如何更新线上版本：

```bash
# 1. 提交代码
git add .
git commit -m "你的更新说明"

# 2. 推送到GitHub
git push origin main

# 3. Vercel自动部署
# 无需操作，Vercel会自动检测GitHub更新并重新部署
# 大约2-3分钟后，新版本上线
```

---

## 八、监控和日志

### 查看部署日志
1. 访问 Vercel Dashboard
2. 选择你的项目
3. 点击 "Deployments"
4. 点击具体的部署记录
5. 查看 "Build Logs" 和 "Function Logs"

### 查看运行时日志
1. 在部署详情页
2. 点击 "Runtime Logs"
3. 实时查看API调用日志

---

## 九、常见问题

### Q1: 部署失败，显示 "Build Error"
**解决**：
1. 检查环境变量是否都配置了
2. 查看Build Logs找到具体错误
3. 确保package.json中的dependencies都正确

### Q2: 部署成功，但打开页面500错误
**解决**：
1. 检查Runtime Logs查看错误信息
2. 可能是环境变量缺失
3. 检查API调用是否正常

### Q3: Gemini API调用失败
**解决**：
- Vercel的Serverless环境可能无法使用本地代理
- 需要移除代理配置（HTTP_PROXY）
- 或者使用Vercel的Edge Network

### Q4: 飞书登录失败
**解决**：
1. 检查FEISHU_REFRESH_TOKEN是否正确
2. Token可能过期，需重新登录获取

---

## 十、成本说明

### Vercel免费版额度
- ✅ 100GB 带宽/月
- ✅ 100GB 函数执行时间/月
- ✅ 无限请求次数
- ✅ 免费SSL证书
- ✅ 自动HTTPS

### Vercel KV免费版
- ✅ 256MB 存储
- ✅ 30条命令/秒
- ✅ 足够个人使用

### 总成本
**完全免费**（对于个人使用）

---

## 十一、下一步优化

部署成功后，可以考虑：

1. **绑定自定义域名**
   - 更专业的URL
   - 更容易记忆

2. **配置Vercel Analytics**
   - 查看访问统计
   - 性能监控

3. **升级数据库**
   - 迁移到Vercel Postgres
   - 实现数据持久化

4. **添加用户认证**
   - 如果要分享给别人使用
   - 保护你的API密钥

---

**准备好了吗？**

现在打开 https://vercel.com 开始部署吧！

有任何问题随时问我。
