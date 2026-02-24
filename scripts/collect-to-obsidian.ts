/**
 * 批量收录脚本：飞书表格 → Obsidian 素材库
 *
 * 逻辑：
 * 1. 读取飞书表格中「收录状态 = 待收录」的笔记
 * 2. 跳过已存在的文件夹
 * 3. 下载图片到本地
 * 4. 生成笔记.md（原始数据 + 图片嵌入，无 AI 分析）
 * 5. 更新飞书「收录状态」→「已收录」
 *
 * 运行方式：
 *   npx ts-node scripts/collect-to-obsidian.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import * as fs from 'fs'
import * as path from 'path'

// 加载 .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis'
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''

// Obsidian 素材库路径
const NOTES_DIR = resolve(process.cwd(), 'content-library/01-内容生产/素材库/爆款笔记库')

// 要收录的飞书表格（法意瑞、西班牙、意大利）
const TABLES = [
  { name: '法意瑞', appToken: 'NNd8bJYazaBwHAsZ2z2cqsvmnqf', tableId: 'tblu1m2GPcFRNSPE' },
  { name: '西班牙', appToken: 'NNd8bJYazaBwHAsZ2z2cqsvmnqf', tableId: 'tbltUxC0qElUbibT' },
  { name: '意大利', appToken: 'NNd8bJYazaBwHAsZ2z2cqsvmnqf', tableId: 'tbl5WFtr4k8sQVJP' },
]

// ─────────────────────────────────────────
// 飞书 API
// ─────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }
  const resp = await fetch(`${FEISHU_API_URL}/auth/v3/app_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  })
  const data = await resp.json() as any
  if (data.code !== 0) throw new Error(`获取Token失败: ${data.msg}`)
  cachedToken = {
    token: data.app_access_token,
    expiresAt: Date.now() + data.expire * 1000,
  }
  return cachedToken.token
}

/** 搜索「收录状态 = 待收录」的记录，支持分页 */
async function getPendingRecords(appToken: string, tableId: string): Promise<any[]> {
  const token = await getAppAccessToken()
  const allRecords: any[] = []
  let pageToken: string | undefined

  do {
    const body: any = {
      filter: {
        conjunction: 'and',
        conditions: [{
          field_name: '收录状态',
          operator: 'is',
          value: ['待收录'],
        }],
      },
      page_size: 100,
    }
    if (pageToken) body.page_token = pageToken

    const resp = await fetch(
      `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    )
    const data = await resp.json() as any
    if (data.code !== 0) throw new Error(`搜索记录失败: ${data.msg}`)

    allRecords.push(...(data.data?.items || []))
    pageToken = data.data?.has_more ? data.data.page_token : undefined
  } while (pageToken)

  return allRecords
}

/** 从飞书下载附件图片 */
async function downloadFeishuImage(fileToken: string): Promise<Buffer> {
  const token = await getAppAccessToken()
  const resp = await fetch(
    `${FEISHU_API_URL}/drive/v1/medias/${fileToken}/download`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}，file_token=${fileToken.substring(0, 20)}...`)
  }
  return Buffer.from(await resp.arrayBuffer())
}

