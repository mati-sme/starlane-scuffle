// The Nexus (core): heavily armored, fires its own laser at nearby enemies, and throws a shield pulse the first time it is hit once exposed.
// Floating energy crystal over a stepped reactor dais with conduit pylons, orbiting shards, fresnel shield bubble.
import * as THREE from 'three';
import { PAL, TEAM, CORE, GROUND } from '../config.js';
import { bus } from '../core/bus.js';
import { structSpot } from './arena.js';
import { toonMat, toonMesh, mergeParts, makeShadow, makeHalo } from '../render/toon.js';
import { runeTexture } from '../render/atlas.js';
import { HI } from '../render/quality.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { tickHitFx, dyingScale, shove, applyStatus } from '../game/combat.js';
import { defenderTarget } from './tower.js';

const CRYSTAL_Y = 3.9;

const shieldMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uC: { value: new THREE.Color(color) } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main(){ vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uC; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(uC * f * 0.6, f * 0.5);
    #include <colorspace_fragment>
    }`,
});

export class Core {
  constructor(scene, team) {
    this.type = 'core';
    this.team = team;
    const spot = structSpot(team, 'core');
    this.x = spot.x;
    this.z = spot.z;
    this.rx = this.x; this.rz = this.z;
    this.radius = CORE.radius;
    this.hitY = CRYSTAL_Y;
    this.barY = 7.6;
    this.maxHp = CORE.hp;
    this.armor = CORE.armor;

    const c = TEAM[team];
    this.group = new THREE.Group();
    this.group.position.set(this.x, GROUND, this.z);
    this.group.add(makeShadow(7));

    this.mat = toonMat({ vertexColors: true, finish: true, rim: 0.25 });
    this.crystalMat = toonMat({ color: c.main, emissive: c.main, emissiveIntensity: 1.3, roughness: 0.12, metalness: 0.1 });
    this.mats = [this.mat, this.crystalMat];

    // Stepped stone dais, six armored conduit pylons with glowing tips, an energy ring and a team-painted reactor socket.
    const glowC = new THREE.Color(c.main).lerp(new THREE.Color(0xffffff), 0.15).getHex();
    const daisGeo = mergeParts([
      { g: new THREE.CylinderGeometry(3.5, 3.7, 0.3, 16), c: 0x5E5950, p: [0, 0.15, 0], f: 'stone' },
      { g: new THREE.CylinderGeometry(3.0, 3.3, 0.35, 16), c: 0x746D62, p: [0, 0.45, 0], f: 'stone' },
      { g: new THREE.CylinderGeometry(2.4, 2.7, 0.3, 16), c: 0x5A606A, p: [0, 0.75, 0], f: 'steel' },
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * 2.85, z = Math.sin(a) * 2.85;
        return [
          { g: new THREE.BoxGeometry(0.45, 1.9, 0.5), c: 0x4C535E, p: [x, 1.25, z], r: [0, -a, 0], f: 'steel' },
          { g: new THREE.BoxGeometry(0.55, 0.22, 0.6), c: c.main, p: [x, 2.0, z], r: [0, -a, 0], f: 'paint' },
          { g: new THREE.OctahedronGeometry(0.22), c: glowC, p: [x, 2.42, z], f: 'glow' },
          { g: new THREE.BoxGeometry(0.06, 1.1, 0.06), c: glowC, p: [Math.cos(a) * 2.6, 1.2, Math.sin(a) * 2.6], r: [0, -a, 0], f: 'glow' },
        ];
      }).flat(),
      { g: new THREE.TorusGeometry(2.25, 0.12, 6, 32), c: glowC, p: [0, 0.92, 0], r: [Math.PI / 2, 0, 0], f: 'glow' },
      { g: new THREE.CylinderGeometry(1.1, 1.5, 0.55, 12), c: c.deep, p: [0, 1.15, 0], f: 'metal' },
      { g: new THREE.TorusGeometry(1.15, 0.08, 6, 24), c: 0xD2D6DC, p: [0, 1.42, 0], r: [Math.PI / 2, 0, 0], f: 'metal' },
      // Outer terrace and four guardian spires (kept off the fountain axis), each with stacked plates, glow seams and a capstone socket.
      { g: new THREE.CylinderGeometry(4.6, 4.9, 0.18, 24), c: 0x4A4640, p: [0, 0.09, 0], f: 'stone' },
      ...Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return { g: new THREE.BoxGeometry(0.5, 0.12, 0.2), c: i % 2 ? glowC : 0x2E2B28, p: [Math.cos(a) * 4.35, 0.2, Math.sin(a) * 4.35], r: [0, -a, 0], f: i % 2 ? 'glow' : 'stone' }; }),
      ...[Math.PI / 3, (2 * Math.PI) / 3, (4 * Math.PI) / 3, (5 * Math.PI) / 3].flatMap((a) => {
        const x = Math.cos(a) * 4.4, z = Math.sin(a) * 4.4, r = [0, -a, 0];
        return [
          { g: new THREE.BoxGeometry(1.1, 0.5, 1.1), c: 0x5E5950, p: [x, 0.35, z], r, f: 'stone' },
          { g: new THREE.CylinderGeometry(0.32, 0.5, 4.2, 4), c: 0x4C535E, p: [x, 2.6, z], r: [0, -a + Math.PI / 4, 0], f: 'steel' },
          ...[1.4, 2.6, 3.8].map((y) => ({ g: new THREE.CylinderGeometry(0.5 - y * 0.04, 0.55 - y * 0.04, 0.18, 4), c: c.main, p: [x, y, z], r: [0, -a + Math.PI / 4, 0], f: 'paint' })),
          { g: new THREE.BoxGeometry(0.07, 3.6, 0.07), c: glowC, p: [x - Math.cos(a) * 0.36, 2.6, z - Math.sin(a) * 0.36], r, f: 'glow' },
          { g: new THREE.ConeGeometry(0.42, 0.7, 4), c: 0xD2D6DC, p: [x, 4.95, z], r: [0, Math.PI / 4, 0], f: 'metal' },
          // v7.1 detail: warm lit windows up the spire face and a riveted footing band.
          ...[2.0, 3.2].map((y) => ({ g: new THREE.BoxGeometry(0.16, 0.38, 0.06), c: 0xFFE2A8, p: [x - Math.cos(a) * 0.3, y, z - Math.sin(a) * 0.3], r, f: 'glow' })),
          { g: new THREE.BoxGeometry(1.18, 0.08, 1.18), c: 0x8A9098, p: [x, 0.62, z], r, f: 'metal' },
        ];
      }),
      // v7.1 detail: dressed-stone kerb blocks on the terrace edge, steel lips on each dais step, rivets round the reactor socket.
      ...Array.from({ length: 32 }, (_, i) => { const a = (i / 32) * Math.PI * 2 + 0.05; return { g: new THREE.BoxGeometry(0.85, 0.22, 0.3), c: i % 2 ? 0x6E675C : 0x57524A, p: [Math.cos(a) * 4.82, 0.11, Math.sin(a) * 4.82], r: [0, -a + Math.PI / 2, 0], f: 'stone' }; }),
      { g: new THREE.TorusGeometry(3.32, 0.05, 4, 48), c: 0x8A9098, p: [0, 0.62, 0], r: [Math.PI / 2, 0, 0], f: 'metal' },
      { g: new THREE.TorusGeometry(2.72, 0.05, 4, 48), c: 0x8A9098, p: [0, 0.9, 0], r: [Math.PI / 2, 0, 0], f: 'metal' },
      ...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return { g: new THREE.SphereGeometry(0.06, 5, 3), c: 0xD2D6DC, p: [Math.cos(a) * 1.32, 1.32, Math.sin(a) * 1.32], f: 'metal' }; }),
    ]);
    const dais = toonMesh(daisGeo, this.mat, 0);
    dais.receiveShadow = true;
    this.group.add(dais);

    this.body = new THREE.Group();
    this.crystal = toonMesh(new THREE.OctahedronGeometry(1.5, 0).scale(1, 1.55, 1), this.crystalMat, 0);
    this.inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0).scale(1, 1.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.main).lerp(new THREE.Color(0xffffff), 0.6).multiplyScalar(1.6), toneMapped: false }));
    this.crystal.add(this.inner);
    this.halo = makeHalo(c.main, 7);
    // Gyroscope bands around the crystal.
    const bandMat = toonMat({ color: 0xD2D6DC, metalness: 0.8, roughness: 0.3, emissive: c.main, emissiveIntensity: 0.35 });
    this.mats.push(bandMat);
    this.bands = [2.5, 2.9].map((r, i) => {
      const b = toonMesh(new THREE.TorusGeometry(r, 0.09, 6, 40), bandMat, 0);
      b.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.35);
      return b;
    });
    this.orbit = new THREE.Group();
    const shardGeo = new THREE.OctahedronGeometry(0.34).scale(1, 1.6, 1);
    for (let i = 0; i < 10; i++) {
      const s = toonMesh(shardGeo, this.crystalMat, 0);
      const a = (i / 10) * Math.PI * 2;
      s.position.set(Math.cos(a) * 3.3, Math.sin(i * 1.7) * 0.6, Math.sin(a) * 3.3);
      this.orbit.add(s);
    }
    this.body.add(this.crystal, this.halo, this.orbit, ...this.bands);
    // Spinning ground rune and a light pillar into the sky: readable from anywhere on screen.
    this.rune = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeTexture(), color: new THREE.Color(c.main).multiplyScalar(1.3), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.rune.position.y = 0.95;
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 24, 12, 1, true).translate(0, 12, 0), new THREE.MeshBasicMaterial({ color: c.main, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.pillar.position.y = CRYSTAL_Y;
    this.group.add(this.rune, this.pillar);
    this._ember = 0;
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(3.9, 24, 16), shieldMat(PAL.shield));
    this.shield.position.y = CRYSTAL_Y;
    this.group.add(this.body, this.shield);
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.hp = this.maxHp;
    this.alive = true;
    this.vulnerable = false;
    this.shielded = false;
    this.hurtAt = -99;
    this._shielded = true;
    this.pulsed = false;
    this.pulseT = 0;
    this.lastHp = this.hp;
    this.streak = 0;
    this.lastTgt = null;
    this.cd = 1;
    this.dying = 0;
    this.flash = 0;
    this.squash = 0;
    this.body.visible = true;
    this.pillar.visible = true;
    this.body.scale.setScalar(1);
    this.shield.visible = true;
  }

  update(dt, ctx) {
    tickHitFx(this, dt);
    if (this.flash > 0) this.hurtAt = ctx.time;
    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0) this.shatter();
    }
    if (!this.alive || ctx.over) return;
    if (this.pulseT > 0) this.pulseT -= dt;
    if (this.vulnerable && !this.pulsed && this.hp < this.lastHp) this._pulse(ctx);
    this.lastHp = this.hp;
    if ((this.cd -= dt) > 0) return;
    const tgt = defenderTarget(ctx, this, CORE.range);
    if (!tgt) return;
    this.cd = CORE.cd;
    let dmg = CORE.minionDmg;
    if (tgt.type === 'hero') { // consecutive shots on one hero ramp up to x2
      this.streak = this.lastTgt === tgt ? Math.min(4, this.streak + 1) : 0;
      dmg = (CORE.heroDmg + CORE.heroPct * tgt.maxHp) * Math.min(2, 1 + 0.25 * this.streak);
    } else this.streak = 0;
    this.lastTgt = tgt;
    ctx.projectiles.fire(this, tgt, dmg, 18, 1.2, GROUND + CRYSTAL_Y, { color: PAL.gold, size: 1.7 });
    bus.emit('towerShot', this);
    vfx.ring(this.x, GROUND + CRYSTAL_Y, this.z, PAL.gold, 2.4, 0.3);
  }

  // First hit after the nexus is exposed: a short shield (heavy damage cut) that also shoves attackers back.
  _pulse(ctx) {
    this.pulsed = true;
    this.pulseT = CORE.pulse;
    vfx.ring(this.x, GROUND + CRYSTAL_Y, this.z, PAL.shield, CORE.pulseR * 1.2, 0.7);
    vfx.ring(this.x, 0.3, this.z, PAL.gold, CORE.pulseR, 0.5);
    for (const h of ctx.heroes) {
      const dx = h.x - this.x, dz = h.z - this.z;
      if (h.team === this.team || !h.alive || Math.hypot(dx, dz) > CORE.pulseR) continue;
      shove(h, dx, dz, 4, 0.3);
      applyStatus(h, 'slow', 1.2);
    }
    bus.emit('corePulse', this);
  }

  shatter() {
    this.body.visible = false;
    this.shield.visible = false;
    this.pillar.visible = false;
    const y = GROUND + CRYSTAL_Y;
    poofStars(this.x, y, this.z, 50);
    particles.burst(this.x, y, this.z, 40, { color: [TEAM[this.team].main, PAL.gold, PAL.star], speed: 7, up: 6, size: 1.1, life: 1.4, frame: FRAME.star, grav: 6 });
    vfx.ring(this.x, 0.3, this.z, TEAM[this.team].main, 10, 0.8);
    vfx.ring(this.x, y, this.z, PAL.gold, 7, 0.6);
  }

  render(t) {
    const f = this.flash > 0 ? 1 : 0;
    for (const m of this.mats) m.userData.flash.value = f;
    const up = !this.vulnerable || this.pulseT > 0; // the bubble drops once both guardians fall, and flashes back during the pulse
    if (this.alive && this.shield.visible !== up) {
      this.shield.visible = up;
      if (!up) vfx.ring(this.x, GROUND + CRYSTAL_Y, this.z, PAL.shield, 6, 0.6);
    }
    if (!this.body.visible) return;
    const s = this.dying > 0 ? dyingScale(this) : 1, sq = this.squash * 0.1;
    this.body.scale.set(s * (1 + sq), s * (1 - sq), s * (1 + sq));
    this.body.position.y = CRYSTAL_Y + Math.sin(t * 1.6 + this.x) * 0.25;
    this.crystal.rotation.y = t * 0.8;
    this.inner.rotation.y = -t * 2.4;
    this.orbit.rotation.y = -t * 1.2;
    this.bands[0].rotation.z = t * 0.9;
    this.bands[1].rotation.z = -t * 0.7;
    this.rune.rotation.y = t * 0.25;
    this.rune.material.opacity = 0.55 + Math.sin(t * 2) * 0.2;
    this.pillar.material.opacity = 0.16 + Math.sin(t * 3 + this.x) * 0.06;
    if ((this._ember -= 1 / 60) <= 0) { // rising energy motes
      this._ember = HI ? 0.06 : 0.15;
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3;
      particles.emit(this.x + Math.cos(a) * r, 1, this.z + Math.sin(a) * r, 0, 2 + Math.random() * 2, 0, Math.random() < 0.3 ? 0xffffff : TEAM[this.team].main, 0.45, 1.4, FRAME.sparkle);
    }
    this.halo.position.y = 0;
  }
}
