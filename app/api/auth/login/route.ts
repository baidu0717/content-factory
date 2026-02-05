import { NextRequest, NextResponse } from 'next/server'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/feishu/callback`

/**
 * GET /api/auth/login
 * 引导用户跳转到飞书授权页面
 */
export async function GET(request: NextRequest) {
  console.log('[飞书登录] 开始OAuth授权流程')
  console.log('[飞书登录] 回调地址:', REDIRECT_URI)

  // 飞书授权页面URL
  const authUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/authorize')

  // 需要申请的权限范围
  const scopes = [
    'bitable:app',           // 查看、评论、编辑和管理多维表格
    'base:record:create',    // 新增记录
    'drive:drive:readonly',  // 查看和下载云文档中的文件
    'drive:drive',           // 上传文件或图片
  ]

  authUrl.searchParams.append('app_id', FEISHU_APP_ID)
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.append('scope', scopes.join(' '))  // 添加权限范围
  authUrl.searchParams.append('state', 'STATE') // 可以用随机字符串防止CSRF攻击

  console.log('[飞书登录] 申请权限:', scopes.join(' '))
  console.log('[飞书登录] 跳转到:', authUrl.toString())

  // 重定向到飞书授权页面
  return NextResponse.redirect(authUrl.toString())
}
