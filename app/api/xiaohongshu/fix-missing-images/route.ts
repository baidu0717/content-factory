import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken, uploadFileToFeishu, getUserAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

/**
 * 扫描飞书表格，找出图片缺失的记录
 */
async function findRecordsWithMissingImages(appToken: string, tableId: string) {
  console.log('[修复工具] 开始扫描表格，查找图片缺失的记录...')

  const appAccessToken = await getAppAccessToken()

  // 获取所有记录
  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${appAccessToken}`
      }
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`获取记录失败: ${data.msg}`)
  }

  const records = data.data?.items || []
  console.log('[修复工具] 表格共有', records.length, '条记录')

  // 筛选出图片缺失的记录
  const missingImageRecords = records.filter((record: any) => {
    const fields = record.fields
    const hasCover = fields['封面'] && fields['封面'].length > 0
    const hasImage2 = fields['图片2'] && fields['图片2'].length > 0
    const hasMoreImages = fields['后续图片'] && fields['后续图片'].length > 0

    // 只要有任意一个图片字段为空，就认为有问题
    return !hasCover || !hasImage2
  })

  console.log('[修复工具] 发现', missingImageRecords.length, '条记录存在图片缺失')

  // 提取笔记链接和记录ID
  const result = missingImageRecords.map((record: any) => ({
    recordId: record.record_id,
    url: record.fields['笔记链接'],
    title: record.fields['标题'] || '未知标题',
    hasCover: !!(record.fields['封面'] && record.fields['封面'].length > 0),
    hasImage2: !!(record.fields['图片2'] && record.fields['图片2'].length > 0),
    hasMoreImages: !!(record.fields['后续图片'] && record.fields['后续图片'].length > 0)
  }))

  return result
}

/**
 * 从极致了API重新获取图片
 */
async function refetchImagesFromAPI(url: string): Promise<string[]> {
  console.log('[修复工具] 从极致了API重新获取图片:', url)

  // 复用原有的解析逻辑
  const { parseXiaohongshu } = await import('../quick-save/route')
  const { images } = await parseXiaohongshu(url)

  console.log('[修复工具] 获取到', images.length, '张图片URL')
  return images
}

/**
 * 下载并上传图片
 */
async function downloadAndUploadImage(imageUrl: string, appToken: string): Promise<string | null> {
  try {
    // 复用原有的下载逻辑
    const { downloadImage } = await import('../quick-save/route')
    const imageBuffer = await downloadImage(imageUrl)

    // 上传到飞书
    const fileName = `fixed_image_${Date.now()}.jpg`
    const fileToken = await uploadFileToFeishu(imageBuffer, fileName, appToken)

    return fileToken
  } catch (error) {
    console.error('[修复工具] 图片处理失败:', error)
    return null
  }
}

/**
 * 更新记录的图片字段
 */
async function updateRecordImages(
  appToken: string,
  tableId: string,
  recordId: string,
  fileTokens: Array<string | null>
) {
  console.log('[修复工具] 更新记录图片:', recordId)

  const appAccessToken = await getAppAccessToken()

  const fields: any = {}

  // 封面
  if (fileTokens[0]) {
    fields['封面'] = [{ file_token: fileTokens[0] }]
  }

  // 图片2
  if (fileTokens[1]) {
    fields['图片2'] = [{ file_token: fileTokens[1] }]
  }

  // 后续图片
  if (fileTokens.length > 2) {
    const remainingTokens = fileTokens
      .slice(2)
      .filter((token): token is string => token !== null)
      .map(token => ({ file_token: token }))

    if (remainingTokens.length > 0) {
      fields['后续图片'] = remainingTokens
    }
  }

  const response = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({ fields })
    }
  )

  const data = await response.json()

  if (data.code !== 0) {
    throw new Error(`更新记录失败: ${data.msg}`)
  }

  console.log('[修复工具] 记录更新成功')
}

/**
 * POST /api/xiaohongshu/fix-missing-images
 * 自动检测并修复飞书表格中图片缺失的记录
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appToken, tableId, dryRun = true } = body

    console.log('[修复工具] 收到请求:', { appToken, tableId, dryRun })

    if (!appToken || !tableId) {
      return NextResponse.json({
        success: false,
        message: '❌ 请提供 appToken 和 tableId'
      }, { status: 400 })
    }

    // 1. 扫描表格，找出图片缺失的记录
    const missingRecords = await findRecordsWithMissingImages(appToken, tableId)

    if (missingRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: '✅ 所有记录的图片都完整，无需修复',
        data: { total: 0, fixed: 0, failed: 0 }
      })
    }

    console.log('[修复工具] 发现以下记录需要修复:')
    missingRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.title}`)
      console.log(`     - 链接: ${record.url}`)
      console.log(`     - 封面: ${record.hasCover ? '✓' : '✗'}`)
      console.log(`     - 图片2: ${record.hasImage2 ? '✓' : '✗'}`)
      console.log(`     - 后续图片: ${record.hasMoreImages ? '✓' : '✗'}`)
    })

    // 如果是干跑模式，只返回检测结果，不执行修复
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `🔍 检测到 ${missingRecords.length} 条记录需要修复\n\n请设置 dryRun=false 来执行修复`,
        data: {
          total: missingRecords.length,
          records: missingRecords.map(r => ({
            title: r.title,
            url: r.url,
            missing: {
              cover: !r.hasCover,
              image2: !r.hasImage2,
              moreImages: !r.hasMoreImages
            }
          }))
        }
      })
    }

    // 2. 执行修复
    const results = {
      total: missingRecords.length,
      fixed: 0,
      failed: 0,
      details: [] as any[]
    }

    for (const record of missingRecords) {
      try {
        console.log(`[修复工具] 正在修复: ${record.title}`)

        // 从API重新获取图片
        const images = await refetchImagesFromAPI(record.url)

        // 下载并上传图片
        const fileTokens: Array<string | null> = []
        for (const imageUrl of images) {
          const token = await downloadAndUploadImage(imageUrl, appToken)
          fileTokens.push(token)
        }

        // 更新记录
        await updateRecordImages(appToken, tableId, record.recordId, fileTokens)

        results.fixed++
        results.details.push({
          title: record.title,
          status: 'success',
          imagesFixed: fileTokens.filter(Boolean).length
        })

        console.log(`[修复工具] ✅ 修复成功: ${record.title}`)

      } catch (error: any) {
        console.error(`[修复工具] ❌ 修复失败: ${record.title}`, error)
        results.failed++
        results.details.push({
          title: record.title,
          status: 'failed',
          error: error.message
        })
      }

      // 每条记录之间延迟1秒，避免触发频率限制
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return NextResponse.json({
      success: true,
      message: `✅ 修复完成\n\n总计: ${results.total} 条\n成功: ${results.fixed} 条\n失败: ${results.failed} 条`,
      data: results
    })

  } catch (error) {
    console.error('[修复工具] 错误:', error)
    return NextResponse.json({
      success: false,
      message: `❌ 发生错误: ${error instanceof Error ? error.message : '未知错误'}`
    }, { status: 500 })
  }
}
