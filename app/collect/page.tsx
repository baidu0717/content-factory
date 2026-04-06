'use client'

import { useState } from 'react'
import {
  Search,
  Loader2,
  Plus,
  X,
  Upload,
  Download,
  Flame,
  MessageCircle,
  FileText,
  CheckCircle,
  AlertCircle,
  Heart,
  Bookmark,
  DollarSign,
  Pause,
  Play,
  Table,
  ExternalLink,
} from 'lucide-react'
import { searchXiaohongshuNotes, transformToNotes, fetchNotesWithDetails } from '@/lib/xiaohongshu-api'
import type { XiaohongshuNote } from '@/types/xiaohongshu-api'

// 笔记分级类型
type NoteLevel = 'hot' | 'high-comment' | 'normal'

interface EnrichedNote extends XiaohongshuNote {
  level: NoteLevel
  commentRatio: number
}

interface KeywordStatus {
  keyword: string
  status: 'pending' | 'collecting' | 'completed' | 'error'
  progress: number
  collected: number
  totalCost: number
  notes: EnrichedNote[]
  error?: string
}

// 排序策略配置
const sortStrategies = [
  { value: 'comment_descending', label: '💬 评论优先', desc: '按评论数排序，找高评论笔记', apiType: 9 },
  { value: 'popularity_descending', label: '❤️ 点赞优先', desc: '按点赞数排序，找爆款笔记', apiType: 9 },
  { value: 'collect_descending', label: '⭐ 收藏优先', desc: '按收藏数排序，找高价值笔记', apiType: 9 },
  { value: 'general', label: '📊 综合排序', desc: '综合推荐排序', apiType: 9 },
  { value: 'time_descending', label: '⏰ 最新优先', desc: '按发布时间排序', apiType: 9 },
] as const

