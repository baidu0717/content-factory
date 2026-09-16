import { NextResponse, after } from 'next/server'

export const maxDuration = 60

/**
 * 最小隔离测试：验证 Vercel 上 after() 到底执行不执行。
 *
 * 2026-09-17 加。现象：快捷指令走异步模式，响应正常返回「正在后台保存」，
 * 但飞书表里永远没有记录、群里也收不到失败通知——无法区分是
 *   (a) after() 压根没跑
 *   (b) after() 跑了但里面的活全失败了
 * 这个端点把两者分开：同一次请求里各发一条通知，一条同步发、一条在 after() 里发。
 *
 *   两条都收到 → after() 正常，问题在业务逻辑里
 *   只收到「同步」→ after() 在 Vercel 上不执行，异步模式整个方案要换
 *   两条都没收到 → Vercel 到飞书 webhook 的网络不通
 *
 * 诊断用，验证完可以删。
 */
async function notify(text: string) {
  const hook = process.env.FEISHU_WEBHOOK_URL
  if (!hook) return 'NO_WEBHOOK_URL'
  try {
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } })
    })
    const j = await r.json().catch(() => ({}))
    return `HTTP ${r.status} code=${(j as any)?.code}`
  } catch (e: any) {
    return `ERR ${e?.message}`
  }
}

// 本地 .env.local 里有的、线上必须也有的环境变量。
// 只报「有没有设」，不报值——避免泄露密钥。
const REQUIRED_ENVS = [
  'APIZERO_API_KEY',
  'JUSTONE_API_TOKEN',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_APP_TOKEN',
  'FEISHU_WEBHOOK_URL',
  'FEISHU_DEFAULT_APP_TOKEN',
  'FEISHU_DEFAULT_TABLE_ID',
  'NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY',
  'NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE',
]

export async function GET() {
  const stamp = new Date().toISOString().substring(11, 19)

  // 环境变量体检：本地有、线上没有，是今天连踩两次的坑
  //   APIZERO_API_KEY    改了 Development 没改 Production → 4011
  //   FEISHU_WEBHOOK_URL 线上压根没配 → 通知静默失效
  // 只看名字和前缀，不打印值。
  const envs: Record<string, string> = {}
  for (const k of REQUIRED_ENVS) {
    const v = process.env[k]
    envs[k] = !v ? '❌ 未设置'
      : `✅ 已设置(${v.length}字符${v.startsWith('sk_') ? ' · ' + v.substring(0, 8) : ''})`
  }

  // ① 同步发一条：确认 Vercel → 飞书 webhook 的链路本身是通的
  const syncResult = await notify(`🧪 [${stamp}] 第①条 · 同步发送（在 after 之前）`)

  // ② after() 里发一条：确认后台任务到底跑不跑
  after(async () => {
    await notify(`🧪 [${stamp}] 第②条 · after() 内发送 —— 收到这条说明 after 正常执行`)
  })

  return NextResponse.json({
    ok: true,
    stamp,
    envs,
    syncResult,
    hint: '看飞书群：收到①②两条=after正常；只收到①=after不执行；一条都没有=webhook不通'
  })
}
