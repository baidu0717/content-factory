# 飞书 OAuth 手动获取 Token 指南

由于自动 OAuth 流程遇到 20029 错误，我们可以通过以下方式手动获取 refresh_token：

## 方法一：使用飞书官方 OAuth 调试工具（推荐）

1. 访问飞书开放平台文档中心的 OAuth 测试工具
2. 输入你的 App ID
3. 选择授权范围
4. 完成授权后获取 refresh_token
5. 复制 token 配置到 Vercel 环境变量

## 方法二：临时修改为 localhost 测试

1. 在飞书后台添加一个测试重定向URL：
   ```
   http://localhost:3000/api/auth/feishu/callback
   ```

2. 在本地运行项目：
   ```bash
   npm run dev
   ```

3. 访问 http://localhost:3000/auth/feishu

4. 完成授权后，复制页面显示的 refresh_token

5. 将 refresh_token 添加到 Vercel 环境变量：
   - 变量名：FEISHU_REFRESH_TOKEN
   - 值：复制的 token
   - 环境：Production, Preview, Development

6. 在 Vercel 触发重新部署

## 当前状态

- ✅ 代码已完整实现
- ✅ 图片上传功能已就绪
- ✅ 快捷保存 API 已完成
- ⏸️  等待获取 refresh_token

## 下次见面时

1. 我们先尝试方法二（本地测试）
2. 如果成功获取 token，直接配置到 Vercel
3. 测试完整的快捷指令功能
4. 配置 iOS 手势触发

## OAuth 问题后续排查方向

- 检查"网页应用"配置是否有额外的OAuth设置
- 尝试联系飞书技术支持
- 查看飞书开放平台是否有"个人版"应用的特殊限制
