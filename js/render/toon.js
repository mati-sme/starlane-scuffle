// Toon look: shared 3-step gradient, fresnel rim + hit flash, inverted-hull outlines, blob shadows.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../config.js';
import { radialTexture } from './atlas.js';

export const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([115, 191, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const RIM = /* glsl */ `
  float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);
  outgoingLight += vec3(1.0, 0.957, 0.76) * rimF * 0.35;
  outgoingLight = mix(outgoingLight, vec3(1.0), uFlash);
`;

// Toon material with rim light and a uFlash uniform exposed as material.userData.flash.
export function toonMat(opts = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap, ...opts });
  const flash = { value: 0 };
  m.userData.flash = flash;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = flash;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash;')
      .replace('#include <opaque_fragment>', RIM + '#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'toon-rim-flash';
  return m;
}

const outlines = new Map();
export function outlineMat(thickness) {
  if (!outlines.has(thickness)) {
    outlines.set(thickness, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      uniforms: { uT: { value: thickness }, uCol: { value: new THREE.Color(PAL.ink) } },
      vertexShader: /* glsl */ `
        uniform float uT;
        void main() {
          vec3 p = position + normalize(normal) * uT;
          #ifdef USE_INSTANCING
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          #else
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          #endif
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol;
        void main() {
          gl_FragColor = vec4(uCol, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
  }
  return outlines.get(thickness);
}

// A toon mesh with an inverted-hull outline child.
export function toonMesh(geo, mat, thickness = 0.035) {
  const mesh = new THREE.Mesh(geo, mat);
  if (thickness) mesh.add(new THREE.Mesh(geo, outlineMat(thickness)));
  return mesh;
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

// parts: [{ g: geometry, c: hex color, p: [x,y,z], s: [x,y,z] | n, r: [x,y,z] }] -> one vertex-colored geometry.
export function mergeParts(parts) {
  const geos = parts.map(({ g, c, p = [0, 0, 0], s = 1, r = [0, 0, 0] }) => {
    const sv = typeof s === 'number' ? [s, s, s] : s;
    const geo = g.index ? g.toNonIndexed() : g.clone();
    geo.deleteAttribute('uv');
    geo.applyMatrix4(_m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...sv)));
    const col = new THREE.Color(c), n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  });
  return mergeGeometries(geos);
}

const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export const shadowMat = new THREE.MeshBasicMaterial({
  map: radialTexture(), color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
});
export const SHADOW_Y = 0.14;
export { shadowGeo };

export function makeShadow(size) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.scale.set(size, 1, size);
  m.position.y = SHADOW_Y;
  m.renderOrder = 1;
  return m;
}

// Additive halo sprite used to fake crystal glow.
let haloTex;
export function makeHalo(color, size) {
  haloTex ??= radialTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8,
  }));
  s.scale.set(size, size, 1);
  return s;
}
