# iOS 快捷指令 - 双表格配置指南

## 📊 你的两张飞书表格

### 表格1：个人表格
- **名称**: 小红书笔记采集（个人）
- **APP_TOKEN**: `NNd8bJYazaBwHAsZ2z2cqsvmnqf`
- **TABLE_ID**: `tblu1m2GPcFRNSPE`
- **URL**: https://ai.feishu.cn/base/NNd8bJYazaBwHAsZ2z2cqsvmnqf?table=tblu1m2GPcFRNSPE

### 表格2：工作表格
- **名称**: 小红书笔记采集（工作）
- **APP_TOKEN**: `McFGbxqi6aSd0HsBCSlc5kI7nwc`
- **TABLE_ID**: `tbltp6uHpdKRF68a`
- **URL**: https://my.feishu.cn/base/McFGbxqi6aSd0HsBCSlc5kI7nwc?table=tbltp6uHpdKRF68a

---

## 🎯 方案选择

你可以选择以下任一方案：

### 方案A：创建两个独立的快捷指令 ⭐ 推荐
- **优点**: 简单直接，一键保存
- **缺点**: 需要创建两个快捷指令
- **适合**: 不想每次选择，习惯固定用途

### 方案B：一个快捷指令 + 选择菜单
- **优点**: 只需要一个快捷指令
- **缺点**: 每次需要手动选择表格
- **适合**: 经常在两个表格间切换

---

## 方案A：创建两个独立的快捷指令

### 快捷指令1：保存到个人表格

#### 步骤1：创建快捷指令
1. 打开 iOS「快捷指令」App
2. 点击右上角 `+` 创建新快捷指令
3. 名称：`小红书→个人`

#### 步骤2：添加操作

##### 操作1：获取剪贴板
- 搜索并添加「获取剪贴板」操作

##### 操作2：获取 URL（从输入）
- 搜索并添加「从输入获取 URL」操作
- 输入：选择上一步的"剪贴板"变量

##### 操作3：调用 API
- 搜索并添加「获取 URL 内容」操作
- **URL**: `https://content-factory-jade-nine.vercel.app/api/xiaohongshu/quick-save`
- **方法**: `POST`
- **请求体**: 选择「JSON」
- **JSON 内容**:
```json
{
  "url": "URL",
  "appToken": "NNd8bJYazaBwHAsZ2z2cqsvmnqf",
  "tableId": "tblu1m2GPcFRNSPE",
  "async": true
}
```
> 注意：将 `"url"` 的值 `"URL"` 替换为变量（点击 `URL`，选择「获取 URL 内容」的结果）

##### 操作4：解析响应
- 搜索并添加「从输入获取词典值」操作
- 获取：`message`
- 从：选择上一步的「URL 内容」变量

##### 操作5：显示结果
- 搜索并添加「显示通知」或「显示结果」操作
- 显示：选择上一步的「词典值」变量

#### 步骤3：配置共享菜单
1. 点击快捷指令右上角 `···`
2. 打开「显示在共享表单中」
3. 接受类型：文本、URL

---

### 快捷指令2：保存到工作表格

重复上面的步骤，但修改：
- **名称**: `小红书→工作`
- **JSON 内容**中的表格信息：
```json
{
  "url": "URL",
  "appToken": "McFGbxqi6aSd0HsBCSlc5kI7nwc",
  "tableId": "tbltp6uHpdKRF68a",
  "async": true
}
```

---

## 方案B：一个快捷指令 + 选择菜单

### 步骤1：创建快捷指令
1. 打开 iOS「快捷指令」App
2. 点击右上角 `+` 创建新快捷指令
3. 名称：`小红书采集`

### 步骤2：添加操作

#### 操作1：获取剪贴板
- 添加「获取剪贴板」操作

#### 操作2：获取 URL
- 添加「从输入获取 URL」操作
- 输入：选择"剪贴板"变量

