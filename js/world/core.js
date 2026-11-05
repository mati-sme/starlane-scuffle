// The Core: floating crystal over a ring dais, orbiting shards, fresnel shield bubble.
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

    this.mat = toonMat({ vertexColors: true });
    this.crystalMat = toonMat({ color: c.main, emissive: c.main, emissiveIntensity: 0.5 });
    this.mats = [this.mat, this.crystalMat];

    const daisGeo = mergeParts([
      { g: new THREE.CylinderGeometry(3.1, 3.3, 0.25, 16), c: PAL.cliffDark, p: [0, 0.12, 0] },
      { g: new THREE.CylinderGeometry(2.6, 2.9, 0.5, 16), c: PAL.cliffLight, p: [0, 0.3, 0] },
      ...Array.from({ length: 6 }, (_, i) => { // steel pylons ringing the dais
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return { g: new THREE.BoxGeometry(0.32, 1.3, 0.32), c: 0x5A606A, p: [Math.cos(a) * 2.75, 0.75, Math.sin(a) * 2.75], r: [0, -a, 0] };
      }),
      { g: new THREE.TorusGeometry(2.3, 0.16, 6, 24), c: c.main, p: [0, 0.55, 0], r: [Math.PI / 2, 0, 0] },
      { g: new THREE.CylinderGeometry(1.0, 1.4, 0.4, 12), c: c.deep, p: [0, 0.6, 0] },
    ]);
    this.group.add(toonMesh(daisGeo, this.mat));

    this.body = new THREE.Group();
    this.crystal = toonMesh(new THREE.IcosahedronGeometry(1.3, 0), this.crystalMat);
    this.halo = makeHalo(c.main, 5);
    this.orbit = new THREE.Group();
    const shardGeo = new THREE.OctahedronGeometry(0.28);
    for (let i = 0; i < 6; i++) {
      const s = toonMesh(shardGeo, this.crystalMat, 0.02);
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
