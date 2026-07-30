
const https = require('https');

function testLogin(hostname) {
  const data = JSON.stringify({
    email: 'admin@pesastack.com',
    password: 'Admin@123'
  });

  const options = {
    hostname: hostname,
    port: 443,
    path: '/api/auth/mobile-login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log(`Testing login at: https://${options.hostname}${options.path}`);

  const req = https.request(options, (res) => {
    console.log(`[${hostname}] STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => console.log(`[${hostname}] BODY:`, body));
  });

  req.on('error', (e) => console.error(`[${hostname}] Error:`, e.message));
  req.write(data);
  req.end();
}

testLogin('pesastack-finance.fly.dev');
testLogin('prudenceapp.fly.dev');
testLogin('capitalpaybooks.pro');
