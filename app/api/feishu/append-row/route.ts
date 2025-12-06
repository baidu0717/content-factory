import { NextRequest, NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

// 飞书API配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_APP_TOKEN = process.env.FEISHU_APP_TOKEN || '' // 多维表格的 app_token
const FEISHU_TABLE_ID = process.env.FEISHU_TABLE_ID || ''   // 数据表的 table_id
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
  url: string            // 笔记链接
}

/**
 * 获取 tenant_access_token
 */
async function getTenantAccessToken(): Promise<string> {
  console.log('[飞书API] 获取 tenant_access_token...')

  try {
    const response = await fetch(`${FEISHU_API_URL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
      // @ts-ignore
      agent: proxyAgent,
    })

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`获取token失败: ${data.msg}`)
    }

    console.log('[飞书API] token获取成功')
    return data.tenant_access_token
  } catch (error) {
    console.error('[飞书API] 获取token失败:', error)
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

    // 验证配置
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置飞书API密钥，请检查环境变量 FEISHU_APP_ID 和 FEISHU_APP_SECRET',
        },
        { status: 500 }
      )
    }

    if (!FEISHU_APP_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置多维表格Token，请检查环境变量 FEISHU_APP_TOKEN',
        },
        { status: 500 }
      )
    }

    if (!FEISHU_TABLE_ID) {
      return NextResponse.json(
        {
          success: false,
          error: '未配置数据表ID，请检查环境变量 FEISHU_TABLE_ID',
        },
        { status: 500 }
      )
    }

    // 解析请求参数
    const body: AppendRowRequest = await request.json()
    const { title, images, content, tags, url } = body

    console.log('[飞书导出API] 笔记标题:', title)
    console.log('[飞书导出API] 图片数量:', images.length)

    // 参数验证
    if (!title || !url) {
      return NextResponse.json(
        { success: false, error: '标题和链接不能为空' },
        { status: 400 }
      )
    }

    // 获取认证token
    const accessToken = await getTenantAccessToken()

    // 准备多维表格记录数据
    // 注意：字段名必须与多维表格中的字段名完全一致
    // URL类型字段需要使用对象格式 { link: "url" }
    // 空值字段不传递，避免飞书报错
    const recordFields: Record<string, any> = {
      '笔记链接': { link: url },
      '标题': title,
      '正文': content || '',
      '话题标签': tags || '',
    }

    // 只添加非空的图片字段
    if (images[0]) recordFields['封面'] = { link: images[0] }
    if (images[1]) recordFields['图片 2'] = { link: images[1] }
    if (images[2]) recordFields['图片 3'] = { link: images[2] }

    // 追加到多维表格
    await appendRecordToBitable(accessToken, FEISHU_APP_TOKEN, FEISHU_TABLE_ID, recordFields)

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
        appToken: FEISHU_APP_TOKEN,
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
