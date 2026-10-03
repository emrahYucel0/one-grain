// Environment probes. Raw getContext calls only: three logs to the console when a
// context cannot be created, and the fallback must be silent. Probe contexts are left
// to the garbage collector (loseContext() prints a console warning in Chrome).

export interface GpuCaps {
  webgl2: boolean;
  /** false when the browser would hand us a software or otherwise crippled context */
  performant: boolean;
  maxTextureSize: number;
  /** GPU description, if the browser shares one (empty otherwise) */
  renderer: string;
}

export function probeGpu(): GpuCaps {
  const caps: GpuCaps = { webgl2: false, performant: false, maxTextureSize: 0, renderer: '' };
  const fast = tryContext(true);
  if (fast) {
    caps.webgl2 = caps.performant = true;
    caps.maxTextureSize = fast.getParameter(fast.MAX_TEXTURE_SIZE) as number;
    caps.renderer = rendererOf(fast);
    return caps;
  }
  const any = tryContext(false);
  if (any) {
    caps.webgl2 = true;
    caps.maxTextureSize = any.getParameter(any.MAX_TEXTURE_SIZE) as number;
  }
  return caps;
}

// Firefox answers RENDERER directly (and warns if asked through the debug extension);
// Chromium and Safari mask RENDERER and answer through the extension.
function rendererOf(gl: WebGL2RenderingContext): string {
  const plain = String(gl.getParameter(gl.RENDERER) ?? '');
  if (plain && !/^WebKit WebGL$/i.test(plain)) return plain;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : '';
}

function tryContext(failIfMajorPerformanceCaveat: boolean): WebGL2RenderingContext | null {
  try {
    return document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat });
  } catch {
    return null;
  }
}


const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');

export const env = {
  reduced: reducedQuery.matches,
  touchOnly: matchMedia('(hover: none)').matches,
};

reducedQuery.addEventListener('change', (e) => { env.reduced = e.matches; });
