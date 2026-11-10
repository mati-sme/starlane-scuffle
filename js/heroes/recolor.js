// Skin recolouring: every champion body is built from vertex colours (render/toon.js mergeParts), so a palette is applied by
// shifting those colours after the model is built. Greys / steel get a gentle tint; dark joints and white highlights stay as they are.
import * as THREE from 'three';
import { TEAM } from '../config.js';
import { PALETTES, toHsl } from '../game/skins.js';

const _c = new THREE.Color(), _h = {}, _t = new THREE.Color(), _tl = new THREE.Color();
export function recolorModel(root, def, skin, team = 0) {
  const pal = PALETTES[skin];
  if (!pal || !root) return root;
  const base = toHsl(def.color)[1] >= 0.15 ? toHsl(def.color)[0] : toHsl(def.accent)[0];
  const delta = pal.hue - base;
  _t.set(TEAM[team].main); _tl.copy(_t).lerp(new THREE.Color(0xffffff), 0.35); // keep the team-coloured bits so friend / foe stays readable
  const done = new Set(); // meshes can share a colour attribute: recolour each only once
  (root.root ?? root).traverse((o) => {
    const a = o.isMesh && o.geometry?.attributes?.color;
    if (!a || done.has(a)) return;
    done.add(a);
    for (let i = 0; i < a.count; i++) {
      _c.setRGB(a.getX(i), a.getY(i), a.getZ(i));
      if (Math.hypot(_c.r - _t.r, _c.g - _t.g, _c.b - _t.b) < 0.2 || Math.hypot(_c.r - _tl.r, _c.g - _tl.g, _c.b - _tl.b) < 0.15) continue;
      _c.getHSL(_h);
      if (_h.l < 0.15 || _h.l > 0.9) continue;
      if (_h.s < 0.15) _c.setHSL(pal.hue, 0.4, _h.l); else _c.setHSL((((_h.h + delta) % 1) + 1) % 1, _h.s, _h.l);
      a.setXYZ(i, _c.r, _c.g, _c.b);
    }
    a.needsUpdate = true;
  });
  return root;
}
