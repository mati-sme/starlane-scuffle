// The Core: floating energy crystal over a stepped reactor dais with conduit pylons, orbiting shards, fresnel shield bubble.
import * as THREE from 'three';
import { PAL, TEAM, CORE, GROUND } from '../config.js';
import { structSpot } from './arena.js';
import { toonMat, toonMesh, mergeParts, makeShadow, makeHalo } from '../render/toon.js';
import { particles, poofStars, FRAME } from '../render/particles.js';
import { vfx } from '../render/vfx.js';
import { tickHitFx, dyingScale } from '../game/combat.js';

const CRYSTAL_Y = 3.4;

const shieldMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uC: { value: new THREE.Color(color) } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main(){ vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uC; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(uC * f, f * 0.8);
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
    this.barY = 6.4;
    this.maxHp = CORE.hp;

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
    ]);
    const dais = toonMesh(daisGeo, this.mat, 0);
    dais.receiveShadow = true;
    this.group.add(dais);

    this.body = new THREE.Group();
    this.crystal = toonMesh(new THREE.IcosahedronGeometry(1.3, 0), this.crystalMat, 0);
    this.halo = makeHalo(c.main, 5);
    this.orbit = new THREE.Group();
    const shardGeo = new THREE.OctahedronGeometry(0.28);
    for (let i = 0; i < 6; i++) {
      const s = toonMesh(shardGeo, this.crystalMat, 0);
      const a = (i / 6) * Math.PI * 2;
      s.position.set(Math.cos(a) * 2.3, Math.sin(i * 1.7) * 0.4, Math.sin(a) * 2.3);
      this.orbit.add(s);
    }
    this.body.add(this.crystal, this.halo, this.orbit);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(3.3, 20, 14), shieldMat(PAL.shield));
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
    this.dying = 0;
    this.flash = 0;
    this.squash = 0;
    this.body.visible = true;
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
  }

  shatter() {
    this.body.visible = false;
    this.shield.visible = false;
    const y = GROUND + CRYSTAL_Y;
    poofStars(this.x, y, this.z, 50);
    particles.burst(this.x, y, this.z, 40, { color: [TEAM[this.team].main, PAL.gold, PAL.star], speed: 7, up: 6, size: 1.1, life: 1.4, frame: FRAME.star, grav: 6 });
    vfx.ring(this.x, 0.3, this.z, TEAM[this.team].main, 10, 0.8);
    vfx.ring(this.x, y, this.z, PAL.gold, 7, 0.6);
  }

  render(t) {
    const f = this.flash > 0 ? 1 : 0;
    for (const m of this.mats) m.userData.flash.value = f;
    if (this.shield.visible && this.vulnerable) { // shield drops (Starstorm or both towers down)
      this.shield.visible = false;
      vfx.ring(this.x, GROUND + CRYSTAL_Y, this.z, PAL.shield, 6, 0.6);
    }
    if (!this.body.visible) return;
    const s = this.dying > 0 ? dyingScale(this) : 1, sq = this.squash * 0.1;
    this.body.scale.set(s * (1 + sq), s * (1 - sq), s * (1 + sq));
    this.body.position.y = CRYSTAL_Y + Math.sin(t * 1.6 + this.x) * 0.25;
    this.crystal.rotation.y = t * 0.8;
    this.orbit.rotation.y = -t * 1.2;
    this.halo.position.y = 0;
  }
}
