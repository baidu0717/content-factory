#!/bin/bash
# 重新采集第7条笔记

echo "🔄 重新采集第7条笔记: 极达途乐-轻奢出行"
echo "链接: http://xhslink.com/o/6NqGJbBnBuO"
echo ""

# 调用API（其他国家表格）
curl -X POST \
  https://content-factory-jade-nine.vercel.app/api/xiaohongshu/quick-save \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://xhslink.com/o/6NqGJbBnBuO",
    "appToken": "McFGbxqi6aSd0HsBCSlc5kI7nwc",
    "tableId": "tbltp6uHpdKRF68a",
    "async": false
  }' | jq .

echo ""
echo "✅ 如果看到成功消息，说明图片已保存"
echo "❌ 如果失败，请将上面的错误信息发给我"
