/**
 * 系统设置 API
 * GET /api/settings - 获取系统设置
 * PUT /api/settings - 更新系统设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { testFeishuWebhook } from '@/lib/feishu-webhook'

interface SystemSetting {
  id: number
  key: string
  value: string
  updated_at: number
}

/**
 * GET - 获取系统设置
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    const db = getDb()

    if (key) {
      // 获取单个设置
      const setting = db
        .prepare('SELECT * FROM system_settings WHERE key = ?')
        .get(key) as SystemSetting | undefined

      if (!setting) {
        return NextResponse.json(
          {
            success: false,
            error: '设置不存在',
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        setting,
      })
    } else {
      // 获取所有设置
      const settings = db.prepare('SELECT * FROM system_settings').all() as SystemSetting[]

      // 转换为键值对象
      const settingsObj: Record<string, string> = {}
      settings.forEach((setting) => {
        settingsObj[setting.key] = setting.value
      })

      return NextResponse.json({
        success: true,
        settings: settingsObj,
      })
    }
  } catch (error) {
    console.error('[API] 获取系统设置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取失败',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT - 更新系统设置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少设置键名',
        },
        { status: 400 }
      )
    }

    const db = getDb()

    // 检查设置是否存在
    const existing = db
      .prepare('SELECT * FROM system_settings WHERE key = ?')
      .get(key) as SystemSetting | undefined

    if (existing) {
      // 更新现有设置
      db.prepare('UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?').run(
        value,
        Date.now(),
        key
      )
    } else {
      // 插入新设置
      db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
        key,
        value,
        Date.now()
      )
    }

    const updatedSetting = db
      .prepare('SELECT * FROM system_settings WHERE key = ?')
      .get(key) as SystemSetting

    return NextResponse.json({
      success: true,
      setting: updatedSetting,
    })
  } catch (error) {
    console.error('[API] 更新系统设置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新失败',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - 测试飞书 Webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, webhookUrl } = body

    if (action === 'test_feishu_webhook') {
      if (!webhookUrl) {
        return NextResponse.json(
          {
            success: false,
            error: '缺少 Webhook 地址',
          },
          { status: 400 }
        )
      }

      const result = await testFeishuWebhook(webhookUrl)

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: '测试成功',
        })
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || '测试失败',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: '不支持的操作',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[API] 操作失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '操作失败',
      },
      { status: 500 }
    )
  }
}
