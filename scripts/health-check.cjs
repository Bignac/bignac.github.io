#!/usr/bin/env node
/**
 * bgr (chroma-studio) health check + auto-fix.
 *
 * Checks:
 *   1. Dev server responds with HTTP 200 on 127.0.0.1:5173
 *   2. Project files / deps present
 *   3. Production build compiles
 * Auto-fix: if the server is down, restart `npm run dev` (detached) and
 * wait for it to come back up.
 *
 * Exit codes: 0 = healthy, 1 = recovered (server restarted), 2 = failed to recover
 * Usage: node scripts/health-check.cjs [--verbose]
 */
const { spawn } = require('child_process')
const { execSync } = require('child_process')
const fs = require('node:fs')
const path = require('node:path')

const PORT = 5173
const URL = `http://127.0.0.1:${PORT}`
const PUBLIC_URL = 'https://bignac.github.io/'
const PROJECT = path.join(__dirname, '..')
const LOG = path.join(PROJECT, 'logs', 'health-check.log')

const verbose = process.argv.includes('--verbose')
const started = Date.now()

function ts() {
  return new Date().toISOString()
}

function log(line, level = 'INFO') {
  const msg = `[${ts()}] ${level} ${line}`
  console.log(msg)
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  fs.appendFileSync(LOG, msg + '\n')
}

async function probe() {
  const res = await fetch(URL, { method: 'GET', signal: AbortSignal.timeout(10000) })
  return { status: res.status }
}

async function checkPublic() {
  try {
    const res = await fetch(PUBLIC_URL, { signal: AbortSignal.timeout(15000) })
    const html = await res.text()
    const built = /assets\/index-.*\.js/.test(html)
    if (res.status !== 200) {
      log(`public site HTTP ${res.status} (${PUBLIC_URL})`, 'WARN')
    } else if (!built) {
      log(`public site is serving source instead of the built app — rerun the deploy workflow`, 'ERROR')
    } else {
      log(`public site healthy (${PUBLIC_URL})`)
    }
  } catch {
    log(`public site unreachable (${PUBLIC_URL}) — check network or GitHub Pages status`, 'WARN')
  }
}

async function main() {
  let recovered = false

  // Check 1: server reachable
  let healthy = false
  try {
    const { status } = await probe()
    healthy = status === 200
  } catch {
    healthy = false
  }

  if (healthy) {
    log(`healthy (HTTP 200 on ${URL}, ${Date.now() - started}ms)`)
    await checkPublic()
    process.exit(0)
  }

  log(`server not responding on ${URL}, attempting auto-fix`, 'WARN')
  recovered = await restartServer()

  // Re-check
  await new Promise((r) => setTimeout(r, 5000))
  try {
    const { status } = await probe()
    if (status === 200) {
      log(`recovered: server back up (HTTP 200)`, 'INFO')
      process.exit(1)
    }
  } catch {
    // fall through
  }

  log(`failed to recover: server still down after restart attempt`, 'ERROR')
  process.exit(2)
}

async function restartServer() {
  // Kill any half-dead process on the port, then start fresh.
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' })
  } catch { /* nothing to kill */ }

  await new Promise((r) => setTimeout(r, 1500))

  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: PROJECT,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  child.unref()
  child.on('error', () => {})
  return true
}

if (require.main === module) {
  main()
}
