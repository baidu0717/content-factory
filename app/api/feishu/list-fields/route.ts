import { NextRequest, NextResponse } from 'next/server'
import { getAppAccessToken } from '@/lib/feishuAuth'

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const APP_TOKEN = process.env.FEISHU_DEFAULT_APP_TOKEN || ''
const TABLE_ID = process.env.FEISHU_DEFAULT_TABLE_ID || ''

/**
 * GET /api/feishu/list-fields
 * 列出飞书表格中所有字段名称，用于调试
 */
export async function GET(request: NextRequest) {
  try {
    if (!APP_TOKEN || !TABLE_ID) {
      return NextResponse.json({
        success: false,
        error: '未配置表格信息（FEISHU_DEFAULT_APP_TOKEN 和 FEISHU_DEFAULT_TABLE_ID）',
      }, { status: 400 })
    }

    console.log('[飞书字段列表] 开始获取字段列表')
    console.log('[飞书字段列表] App Token:', APP_TOKEN)
    console.log('[飞书字段列表] Table ID:', TABLE_ID)

    // 1. 获取访问令牌
    const accessToken = await getAppAccessToken()

    // 2. 获取字段列表
    const response = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[飞书字段列表] 获取失败:', data)
      return NextResponse.json({
        success: false,
        error: `获取字段列表失败: ${data.msg}`,
      }, { status: 500 })
    }

    const fields = data.data.items

    console.log('[飞书字段列表] 成功获取', fields.length, '个字段')

    // 3. 格式化输出
    const fieldList = fields.map((field: any, index: number) => ({
      序号: index + 1,
      字段名: field.field_name,
      字段类型: getFieldTypeName(field.type),
      字段ID: field.field_id,
      是否主字段: field.is_primary || false,
    }))

    // 4. 生成公式建议
    const 标题字段 = fields.find((f: any) => f.field_name === '标题')
    const 正文字段 = fields.find((f: any) => f.field_name === '正文' || f.field_name === '正文内容')
    const 标签字段 = fields.find((f: any) => f.field_name === '话题标签')

    let formulaSuggestion = ''
    if (标题字段 && 正文字段 && 标签字段) {
      formulaSuggestion = `CONCATENATE(
  "https://content-factory-jade-nine.vercel.app/rewrite?title=",
  ENCODEURL(${标题字段.field_name}),
  "&content=",
  ENCODEURL(${正文字段.field_name}),
  "&tags=",
  ENCODEURL(${标签字段.field_name})
)`
    }

    return NextResponse.json({
      success: true,
      data: {
        total: fields.length,
        fields: fieldList,
        formula_suggestion: formulaSuggestion,
        tips: [
          '📋 字段列表已按顺序显示',
          '',
          '✅ 推荐的公式字段配置：',
          '1. 在表格中添加新字段，类型选择"公式"',
          '2. 字段名称：复刻链接',
          '3. 复制下方的 formula_suggestion 公式粘贴到公式编辑器',
          '4. 点击链接即可跳转到复刻页面并自动填充数据',
        ],
      },
    })

  } catch (error) {
    console.error('[飞书字段列表] 异常:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取字段列表失败',
    }, { status: 500 })
  }
}

/**
 * 将字段类型代码转换为中文名称
 */
function getFieldTypeName(type: number): string {
  const typeMap: Record<number, string> = {
    1: '文本',
    2: '数字',
    3: '单选',
    4: '多选',
    5: '日期',
    7: '复选框',
    11: '人员',
    13: '电话',
    15: '超链接',
    17: '附件',
    18: '关联',
    19: '公式',
    20: '创建时间',
    21: '最后更新时间',
    22: '创建人',
    23: '修改人',
    1001: '群组',
    1002: '按钮',
  }

  return typeMap[type] || `未知类型(${type})`
}
