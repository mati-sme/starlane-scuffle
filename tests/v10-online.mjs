// v10 online (2 browsers, local room server): guest sees KDA/stats, guest skill rank-up reaches the host, attack sounds are range-limited,
// cooldown digits on the guest. Run: WS_DIR=/tmp/wsdep/node_modules node tests/v10-online.mjs
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalRooms } from './local-room.mjs';
const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = '/workspace/test-artifacts/starlane-scuffle/v10/';
mkdirSync(OUT, { recursive: true });
const local = await startLocalRooms();
const WS = `&ws=${encodeURIComponent(local.url)}`;
const require = createRequire(import.meta.url);
let pw; for (const p of [undefined, '/tmp/pw/node_modules']) { try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {} }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, path); if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }); createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; let failed = 0;
const check = (n, ok, x = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function player(name) {
  const ctx = await browser.newContext({ ...pw.devices['iPhone 12 landscape'] });
  await ctx.addInitScript(() => { localStorage.setItem('starlane.unlockAll', 'true'); localStorage.setItem('starlane.tutorialSeen', 'true'); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${BASE}?gfx=low${WS}`, { waitUntil: 'load', timeout: 90000 });
  return page;
}
const tid = (p, id) => p.locator(`[data-testid="${id}"]`);
const host = await player('host'), guest = await player('guest');
await tid(host, 'online-btn').click({ force: true });
await tid(host, 'create-room').click({ force: true });
await tid(host, 'room-code').waitFor({ timeout: 20000 });
const code = (await tid(host, 'room-code').textContent()).trim();
await tid(guest, 'online-btn').click({ force: true });
await tid(guest, 'code-input').fill(code);
await tid(guest, 'join-room').click({ force: true });
await tid(guest, 'room-code').waitFor({ timeout: 20000 });
await host.waitForFunction(() => document.querySelector('[data-testid="player-1"]'), null, { timeout: 20000 });
// optional ban stage
for (const [p, id] of [[host, 'zinnia'], [guest, 'sol']]) {
  const banning = await p.evaluate(() => /Ban/.test(document.querySelector('[data-testid="draft-title"]')?.textContent ?? ''));
  if (banning) { await tid(p, `lobby-champ-${id}`).click({ force: true }); await sleep(400); await tid(p, 'ban-btn').click({ force: true }); }
}
await Promise.all([host, guest].map((p) => p.waitForFunction(() => /Pick/.test(document.querySelector('[data-testid="draft-title"]')?.textContent ?? 'Pick') && document.querySelector('[data-testid^="lobby-champ-"]'), null, { timeout: 20000 })));
await tid(host, 'team-sunny').click({ force: true }).catch(() => {});
await tid(host, 'lobby-champ-bulwark').click({ force: true });
await tid(guest, 'team-sunny').click({ force: true }).catch(() => {});
await tid(guest, 'lobby-champ-fennec').click({ force: true });
await sleep(800);
await host.screenshot({ path: OUT + 'online-lobby.png' });
await host.waitForFunction(() => { const b = document.querySelector('[data-testid="start-btn"]'); return b && !b.disabled; }, null, { timeout: 20000 });
await tid(host, 'start-btn').click({ force: true });
await Promise.all([host, guest].map((p) => p.waitForFunction(() => window.__starlane.state === 'match', null, { timeout: 40000 })));
await sleep(3000);
// 1) KDA: give the guest's hero (host side) 2 kills / 1 death / 3 assists and the host hero 1 / 0 / 0
await host.evaluate(() => { const m = window.__starlane.match; Object.assign(m._st(m.peerHero), { ko: 2, d: 1, a: 3, dmg: 900 }); Object.assign(m._st(m.hero), { ko: 1, d: 0, a: 0, dmg: 400 }); });
const kda = await guest.waitForFunction(() => ['k', 'd', 'a'].map((c) => document.querySelector(`[data-testid="kda-${c}"]`).textContent).join('/') === '2/1/3', null, { timeout: 15000 }).then(() => true, () => false);
check('guest HUD shows its own KDA (2/1/3)', kda, await guest.evaluate(() => ['k', 'd', 'a'].map((c) => document.querySelector(`[data-testid="kda-${c}"]`).textContent).join('/')));
const recapRows = await guest.evaluate(() => window.__starlane.match.recap(true).bars?.length ?? window.__starlane.match.heroes.map((h) => window.__starlane.match.stats.get(h)?.ko ?? 0).join(','));
check('guest has every hero\'s stats (host hero 1 KO)', await guest.evaluate(() => { const m = window.__starlane.match; const hostH = m.heroes.find((h) => h !== m.hero && m.stats.get(h)?.ko === 1); return !!hostH; }), String(recapRows));
// 2) guest skill rank-up through the + button
await host.evaluate(() => { const h = window.__starlane.match.peerHero; h.level = 3; h.points = 2; h.recalc(false); });
await guest.waitForFunction(() => !document.querySelector('[data-testid="skill-up-q"]').hidden, null, { timeout: 15000 });
await guest.screenshot({ path: OUT + 'online-guest-plus.png' });
await tid(guest, 'skill-up-q').dispatchEvent('pointerdown');
const ranked = await host.waitForFunction(() => window.__starlane.match.peerHero.ranks[0] === 2, null, { timeout: 15000 }).then(() => true, () => false);
check('guest + button ranks up Q on the host', ranked, await host.evaluate(() => JSON.stringify(window.__starlane.match.peerHero.ranks)));
await sleep(1500);
check('guest keeps rank 2 after snapshots', await guest.evaluate(() => window.__starlane.match.hero.ranks[0] === 2));
// 3) positional audio: the other human far away is out of earshot; nearby is audible
const far = await guest.evaluate(async () => { const { audio } = await import('/js/audio.js'); const m = window.__starlane.match; const other = m.heroes.find((h) => !h.brain && h !== m.hero) ?? m.heroes.find((h) => h !== m.hero); const me = m.hero; const saved = [other.x, other.z]; other.x = me.x + 60; other.z = me.z; const a = audio.where(other); other.x = me.x + 5; const b = audio.where(other); [other.x, other.z] = saved; return [a, b]; });
check('far attack sound not heard (other human 60 u away)', far[0] === null, JSON.stringify(far));
check('near attack sound heard, panned', far[1] && far[1].gain > 0.3, JSON.stringify(far));
// 4) cooldown digits on the guest
await tid(guest, 'skill-w').tap({ force: true });
await guest.waitForFunction(() => /^[0-9]/.test(document.querySelector('[data-testid="skill-w"] .num').textContent), null, { timeout: 8000 }).catch(() => {});
const cd = await guest.evaluate(() => document.querySelector('[data-testid="skill-w"] .num').textContent + ' (cds ' + window.__starlane.match.hero.cds.map((c) => c.toFixed(1)) + ')');
check('guest skill button shows cooldown seconds', /^[0-9]/.test(cd), cd);
await guest.screenshot({ path: OUT + 'online-guest-hud.png' });
await host.screenshot({ path: OUT + 'online-host-hud.png' });
check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); server.close(); local.close?.();
console.log(failed ? `${failed} FAILED` : 'ALL PASS'); process.exit(failed ? 1 : 0);
