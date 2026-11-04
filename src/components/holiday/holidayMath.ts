// FILE: src/components/holiday/holidayMath.ts
// Shared CPU math & noise utilities for holiday shaders, procedural meshes, and animation physics.

export const fract = (x: number) => x - Math.floor(x)

export const mix = (a: number, b: number, t: number) => a + (b - a) * t

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export const hash3 = (x: number, y: number, z: number) => {
  const px = fract(x * 0.3183099 + 0.1) * 17.0
  const py = fract(y * 0.3183099 + 0.1) * 17.0
  const pz = fract(z * 0.3183099 + 0.1) * 17.0
  return fract(px * py * pz * (px + py + pz))
}

