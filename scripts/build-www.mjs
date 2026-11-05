// Bundles the web game into www/ for the native shells (Capacitor, Tauri). three.js is vendored so the apps work offline;
// online play still talks to the Worker over wss://.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/vendor/three/addons`, { recursive: true });
for (const p of ['css', 'js', 'icons', 'assets', 'manifest.json']) cpSync(p, `${out}/${p}`, { recursive: true });
cpSync('node_modules/three/build/three.module.js', `${out}/vendor/three/three.module.js`);
cpSync('node_modules/three/examples/jsm', `${out}/vendor/three/addons`, { recursive: true });
const html = readFileSync('index.html', 'utf8')
  .replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js', './vendor/three/three.module.js')
  .replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/', './vendor/three/addons/');
writeFileSync(`${out}/index.html`, html);
console.log('www/ ready');
