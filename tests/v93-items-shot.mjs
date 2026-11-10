// v9.3: item catalog art sheet + shop bar with a built inventory. Run: node tests/v93-items-shot.mjs
import { launch, SHOTS } from './_pw.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });
const t = await launch({ seed: { unlockAll: true }, size: { width: 1100, height: 700 } });
const { page, check, errors } = t;
const n = await page.evaluate(async () => {
  const { ITEMS } = await import('/js/game/gear.js');
  const { itemIcon } = await import('/js/ui/itemart.js');
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:99;background:#0B1020;padding:14px;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;font:12px sans-serif;color:#fff';
  for (const it of Object.values(ITEMS)) el.innerHTML += `<div style="width:120px;text-align:center"><div style="width:84px;height:84px;margin:0 auto">${itemIcon(it)}</div><b>${it.name}</b><br>T${it.tier} · ${it.cost}g<br><small style="color:#9fb0d0">${it.tip}</small></div>`;
  document.body.appendChild(el);
  return Object.keys(ITEMS).length;
});
await page.screenshot({ path: SHOTS + 'items-catalog.png' });
check('item catalog renders', n >= 22, String(n));
check('every item has a glyph', await page.evaluate(async () => { const { ITEMS } = await import('/js/game/gear.js'); return Object.values(ITEMS).every((i) => document.querySelector(`svg[data-ic="${i.ic}"]`)); }));
check('no page errors', errors.length === 0, errors.join(';'));
await t.done();
