// v5 stage D: behavior checks for the six new champions (mark/detonate, vortex, tether, boomerang, orbit, ricochet, quake).
// Run: node tests/v5-stage-d.mjs [outDir]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v5';
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR');
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`); });
const tap = (id) => page.locator(`[data-testid="${id}"]`).click({ force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));



const checks = [];
async function run(id, body) {
  await page.goto(BASE + `?gfx=low&hero=${id}`, { waitUntil: 'load', timeout: 90000 });
  await tap('play-btn'); await page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {}); await sleep(300);
  await page.locator(`[data-testid="champion-card-${id}"]`).click({ force: true }); await sleep(200);
  await tap('go-btn');
  await page.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 20000 });
  const r = await page.evaluate(`(async () => { ${pre} ${body} })()`);
  checks.push([id, r.name, r.ok, r.info]);
}
// helper preamble shared by every check (runs in the page): maxed hero, a stunned enemy hero standing `d` ahead.
const pre = `const m = window.__starlane.match, h = m.hero, foe = m.heroes.find((e) => e.team !== h.team);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  h.ranks = [4, 4, 3]; h.recalc(true); h.hp = h.maxHp; foe.maxHp = foe.hp = 5000; foe.stun = 5; foe.shieldHp = 0;
  const put = (d) => { foe.x = h.x + d; foe.z = h.z; foe.stun = 5; };
  const cast = async (i, ms = 900, aim = null) => { h.cds[i] = 0; h._begin(i, m, aim); await sleep(ms); };
  const until = async (f, ms = 6000) => { for (let t = 0; t < ms && !f(); t += 50) await sleep(50); };`;

await run('vesper', `
  put(5); const hp0 = foe.hp; await cast(0, 100); await until(() => foe.mark?.src === h); const marked = foe.mark?.src === h; const hp1 = foe.hp;
  await cast(1, 100); await until(() => !foe.mark);
  return { name: 'mark+detonate', ok: marked && !foe.mark && foe.hp < hp1 && hp1 < hp0, info: { marked, hp0, hp1, hp2: foe.hp } };`);
await run('nyx', `
  put(6); foe.stun = 0; const x0 = foe.x; await cast(0, 100, { dx: 1, dz: 0, dist: 3 }); await sleep(2200);
  const moved = x0 - foe.x; return { name: 'vortex pull', ok: moved > 1.5, info: { moved } };`);
await run('lumen', `
  const ally = m.heroes.find((e) => e.team === h.team && e !== h); const keep = () => { ally.x = h.x + 3; ally.z = h.z; ally.stun = 5; };
  keep(); ally.hp = ally.maxHp * 0.3; const a0 = ally.hp; const iv = setInterval(keep, 50);
  await cast(0, 100); await sleep(3500); clearInterval(iv); return { name: 'tether heal', ok: ally.hp > a0 + 60, info: { a0, a1: ally.hp } };`);
await run('rotor', `
  put(5); const hp0 = foe.hp; await cast(0, 100); await sleep(3500); const d1 = hp0 - foe.hp;
  put(1.6); const hp1 = foe.hp; await cast(1, 100); await sleep(2500);
  return { name: 'boomerang x2 + orbit', ok: d1 >= 100 && hp1 - foe.hp > 20, info: { boomerang: d1, orbit: hp1 - foe.hp } };`);
await run('rico', `
  const e2 = m.heroes.filter((e) => e.team !== h.team)[1]; e2.maxHp = e2.hp = 5000; e2.stun = 5;
  put(5); e2.x = foe.x + 2; e2.z = foe.z + 1; const b0 = e2.hp; await cast(0, 100); await until(() => e2.hp < b0);
  return { name: 'ricochet bounce', ok: e2.hp < b0, info: { b0, b1: e2.hp } };`);
await run('tremor', `
  put(6.5); const hp0 = foe.hp; await cast(0, 100); await until(() => foe.hp < hp0);
  return { name: 'fault line', ok: foe.hp < hp0, info: { dmg: hp0 - foe.hp } };`);
for (const c of checks) console.log(c[2] ? 'PASS' : 'FAIL', c[0], c[1], JSON.stringify(c[3]));
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
if (checks.some((c) => !c[2])) process.exitCode = 1;
await browser.close();
server.close();
