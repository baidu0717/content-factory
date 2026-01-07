import { NextRequest, NextResponse } from 'next/server'
import { updateRecord, uploadImage } from '@/lib/feishu-bitable'

const DETAIL_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY || ''
const DETAIL_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE || ''

/**
 * 批量提取勾选笔记的详细信息
 */
export async function POST(req: NextRequest) {
  try {
    const { appToken, tableId, notes } = await req.json()

    console.log(`🔍 [批量提取] 开始提取 ${notes.length} 条笔记详情...`)

    const results = []
    let successCount = 0
    let failCount = 0

    // 逐个提取笔记详情
    for (const note of notes) {
      try {
        console.log(`\n📝 [提取] 正在提取: ${note.title}`)
        console.log(`🔗 [链接] ${note.link}`)

        // 1. 调用喵加载API获取笔记详情
        const detail = await fetchNoteDetail(note.link)

        if (!detail) {
          throw new Error('获取笔记详情失败')
        }

        // 2. 从正文中提取话题标签并分离
        const { content, tags } = extractTagsFromContent(detail.content)

        // 3. 上传封面图片到飞书
        let coverImageKey = ''
        if (detail.cover) {
          try {
            coverImageKey = await uploadImage(detail.cover, appToken)
            console.log(`✅ [图片] 封面上传成功`)
          } catch (err) {
            console.warn(`⚠️ [图片] 封面上传失败:`, err)
          }
        }

        // 4. 上传所有图片到飞书
        const imageKeys: string[] = []
        if (detail.images && detail.images.length > 0) {
          for (const imageUrl of detail.images) {
            try {
              const imageKey = await uploadImage(imageUrl, appToken)
              imageKeys.push(imageKey)
              console.log(`✅ [图片] 图片上传成功 (${imageKeys.length}/${detail.images.length})`)
            } catch (err) {
              console.warn(`⚠️ [图片] 图片上传失败:`, err)
            }
          }
        }

        // 5. 更新飞书记录
        const updateFields: any = {
          '正文内容': content,
          '话题标签': tags.join(' '),
          '提取状态': '✅ 已提取',
          '需要提取': '⬜ 否', // 取消勾选
        }

        // 添加封面（如果上传成功）
        if (coverImageKey) {
          updateFields['封面'] = [
            {
              file_token: coverImageKey,
            },
          ]
        }

        // 添加所有图片（如果有上传成功的）
        if (imageKeys.length > 0) {
          updateFields['所有图片'] = imageKeys.map((key) => ({
            file_token: key,
          }))
        }

        await updateRecord(appToken, tableId, note.recordId, updateFields)

        console.log(`✅ [提取] 提取成功: ${note.title}`)
        successCount++

        results.push({
          link: note.link,
          title: note.title,
          success: true,
        })

        // 延迟，避免API限流
        await sleep(500)
      } catch (error) {
        console.error(`❌ [提取] 提取失败: ${note.title}`, error)
        failCount++

        // 更新为失败状态
        try {
          await updateRecord(appToken, tableId, note.recordId, {
            '提取状态': '❌ 提取失败',
            '需要提取': '⬜ 否',
          })
        } catch (updateError) {
          console.error(`❌ [更新] 更新失败状态失败:`, updateError)
        }

        results.push({
          link: note.link,
          title: note.title,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        })
      }
    }

    console.log(`\n✅ [批量提取] 完成! 成功: ${successCount}, 失败: ${failCount}`)

    return NextResponse.json({
      success: true,
      total: notes.length,
      successCount,
      failCount,
      results,
    })
  } catch (error) {
    console.error('❌ [批量提取] 批量提取失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量提取失败',
      },
      { status: 500 }
    )
  }
}

/**
 * 调用喵加载API获取笔记详情
 */
async function fetchNoteDetail(noteUrl: string): Promise<any> {
  const response = await fetch(DETAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': DETAIL_API_KEY,
      'accept-language': 'zh',
    },
    body: JSON.stringify({
      url: noteUrl,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  // 提取需要的数据
  return {
    content: data.text || '',
    cover: data.medias?.[0]?.resource_url || '',
    images: data.medias?.map((media: any) => media.resource_url) || [],
  }
}

/**
 * 从正文中提取话题标签
 */
function extractTagsFromContent(text: string): { content: string; tags: string[] } {
  // 匹配 #话题 或 #话题# 格式
  const tagRegex = /#([^#\s]+)#?/g
  const tags: string[] = []
  const matches = text.matchAll(tagRegex)

  for (const match of matches) {
    const tag = `#${match[1]}`
    if (!tags.includes(tag)) {
      tags.push(tag)
    }
  }

  // 从正文中移除话题标签
  const content = text.replace(tagRegex, '').trim()

  return { content, tags }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
