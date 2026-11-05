// Hero-owned effect meshes: ribbon trail (Zip), fresnel faceted dome (Moss), scrolling-UV beam (Clink).
import * as THREE from 'three';

const _ca = new THREE.Color(), _cb = new THREE.Color(), _cc = new THREE.Color();

// Pooled strip of `n` segments lying flat in XZ. push() records the head each frame; the tail fades and tapers.
export class Ribbon {
  constructor(scene, n, colA, colB, width) {
    this.n = n;
    this.width = width;
    this.pts = new Float32Array(n * 3);
    this.acc = 0;
    this.fresh = true;

    const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 4), idx = [];
    _ca.set(colA); _cb.set(colB);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      _cc.copy(_ca).lerp(_cb, u);
      for (let k = 0; k < 2; k++) col.set([_cc.r, _cc.g, _cc.b, (1 - u) * 0.9], (i * 2 + k) * 4);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    scene.add(this.mesh);
  }

  clear() { this.fresh = true; }

  push(x, y, z, dt) {
    const p = this.pts, n = this.n;
    if (this.fresh) {
      for (let i = 0; i < n; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; }
      this.fresh = false;
    }
    this.acc += dt;
    if (this.acc >= 0.022) { this.acc = 0; p.copyWithin(3, 0, (n - 1) * 3); }
    p[0] = x; p[1] = y; p[2] = z;

    const out = this.mesh.geometry.attributes.position.array;
    let px = 1, pz = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, n - 1) * 3;
      const dx = p[a] - p[b], dz = p[a + 2] - p[b + 2], len = Math.hypot(dx, dz);
      if (len > 1e-4) { px = -dz / len; pz = dx / len; }
      const w = this.width * (1 - i / (n - 1)) * 0.5;
      const o = i * 6;
      out[o] = p[i * 3] + px * w; out[o + 1] = p[i * 3 + 1]; out[o + 2] = p[i * 3 + 2] + pz * w;
      out[o + 3] = p[i * 3] - px * w; out[o + 4] = p[i * 3 + 1]; out[o + 5] = p[i * 3 + 2] - pz * w;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

const DOME_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const DOME_FRAG = /* glsl */ `
  uniform vec3 uCol; uniform float uA;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    gl_FragColor = vec4(uCol, (0.14 + 0.75 * f) * uA);
    #include <colorspace_fragment>
  }`;

// Hex-faceted bubble: flat-shaded icosahedron with a fresnel shell. Scale it to the radius you want.
export function makeDome(color) {
  const geo = new THREE.IcosahedronGeometry(1, 1); // already non-indexed
  geo.computeVertexNormals(); // flat facets
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uA: { value: 1 } },
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  mesh.renderOrder = 8;
  return mesh;
}

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.15)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0.15)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Cylinder along +Z from the origin, unit length; set scale.z to the length and rotation.y to aim it.
export function makeBeam(color) {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const tex = stripeTexture();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  mesh.visible = false;
  mesh.renderOrder = 9;
  mesh.userData.tex = tex;
  return mesh;
}
