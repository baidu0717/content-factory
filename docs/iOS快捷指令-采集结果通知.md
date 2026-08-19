# iOS 快捷指令 — 采集成功/失败通知

2026-08-19 更新。让快捷指令在采集完成后弹出结果通知，而不是只说「已提交后台」。

## 为什么原来收不到结果

请求体里的 `"async": true` 表示异步模式：接口**立即返回**，解析和入库都在后台跑完，所以快捷指令那一刻还不知道成功没有，只能回一句「正在后台保存」。

改成同步模式后，接口会等解析 + 飞书建记录跑完再返回（通常 8~15 秒），返回的 `message` 就是真实结果。图片下载上传仍在后台进行，不占用等待时间。

## 需要改两处

### 1. 请求体：`async` 改成 `false`

```json
{
  "url": "剪贴板变量",
  "appToken": "NNd8bJYazaBwHAsZ2z2cqsvmnqf",
  "tableId": "tblui0WTMQKOrs5X",
  "async": false
}
```

也可以直接删掉 `"async"` 这一行，默认就是同步。

### 2. 在「获取 URL 内容」后面加两步

| 步骤 | 操作 |
|------|------|
| 获取词典值 | 从「获取 URL 内容」取键 `message` |
| 显示通知 | 内容选上一步的结果 |

想要更醒目可以把「显示通知」换成「显示提醒」（需要点确认才消失）。

## 会收到哪三种消息

**采集成功**

```
✅ 采集成功

📝 🇻🇦梵蒂冈博物馆&圣彼得大教堂入口指南
👤 胖丁啵喱（欧洲solo已回）
📸 10 张图片后台上传中
👍 473 · ⭐ 763 · 💬 33
⏱️ 耗时8001ms
```

**采集失败**（飞书里会留一条占位记录，标题为「⚠️ 待补充」，需手动补内容）

```
⚠️ 采集失败，已在飞书建占位记录
原因：小红书风控拦截（sec_server），解析节点暂时不可用，请稍后重试
需手动补充标题和正文

📝 ⚠️ 待补充
👤 (待填写)
👍 0 · ⭐ 0 · 💬 0
⏱️ 耗时18335ms
```

常见的「原因」：

| 原因 | 含义 | 怎么办 |
|------|------|--------|
| 小红书上游抓取失败（已自动重试） | apizero 代理池两轮都没抓到 | 隔一会儿重新发一次链接 |
| 小红书风控拦截（sec_server） | 解析节点被小红书风控 | 等几分钟再试 |
| 短链无法展开，建议发完整链接 | xhslink 短链没跳转成功 | 在小红书里用「复制链接」拿完整链接 |
| apizero 额度已用完 | 付费额度耗尽 | 去 apizero 控制台充值 |
| 调用过快被限流 | 超过 QPS 3 | 等 1 秒再发 |

**上游太慢转后台**（解析超过 20 秒才会出现，少见）

```
⏳ 上游较慢，已转后台继续采集
稍后到飞书表格查看结果
```

## 判断成功失败的字段

响应里的 `success` 会跟着结果走，需要在快捷指令里分支（比如失败时震动提醒）可以用它：

| 情况 | success |
|------|---------|
| 采集成功 | `true` |
| 采集失败（占位记录） | `false` |
| 转后台 | `true` |

## 表格 ID 对照

| 表格 | appToken | tableId |
|------|----------|---------|
| 灵感 | NNd8bJYazaBwHAsZ2z2cqsvmnqf | tblui0WTMQKOrs5X |
| 法意瑞 | NNd8bJYazaBwHAsZ2z2cqsvmnqf | tblu1m2GPcFRNSPE |
| 法意瑞（糖果） | NNd8bJYazaBwHAsZ2z2cqsvmnqf | tblf26FLVBvnORZ6 |
| 西班牙 | NNd8bJYazaBwHAsZ2z2cqsvmnqf | tbltUxC0qElUbibT |
| 意大利 | NNd8bJYazaBwHAsZ2z2cqsvmnqf | tbl5WFtr4k8sQVJP |
| 行程大师 | NNd8bJYazaBwHAsZ2z2cqsvmnqf | tblYADBXNeunodK3 |
| 聚光投放 | McFGbxqi6aSd0HsBCSlc5kI7nwc | tbltp6uHpdKRF68a |

接口地址：`https://content-factory-jade-nine.vercel.app/api/xiaohongshu/quick-save`
