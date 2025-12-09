'use client'

import { useEffect, useState } from 'react'

export default function FeishuAuthPage() {
  const [appId, setAppId] = useState<string>('')
  const [redirectUri, setRedirectUri] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 从环境变量读取配置
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/auth/feishu/config')
        const data = await response.json()
        setAppId(data.appId)
        setRedirectUri(data.redirectUri)
        setLoading(false)
      } catch (error) {
        console.error('获取配置失败:', error)
        setLoading(false)
      }
    }

    fetchConfig()
  }, [])

  const handleAuth = () => {
    if (!appId || !redirectUri) {
      alert('配置未加载完成，请稍后重试')
      return
    }

    // 构建飞书 OAuth 授权 URL
    // 注意: redirect_uri 会被 URLSearchParams 自动编码
    const authUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/authorize')
    authUrl.searchParams.set('app_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', 'STATE')

    // 跳转到飞书授权页面
    window.location.href = authUrl.toString()
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🔐</div>
        <h1 style={styles.title}>授权飞书账号</h1>
        <p style={styles.description}>
          为了能够将小红书笔记保存到你的飞书多维表格，需要授权访问你的飞书账号。
        </p>

        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✅</span>
            <span>只需授权一次，永久有效</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✅</span>
            <span>仅访问多维表格数据</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✅</span>
            <span>随时可以取消授权</span>
          </div>
        </div>

        <div style={styles.info}>
          <strong>📋 授权后需要做什么？</strong>
          <ol style={styles.steps}>
            <li>授权成功后会显示一个 token</li>
            <li>复制这个 token</li>
            <li>在 Vercel 项目设置中添加环境变量</li>
            <li>完成配置后即可使用快捷指令</li>
          </ol>
        </div>

        <button
          onClick={handleAuth}
          style={styles.button}
          onMouseOver={(e) => (e.currentTarget.style.background = '#096dd9')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#1890ff')}
        >
          前往飞书授权
        </button>

        <p style={styles.footer}>
          点击按钮后将跳转到飞书官方授权页面
        </p>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  icon: {
    fontSize: '64px',
    textAlign: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: '16px',
  },
  description: {
    fontSize: '16px',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '32px',
    lineHeight: '1.6',
  },
  features: {
    marginBottom: '32px',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '15px',
    color: '#374151',
  },
  featureIcon: {
    marginRight: '12px',
    fontSize: '20px',
  },
  info: {
    background: '#f3f4f6',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '32px',
    fontSize: '14px',
    color: '#374151',
  },
  steps: {
    marginTop: '12px',
    marginLeft: '20px',
    lineHeight: '1.8',
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    background: '#1890ff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.3s',
  },
  footer: {
    marginTop: '20px',
    fontSize: '14px',
    color: '#9ca3af',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    fontSize: '18px',
    color: '#6b7280',
    padding: '40px',
  },
}
