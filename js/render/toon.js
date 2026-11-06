// Stylized PBR look: metalness-roughness materials with per-part finish (paint / metal / cloth / glow) baked into a vertex
// attribute, a soft fresnel rim + hit flash, thin selective outlines on characters, world-space terrain detail, blob shadows.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { radialTexture } from './atlas.js';
import { HI } from './quality.js';

// Part finishes: [roughness multiplier, metalness, emissive strength].
export const FIN = {
  paint: [0.55, 0.25, 0], metal: [0.35, 0.8, 0], steel: [0.5, 0.5, 0], cloth: [0.95, 0, 0],
  rubber: [0.8, 0.05, 0], stone: [1, 0, 0], glow: [0.4, 0, 3.2], glass: [0.15, 0.3, 0.6],
};

const COMMON_V = /* glsl */ `
  #ifdef USE_FINISH
    attribute vec3 finish; varying vec3 vFin;
  #endif
  #ifdef USE_DETAIL
    varying vec3 vWPos; varying vec3 vWN;
  #endif`;
const BEGIN_V = /* glsl */ `
  #ifdef USE_FINISH
    vFin = finish;
  #endif
  #ifdef USE_DETAIL
    vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wp4 = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    #endif
    vWPos = wp4.xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);
  #endif`;
const COMMON_F = /* glsl */ `
  uniform float uFlash;
  #ifdef USE_FINISH
    varying vec3 vFin;
  #endif
  #ifdef USE_DETAIL
    uniform sampler2D uDetail; uniform float uScale; varying vec3 vWPos; varying vec3 vWN;
  #endif`;
// Detail texture is neutral grey around 0.5, so x2 keeps the vertex colors' average while adding grain; a slow
// second sample at 1/7 scale breaks up tiling. Triplanar for cliffs, top-down for ground.
const DETAIL_F = /* glsl */ `
  #ifdef USE_DETAIL
    #ifdef USE_TRIPLANAR
      vec3 bw = pow(abs(normalize(vWN)), vec3(4.0)); bw /= dot(bw, vec3(1.0));
      vec3 dt = texture2D(uDetail, vWPos.zy * uScale).rgb * bw.x + texture2D(uDetail, vWPos.xz * uScale).rgb * bw.y + texture2D(uDetail, vWPos.xy * uScale).rgb * bw.z;
    #else
      vec3 dt = texture2D(uDetail, vWPos.xz * uScale).rgb;
    #endif
    float macro = texture2D(uDetail, vWPos.xz * uScale * 0.14 + 0.37).g;
    diffuseColor.rgb *= dt * 2.0 * mix(0.86, 1.14, macro);
    float dH = dot(dt, vec3(0.333));
  #endif`;
// High tier: the detail texture doubles as a height field (screen-space derivative bump) and breaks up roughness, so grass
// blades, flagstone grout and rock strata catch the low sun instead of reading as flat paint.
const BUMP_F = /* glsl */ `
  #if defined(USE_DETAIL) && defined(USE_BUMP)
    roughnessFactor = clamp(roughnessFactor * mix(1.12, 0.82, dH), 0.04, 1.0);
    vec3 bpx = dFdx(-vViewPosition), bpy = dFdy(-vViewPosition);
    vec3 bR1 = cross(bpy, normal), bR2 = cross(normal, bpx);
    float bDet = dot(bpx, bR1);
    vec3 bGrad = sign(bDet) * (dFdx(dH) * bR1 + dFdy(dH) * bR2);
    normal = normalize(abs(bDet) * normal - bGrad * BUMP_K);
  #endif`;
const FINISH_R = '#include <roughnessmap_fragment>\n#ifdef USE_FINISH\n roughnessFactor = clamp(roughnessFactor * vFin.x, 0.04, 1.0);\n#endif';
const FINISH_M = '#include <metalnessmap_fragment>\n#ifdef USE_FINISH\n metalnessFactor = max(metalnessFactor, vFin.y);\n#endif\n metalnessFactor *= METAL_K;'; // no reflections on the low tier: keep metal from going black
const FINISH_E = '#include <emissivemap_fragment>\n#ifdef USE_FINISH\n totalEmissiveRadiance += diffuseColor.rgb * vFin.z;\n#endif';
// Soft cool rim from the view fresnel (reads as a sky bounce on silhouettes), then the white hit flash.
const RIM = /* glsl */ `
  float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
  outgoingLight += vec3(0.62, 0.74, 1.0) * rimF * RIM_K;
  outgoingLight = mix(outgoingLight, vec3(1.0), uFlash);
`;

