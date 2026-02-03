'use client'

import { Copy, Bookmark, ExternalLink } from 'lucide-react'
import { useState } from 'react'

export default function BookmarkletPage() {
  const [copied, setCopied] = useState(false)

  const bookmarkletCode = `javascript:(function(){const cells=document.querySelectorAll('[data-testid="cell-container"][class*="selected"]');if(cells.length===0){alert('请先在飞书表格中选中一行');return}const row=cells[0].closest('[data-testid="row"]');if(!row){alert('无法找到选中的行');return}let title=prompt('请输入标题:');let content=prompt('请输入正文:');let tags=prompt('请输入标签（可选）:')||'';if(!title||!content){alert('标题和正文不能为空');return}const params=new URLSearchParams({title,content,tags});window.open('http://localhost:3000/rewrite?'+params.toString(),'_blank')})();`

  const handleCopy = () => {
    navigator.clipboard.writeText(bookmarkletCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center space-x-4 mb-6">
            <Bookmark className="w-10 h-10 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              飞书表格复刻书签工具
            </h1>
          </div>

          <div className="space-y-6">
            {/* 说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                为什么需要书签工具？
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>飞书公式不支持 URLENCODE 函数</li>
                <li>个人表格无法通过 API 批量生成链接</li>
                <li>书签工具可以<strong>选择性复刻</strong>任意记录</li>
                <li>一键生成并跳转，无需手动复制链接</li>
              </ul>
            </div>

            {/* 安装步骤 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                安装步骤
              </h3>
              <ol className="space-y-4">
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">复制书签代码</p>
                    <div className="mt-2">
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-300">
                            书签代码
                          </span>
                          <button
                            onClick={handleCopy}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center space-x-2 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            <span>{copied ? '已复制' : '复制'}</span>
                          </button>
                        </div>
                        <code className="text-xs font-mono text-green-400 break-all">
                          {bookmarkletCode}
                        </code>
                      </div>
                    </div>
                  </div>
                </li>

                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">显示书签栏</p>
                    <p className="text-sm text-gray-600 mt-1">
                      在浏览器中按 <kbd className="px-2 py-1 bg-gray-100 rounded">Cmd+Shift+B</kbd> (Mac) 或 <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl+Shift+B</kbd> (Windows)
                    </p>
                  </div>
                </li>

                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">创建书签</p>
                    <p className="text-sm text-gray-600 mt-1">
                      右键点击书签栏 → 添加网页 → 名称填"复刻" → 网址粘贴刚才复制的代码
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* 使用方法 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                使用方法
              </h3>
              <ol className="space-y-3 text-gray-700">
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <div>
                    <p className="font-medium">打开飞书多维表格</p>
                    <p className="text-sm text-gray-600 mt-1">
                      访问: <a href="https://my.feishu.cn/base/NNd8bJYazaBwHAsZ2z2cqsvmnqf" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">你的表格</a>
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <div>
                    <p className="font-medium">选中要复刻的记录</p>
                    <p className="text-sm text-gray-600 mt-1">
                      点击任意一行（整行会高亮显示）
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <div>
                    <p className="font-medium">点击书签栏的"复刻"按钮</p>
                    <p className="text-sm text-gray-600 mt-1">
                      会弹出对话框让你输入标题、正文、标签
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    4
                  </span>
                  <div>
                    <p className="font-medium">自动跳转到复刻页面</p>
                    <p className="text-sm text-gray-600 mt-1">
                      标题和正文会自动填充，可以直接点击"一键改写全部"
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* 示例 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">
                ✨ 优势
              </h3>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li><strong>选择性复刻</strong>：只复刻你想要的内容</li>
                <li><strong>无需配置</strong>：不依赖飞书表格字段</li>
                <li><strong>快速便捷</strong>：一键跳转，自动填充</li>
                <li><strong>灵活调整</strong>：可以手动修改标题和正文</li>
              </ul>
            </div>

            {/* 注意事项 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ 注意事项
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>书签代码中的 URL 是<strong>本地地址</strong> (localhost:3000)</li>
                <li>如果要用 Vercel 版本，需要修改 URL 为线上地址</li>
                <li>首次使用需要手动输入标题和正文（自动提取可能不准确）</li>
              </ul>
            </div>

            {/* 测试按钮 */}
            <div className="flex justify-center pt-4">
              <a
                href={bookmarkletCode}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 font-medium flex items-center space-x-2 shadow-lg"
                onClick={(e) => {
                  e.preventDefault()
                  alert('请将此按钮拖动到书签栏，或者右键点击→添加到书签')
                }}
              >
                <Bookmark className="w-5 h-5" />
                <span>拖动此按钮到书签栏</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
