'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit3,
  Copy,
  Trash2,
  Check,
  X,
  Clock,
  FileText,
  Calendar,
  Tag,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  Share2,
  Download,
  Archive
} from 'lucide-react'
import Link from 'next/link'
import WechatPublishModal from '@/components/WechatPublishModal'
import XiaohongshuPublishModal from '@/components/XiaohongshuPublishModal'
import ArticlePreviewModal from '@/components/ArticlePreviewModal'
import ArticleEditModal from '@/components/ArticleEditModal'

// 文章类型定义
interface Article {
  id: number
  title: string
  content: string
  status: 'draft' | 'pending_review' | 'published' | 'failed'
  platforms: string[]
  source: string
  createdAt: string
  publishedAt: string | null
  stats: { views: number; likes: number; comments: number } | null
  tags: string[]
  images?: string[]
  error?: string
}

const statusConfig = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending_review: { label: '待审核', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  published: { label: '已发布', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: '发布失败', color: 'bg-red-100 text-red-700', icon: AlertCircle }
}

const platformConfig = {
  xiaohongshu: { label: '小红书', color: 'bg-red-500' },
  wechat: { label: '公众号', color: 'bg-green-500' }
}

export default function PublishPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedArticles, setSelectedArticles] = useState<number[]>([])
  const [showDropdown, setShowDropdown] = useState<number | null>(null)
  const [publishingArticle, setPublishingArticle] = useState<number | null>(null)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [articleToPublish, setArticleToPublish] = useState<{
    id: number
    title: string
    content: string
  } | null>(null)
  const [showXhsPublishModal, setShowXhsPublishModal] = useState(false)
  const [articleToPublishXhs, setArticleToPublishXhs] = useState<{
    id: number
    title: string
    content: string
    images?: string[]
  } | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [articleToPreview, setArticleToPreview] = useState<Article | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [articleToEdit, setArticleToEdit] = useState<Article | null>(null)

  // 加载文章列表
  useEffect(() => {
    loadArticles()
  }, [filterStatus])

  const loadArticles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/articles?status=${filterStatus}&limit=100`)
      const data = await response.json()

      if (data.success) {
        setArticles(data.data.articles)
      } else {
        console.error('[加载文章列表] 失败:', data.error)
      }
    } catch (error) {
      console.error('[加载文章列表] 错误:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = (articleId: number, platform: 'xiaohongshu' | 'wechat') => {
    const article = articles.find(a => a.id === articleId)
    if (!article) return

    if (platform === 'wechat') {
      // 打开公众号发布弹窗
      setArticleToPublish({
        id: article.id,
        title: article.title,
        content: article.content,
      })
      setShowPublishModal(true)
      setShowDropdown(null) // 关闭下拉菜单
    } else if (platform === 'xiaohongshu') {
      // 打开小红书发布弹窗
      setArticleToPublishXhs({
        id: article.id,
        title: article.title,
        content: article.content,
        images: article.images || [],
      })
      setShowXhsPublishModal(true)
      setShowDropdown(null) // 关闭下拉菜单
    }
  }

  const handlePublishSuccess = () => {
    // 发布成功后的处理
    loadArticles()
    console.log('发布成功！')
  }

  const handlePreview = (article: Article) => {
    setArticleToPreview(article)
    setShowPreviewModal(true)
    setShowDropdown(null)
  }

  const handleEdit = (article: Article) => {
    setArticleToEdit(article)
    setShowEditModal(true)
    setShowDropdown(null)
  }

  const handleEditSave = () => {
    // 编辑保存后重新加载列表
    loadArticles()
  }

  const handleSelectAll = () => {
    if (selectedArticles.length === filteredArticles.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(filteredArticles.map(a => a.id))
    }
  }

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">发布管理</h1>
          <p className="text-gray-500 mt-1">管理和发布您的文章到各个平台</p>
        </div>
        <Link
          href="/create"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          新建文章
        </Link>
      </div>

      {/* 工具栏 */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* 搜索 */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索文章标题..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 筛选 */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部状态</option>
                <option value="draft">草稿</option>
                <option value="pending_review">待审核</option>
                <option value="published">已发布</option>
                <option value="failed">发布失败</option>
              </select>
            </div>
          </div>

          {/* 批量操作 */}
          {selectedArticles.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                已选择 {selectedArticles.length} 项
              </span>
              <button className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                批量发布
              </button>
              <button className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                批量删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 文章列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-600">加载中...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无文章</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? '没有找到匹配的文章' : '还没有保存任何文章'}
            </p>
            <Link
              href="/create"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              创建第一篇文章
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedArticles.length === filteredArticles.length && filteredArticles.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                标题
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                平台
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                数据
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredArticles.map((article) => {
              const StatusIcon = statusConfig[article.status as keyof typeof statusConfig].icon
              return (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedArticles.includes(article.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedArticles([...selectedArticles, article.id])
                        } else {
                          setSelectedArticles(selectedArticles.filter(id => id !== article.id))
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {article.title}
                      </p>
                      <div className="flex items-center mt-1 space-x-2">
                        {Array.isArray(article.tags) && article.tags.map((tag) => (
                          <span key={tag} className="text-xs text-gray-500">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[article.status as keyof typeof statusConfig].color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig[article.status as keyof typeof statusConfig].label}
                      </span>
                    </div>
                    {article.error && (
                      <p className="text-xs text-red-500 mt-1">{article.error}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {article.platforms.length > 0 ? (
                      <div className="flex items-center space-x-1">
                        {article.platforms.map((platform, index) => (
                          <span
                            key={`${platform}-${index}`}
                            className={`w-2 h-2 rounded-full ${platformConfig[platform as keyof typeof platformConfig].color}`}
                            title={platformConfig[platform as keyof typeof platformConfig].label}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">
                      <p>{article.createdAt}</p>
                      {article.publishedAt && (
                        <p className="text-xs text-green-600">
                          发布于 {article.publishedAt}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {article.stats ? (
                      <div className="flex items-center space-x-3 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Eye className="w-4 h-4 mr-1" />
                          {article.stats.views.toLocaleString()}
                        </div>
                        <div className="flex items-center">
                          <Check className="w-4 h-4 mr-1" />
                          {article.stats.likes}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePreview(article)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="预览文章"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(article)}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                        title="编辑文章"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setShowDropdown(showDropdown === article.id ? null : article.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {showDropdown === article.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                            <button
                              onClick={() => handlePublish(article.id, 'xiaohongshu')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                              disabled={publishingArticle === article.id}
                            >
                              {publishingArticle === article.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-2" />
                              )}
                              发布到小红书
                            </button>
                            <button
                              onClick={() => handlePublish(article.id, 'wechat')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                              disabled={publishingArticle === article.id}
                            >
                              {publishingArticle === article.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-2" />
                              )}
                              发布到公众号
                            </button>
                            <div className="border-t border-gray-200"></div>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                              <Copy className="w-4 h-4 mr-2" />
                              复制文章
                            </button>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                              <Download className="w-4 h-4 mr-2" />
                              导出文章
                            </button>
                            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                              <Archive className="w-4 h-4 mr-2" />
                              归档
                            </button>
                            <div className="border-t border-gray-200"></div>
                            <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center">
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* 分页 */}
          <tfoot>
            <tr>
              <td colSpan={7}>
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    显示 <span className="font-medium">1</span> 到 <span className="font-medium">{filteredArticles.length}</span> 条，
                    共 <span className="font-medium">{filteredArticles.length}</span> 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center" disabled>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      上一页
                    </button>
                    <button className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm">1</button>
                    <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center" disabled>
                      下一页
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
        )}
      </div>

      {/* 公众号发布弹窗 */}
      {articleToPublish && (
        <WechatPublishModal
          isOpen={showPublishModal}
          onClose={() => {
            setShowPublishModal(false)
            setArticleToPublish(null)
          }}
          article={articleToPublish}
          onPublishSuccess={handlePublishSuccess}
        />
      )}

      {/* 小红书发布弹窗 */}
      {articleToPublishXhs && (
        <XiaohongshuPublishModal
          isOpen={showXhsPublishModal}
          onClose={() => {
            setShowXhsPublishModal(false)
            setArticleToPublishXhs(null)
          }}
          article={articleToPublishXhs}
          onPublishSuccess={handlePublishSuccess}
        />
      )}

      {/* 文章预览模态框 */}
      {articleToPreview && (
        <ArticlePreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false)
            setArticleToPreview(null)
          }}
          article={articleToPreview}
        />
      )}

      {/* 文章编辑模态框 */}
      {articleToEdit && (
        <ArticleEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setArticleToEdit(null)
          }}
          article={articleToEdit}
          onSave={handleEditSave}
        />
      )}
    </div>
  )
}