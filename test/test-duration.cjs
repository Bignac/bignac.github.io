const { chromium } = require('playwright-core')
const path = require('path')
;(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })
  await page.setInputFiles('input[type=file]', path.join(__dirname, 'fixtures/sample-person.webm'))
  await page.waitForSelector('.asset-tile')
  await page.waitForTimeout(1000)
  console.log(await page.evaluate(() => {
    const v = document.querySelector('.hidden-video')
    return {
      duration: v?.duration,
      readyState: v?.readyState,
      seekable: v?.seekable.length ? [v.seekable.start(0), v.seekable.end(0)] : [],
      buffered: v?.buffered.length ? [v.buffered.start(0), v.buffered.end(0)] : [],
      currentTime: v?.currentTime,
    }
  }))
  console.log(await page.evaluate(async () => {
    const v = document.querySelector('.hidden-video')
    const original = v.currentTime
    v.currentTime = 1e101
    await new Promise((r) => setTimeout(r, 800))
    const result = { duration: v.duration, seekable: v.seekable.length ? v.seekable.end(0) : null, currentTime: v.currentTime }
    v.currentTime = original
    return result
  }))
  await browser.close()
})()
