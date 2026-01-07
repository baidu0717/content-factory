import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    appId: process.env.FEISHU_APP_ID || '',
  })
}