/** 更新飞书「收录状态」→「已收录」 */
async function markAsCollected(appToken: string, tableId: string, recordId: string): Promise<void> {
  const token = await getAppAccessToken()
  const resp = await fetch(
    `${FEISHU_API_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ fields: { '收录状态': '已收录' } }),
    }
  )
  const data = await resp.json() as any
  if (data.code !== 0) throw new Error(`更新状态失败: ${data.msg}`)
}

// ─────────────────────────────────────────
// 收录逻辑
// ─────────────────────────────────────────

function sanitizeName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '')
    .substring(0, 50)
}

async function collectNote(
  record: any,
  tableName: string,
  appToken: string,
  tableId: string
): Promise<boolean> {
  const fields = record.fields
  const recordId = record.record_id

  // 读取字段
  const title = fields['标题'] || '未知标题'
  const content = fields['正文'] || ''
  const tags = fields['话题标签'] || ''
  const author = fields['作者昵称'] || ''
  const publishTime = fields['发布时间'] || ''
  const noteUrl = fields['笔记链接'] || ''
  const likes = Number(fields['点赞数']) || 0
  const collects = Number(fields['收藏数']) || 0
  const comments = Number(fields['评论数']) || 0
  const views = Number(fields['浏览数']) || 0
  const remark = fields['备注'] || ''

  // 评论占比
  const total = likes + collects + comments
  const commentRatio = total > 0 ? ((comments / total) * 100).toFixed(1) + '%' : 'N/A'
  const isHighComment = total > 0 && (comments / total) >= 0.3

  // 文件夹名：YYYYMMDD-标题
  const dateStr = publishTime
    ? String(publishTime).replace(/-/g, '').substring(0, 8)
    : new Date().toISOString().replace(/-/g, '').substring(0, 8)
  const folderName = `${dateStr}-${sanitizeName(title)}`
  const folderPath = path.join(NOTES_DIR, folderName)

  // 跳过已存在
  if (fs.existsSync(folderPath)) {
    console.log(`  ⏭️  已存在，跳过`)
    return false
  }

  fs.mkdirSync(folderPath, { recursive: true })

  // ── 下载图片 ──
  const imageEmbeds: string[] = []
  let imgIndex = 2

  // 封面
  const coverList = fields['封面']
  if (Array.isArray(coverList) && coverList.length > 0) {
    try {
      const buf = await downloadFeishuImage(coverList[0].file_token)
      fs.writeFileSync(path.join(folderPath, '封面.jpg'), buf)
      imageEmbeds.push('![[封面.jpg]]')
      console.log(`  📸 封面 ✓`)
    } catch (e: any) {
      console.error(`  ❌ 封面失败: ${e.message}`)
    }
  }

  // 图片2
  const img2List = fields['图片2']
  if (Array.isArray(img2List) && img2List.length > 0) {
    try {
      const buf = await downloadFeishuImage(img2List[0].file_token)
      const name = `图${imgIndex}.jpg`
      fs.writeFileSync(path.join(folderPath, name), buf)
      imageEmbeds.push(`![[${name}]]`)
      console.log(`  📸 图${imgIndex} ✓`)
      imgIndex++
    } catch (e: any) {
      console.error(`  ❌ 图2失败: ${e.message}`)
      imgIndex++
    }
  }

  // 后续图片
  const moreList = fields['后续图片']
  if (Array.isArray(moreList)) {
    for (const att of moreList) {
      const name = `图${imgIndex}.jpg`
      try {
        const buf = await downloadFeishuImage(att.file_token)
        fs.writeFileSync(path.join(folderPath, name), buf)
        imageEmbeds.push(`![[${name}]]`)
        console.log(`  📸 图${imgIndex} ✓`)
      } catch (e: any) {
        console.error(`  ❌ 图${imgIndex}失败: ${e.message}`)
      }
      imgIndex++
    }
  }

  // 话题标签格式化
  const formattedTags = tags
    .split(/[\s,，]+/)
    .filter(Boolean)
    .map((t: string) => t.startsWith('#') ? t : `#${t}`)
    .join(' ')

  // ── 生成笔记.md ──
  const noteContent = `## 元数据
- 笔记链接：${noteUrl}
- 作者：${author}
- 发布时间：${publishTime}
- 来源表格：${tableName}
- 采集时间：${new Date().toISOString().split('T')[0]}

## 互动数据
- 点赞：${likes}
- 收藏：${collects}
- 评论：${comments}
- 浏览：${views || '未知'}
- **总互动：${total}**
- **评论占比：${commentRatio}**${isHighComment ? ' ⭐⭐⭐⭐⭐（极高！引流效果好）' : ''}${remark ? `\n- 备注：${remark}` : ''}

## 图片

${imageEmbeds.join('')}

# ${title}

## 正文
${content}

## 话题标签
${formattedTags}
`

  fs.writeFileSync(path.join(folderPath, '笔记.md'), noteContent, 'utf-8')
  console.log(`  ✅ 收录成功（${imageEmbeds.length} 张图）`)

  // 更新飞书状态
  await markAsCollected(appToken, tableId, recordId)
  return true
}

// ─────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────

async function main() {
  console.log('🚀 批量收录笔记到 Obsidian 素材库')
  console.log(`📁 路径：${NOTES_DIR}\n`)

  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    console.error('❌ 缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET，请检查 .env.local')
    process.exit(1)
  }

  let totalCollected = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const table of TABLES) {
    console.log(`📋 读取表格：${table.name}`)

    let records: any[]
    try {
      records = await getPendingRecords(table.appToken, table.tableId)
      console.log(`  找到 ${records.length} 条待收录记录`)
    } catch (e: any) {
      console.error(`  ❌ 读取失败: ${e.message}`)
      continue
    }

    for (const record of records) {
      const title = record.fields?.['标题'] || record.record_id
      console.log(`\n  📝 ${title}`)
      try {
        const collected = await collectNote(record, table.name, table.appToken, table.tableId)
        collected ? totalCollected++ : totalSkipped++
      } catch (e: any) {
        console.error(`  ❌ 收录失败: ${e.message}`)
        totalFailed++
      }
    }

    console.log()
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ 新收录：${totalCollected} 篇`)
  console.log(`⏭️  已存在跳过：${totalSkipped} 篇`)
  console.log(`❌ 失败：${totalFailed} 篇`)
  console.log('\n完成！打开 Obsidian 查看新收录的笔记。')
}

main().catch(console.error)
