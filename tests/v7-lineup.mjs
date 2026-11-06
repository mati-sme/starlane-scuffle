// v7 stage B: renders all 24 champion models in one lineup (rows = roles) to check silhouettes at a glance.
// Run: node tests/v7-lineup.mjs [out.png] [cols]  (needs playwright + chromium)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = process.argv[2] ?? '/workspace/test-artifacts/starlane-scuffle/v7/lineup.png';
const require = createRequire(import.meta.url);
let pw;
for (const p of [undefined, process.env.PLAYWRIGHT_DIR, '/tmp/pw/node_modules']) {
  try { pw = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); break; } catch {}
}
if (!pw) throw new Error('playwright not found; set PLAYWRIGHT_DIR');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PAGE = `<!doctype html><html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script></head>
<body style="margin:0;background:#000"><canvas id="c" style="width:100vw;height:100vh"></canvas><script type="module">
import * as THREE from 'three';
import { createRenderer } from '/js/render/renderer.js';
import { HEROES, ROSTER } from '/js/heroes/index.js';
const gfx = createRenderer(document.getElementById('c'));
const { renderer, scene, camera } = gfx;
scene.background = new THREE.Color(0x6C8A5A);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6C8A5A }));
scene.add(floor);
const cols = Number(new URLSearchParams(location.search).get('cols') ?? 8), gap = 4.2;
const q = new URLSearchParams(location.search), from = Number(q.get('from') ?? 0), n = Number(q.get('n') ?? ROSTER.length);
const ids = ROSTER.slice(from, from + n);
const rows = Math.ceil(ids.length / cols);
ids.forEach((id, i) => {
  const m = HEROES[id].buildModel(0), g = new THREE.Group();
  g.add(m.root);
  const x = (i % cols - (cols - 1) / 2) * gap, z = (Math.floor(i / cols) - (rows - 1) / 2) * 5.2;
  g.position.set(x, 0, z); g.scale.setScalar(1.15);
  m.root.rotation.y = 0.45;
  m.arms[0].rotation.set(-0.12, 0, -0.14); m.arms[1].rotation.set(-0.08, 0, 0.14);
  if (m.halo) m.halo.rotation.y = 0.6;
  if (m.style === 'float') m.root.position.y = 0.5;
  scene.add(g);
});
camera.fov = 28; camera.updateProjectionMatrix();
renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight;
const D = Math.max(cols * gap * 1.55, rows * 5.2 * 2.6), low = rows === 1;
camera.position.set(0, low ? 3.2 : D * 0.55, low ? D * 0.72 : D * 0.62 + 6); camera.lookAt(0, low ? 2.4 : 1.2, 0); camera.updateProjectionMatrix();
renderer.render(scene, camera);
window.__done = true;
</script></body></html>`;
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__lineup') { res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE); return; }
  const path = normalize(decodeURIComponent(u.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.address().port}/__lineup?cols=${process.argv[3] ?? 8}&from=${process.argv[4] ?? 0}&n=${process.argv[5] ?? 24}&gfx=high`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__done, null, { timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: OUT });
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'ok ' + OUT);
await browser.close(); server.close();
