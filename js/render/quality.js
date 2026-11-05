// One-time graphics tier: 'low' for software rasterizers (SwiftShader / llvmpipe, e.g. headless CI) and low-memory phones.
// Low drops the reflection environment and the shadow map (blob shadows remain) and tones metal down so it does not go black.
function detect() {
  const coarse = matchMedia('(pointer: coarse)').matches, mem = navigator.deviceMemory ?? 8;
  let soft = false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    soft = /swiftshader|llvmpipe|software|basic render/i.test(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* keep high */ }
  return soft || (coarse && mem <= 3) ? 'low' : 'high';
}

export const QUALITY = new URLSearchParams(location.search).get('gfx') ?? detect();
export const HI = QUALITY === 'high';
