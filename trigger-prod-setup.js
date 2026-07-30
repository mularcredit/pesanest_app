
const https = require('https');

function triggerSetup() {
  const options = {
    hostname: 'pesastack-finance.fly.dev',
    port: 443,
    path: '/api/mobile/setup',
    method: 'GET'
  };

  console.log(`Triggering setup at: https://${options.hostname}${options.path}`);

  const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => console.log('RESPONSE:', body));
  });

  req.on('error', (e) => console.error('Error:', e.message));
  req.end();
}

triggerSetup();
