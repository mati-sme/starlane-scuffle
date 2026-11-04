// Isometric-style follow camera with lead, damped motion, shake and a title-screen orbit.
import * as THREE from 'three';
import { CAM } from '../config.js';
import { clamp, damp } from '../core/math.js';

const OFFSET = new THREE.Vector3(...CAM.offset);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'orbit';
    this.target = null;       // anything with x / z (rx / rz preferred)
    this.focus = new THREE.Vector3(-47, 1.5, 0);
    this.lead = new THREE.Vector3();
    this.look = new THREE.Vector3().copy(this.focus);
    this.pos = new THREE.Vector3();
    this.zoom = 1;
    this.k = 30;
    this.angle = 0;
    this.amp = 0;
    this.t = 0;
    this._want = new THREE.Vector3();
  }

  orbit(x, y, z) {
    this.mode = 'orbit';
    this.focus.set(x, y, z);
    this.k = 3;
  }

  follow(target) {
    this.mode = 'follow';
    this.target = target;
    this.k = 3; // soft blend from whatever mode we were in
  }

  shake(a) { this.amp = Math.max(this.amp, a); }

  update(dt, aspect) {
    this.t += dt;
    this.k = damp(this.k, 30, 1.2, dt);
    const want = this._want;

    if (this.mode === 'orbit') {
      this.angle += dt * 0.25;
      want.set(this.focus.x + Math.cos(this.angle) * 13, 7.5, this.focus.z + Math.sin(this.angle) * 13);
      this.look.lerp(this.focus, 1 - Math.exp(-this.k * dt));
    } else if (this.target) {
      const tx = (this.target.rx ?? this.target.x) + this.lead.x * CAM.lead;
      const tz = (this.target.rz ?? this.target.z) + this.lead.z * CAM.lead;
      this.focus.x = damp(this.focus.x, tx, CAM.follow, dt);
      this.focus.z = damp(this.focus.z, tz, CAM.follow, dt);
      this.focus.y = 0.5;
      this.zoom = damp(this.zoom, clamp(CAM.wideAspect / aspect, 1, 1.4), 4, dt);
      want.copy(this.focus).addScaledVector(OFFSET, this.zoom);
      this.look.lerp(this.focus, 1 - Math.exp(-this.k * dt));
    }

    if (this.amp > 0.001) {
      const t = this.t * 45;
      want.x += (Math.sin(t) + Math.sin(t * 0.37 + 1.3)) * 0.5 * this.amp;
      want.z += (Math.sin(t * 1.21 + 2.1) + Math.sin(t * 0.53)) * 0.5 * this.amp;
      this.amp = Math.max(0, this.amp - dt * 1.2);
    }

    if (!this.ready) { // first frame: start in place instead of swooping from the origin
      this.pos.copy(want);
      this.look.copy(this.focus);
      this.ready = true;
    }
    this.pos.lerp(want, 1 - Math.exp(-this.k * dt));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
