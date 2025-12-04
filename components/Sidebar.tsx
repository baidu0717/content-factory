'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  PenTool,
  Send,
  Settings,
  BarChart3,
  FileText,
  Zap,
  Menu,
  X,
  Clock,
  Sparkles,
  Image,
  Database
} from 'lucide-react'

const menuItems = [
  {
    href: '/',
    label: '仪表盘',
    icon: LayoutDashboard,
    description: '总览和数据统计'
  },
  {
    href: '/analysis',
    label: '选题分析',
    icon: Search,
    description: '关键词分析与洞察'
  },
  {
    href: '/create',
    label: '内容创作',
    icon: PenTool,
    description: 'AI智能创作'
  },
  {
    href: '/rewrite',
    label: '小红书复刻',
    icon: Sparkles,
    description: '一键复刻小红书笔记'
  },
  {
    href: '/xiaohongshu-extract',
    label: '小红书采集',
    icon: Database,
    description: '提取笔记 + 保存飞书'
  },
  {
    href: '/image-generate',
    label: 'AI 生图',
    icon: Image,
    description: '云旅游实景 + 创意生图'
  },
  {
    href: '/publish',
    label: '发布管理',
    icon: Send,
    description: '文章管理与发布'
  },
  {
    href: '/monitoring',
    label: '定时监控',
    icon: Clock,
    description: '自动分析与推送'
  },
  {
    href: '/settings',
    label: '设置',
    icon: Settings,
    description: 'API配置与系统设置'
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      {/* 移动端顶部导航栏 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/40 backdrop-blur-xl border-b border-white/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">内容工厂</h1>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-gray-700" />
          ) : (
            <Menu className="w-6 h-6 text-gray-700" />
          )}
        </button>
      </div>

      {/* 移动端菜单遮罩 */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 侧边栏 - 桌面端始终显示，移动端抽屉式 */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white/40 backdrop-blur-xl border-r border-white/50 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo区域 */}
        <div className="p-6 border-b border-white/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">内容工厂</h1>
              <p className="text-xs text-gray-500">智能创作平台</p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              return (
                <li key={item.href}>
                  <Link
                    href={item.href === '/image-generate' ? `${item.href}?history=true` : item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                    ${isActive
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                      }
                  `}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className={`text-xs ${isActive ? 'text-blue-500' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* 底部信息 */}
        <div className="p-4 border-t border-white/50">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-white mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="font-semibold">今日统计</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-white/90 text-sm">
                <span>分析任务</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex justify-between text-white/90 text-sm">
                <span>生成文章</span>
                <span className="font-semibold">8</span>
              </div>
              <div className="flex justify-between text-white/90 text-sm">
                <span>已发布</span>
                <span className="font-semibold">5</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}