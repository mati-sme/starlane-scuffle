// v3 online + skill-up e2e, updated for the v6 ban -> pick draft. Run: node tests/v3-online.mjs  (needs playwright + chromium).
// Rooms run through tests/local-room.mjs (needs the `ws` package; WS_DIR=<node_modules>) unless WS_URL points at a deployed worker.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalRooms } from './local-room.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.env.ARTIFACT_DIR ?? '/workspace/test-artifacts/starlane-scuffle/v3';
mkdirSync(OUT, { recursive: true });
const local = process.env.WS_URL ? null : await startLocalRooms();
const WS = `&ws=${encodeURIComponent(process.env.WS_URL ?? local.url)}`;

const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR to a node_modules containing it');
const { chromium, devices } = pw;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
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
const open = [];
const errors = [];
const results = [];

function watch(page, name) {
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
}

async function newPlayer(name) {
  // iPhone 12 landscape (844x390): the game is landscape-only, portrait shows the rotate-phone overlay.
  const ctx = await browser.newContext({ ...devices['iPhone 12 landscape'] });
  open.push(ctx);
  const page = await ctx.newPage();
  watch(page, name);
  return { ctx, page, name };
}

const tid = (page, id) => page.locator(`[data-testid="${id}"]`);
const tap = (page, id) => tid(page, id).click({ force: true });
const shot = (page, file) => page.screenshot({ path: join(OUT, file) });
const state = (page) => page.evaluate(() => window.__starlane.state);
const waitMatch = (page) => page.waitForFunction(() => window.__starlane.state === 'match' && document.body.classList.contains('playing'), null, { timeout: 20000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Software GL is slow to boot two heavy pages, so low gfx + a long load timeout, like the other v6 tests.
const load = (page) => page.goto(`${BASE}?gfx=low${WS}`, { waitUntil: 'load', timeout: 90000 });

async function openOnline(page) {
  await load(page);
  await tap(page, 'online-btn');
}

async function createRoom(host) {
  await openOnline(host.page);
  await tap(host.page, 'create-room');
  await tid(host.page, 'room-code').waitFor({ timeout: 15000 });
  const code = (await tid(host.page, 'room-code').textContent()).trim();
  if (!/^[A-Z0-9]{4}$/.test(code)) throw new Error(`bad room code "${code}"`);
  return code;
}

async function joinRoom(page, code) {
  await openOnline(page);
  await tid(page, 'code-input').fill(code);
  await tap(page, 'join-room');
  await tid(page, 'room-code').waitFor({ timeout: 15000 });
  const got = (await tid(page, 'room-code').textContent()).trim();
  if (got !== code) throw new Error(`joined ${got}, expected ${code}`);
}

// Both clients see two players with a champion each (the room echoes every pick back).
const bothPicked = (host, guest) => Promise.all([host, guest].map((p) => p.page.waitForFunction(() => {
  const rows = [...document.querySelectorAll('.players .pl:not(.wait)')];
  return rows.length === 2 && rows.every((r) => !r.querySelector('.ch').textContent.includes('…'));
}, null, { timeout: 15000 })));

async function startFromLobby(host, guest) {
  await host.page.waitForFunction(() => { const b = document.querySelector('[data-testid="start-btn"]'); return b && !b.disabled; }, null, { timeout: 15000 });
  await tap(host.page, 'start-btn');
  await Promise.all([waitMatch(host.page), waitMatch(guest.page)]);
  await Promise.all([host, guest].map((p) => tid(p.page, 'skill-q').waitFor({ state: 'visible' })));
  await sleep(2500); // let a few snapshots flow
}

// Tap a champion, wait for the lobby echo to settle so Ban is armed, then ban it.
async function ban(page, id) {
  await tap(page, `lobby-champ-${id}`);
  await page.waitForFunction(() => { const b = document.querySelector('[data-testid="ban-btn"]'); return b && !b.disabled; }, null, { timeout: 15000 });
  await tap(page, 'ban-btn');
}

async function lobbyRoom(sameTeam) {
  const host = await newPlayer('host'), guest = await newPlayer('guest');
  const code = await createRoom(host);
  await joinRoom(guest.page, code);
  const ids = await host.page.evaluate(() => [...document.querySelectorAll('[data-testid^="lobby-champ-"]')].map((b) => b.dataset.id));
  // v6 draft: each human bans one champion, then the lobby moves on to picks.
  await host.page.waitForFunction(() => document.querySelector('[data-testid="player-1"]'), null, { timeout: 15000 }); // a late joiner restarts the draft
  await ban(host.page, ids[0]);
  await ban(guest.page, ids[1]);
  await Promise.all([host, guest].map((p) => p.page.waitForFunction(() => document.querySelector('[data-testid="draft-title"]')?.textContent.includes('Pick'), null, { timeout: 15000 })));
  await tap(host.page, 'team-sunny');
  await tap(host.page, `lobby-champ-${ids[2]}`);
  await tap(guest.page, sameTeam ? 'team-sunny' : 'team-gloom');
  await tap(guest.page, `lobby-champ-${ids[3]}`);
  await bothPicked(host, guest);
  return { host, guest, code };
}

async function flow(name, fn) {
  try { await fn(); results.push([name, 'PASS']); }
  catch (e) { results.push([name, `FAIL: ${e.message.split('\n')[0]}`]); console.error(`[${name}]`, e); }
  finally { await Promise.all(open.splice(0).map((c) => c.close().catch(() => {}))); }
}

await flow('A same-team', async () => {
  const { host, guest } = await lobbyRoom(true);
  await shot(host.page, 'lobby.png');
  const mode = await tid(host.page, 'lobby-mode').textContent();
  if (!/Co-op/.test(mode)) throw new Error(`expected Co-op mode, got "${mode}"`);
  await startFromLobby(host, guest);
  await shot(host.page, 'same-team-host.png');
  await shot(guest.page, 'same-team-guest.png');
  await host.ctx.close(); await guest.ctx.close();
});

await flow('B versus', async () => {
  const { host, guest } = await lobbyRoom(false);
  const mode = await tid(host.page, 'lobby-mode').textContent();
  if (!/Versus/.test(mode)) throw new Error(`expected Versus mode, got "${mode}"`);
  await startFromLobby(host, guest);
  await shot(host.page, 'versus-host.png');
  await shot(guest.page, 'versus-guest.png');
  await host.ctx.close(); await guest.ctx.close();
});

await flow('C reconnect', async () => {
  const { host, guest, code } = await lobbyRoom(true);
  await startFromLobby(host, guest);
  await guest.page.close(); // guest drops mid-match, then reopens and joins the same code
  await sleep(1500);
  const g2 = await guest.ctx.newPage();
  watch(g2, 'guest2');
  await joinRoomMidMatch(g2, code);
  const slot = await g2.evaluate(() => window.__starlane.net.slot);
  if (slot !== 1) throw new Error(`guest resumed in slot ${slot}, expected 1`);
  await sleep(1500);
  if (await state(host.page) !== 'match') throw new Error('host left the match during guest reconnect');
  await shot(g2, 'reconnect.png');
  await host.ctx.close(); await guest.ctx.close();
});

async function joinRoomMidMatch(page, code) {
  await openOnline(page);
  await tid(page, 'code-input').fill(code);
  await tap(page, 'join-room');
  await waitMatch(page);
  await tid(page, 'skill-q').waitFor({ state: 'visible' });
}

await flow('D skill-up (offline)', async () => {
  const p = await newPlayer('solo');
  await load(p.page);
  await tap(p.page, 'play-btn'); await p.page.locator('[data-testid="setup-next"]').click({ force: true, timeout: 4000 }).catch(() => {});
  // offline draft: ban one champion, then pick a free one
  await tid(p.page, 'ban-btn').waitFor({ state: 'visible' });
  const cards = await p.page.$$eval('[data-testid^="champion-card-"]', (els) => els.map((e) => e.dataset.id));
  await tid(p.page, `champion-card-${cards[3]}`).click({ force: true });
  await tap(p.page, 'ban-btn');
  await p.page.waitForFunction(() => document.querySelector('[data-testid="draft-title"]')?.textContent.includes('Pick'), null, { timeout: 15000 });
  await tid(p.page, `champion-card-${cards[0]}`).click({ force: true });
  await tid(p.page, 'go-btn').waitFor({ state: 'visible' });
  await tap(p.page, 'go-btn');
  await waitMatch(p.page);
  await p.page.evaluate(() => { const h = window.__starlane.match.hero; h.levelUp(); h.levelUp(); });
  await tid(p.page, 'skill-up-q').waitFor({ state: 'visible', timeout: 5000 });
  await sleep(600);
  await shot(p.page, 'skill-up.png');
  const rank = () => p.page.evaluate(() => window.__starlane.match.hero.ranks[0]);
  const before = await rank();
  await tap(p.page, 'skill-up-q');
  const after = await rank();
  if (after !== before + 1) throw new Error(`rank did not increase (${before} -> ${after})`);
  await p.ctx.close();
});

await browser.close();
server.close();
local?.close();

console.log('\n=== RESULTS ===');
for (const [n, r] of results) console.log(`${r === 'PASS' ? 'PASS' : 'FAIL'}  ${n}${r === 'PASS' ? '' : '  ' + r}`);
if (errors.length) { console.log('\nConsole/page errors:'); for (const e of new Set(errors)) console.log('  ' + e); }
process.exit(results.some(([, r]) => r !== 'PASS') || errors.length ? 1 : 0);
