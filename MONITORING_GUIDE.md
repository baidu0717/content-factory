# 定时监控功能使用指南

## 功能介绍

定时监控功能可以自动定时分析指定的关键词，并将分析报告推送到飞书群组，让你每天早上自动获取选题洞察，无需手动操作。

## 功能特性

- ✅ 支持配置多个监控关键词（公众号/小红书）
- ✅ 每天定时自动执行分析（默认早上8点）
- ✅ AI 智能分析生成选题洞察
- ✅ 自动推送报告到飞书群组
- ✅ 查看历史执行记录
- ✅ 支持手动触发分析

## 快速开始

### 1. 安装依赖

```bash
npm install
```

新增的依赖包括：
- `node-cron` - 定时任务调度
- `ts-node` - TypeScript 执行器

### 2. 配置飞书 Webhook

1. 打开应用，进入「定时监控」页面
2. 点击「系统设置」按钮
3. 填入你的飞书 Webhook 地址（已默认配置）
4. 可选：修改 Cron 表达式（默认: `0 8 * * *` 每天早上8点）

#### 获取飞书 Webhook 地址

1. 在飞书中创建一个群组
2. 点击群组设置 → 群机器人 → 添加机器人 → 自定义机器人
3. 设置机器人名称和描述
4. 复制生成的 Webhook 地址
5. 将地址配置到系统设置中

### 3. 添加监控关键词

1. 在「定时监控」页面点击「添加关键词」
2. 输入关键词（如：AI创作、内容营销等）
3. 选择平台（公众号或小红书）
4. 点击「添加」

### 4. 启动定时任务

#### 方式A：使用 Node.js Cron 脚本（推荐）

**开发环境：**

```bash
# 启动定时任务（按配置的时间执行）
npm run cron

# 或者立即执行一次（测试用）
npm run cron:dev
```

**生产环境（使用 PM2）：**

```bash
# 安装 PM2
npm install -g pm2

# 启动定时任务
pm2 start scripts/cron-scheduler.ts --name "content-factory-cron"

# 查看日志
pm2 logs content-factory-cron

# 停止任务
pm2 stop content-factory-cron

# 重启任务
pm2 restart content-factory-cron

# 开机自启
pm2 startup
pm2 save
```

#### 方式B：使用系统 Cron

编辑系统 crontab：

```bash
crontab -e
```

添加定时任务（每天早上8点执行）：

```cron
0 8 * * * curl -X POST http://localhost:3000/api/cron/daily-analysis -H "x-api-key: your-secret-key"
```

注意：需要设置环境变量 `CRON_API_KEY=your-secret-key`

#### 方式C：使用云服务定时器

如 Vercel Cron、GitHub Actions、AWS EventBridge 等，定时调用：

```
POST http://your-domain.com/api/cron/daily-analysis
Header: x-api-key: your-secret-key
```

## 使用说明

### 监控关键词管理

- **添加关键词：** 点击「添加关键词」按钮
- **启用/禁用：** 点击关键词卡片右侧的播放/暂停按钮
- **删除关键词：** 点击关键词卡片右侧的删除按钮

### 手动执行分析

如果不想等待定时任务，可以立即执行：

1. 在「定时监控」页面点击「立即执行」按钮
2. 确认执行
3. 等待分析完成（可能需要几分钟）
4. 查看执行结果

### 查看执行历史

1. 点击「执行历史」按钮
2. 查看每次执行的结果
3. 检查推送状态和错误信息

## 飞书消息卡片示例

每次分析完成后，会推送如下格式的消息卡片到飞书群组：

```
📱 公众号选题分析日报 - AI创作
📅 2025-01-15

📊 数据概览
分析文章数：156 篇
平均阅读量：28,500
平均点赞数：2,340
平均互动率：8.2%

🏆 点赞量TOP5
1. [文章标题](链接)
   👍 12,580 | 👀 45,000 | 📊 28%
...

✨ AI 选题洞察
1. 📈 AI工具成为内容创作新趋势
超过60%的高互动文章提到了AI工具的应用...
...

🎯 推荐选题方向
1. AI辅助内容创作实战案例
2. ChatGPT在内容运营中的应用
...

💡 本报告由 AI 智能分析生成，数据来源于最近7天热门内容
━━━━━━━━━━━━━━━━━━━━━━━
[📊 查看完整报告]  <- 点击此按钮跳转到详细报告页面
```

### 查看完整报告

飞书消息卡片中包含"查看完整报告"按钮，点击后可以：

1. 查看完整的 AI 洞察分析
2. 浏览所有 TOP 文章的详细信息
3. 了解创作建议和推荐选题
4. 分享报告链接给团队成员

