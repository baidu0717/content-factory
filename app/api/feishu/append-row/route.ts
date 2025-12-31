import { NextRequest, NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getUserAccessToken } from '@/lib/feishuAuth'
import axios from 'axios'
import FormData from 'form-data'

// 飞书API配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_API_URL = process.env.FEISHU_API_URL || 'https://open.feishu.cn/open-apis'

// 代理配置
const HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const proxyAgent = HTTPS_PROXY ? new HttpsProxyAgent(HTTPS_PROXY) : undefined

// 请求参数类型
interface AppendRowRequest {
  title: string           // 标题
  images: string[]        // 图片URL数组
  content: string         // 正文内容
  tags: string           // 话题标签
  nickname: string       // 作者昵称
  url: string            // 笔记链接
  appToken: string       // 多维表格的 app_token
  tableId: string        // 数据表的 table_id
}

// getTenantAccessToken 已移除，改用用户授权的 user_access_token

/**
 * 下载图片
 */
async function downloadImage(imageUrl: string): Promise<Buffer> {
  console.log('[图片下载] 下载图片:', imageUrl)

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      httpsAgent: proxyAgent,
      timeout: 30000, // 30秒超时
    })

    console.log('[图片下载] 下载成功，大小:', response.data.length, 'bytes')
    return Buffer.from(response.data)
  } catch (error) {
    console.error('[图片下载] 下载失败:', error)
    throw new Error(`下载图片失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 上传图片到飞书获取file_token
 */
async function uploadImageToFeishu(
  token: string,
  imageBuffer: Buffer,
  fileName: string,
  appToken: string
): Promise<string> {
  console.log('[飞书API] 上传图片到飞书:', fileName, '大小:', imageBuffer.length, 'bytes')

  try {
    const form = new FormData()

    // 飞书上传API需要的参数
    form.append('file_name', fileName)
    form.append('parent_type', 'bitable_image')
    form.append('parent_node', appToken)
    form.append('size', String(imageBuffer.length))
    form.append('file', imageBuffer, { filename: fileName })

    // 使用axios上传，支持form-data
    const response = await axios.post(
      `${FEISHU_API_URL}/drive/v1/medias/upload_all`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...form.getHeaders(),
        },
        httpsAgent: proxyAgent,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    )

    const data = response.data

    if (data.code !== 0) {
      console.error('[飞书API] 上传图片失败:', data)
      throw new Error(`上传图片失败: ${data.msg}`)
    }

    console.log('[飞书API] 图片上传成功, file_token:', data.data.file_token)
    return data.data.file_token
  } catch (error) {
    console.error('[飞书API] 上传图片异常:', error)
    throw error
  }
}

/**
 * 向飞书多维表格追加一条记录
 */
async function appendRecordToBitable(
  token: string,
  appToken: string,
  tableId: string,
  fields: Record<string, any>
): Promise<void> {
  console.log('[飞书API] 向多维表格追加记录...')
  console.log('[飞书API] App Token:', appToken)
  console.log('[飞书API] Table ID:', tableId)

  try {
    const response = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: fields,
        }),
        // @ts-ignore
        agent: proxyAgent,
      }
    )

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书API] API返回错误:', data)
      throw new Error(`追加记录失败: ${data.msg || JSON.stringify(data)}`)
    }

    console.log('[飞书API] 记录追加成功')
  } catch (error) {
    console.error('[飞书API] 追加记录失败:', error)
    throw error
  }
}

/**
 * POST /api/feishu/append-row
 * 将小红书笔记数据追加到飞书多维表格
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('='.repeat(80))
    console.log('[飞书导出API] 收到请求')

    // 解析请求参数
    const body: AppendRowRequest = await request.json()
    const { title, images, content, tags, nickname, url, appToken, tableId } = body

    console.log('[飞书导出API] 笔记标题:', title)
    console.log('[飞书导出API] 作者昵称:', nickname)
    console.log('[飞书导出API] 图片数量:', images.length)
    console.log('[飞书导出API] 目标表格:', appToken, tableId)

    // 参数验证
    if (!title || !url) {
      return NextResponse.json(
        { success: false, error: '标题和链接不能为空' },
        { status: 400 }
      )
    }

    if (!appToken || !tableId) {
      return NextResponse.json(
        { success: false, error: '请提供表格Token和表ID' },
        { status: 400 }
      )
    }

    // 获取用户access_token（自动刷新）
    const accessToken = await getUserAccessToken()

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: '用户未登录或登录已过期，请重新登录',
          needLogin: true,
        },
        { status: 401 }
      )
    }

    console.log('[飞书导出API] 使用用户token操作')

    // 下载并上传图片到飞书（并行处理）
    console.log('[飞书导出API] 开始并行处理图片...')
    const imagesToProcess = images.slice(0, 3).filter(Boolean)

    // 并行处理所有图片（下载+上传同时进行）
    const imagePromises = imagesToProcess.map(async (imageUrl, i) => {
      try {
        console.log(`[飞书导出API] 开始处理第 ${i + 1} 张图片...`)
        const imageBuffer = await downloadImage(imageUrl)
        const fileName = `image_${Date.now()}_${i}.jpg`
        const fileToken = await uploadImageToFeishu(accessToken, imageBuffer, fileName, appToken)
        console.log(`[飞书导出API] 第 ${i + 1} 张图片处理完成`)
        return fileToken
      } catch (error) {
        console.error(`[飞书导出API] 处理第 ${i + 1} 张图片失败:`, error)
        return null
      }
    })

    // 等待所有图片处理完成
    const results = await Promise.all(imagePromises)
    const fileTokens = results.filter((token): token is string => token !== null)

    console.log(`[飞书导出API] 成功上传 ${fileTokens.length}/${imagesToProcess.length} 张图片`)

    // 准备多维表格记录数据
    // 注意：字段名必须与多维表格中的字段名完全一致
    // URL类型字段格式：{ link: "url", text: "显示文本" } 或 { link: "url" }
    // 文本/多行文本类型：直接传字符串
    // 附件类型字段格式：[{ file_token: "xxx" }]
    const recordFields: Record<string, any> = {
      '笔记链接': url,  // 多行文本类型，直接传字符串
      '作者昵称': nickname || '',
      '标题': title,
      '正文': content || '',
      '话题标签': tags || '',
    }

    // 添加图片附件字段
    if (fileTokens[0]) recordFields['封面'] = [{ file_token: fileTokens[0] }]
    if (fileTokens[1]) recordFields['图片 2'] = [{ file_token: fileTokens[1] }]
    if (fileTokens[2]) recordFields['图片 3'] = [{ file_token: fileTokens[2] }]

    console.log('[飞书导出API] 准备写入的字段:', JSON.stringify(recordFields, null, 2))

    // 追加到多维表格
    await appendRecordToBitable(accessToken, appToken, tableId, recordFields)

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('[飞书导出API] 导出成功')
    console.log('[飞书导出API] 耗时:', duration + 'ms')
    console.log('='.repeat(80))

    return NextResponse.json({
      success: true,
      data: {
        message: '已成功保存到飞书多维表格',
        duration: duration,
        appToken: appToken,
      },
    })
  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime

    console.error('[飞书导出API] 错误:', error)
    console.log('[飞书导出API] 失败耗时:', duration + 'ms')
    console.log('='.repeat(80))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导出到飞书失败',
      },
      { status: 500 }
    )
  }
}
