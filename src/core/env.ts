// Environment probes. Raw getContext calls only: three logs to the console when a
// context cannot be created, and the fallback must be silent. Probe contexts are left
// to the garbage collector (loseContext() prints a console warning in Chrome).

export interface GpuCaps {
  webgl2: boolean;
  /** false when the browser would hand us a software or otherwise crippled context */
  performant: boolean;
  maxTextureSize: number;
}

export function probeGpu(): GpuCaps {
  const caps: GpuCaps = { webgl2: false, performant: false, maxTextureSize: 0 };
  const fast = tryContext(true);
  if (fast) {
    caps.webgl2 = caps.performant = true;
    caps.maxTextureSize = fast.getParameter(fast.MAX_TEXTURE_SIZE) as number;
    return caps;
  }
  const any = tryContext(false);
  if (any) {
    caps.webgl2 = true;
    caps.maxTextureSize = any.getParameter(any.MAX_TEXTURE_SIZE) as number;
  }
  return caps;
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
