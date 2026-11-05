// Renderer, scene, lights and dynamic resolution scaling.
// Filmic ACES grade, a baked room environment for metal reflections, and one soft shadow map that follows the camera focus.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PAL, CAM, BUDGET } from '../config.js';
import { HI } from './quality.js';

const SHADOW_R = 34; // half-size of the shadow frustum around the camera focus (covers the visible play area)

export function createRenderer(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Touch devices get a 1024 shadow map; plain PCF (4 taps, hardware-filtered) keeps the per-pixel cost mobile-friendly.
  const lowEnd = matchMedia('(pointer: coarse)').matches;
  const shadows = BUDGET.shadows && HI;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAL.fog, 75, 160);

  // Image-based ambient: a dim neutral room so painted metal and visors pick up soft highlights.
  if (HI) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    pmrem.dispose();
  }

  // Late-afternoon key, cool sky / warm ground bounce, and a cool back rim that separates silhouettes from the grass.
  scene.add(new THREE.HemisphereLight(0xB4CAEC, 0x3E3424, HI ? 0.85 : 1.05));
  const sun = new THREE.DirectionalLight(0xFFDDB2, 2.5);
  sun.position.set(-18, 40, 14);
  sun.castShadow = shadows;
  const size = lowEnd ? 1024 : 2048;
  sun.shadow.mapSize.set(size, size);
  Object.assign(sun.shadow.camera, { left: -SHADOW_R, right: SHADOW_R, top: SHADOW_R, bottom: -SHADOW_R, near: 1, far: 120 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  const sunOffset = sun.position.clone();
  const rim = new THREE.DirectionalLight(0x8FB4F0, 0.9);
  rim.position.set(0.6, 0.5, -1).multiplyScalar(50);
  scene.add(sun, sun.target, rim);

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.5, 700);

  let scale = 1, avg = 16.7, cool = 3, starved = 0;
  const texel = (SHADOW_R * 2) / size;
  const gfx = {
    renderer, scene, camera, sun, onResize: null,
    resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setPixelRatio(Math.min(dpr, BUDGET.dprMax) * scale);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      gfx.onResize?.();
    },
    // Snap the shadow frustum to the camera focus in whole texels so shadow edges do not shimmer while the camera glides.
    render(focus) {
      if (sun.castShadow && focus) {
        const x = Math.round(focus.x / texel) * texel, z = Math.round(focus.z / texel) * texel;
        sun.target.position.set(x, 0, z);
        sun.position.set(x, 0, z).add(sunOffset);
      }
      renderer.render(scene, camera);
    },
    // Rolling frame-time average drives resolution between scaleMin and 1; if it stays pinned at the floor, shadows go too.
    adapt(dt) {
      avg = avg * 0.95 + dt * 1000 * 0.05;
      cool -= dt;
      if (cool > 0) return;
      if (avg > 21 && scale > BUDGET.scaleMin) {
        scale = Math.max(BUDGET.scaleMin, scale - 0.1);
        cool = 3;
        gfx.resize();
      } else if (avg > 21 && sun.castShadow && ++starved >= 2) {
        sun.castShadow = false; // blob shadows remain underneath everything
        cool = 3;
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
