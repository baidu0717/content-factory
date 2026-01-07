import { NextRequest, NextResponse } from 'next/server'
import { updateRecord, uploadImage } from '@/lib/feishu-bitable'
import { getNoteDetail } from '@/lib/xiaohongshu-api'

/**
 * 处理飞书按钮点击，提取笔记详情
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('🔔 [Webhook] 收到飞书按钮点击事件')
    console.log('📦 请求体:', JSON.stringify(body, null, 2))

    // 解析飞书发送的数据
    const { app_token, table_id, record_id, fields } = body

    const noteId = fields['笔记ID']
    const noteLink = fields['笔记链接']?.link || fields['笔记链接']

    if (!noteId || !noteLink) {
      throw new Error('缺少笔记ID或链接')
    }

    console.log(`📝 开始提取笔记详情: ${noteId}`)
    console.log(`🔗 笔记链接: ${noteLink}`)

    // 更新状态为"提取中"
    await updateRecord(app_token, table_id, record_id, {
      '提取状态': '⏳ 提取中...',
    })

    try {
      // 1. 调用哼哼猫API提取详情
      const detail = await getNoteDetail(noteLink)

      console.log(`✅ 笔记详情提取成功`)
      console.log(`📄 正文长度: ${detail.text?.length || 0} 字`)
      console.log(`🖼️ 图片数量: ${detail.medias?.length || 0} 张`)

      // 2. 上传图片到飞书
      const updateFields: any = {
        '正文内容': detail.text || '',
        '提取状态': '✅ 已提取',
      }

      if (detail.medias && detail.medias.length > 0) {
        console.log(`📤 开始上传 ${detail.medias.length} 张图片...`)

        for (let i = 0; i < Math.min(detail.medias.length, 9); i++) {
          const media = detail.medias[i]

          // 只处理图片类型
          if (media.media_type === 'image') {
            try {
              console.log(`  [${i + 1}/${detail.medias.length}] 上传图片: ${media.resource_url}`)

              const imageKey = await uploadImage(media.resource_url, app_token)

              // 飞书附件字段格式
              const fieldName = i === 0 ? '封面' : `图片${i + 1}`
              updateFields[fieldName] = [
                {
                  file_token: imageKey,
                  name: `image_${i + 1}.jpg`,
                  size: 0,
                  type: 'image/jpeg',
                },
              ]

              console.log(`  ✅ 图片 ${i + 1} 上传成功`)
            } catch (error) {
              console.error(`  ❌ 图片 ${i + 1} 上传失败:`, error)
            }
          }
        }
      }

      // 3. 更新飞书记录
      await updateRecord(app_token, table_id, record_id, updateFields)

      console.log(`✅ 飞书记录更新成功`)

      return NextResponse.json({
        success: true,
        message: '提取成功',
        data: {
          text_length: detail.text?.length || 0,
          images_count: detail.medias?.length || 0,
        },
      })
    } catch (error) {
      // 提取失败，更新状态
      await updateRecord(app_token, table_id, record_id, {
        '提取状态': '❌ 提取失败',
      })

      throw error
    }
  } catch (error) {
    console.error('❌ [Webhook] 处理失败:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '处理失败',
      },
      { status: 500 }
    )
  }
}
