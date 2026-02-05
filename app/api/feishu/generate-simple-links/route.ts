import { NextRequest, NextResponse } from 'next/server'
import { getUserAccessToken, getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL

/**
 * POST /api/feishu/generate-simple-links
 * 为飞书表格中所有记录生成简化版复刻链接（使用 record_id）
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔗 开始生成简化版复刻链接...')

    if (!APP_TOKEN || !TABLE_ID) {
      return NextResponse.json({
        success: false,
        error: '未配置表格信息',
      }, { status: 400 })
    }

    // 1. 获取访问令牌
    let accessToken: string
    try {
      accessToken = await getUserAccessToken()
      console.log('[Token] 使用 user_access_token')
    } catch (error) {
      console.log('[Token] user token失败，尝试使用 app_access_token')
      accessToken = await getAppAccessToken()
      console.log('[Token] 使用 app_access_token')
    }

    // 2. 获取所有记录
    console.log('📋 获取表格记录...')
    const recordsResponse = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records?page_size=500`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const recordsData = await recordsResponse.json()

    if (recordsData.code !== 0) {
      throw new Error(`获取记录失败: ${recordsData.msg}`)
    }

    const records = recordsData.data.items
    console.log(`✅ 获取到 ${records.length} 条记录`)

    // 3. 获取字段列表
    console.log('🔍 获取字段映射...')
    const fieldsResponse = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const fieldsData = await fieldsResponse.json()
    if (fieldsData.code !== 0) {
      throw new Error(`获取字段列表失败: ${fieldsData.msg}`)
    }

    const fields = fieldsData.data.items
    const fieldMap: Record<string, string> = {}
    fields.forEach((field: any) => {
      fieldMap[field.field_name] = field.field_id
    })

    console.log('📝 字段映射:', fieldMap)

    const titleFieldId = fieldMap['标题']
    const contentFieldId = fieldMap['正文']
    const linkFieldId = fieldMap['去复刻'] || fieldMap['复刻链接']

    if (!titleFieldId || !contentFieldId || !linkFieldId) {
      return NextResponse.json({
        success: false,
        error: '表格中缺少必要字段：标题、正文、去复刻（或复刻链接）',
        found_fields: Object.keys(fieldMap),
      }, { status: 400 })
    }

    // 4. 为每条记录生成简化版链接
    console.log('🔗 开始生成链接...')
    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const record of records) {
      try {
        const recordId = record.record_id
        const fields = record.fields

        const title = fields['标题'] || ''
        const content = fields['正文'] || ''

        // 如果标题或正文为空，跳过
        if (!title || !content) {
          console.log(`⏭️  跳过记录 ${recordId}（标题=${!!title}, 正文=${!!content}）`)
          skipCount++
          continue
        }

        // 生成简化版链接（使用 record_id）
        const rewriteUrl = `${BASE_URL}/api/feishu/redirect-to-rewrite?record_id=${recordId}`

        // 更新记录的"复刻链接"字段
        const updateResponse = await fetch(
          `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                [linkFieldId]: rewriteUrl
              }
            })
          }
        )

        const updateData = await updateResponse.json()

        if (updateData.code !== 0) {
          console.error(`❌ 更新记录 ${recordId} 失败:`, updateData.msg)
          errorCount++
        } else {
          console.log(`✅ 已生成链接: ${recordId}`)
          successCount++
        }

        // 延迟避免频率限制
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`❌ 处理记录失败:`, error)
        errorCount++
      }
    }

    console.log('🎉 链接生成完成!')
    console.log(`✅ 成功: ${successCount} 条`)
    console.log(`⏭️  跳过: ${skipCount} 条`)
    console.log(`❌ 失败: ${errorCount} 条`)

    return NextResponse.json({
      success: true,
      data: {
        total: records.length,
        success: successCount,
        skipped: skipCount,
        failed: errorCount,
      },
      message: '简化版复刻链接生成完成！',
    })

  } catch (error) {
    console.error('❌ 生成链接失败:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '生成链接失败',
    }, { status: 500 })
  }
}