报告链接格式：`http://your-domain.com/reports/{reportId}`

## 环境变量配置

在 `.env.local` 中配置以下变量：

```env
# 应用地址（用于生成报告链接，必须配置）
# 开发环境使用 http://localhost:3000
# 生产环境使用你的实际域名，如 https://yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron API 密钥（保护定时任务API）
CRON_API_KEY=your-secret-key-here

# 其他已有的环境变量...
NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY=xxx
OPENAI_API_KEY=xxx
```

**重要提示：**
- `NEXT_PUBLIC_APP_URL` 用于生成飞书消息中的"查看完整报告"按钮链接
- 开发环境：使用 `http://localhost:3000`
- 生产环境：使用你的实际域名，确保飞书可以访问此域名

## Cron 表达式说明

格式：`秒 分 时 日 月 周`

常用示例：

- `0 8 * * *` - 每天早上8点
- `0 9,17 * * *` - 每天早上9点和下午5点
- `0 8 * * 1-5` - 工作日早上8点
- `0 */2 * * *` - 每2小时执行一次
- `30 8 * * *` - 每天早上8点30分

在线工具：https://crontab.guru/

## 故障排查

### 问题1：定时任务没有执行

**检查步骤：**
1. 确认 Cron 脚本是否正在运行：`pm2 list`
2. 查看日志：`pm2 logs content-factory-cron`
3. 检查 Cron 表达式是否正确
4. 确认关键词是否已启用

### 问题2：飞书推送失败

**检查步骤：**
1. 验证 Webhook 地址是否正确
2. 测试 Webhook 连接（在系统设置中）
3. 检查飞书机器人是否被禁用
4. 查看执行历史中的错误信息

### 问题3：AI 分析失败

**检查步骤：**
1. 确认 OpenAI API Key 是否配置
2. 检查 API 余额是否充足
3. 查看应用日志中的详细错误

### 问题4：数据库错误

**检查步骤：**
1. 确认 `data/app.db` 目录存在
2. 检查数据库文件权限
3. 重启应用以重新初始化数据库

## API 接口文档

### 关键词管理 API

**获取关键词列表**
```
GET /api/monitored-keywords
```

**添加关键词**
```
POST /api/monitored-keywords
Body: { keyword: string, platform: 'wechat' | 'xiaohongshu', enabled: 0 | 1 }
```

**更新关键词**
```
PUT /api/monitored-keywords
Body: { id: number, enabled?: 0 | 1 }
```

**删除关键词**
```
DELETE /api/monitored-keywords?id={id}
```

### 定时任务 API

**执行每日分析**
```
POST /api/cron/daily-analysis
Header: x-api-key: your-secret-key
```

**健康检查**
```
GET /api/cron/daily-analysis
Header: x-api-key: your-secret-key
```

### 报告管理 API

**获取报告列表**
```
GET /api/scheduled-reports?limit=20&offset=0
```

### 系统设置 API

**获取设置**
```
GET /api/settings
```

**更新设置**
```
PUT /api/settings
Body: { key: string, value: string }
```

**测试飞书 Webhook**
```
POST /api/settings
Body: { action: 'test_feishu_webhook', webhookUrl: string }
```

## 最佳实践

1. **合理设置关键词数量：** 建议不超过10个，避免执行时间过长
2. **选择合适的执行时间：** 建议在早上8-9点，获取最新数据
3. **定期检查执行历史：** 及时发现和处理错误
4. **测试飞书推送：** 添加关键词后先手动执行一次测试
5. **监控日志：** 定期查看 PM2 日志，确保任务正常运行

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     定时监控系统                           │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼──────┐    ┌─────▼─────┐
   │ Cron脚本 │      │  Web前端    │    │  数据库   │
   │(Node.js) │      │  (Next.js)  │    │ (SQLite)  │
   └────┬────┘      └──────┬──────┘    └─────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                ┌──────────▼──────────┐
                │  调度器核心逻辑      │
                │  (lib/scheduler.ts) │
                └──────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼──────┐    ┌─────▼─────┐
   │ 微信API  │      │ 小红书API   │    │ AI分析API │
   └────┬────┘      └──────┬──────┘    └─────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  飞书推送    │
                    │  (Webhook)   │
                    └──────────────┘
```

## 更新日志

### v1.0.0 (2025-01-15)
- ✅ 初始版本发布
- ✅ 支持公众号和小红书关键词监控
- ✅ 定时任务自动执行
- ✅ 飞书消息卡片推送
- ✅ AI 智能分析集成

## 支持

如有问题，请提交 Issue 或联系开发团队。
