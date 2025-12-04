'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  FileText,
  Send,
  Clock,
  ArrowUp,
  ArrowDown,
  Activity,
  Target,
  Sparkles,
  ChevronRight,
  Search,
  PenTool,
  Eye,
  Heart
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Link from 'next/link'
import GlassCard from '@/components/GlassCard'
import Hero3D from '@/components/Hero3D'

// 模拟数据
const statsData = [
  {
    title: '今日分析',
    value: '23',
    change: '+12%',
    trend: 'up',
    icon: TrendingUp,
    color: 'bg-blue-500'
  },
  {
    title: '生成文章',
    value: '15',
    change: '+8%',
    trend: 'up',
    icon: FileText,
    color: 'bg-green-500'
  },
  {
    title: '已发布',
    value: '12',
    change: '+5%',
    trend: 'up',
    icon: Send,
    color: 'bg-purple-500'
  },
  {
    title: '待审核',
    value: '7',
    change: '-2%',
    trend: 'down',
    icon: Clock,
    color: 'bg-orange-500'
  }
]

const chartData = [
  { name: '周一', 分析: 12, 创作: 8, 发布: 5 },
  { name: '周二', 分析: 15, 创作: 10, 发布: 7 },
  { name: '周三', 分析: 18, 创作: 12, 发布: 8 },
  { name: '周四', 分析: 20, 创作: 15, 发布: 10 },
  { name: '周五', 分析: 25, 创作: 18, 发布: 12 },
  { name: '周六', 分析: 22, 创作: 16, 发布: 11 },
  { name: '周日', 分析: 23, 创作: 15, 发布: 12 },
]

const platformData = [
  { name: '小红书', value: 45, color: '#FF2E63' },
  { name: '公众号', value: 55, color: '#07C160' },
]

const recentArticles = [
  {
    id: 1,
    title: '2024年内容营销趋势分析',
    status: '已发布',
    platform: '小红书',
    views: 1234,
    likes: 89,
    time: '2小时前'
  },
  {
    id: 2,
    title: '如何打造爆款内容的10个技巧',
    status: '待审核',
    platform: '公众号',
    views: 0,
    likes: 0,
    time: '3小时前'
  },
  {
    id: 3,
    title: 'AI在内容创作中的应用',
    status: '已发布',
    platform: '公众号',
    views: 2341,
    likes: 156,
    time: '5小时前'
  },
  {
    id: 4,
    title: '社交媒体运营策略指南',
    status: '草稿',
    platform: '-',
    views: 0,
    likes: 0,
    time: '1天前'
  },
  {
    id: 5,
    title: '用户增长黑客技巧分享',
    status: '已发布',
    platform: '小红书',
    views: 3456,
    likes: 234,
    time: '2天前'
  }
]

const hotTopics = [
  { keyword: 'AI创作', heat: 98, trend: 'up' },
  { keyword: '私域运营', heat: 92, trend: 'up' },
  { keyword: '短视频营销', heat: 88, trend: 'down' },
  { keyword: '内容变现', heat: 85, trend: 'up' },
  { keyword: 'ChatGPT应用', heat: 82, trend: 'up' },
]

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('week')

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      {/* Header & Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            仪表盘
          </h1>
          <p className="text-gray-500 text-lg mb-6">欢迎回来！这是您的内容工厂数据概览</p>

          {/* Time Filters */}
          <div className="flex space-x-2 bg-white/30 backdrop-blur-md p-1 rounded-xl inline-flex border border-white/50">
            {['day', 'week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-6 py-2 rounded-lg transition-all duration-300 ${timeRange === range
                    ? 'bg-white shadow-md text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-white/50'
                  }`}
              >
                {range === 'day' ? '今日' : range === 'week' ? '本周' : '本月'}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="hidden lg:block">
          <Hero3D />
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsData.map((stat, index) => {
            const Icon = stat.icon
            return (
              <motion.div key={index} variants={itemVariants}>
                <GlassCard className="p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                    <Icon className="w-24 h-24" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl ${stat.color} bg-opacity-10 text-white`}>
                        <Icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div className={`flex items-center px-2 py-1 rounded-lg text-xs font-medium ${stat.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {stat.trend === 'up' ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                        {stat.change}
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">{stat.title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</h3>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <GlassCard className="p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-500" />
                  内容生产趋势
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#9CA3AF" axisLine={false} tickLine={false} />
                  <YAxis stroke="#9CA3AF" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="分析" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="创作" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="发布" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <GlassCard className="p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-purple-500" />
                  发布平台分布
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 mt-4">
                {platformData.map((platform, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3 shadow-sm" style={{ backgroundColor: platform.color }} />
                      <span className="text-sm text-gray-600 font-medium">{platform.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">{platform.value}%</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Articles */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">最新文章</h2>
                <Link href="/publish" className="text-blue-500 hover:text-blue-600 text-sm flex items-center font-medium transition-colors">
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div key={article.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-white/50 transition-all duration-300 group border border-transparent hover:border-white/60">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{article.title}</h3>
                      <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${article.status === '已发布' ? 'bg-green-100 text-green-700' :
                            article.status === '待审核' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>
                          {article.status}
                        </span>
                        {article.platform !== '-' && (
                          <span className="flex items-center"><Target className="w-3 h-3 mr-1" />{article.platform}</span>
                        )}
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{article.time}</span>
                      </div>
                    </div>
                    {article.status === '已发布' && (
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <div className="flex items-center">
                          <Eye className="w-4 h-4 mr-1" />
                          {article.views}
                        </div>
                        <div className="flex items-center">
                          <Heart className="w-4 h-4 mr-1" />
                          {article.likes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Hot Topics */}
          <motion.div variants={itemVariants}>
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                  热门话题
                </h2>
              </div>
              <div className="space-y-4">
                {hotTopics.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors">
                    <div className="flex items-center">
                      <span className={`text-lg font-bold w-8 ${index < 3 ? 'text-blue-500' : 'text-gray-400'}`}>#{index + 1}</span>
                      <span className="ml-2 text-gray-900 font-medium">{topic.keyword}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-16 h-2 bg-gray-200/50 rounded-full overflow-hidden mr-3">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                          style={{ width: `${topic.heat}%` }}
                        />
                      </div>
                      {topic.trend === 'up' ? (
                        <ArrowUp className="w-4 h-4 text-red-500" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400 opacity-20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>

            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-6">快速开始</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/analysis" className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105 duration-300 group">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">开始分析</h3>
                  <p className="text-sm text-white/80 mt-2">输入关键词，获取选题洞察</p>
                </Link>
                <Link href="/create" className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105 duration-300 group">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                    <PenTool className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">创作内容</h3>
                  <p className="text-sm text-white/80 mt-2">AI智能生成高质量文章</p>
                </Link>
                <Link href="/publish" className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105 duration-300 group">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform">
                    <Send className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold">发布管理</h3>
                  <p className="text-sm text-white/80 mt-2">一键发布到多个平台</p>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}