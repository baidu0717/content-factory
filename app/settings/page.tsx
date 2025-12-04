'use client'

import { useState } from 'react'
import {
  Settings,
  Key,
  Globe,
  Database,
  Bell,
  Shield,
  Save,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  TestTube,
  Loader2,
  Info,
  ExternalLink,
  HelpCircle,
  Copy,
  RefreshCw
} from 'lucide-react'

interface ConfigSection {
  id: string
  title: string
  icon: React.ElementType
  description: string
}

const configSections: ConfigSection[] = [
  {
    id: 'ai',
    title: 'AI配置',
    icon: Key,
    description: '配置AI模型接口和参数'
  },
  {
    id: 'platform',
    title: '平台接入',
    icon: Globe,
    description: '配置各发布平台的API'
  },
  {
    id: 'data',
    title: '数据源',
    icon: Database,
    description: '配置内容数据源接口'
  },
  {
    id: 'notification',
    title: '通知设置',
    icon: Bell,
    description: '配置系统通知方式'
  },
  {
    id: 'security',
    title: '安全设置',
    icon: Shield,
    description: '账号安全和权限管理'
  }
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('ai')
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({})
  const [isTesting, setIsTesting] = useState<{ [key: string]: boolean }>({})
  const [testResult, setTestResult] = useState<{ [key: string]: boolean | null }>({})
  const [formData, setFormData] = useState({
    // AI配置
    aiProvider: 'openai',
    aiApiKey: '',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-4',
    aiTemperature: '0.7',

    // 平台接入
    wechatApiKey: '',
    wechatApiSecret: '',
    xiaohongshuApiKey: '',
    xiaohongshuApiSecret: '',

    // 数据源
    articleApiUrl: '',
    articleApiKey: '',
    unsplashApiKey: '',

    // 通知设置
    enableEmailNotification: true,
    notificationEmail: '',
    enableWebhook: false,
    webhookUrl: '',

    // 安全设置
    enableTwoFactor: false,
    sessionTimeout: '30'
  })

  const handleInputChange = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleTest = async (key: string) => {
    setIsTesting(prev => ({ ...prev, [key]: true }))
    setTestResult(prev => ({ ...prev, [key]: null }))

    // 模拟API测试
    setTimeout(() => {
      setIsTesting(prev => ({ ...prev, [key]: false }))
      setTestResult(prev => ({ ...prev, [key]: Math.random() > 0.3 })) // 70%成功率
    }, 2000)
  }

  const handleSave = () => {
    // 模拟保存
    alert('设置已保存')
  }

  const togglePasswordVisibility = (key: string) => {
    setShowPassword(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const renderAIConfig = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">AI服务提供商</label>
        <select
          value={formData.aiProvider}
          onChange={(e) => handleInputChange('aiProvider', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="tongyi">通义千问</option>
          <option value="zhipu">智谱AI</option>
          <option value="custom">自定义</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Key
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword['aiApiKey'] ? 'text' : 'password'}
            value={formData.aiApiKey}
            onChange={(e) => handleInputChange('aiApiKey', e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('aiApiKey')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword['aiApiKey'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">请妥善保管您的API密钥</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">API Base URL</label>
        <input
          type="text"
          value={formData.aiBaseUrl}
          onChange={(e) => handleInputChange('aiBaseUrl', e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">如使用代理或私有部署，请修改此地址</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">模型选择</label>
        <select
          value={formData.aiModel}
          onChange={(e) => handleInputChange('aiModel', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="gpt-4">GPT-4</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="claude-3">Claude 3</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Temperature（创造性）
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={formData.aiTemperature}
            onChange={(e) => handleInputChange('aiTemperature', e.target.value)}
            className="flex-1"
          />
          <span className="text-sm font-medium text-gray-700 w-10">{formData.aiTemperature}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">值越高，生成内容越有创造性；值越低，内容越稳定</p>
      </div>

      <div className="pt-4">
        <button
          onClick={() => handleTest('ai')}
          disabled={isTesting['ai'] || !formData.aiApiKey}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isTesting['ai'] ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              测试中...
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4 mr-2" />
              测试连接
            </>
          )}
        </button>
        {testResult['ai'] !== null && (
          <div className={`mt-2 text-sm ${testResult['ai'] ? 'text-green-600' : 'text-red-600'}`}>
            {testResult['ai'] ? '✓ 连接成功' : '✗ 连接失败，请检查配置'}
          </div>
        )}
      </div>
    </div>
  )

  const renderPlatformConfig = () => (
    <div className="space-y-6">
      {/* 公众号配置 */}
      <div className="border-b border-gray-200 pb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">公众号配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showPassword['wechatApiKey'] ? 'text' : 'password'}
                value={formData.wechatApiKey}
                onChange={(e) => handleInputChange('wechatApiKey', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('wechatApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword['wechatApiKey'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Secret</label>
            <div className="relative">
              <input
                type={showPassword['wechatApiSecret'] ? 'text' : 'password'}
                value={formData.wechatApiSecret}
                onChange={(e) => handleInputChange('wechatApiSecret', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('wechatApiSecret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword['wechatApiSecret'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            onClick={() => handleTest('wechat')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
          >
            {isTesting['wechat'] ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                测试连接
              </>
            )}
          </button>
          {testResult['wechat'] !== null && (
            <div className={`text-sm ${testResult['wechat'] ? 'text-green-600' : 'text-red-600'}`}>
              {testResult['wechat'] ? '✓ 连接成功' : '✗ 连接失败，请检查配置'}
            </div>
          )}
        </div>
      </div>

      {/* 小红书配置 */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">小红书配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showPassword['xiaohongshuApiKey'] ? 'text' : 'password'}
                value={formData.xiaohongshuApiKey}
                onChange={(e) => handleInputChange('xiaohongshuApiKey', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('xiaohongshuApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword['xiaohongshuApiKey'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Secret</label>
            <div className="relative">
              <input
                type={showPassword['xiaohongshuApiSecret'] ? 'text' : 'password'}
                value={formData.xiaohongshuApiSecret}
                onChange={(e) => handleInputChange('xiaohongshuApiSecret', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('xiaohongshuApiSecret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword['xiaohongshuApiSecret'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            onClick={() => handleTest('xiaohongshu')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center"
          >
            {isTesting['xiaohongshu'] ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                测试连接
              </>
            )}
          </button>
          {testResult['xiaohongshu'] !== null && (
            <div className={`text-sm ${testResult['xiaohongshu'] ? 'text-green-600' : 'text-red-600'}`}>
              {testResult['xiaohongshu'] ? '✓ 连接成功' : '✗ 连接失败，请检查配置'}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderDataConfig = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">文章数据源</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API地址</label>
            <input
              type="text"
              value={formData.articleApiUrl}
              onChange={(e) => handleInputChange('articleApiUrl', e.target.value)}
              placeholder="https://api.example.com/articles"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showPassword['articleApiKey'] ? 'text' : 'password'}
                value={formData.articleApiKey}
                onChange={(e) => handleInputChange('articleApiKey', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('articleApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword['articleApiKey'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Unsplash图片API</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Access Key</label>
            <div className="relative">
              <input
                type={showPassword['unsplashApiKey'] ? 'text' : 'password'}
                value={formData.unsplashApiKey}
                onChange={(e) => handleInputChange('unsplashApiKey', e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('unsplashApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword['unsplashApiKey'] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              在 <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                Unsplash Developers
                <ExternalLink className="w-3 h-3 inline ml-1" />
              </a> 获取密钥
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationConfig = () => (
    <div className="space-y-6">
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.enableEmailNotification}
            onChange={(e) => handleInputChange('enableEmailNotification', e.target.checked)}
            className="mr-3 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">启用邮件通知</span>
        </label>
        {formData.enableEmailNotification && (
          <div className="mt-3 ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">通知邮箱</label>
            <input
              type="email"
              value={formData.notificationEmail}
              onChange={(e) => handleInputChange('notificationEmail', e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.enableWebhook}
            onChange={(e) => handleInputChange('enableWebhook', e.target.checked)}
            className="mr-3 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">启用Webhook</span>
        </label>
        {formData.enableWebhook && (
          <div className="mt-3 ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
            <input
              type="url"
              value={formData.webhookUrl}
              onChange={(e) => handleInputChange('webhookUrl', e.target.value)}
              placeholder="https://your-webhook-url.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">通知事件</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>分析任务完成</li>
              <li>文章生成成功</li>
              <li>发布成功/失败</li>
              <li>API调用异常</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSecurityConfig = () => (
    <div className="space-y-6">
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.enableTwoFactor}
            onChange={(e) => handleInputChange('enableTwoFactor', e.target.checked)}
            className="mr-3 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">启用两步验证</span>
        </label>
        <p className="mt-1 ml-6 text-xs text-gray-500">提高账号安全性，每次登录需要验证码</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">会话超时时间（分钟）</label>
        <select
          value={formData.sessionTimeout}
          onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="15">15分钟</option>
          <option value="30">30分钟</option>
          <option value="60">1小时</option>
          <option value="120">2小时</option>
          <option value="0">永不超时</option>
        </select>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mr-2 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">安全提示</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>定期更换API密钥</li>
              <li>不要在公共环境暴露敏感信息</li>
              <li>建议启用两步验证保护账号</li>
              <li>定期检查API调用日志</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'ai':
        return renderAIConfig()
      case 'platform':
        return renderPlatformConfig()
      case 'data':
        return renderDataConfig()
      case 'notification':
        return renderNotificationConfig()
      case 'security':
        return renderSecurityConfig()
      default:
        return null
    }
  }

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-gray-500 mt-1">配置系统参数和API接口</p>
      </div>

      <div className="flex gap-6">
        {/* 左侧导航 */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {configSections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-start px-4 py-3 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">{section.title}</p>
                    <p className={`text-xs mt-0.5 ${
                      activeSection === section.id ? 'text-blue-500' : 'text-gray-500'
                    }`}>
                      {section.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {configSections.find(s => s.id === activeSection)?.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {configSections.find(s => s.id === activeSection)?.description}
              </p>
            </div>

            {renderContent()}

            {/* 保存按钮 */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                上次更新：2024-01-15 14:30
              </div>
              <div className="flex items-center space-x-3">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  重置
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                >
                  <Save className="w-5 h-5 mr-2" />
                  保存设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}