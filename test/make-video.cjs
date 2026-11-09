const { chromium } = require('playwright-core')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })
  const imageB64 = fs.readFileSync('fixtures/sample-person.jpg').toString('base64')

  const result = await page.evaluate(async (imageB64) => {
    const img = new Image()
    img.src = `data:image/jpeg;base64,${imageB64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 405
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(30)

    const ac = new AudioContext()
    await ac.resume()
    const dest = ac.createMediaStreamDestination()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    gain.gain.value = 0.08
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, ac.currentTime)
    osc.frequency.linearRampToValueAtTime(440, ac.currentTime + 3)
    osc.connect(gain).connect(dest)
    osc.start()

    const combined = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()])
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm'
    const rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const done = new Promise((resolve) => (rec.onstop = resolve))

    let raf
    const draw = (now) => {
      const t = Math.min(1, (now - start) / 4000)
      ctx.fillStyle = '#94b7d1'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const scale = 0.96 + t * 0.06
      const w = img.width * 0.55 * scale
      const h = img.height * 0.55 * scale
      const x = canvas.width / 2 - w / 2 + Math.sin(t * Math.PI * 2) * 18
      const y = canvas.height / 2 - h / 2
      ctx.drawImage(img, x, y, w, h)
      if (t < 1) raf = requestAnimationFrame(draw)
    }
    const start = performance.now()
    rec.start(250)
    raf = requestAnimationFrame(draw)
    setTimeout(() => {
      cancelAnimationFrame(raf)
      osc.stop()
      rec.stop()
    }, 4000)
    await done
    const blob = new Blob(chunks, { type: mime })
    const buf = await blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    await ac.close()
    return { b64: btoa(binary), type: mime, size: blob.size }
  }, imageB64)

  fs.writeFileSync('fixtures/sample-person.webm', Buffer.from(result.b64, 'base64'))
  console.log('VIDEO', result.type, result.size)
  await browser.close()
})()
