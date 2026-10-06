// The GPU names the tier rules know (core/quality.ts), matched against what WebGL reports as the
// renderer (WEBGL_debug_renderer_info, or RENDERER where the browser answers it directly). One place
// to keep current: a new chip family only needs a pattern here.

/**
 * What privacy settings report instead of the GPU: nothing, the browser's generic name (Firefox's
 * resistFingerprinting says "Mozilla"), or a stock placeholder. A randomised name matches none of the
 * families below either. Both mean: not known, so mid.
 */
export const HIDDEN = /^(|webkit webgl|webkit|mozilla|generic renderer|unknown|disabled|not available|renderer)$/i;

/** Software renderers: no GPU at all. The only case for the low tier besides texture limits. */
export const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|microsoft basic render|basic render driver|software rasterizer|mesa offscreen/i;

/**
 * Discrete desktop and laptop GPUs: NVIDIA (every GeForce, RTX, Quadro), AMD's Radeon RX and Pro
 * cards, Intel Arc A-series cards. Integrated graphics (Intel UHD / Iris, AMD "Radeon Graphics" or
 * Radeon 7x0M, Intel Arc "Graphics" in Core Ultra) do not match and stay on mid.
 */
export const DISCRETE = /nvidia|geforce|quadro|\brtx\b|radeon(\(tm\))? (rx|pro)\b|arc(\(tm\))? a\d{3}/i;

/**
 * Apple Silicon by name (Chromium and Firefox: "Apple M1", "Apple M3 Pro"…). Safari only says
 * "Apple GPU" on every Mac, and there ASTC texture support tells Apple Silicon from Intel (core/env.ts).
 */
export const APPLE_SILICON = /apple m\d/i;
/** Safari's masked name for any Apple GPU. */
export const APPLE_GPU = /^apple gpu$/i;

/**
 * Android tablets that get the high tier: recent high-end GPU families (2022 on).
 *   Qualcomm Adreno 730 and up (Snapdragon 8 Gen 1 →), Arm Mali-G710 and up and Immortalis
 *   (Dimensity 9000 →, Tensor G2 →), Samsung Xclipse (Exynos 2200 →).
 */
export const HIGH_END_TABLET = /adreno\D*(7[3-9]\d|[89]\d\d)\b|mali-g(7[1-9]\d|9\d\d)\b|immortalis|xclipse/i;