#### 操作3：选择表格
- 添加「从菜单中选择」操作
- 提示：`选择保存到哪个表格`
- 菜单项：
  - `个人表格`
  - `工作表格`

#### 操作4：如果（个人表格）
- 添加「如果」操作
- 条件：「菜单结果」 等于 `个人表格`
- 在"如果"块中，添加「设定变量」操作：
  - 变量名: `appToken`
  - 值: `NNd8bJYazaBwHAsZ2z2cqsvmnqf`
- 再添加「设定变量」操作：
  - 变量名: `tableId`
  - 值: `tblu1m2GPcFRNSPE`

#### 操作5：否则（工作表格）
- 点击「否则」
- 在"否则"块中，添加「设定变量」操作：
  - 变量名: `appToken`
  - 值: `McFGbxqi6aSd0HsBCSlc5kI7nwc`
- 再添加「设定变量」操作：
  - 变量名: `tableId`
  - 值: `tbltp6uHpdKRF68a`

#### 操作6：结束 If

#### 操作7：调用 API
- 添加「获取 URL 内容」操作
- **URL**: `https://content-factory-jade-nine.vercel.app/api/xiaohongshu/quick-save`
- **方法**: `POST`
- **请求体**: 选择「JSON」
- **JSON 内容**:
```json
{
  "url": "URL",
  "appToken": "appToken变量",
  "tableId": "tableId变量",
  "async": true
}
```

#### 操作8-9：解析响应并显示
（同方案A的操作4-5）

---

## 📱 使用方法

### 方式1：从小红书分享
1. 在小红书 App 中打开笔记
2. 点击「分享」→「复制链接」
3. 运行快捷指令（方案A选择对应的指令，方案B选择表格）

### 方式2：从剪贴板
1. 复制小红书链接到剪贴板
2. 运行快捷指令

---

## ⚙️ 高级配置

### 异步模式说明
配置中的 `"async": true` 表示异步模式：
- ✅ 快捷指令立即返回，后台处理
- ✅ 适合慢速网络，不会卡住
- ⚠️ 需要稍后刷新飞书表格查看结果

如果你希望等待结果（同步模式），可以改为：
```json
{
  "url": "URL",
  "appToken": "...",
  "tableId": "...",
  "async": false
}
```
或者直接删除 `"async"` 字段。

---

## 🔧 故障排查

### 问题1：快捷指令报错"无法连接到服务器"
- 检查网络连接
- 确认 API URL 正确：`https://content-factory-jade-nine.vercel.app/api/xiaohongshu/quick-save`

### 问题2：保存失败，提示"未配置飞书表格信息"
- 检查 JSON 中的 `appToken` 和 `tableId` 是否正确
- 确认已正确设置变量

### 问题3：图片丢失
- 查看 Vercel 日志找到具体错误
- 重新运行快捷指令采集该笔记

### 问题4：飞书 Token 过期
- 访问 https://content-factory-jade-nine.vercel.app/feishu-auth 重新授权

---

## 📝 注意事项

1. **保持 FEISHU_REFRESH_TOKEN 更新**
   - 如果图片上传失败，可能是 Token 过期
   - 重新授权后需要更新 Vercel 环境变量

2. **表格字段结构必须一致**
   - 新表格需要包含所有字段：笔记链接、作者昵称、封面、图片2、后续图片、标题、正文、话题标签等
   - 字段名必须完全一致

3. **API 限制**
   - 极致了 API 可能有调用频率限制
   - 建议不要短时间内大量采集

---

## ✅ 推荐配置

根据你的使用习惯：

- **如果个人和工作内容明确分开** → 使用方案A（两个独立快捷指令）
- **如果经常需要灵活选择** → 使用方案B（选择菜单）

我个人推荐**方案A**，因为：
1. 更快捷，不需要每次选择
2. 可以在 iOS 主屏幕添加两个快捷指令小组件
3. 更不容易出错

---

需要帮助配置吗？如果在操作过程中遇到问题，随时告诉我！
