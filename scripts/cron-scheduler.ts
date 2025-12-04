/**
 * 独立的 Cron 调度脚本
 * 使用 node-cron 实现定时任务
 *
 * 运行方式：
 * 1. 开发环境：ts-node scripts/cron-scheduler.ts
 * 2. 生产环境：使用 pm2 管理进程
 *    pm2 start scripts/cron-scheduler.ts --name "content-factory-cron"
 */

import cron from 'node-cron'
import { getDb } from '../lib/db'
import { runDailyAnalysis } from '../lib/scheduler'

// 从数据库获取定时配置
function getCronSchedule(): string {
  try {
    const db = getDb()
    const setting = db
      .prepare('SELECT value FROM system_settings WHERE key = ?')
      .get('cron_time') as { value: string } | undefined

    return setting?.value || '0 8 * * *' // 默认每天早上8点
  } catch (error) {
    console.error('[Cron] 获取定时配置失败，使用默认值:', error)
    return '0 8 * * *'
  }
}

// 任务执行函数
async function executeTask() {
  console.log('\n' + '='.repeat(80))
  console.log('[Cron] 定时任务触发')
  console.log('[Cron] 时间:', new Date().toLocaleString('zh-CN'))
  console.log('='.repeat(80) + '\n')

  try {
    const result = await runDailyAnalysis()

    if (result.success) {
      const successCount = result.results.filter((r) => r.success).length
      const totalCount = result.results.length

      console.log('\n' + '='.repeat(80))
      console.log(`[Cron] ✅ 任务执行完成: 成功 ${successCount}/${totalCount}`)
      console.log('='.repeat(80) + '\n')
    } else {
      console.log('\n' + '='.repeat(80))
      console.log('[Cron] ❌ 任务执行失败')
      console.log('='.repeat(80) + '\n')
    }
  } catch (error) {
    console.error('[Cron] 执行出错:', error)
  }
}

// 初始化定时任务
function initCronJob() {
  const cronSchedule = getCronSchedule()

  console.log('\n' + '='.repeat(80))
  console.log('🚀 内容工厂 - 定时调度器')
  console.log('='.repeat(80))
  console.log('[Cron] 调度表达式:', cronSchedule)
  console.log('[Cron] 当前时间:', new Date().toLocaleString('zh-CN'))
  console.log('='.repeat(80) + '\n')

  // 验证 cron 表达式
  if (!cron.validate(cronSchedule)) {
    console.error('[Cron] ❌ 无效的 cron 表达式:', cronSchedule)
    process.exit(1)
  }

  // 创建定时任务
  const task = cron.schedule(
    cronSchedule,
    async () => {
      await executeTask()
    },
    {
      timezone: 'Asia/Shanghai', // 设置时区为中国时区
    }
  )

  console.log('[Cron] ✅ 定时任务已启动')
  console.log('[Cron] 等待下次执行...\n')

  // 可选：立即执行一次（用于测试）
  if (process.env.RUN_IMMEDIATELY === 'true') {
    console.log('[Cron] 立即执行一次任务（测试模式）\n')
    executeTask()
  }

  return task
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[Cron] 收到退出信号，正在关闭...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n[Cron] 收到终止信号，正在关闭...')
  process.exit(0)
})

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('[Cron] 未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Cron] 未处理的 Promise 拒绝:', reason)
})

// 启动调度器
initCronJob()
