import {
  XiaohongshuApiResponse,
  XiaohongshuSearchParams,
  XiaohongshuNote,
  XiaohongshuDetailResponse
} from '@/types/xiaohongshu-api'

// 详情接口配置（哼哼猫API，从环境变量读取）
const DETAIL_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE || 'https://api.meowload.net/openapi/extract/post'
const DETAIL_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY || ''

/**
 * 搜索小红书笔记（通过 /api/xiaohongshu/search 代理 302.ai）
 * @param params 搜索参数
 * @returns Promise<XiaohongshuApiResponse>
 */
export async function searchXiaohongshuNotes(
  params: Omit<XiaohongshuSearchParams, 'key'>
): Promise<XiaohongshuApiResponse> {
  const startTime = Date.now()

  console.log('🔍 [搜索接口] 开始搜索 (302.ai)')
  console.log('关键词:', params.keyword, '页码:', params.page || 1, '排序:', params.sort || 'general')

  const qs = new URLSearchParams({
    keyword: params.keyword,
    page: String(params.page || 1),
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.searchId !== undefined ? { searchId: params.searchId } : {}),
    ...(params.sessionId !== undefined ? { sessionId: params.sessionId } : {}),
  })

  try {
    const response = await fetch(`/api/xiaohongshu/search?${qs}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: XiaohongshuApiResponse = await response.json()

    if (data.code !== 0) {
      const errorMsg = (data as any).msg || 'API请求失败'
      throw new Error(`搜索错误: ${errorMsg}`)
    }

    console.log('✅ 搜索完成，耗时:', Date.now() - startTime + 'ms，条数:', (data as any).data?.items?.length || 0)
    return data
  } catch (error) {
    console.error('❌ 搜索失败:', error)
    throw error
  }
}

/**
 * 将API返回的数据转换为标准化的笔记数据
 * @param apiResponse API响应数据
 * @returns XiaohongshuNote[]
 */
export function transformToNotes(apiResponse: XiaohongshuApiResponse): XiaohongshuNote[] {
  // 检测API版本：APP API v2的数据在data.items中，Web API的数据直接在items中
  const isAppApiV2 = !!(apiResponse as any).data?.items
  const items = isAppApiV2 ? (apiResponse as any).data.items : apiResponse.items

  console.log('🔄 开始转换笔记数据，总数:', items?.length || 0)
  console.log('📱 API版本:', isAppApiV2 ? 'APP API v2' : 'Web API')

  if (!items || items.length === 0) {
    console.log('⚠️ 没有找到笔记数据')
    return []
  }

  const notes = items
    .filter((item: any) => {
      // APP API v2使用item.note，Web API使用item.note_card
      if (isAppApiV2) {
        return item.note
      } else {
        return item.note_card
      }
    })
    .map((item: any, index: number) => {
      // 根据API版本获取笔记数据
      const noteData = isAppApiV2 ? item.note : item.note_card

      if (isAppApiV2) {
        // APP API v2的数据结构
        const likedCount = noteData.liked_count || 0
        const collectedCount = noteData.collected_count || 0
        const commentCount = noteData.comments_count || 0
        const sharedCount = noteData.shared_count || 0

        console.log(`  [${index + 1}] ID: ${noteData.id}`)

        return {
          id: noteData.id,
          xsec_token: noteData.xsec_token || '',
          title: noteData.title || '无标题',
          cover: noteData.images_list?.[0]?.url || '',
          liked_count: likedCount,
          collected_count: collectedCount,
          comment_count: commentCount,
          shared_count: sharedCount,
          interact_count: likedCount + collectedCount + commentCount,
          user_name: noteData.user?.nickname || '',
          user_avatar: noteData.user?.images || '',
          type: noteData.type || 'normal',
        }
      } else {
        // Web API的数据结构
        const interactInfo = noteData.interact_info

        const likedCount = parseInt(interactInfo.liked_count) || 0
        const collectedCount = parseInt(interactInfo.collected_count) || 0
        const commentCount = parseInt(interactInfo.comment_count) || 0
        const sharedCount = parseInt(interactInfo.shared_count) || 0

        console.log(`  [${index + 1}] ID: ${item.id}, xsec_token: ${item.xsec_token}`)

        return {
          id: item.id,
          xsec_token: item.xsec_token,
          title: noteData.display_title || '无标题',
          cover: noteData.cover.url_default,
          liked_count: likedCount,
          collected_count: collectedCount,
          comment_count: commentCount,
          shared_count: sharedCount,
          interact_count: likedCount + collectedCount + commentCount,
          user_name: noteData.user.nickname || noteData.user.nick_name,
          user_avatar: noteData.user.avatar,
          type: noteData.type,
        }
      }
    })

  console.log('✅ 转换完成，有效笔记数:', notes.length)
  return notes
}

/**
 * 批量搜索多页笔记
 * @param keyword 关键词
 * @param totalPages 总页数
 * @returns Promise<XiaohongshuApiResponse[]>
 */
export async function searchMultiplePages(
  keyword: string,
  totalPages: number = 1
): Promise<XiaohongshuApiResponse[]> {
  const promises: Promise<XiaohongshuApiResponse>[] = []

  for (let page = 1; page <= totalPages; page++) {
    promises.push(
      searchXiaohongshuNotes({
        keyword,
        page,
        type: 1,
        sort: 'general',
        note_type: 'image',
        note_time: '不限',
        note_range: '不限',
        proxy: '',
      })
    )
  }

  return Promise.all(promises)
}

/**
 * 获取小红书笔记详情（使用哼哼猫API）
 * @param url 笔记分享链接
 * @returns Promise<XiaohongshuDetailResponse>
 */
export async function getNoteDetail(url: string): Promise<XiaohongshuDetailResponse> {
  const requestStartTime = Date.now()

  console.log('\n┌─────────────────────────────────────────────────────────────')
  console.log('│ 🌐 [详情接口] 准备发起请求（哼哼猫API）')
  console.log('│ 目标URL:', url)
  console.log('│ API地址:', DETAIL_API_URL)
  console.log('│ API密钥:', DETAIL_API_KEY)

  try {
    // 构建请求体
    const requestBody = {
      url: url
    }

    console.log('│ 请求方法: POST')
    console.log('│ 请求体:', JSON.stringify(requestBody, null, 2))
    console.log('│ ⏰ 发起HTTP请求...')

    const fetchStartTime = Date.now()
    const response = await fetch(DETAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DETAIL_API_KEY,
        'accept-language': 'zh' // 使用中文错误信息
      },
      body: JSON.stringify(requestBody)
    })
    const fetchEndTime = Date.now()
    const fetchTime = fetchEndTime - fetchStartTime

    console.log('│ 📡 HTTP响应返回 (耗时 ' + fetchTime + 'ms)')
    console.log('│ 状态码:', response.status)
    console.log('│ 状态文本:', response.statusText)
    console.log('│ Content-Type:', response.headers.get('Content-Type'))

    console.log('│ 🔄 解析JSON数据...')
    const parseStartTime = Date.now()
    const data = await response.json()
    const parseEndTime = Date.now()
    const parseTime = parseEndTime - parseStartTime

    console.log('│ ✅ JSON解析完成 (耗时 ' + parseTime + 'ms)')

    // 检查HTTP状态码
    if (!response.ok) {
      console.log('│ ❌ HTTP响应不正常! 状态码:', response.status)
      console.log('│ 错误信息:', data.message || '未知错误')
      throw new Error(data.message || `HTTP error! status: ${response.status}`)
    }

    console.log('│ 📦 返回数据结构:')
    console.log('│   - text (正文):', data.text ? `存在 (${data.text.length}字)` : '不存在')
    console.log('│   - medias数量:', data.medias?.length || 0)
    console.log('│   - id:', data.id || '(空)')
    console.log('│   - created_at:', data.created_at || '(空)')

    if (data.text) {
      const preview = data.text.length > 100
        ? data.text.substring(0, 100) + '...'
        : data.text
      console.log('│   - 正文预览:', preview)
    }

    if (data.medias && data.medias.length > 0) {
      console.log('│   - 媒体列表:')
      data.medias.forEach((media: any, index: number) => {
        console.log(`│     [${index + 1}] 类型: ${media.media_type}, URL: ${media.resource_url?.substring(0, 60)}...`)
      })
    }

    const requestEndTime = Date.now()
    const totalTime = requestEndTime - requestStartTime
    console.log('│ ✅ 详情接口调用成功!')
    console.log('│ 总耗时:', totalTime + 'ms')
    console.log('└─────────────────────────────────────────────────────────────')

    return data as XiaohongshuDetailResponse
  } catch (error) {
    const requestEndTime = Date.now()
    const totalTime = requestEndTime - requestStartTime

    console.log('│ ❌ 详情接口调用失败!')
    console.log('│ 失败耗时:', totalTime + 'ms')
    console.error('│ 错误对象:', error)

    if (error instanceof Error) {
      console.error('│ 错误类型:', error.name)
      console.error('│ 错误消息:', error.message)
      if (error.stack) {
        console.error('│ 错误堆栈:', error.stack.split('\n').slice(0, 3).join('\n│   '))
      }
    } else {
      console.error('│ 未知错误类型:', typeof error)
    }

    console.log('└─────────────────────────────────────────────────────────────')
    throw error
  }
}

/**
 * 批量获取笔记详情并更新笔记对象
 * @param notes 笔记列表
 * @returns Promise<XiaohongshuNote[]> 包含详情的笔记列表
 */
export async function fetchNotesWithDetails(notes: XiaohongshuNote[]): Promise<XiaohongshuNote[]> {
  const startTime = Date.now()
  console.log('='.repeat(80))
  console.log(`📝 [批量获取详情] 开始时间: ${new Date().toLocaleString()}`)
  console.log(`📝 [批量获取详情] 需要获取 ${notes.length} 条笔记的详情`)
  console.log(`📝 [批量获取详情] API配置: ${DETAIL_API_URL}`)
  console.log(`📝 [批量获取详情] API密钥: ${DETAIL_API_KEY}`)
  console.log('='.repeat(80))

  let successCount = 0
  let failCount = 0

  // 使用 Promise.allSettled 来处理部分失败的情况
  const detailPromises = notes.map(async (note, index) => {
    const noteStartTime = Date.now()
    console.log(`\n--- [${index + 1}/${notes.length}] 开始处理笔记 ---`)
    console.log(`笔记ID: ${note.id}`)
    console.log(`笔记标题: ${note.title}`)
    console.log(`xsec_token: ${note.xsec_token}`)

    try {
      // 构建笔记URL，必须包含 xsec_token 参数
      const noteUrl = `https://www.xiaohongshu.com/explore/${note.id}?xsec_token=${note.xsec_token}`
      console.log(`🔗 构建的URL（含token）: ${noteUrl}`)
      console.log(`⏰ 开始调用详情接口...`)

      const detailResponse = await getNoteDetail(noteUrl)

      const noteEndTime = Date.now()
      const noteTime = noteEndTime - noteStartTime

      console.log(`✅ [${index + 1}/${notes.length}] 成功获取笔记详情 (耗时 ${noteTime}ms)`)
      console.log(`📄 返回数据:`, {
        id: note.id,
        title: note.title,
        hasText: !!detailResponse.text,
        textLength: detailResponse.text?.length || 0,
        textPreview: detailResponse.text?.substring(0, 100) || '(空)',
        mediasCount: detailResponse.medias?.length || 0
      })

      successCount++

      // 将详情中的 text（正文内容）添加到笔记对象中，保留所有原有字段包括 xsec_token
      return {
        ...note, // 保留原有的所有字段，包括 xsec_token
        content: detailResponse.text, // 这里的 text 是正文内容
      }
    } catch (error) {
      failCount++
      const noteEndTime = Date.now()
      const noteTime = noteEndTime - noteStartTime

      console.error(`❌ [${index + 1}/${notes.length}] 获取笔记详情失败 (耗时 ${noteTime}ms)`)
      console.error(`笔记ID: ${note.id}`)
      console.error(`错误信息:`, error)
      if (error instanceof Error) {
        console.error(`错误类型: ${error.name}`)
        console.error(`错误消息: ${error.message}`)
        console.error(`错误堆栈:`, error.stack)
      }

      // 失败时返回原笔记对象，不影响其他笔记
      return note
    }
  })

  console.log(`\n⏳ 等待所有详情接口调用完成...`)
  const results = await Promise.allSettled(detailPromises)

  // 提取成功的结果
  const finalNotes = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      console.error(`⚠️ Promise rejected for note ${notes[index].id}:`, result.reason)
      // 如果失败，返回原始笔记
      return notes[index]
    }
  })

  const endTime = Date.now()
  const totalTime = endTime - startTime

  console.log('\n' + '='.repeat(80))
  console.log(`📊 [批量获取详情] 完成时间: ${new Date().toLocaleString()}`)
  console.log(`📊 [批量获取详情] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`)
  console.log(`📊 [批量获取详情] 成功: ${successCount}/${notes.length} (${((successCount / notes.length) * 100).toFixed(1)}%)`)
  console.log(`📊 [批量获取详情] 失败: ${failCount}/${notes.length} (${((failCount / notes.length) * 100).toFixed(1)}%)`)
  console.log(`📊 [批量获取详情] 平均每条耗时: ${(totalTime / notes.length).toFixed(0)}ms`)
  console.log('='.repeat(80))

  return finalNotes
}
