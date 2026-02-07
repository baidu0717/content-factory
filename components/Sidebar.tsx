'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Send,
  Zap,
  Menu,
  X,
  Sparkles,
  Image,
  Database,
  Target
} from 'lucide-react'

const menuItems = [
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
    href: '/collect',
    label: '批量采集',
    icon: Target,
    description: '关键词批量采集笔记'
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
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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

      {/* 侧边栏 - 桌面端抽屉式，移动端抽屉式 */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white/40 backdrop-blur-xl border-r border-white/50 flex flex-col
          transform transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isHovered ? 'lg:w-64' : 'lg:w-16'}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo区域 */}
        <div className="p-6 border-b border-white/50 overflow-hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className={`transition-all duration-300 ${isHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 lg:opacity-0 lg:w-0'}`}>
              <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">内容工厂</h1>
              <p className="text-xs text-gray-500 whitespace-nowrap">智能创作平台</p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 overflow-hidden">
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
                    prefetch={false}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                      ${isActive
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                      }
                      ${!isHovered ? 'lg:justify-center' : ''}
                    `}
                    title={!isHovered ? item.label : ''}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div className={`transition-all duration-300 ${isHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 lg:opacity-0 lg:w-0'}`}>
                      <p className="font-medium whitespace-nowrap">{item.label}</p>
                      <p className={`text-xs whitespace-nowrap ${isActive ? 'text-blue-500' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

      </aside>
    </>
  )
}