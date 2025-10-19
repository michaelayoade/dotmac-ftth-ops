const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[Browser]', msg.text()));
  
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('domcontentloaded');
  
  // Check if function exists
  const hasFunction = await page.evaluate(() => {
    return typeof (window as any).__e2e_login !== 'undefined';
  });
  
  console.log('Has __e2e_login function:', hasFunction);
  
  if (hasFunction) {
    console.log('Calling login...');
    await page.evaluate(() => {
      (window as any).__e2e_login('admin', 'admin123');
    });
    
    await page.waitForTimeout(3000);
    console.log('Current URL:', page.url());
  }
  
  await browser.close();
})();
