const http = require('http');

const data = new URLSearchParams({
  email: 'admin@pesastack.com',
  password: 'Admin@123',
  csrfToken: '' // We might need a real CSRF token, but let's see.
}).toString();

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/auth/callback/credentials',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
