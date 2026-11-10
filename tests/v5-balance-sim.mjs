// v5 stage B balance sim: all-bot matches stepped without rendering; prints structure / boss timeline. TUNE=json overrides config (e.g. {"CORE.hp":7000}).
// Run: node tests/v5-balance-sim.mjs outDir [runs]
// v5 stage B check: gold + auto gear, epic bosses, tough nexus, all-bot balance sim. Offline, phone landscape.
// Run: node tests/v5-stage-b.mjs [outDir] [sims]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v5';
const SIMS = Number(process.argv[3] ?? 1);
const PICK = 0;
mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR to a node_modules containing it');
const { chromium, devices } = pw;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch(process.env.DEFAULT_GL ? {} : { args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
await ctx.addInitScript(() => { try { localStorage.setItem("starlane.unlockAll", "true"); } catch {} }); // v8: every champion open for tests
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon/.test(m.text())) errors.push(`console ${m.type()}: ${m.text().slice(0, 400)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn'); await tap('mode-ranked'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
await page.locator('[data-testid="champion-card-lumen"]').click({ force: true }); await page.locator('[data-testid="ban-btn"]').click({ force: true }); // v6 draft: ban first (lumen), then pick
await new Promise((r) => setTimeout(r, 300));
await sleep(400);
await page.locator('[data-testid^="champion-card-"]').nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(1500);



const S = (fn, arg) => page.evaluate(fn, arg);
const TUNE = JSON.parse(process.env.TUNE ?? '{}');
for (let n = 0; n < Number(process.argv[3] ?? 2); n++) {
  const r = await S(async (tune) => {
    const cfg = await import('/js/config.js');
    for (const [k, v] of Object.entries(tune)) { const [o, ...p] = k.split('.'); let t = cfg[o]; while (p.length > 1) t = t[p.shift()]; t[p[0]] = v; }
    const { Bot } = await import('/js/game/bot.js');
    const { bus } = await import('/js/core/bus.js');
    const m = window.__starlane.match;
    m.setHero(m.heroId);
    m.hero.brain = new Bot(m.hero); m.hero.isPlayer = false;
    const dt = 1 / 30; m._intent = () => m.hero.brain.think(dt, m);
    const ev = [];
    bus.on('down', (t) => { if (t.type === 'tower' || t.type === 'core') ev.push(`${t.type[0]}${t.team}${t.idx ?? ''}@${Math.round(m.time)}`); });
    bus.on('bossTaken', (e) => ev.push(`${e.kind}:${e.team}@${Math.round(m.time)}`));
    let steps = 0;
    while (!m.over && steps++ < 30 * 1100) m.update(dt);
    return { time: Math.round(m.time), reason: m.rawReason, kills: m.kills, destroyed: m.destroyed, ev: ev.join(' ') };
  }, TUNE);
  console.log('SIM', JSON.stringify(r));
}
await browser.close(); server.close();
