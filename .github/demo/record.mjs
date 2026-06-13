// Playwright recorder for the wrap-balancer demo GIF.
//
// Renders one seamless cosine "breathing" resize cycle frame-by-frame
// (deterministic — each frame sets the container width and re-balances
// synchronously) and writes PNG frames. ffmpeg then assembles them into a
// looping GIF (see build.sh).
//
// Usage:
//   BASE_URL=http://localhost:8773/.github/demo/index.html \
//   OUT_DIR=/tmp/wb-frames FRAMES=48 \
//   NODE_PATH=/tmp/wb-rec/node_modules node .github/demo/record.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:8773/.github/demo/index.html'
const OUT = process.env.OUT_DIR || '/tmp/wb-frames'
const N = Number(process.env.FRAMES || 48)

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1040, height: 500 },
  deviceScaleFactor: 2,
})
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.__renderFrame === 'function')
// let web fonts settle so text metrics are final
await page.evaluate(() => (document.fonts ? document.fonts.ready : null))
await page.waitForTimeout(300)

const stage = page.locator('.stage')
for (let i = 0; i < N; i++) {
  await page.evaluate(([idx, n]) => window.__renderFrame(idx, n), [i, N])
  await page.waitForTimeout(45) // flush layout + synchronous re-balance
  const num = String(i).padStart(3, '0')
  await stage.screenshot({ path: `${OUT}/frame_${num}.png` })
}

await browser.close()
console.log(`captured ${N} frames to ${OUT}`)
