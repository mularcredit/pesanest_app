const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('PAGE_ERROR:', error.message));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  const content = await page.content();
  console.log('CONTENT_LENGTH:', content.length);
  await browser.close();
})();
