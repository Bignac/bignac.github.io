const { chromium } = require('playwright-core')

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const logs = []
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/Users/ignacio/chroma-studio/shot-initial.png', fullPage: true })
  console.log('TITLE', await page.title())
  console.log('LOGS', logs.join('\n'))
  console.log('SIZE', await page.evaluate(() => ({
    body: [document.body.scrollWidth, document.body.scrollHeight],
    root: [document.getElementById('root').scrollWidth, document.getElementById('root').scrollHeight],
  })))
  await browser.close()
})()
