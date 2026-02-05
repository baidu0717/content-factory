import { NextRequest, NextResponse } from 'next/server'

// 极致了 API 配置（统一使用极致了API）
const JZL_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY || ''
const JZL_API_URL = 'https://www.dajiala.com/fbmain/monitor/v3/xhs'

/**
 * 从小红书链接中提取笔记ID
 */
function extractNoteId(url: string): string | null {
  try {
    // 支持的格式：
    // 1. https://www.xiaohongshu.com/explore/6929d4850000000021021d46
    // 2. https://www.xiaohongshu.com/discovery/item/6929d4850000000021021d46
    // 3. http://xhslink.com/xxx (需要解析重定向后的URL)

    const patterns = [
      /\/explore\/([a-zA-Z0-9]+)/,
      /\/discovery\/item\/([a-zA-Z0-9]+)/,
      /\/note\/([a-zA-Z0-9]+)/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return null
  } catch (error) {
    console.error('[笔记ID提取] 提取失败:', error)
    return null
  }
}

/**
 * 调用极致了API获取笔记完整详情（包含内容、图片、作者、互动数据）
 */
async function fetchNoteDetails(noteId: string) {
  try {
    console.log('[极致了API] 开始获取笔记详情, noteId:', noteId)

    const response = await fetch(JZL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: JZL_API_KEY,
        type: 11, // 笔记详情接口
        note_id: noteId,
      })
    })

    const data = await response.json()

    console.log('[极致了API] 响应状态码:', response.status)
    console.log('[极致了API] 响应数据code:', data.code)

    if (data.code !== 0) {
      console.error('[极致了API] 获取失败:', data)
      return null
    }

    const note = data.note_list?.[0]
    if (!note) {
      console.error('[极致了API] 笔记数据不存在')
      return null
    }

    console.log('[极致了API] 成功获取笔记详情')
    console.log('[极致了API] - 标题:', note.title || note.desc)
    console.log('[极致了API] - 作者:', note.user?.nickname)
    console.log('[极致了API] - 点赞:', note.liked_count || note.likes)
    console.log('[极致了API] - 收藏:', note.collected_count)
    console.log('[极致了API] - 评论:', note.comments_count)
    console.log('[极致了API] - 浏览:', note.view_count)

    // 提取图片列表
    const images: string[] = []
    if (note.images_list && Array.isArray(note.images_list)) {
      note.images_list.forEach((img: any) => {
        if (img.url) {
          images.push(img.url)
        }
      })
    }
    console.log('[极致了API] - 图片数量:', images.length)

    // 提取文本内容和话题标签
    const rawText = note.desc || note.title || ''

    // 提取话题标签
    const tagRegex = /#[^#]+?(?:\[话题\])?#/g
    const tags = rawText.match(tagRegex) || []
    const tagsString = tags.join(' ')

    // 移除话题标签,得到纯文本
    const textWithoutTags = rawText.replace(tagRegex, '').trim()

    // 分离标题和正文
    let title = ''
    let content = ''

    if (textWithoutTags.includes('|||')) {
      const parts = textWithoutTags.split('|||')
      title = parts[0].trim()
      content = parts.slice(1).join('|||').trim()
    } else {
      const lines = textWithoutTags.split('\n').filter((line: string) => line.trim())
      if (lines.length > 0) {
        title = lines[0].trim()
        content = lines.slice(1).join('\n').trim()
      } else {
        title = textWithoutTags.substring(0, 50).trim()
        content = textWithoutTags.substring(50).trim()
      }
    }

    if (!content) {
      content = title
    }

    return {
      title,
      content,
      tags: tagsString,
      images,
      user: {
        nickname: note.user?.nickname || note.user?.name || '',
        avatar: note.user?.image || note.user?.avatar || '',
        user_id: note.user?.userid || note.user?.id || '',
      },
      view_count: note.view_count || 0,
      liked_count: note.liked_count || note.likes || 0,
      collected_count: note.collected_count || 0,
      comment_count: note.comments_count || 0,
      create_time: note.create_time || null,
      id: note.note_id || noteId,
    }
  } catch (error) {
    console.error('[极致了API] 调用异常:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    // 参数验证
    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { success: false, error: '请提供有效的小红书链接' },
        { status: 400 }
      )
    }

    // 验证是否为小红书链接
    const isXiaohongshuUrl = url.includes('xiaohongshu.com') ||
                              url.includes('xhslink.com') ||
                              url.includes('xhs.cn')

    if (!isXiaohongshuUrl) {
      return NextResponse.json(
        { success: false, error: '请提供小红书链接（支持 xiaohongshu.com、xhslink.com、xhs.cn）' },
        { status: 400 }
      )
    }

    console.log('[小红书解析] 开始解析链接:', url)

    // 从URL提取笔记ID
    const noteId = extractNoteId(url)

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: '无法从链接中提取笔记ID，请检查链接格式' },
        { status: 400 }
      )
    }

    console.log('[小红书解析] 提取到笔记ID:', noteId)

    // 调用极致了API获取完整笔记详情
    const noteDetails = await fetchNoteDetails(noteId)

    if (!noteDetails) {
      return NextResponse.json(
        { success: false, error: '获取笔记详情失败，请稍后重试' },
        { status: 500 }
      )
    }

    console.log('[小红书解析] 解析成功')
    console.log('[小红书解析] 标题:', noteDetails.title)
    console.log('[小红书解析] 正文:', noteDetails.content)
    console.log('[小红书解析] 话题标签:', noteDetails.tags)
    console.log('[小红书解析] 图片数量:', noteDetails.images.length)
    console.log('[小红书解析] 作者:', noteDetails.user.nickname)

    // 返回格式化的数据
    return NextResponse.json({
      success: true,
      data: {
        title: noteDetails.title,
        content: noteDetails.content,
        tags: noteDetails.tags,
        images: noteDetails.images,
        id: noteDetails.id,
        createdAt: noteDetails.create_time,
        user: noteDetails.user,
        view_count: noteDetails.view_count,
        liked_count: noteDetails.liked_count,
        collected_count: noteDetails.collected_count,
        comment_count: noteDetails.comment_count,
        create_time: noteDetails.create_time,
      }
    })

  } catch (error) {
    console.error('[小红书解析] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '解析过程中发生未知错误'
      },
      { status: 500 }
    )
  }
}
