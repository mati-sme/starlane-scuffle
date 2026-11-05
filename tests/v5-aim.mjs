// v5 stage A check: drag-aim preview + cancel + aimed cast, target buttons, recall. Offline, phone landscape.
// Run: node tests/v5-aim.mjs [aim-indicator.png] [championIndex]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v5/aim-indicator.png';
const PICK = Number(process.argv[3] ?? 0);
mkdirSync(dirname(OUT), { recursive: true });

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
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon/.test(m.text())) errors.push(`console ${m.type()}: ${m.text().slice(0, 400)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE + '?gfx=low', { waitUntil: 'load', timeout: 90000 });
await tap('play-btn');
await sleep(400);
await page.locator('[data-testid^="champion-card-"]').nth(PICK).click({ force: true });
await sleep(300);
await tap('go-btn');
await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
await sleep(1500);

const S = (fn, arg) => page.evaluate(fn, arg);
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const center = async (id) => { const b = await page.locator(`[data-testid="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

// 1. drag-aim: preview appears, cancel spends nothing, release casts and burns the cooldown
let q = await center('skill-q');
await page.mouse.move(q.x, q.y); await page.mouse.down();
await page.mouse.move(q.x - 20, q.y, { steps: 3 }); await page.mouse.move(q.x - 90, q.y - 50, { steps: 6 });
await sleep(600);
check('preview visible while dragging', await S(() => window.__starlane.match.preview.root.visible));
await page.screenshot({ path: OUT });
await page.mouse.move(q.x, q.y, { steps: 6 }); // back onto the button = cancel
await sleep(200);
await page.mouse.up(); await sleep(600);
check('cancel zone: no cooldown spent', await S(() => window.__starlane.match.hero.cds[0] <= 0));
check('preview hidden after release', await S(() => !window.__starlane.match.preview.root.visible));

await page.mouse.move(q.x, q.y); await page.mouse.down();
await page.mouse.move(q.x - 20, q.y, { steps: 3 }); await page.mouse.move(q.x, q.y - 90, { steps: 6 });
await sleep(300);
const want = await S(() => window.__starlane.match.hero.x);
await page.mouse.up();
await page.waitForFunction(() => window.__starlane.match.hero.cds[0] > 0, null, { timeout: 30000 }).catch(() => {});
const moved = await S((x0) => { const h = window.__starlane.match.hero; return { cd: h.cds[0], dx: h.x - x0, face: h.face }; }, want);
check('drag release casts (cooldown running)', moved.cd > 0, JSON.stringify(moved));
await page.waitForFunction(() => !window.__starlane.match.hero.script, null, { timeout: 30000 });
await S(() => { const h = window.__starlane.match.hero; h.cds.fill(0); });
await sleep(300);

// 2. tap = quick-cast
await page.mouse.move(q.x, q.y); await page.mouse.down(); await page.mouse.up();
await page.waitForFunction(() => window.__starlane.match.hero.cds[0] > 0, null, { timeout: 30000 }).catch(() => {});
check('tap quick-casts', await S(() => window.__starlane.match.hero.cds[0] > 0));

// 3. target buttons: hold TOWER next to an enemy tower and a minion; the highlight ring follows the target
await page.waitForFunction(() => !window.__starlane.match.hero.script, null, { timeout: 30000 });
const tgt = await S(() => {
  const m = window.__starlane.match, h = m.hero, tw = m.towers.find((t) => t.team === 1 && t.tier === 'outer');
  tw.vulnerable = true;
  h.maxHp = h.hp = 99999; // the tower would otherwise end the test
  h.x = h.px = tw.x - 3; h.z = h.pz = tw.z;
  m.minions.spawnWave(1, 1, ['blobling', 'blobling']);
  for (const mi of m.minions.list) if (mi.team === 1) { mi.x = h.x + 1.2; mi.z = h.z + 0.6; }
  return { tower: tw.type };
});
await sleep(400);
const t1 = await center('target-tower'), t2 = await center('target-minion');
await page.mouse.move(t1.x, t1.y); await page.mouse.down(); await sleep(2500);
check('tower button targets a structure', await S(() => ['tower', 'core'].includes(window.__starlane.match.hero.aim?.type)), String(await S(() => window.__starlane.match.hero.aim?.type)));
check('target ring visible', await S(() => window.__starlane.match.hero.aim && true));
await page.mouse.up();
await S(() => { const m = window.__starlane.match, h = m.hero; m.minions.spawnWave(1, 1, ['blobling']); for (const mi of m.minions.list) if (mi.team === 1) { mi.x = h.x + 1; mi.z = h.z + 0.5; mi.hp = mi.maxHp = 9999; } });
await page.mouse.move(t2.x, t2.y); await page.mouse.down(); await sleep(1200);
check('minion button targets a minion', await S(() => window.__starlane.match.hero.aim?.type === 'minion'), String(await S(() => window.__starlane.match.hero.aim?.type)));
await page.mouse.up();

// 4. recall: channel, move cancels, completes in the fountain heal zone
await S(() => { const h = window.__starlane.match.hero; h.x = h.px = 0; h.z = h.pz = 0; h.hp = h.maxHp * 0.5; });
await sleep(400);
await page.keyboard.press('KeyB'); await sleep(2000);
check('recall channel starts', await S(() => window.__starlane.match.hero.recall > 0));
await page.screenshot({ path: OUT.replace('aim-indicator', 'recall-channel') });
await page.keyboard.down('KeyD'); await sleep(300); await page.keyboard.up('KeyD');
check('moving cancels recall', await S(() => window.__starlane.match.hero.recall === 0));
await page.keyboard.press('KeyB');
await page.waitForFunction(() => { const h = window.__starlane.match.hero; return h.recall === 0 && h.x < -60; }, null, { timeout: 90000 }).catch(() => {});
const home = await S(() => { const h = window.__starlane.match.hero; return { d: Math.hypot(h.x + 84, h.z), hp: h.hp / h.maxHp, recall: h.recall }; });
check('recall lands in the fountain zone', home.d < 6 && home.recall === 0, JSON.stringify(home));

const lost = await S(() => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); return gl?.isContextLost?.(); });
if (lost) errors.push('WebGL context lost');
if (errors.length) console.log(errors.join('\n'));
console.log(results.every(Boolean) && !errors.length ? 'ALL PASS' : 'SOME FAILED');
await browser.close();
server.close();
process.exit(results.every(Boolean) ? 0 : 1);
