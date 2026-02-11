const https = require('https');

const data = JSON.stringify({
  type: 11,
  note_id: '6983edb6000000001a02ae46',
  key: 'JZL1b7f46d7a6b92240'
});

const options = {
  hostname: 'www.dajiala.com',
  port: 443,
  path: '/fbmain/monitor/v3/xhs',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const json = JSON.parse(body);
    const img = json.note_list[0].images_list[0];
    console.log('第1张图片的所有URL字段:');
    console.log(JSON.stringify(img, null, 2));
  });
});

req.on('error', (e) => console.error('请求失败:', e.message));
req.write(data);
req.end();
