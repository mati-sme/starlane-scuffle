// One pooled THREE.Points system: additive, atlas-driven, CPU-integrated, 1 draw call.
import * as THREE from 'three';
import { BUDGET } from '../config.js';
import { particleAtlas } from './atlas.js';
import { rand } from '../core/math.js';

const MAX = BUDGET.maxParticles;
export const FRAME = { dot: 0, star: 1, sparkle: 2, ring: 3 };

const VERT = /* glsl */ `
  attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aFrame;
  uniform float uScale;
  varying vec3 vC; varying float vA; varying float vF;
  void main() {
    vC = aColor; vA = aAlpha; vF = aFrame;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  varying vec3 vC; varying float vA; varying float vF;
  void main() {
    vec4 t = texture2D(uTex, vec2((vF + gl_PointCoord.x) / 4.0, 1.0 - gl_PointCoord.y));
    // White-hot core: the brightest part of each sprite pushes toward white so effects glow rather than tint.
    vec3 c = mix(vC, vec3(1.0), t.a * t.a * 0.55);
    gl_FragColor = vec4(c * t.rgb * 1.25, t.a * vA);
    #include <colorspace_fragment>
  }`;

const _c = new THREE.Color();

class Particles {
  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.frame = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.age = new Float32Array(MAX).fill(1);
    this.life = new Float32Array(MAX).fill(1);
    this.head = 0;
    this.live = 0;

    const geo = new THREE.BufferGeometry();
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', dyn(this.pos, 3));
    geo.setAttribute('aColor', dyn(this.col, 3));
    geo.setAttribute('aSize', dyn(this.size, 1));
    geo.setAttribute('aAlpha', dyn(this.alpha, 1));
    geo.setAttribute('aFrame', dyn(this.frame, 1));
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: particleAtlas() }, uScale: { value: 600 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  attach(scene) { scene.add(this.points); }

  setViewport(heightPx, fovDeg) {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(x, y, z, vx, vy, vz, color, size, life, frame = 0, grav = 0) {
    const i = this.head;
    this.head = (i + 1) % MAX;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    _c.set(color);
    this.col[i3] = _c.r; this.col[i3 + 1] = _c.g; this.col[i3 + 2] = _c.b;
    this.size[i] = size; this.life[i] = life; this.age[i] = 0;
    this.frame[i] = frame; this.grav[i] = grav; this.alpha[i] = 1;
  }

  // Radial burst. colors: array of hex, or a single hex.
  burst(x, y, z, n, { color = 0xffffff, speed = 3, up = 2, size = 0.5, life = 0.7, frame = 1, grav = 5 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = speed * rand(0.4, 1);
      const c = Array.isArray(color) ? color[i % color.length] : color;
      this.emit(x, y, z, Math.cos(a) * s, rand(0.3, 1) * up + 0.5, Math.sin(a) * s, c, size * rand(0.7, 1.2), life * rand(0.7, 1.2), frame, grav);
    }
  }

  clear() {
    this.age.fill(1); this.alpha.fill(0); this.size.fill(0);
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const u = this.age[i] / this.life[i];
      if (u >= 1) { this.alpha[i] = 0; continue; }
      live++;
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.alpha[i] = Math.min(1, (1 - u) * 2.5);
    }
    if (live || this.live) {
      const a = this.geo.attributes;
      a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aFrame.needsUpdate = true;
    }
    this.live = live;
  }
}

export const particles = new Particles();

const GOLD_WHITE = [0xFFD23F, 0xFFF4C2];
// Defeat poof: gold + white stars, plus a ring.
export function poofStars(x, y, z, n) {
  particles.burst(x, y, z, n, { color: GOLD_WHITE, speed: n > 20 ? 5 : 3.5, up: 4, size: 0.7, life: 0.9, frame: FRAME.star, grav: 7 });
  particles.emit(x, y, z, 0, 0, 0, 0xFFF4C2, n > 20 ? 5 : 3, 0.35, FRAME.ring, 0);
}
