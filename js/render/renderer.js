// Renderer, scene, lights, post and dynamic resolution scaling.
// Filmic ACES grade, a baked outdoor sky environment for PBR reflections, one soft shadow map that follows the camera focus,
// and on the high tier a light post chain (HDR bloom on the glow parts, then contrast / warmth / vignette).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PAL, CAM, BUDGET } from '../config.js';
import { HI } from './quality.js';

const SHADOW_R = 34; // half-size of the shadow frustum around the camera focus (covers the visible play area)

// Outdoor light probe: blue zenith, warm hazy horizon, green-brown ground bounce and a hot sun disc where the key light sits.
function skyEnvironment(renderer, sunDir) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; varying vec3 vD;
      void main() {
        vec3 d = normalize(vD);
        vec3 sky = mix(vec3(0.86, 0.80, 0.72), vec3(0.26, 0.40, 0.70), smoothstep(0.0, 0.55, d.y));
        vec3 ground = mix(vec3(0.34, 0.33, 0.27), vec3(0.12, 0.16, 0.11), smoothstep(0.0, -0.4, d.y));
        vec3 c = d.y > 0.0 ? sky : ground;
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.86, 0.62) * (pow(s, 220.0) * 30.0 + pow(s, 8.0) * 0.5);
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return tex;
}

// Final grade in display space (v7.2): a filmic S-curve with a lifted toe so shadows keep detail, split toning (cool shadows,
// warm highlights), slightly restrained saturation for a less candy look, and a soft vignette.
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.38);
      col = col * 0.965 + 0.022;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 0.96);
      col *= mix(vec3(0.94, 0.99, 1.06), vec3(1.04, 1.0, 0.95), smoothstep(0.15, 0.7, l));
      vec2 q = vUv - 0.5;
      col *= mix(1.0, 0.72, smoothstep(0.30, 0.85, dot(q, q) * 2.2));
      gl_FragColor = vec4(col, c.a);
    }`,
};

export function createRenderer(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 2, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = HI ? 0.97 : 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Touch devices get a 1024 PCF map (4 taps, hardware-filtered); desktops get the softer PCF-soft filter on 2048.
  const lowEnd = matchMedia('(pointer: coarse)').matches;
  const shadows = BUDGET.shadows && HI;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = lowEnd ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Aerial haze: the far side of the island softens toward a cool blue before it reaches the void.
  scene.fog = new THREE.Fog(HI ? 0x46546C : PAL.fog, HI ? 54 : 75, HI ? 190 : 160); // v7.2: deeper slate haze

  // Late-afternoon key, cool fill from the opposite side, cool back rim that separates silhouettes from the grass.
  const sunDir = new THREE.Vector3(HI ? -26 : -18, HI ? 34 : 40, HI ? 18 : 14).normalize(); // high tier: lower sun, longer modeling shadows
  if (HI) {
    scene.environment = skyEnvironment(renderer, sunDir);
    scene.environmentIntensity = 0.7;
  }
  // v7.2: less ambient fill and a cleaner, stronger key give the forms more modeling (less flat toy plastic).
  scene.add(new THREE.HemisphereLight(0xA8C0E0, 0x3A3224, HI ? 0.55 : 0.9));
  const sun = new THREE.DirectionalLight(0xFFE0B8, HI ? 3.1 : 2.6);
  sun.position.copy(sunDir).multiplyScalar(45);
  sun.castShadow = shadows;
  const size = lowEnd ? 1024 : 2048;
  sun.shadow.mapSize.set(size, size);
  Object.assign(sun.shadow.camera, { left: -SHADOW_R, right: SHADOW_R, top: SHADOW_R, bottom: -SHADOW_R, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  const sunOffset = sun.position.clone();
  const fill = new THREE.DirectionalLight(0x8FAAD8, HI ? 0.45 : 0.3);
  fill.position.set(22, 18, -10);
  const rim = new THREE.DirectionalLight(0x9CBCF0, HI ? 1.3 : 1.0);
  rim.position.set(0.6, 0.5, -1).multiplyScalar(50);
  scene.add(sun, sun.target, fill, rim);

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.5, 700);

  // High tier: HDR multisampled target -> bloom (only real emitters cross the threshold) -> tone map -> grade.
  let composer = null;
  if (HI) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: dpr < 2 ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    if (!lowEnd) composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 0.92));
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GradeShader));
  }

  let scale = 1, avg = 16.7, cool = 3, starved = 0;
  const texel = (SHADOW_R * 2) / size;
  const gfx = {
    renderer, scene, camera, sun, onResize: null, post: !!composer,
    resize() {
      const w = innerWidth, h = innerHeight, pr = Math.min(dpr, BUDGET.dprMax) * scale;
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
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
      if (gfx.post) composer.render();
      else renderer.render(scene, camera);
    },
    // Rolling frame-time average drives resolution between scaleMin and 1; if it stays pinned at the floor, post goes, then shadows.
    adapt(dt) {
      avg = avg * 0.95 + dt * 1000 * 0.05;
      cool -= dt;
      if (cool > 0) return;
      if (avg > 21 && scale > BUDGET.scaleMin) {
        scale = Math.max(BUDGET.scaleMin, scale - 0.1);
        cool = 3;
        gfx.resize();
      } else if (avg > 21 && gfx.post) {
        gfx.post = false; // plain render: tone mapping moves back onto the canvas pass
        cool = 3;
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
