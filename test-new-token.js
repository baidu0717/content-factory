const https = require('https');

const FEISHU_APP_ID = 'cli_a9bac6be07789cc4';
const FEISHU_APP_SECRET = 'kqcP7odJy9x0AhtNMR5FYg4KPXs5lwRJ';
const REFRESH_TOKEN = 'ur-54gCqSqQVbFbKk92pm8bZM153sjB01WPPgyaUN8029WJ';

async function testToken() {
  console.log('='.repeat(60));
  console.log('测试飞书 Refresh Token');
  console.log('='.repeat(60));
  console.log('Token:', REFRESH_TOKEN.substring(0, 20) + '...');

  // 第一步：获取 app_access_token
  console.log('\n[步骤1] 获取 app_access_token...');

  const appTokenResponse = await new Promise((resolve, reject) => {
    const data = JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/app_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });

  if (appTokenResponse.code !== 0) {
    console.error('❌ 获取 app_access_token 失败:', appTokenResponse);
    return;
  }

  console.log('✅ app_access_token 获取成功');
  const appAccessToken = appTokenResponse.app_access_token;

  // 第二步：刷新 user_access_token
  console.log('\n[步骤2] 刷新 user_access_token...');

  const userTokenResponse = await new Promise((resolve, reject) => {
    const data = JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN
    });

    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/authen/v1/oidc/refresh_access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });

  console.log('\n响应:', JSON.stringify(userTokenResponse, null, 2));

  if (userTokenResponse.code !== 0) {
    console.error('\n❌ Token 无效或已过期');
    console.error('错误代码:', userTokenResponse.code);
    console.error('错误信息:', userTokenResponse.message);
    console.log('\n解决方法: 访问 http://localhost:3000/feishu-oauth 重新授权');
  } else {
    console.log('\n✅ Token 有效！');
    console.log('access_token:', userTokenResponse.data.access_token.substring(0, 20) + '...');
    console.log('有效期:', userTokenResponse.data.expires_in, '秒');

    if (userTokenResponse.data.refresh_token) {
      console.log('\n⚠️  获得新的 refresh_token:');
      console.log(userTokenResponse.data.refresh_token);
      console.log('\n请将新 token 更新到 .env.local:');
      console.log(`FEISHU_REFRESH_TOKEN=${userTokenResponse.data.refresh_token}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

testToken().catch(console.error);
