'use client'

import { useState } from 'react'
import { Copy, ExternalLink, Info } from 'lucide-react'

export default function RewriteHelperPage() {
  const [copied, setCopied] = useState(false)

  const baseUrl = 'https://content-factory-jade-nine.vercel.app/rewrite'
  const exampleUrl = `${baseUrl}?title=示例标题&content=示例正文内容&tags=话题1 话题2`

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formula1 = `CONCATENATE(
  "https://content-factory-jade-nine.vercel.app/rewrite?",
  "title=", URLENCODE({标题}),
  "&content=", URLENCODE({正文}),
  "&tags=", URLENCODE({话题标签})
)`

  const formula2 = `HYPERLINK(
  CONCATENATE(
    "https://content-factory-jade-nine.vercel.app/rewrite?",
    "title=", URLENCODE({标题}),
    "&content=", URLENCODE({正文}),
    "&tags=", URLENCODE({话题标签})
  ),
  "去复刻"
)`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            飞书表格复刻链接配置指南
          </h1>

          <div className="space-y-6">
            {/* 说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    使用说明
                  </h3>
                  <p className="text-sm text-blue-800">
                    在飞书多维表格中，使用<strong>公式字段</strong>自动生成复刻链接，无需手动复制粘贴。
                  </p>
                </div>
              </div>
            </div>

            {/* 方案1：生成URL文本 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                方案1：生成URL文本（推荐）
              </h3>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-300">飞书公式</span>
                  <button
                    onClick={() => handleCopy(formula1)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center space-x-2 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied ? '已复制' : '复制'}</span>
                  </button>
                </div>
                <code className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                  {formula1}
                </code>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                生成URL文本，可以复制后在浏览器打开
              </p>
            </div>

            {/* 方案2：生成可点击链接 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                方案2：生成可点击链接
              </h3>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-300">飞书公式</span>
                  <button
                    onClick={() => handleCopy(formula2)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center space-x-2 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied ? '已复制' : '复制'}</span>
                  </button>
                </div>
                <code className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                  {formula2}
                </code>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                生成可点击的超链接，显示文本为"去复刻"
              </p>
            </div>

            {/* 配置步骤 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                配置步骤
              </h3>
              <ol className="space-y-3 text-gray-700">
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <div>
                    <p className="font-medium">确保表格有这些字段</p>
                    <p className="text-sm text-gray-600 mt-1">
                      标题、正文、话题标签（字段名必须完全匹配）
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <div>
                    <p className="font-medium">创建"去复刻"字段</p>
                    <p className="text-sm text-gray-600 mt-1">
                      字段类型选择：<strong>公式</strong>
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <div>
                    <p className="font-medium">粘贴公式</p>
                    <p className="text-sm text-gray-600 mt-1">
                      选择上方方案1或方案2，复制公式粘贴到编辑器
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    4
                  </span>
                  <div>
                    <p className="font-medium">测试链接</p>
                    <p className="text-sm text-gray-600 mt-1">
                      点击或复制生成的链接，跳转到复刻页面
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* 示例 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">
                示例链接
              </h3>
              <a
                href={exampleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 hover:text-green-900 flex items-center space-x-2 break-all"
              >
                <span>{exampleUrl}</span>
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
              </a>
            </div>

            {/* 注意事项 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ 注意事项
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>公式中的字段名需要和表格字段名<strong>完全一致</strong></li>
                <li>如果字段名包含空格或特殊字符，用花括号包裹（如 {'{标题}'}）</li>
                <li>URLENCODE 会自动处理URL特殊字符</li>
                <li>方案2的HYPERLINK可以直接点击，更方便</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