// Standard material with the stylized patches; uFlash is exposed as material.userData.flash.
// Extra opts: finish (use the per-vertex finish attribute from mergeParts), detail {tex, scale, tri}, rim (0..1).
export function toonMat(opts = {}) {
  const { finish = false, detail = null, rim = 0.22, ...rest } = opts;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05, ...rest });
  const flash = { value: 0 };
  m.userData.flash = flash;
  m.defines = { RIM_K: rim.toFixed(3), METAL_K: HI ? '1.0' : '0.35' };
  if (finish) m.defines.USE_FINISH = '';
  if (detail) {
    m.defines.USE_DETAIL = '';
    if (detail.tri) m.defines.USE_TRIPLANAR = '';
    if (HI) { m.defines.USE_BUMP = ''; m.defines.BUMP_K = (detail.bump ?? 0.05).toFixed(3); }
  }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = flash;
    if (detail) { sh.uniforms.uDetail = { value: detail.tex }; sh.uniforms.uScale = { value: detail.scale }; }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>' + COMMON_V)
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + BEGIN_V);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>' + COMMON_F)
      .replace('#include <color_fragment>', '#include <color_fragment>' + DETAIL_F)
      .replace('#include <roughnessmap_fragment>', FINISH_R)
      .replace('#include <metalnessmap_fragment>', FINISH_M)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + BUMP_F)
      .replace('#include <emissivemap_fragment>', FINISH_E)
      .replace('#include <opaque_fragment>', RIM + '#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => `sty-${finish ? 1 : 0}-${detail ? (detail.tri ? 2 : 1) : 0}-${m.defines.RIM_K}-${m.defines.BUMP_K ?? 0}`;
  return m;
}

// Ground / cliff material: vertex colors times a tiling world-space detail texture. Receives shadows.
export const terrainMat = (tex, scale, tri = false, opts = {}) => {
  const { bump, ...rest } = opts;
  return toonMat({ vertexColors: true, roughness: 0.92, rim: 0.05, detail: { tex, scale, tri, bump }, ...rest });
};

// Outlines are a soft deep-navy hull, kept only on characters and key props so the world reads painted, not inked.
const outlines = new Map();
export function outlineMat(thickness) {
  if (!outlines.has(thickness)) {
    outlines.set(thickness, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      uniforms: { uT: { value: thickness * 0.32 }, uCol: { value: new THREE.Color(0x0A0E16) } }, // v7.2: hairline, not cartoon ink
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

// A shadow-casting mesh with an optional inverted-hull outline child.
export function toonMesh(geo, mat, thickness = 0.035) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  if (thickness) mesh.add(new THREE.Mesh(geo, outlineMat(thickness)));
  return mesh;
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();

// parts: [{ g: geometry, c: hex color, p: [x,y,z], s: [x,y,z] | n, r: [x,y,z], f: FIN key }] -> one geometry with
// vertex colors and a per-vertex finish (roughness, metalness, emissive) read by toonMat({ finish: true }).
export function mergeParts(parts) {
  const geos = parts.map(({ g, c, p = [0, 0, 0], s = 1, r = [0, 0, 0], f = 'paint' }) => {
    const sv = typeof s === 'number' ? [s, s, s] : s;
    const geo = g.index ? g.toNonIndexed() : g.clone();
    geo.deleteAttribute('uv');
    geo.applyMatrix4(_m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...sv)));
    const col = new THREE.Color(c), fin = FIN[f] ?? FIN.paint, n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3), fa = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr.set([col.r, col.g, col.b], i * 3); fa.set(fin, i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('finish', new THREE.BufferAttribute(fa, 3));
    return geo;
  });
  return mergeGeometries(geos);
}

// Blob shadows stay as soft contact shadows under the real shadow map (and are the only shadow when it is off).
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export const shadowMat = new THREE.MeshBasicMaterial({
  map: radialTexture(), color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false,
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

// Additive halo sprite used to fake crystal glow (not tone-mapped so team colors stay saturated).
let haloTex;
export function makeHalo(color, size) {
  haloTex ??= radialTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8, toneMapped: false,
  }));
  s.scale.set(size, size, 1);
  return s;
}
