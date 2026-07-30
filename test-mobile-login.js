
const https = require('https');

function testLogin() {
  const data = JSON.stringify({
    email: 'admin@pesastack.com',
    password: 'Admin@123'
  });

  const options = {
    hostname: 'pesastack-finance.fly.dev',
    port: 443,
    path: '/api/auth/mobile-login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log(`Testing login at: https://${options.hostname}${options.path}`);
  console.log(`Payload: ${data}`);

  const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let body = '';
    res.on('data', (d) => {
      body += d;
    });

    res.on('end', () => {
      console.log('BODY:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e.message);
  });

  req.write(data);
  req.end();
}

testLogin();
