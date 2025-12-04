const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { setGlobalDispatcher, ProxyAgent } = require('undici');

// 手动加载 .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...values] = line.split('=');
      if (key && values.length) {
        env[key.trim()] = values.join('=').trim();
      }
    }
  });

  return env;
}

async function testGeminiPreview() {
  console.log('=== 测试 Gemini 3 Pro Preview ===\n');

  const env = loadEnv();
  const apiKey = env.GEMINI_TEXT_API_KEY;
  const model = env.GEMINI_TEXT_MODEL;
  const proxyUrl = env.HTTPS_PROXY || env.HTTP_PROXY || 'http://127.0.0.1:7897';

  console.log('API Key:', apiKey?.slice(0, 20) + '...');
  console.log('Model:', model);
  console.log('Proxy:', proxyUrl);
  console.log('');

  try {
    // 配置 Undici 全局代理（用于 Gemini SDK）
    const proxyAgent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(proxyAgent);
    console.log('[代理配置] 全局代理已设置\n');

    // 初始化 Gemini 客户端
    const geminiClient = new GoogleGenAI({
      apiKey: apiKey
    });

    console.log('正在调用 Gemini API...\n');

    // 调用 API
    const response = await geminiClient.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [{ text: '请用一句话介绍自己' }]
        }
      ],
      config: {
        temperature: 1.0,
        maxOutputTokens: 8192,
      }
    });

    const text = response.text || '';

    console.log('✅ 测试成功！');
    console.log('响应:', text);
    console.log('\n模型权限正常，可以使用 gemini-3-pro-preview');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.status) {
      console.error('状态码:', error.status);
    }
    if (error.response) {
      console.error('响应详情:', JSON.stringify(error.response, null, 2));
    }
    console.error('\n完整错误:', error);
  }
}

testGeminiPreview();
