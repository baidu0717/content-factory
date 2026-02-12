#!/usr/bin/env ts-node
/**
 * 自动修复飞书表格中图片缺失的记录
 * 使用方法：
 * 1. 干跑模式（只检测，不修复）：npm run fix-images -- --dry-run
 * 2. 执行修复：npm run fix-images
 */

const FEISHU_API_URL = 'https://content-factory-jade-nine.vercel.app/api'

// 表格配置
const TABLES = {
  '法意瑞': {
    appToken: 'NNd8bJYazaBwHAsZ2z2cqsvmnqf',
    tableId: 'tblu1m2GPcFRNSPE'
  },
  '其他国家': {
    appToken: 'McFGbxqi6aSd0HsBCSlc5kI7nwc',
    tableId: 'tbltp6uHpdKRF68a'
  }
}

async function fixMissingImages(tableName: keyof typeof TABLES, dryRun: boolean = true) {
  const config = TABLES[tableName]

  console.log(`\n🔧 正在${dryRun ? '检测' : '修复'} "${tableName}" 表格...`)
  console.log(`   APP_TOKEN: ${config.appToken}`)
  console.log(`   TABLE_ID: ${config.tableId}\n`)

  try {
    const response = await fetch(`${FEISHU_API_URL}/xiaohongshu/fix-missing-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appToken: config.appToken,
        tableId: config.tableId,
        dryRun
      })
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅', data.message)
      if (data.data?.records) {
        console.log('\n📋 需要修复的记录:')
        data.data.records.forEach((record: any, index: number) => {
          console.log(`\n  ${index + 1}. ${record.title}`)
          console.log(`     链接: ${record.url}`)
          const missing = []
          if (record.missing.cover) missing.push('封面')
          if (record.missing.image2) missing.push('图片2')
          if (record.missing.moreImages) missing.push('后续图片')
          console.log(`     缺失: ${missing.join(', ')}`)
        })
      }
      if (data.data?.details) {
        console.log('\n📊 修复结果:')
        data.data.details.forEach((detail: any, index: number) => {
          const status = detail.status === 'success' ? '✅' : '❌'
          console.log(`  ${status} ${detail.title}`)
          if (detail.imagesFixed) {
            console.log(`     修复了 ${detail.imagesFixed} 张图片`)
          }
          if (detail.error) {
            console.log(`     错误: ${detail.error}`)
          }
        })
      }
    } else {
      console.error('❌', data.message)
    }

    return data

  } catch (error) {
    console.error('❌ 请求失败:', error)
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('═══════════════════════════════════════════')
  console.log('   飞书表格图片修复工具')
  console.log('═══════════════════════════════════════════')
  console.log(`模式: ${dryRun ? '🔍 检测模式（不执行修复）' : '🔧 修复模式'}`)
  console.log('═══════════════════════════════════════════')

  // 修复两个表格
  await fixMissingImages('法意瑞', dryRun)
  await fixMissingImages('其他国家', dryRun)

  console.log('\n═══════════════════════════════════════════')
  console.log('   完成')
  console.log('═══════════════════════════════════════════')

  if (dryRun) {
    console.log('\n💡 提示: 使用 npm run fix-images 来执行实际修复')
  }
}

main().catch(console.error)
