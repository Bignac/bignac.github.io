const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const logs = []
  page.on('console', (msg) => logs.push(`[console ${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))
  page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ''}`))
  page.on('response', (res) => { if (res.status() >= 400) logs.push(`[http ${res.status()}] ${res.url()}`) })
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)
    console.log('TITLE', await page.title())
    console.log('H2', (await page.locator('h1,h2').evaluateAll((els) => els.map((e) => e.textContent))) || '')
  } catch (e) {
    console.log('NAV_ERROR', e.message)
  }
  console.log('LOGS')
  console.log(logs.join('\n') || '(none)')
  await browser.close()
})()
