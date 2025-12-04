'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  Clock,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  History as HistoryIcon,
  Calendar,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

interface MonitoredKeyword {
  id: number
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  enabled: number
  last_run_at: number | null
  created_at: number
  updated_at: number
}

interface ScheduledReport {
  id: number
  keyword: string
  platform: 'wechat' | 'xiaohongshu'
  feishu_pushed: number
  feishu_push_at: number | null
  error: string | null
  created_at: number
}

export default function MonitoringPage() {
  const [keywords, setKeywords] = useState<MonitoredKeyword[]>([])
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newPlatform, setNewPlatform] = useState<'wechat' | 'xiaohongshu'>('wechat')
  const [feishuWebhook, setFeishuWebhook] = useState('')
  const [cronTime, setCronTime] = useState('0 8 * * *')
  const [executing, setExecuting] = useState(false)

  // 加载监控关键词
  const loadKeywords = async () => {
    try {
      const response = await fetch('/api/monitored-keywords')
      const data = await response.json()
      if (data.success) {
        setKeywords(data.keywords)
      }
    } catch (error) {
      console.error('加载关键词失败:', error)
    }
  }

  // 加载执行报告
  const loadReports = async () => {
    try {
      const response = await fetch('/api/scheduled-reports?limit=20')
      const data = await response.json()
      if (data.success) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error('加载报告失败:', error)
    }
  }

  // 加载系统设置
  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      if (data.success) {
        setFeishuWebhook(data.settings.feishu_webhook || '')
        setCronTime(data.settings.cron_time || '0 8 * * *')
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadKeywords(), loadReports(), loadSettings()])
      setLoading(false)
    }
    init()
  }, [])

  // 添加关键词
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return

    try {
      const response = await fetch('/api/monitored-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          platform: newPlatform,
          enabled: 1,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setKeywords([data.keyword, ...keywords])
        setNewKeyword('')
        setShowAddModal(false)
      } else {
        alert(data.error || '添加失败')
      }
    } catch (error) {
      alert('添加失败')
    }
  }

  // 切换启用状态
  const toggleKeyword = async (id: number, enabled: number) => {
    try {
      const response = await fetch('/api/monitored-keywords', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: enabled ? 0 : 1 }),
      })

      const data = await response.json()
      if (data.success) {
        setKeywords(keywords.map((k) => (k.id === id ? data.keyword : k)))
      }
    } catch (error) {
      alert('操作失败')
    }
  }

  // 删除关键词
  const deleteKeyword = async (id: number) => {
    if (!confirm('确定要删除这个关键词吗？')) return

    try {
      const response = await fetch(`/api/monitored-keywords?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        setKeywords(keywords.filter((k) => k.id !== id))
      }
    } catch (error) {
      alert('删除失败')
    }
  }

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'feishu_webhook', value: feishuWebhook }),
      })

      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'cron_time', value: cronTime }),
      })

      alert('保存成功')
      setShowSettingsModal(false)
    } catch (error) {
      alert('保存失败')
    }
  }

  // 手动触发分析
  const handleExecuteNow = async () => {
    if (!confirm('确定要立即执行一次分析任务吗？这可能需要几分钟时间。')) return

    setExecuting(true)
    try {
      const response = await fetch('/api/cron/daily-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'your-secret-key',
        },
      })

      const data = await response.json()
      if (data.success) {
        alert(`执行完成！${data.message}`)
        await loadReports()
        await loadKeywords()
      } else {
        alert('执行失败: ' + (data.error || '未知错误'))
      }
    } catch (error) {
      alert('执行失败')
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const enabledCount = keywords.filter((k) => k.enabled === 1).length
  const successReports = reports.filter((r) => r.feishu_pushed === 1).length

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">定时监控</h1>
          <p className="text-gray-500 mt-1">管理监控关键词，查看自动分析报告</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowReportsModal(true)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <HistoryIcon className="w-5 h-5" />
            <span>执行历史</span>
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <Settings className="w-5 h-5" />
            <span>系统设置</span>
          </button>
          <button
            onClick={handleExecuteNow}
            disabled={executing || keywords.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {executing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>执行中...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>立即执行</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">监控关键词</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{keywords.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">已启用</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{enabledCount}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">执行记录</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{reports.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">推送成功</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{successReports}</p>
            </div>
            <Send className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* 关键词列表 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">监控关键词列表</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>添加关键词</span>
          </button>
        </div>

        <div className="p-4">
          {keywords.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无监控关键词</p>
              <p className="text-sm mt-1">点击上方按钮添加关键词开始监控</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${
                            keyword.platform === 'wechat'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {keyword.platform === 'wechat' ? '公众号' : '小红书'}
                        </span>
                        <h3 className="font-semibold text-gray-900 text-lg">{keyword.keyword}</h3>
                        {keyword.enabled === 1 ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            已启用
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            已禁用
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          创建时间: {new Date(keyword.created_at).toLocaleString('zh-CN')}
                        </span>
                        {keyword.last_run_at && (
                          <span>
                            上次执行: {new Date(keyword.last_run_at).toLocaleString('zh-CN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKeyword(keyword.id, keyword.enabled)}
                        className={`p-2 rounded-lg transition-colors ${
                          keyword.enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={keyword.enabled ? '禁用' : '启用'}
                      >
                        {keyword.enabled ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => deleteKeyword(keyword.id)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 添加关键词弹窗 */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">添加监控关键词</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">关键词</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="输入关键词，如：AI创作"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">平台</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewPlatform('wechat')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      newPlatform === 'wechat'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    公众号
                  </button>
                  <button
                    onClick={() => setNewPlatform('xiaohongshu')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      newPlatform === 'xiaohongshu'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    小红书
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 系统设置弹窗 */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">系统设置</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  飞书 Webhook 地址
                </label>
                <input
                  type="text"
                  value={feishuWebhook}
                  onChange={(e) => setFeishuWebhook(e.target.value)}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  定时执行时间（Cron 表达式）
                </label>
                <input
                  type="text"
                  value={cronTime}
                  onChange={(e) => setCronTime(e.target.value)}
                  placeholder="0 8 * * *"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  默认: 0 8 * * * (每天早上8点执行)
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 执行历史弹窗 */}
      {showReportsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowReportsModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">执行历史</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {reports.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <HistoryIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无执行记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                report.platform === 'wechat'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {report.platform === 'wechat' ? '公众号' : '小红书'}
                            </span>
                            <span className="font-semibold text-gray-900">{report.keyword}</span>
                            {report.feishu_pushed === 1 ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-500">
                            <p>执行时间: {new Date(report.created_at).toLocaleString('zh-CN')}</p>
                            {report.feishu_push_at && (
                              <p>推送时间: {new Date(report.feishu_push_at).toLocaleString('zh-CN')}</p>
                            )}
                            {report.error && (
                              <p className="text-red-600 mt-1">错误: {report.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowReportsModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