export default function CollectPage() {
  const [keywords, setKeywords] = useState<string[]>([])
  const [inputKeyword, setInputKeyword] = useState('')
  const [isCollecting, setIsCollecting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [keywordStatuses, setKeywordStatuses] = useState<KeywordStatus[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [totalCollected, setTotalCollected] = useState(0)
  const [sortStrategy, setSortStrategy] = useState<typeof sortStrategies[number]['value']>('comment_descending')

  // 飞书表格信息
  const [feishuTable, setFeishuTable] = useState<{ appToken: string; tableId: string; url: string } | null>(null)
  const [isCreatingTable, setIsCreatingTable] = useState(false)
  const [isExportingToFeishu, setIsExportingToFeishu] = useState(false)
  const [isBatchExtracting, setIsBatchExtracting] = useState(false)
  const [isLoadingDefaultTable, setIsLoadingDefaultTable] = useState(false)

  const COST_PER_SEARCH = 0.1
  const INITIAL_LIMIT = 100
  const CONTINUE_THRESHOLD = 50
  const MAX_TOTAL = 500

  // 添加关键词
  const handleAddKeyword = () => {
    if (!inputKeyword.trim()) return
    const newKeyword = inputKeyword.trim()
    if (keywords.includes(newKeyword)) {
      alert('关键词已存在')
      return
    }
    setKeywords([...keywords, newKeyword])
    setInputKeyword('')
  }

  // 删除关键词
  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index))
  }

  // 批量添加
  const handleBatchAdd = () => {
    const text = prompt('请输入关键词，每行一个：')
    if (!text) return
    const newKeywords = text
      .split('\n')
      .map(k => k.trim())
      .filter(k => k && !keywords.includes(k))
    setKeywords([...keywords, ...newKeywords])
  }

  // 分级笔记
  const classifyNote = (note: XiaohongshuNote): EnrichedNote => {
    const totalInteract = note.liked_count + note.collected_count + note.comment_count
    const commentRatio = totalInteract > 0 ? (note.comment_count / totalInteract) * 100 : 0

    let level: NoteLevel = 'normal'

    if (totalInteract > 100) {
      level = 'hot'
    } else if (
      note.liked_count + note.collected_count > 15 &&
      (note.comment_count > 20 || commentRatio > 25)
    ) {
      level = 'high-comment'
    }

    return {
      ...note,
      level,
      commentRatio,
    }
  }

  // 采集单个关键词
  const collectKeyword = async (keyword: string, index: number): Promise<EnrichedNote[]> => {
    console.log(`开始采集: ${keyword}，排序策略: ${sortStrategy}`)

    // 获取当前选择的排序策略配置
    const selectedStrategy = sortStrategies.find(s => s.value === sortStrategy)!
    const apiType = selectedStrategy.apiType

    let allNotes: XiaohongshuNote[] = []
    let page = 1
    let hasMore = true
    let keywordCost = 0
    let searchId: string | undefined = undefined
    let sessionId: string | undefined = undefined

    setKeywordStatuses((prev) => {
      const newStatuses = [...prev]
      newStatuses[index] = {
        ...newStatuses[index],
        status: 'collecting',
        progress: 0,
      }
      return newStatuses
    })

    try {
      // 第一阶段：采集100条
      while (allNotes.length < INITIAL_LIMIT && hasMore && !isPaused) {
        const response = await searchXiaohongshuNotes({
          type: apiType,
          keyword,
          page: apiType === 9 ? page.toString() : page, // APP API v2需要字符串
          sort: sortStrategy,
          note_type: apiType === 9 ? 'note' : 'image', // APP API v2使用'note'
          note_time: apiType === 9 ? '' : '不限', // APP API v2空表示不限
          // note_range和proxy只用于Web API
          ...(apiType === 1 ? { note_range: '不限', proxy: '' } : {}),
          // APP API v2 分页参数（必须传递，即使是空字符串）
          ...(apiType === 9 ? { searchId: searchId || '', sessionId: sessionId || '' } : {}),
        })

        // 保存分页参数供下次使用
        if (apiType === 9 && response.searchId) {
          searchId = response.searchId
          sessionId = response.sessionId || ''
        }

        keywordCost += COST_PER_SEARCH
        setTotalCost((prev) => prev + COST_PER_SEARCH)

        const notes = transformToNotes(response)
        allNotes = [...allNotes, ...notes]

        const progress = Math.min((allNotes.length / INITIAL_LIMIT) * 50, 50)
        setKeywordStatuses((prev) => {
          const newStatuses = [...prev]
          newStatuses[index] = {
            ...newStatuses[index],
            collected: allNotes.length,
            totalCost: keywordCost,
            progress,
          }
          return newStatuses
        })

        hasMore = response.has_more
        page++
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // 检查第100条
      if (allNotes.length >= INITIAL_LIMIT) {
        const note100 = allNotes[INITIAL_LIMIT - 1]
        const totalInteract =
          note100.liked_count + note100.collected_count + note100.comment_count

        if (totalInteract >= CONTINUE_THRESHOLD && hasMore && !isPaused) {
          while (allNotes.length < MAX_TOTAL && hasMore && !isPaused) {
            const response = await searchXiaohongshuNotes({
              type: apiType,
              keyword,
              page: apiType === 9 ? page.toString() : page, // APP API v2需要字符串
              sort: sortStrategy,
              note_type: apiType === 9 ? 'note' : 'image', // APP API v2使用'note'
              note_time: apiType === 9 ? '' : '不限', // APP API v2空表示不限
              // note_range和proxy只用于Web API
              ...(apiType === 1 ? { note_range: '不限', proxy: '' } : {}),
              // APP API v2 分页参数（必须传递，即使是空字符串）
              ...(apiType === 9 ? { searchId: searchId || '', sessionId: sessionId || '' } : {}),
            })

            // 保存分页参数供下次使用
            if (apiType === 9 && response.searchId) {
              searchId = response.searchId
              sessionId = response.sessionId || ''
            }

            keywordCost += COST_PER_SEARCH
            setTotalCost((prev) => prev + COST_PER_SEARCH)

            const notes = transformToNotes(response)
            allNotes = [...allNotes, ...notes]

            const progress =
              50 +
              Math.min(((allNotes.length - INITIAL_LIMIT) / (MAX_TOTAL - INITIAL_LIMIT)) * 50, 50)
            setKeywordStatuses((prev) => {
              const newStatuses = [...prev]
              newStatuses[index] = {
                ...newStatuses[index],
                collected: allNotes.length,
                totalCost: keywordCost,
                progress,
              }
              return newStatuses
            })

            hasMore = response.has_more
            page++
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }
      }

      // 获取详情
      const notesWithDetails = await fetchNotesWithDetails(allNotes)
      const enrichedNotes = notesWithDetails.map(classifyNote)

      setKeywordStatuses((prev) => {
        const newStatuses = [...prev]
        newStatuses[index] = {
          ...newStatuses[index],
          status: 'completed',
          progress: 100,
          notes: enrichedNotes,
          collected: enrichedNotes.length,
          totalCost: keywordCost,
        }
        return newStatuses
      })

      setTotalCollected((prev) => prev + enrichedNotes.length)

      return enrichedNotes
    } catch (error) {
      setKeywordStatuses((prev) => {
        const newStatuses = [...prev]
        newStatuses[index] = {
          ...newStatuses[index],
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误',
        }
        return newStatuses
      })

      return []
    }
  }

  // 多维度采集（使用多种排序策略）
  const collectMultiDimensional = async (keyword: string, index: number): Promise<EnrichedNote[]> => {
    console.log(`🎯 开始多维度采集: ${keyword}`)

    // 定义4种排序策略（使用APP API v2 type=9，按文档要求）
    const strategies = [
      { sort: 'popularity_descending', label: '点赞最多', apiType: 9 },
      { sort: 'collect_descending', label: '收藏最多', apiType: 9 },
      { sort: 'comment_descending', label: '评论最多', apiType: 9 },
      { sort: 'general', label: '综合排序', apiType: 9 },
    ] as const

    let allNotes: XiaohongshuNote[] = []
    let totalCost = 0
    const notesMap = new Map<string, XiaohongshuNote>() // 用于去重

    setKeywordStatuses((prev) => {
      const newStatuses = [...prev]
      newStatuses[index] = {
        ...newStatuses[index],
        status: 'collecting',
        progress: 0,
      }
      return newStatuses
    })

    try {
      // 遍历每种排序策略
      for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {
        const strategy = strategies[strategyIndex]
        const apiType = strategy.apiType

        console.log(`\n📊 [${strategyIndex + 1}/4] 正在采集: ${strategy.label}`)

        let page = 1
        let hasMore = true
        let searchId: string | undefined = undefined
        let sessionId: string | undefined = undefined
        let strategyNotes: XiaohongshuNote[] = []

        // 采集前100条（大约5页）
        while (strategyNotes.length < 100 && hasMore && !isPaused) {
          const response = await searchXiaohongshuNotes({
            type: apiType,
            keyword,
            page: page.toString(),
            sort: strategy.sort as any,
            note_type: 'note',
            note_time: 'halfyear',
            searchId: searchId || '',
            sessionId: sessionId || '',
          })

          // 保存分页参数供下次使用
          if (apiType === 9 && (response as any).searchId) {
            searchId = (response as any).searchId
            sessionId = (response as any).sessionId || ''
          }

          totalCost += COST_PER_SEARCH
          setTotalCost((prev) => prev + COST_PER_SEARCH)

          const notes = transformToNotes(response)
          strategyNotes = [...strategyNotes, ...notes]

          // APP API v2 (type=9) 返回的 has_more 可能在不同位置，或者不存在
          // 如果 has_more 为 undefined，只要获取到了笔记，就继续
          const responseHasMore = response.has_more !== undefined ? response.has_more : (notes.length > 0)

          console.log(`  📄 第${page}页: 获取${notes.length}条, 累计${strategyNotes.length}条, has_more=${responseHasMore}`)

          // 添加到去重Map中
          notes.forEach(note => {
            if (!notesMap.has(note.id)) {
              notesMap.set(note.id, note)
            }
          })

          const progress = ((strategyIndex * 100 + (strategyNotes.length / 100) * 100) / 400) * 100
          setKeywordStatuses((prev) => {
            const newStatuses = [...prev]
            newStatuses[index] = {
              ...newStatuses[index],
              collected: notesMap.size,
              totalCost: totalCost,
              progress,
            }
            return newStatuses
          })

          hasMore = responseHasMore
          page++

          // 如果获取的笔记数为0，提前终止
          if (notes.length === 0) {
            console.log(`  ⚠️ API返回0条笔记，提前终止`)
            break
          }

          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        console.log(`✅ ${strategy.label} 采集完成: ${strategyNotes.length} 条, has_more=${hasMore}`)
      }

      // 转换为数组
      allNotes = Array.from(notesMap.values())
      console.log(`\n🎉 多维度采集完成！`)
      console.log(`📊 总计: ${allNotes.length} 条笔记（去重后）`)
      console.log(`💰 总成本: ${totalCost.toFixed(2)} 元`)

      // 获取详情（不获取详情，因为数量太多）
      // 只进行分级
      const enrichedNotes = allNotes.map(classifyNote)

      setKeywordStatuses((prev) => {
        const newStatuses = [...prev]
        newStatuses[index] = {
          ...newStatuses[index],
          status: 'completed',
          progress: 100,
          notes: enrichedNotes,
          collected: enrichedNotes.length,
          totalCost: totalCost,
        }
        return newStatuses
      })

      setTotalCollected((prev) => prev + enrichedNotes.length)

      return enrichedNotes
    } catch (error) {
      setKeywordStatuses((prev) => {
        const newStatuses = [...prev]
        newStatuses[index] = {
          ...newStatuses[index],
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误',
        }
        return newStatuses
      })

      return []
    }
  }

  // 开始采集
  const handleStartCollect = async () => {
    if (keywords.length === 0) {
      alert('请先添加关键词')
      return
    }

    setIsCollecting(true)
    setIsPaused(false)
    setTotalCost(0)
    setTotalCollected(0)

    const initialStatuses: KeywordStatus[] = keywords.map((keyword) => ({
      keyword,
      status: 'pending',
      progress: 0,
      collected: 0,
      totalCost: 0,
      notes: [],
    }))
    setKeywordStatuses(initialStatuses)

    for (let i = 0; i < keywords.length; i++) {
      if (isPaused) break
      await collectKeyword(keywords[i], i)
    }

    setIsCollecting(false)
  }

  // 开始多维度采集
  const handleStartMultiDimensional = async () => {
    if (keywords.length === 0) {
      alert('请先添加关键词')
      return
    }

    setIsCollecting(true)
    setIsPaused(false)
    setTotalCost(0)
    setTotalCollected(0)

    const initialStatuses: KeywordStatus[] = keywords.map((keyword) => ({
      keyword,
      status: 'pending',
      progress: 0,
      collected: 0,
      totalCost: 0,
      notes: [],
    }))
    setKeywordStatuses(initialStatuses)

    for (let i = 0; i < keywords.length; i++) {
      if (isPaused) break
      await collectMultiDimensional(keywords[i], i)
    }

    setIsCollecting(false)
  }

  // 使用默认飞书表格
  const handleUseDefaultTable = () => {
    setIsLoadingDefaultTable(true)
    try {
      // 从环境变量读取默认表格配置（通过客户端公开变量）
      const appToken = process.env.NEXT_PUBLIC_DEFAULT_FEISHU_APP_TOKEN
      const tableId = process.env.NEXT_PUBLIC_DEFAULT_FEISHU_TABLE_ID

      if (!appToken || !tableId) {
        // 如果没有配置环境变量，使用测试成功的表格
        const defaultAppToken = 'CCLKbTIdLa8xyYsA9y5c7coZnkd'
        const defaultTableId = 'tbl8HtFvCqiuf5YT'
        const defaultUrl = `https://ai.feishu.cn/base/${defaultAppToken}?table=${defaultTableId}`

        setFeishuTable({
          appToken: defaultAppToken,
          tableId: defaultTableId,
          url: defaultUrl,
        })
        alert('已使用默认采集表格！\n所有采集的笔记将添加到同一张表格中。')
      } else {
        const url = `https://ai.feishu.cn/base/${appToken}?table=${tableId}`
        setFeishuTable({
          appToken,
          tableId,
          url,
        })
        alert('已使用配置的默认表格！')
      }
    } catch (error) {
      console.error('加载默认表格失败:', error)
      alert(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsLoadingDefaultTable(false)
    }
  }

  // 创建飞书表格
  const handleCreateFeishuTable = async () => {
    setIsCreatingTable(true)
    try {
      const response = await fetch('/api/feishu/create-table', {
        method: 'POST',
      })

      const result = await response.json()

      if (result.success) {
        setFeishuTable({
          appToken: result.data.app_token,
          tableId: result.data.table_id,
          url: result.data.url,
        })
        alert(`飞书表格创建成功！\n点击下方链接查看表格`)
      } else {
        throw new Error(result.error || '创建失败')
      }
    } catch (error) {
      console.error('创建飞书表格失败:', error)
      alert(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsCreatingTable(false)
    }
  }

  // 导出到飞书
  const handleExportToFeishu = async () => {
    if (!feishuTable) {
      alert('请先创建飞书表格')
      return
    }

    const allNotes = keywordStatuses.flatMap((status) => status.notes)

    if (allNotes.length === 0) {
      alert('没有可导出的数据')
      return
    }

    setIsExportingToFeishu(true)
    try {
      const response = await fetch('/api/feishu/export-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appToken: feishuTable.appToken,
          tableId: feishuTable.tableId,
          notes: allNotes,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`成功导出 ${result.count} 条笔记到飞书！`)
      } else {
        throw new Error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('导出到飞书失败:', error)
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsExportingToFeishu(false)
    }
  }

  // 批量提取勾选的笔记详情
  const handleBatchExtract = async () => {
    if (!feishuTable) {
      alert('请先创建飞书表格')
      return
    }

    if (!confirm('确定要提取飞书表格中勾选的笔记详情吗？\n\n注意：每条笔记费用 0.01元')) {
      return
    }

    setIsBatchExtracting(true)
    try {
      // 1. 获取勾选的笔记
      console.log('📋 正在读取勾选的笔记...')
      const getNotesResponse = await fetch('/api/feishu/get-checked-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appToken: feishuTable.appToken,
          tableId: feishuTable.tableId,
        }),
      })

      const notesResult = await getNotesResponse.json()

      if (!notesResult.success) {
        throw new Error(notesResult.error || '读取笔记失败')
      }

      if (notesResult.total === 0) {
        alert('没有勾选任何笔记！\n\n请在飞书表格中勾选"需要提取"列，然后重试。')
        return
      }

      console.log(`✅ 找到 ${notesResult.total} 条勾选的笔记`)

      // 2. 批量提取详情
      console.log('🔍 开始批量提取详情...')
      const extractResponse = await fetch('/api/feishu/batch-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appToken: feishuTable.appToken,
          tableId: feishuTable.tableId,
          notes: notesResult.notes,
        }),
      })

      const extractResult = await extractResponse.json()

      if (!extractResult.success) {
        throw new Error(extractResult.error || '批量提取失败')
      }

      const cost = extractResult.successCount * 0.01
      alert(
        `批量提取完成！\n\n` +
          `总共: ${extractResult.total} 条\n` +
          `成功: ${extractResult.successCount} 条\n` +
          `失败: ${extractResult.failCount} 条\n` +
          `费用: ${cost.toFixed(2)} 元`
      )
    } catch (error) {
      console.error('批量提取失败:', error)
      alert(`批量提取失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsBatchExtracting(false)
    }
  }

  // 导出CSV
  const handleExport = () => {
    const allNotes = keywordStatuses.flatMap((status) => status.notes)

    const csvContent = [
      [
        '关键词',
        '笔记ID',
        '标题',
        '用户',
        '点赞',
        '收藏',
        '评论',
        '总互动',
        '评论占比',
        '分级',
        '链接',
      ].join(','),
      ...allNotes.map((note) => {
        const status = keywordStatuses.find((s) => s.notes.includes(note))
        const levelText = note.level === 'hot' ? '小爆款' : note.level === 'high-comment' ? '高评论' : '普通'
        return [
          status?.keyword || '',
          note.id,
          `"${note.title.replace(/"/g, '""')}"`,
          note.user_name,
          note.liked_count,
          note.collected_count,
          note.comment_count,
          note.interact_count,
          note.commentRatio.toFixed(2) + '%',
          levelText,
          `https://www.xiaohongshu.com/explore/${note.id}`,
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `小红书采集_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 统计
  const stats = {
    hot: keywordStatuses.reduce(
      (sum, s) => sum + s.notes.filter((n) => n.level === 'hot').length,
      0
    ),
    highComment: keywordStatuses.reduce(
      (sum, s) => sum + s.notes.filter((n) => n.level === 'high-comment').length,
      0
    ),
    normal: keywordStatuses.reduce(
      (sum, s) => sum + s.notes.filter((n) => n.level === 'normal').length,
      0
    ),
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">批量采集笔记</h1>
        <p className="text-gray-500 mt-1">
          智能采集小红书笔记，自动分级筛选
        </p>
      </div>

      {/* 关键词输入 */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">关键词管理</h2>
          <button
            onClick={handleBatchAdd}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center space-x-2 text-sm"
          >
            <Upload className="w-4 h-4" />
            <span>批量添加</span>
          </button>
        </div>

        <div className="flex space-x-3 mb-4">
          <input
            type="text"
            value={inputKeyword}
            onChange={(e) => setInputKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
            placeholder="输入关键词，如：法意瑞小团、法国定制..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleAddKeyword}
            disabled={!inputKeyword.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>添加</span>
          </button>
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <div
                key={index}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full flex items-center space-x-2"
              >
                <span className="text-sm">{keyword}</span>
                <button
                  onClick={() => handleRemoveKeyword(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 排序策略选择 */}
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
          <h3 className="text-sm font-semibold text-purple-900 mb-3">🎯 排序策略</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sortStrategies.map((strategy) => (
              <button
                key={strategy.value}
                onClick={() => setSortStrategy(strategy.value)}
                disabled={isCollecting}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  sortStrategy === strategy.value
                    ? 'border-purple-500 bg-white shadow-md'
                    : 'border-transparent bg-white/50 hover:bg-white hover:border-purple-200'
                } ${isCollecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="font-medium text-sm text-gray-900">{strategy.label}</div>
                <div className="text-xs text-gray-600 mt-1">{strategy.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 采集策略</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 每个关键词先采集 100 条笔记</li>
            <li>• 检查第 100 条互动数，如果 ≥ {CONTINUE_THRESHOLD}，继续采集至 {MAX_TOTAL} 条</li>
            <li>• 搜索成本：{COST_PER_SEARCH} 元/页（约20条/页）</li>
            <li>• 自动分级：🔥小爆款（互动&gt;100）/ 💬高评论 / 📝普通</li>
          </ul>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              已添加 <span className="font-semibold text-gray-900">{keywords.length}</span> 个关键词
            </p>
          </div>
          <div className="flex space-x-3">
            {isCollecting && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-6 py-3 rounded-lg flex items-center space-x-2 ${
                  isPaused
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="w-5 h-5" />
                    <span>继续</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5" />
                    <span>暂停</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleStartCollect}
              disabled={keywords.length === 0 || isCollecting}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isCollecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>采集中...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>开始采集</span>
                </>
              )}
            </button>
            <button
              onClick={handleStartMultiDimensional}
              disabled={keywords.length === 0 || isCollecting}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
              title="使用4种排序方式（点赞最多、收藏最多、评论最多、综合）各采集前100篇，自动去重合并，发布时间筛选为半年内"
            >
              {isCollecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>采集中...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>🎯 多维度采集</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 采集进度 */}
      {keywordStatuses.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">采集进度</h2>
          <div className="space-y-3">
            {keywordStatuses.map((status, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-gray-900">{status.keyword}</span>
                    {status.status === 'pending' && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                        等待中
                      </span>
                    )}
                    {status.status === 'collecting' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>采集中</span>
                      </span>
                    )}
                    {status.status === 'completed' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>完成</span>
                      </span>
                    )}
                    {status.status === 'error' && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>失败</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">{status.collected} 条</span>
                    <span className="text-gray-600">¥{status.totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>

                {status.error && (
                  <p className="text-xs text-red-600 mt-2">错误: {status.error}</p>
                )}

                {status.notes.length > 0 && (
                  <div className="flex items-center space-x-4 text-xs text-gray-600 mt-2">
                    <span className="flex items-center space-x-1">
                      <Flame className="w-3 h-3 text-orange-500" />
                      <span>{status.notes.filter((n) => n.level === 'hot').length} 小爆款</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <MessageCircle className="w-3 h-3 text-blue-500" />
                      <span>{status.notes.filter((n) => n.level === 'high-comment').length} 高评论</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <FileText className="w-3 h-3 text-gray-500" />
                      <span>{status.notes.filter((n) => n.level === 'normal').length} 普通</span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 统计 */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">🔥 小爆款</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.hot}</p>
                </div>
                <Flame className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">💬 高评论</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.highComment}</p>
                </div>
                <MessageCircle className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">📝 普通</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.normal}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-500" />
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">💰 总成本</p>
                  <p className="text-2xl font-bold text-green-600">¥{totalCost.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>

          {/* 飞书集成 */}
          {totalCollected > 0 && (
            <div className="mt-6 space-y-4">
              {/* 飞书表格状态 */}
              {feishuTable && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Table className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">飞书表格已创建</span>
                    </div>
                    <a
                      href={feishuTable.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <span>打开表格</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-end space-x-3">
                {!feishuTable ? (
                  <>
                    <button
                      onClick={handleUseDefaultTable}
                      disabled={isLoadingDefaultTable}
                      className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isLoadingDefaultTable ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>加载中...</span>
                        </>
                      ) : (
                        <>
                          <Table className="w-5 h-5" />
                          <span>使用默认表格</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleCreateFeishuTable}
                      disabled={isCreatingTable}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isCreatingTable ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>创建中...</span>
                        </>
                      ) : (
                        <>
                          <Table className="w-5 h-5" />
                          <span>创建新表格</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleExportToFeishu}
                      disabled={isExportingToFeishu}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isExportingToFeishu ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>导出中...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>导出到飞书 ({totalCollected}条)</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleBatchExtract}
                      disabled={isBatchExtracting}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isBatchExtracting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>提取中...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5" />
                          <span>提取勾选笔记详情</span>
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  onClick={handleExport}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>导出CSV ({totalCollected}条)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
