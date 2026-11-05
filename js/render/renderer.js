// Renderer, scene, lights and dynamic resolution scaling.
import * as THREE from 'three';
import { PAL, CAM, BUDGET } from '../config.js';

export function createRenderer(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAL.fog, 70, 150);

  // Warm key, cool sky fill with an earthy bounce, and a soft cool rim from behind for silhouette separation.
  scene.add(new THREE.HemisphereLight(0xA9C2E6, 0x3A3328, 1.0));
  const sun = new THREE.DirectionalLight(0xFFDDB0, 2.0);
  sun.position.set(-0.5, 1, 0.3).multiplyScalar(50);
  const rim = new THREE.DirectionalLight(0x86A8E0, 0.5);
  rim.position.set(0.6, 0.5, -1).multiplyScalar(50);
  scene.add(sun, rim);

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.5, 700);

  let scale = 1, avg = 16.7, cool = 3;
  const gfx = {
    renderer, scene, camera, onResize: null,
    resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setPixelRatio(Math.min(dpr, BUDGET.dprMax) * scale);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      gfx.onResize?.();
    },
    // Rolling frame-time average drives resolution between scaleMin and 1.
    adapt(dt) {
      avg = avg * 0.95 + dt * 1000 * 0.05;
      cool -= dt;
      if (cool > 0) return;
      if (avg > 21 && scale > BUDGET.scaleMin) {
        scale = Math.max(BUDGET.scaleMin, scale - 0.1);
        cool = 3;
        gfx.resize();
      } else if (avg < 18 && scale < 1) {
        scale = Math.min(1, scale + 0.1);
        cool = 8;
        gfx.resize();
      }
    },
  };
  addEventListener('resize', gfx.resize);
  return gfx;
}
