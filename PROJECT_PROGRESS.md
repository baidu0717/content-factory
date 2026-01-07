# 小红书内容工厂 - 项目进度文档

**更新时间：** 2026-01-07
**版本：** v1.2 - 多维度采集功能

---

## 📋 目录

- [已实现功能](#已实现功能)
- [技术架构](#技术架构)
- [关键配置](#关键配置)
- [问题与解决方案](#问题与解决方案)
- [下一步计划](#下一步计划)

---

## ✅ 已实现功能

### 1. 小红书笔记采集

#### 1.1 基础采集功能
- ✅ 关键词搜索采集
- ✅ 支持 Web API (type=1) 和 APP API v2 (type=9)
- ✅ 自动分页采集（每页20条）
- ✅ 实时进度显示
- ✅ 成本计算（0.1元/次）

#### 1.2 多维度采集功能 🆕
**文件：** `app/collect/page.tsx`

**功能描述：**
- 使用4种排序方式同时采集同一关键词
- 自动去重合并结果
- 每种排序采集前100条笔记

**排序策略：**
```javascript
const strategies = [
  { sort: 'popularity_descending', label: '点赞最多', apiType: 9 },
  { sort: 'collect_descending', label: '收藏最多', apiType: 9 },
  { sort: 'comment_descending', label: '评论最多', apiType: 9 },
  { sort: 'general', label: '综合排序', apiType: 9 },
]
```

**关键参数：**
- `type: 9` - APP API v2
- `note_type: 'note'` - 普通笔记
- `note_time: 'halfyear'` - 半年内
- `page: 字符串` - 页码格式
- `searchId` / `sessionId` - 分页参数（必传，首次为空字符串）

**实际效果：**
- 搜索"法意瑞小团"：采集223条（去重后）
- 成本：约2元
- 素人笔记占比：约33%

### 2. 飞书多维表格集成

#### 2.1 表格创建与管理
- ✅ 自动创建多维表格（使用应用身份）
- ✅ 设置权限为"任何人可编辑"
- ✅ 支持默认表格（所有采集添加到同一张表）

**重要：应用身份创建表格的权限设置流程**

**为什么使用应用身份（app_access_token）？**
- ✅ 支持图片上传到附件字段（user_access_token不支持）
- ✅ 不需要用户登录授权
- ✅ 权限稳定，不会过期

**创建流程：**

1. **获取应用令牌**
   ```javascript
   // lib/feishu-bitable.ts
   async function getAppAccessToken() {
     const response = await fetch(
       `${FEISHU_API_URL}/auth/v3/app_access_token/internal`,
       {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           app_id: FEISHU_APP_ID,
           app_secret: FEISHU_APP_SECRET,
         }),
       }
     )
     const data = await response.json()
     return data.app_access_token
   }
   ```

2. **创建多维表格**
   ```javascript
   const response = await fetch(`${FEISHU_API_URL}/bitable/v1/apps`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`,
     },
     body: JSON.stringify({
       name: '小红书笔记采集',
       folder_token: folderId  // 可选
     }),
   })
   ```

3. **关键：设置公开权限（必须！）**

   ⚠️ **应用创建的表格默认只有应用自己可访问，用户无法编辑！**

   必须调用权限API设置为"任何人可编辑"：

   ```javascript
   async function setPublicPermission(appToken, permission) {
     const token = await getAppAccessToken()

     // 注意：type参数必须在URL查询字符串中！
     const response = await fetch(
       `${FEISHU_API_URL}/drive/v2/permissions/${appToken}/public?type=bitable`,
       {
         method: 'PATCH',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`,
         },
         body: JSON.stringify({
           link_share_entity: 'anyone_editable',
           external_access_entity: 'open'
         }),
       }
     )
   }
   ```

**权限选项说明：**
- `tenant_editable` - 组织内可编辑（需要登录同一飞书组织）
- `anyone_editable` - 任何人可编辑（推荐，无需登录）
- `tenant_readable` - 组织内可查看
- `anyone_readable` - 任何人可查看

**完整实现参考：** `lib/feishu-bitable.ts` 中的 `createBitable` 函数

**常见错误：**
```javascript
// ❌ 错误：type在body中
fetch(`/drive/v2/permissions/${appToken}/public`, {
  body: { type: 'bitable', ... }
})

// ✅ 正确：type在URL参数中
fetch(`/drive/v2/permissions/${appToken}/public?type=bitable`, {
  body: { link_share_entity: 'anyone_editable', ... }
})
```

#### 2.2 笔记导出
**文件：** `app/api/feishu/export-notes/route.ts`

**字段格式：**
```javascript
{
  '笔记链接': {
    link: "https://...",
    text: "标题"
  },  // URL字段格式
  '标题': "文本",
  '作者': "文本",
  '分级': "单选",
  '点赞数': 数字,
  '收藏数': 数字,
  '评论数': 数字,
  '总互动数': 数字,
  '评论占比': "百分比文本",
  '提取状态': "单选",
}
```

#### 2.3 笔记详情提取
**文件：** `app/api/feishu/batch-extract/route.ts`

**功能：**
- ✅ 批量提取勾选笔记的详细信息
- ✅ 上传封面和所有图片到飞书
- ✅ 提取话题标签（从正文分离）
- ✅ 自动更新提取状态

**图片上传 API：**
```javascript
// 正确的API：/drive/v1/medias/upload_all
// 错误的API：/im/v1/images (返回image_key不可用)

const formData = new FormData()
formData.append('file_name', `image_${Date.now()}.jpg`)
formData.append('parent_type', 'bitable_image')  // 固定值
formData.append('parent_node', appToken)         // 表格token
formData.append('size', imageBuffer.byteLength.toString())
formData.append('file', new Blob([imageBuffer]), 'image.jpg')
```

---

## 🏗️ 技术架构

### API 服务商

#### 1. 极致了 API (dajiala.com)
**用途：** 小红书笔记搜索

**配置：**
```bash
NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY=JZL1b7f46d7a6b92240
NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE=https://www.dajiala.com/fbmain/monitor/v3/xhs
```

**重要文档：**
- Web API (type=1): 综合、热度、最新
- APP API v2 (type=9): 点赞、收藏、评论、时间、综合

**已知问题：**
- APP API v2 不返回 `has_more` 字段（返回 undefined）
- 需要通过 `notes.length > 0` 判断是否还有更多

#### 2. 喵加载 API (meowload.net)
**用途：** 小红书笔记详情提取

**配置：**
```bash
NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY=341289-ql9bvro52phb
NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE=https://api.meowload.net/openapi/extract/post
```

#### 3. 飞书开放平台
**用途：** 多维表格存储

**配置：**
```bash
FEISHU_APP_ID=cli_a9bac6be07789cc4
FEISHU_APP_SECRET=kqcP7odJy9x0AhtNMR5FYg4KPXs5lwRJ
FEISHU_API_URL=https://open.feishu.cn/open-apis
```

**默认表格：**
```bash
NEXT_PUBLIC_DEFAULT_FEISHU_APP_TOKEN=CCLKbTIdLa8xyYsA9y5c7coZnkd
NEXT_PUBLIC_DEFAULT_FEISHU_TABLE_ID=tbl8HtFvCqiuf5YT
```

---

## ⚙️ 关键配置

### 飞书多维表格字段定义

**文件：** `lib/feishu-bitable.ts` (createXiaohongshuCollectTable)

```javascript
const fields = [
  { field_name: '笔记链接', type: 1 },      // 文本（URL）
  { field_name: '标题', type: 1 },          // 文本
  { field_name: '作者', type: 1 },          // 文本
  { field_name: '分级', type: 3 },          // 单选
  { field_name: '点赞数', type: 2 },        // 数字
  { field_name: '收藏数', type: 2 },        // 数字
  { field_name: '评论数', type: 2 },        // 数字
  { field_name: '总互动数', type: 2 },      // 数字
  { field_name: '评论占比', type: 1 },      // 文本
  { field_name: '需要提取', type: 3 },      // 单选
  { field_name: '封面', type: 17 },         // 附件
  { field_name: '所有图片', type: 17 },     // 附件
  { field_name: '正文内容', type: 1 },      // 多行文本
  { field_name: '话题标签', type: 1 },      // 文本
  { field_name: '提取状态', type: 3 },      // 单选
]
```

### 笔记分级规则

**文件：** `app/collect/page.tsx` (classifyNote)

```javascript
const classifyNote = (note) => {
  const totalInteract = note.liked_count + note.collected_count + note.comment_count
  const commentRatio = totalInteract > 0 ? (note.comment_count / totalInteract) * 100 : 0

  let level = 'normal'

  if (totalInteract > 100) {
    level = 'hot'  // 🔥 小爆款
  } else if (
    note.liked_count + note.collected_count > 15 &&
    (note.comment_count > 20 || commentRatio > 25)
  ) {
    level = 'high-comment'  // 💬 高评论
  }

  return { ...note, level, commentRatio }
}
```

---

## 🐛 问题与解决方案

### 问题1: 飞书权限设置失败
**错误：** `field validation failed: type is required`

**原因：** `type` 参数应该在 URL 查询参数中，不是请求体

**解决：**
```javascript
// ❌ 错误
fetch(`/drive/v2/permissions/${appToken}/public`, {
  body: { type: 'bitable', ... }
})

// ✅ 正确
fetch(`/drive/v2/permissions/${appToken}/public?type=bitable`, {
  body: { link_share_entity: 'anyone_editable', ... }
})
```

### 问题2: 图片上传失败 - file_token无效
**错误：** `WrongRequestBody: file token is invalid`

**原因：** 使用了错误的API `/im/v1/images`，返回的 `image_key` 不能用于 bitable 附件

**解决：**
```javascript
// ❌ 错误API
POST /im/v1/images
返回: { image_key: "img_xxx" }  // 不能用于附件字段

// ✅ 正确API
POST /drive/v1/medias/upload_all
参数: {
  parent_type: 'bitable_image',  // 固定值
  parent_node: appToken           // 表格token
}
返回: { file_token: "xxx" }       // 可用于附件字段
```

**参考文档：** https://blog.csdn.net/juxiaoyu/article/details/153772805

### 问题3: 导出笔记失败 - URLFieldConvFail
**错误：** `批量添加记录失败: URLFieldConvFail`

**原因：** 笔记链接字段发送为纯字符串，但飞书 URL 字段需要对象格式

**解决：**
```javascript
// ❌ 错误
'笔记链接': 'https://www.xiaohongshu.com/explore/xxx'

// ✅ 正确
'笔记链接': {
  link: 'https://www.xiaohongshu.com/explore/xxx',
  text: '标题'
}
```

### 问题4: APP API v2 只采集20条就停止
**错误：** 每个维度只采集1页（20条），不继续分页

**原因：** APP API v2 不返回 `has_more` 字段（返回 `undefined`）

**解决：**
```javascript
// ❌ 错误判断
hasMore = response.has_more  // undefined 导致循环停止

// ✅ 正确判断
const responseHasMore = response.has_more !== undefined
  ? response.has_more
  : (notes.length > 0)  // 如果获取到了笔记，就继续
```

### 问题5: 短链接解析失败
**错误：** `note.link.trim is not a function`

**原因：** 飞书 URL 字段返回对象格式，不是字符串

**解决：**
```javascript
const linkField = record.fields['笔记链接']
let link = ''
if (typeof linkField === 'string') {
  link = linkField
} else if (linkField && typeof linkField === 'object') {
  link = linkField.link || linkField.text || ''
}
```

---

## 📊 采集效果分析

### 测试案例：法意瑞小团

**采集参数：**
- 关键词：`法意瑞小团`
- 排序方式：点赞、收藏、评论、综合（各100条）
- 时间范围：半年内
- 笔记类型：普通笔记

**采集结果：**
- 总调用次数：约40次（4种排序 × 10页）
- 原始笔记数：约400条
- 去重后数量：223条
- 成本：约2元（0.1元/次 × 20次）

**质量分析：**
- 评论>20的笔记：75条（34%）
- 素人笔记（预估）：约75条（33%）
- 商家笔记（预估）：约148条（67%）

**问题识别：**
1. 商家笔记占比过高（因为商家会针对关键词优化）
2. 单一关键词覆盖不全面
3. 成本与效果不成正比

---

## 🎯 下一步计划

### 阶段1: 素人笔记识别系统（优先级：高）

**目标：** 提升素人笔记识别准确率到80%+

**功能设计：**
1. 快速标记界面
   - 展示笔记列表（封面、标题、作者、互动数）
   - 一键标记：素人/商家/跳过
   - 批量操作

2. 商家特征预判
   ```javascript
   黑名单关键词：
   - 账号名：旅游|定制|小团|管家|顾问|私家团
   - 标题：人均|联系|咨询|私信|报价|¥|元
   - 正文：加V|同款|链接|小程序
   ```

3. 关键词提取引擎
   - 从素人笔记标题提取高频词组
   - 统计话题标签使用频率
   - 导出待测试关键词列表

**实现时间：** 1-2小时

### 阶段2: 关键词效果追踪（优先级：中）

**目标：** 建立关键词效果数据库

**功能设计：**
1. 在飞书表格新增字段
   - 搜索关键词
   - 素人笔记数
   - 商家笔记数
   - 素人占比
   - 采集时间

2. 自动记录每次采集效果

3. 数据分析面板
   - 显示历史关键词效果排行
   - 识别高效关键词模式

### 阶段3: 小规模测试功能（优先级：中）

**目标：** 降低关键词验证成本

**功能设计：**
1. 测试模式
   - 每个关键词只采集前20条
   - 快速计算素人占比
   - 成本：0.1元/关键词

2. 批量测试
   - 一次测试10个关键词
   - 自动排序并推荐TOP3
   - 成本：1元

3. 深度采集
   - 对优质关键词进行深度采集
   - 每个采集100-200条

**成本优化：**
```
现有方案：1关键词深度采集 = 2元
新方案：
  - 10关键词浅度测试 = 1元
  - 选出3个优质词 = 6元深度采集
  总计：7元，但找到最优关键词
```

---

## 🔧 技术债务

### 需要优化的部分

1. **错误处理**
   - 网络超时重试机制
   - API 限流处理
   - 失败笔记记录

2. **性能优化**
   - 图片上传并发控制
   - 大量数据的分页展示
   - 本地缓存机制

3. **用户体验**
   - 采集进度更详细
   - 暂停/恢复功能完善
   - 导出格式多样化（Excel、CSV）

---

## 📝 使用说明

### 基础采集流程

1. 访问 http://localhost:3000/collect
2. 输入关键词
3. 选择采集模式：
   - **开始采集**：使用单一排序策略
   - **🎯 多维度采集**：4种排序去重合并

### 导出到飞书

1. 采集完成后，选择表格：
   - **使用默认表格**：所有采集添加到同一张表
   - **创建新表格**：为本次采集创建新表

2. 点击"导出到飞书"

3. 在飞书表格中：
   - 勾选"需要提取"为"✅ 是"
   - 点击"批量提取详情"按钮

---

## 🐛 已知限制

1. **API 限流**
   - 极致了 API: QPS ≤ 5次/秒
   - 需要在请求间加 500ms 延迟

2. **成本控制**
   - 多维度采集成本较高
   - 建议先小规模测试再深度采集

3. **笔记时效性**
   - 半年内筛选可能遗漏老笔记
   - 但老笔记参考价值较低

4. **素人识别准确率**
   - 目前依赖人工判断
   - 需要积累数据建立识别模型

---

## 📚 参考文档

1. [飞书开放平台 - 多维表格API](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app/create)
2. [飞书图片上传 - CSDN博客](https://blog.csdn.net/juxiaoyu/article/details/153772805)
3. [极致了API文档](https://dajiala.com/)
4. [喵加载API文档](https://mg.meiwzj.com/)

---

## 💡 经验总结

### 关键洞察

1. **千人千面问题**
   - API搜索是"未登录标准视角"
   - 与个人App搜索结果差异大
   - 需要多关键词覆盖

2. **商家笔记特征**
   - 会针对关键词优化内容
   - 账号名、标题有明显特征
   - 占比通常>60%

3. **成本控制策略**
   - 先测试（20条/0.1元）
   - 再深度采集（100-200条/2-4元）
   - 优先验证关键词质量

4. **数据积累价值**
   - 记录每个关键词效果
   - 建立高效关键词库
   - 形成可复用的采集策略

---

**文档维护者：** Claude
**最后更新：** 2026-01-07
**项目状态：** 🟢 进行中
