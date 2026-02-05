import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/feishu/update-vercel-token
 * 自动更新Vercel环境变量中的refresh_token
 *
 * 需要在Vercel中配置:
 * - VERCEL_TOKEN: Vercel API Token (https://vercel.com/account/tokens)
 * - VERCEL_PROJECT_ID: 项目ID
 * - VERCEL_TEAM_ID: 团队ID (如果项目在团队下)
 */
export async function POST(request: NextRequest) {
  try {
    const { newRefreshToken } = await request.json()

    if (!newRefreshToken) {
      return NextResponse.json({
        success: false,
        error: '缺少 newRefreshToken 参数'
      }, { status: 400 })
    }

    const vercelToken = process.env.VERCEL_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID
    const teamId = process.env.VERCEL_TEAM_ID

    if (!vercelToken || !projectId) {
      return NextResponse.json({
        success: false,
        error: '未配置 VERCEL_TOKEN 或 VERCEL_PROJECT_ID'
      }, { status: 500 })
    }

    console.log('[Vercel更新] 开始更新环境变量...')

    // 构建API URL
    let apiUrl = `https://api.vercel.com/v10/projects/${projectId}/env`
    if (teamId) {
      apiUrl += `?teamId=${teamId}`
    }

    // 先获取现有的FEISHU_REFRESH_TOKEN环境变量ID
    const listResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!listResponse.ok) {
      throw new Error(`获取环境变量列表失败: ${listResponse.status}`)
    }

    const envList = await listResponse.json()
    const existingEnv = envList.envs?.find((env: any) => env.key === 'FEISHU_REFRESH_TOKEN')

    if (existingEnv) {
      // 删除旧的环境变量
      console.log('[Vercel更新] 删除旧的环境变量...')
      const deleteUrl = `https://api.vercel.com/v9/projects/${projectId}/env/${existingEnv.id}${teamId ? `?teamId=${teamId}` : ''}`

      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${vercelToken}`
        }
      })

      if (!deleteResponse.ok) {
        console.error('[Vercel更新] 删除失败:', deleteResponse.status)
      }
    }

    // 创建新的环境变量
    console.log('[Vercel更新] 创建新的环境变量...')
    const createResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'FEISHU_REFRESH_TOKEN',
        value: newRefreshToken,
        type: 'encrypted',
        target: ['production', 'preview', 'development']
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`创建环境变量失败: ${createResponse.status} ${errorText}`)
    }

    console.log('[Vercel更新] ✅ 环境变量更新成功')

    // 自动触发重新部署
    try {
      console.log('[Vercel更新] 触发自动部署...')
      const deployUrl = `https://api.vercel.com/v13/deployments${teamId ? `?teamId=${teamId}` : ''}`

      // 构建部署请求体
      const deployBody: any = {
        name: projectId,
        project: projectId,
        target: 'production'
      }

      // 如果有配置 GitHub Repo ID，使用 Git 部署；否则使用强制重新部署
      if (process.env.VERCEL_GIT_REPO_ID) {
        deployBody.gitSource = {
          type: 'github',
          repoId: process.env.VERCEL_GIT_REPO_ID,
          ref: 'main'
        }
        console.log('[Vercel更新] 使用 Git 源部署')
      } else {
        deployBody.forceNew = 1
        console.log('[Vercel更新] 使用强制重新部署（未配置 VERCEL_GIT_REPO_ID）')
      }

      const deployResponse = await fetch(deployUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deployBody)
      })

      if (deployResponse.ok) {
        const deployData = await deployResponse.json()
        console.log('[Vercel更新] ✅ 自动部署已触发:', deployData.url || deployData.id)
        return NextResponse.json({
          success: true,
          message: 'Vercel环境变量已更新，并已自动触发重新部署',
          deploymentUrl: deployData.url,
          deploymentId: deployData.id
        })
      } else {
        const errorText = await deployResponse.text()
        console.error('[Vercel更新] ⚠️ 自动部署失败:', deployResponse.status, errorText)
        return NextResponse.json({
          success: true,
          message: 'Vercel环境变量已更新，但自动部署失败，请手动重新部署',
          warning: '自动部署失败',
          error: errorText
        })
      }
    } catch (deployError) {
      console.error('[Vercel更新] ⚠️ 自动部署异常:', deployError)
      return NextResponse.json({
        success: true,
        message: 'Vercel环境变量已更新，但自动部署失败，请手动重新部署',
        warning: '自动部署失败'
      })
    }

  } catch (error) {
    console.error('[Vercel更新] 错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
