const https = require('https');

async function checkUserInfo() {
  console.log('检查当前token的用户信息...\n');

  // 获取 app_access_token
  const tokenResponse = await new Promise((resolve, reject) => {
    const data = JSON.stringify({
      app_id: 'cli_a9bac6be07789cc4',
      app_secret: 'kqcP7odJy9x0AhtNMR5FYg4KPXs5lwRJ'
    });

    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/app_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  const appAccessToken = tokenResponse.app_access_token;

  // 使用 refresh_token 获取 user_access_token
  const userTokenResponse = await new Promise((resolve, reject) => {
    const data = JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: 'ur-4vj18VlmVdbGLEY_n0v_jF151AUB01ghgaEaJAy00EwG'
    });

    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/oidc/refresh_access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`,
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  if (userTokenResponse.code !== 0) {
    console.log('❌ 获取user token失败:', userTokenResponse);
    return;
  }

  const userAccessToken = userTokenResponse.data.access_token;

  // 获取用户信息
  const userInfoResponse = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/authen/v1/user_info',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userAccessToken}`
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });

  console.log('=== 用户信息 ===');
  if (userInfoResponse.code === 0) {
    console.log('用户名:', userInfoResponse.data.name);
    console.log('邮箱:', userInfoResponse.data.email);
    console.log('用户ID:', userInfoResponse.data.user_id);
    console.log('Open ID:', userInfoResponse.data.open_id);
  } else {
    console.log('获取用户信息失败:', userInfoResponse);
  }
}

checkUserInfo().catch(console.error);
