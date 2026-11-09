const { chromium } = require('playwright-core')
const path = require('path')

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const logs = []
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })

  await page.setInputFiles('input[type=file]', path.join(__dirname, 'fixtures/sample-person.jpg'))
  await page.waitForSelector('.asset-tile', { timeout: 20000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'shot-image-loaded.png' })

  console.log('quick cutout count', await page.locator('.canvas-quick-cutout').count())
  await page.locator('.canvas-quick-cutout').click()

  try {
    await page.waitForSelector('.canvas-status.is-cutout', { timeout: 240000 })
    console.log('CUTOUT OK')
  } catch (e) {
    console.log('CUTOUT TIMEOUT')
    console.log(await page.locator('.canvas-processing-card').allTextContents())
  }
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'shot-image-cutout.png' })
  console.log(await page.locator('.canvas-status').allTextContents())
  console.log(await page.locator('.toast').allTextContents())
  console.log('LOGS', logs.slice(-30).join('\n'))
  await browser.close()
})()
