// FILE: src/components/HolidayEffects.tsx
import { useMemo, useRef, useEffect, useState, useLayoutEffect, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScroll, useGLTF, useAnimations, useFont, Text3D } from '@react-three/drei'
import * as THREE from 'three'
import { useHoliday, getUpcomingYear, isMajorHoliday, isMinorHoliday } from '../utils/holiday'
import { getSectionOffsets, getTotalPages } from '../ScrollManager'
import { computeLocalBoundingBox } from './HolidayHat'

// ---------------------------------------------------------------------------
// BAKED SNOW MATERIAL & SHAPE PARAMETERS
// ---------------------------------------------------------------------------

const SNOW_STYLE = {
  crestColor: '#c4cdd6',
  midColor: '#9aa8b8',
  shadowColor: '#687a8f',
  tintColor: '#ffffff',
  brightness: 1.31,
  shadeContrast: 1.45,
  roughness: 0.23,
  metalness: 0.0,
  envMapIntensity: 0.0,
  flatShading: false,
  driftHeight: 0.9,
  patchiness: 0.39,
  patchScale: 1.2,
  capThickness: 0.06,
  capDroop: 0.04
} as const

// ---------------------------------------------------------------------------
// 1. CPU 3D NOISE & MATH HELPERS
// ---------------------------------------------------------------------------

const fract = (x: number) => x - Math.floor(x)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

const hash3 = (x: number, y: number, z: number) => {
  const px = fract(x * 0.3183099 + 0.1) * 17.0
  const py = fract(y * 0.3183099 + 0.1) * 17.0
  const pz = fract(z * 0.3183099 + 0.1) * 17.0
  return fract(px * py * pz * (px + py + pz))
}

const noise3D = (x: number, y: number, z: number) => {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * (3.0 - 2.0 * fx)
  const uy = fy * fy * (3.0 - 2.0 * fy)
  const uz = fz * fz * (3.0 - 2.0 * fz)

  const n000 = hash3(ix, iy, iz)
  const n100 = hash3(ix + 1, iy, iz)
  const n010 = hash3(ix, iy + 1, iz)
  const n110 = hash3(ix + 1, iy + 1, iz)
  const n001 = hash3(ix, iy, iz + 1)
  const n101 = hash3(ix + 1, iy, iz + 1)
  const n011 = hash3(ix, iy + 1, iz + 1)
  const n111 = hash3(ix + 1, iy + 1, iz + 1)

  const nx00 = mix(n000, n100, ux)
  const nx10 = mix(n010, n110, ux)
  const nx01 = mix(n001, n101, ux)
  const nx11 = mix(n011, n111, ux)

  const nxy0 = mix(nx00, nx10, uy)
  const nxy1 = mix(nx01, nx11, uy)

  return mix(nxy0, nxy1, uz)
}

const fbm3D = (x: number, y: number, z: number, octaves = 3) => {
  let v = 0.0
  let a = 0.5
  let px = x
  let py = y
  let pz = z
  for (let i = 0; i < octaves; i++) {
    v += a * noise3D(px, py, pz)
    px = px * 2.02 + 100.0
    py = py * 2.02 + 100.0
    pz = pz * 2.02 + 100.0
    a *= 0.5
  }
  return v
}

/**
 * Computes baked vertex colors on a snow BufferGeometry using its vertex normals
 * and vertical factor.
 */
const applySnowContourVertexColors = (
  geo: THREE.BufferGeometry,
  heightFactors?: Float32Array
) => {
  const posAttr = geo.getAttribute('position')
  const normAttr = geo.getAttribute('normal')
  if (!posAttr || !normAttr) return

  const count = posAttr.count
  let colorAttr = geo.getAttribute('color') as THREE.BufferAttribute | undefined
  if (!colorAttr || colorAttr.count !== count) {
    colorAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    geo.setAttribute('color', colorAttr)
  }
  const colors = colorAttr.array as Float32Array

  const cShadow = new THREE.Color(SNOW_STYLE.shadowColor)
  const cMid = new THREE.Color(SNOW_STYLE.midColor)
  const cCrest = new THREE.Color(SNOW_STYLE.crestColor)
  const brightness = SNOW_STYLE.brightness
  const contrast = SNOW_STYLE.shadeContrast

  // Key light direction matching Experience.tsx directionalLight [5, 10, 5]
  const lx = 0.408, ly = 0.816, lz = 0.408

  for (let i = 0; i < count; i++) {
    const nx = normAttr.getX(i)
    const ny = normAttr.getY(i)
    const nz = normAttr.getZ(i)

    const ndotl = clamp((nx * lx + ny * ly + nz * lz) * 0.5 + 0.5, 0, 1)
    const sky = clamp(ny * 0.5 + 0.5, 0, 1)
    const hFactor = heightFactors ? clamp(heightFactors[i], 0, 1) : 0.7

    let shade = ndotl * 0.55 + sky * 0.20 + hFactor * 0.25
    shade = clamp((shade - 0.55) * contrast + 0.55, 0, 1)

    let r: number, g: number, b: number
    if (shade < 0.55) {
      const t = shade / 0.55
      r = mix(cShadow.r, cMid.r, t)
      g = mix(cShadow.g, cMid.g, t)
      b = mix(cShadow.b, cMid.b, t)
    } else {
      const t = (shade - 0.55) / 0.45
      r = mix(cMid.r, cCrest.r, t)
      g = mix(cMid.g, cCrest.g, t)
      b = mix(cMid.b, cCrest.b, t)
    }

    colors[i * 3 + 0] = r * brightness
    colors[i * 3 + 1] = g * brightness
    colors[i * 3 + 2] = b * brightness
  }

  colorAttr.needsUpdate = true
}

// ---------------------------------------------------------------------------
// 2. TOP-DOWN SKY-PROJECTED 3D SNOWCAP BUILDER (with Patchy Dropout)
// ---------------------------------------------------------------------------

export interface SnowCapOptions {
  /** Minimum upward normal Y on the highest sky-visible surface (default 0.72) */
  minNormalY?: number
  /** Minimum normalized height [0..1] within the mesh bounding box (default 0.58) */
  minHeightFraction?: number
  /** Peak vertical thickness of the 3D snow pillow in local units (default 0.06) */
  thickness?: number
  /** How far the snow lip droops down at the rim (default 0.04) */
  droop?: number
  /** Spatial frequency of the 3D snowdrift bumps (default 4.5) */
  noiseScale?: number
  /** Number of grid cells to dilate outward for overhanging eaves (default 2) */
  overhangCells?: number
  /** Fraction [0..0.75] of snow to drop out in organic patches (default 0.39) */
  patchiness?: number
  /** Spatial frequency of the patchy dropout mask (default 1.2) */
  patchScale?: number
}

export const build3DSnowCapGeometry = (
  sourceGeo: THREE.BufferGeometry,
  options: SnowCapOptions = {}
): THREE.BufferGeometry => {
  const minNormalY = options.minNormalY ?? 0.72
  const minHeightFraction = options.minHeightFraction ?? 0.58
  const thickness = options.thickness ?? SNOW_STYLE.capThickness
  const droop = options.droop ?? SNOW_STYLE.capDroop
  const noiseScale = options.noiseScale ?? 4.5
  const overhangCells = options.overhangCells ?? 2
  const patchiness = options.patchiness ?? SNOW_STYLE.patchiness
  const patchScale = options.patchScale ?? SNOW_STYLE.patchScale

  const posAttr = sourceGeo.getAttribute('position')
  if (!posAttr || posAttr.count === 0) return new THREE.BufferGeometry()

  sourceGeo.computeBoundingBox()
  const bb = sourceGeo.boundingBox!
  const widthX = bb.max.x - bb.min.x
  const heightY = bb.max.y - bb.min.y
  const depthZ = bb.max.z - bb.min.z
  if (widthX <= 1e-5 || heightY <= 1e-5 || depthZ <= 1e-5) {
    return new THREE.BufferGeometry()
  }

  const cellSize = clamp(heightY * 0.022, 0.006, 0.03)
  const pad = cellSize * (overhangCells + 3)
  const originX = bb.min.x - pad
  const originZ = bb.min.z - pad
  const nx = Math.ceil((widthX + pad * 2) / cellSize) + 1
  const nz = Math.ceil((depthZ + pad * 2) / cellSize) + 1
  const totalCells = nx * nz

  const skyY = new Float32Array(totalCells).fill(-Infinity)
  const skyNormalY = new Float32Array(totalCells).fill(-1)

  const indexAttr = sourceGeo.getIndex()
  const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const fn = new THREE.Vector3()

  // 1. Rasterize all triangles from straight above (+Y -> -Y)
  for (let i = 0; i < triCount; i++) {
    const i0 = indexAttr ? indexAttr.getX(i * 3 + 0) : i * 3 + 0
    const i1 = indexAttr ? indexAttr.getX(i * 3 + 1) : i * 3 + 1
    const i2 = indexAttr ? indexAttr.getX(i * 3 + 2) : i * 3 + 2

    vA.fromBufferAttribute(posAttr, i0)
    vB.fromBufferAttribute(posAttr, i1)
    vC.fromBufferAttribute(posAttr, i2)

    e1.subVectors(vB, vA)
    e2.subVectors(vC, vA)
    fn.crossVectors(e1, e2)
    const len = fn.length()
    if (len < 1e-8) continue
    fn.divideScalar(len)

    const denom = (vB.z - vC.z) * (vA.x - vC.x) + (vC.x - vB.x) * (vA.z - vC.z)
    if (Math.abs(denom) < 1e-8) continue
    const invDenom = 1.0 / denom

    const minTx = Math.min(vA.x, vB.x, vC.x)
    const maxTx = Math.max(vA.x, vB.x, vC.x)
    const minTz = Math.min(vA.z, vB.z, vC.z)
    const maxTz = Math.max(vA.z, vB.z, vC.z)

    const ix0 = clamp(Math.floor((minTx - originX) / cellSize), 0, nx - 1)
    const ix1 = clamp(Math.ceil((maxTx - originX) / cellSize), 0, nx - 1)
    const iz0 = clamp(Math.floor((minTz - originZ) / cellSize), 0, nz - 1)
    const iz1 = clamp(Math.ceil((maxTz - originZ) / cellSize), 0, nz - 1)

    for (let ix = ix0; ix <= ix1; ix++) {
      const gx = originX + ix * cellSize
      for (let iz = iz0; iz <= iz1; iz++) {
        const gz = originZ + iz * cellSize

        const w0 = ((vB.z - vC.z) * (gx - vC.x) + (vC.x - vB.x) * (gz - vC.z)) * invDenom
        const w1 = ((vC.z - vA.z) * (gx - vC.x) + (vA.x - vC.x) * (gz - vC.z)) * invDenom
        const w2 = 1.0 - w0 - w1

        if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) {
          const y = w0 * vA.y + w1 * vB.y + w2 * vC.y
          const cellIdx = ix * nz + iz
          if (y > skyY[cellIdx] + 0.002) {
            skyY[cellIdx] = y
            skyNormalY[cellIdx] = fn.y
          } else if (Math.abs(y - skyY[cellIdx]) <= 0.002 && fn.y > skyNormalY[cellIdx]) {
            skyY[cellIdx] = Math.max(y, skyY[cellIdx])
            skyNormalY[cellIdx] = fn.y
          }
        }
      }
    }
  }

  // 2. Build core snow mask with patchy dropout
  const minAllowedY = bb.min.y + heightY * minHeightFraction
  const rawMask = new Uint8Array(totalCells)
  for (let ix = 0; ix < nx; ix++) {
    const gx = originX + ix * cellSize
    for (let iz = 0; iz < nz; iz++) {
      const gz = originZ + iz * cellSize
      const i = ix * nz + iz
      if (skyY[i] >= minAllowedY && skyNormalY[i] >= minNormalY) {
        if (patchiness > 0.01) {
          const pNoise = fbm3D(
            gx * patchScale + 13.7,
            skyY[i] * patchScale * 1.5,
            gz * patchScale * 0.7 + 4.2,
            3
          )
          if (pNoise < patchiness) continue
        }
        rawMask[i] = 1
      }
    }
  }

  // 3. Morphological cleanup
  const coreMask = new Uint8Array(totalCells)
  for (let ix = 1; ix < nx - 1; ix++) {
    for (let iz = 1; iz < nz - 1; iz++) {
      const idx = ix * nz + iz
      if (!rawMask[idx]) continue
      let neighbors = 0
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (rawMask[(ix + dx) * nz + (iz + dz)]) neighbors++
        }
      }
      if (neighbors >= 5) coreMask[idx] = 1
    }
  }

  // 4. Dilate outward by `overhangCells` and propagate `baseY`
  let activeMask = new Uint8Array(coreMask)
  let baseY = new Float32Array(totalCells)
  for (let i = 0; i < totalCells; i++) {
    baseY[i] = coreMask[i] ? skyY[i] : 0
  }

  for (let step = 0; step < overhangCells; step++) {
    const nextMask = new Uint8Array(activeMask)
    const nextY = new Float32Array(baseY)
    for (let ix = 1; ix < nx - 1; ix++) {
      for (let iz = 1; iz < nz - 1; iz++) {
        const idx = ix * nz + iz
        if (activeMask[idx]) continue
        let sumY = 0
        let count = 0
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) continue
            const nIdx = (ix + dx) * nz + (iz + dz)
            if (activeMask[nIdx]) {
              sumY += baseY[nIdx]
              count++
            }
          }
        }
        if (count >= 2) {
          nextMask[idx] = 1
          nextY[idx] = sumY / count
        }
      }
    }
    activeMask = nextMask
    baseY = nextY
  }

  for (let pass = 0; pass < 2; pass++) {
    const smoothedY = new Float32Array(baseY)
    for (let ix = 1; ix < nx - 1; ix++) {
      for (let iz = 1; iz < nz - 1; iz++) {
        const idx = ix * nz + iz
        if (!activeMask[idx]) continue
        let sumY = baseY[idx] * 2
        let w = 2
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const nIdx = (ix + dx) * nz + (iz + dz)
            if (activeMask[nIdx]) {
              sumY += baseY[nIdx]
              w += 1
            }
          }
        }
        smoothedY[idx] = sumY / w
      }
    }
    baseY = smoothedY
  }

  // 5. Smooth 2D dome profile via 4 passes of 3x3 smoothing on `activeMask`
  let domeField = new Float32Array(totalCells)
  for (let i = 0; i < totalCells; i++) {
    domeField[i] = activeMask[i] ? 1.0 : 0.0
  }
  for (let pass = 0; pass < 4; pass++) {
    const nextField = new Float32Array(totalCells)
    for (let ix = 1; ix < nx - 1; ix++) {
      for (let iz = 1; iz < nz - 1; iz++) {
        const idx = ix * nz + iz
        if (!activeMask[idx]) continue
        let sum = 0
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            sum += domeField[(ix + dx) * nz + (iz + dz)]
          }
        }
        nextField[idx] = sum / 9.0
      }
    }
    domeField = nextField
  }

  // 6. Assign vertex indices to active grid nodes
  const vertIndexMap = new Int32Array(totalCells).fill(-1)
  const activeNodes: [number, number][] = []
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const idx = ix * nz + iz
      if (activeMask[idx]) {
        vertIndexMap[idx] = activeNodes.length
        activeNodes.push([ix, iz])
      }
    }
  }

  const numV = activeNodes.length
  if (numV === 0) return new THREE.BufferGeometry()

  const snowTris: [number, number, number][] = []
  for (let ix = 0; ix < nx - 1; ix++) {
    for (let iz = 0; iz < nz - 1; iz++) {
      const v00 = vertIndexMap[ix * nz + iz]
      const v10 = vertIndexMap[(ix + 1) * nz + iz]
      const v11 = vertIndexMap[(ix + 1) * nz + (iz + 1)]
      const v01 = vertIndexMap[ix * nz + (iz + 1)]

      if (v00 !== -1 && v10 !== -1 && v11 !== -1 && v01 !== -1) {
        snowTris.push([v00, v01, v11])
        snowTris.push([v00, v11, v10])
      } else if (v00 !== -1 && v01 !== -1 && v11 !== -1) {
        snowTris.push([v00, v01, v11])
      } else if (v00 !== -1 && v11 !== -1 && v10 !== -1) {
        snowTris.push([v00, v11, v10])
      } else if (v00 !== -1 && v01 !== -1 && v10 !== -1) {
        snowTris.push([v00, v01, v10])
      } else if (v01 !== -1 && v11 !== -1 && v10 !== -1) {
        snowTris.push([v01, v11, v10])
      }
    }
  }

  if (snowTris.length === 0) return new THREE.BufferGeometry()

  const directed = new Set<string>()
  for (let i = 0; i < snowTris.length; i++) {
    const [a, b, c] = snowTris[i]
    directed.add(`${a}_${b}`)
    directed.add(`${b}_${c}`)
    directed.add(`${c}_${a}`)
  }

  const boundaryEdges: [number, number][] = []
  const isBoundary = new Uint8Array(numV)
  const outX = new Float32Array(numV)
  const outZ = new Float32Array(numV)

  for (let i = 0; i < snowTris.length; i++) {
    const [a, b, c] = snowTris[i]
    const edges: [number, number][] = [
      [a, b],
      [b, c],
      [c, a]
    ]
    for (const [u, v] of edges) {
      if (!directed.has(`${v}_${u}`)) {
        boundaryEdges.push([u, v])
        isBoundary[u] = 1
        isBoundary[v] = 1
        const ux = activeNodes[u][0], uz = activeNodes[u][1]
        const vx = activeNodes[v][0], vz = activeNodes[v][1]
        const nxEdge = vz - uz
        const nzEdge = -(vx - ux)
        outX[u] += nxEdge
        outZ[u] += nzEdge
        outX[v] += nxEdge
        outZ[v] += nzEdge
      }
    }
  }

  for (let i = 0; i < numV; i++) {
    if (isBoundary[i]) {
      const len = Math.hypot(outX[i], outZ[i])
      if (len > 1e-5) {
        outX[i] /= len
        outZ[i] /= len
      }
    }
  }

  // 7. Build 3 vertex layers (Top dome, Mid rounded lip, Bottom tucked base)
  const totalVerts = numV * 3
  const positions = new Float32Array(totalVerts * 3)
  const heightFactors = new Float32Array(totalVerts)

  for (let i = 0; i < numV; i++) {
    const [ix, iz] = activeNodes[i]
    const cellIdx = ix * nz + iz
    const gx = originX + ix * cellSize
    const gz = originZ + iz * cellSize
    const by = baseY[cellIdx]

    const dome = clamp(domeField[cellIdx], 0, 1)
    const shapedDome = Math.pow(dome, 0.55)
    const nVal = 0.72 + 0.58 * fbm3D(gx * noiseScale, by * noiseScale, gz * noiseScale, 3)
    const dripN = fbm3D(gx * noiseScale * 2.2 + 19.0, by * noiseScale, gz * noiseScale * 2.2, 2)

    const topH = isBoundary[i]
      ? thickness * 0.24 * nVal
      : thickness * (0.30 + 0.80 * shapedDome) * nVal
    positions[i * 3 + 0] = gx
    positions[i * 3 + 1] = by + topH
    positions[i * 3 + 2] = gz
    heightFactors[i] = 0.45 + 0.55 * shapedDome

    const lipOut = cellSize * 0.65 * (0.85 + 0.3 * nVal)
    const midH = thickness * 0.06 * nVal - droop * 0.25 * dripN
    positions[(numV + i) * 3 + 0] = gx + outX[i] * lipOut
    positions[(numV + i) * 3 + 1] = by + midH
    positions[(numV + i) * 3 + 2] = gz + outZ[i] * lipOut
    heightFactors[numV + i] = 0.28

    const botDroop = isBoundary[i] ? -droop * (0.55 + 0.75 * dripN) : -0.004
    const botIn = -cellSize * 0.25
    positions[(2 * numV + i) * 3 + 0] = gx + outX[i] * botIn
    positions[(2 * numV + i) * 3 + 1] = by + botDroop
    positions[(2 * numV + i) * 3 + 2] = gz + outZ[i] * botIn
    heightFactors[2 * numV + i] = 0.08
  }

  const outIndices: number[] = []

  for (let i = 0; i < snowTris.length; i++) {
    const [a, b, c] = snowTris[i]
    outIndices.push(a, b, c)
  }

  for (let i = 0; i < boundaryEdges.length; i++) {
    const [u, v] = boundaryEdges[i]
    const topU = u, topV = v
    const midU = numV + u, midV = numV + v
    const botU = 2 * numV + u, botV = 2 * numV + v

    outIndices.push(topU, midU, midV)
    outIndices.push(topU, midV, topV)

    outIndices.push(midU, botU, botV)
    outIndices.push(midU, botV, midV)
  }

  for (let i = 0; i < snowTris.length; i++) {
    const [a, b, c] = snowTris[i]
    outIndices.push(2 * numV + c, 2 * numV + b, 2 * numV + a)
  }

  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  snowGeo.setIndex(outIndices)
  snowGeo.computeVertexNormals()
  applySnowContourVertexColors(snowGeo, heightFactors)

  return snowGeo
}

/**
 * Watches a target `<Text3D>` Mesh ref and renders a 3D sky-projected snowcap mesh on its peaks.
 */
export const SnowCapOverlay = ({
  targetRef,
  options,
  deps = []
}: {
  targetRef: React.RefObject<THREE.Mesh | null>
  options?: SnowCapOptions
  deps?: any[]
}) => {
  const { holiday } = useHoliday()
  const [snowGeo, setSnowGeo] = useState<THREE.BufferGeometry | null>(null)

  const thicknessScale = (options?.thickness ?? 0.06) / 0.06
  const droopScale = (options?.droop ?? 0.024) / 0.024

  useLayoutEffect(() => {
    if (holiday !== 'winter') {
      setSnowGeo(null)
      return
    }

    let cancelled = false
    let attempts = 0

    const tryBuild = () => {
      if (cancelled) return
      const mesh = targetRef.current
      if (mesh && mesh.geometry && mesh.geometry.getAttribute('position')?.count > 0) {
        const built = build3DSnowCapGeometry(mesh.geometry, {
          ...options,
          patchiness: SNOW_STYLE.patchiness,
          patchScale: SNOW_STYLE.patchScale,
          thickness: SNOW_STYLE.capThickness * thicknessScale,
          droop: SNOW_STYLE.capDroop * droopScale
        })
        setSnowGeo((prev) => {
          if (prev) prev.dispose()
          return built
        })
      } else if (attempts < 20) {
        attempts++
        requestAnimationFrame(tryBuild)
      }
    }

    tryBuild()

    return () => {
      cancelled = true
    }
  }, [holiday, targetRef, thicknessScale, droopScale, ...deps])

  useEffect(() => {
    return () => {
      if (snowGeo) snowGeo.dispose()
    }
  }, [snowGeo])

  if (holiday !== 'winter' || !snowGeo) return null

  return (
    <mesh geometry={snowGeo} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        color={SNOW_STYLE.tintColor}
        roughness={SNOW_STYLE.roughness}
        metalness={SNOW_STYLE.metalness}
        envMapIntensity={SNOW_STYLE.envMapIntensity}
        flatShading={SNOW_STYLE.flatShading}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 3. PROCEDURAL 3D SNOW GROUND (Baked Parameters)
// ---------------------------------------------------------------------------

export const ProceduralSnowGround = ({ floorHeight = -2 }: { floorHeight?: number }) => {
  const { holiday } = useHoliday()
  const scroll = useScroll()
  const totalPages = getTotalPages()
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const snowTerrainGeo = useMemo(() => {
    const size = 68
    const segs = 180
    const geo = new THREE.PlaneGeometry(size, size, segs, segs)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.getAttribute('position')
    const hFactors = new Float32Array(pos.count)

    const clearZones: [number, number, number][] = [
      [1.45, 0.0, 1.15],    // Intro: g1_lay
      [-2.7, 0.07, 1.15],   // Intro: g1_sit_loop
      [3.5, -3.34, 1.25],   // Intro: run_pose
      [-3.5, -4.0, 1.25],   // Intro: sit_loop
      [1.38, 1.8, 0.95],    // Intro: jacks
      [0.0, 0.8, 1.75]      // Center RobotRig path
    ]

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const distFromOrigin = Math.hypot(x, z)

      const nLarge = fbm3D(x * 0.18 + 2.3, 0.0, z * 0.28 + 6.1, 3)
      const nMed = noise3D(x * 0.55 + 11.0, 0.0, z * 0.75 + 4.0) * 0.35
      const ridgeRaw = 1.0 - Math.abs(noise3D(x * 0.32 - 4.0, 0.0, z * 0.45 + 9.0) * 2.0 - 1.0)
      const ridge = ridgeRaw * ridgeRaw * 0.28

      const raw = nLarge * 0.75 + nMed + ridge

      let clearingFactor = 1.0
      for (const [cx, cz, rad] of clearZones) {
        const d = Math.hypot(x - cx, z - cz)
        clearingFactor *= smoothstep(rad * 0.4, rad * 1.35, d)
      }

      const farFade = 1.0 - smoothstep(16.0, 32.0, distFromOrigin)
      const height = (raw - 0.38) * 0.88 * clearingFactor * farFade - (1.0 - clearingFactor) * 0.06
      pos.setY(i, height > 0 ? height * SNOW_STYLE.driftHeight : height)
      hFactors[i] = smoothstep(0.0, 0.26, Math.max(0, height))
    }

    pos.needsUpdate = true
    geo.computeVertexNormals()
    applySnowContourVertexColors(geo, hFactors)
    return geo
  }, [])

  useEffect(() => {
    return () => {
      snowTerrainGeo.dispose()
    }
  }, [snowTerrainGeo])

  const baseTint = useMemo(() => new THREE.Color(SNOW_STYLE.tintColor), [])

  useFrame(() => {
    if (!scroll || !matRef.current) return
    const totalScrollUnits = totalPages - 1
    const currentScrollPages = scroll.offset * totalScrollUnits
    const { startPage: turntableStart } = getSectionOffsets('turntable')

    let dimProgress = 0
    if (currentScrollPages > turntableStart - 1.0) {
      dimProgress = THREE.MathUtils.clamp((currentScrollPages - (turntableStart - 1.0)) / 1.0, 0, 1)
    }
    const dimFactor = 1.0 - 0.92 * dimProgress
    matRef.current.color.copy(baseTint).multiplyScalar(dimFactor)
  })

  if (holiday !== 'winter') return null

  return (
    <mesh
      position={[0, floorHeight, 0]}
      geometry={snowTerrainGeo}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial
        ref={matRef}
        vertexColors
        color={SNOW_STYLE.tintColor}
        roughness={SNOW_STYLE.roughness}
        metalness={SNOW_STYLE.metalness}
        envMapIntensity={SNOW_STYLE.envMapIntensity}
        flatShading={SNOW_STYLE.flatShading}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 4. 3D HOLIDAY PARTICLES (Snowfall / Halloween Embers / New Year Sparkles)
// ---------------------------------------------------------------------------

export const HolidayParticles = ({ count = 900 }: { count?: number }) => {
  const { holiday } = useHoliday()
  const pointsRef = useRef<THREE.Points>(null)
  const isMajor = isMajorHoliday(holiday)

  const { positions, phases, speeds, colors } = useMemo(() => {
    if (!isMajor) {
      return {
        positions: new Float32Array(0),
        phases: new Float32Array(0),
        speeds: new Float32Array(0),
        colors: new Float32Array(0)
      }
    }

    const pos = new Float32Array(count * 3)
    const ph = new Float32Array(count)
    const sp = new Float32Array(count)
    const col = new Float32Array(count * 3)

    const c1 = new THREE.Color()
    const c2 = new THREE.Color()
    const cMix = new THREE.Color()

    if (holiday === 'halloween') {
      c1.set('#ff5500')
      c2.set('#a832ff')
    } else if (holiday === 'newyear') {
      c1.set('#ffd700')
      c2.set('#fff6cc')
    } else if (holiday === 'easter') {
      c1.set('#ffb7d5') // Sakura pink
      c2.set('#bbf2c0') // Spring mint
    } else {
      c1.set('#ffffff')
      c2.set('#dceeff')
    }

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 28
      pos[i * 3 + 1] = Math.random() * 14 - 3
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 2

      ph[i] = Math.random() * Math.PI * 2
      sp[i] = 0.5 + Math.random() * 1.1

      cMix.lerpColors(c1, c2, Math.random())
      col[i * 3 + 0] = cMix.r
      col[i * 3 + 1] = cMix.g
      col[i * 3 + 2] = cMix.b
    }

    return { positions: pos, phases: ph, speeds: sp, colors: col }
  }, [count, holiday])

  const shaderMaterial = useMemo(() => {
    const isWinter = holiday === 'winter'
    const isEaster = holiday === 'easter'
    const uMode = isEaster ? 2.0 : isWinter ? 1.0 : 0.0

    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: holiday === 'winter' ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: holiday === 'winter' ? 22.0 : holiday === 'easter' ? 24.0 : 26.0 },
        uMode: { value: uMode }
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSpeed;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uSize;
        uniform float uMode;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = aColor;
          vec3 p = position;

          float heightRange = 16.0;
          float minY = -3.0;

          if (uMode > 1.5) {
            // Easter: gentle blossom petal drift downward with soft horizontal flutter
            float yOffset = mod(p.y - minY - uTime * aSpeed * 0.55, heightRange);
            p.y = minY + yOffset;
            p.x += sin(uTime * 1.1 + aPhase) * 0.65 + cos(uTime * 0.4 + aPhase * 2.0) * 0.25;
            p.z += cos(uTime * 0.85 + aPhase * 1.4) * 0.45;
            vAlpha = 0.75 + 0.25 * sin(uTime * 2.5 + aPhase * 2.0);
          } else if (uMode > 0.5) {
            // Winter snowfall
            float yOffset = mod(p.y - minY - uTime * aSpeed * 1.1, heightRange);
            p.y = minY + yOffset;
            p.x += sin(uTime * 0.8 + aPhase) * 0.45;
            p.z += cos(uTime * 0.65 + aPhase * 1.3) * 0.35;
            vAlpha = 0.85;
          } else {
            // Halloween embers / New Year sparkles rising
            float yOffset = mod(p.y - minY + uTime * aSpeed * 0.75, heightRange);
            p.y = minY + yOffset;
            p.x += sin(uTime * 1.1 + aPhase) * 0.35;
            p.z += cos(uTime * 0.9 + aPhase) * 0.35;
            vAlpha = 0.55 + 0.45 * sin(uTime * 4.0 + aPhase * 3.0);
          }

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (0.65 + 0.35 * sin(aPhase)) * (10.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;

          float radial = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(vColor, radial * vAlpha);
        }
      `
    })
  }, [holiday])

  useEffect(() => {
    return () => {
      shaderMaterial.dispose()
    }
  }, [shaderMaterial])

  useFrame((state) => {
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime
  })

  if (!holiday || !isMajor) return null

  return (
    <points ref={pointsRef} material={shaderMaterial} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
    </points>
  )
}

// ---------------------------------------------------------------------------
// 5. HOLIDAY SCENE PROPS (Christmas Tree, Snowman, Jack-o'-lantern, Year Neon)
// ---------------------------------------------------------------------------

const CHRISTMAS_TREE_PATH = '/assets/misc/christmas_tree_2.glb'
const SNOWMAN_PATH = '/assets/misc/snowman_-_low_poly.glb'
const SLEIGH_PATH = '/assets/misc/sleigh.glb'
const JACK_OLANTERN_PATH = '/assets/misc/jack_olantern.glb'
const NEON_FONT_URL = '/fonts/Concert One_Regular.json'
const DEFAULT_NEON_FONT_URL = '/fonts/Montserrat_Regular.json'

/**
 * Shared 3D Neon Sign component (used for the "@ Stanford" subtitle in IntroSection
 * and the upcoming year sign in NewYearNeonSignProp).
 */
export const NeonSign = ({
  text,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  intensity,
  size,
  fontUrl = DEFAULT_NEON_FONT_URL,
  withPointLight = false,
  flicker = false
}: any) => {
  const bevel = (0.01 / 0.12) * size
  const frontZ = (0.02 / 0.12) * size
  const emissiveMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    if (!flicker) return
    const t = state.clock.elapsedTime
    // Subtle electrical hum + intermittent neon tube double-blink / stutter
    const cycle = t % 4.7
    let dip = 1.0
    if (cycle > 1.80 && cycle < 1.86) {
      dip = 0.20
    } else if (cycle > 1.91 && cycle < 1.96) {
      dip = 0.45
    } else if (cycle > 3.60 && cycle < 3.65) {
      dip = 0.35
    }
    const hum = 0.94 + 0.06 * Math.sin(t * 29.0) + 0.03 * Math.cos(t * 53.0)
    const factor = Math.max(0.1, hum * dip)
    if (emissiveMatRef.current) {
      emissiveMatRef.current.emissiveIntensity = intensity * factor
    }
    if (lightRef.current) {
      lightRef.current.intensity = intensity * 0.8 * factor
    }
  })

  return (
    <group position={position} rotation={rotation}>
      {withPointLight && (
        <pointLight
          ref={lightRef}
          position={[size * 1.2, size * 0.5, size * 0.8]}
          intensity={intensity * 0.8}
          color={color}
          distance={8}
          decay={2}
        />
      )}
      {/* 1. The Black Backing */}
      <Text3D
        font={fontUrl}
        size={size}
        height={size / 5}
        bevelEnabled
        bevelSize={bevel}
        bevelThickness={bevel}
        castShadow
      >
        {text}
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
      </Text3D>

      {/* 2. The Emissive Front Layer (slightly offset forward) */}
      <group position={[0, 0, frontZ]}>
        <Text3D
          font={fontUrl}
          size={size}
          height={size / 6}
        >
          {text}
          <meshStandardMaterial
            ref={emissiveMatRef}
            color="black"
            emissive={color}
            emissiveIntensity={intensity}
            toneMapped={false}
          />
        </Text3D>
      </group>
    </group>
  )
}

/**
 * Registers support for legacy Sketchfab `KHR_materials_pbrSpecularGlossiness`
 * materials on Three.js `GLTFLoader` so diffuse textures and metallic specular
 * colors load properly on `christmas_tree_2.glb` and `jack_olantern.glb`.
 */
const registerSpecGlossExtension = (loader: any) => {
  loader.register((parser: any) => ({
    name: 'KHR_materials_pbrSpecularGlossiness',
    extendMaterialParams: async (materialIndex: number, materialParams: any) => {
      const matDef = parser.json.materials?.[materialIndex]
      const ext = matDef?.extensions?.KHR_materials_pbrSpecularGlossiness
      if (!ext) return

      materialParams.color = new THREE.Color(1, 1, 1)
      materialParams.opacity = 1.0

      const df = ext.diffuseFactor
      const sf = ext.specularFactor
      const maxS = Array.isArray(sf) ? Math.max(sf[0], sf[1], sf[2]) : 0

      if (Array.isArray(df)) {
        const maxD = Math.max(df[0], df[1], df[2])
        if (maxD < 0.05 && maxS > 0.2 && Array.isArray(sf)) {
          // Pure metallic conductor in SpecGloss (black diffuse, colored specular, e.g. Golden_Star)
          materialParams.color.setRGB(sf[0], sf[1], sf[2], THREE.LinearSRGBColorSpace)
          materialParams.metalness = 0.85
          materialParams.roughness = clamp(1.0 - (ext.glossinessFactor ?? 0.8), 0.1, 0.9)
        } else if (maxS < 0.02) {
          // Zero specular in SpecGloss (e.g. Pine_Needles, Tinsel, Bark, Green_Material) -> matte
          materialParams.color.setRGB(df[0], df[1], df[2], THREE.LinearSRGBColorSpace)
          materialParams.opacity = df[3] ?? 1.0
          materialParams.metalness = 0.0
          materialParams.roughness = 0.9
        } else {
          materialParams.color.setRGB(df[0], df[1], df[2], THREE.LinearSRGBColorSpace)
          materialParams.opacity = df[3] ?? 1.0
          materialParams.metalness = clamp(maxS * 0.5, 0.04, 0.8)
          materialParams.roughness = clamp(1.0 - (ext.glossinessFactor ?? 0.5) * 0.7, 0.12, 0.9)
        }
      } else {
        materialParams.metalness = 0.04
        materialParams.roughness = 0.75
      }

      if (ext.diffuseTexture !== undefined) {
        if (Array.isArray(df) && Math.max(df[0], df[1], df[2]) < 0.5) {
          materialParams.color.setRGB(0.85, 0.85, 0.85)
        }
        await parser.assignTexture(materialParams, 'map', ext.diffuseTexture, THREE.SRGBColorSpace)
      }
    }
  }))
}

// Preload all holiday prop assets & fonts at module load time so switching themes
// via the theme bar never triggers a late Suspense that disrupts scene calibration.
useGLTF.preload(CHRISTMAS_TREE_PATH, true, true, registerSpecGlossExtension)
useGLTF.preload(SNOWMAN_PATH, true, true, registerSpecGlossExtension)
useGLTF.preload(SLEIGH_PATH, true, true)
useGLTF.preload(JACK_OLANTERN_PATH, true, true, registerSpecGlossExtension)
useFont.preload(NEON_FONT_URL)

/**
 * Helper hook that clones a loaded GLTF scene, enables shadows, and computes
 * an automatic local-space AABB normalization transform so `scale = 1.0` equals
 * 1.0 unit tall with the base resting at `y = 0` and centered at `x = 0, z = 0`.
 */
const useNormalizedGLTFProp = (
  path: string,
  innerRotationY = 0,
  enhanceMaterials?: (mesh: THREE.Mesh) => void
) => {
  const { scene } = useGLTF(path, true, true, registerSpecGlossExtension)

  return useMemo(() => {
    const cloned = scene.clone(true)
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (mesh.material && !Array.isArray(mesh.material)) {
          mesh.material = mesh.material.clone()
        }
        if (enhanceMaterials) {
          enhanceMaterials(mesh)
        }
      }
    })

    const rotWrapper = new THREE.Group()
    const rotInner = new THREE.Group()
    rotInner.rotation.y = innerRotationY
    rotInner.add(cloned)
    rotWrapper.add(rotInner)

    const box = computeLocalBoundingBox(rotWrapper)
    rotInner.remove(cloned)

    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const unitScale = size.y > 0.0001 ? 1.0 / size.y : 1.0
    const offset: [number, number, number] = [
      -center.x * unitScale,
      -box.min.y * unitScale,
      -center.z * unitScale
    ]

    return { cloned, unitScale, offset }
  }, [scene, innerRotationY, enhanceMaterials])
}

const TREE_MATERIAL_PARAMS = {
  foliageRoughness: 1.00,
  foliageMetalness: 0.00,
  foliageEnvIntensity: 0.42,
  greenBranchColor: '#135918',
  needleTint: '#95f0a7',
  needleAlphaCutoff: 0.72,
  foliageReceiveShadow: true,
  woodRoughness: 1.00,
  woodMetalness: 0.00,
  woodEnvIntensity: 1.00,
  barrelTint: '#6e5a4f',
  baubleRoughness: 0.06,
  baubleMetalness: 0.78,
  baubleEnvIntensity: 1.25,
  glassBaubleOpacity: 0.17,
  lightsEmissiveIntensity: 6.20,
  starEmissiveIntensity: 3.00
} as const

const ChristmasTreeProp = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    CHRISTMAS_TREE_PATH,
    0
  )

  useEffect(() => {
    const matCtrl = TREE_MATERIAL_PARAMS
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      const mat = mesh.material as THREE.MeshStandardMaterial
      if (!mat || !mat.name) return
      const name = mat.name.toLowerCase()

      if (
        name === 'pine_needles' ||
        name === 'tinsel_material' ||
        name === 'green_material'
      ) {
        mat.roughness = matCtrl.foliageRoughness
        mat.metalness = matCtrl.foliageMetalness
        mat.envMapIntensity = matCtrl.foliageEnvIntensity
        mesh.receiveShadow = matCtrl.foliageReceiveShadow

        if (name === 'green_material') {
          mat.color.set(matCtrl.greenBranchColor)
        } else {
          mat.color.set(matCtrl.needleTint)
          mat.alphaTest = matCtrl.needleAlphaCutoff
        }
        mat.needsUpdate = true
      } else if (
        name.includes('barrel') ||
        name.includes('earth') ||
        name.includes('bark') ||
        name.includes('wood') ||
        name === 'material'
      ) {
        mat.roughness = matCtrl.woodRoughness
        mat.metalness = matCtrl.woodMetalness
        mat.envMapIntensity = matCtrl.woodEnvIntensity
        if (name.includes('barrel') || name.includes('earth')) {
          mat.color.set(matCtrl.barrelTint)
        }
        mat.needsUpdate = true
      } else if (
        name.includes('bauble') ||
        name.includes('metal_material') ||
        name.includes('golden_star')
      ) {
        mat.roughness = matCtrl.baubleRoughness
        mat.metalness = matCtrl.baubleMetalness
        mat.envMapIntensity = matCtrl.baubleEnvIntensity
        if (name.includes('transparent_bauble')) {
          mat.transparent = true
          mat.opacity = matCtrl.glassBaubleOpacity
          mesh.castShadow = matCtrl.glassBaubleOpacity > 0.25
        }
        if (name.includes('golden_star')) {
          mat.emissive = new THREE.Color('#ffae00')
          mat.emissiveIntensity = matCtrl.starEmissiveIntensity
        }
        mat.needsUpdate = true
      } else if (name.includes('blue_light')) {
        mat.emissive = new THREE.Color('#2080ff')
        mat.emissiveIntensity = matCtrl.lightsEmissiveIntensity
        mat.needsUpdate = true
      } else if (name.includes('green_blue_light') || name.includes('green_light')) {
        mat.emissive = new THREE.Color('#30ff70')
        mat.emissiveIntensity = matCtrl.lightsEmissiveIntensity
        mat.needsUpdate = true
      } else if (name.includes('light_emission') || name.includes('light_glass')) {
        mat.emissive = new THREE.Color('#ff5520')
        mat.emissiveIntensity = matCtrl.lightsEmissiveIntensity * 1.1
        mat.needsUpdate = true
      }
    })
  }, [cloned])

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

const SnowmanProp = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  // Rotate -90 deg in inner space so carrot nose (+X in raw GLB) faces +Z (camera) at rotY=0
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    SNOWMAN_PATH,
    -Math.PI / 2
  )

  // Random tilt about X and Z so the snowman isn't perfectly vertical
  const [tiltX, tiltZ] = useMemo(() => {
    const signX = Math.random() < 0.5 ? -1 : 1
    const signZ = Math.random() < 0.5 ? -1 : 1
    const magX = 0.06 + Math.random() * 0.11 // ~3.5° to 10°
    const magZ = 0.06 + Math.random() * 0.11
    return [signX * magX, signZ * magZ]
  }, [])

  return (
    <group position={position} rotation={[tiltX, rotationY, tiltZ]} scale={scale}>
      <group position={offset} scale={unitScale}>
        <group rotation={[0, -Math.PI / 2, 0]}>
          <primitive object={cloned} />
        </group>
      </group>
    </group>
  )
}

/**
 * Set to `true` during testing so the sleigh flies across the main screen continuously
 * without random cooldown intervals between passes.
 */
const SLEIGH_TEST_CONTINUOUS_LOOP = false

type SleighPathArchetype = 'skyArch' | 'diagonalSwoop' | 'ascendingClimb' | 'sCurveSweep'

interface SleighFlightPass {
  phase: 'flying' | 'cooldown'
  archetype: SleighPathArchetype
  timer: number
  duration: number
  startX: number
  endX: number
  startY: number
  endY: number
  startZ: number
  endZ: number
  arcZ: number
  waveAmpZ: number
  waveFreqZ: number
  archY: number
  waveAmpY: number
  waveFreqY: number
  scale: number
  passCount: number
}

const SLEIGH_TRAIL_COUNT = 100

const sleighTrailVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (115.0 / max(1.0, -mvPosition.z));
  }
`

const sleighTrailFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    if (vAlpha <= 0.005) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    // Soft, subtle core + delicate star shimmer
    float core = exp(-d * d * 32.0) * 0.75;
    float halo = smoothstep(0.5, 0.0, d) * 0.35;
    float crossSpark = max(
      exp(-abs(uv.x) * 30.0) * exp(-abs(uv.y) * 8.0),
      exp(-abs(uv.y) * 30.0) * exp(-abs(uv.x) * 8.0)
    ) * 0.35;
    float intensity = core + halo + crossSpark;

    gl_FragColor = vec4(vColor * intensity * 1.15, clamp(intensity * vAlpha * 0.45, 0.0, 1.0));
  }
`

/**
 * Animated sleigh pulled by 3 robot dogs with a walk cycle (`sleigh.glb`),
 * accompanied by a subtle stardust particle trail and multiple 3D flight paths.
 */
const FlyingSleighProp = () => {
  const outerGroupRef = useRef<THREE.Group>(null)
  const pitchRollGroupRef = useRef<THREE.Group>(null)
  const trailGeoRef = useRef<THREE.BufferGeometry>(null)

  const { scene, animations } = useGLTF(SLEIGH_PATH, true, true)

  // Apply all static 2-keyframe tracks (such as Santa's sitting pose in 'Action.001')
  // directly to the scene nodes once on load, and return only the active (>2 keyframe)
  // dog walk-cycle tracks (excluding the duplicate 0.83s 'dogAction' NLA clip).
  const optimizedAnimations = useMemo(() => {
    if (!animations || animations.length === 0) return animations
    const hasIndividualDogClips = animations.some((c) => c.name === 'Action.002')

    animations.forEach((clip) => {
      if (hasIndividualDogClips && clip.name === 'dogAction') return
      clip.tracks.forEach((track) => {
        if (track.times.length <= 2) {
          const binding = THREE.PropertyBinding.create(scene, track.name)
          if (binding) {
            binding.setValue(track.values, 0)
          }
        }
      })
    })

    return animations
      .filter((clip) => !(hasIndividualDogClips && clip.name === 'dogAction'))
      .map((clip) => {
        const activeTracks = clip.tracks.filter((track) => track.times.length > 2)
        return new THREE.AnimationClip(clip.name, clip.duration, activeTracks)
      })
      .filter((clip) => clip.tracks.length > 0)
  }, [scene, animations])

  const { actions } = useAnimations(optimizedAnimations, scene)

  // Raw GLB sleigh height is ~10.1 units and team midpoint is around x = -10.85, y = 5.05.
  // Normalizing by 1 / 10.1 makes outer scale=1.0 equal to 1.0 world unit of sleigh height.
  const unitScale = 1 / 10.1
  const centerOffset: [number, number, number] = [10.85 * unitScale, -5.05 * unitScale, 0]

  useEffect(() => {
    // 1. Replace heavy MeshPhysicalMaterial (created by KHR_materials_specular / ior)
    //    with lightweight MeshStandardMaterial across the meshes, and share them by reference.
    const convertedMaterials = new Map<THREE.Material, THREE.MeshStandardMaterial>()
    // 2. Deduplicate Skeletons across SkinnedMeshes sharing the same root bone
    //    (cuts skeleton.update() calls from 26/frame down to 4/frame).
    const sharedSkeletonsByRootBone = new Map<THREE.Bone, THREE.Skeleton>()

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = false
        mesh.receiveShadow = false
        mesh.frustumCulled = false

        if (mesh.material && !Array.isArray(mesh.material)) {
          const origMat = mesh.material as THREE.MeshStandardMaterial
          if ((origMat as any).isMeshPhysicalMaterial) {
            let stdMat = convertedMaterials.get(origMat)
            if (!stdMat) {
              stdMat = new THREE.MeshStandardMaterial({
                name: origMat.name,
                color: origMat.color,
                map: origMat.map,
                roughness: origMat.roughness,
                metalness: origMat.metalness,
                roughnessMap: origMat.roughnessMap,
                metalnessMap: origMat.metalnessMap,
                normalMap: origMat.normalMap
              })
              convertedMaterials.set(origMat, stdMat)
            }
            mesh.material = stdMat
          }
        }

        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          const skinned = mesh as THREE.SkinnedMesh
          const rootBone = skinned.skeleton?.bones?.[0]
          if (rootBone) {
            let sharedSkel = sharedSkeletonsByRootBone.get(rootBone)
            if (!sharedSkel) {
              sharedSkel = skinned.skeleton
              sharedSkeletonsByRootBone.set(rootBone, sharedSkel)
            } else {
              skinned.bind(sharedSkel, skinned.bindMatrix)
            }
          }
        }
      }
    })

    if (actions) {
      Object.values(actions).forEach((action) => {
        if (action) {
          action.reset()
          action.setLoop(THREE.LoopRepeat, Infinity)
          action.timeScale = 1.35
          action.play()
        }
      })
    }
  }, [scene, actions])

  // Particle trail state arrays
  const trail = useMemo(() => {
    const positions = new Float32Array(SLEIGH_TRAIL_COUNT * 3)
    const velocities = new Float32Array(SLEIGH_TRAIL_COUNT * 3)
    const colors = new Float32Array(SLEIGH_TRAIL_COUNT * 3)
    const sizes = new Float32Array(SLEIGH_TRAIL_COUNT)
    const alphas = new Float32Array(SLEIGH_TRAIL_COUNT)
    const ages = new Float32Array(SLEIGH_TRAIL_COUNT)
    const lifetimes = new Float32Array(SLEIGH_TRAIL_COUNT)
    const phases = new Float32Array(SLEIGH_TRAIL_COUNT)

    for (let i = 0; i < SLEIGH_TRAIL_COUNT; i++) {
      positions[i * 3 + 1] = -9999
      alphas[i] = 0
      ages[i] = 999
      lifetimes[i] = 1.0
    }

    return {
      positions,
      velocities,
      colors,
      sizes,
      alphas,
      ages,
      lifetimes,
      phases,
      head: 0,
      spawnAccum: 0
    }
  }, [])

  const trailPalette = useMemo(
    () => [
      new THREE.Color('#ffd700'), // Warm gold
      new THREE.Color('#fff2b2'), // Champagne sparkle
      new THREE.Color('#d6f0ff'), // Icy starlight
      new THREE.Color('#ffae42')  // Amber glow
    ],
    []
  )

  const flight = useMemo<SleighFlightPass>(() => ({
    phase: 'flying',
    archetype: 'skyArch',
    timer: 0,
    duration: 7.2,
    startX: 11.8,
    endX: -11.8,
    startY: 1.55,
    endY: 1.65,
    startZ: -3.6,
    endZ: -4.4,
    arcZ: 0.8,
    waveAmpZ: 0.0,
    waveFreqZ: 1.5,
    archY: 0.55,
    waveAmpY: 0.20,
    waveFreqY: 2.3,
    scale: 0.68,
    passCount: 0
  }), [])

  const configureNextPass = (f: SleighFlightPass) => {
    f.phase = 'flying'
    f.timer = 0
    f.passCount += 1

    const archetypes: SleighPathArchetype[] = [
      'skyArch',
      'diagonalSwoop',
      'ascendingClimb',
      'sCurveSweep'
    ]
    const archetype = archetypes[f.passCount % archetypes.length]
    f.archetype = archetype

    // Alternate left-to-right and right-to-left (with occasional variation)
    const leftToRight = f.passCount % 2 === 1
    const dir = leftToRight ? 1 : -1

    if (archetype === 'skyArch') {
      // Classic high arch across the upper sky
      const spanX = 12.0
      f.duration = 7.0 + Math.random() * 1.0
      f.startX = -dir * spanX
      f.endX = dir * spanX
      f.startY = 1.35 + Math.random() * 0.35
      f.endY = 1.35 + Math.random() * 0.35
      f.startZ = -3.4 - Math.random() * 1.8
      f.endZ = -3.4 - Math.random() * 1.8
      f.arcZ = (Math.random() - 0.5) * 1.2
      f.waveAmpZ = 0.0
      f.waveFreqZ = 1.5
      f.archY = 0.65 + Math.random() * 0.30
      f.waveAmpY = 0.16 + Math.random() * 0.08
      f.waveFreqY = 2.2 + Math.random() * 0.5
    } else if (archetype === 'diagonalSwoop') {
      // Swoops from high & deep in the background down closer across the midground
      const spanX = 13.0
      f.duration = 7.4 + Math.random() * 1.0
      f.startX = -dir * spanX
      f.endX = dir * (spanX - 1.0)
      f.startY = 2.85 + Math.random() * 0.45
      f.endY = 1.15 + Math.random() * 0.35
      f.startZ = -8.2 - Math.random() * 1.5
      f.endZ = -2.3 - Math.random() * 0.8
      f.arcZ = 0.85
      f.waveAmpZ = 0.25
      f.waveFreqZ = 1.6
      f.archY = -0.25
      f.waveAmpY = 0.18
      f.waveFreqY = 2.4
    } else if (archetype === 'ascendingClimb') {
      // Enters lower behind the scene and climbs steeply into the upper sky
      const spanX = 12.2
      f.duration = 7.2 + Math.random() * 1.0
      f.startX = -dir * spanX
      f.endX = dir * spanX
      f.startY = 0.55 + Math.random() * 0.30
      f.endY = 2.75 + Math.random() * 0.45
      f.startZ = -3.6 - Math.random() * 1.0
      f.endZ = -6.8 - Math.random() * 1.5
      f.arcZ = -0.6
      f.waveAmpZ = 0.0
      f.waveFreqZ = 1.5
      f.archY = 0.30
      f.waveAmpY = 0.15
      f.waveFreqY = 2.5
    } else {
      // Banking S-curve weaving in depth across the sky
      const spanX = 12.4
      f.duration = 7.8 + Math.random() * 1.0
      f.startX = -dir * spanX
      f.endX = dir * spanX
      f.startY = 1.65 + Math.random() * 0.35
      f.endY = 1.85 + Math.random() * 0.35
      f.startZ = -4.2
      f.endZ = -4.2
      f.arcZ = 0.0
      f.waveAmpZ = 1.45
      f.waveFreqZ = (2.0 * Math.PI) / f.duration
      f.archY = 0.35
      f.waveAmpY = 0.22
      f.waveFreqY = 2.1
    }
  }

  const spawnRunnerParticle = (
    worldX: number,
    worldY: number,
    worldZ: number,
    sleighVx: number,
    sleighVy: number,
    sleighVz: number
  ) => {
    const idx = trail.head
    trail.head = (trail.head + 1) % SLEIGH_TRAIL_COUNT

    trail.positions[idx * 3 + 0] = worldX + (Math.random() - 0.5) * 0.14
    trail.positions[idx * 3 + 1] = worldY + (Math.random() - 0.5) * 0.10
    trail.positions[idx * 3 + 2] = worldZ + (Math.random() - 0.5) * 0.14

    // Slight backward wake + gentle upward/outward magic drift
    trail.velocities[idx * 3 + 0] = -sleighVx * 0.08 + (Math.random() - 0.5) * 0.45
    trail.velocities[idx * 3 + 1] = -sleighVy * 0.06 - 0.12 + (Math.random() - 0.35) * 0.38
    trail.velocities[idx * 3 + 2] = -sleighVz * 0.08 + (Math.random() - 0.5) * 0.45

    const c = trailPalette[Math.floor(Math.random() * trailPalette.length)]
    trail.colors[idx * 3 + 0] = c.r
    trail.colors[idx * 3 + 1] = c.g
    trail.colors[idx * 3 + 2] = c.b

    trail.sizes[idx] = 0.35 + Math.random() * 0.45
    trail.alphas[idx] = 1.0
    trail.ages[idx] = 0.0
    trail.lifetimes[idx] = 0.75 + Math.random() * 0.55
    trail.phases[idx] = Math.random() * Math.PI * 2
  }

  const tmpRunnerLeft = useMemo(() => new THREE.Vector3(), [])
  const tmpRunnerRight = useMemo(() => new THREE.Vector3(), [])
  const tmpLocalToSection = useMemo(() => new THREE.Matrix4(), [])

  useFrame((state, rawDelta) => {
    const outer = outerGroupRef.current
    const pitchRoll = pitchRollGroupRef.current
    if (!outer || !pitchRoll) return

    const dt = Math.min(rawDelta, 0.05)
    const elapsed = state.clock.elapsedTime

    if (flight.phase === 'flying') {
      outer.visible = true
      flight.timer += dt
      const t = flight.timer
      const T = flight.duration
      const p = clamp(t / T, 0, 1)

      // 3D position along active flight archetype
      const x = mix(flight.startX, flight.endX, p)
      const z =
        mix(flight.startZ, flight.endZ, p) +
        Math.sin(p * Math.PI) * flight.arcZ +
        Math.sin(t * flight.waveFreqZ) * flight.waveAmpZ
      const y =
        mix(flight.startY, flight.endY, p) +
        Math.sin(p * Math.PI) * flight.archY +
        Math.sin(t * flight.waveFreqY) * flight.waveAmpY

      // Analytical velocity (dx/dt, dy/dt, dz/dt)
      const vx = (flight.endX - flight.startX) / T
      const vz =
        (flight.endZ - flight.startZ) / T +
        (Math.PI / T) * Math.cos(p * Math.PI) * flight.arcZ +
        flight.waveFreqZ * Math.cos(t * flight.waveFreqZ) * flight.waveAmpZ
      const vy =
        (flight.endY - flight.startY) / T +
        (Math.PI / T) * Math.cos(p * Math.PI) * flight.archY +
        flight.waveFreqY * Math.cos(t * flight.waveFreqY) * flight.waveAmpY

      const speedXZ = Math.max(0.001, Math.hypot(vx, vz))

      // In sleigh.glb's local space, the robot dogs pull toward -X.
      const yaw = Math.atan2(vz, -vx)

      // Pitch around local Z: negative rotation.z lifts the -X nose upward when vy > 0
      const climbPitch = -Math.atan2(vy, speedXZ) * 0.75
      const gallopNod = Math.sin(t * 5.4) * 0.035
      const pitchZ = climbPitch + gallopNod

      // Aerial banking roll around forward -X axis
      const turnBank = -flight.waveAmpZ * Math.sin(t * flight.waveFreqZ) * 0.12
      const rollX = Math.sin(t * 1.9) * 0.065 + turnBank

      outer.position.set(x, y, z)
      outer.rotation.set(0, yaw, 0)
      outer.scale.setScalar(flight.scale)
      pitchRoll.rotation.set(rollX, 0, pitchZ)

      // Emit subtle trail particles from the left & right sleigh runners (+X tail in local space)
      outer.updateMatrix()
      pitchRoll.updateMatrix()
      tmpLocalToSection.multiplyMatrices(outer.matrix, pitchRoll.matrix)

      // Sleigh runners sit near x ∈ [+0.9, +1.9], y ≈ -0.42, z ≈ ±0.32 in normalized pitchRoll space
      trail.spawnAccum += dt * 36.0
      while (trail.spawnAccum >= 1.0) {
        trail.spawnAccum -= 1.0
        const runnerX = 1.15 + Math.random() * 0.75
        tmpRunnerLeft.set(runnerX, -0.40, -0.30).applyMatrix4(tmpLocalToSection)
        tmpRunnerRight.set(runnerX, -0.40, 0.30).applyMatrix4(tmpLocalToSection)

        spawnRunnerParticle(tmpRunnerLeft.x, tmpRunnerLeft.y, tmpRunnerLeft.z, vx, vy, vz)
        spawnRunnerParticle(tmpRunnerRight.x, tmpRunnerRight.y, tmpRunnerRight.z, vx, vy, vz)
      }

      if (p >= 1.0) {
        if (SLEIGH_TEST_CONTINUOUS_LOOP) {
          configureNextPass(flight)
        } else {
          flight.phase = 'cooldown'
          flight.timer = 7.0 + Math.random() * 10.0
          if (actions) {
            Object.values(actions).forEach((a) => {
              if (a) a.paused = true
            })
          }
        }
      }
    } else {
      outer.visible = false
      flight.timer -= dt
      if (flight.timer <= 0) {
        configureNextPass(flight)
        if (actions) {
          Object.values(actions).forEach((a) => {
            if (a) a.paused = false
          })
        }
      }
    }

    // Update all active trail particles
    for (let i = 0; i < SLEIGH_TRAIL_COUNT; i++) {
      if (trail.ages[i] >= trail.lifetimes[i]) {
        trail.alphas[i] = 0
        continue
      }
      trail.ages[i] += dt
      const lifeProgress = clamp(trail.ages[i] / trail.lifetimes[i], 0, 1)

      trail.positions[i * 3 + 0] +=
        (trail.velocities[i * 3 + 0] + Math.sin(elapsed * 3.2 + trail.phases[i]) * 0.12) * dt
      trail.positions[i * 3 + 1] += trail.velocities[i * 3 + 1] * dt
      trail.positions[i * 3 + 2] +=
        (trail.velocities[i * 3 + 2] + Math.cos(elapsed * 2.8 + trail.phases[i]) * 0.12) * dt

      // Twinkle + smooth fade-out
      const twinkle = 0.65 + 0.35 * Math.sin(elapsed * 18.0 + trail.phases[i])
      const fade = Math.pow(1.0 - lifeProgress, 1.35)
      trail.alphas[i] = fade * twinkle
    }

    if (trailGeoRef.current) {
      trailGeoRef.current.attributes.position.needsUpdate = true
      trailGeoRef.current.attributes.aAlpha.needsUpdate = true
      trailGeoRef.current.attributes.aColor.needsUpdate = true
      trailGeoRef.current.attributes.aSize.needsUpdate = true
    }
  })

  return (
    <group>
      <group ref={outerGroupRef}>
        <group ref={pitchRollGroupRef}>
          <group position={centerOffset} scale={unitScale}>
            <primitive object={scene} />
          </group>
        </group>
      </group>

      {/* Glowing Stardust Particle Trail */}
      <points frustumCulled={false}>
        <bufferGeometry ref={trailGeoRef}>
          <bufferAttribute attach="attributes-position" args={[trail.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[trail.sizes, 1]} />
          <bufferAttribute attach="attributes-aAlpha" args={[trail.alphas, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[trail.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={sleighTrailVertexShader}
          fragmentShader={sleighTrailFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}

const JackOLanternProp = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  const lightRef = useRef<THREE.PointLight>(null)
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    JACK_OLANTERN_PATH,
    0
  )

  useFrame((state) => {
    if (!lightRef.current) return
    const t = state.clock.elapsedTime
    lightRef.current.intensity = 3.5 + Math.sin(t * 11.0) * 0.7 + Math.cos(t * 17.0) * 0.4
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
      <pointLight
        ref={lightRef}
        position={[0, 0.45, 0.15]}
        color="#ff6a00"
        intensity={3.5}
        distance={6}
        decay={2}
      />
    </group>
  )
}

const NewYearNeonSignProp = ({
  position,
  rotationY,
  scale,
  color,
  intensity
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
  color: string
  intensity: number
}) => {
  const yearText = useMemo(() => getUpcomingYear(), [])
  const innerRef = useRef<THREE.Group>(null)
  const alignRef = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const inner = innerRef.current
    const align = alignRef.current
    if (!inner || !align) return

    const box = computeLocalBoundingBox(inner)
    if (box.isEmpty()) return

    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const s = size.y > 0.0001 ? 1.0 / size.y : 1.0
    align.scale.setScalar(s)
    align.position.set(-center.x * s, -box.min.y * s, -center.z * s)
  }, [yearText])

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group ref={alignRef}>
        <group ref={innerRef}>
          <NeonSign
            text={yearText}
            position={[0, 0, 0]}
            color={color}
            intensity={intensity}
            size={1.0}
            fontUrl={NEON_FONT_URL}
            withPointLight={true}
            flicker={true}
          />
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 6. INTERMITTENT 3D NEW YEAR FIREWORKS
// ---------------------------------------------------------------------------

const FIREWORK_PALETTES: [string, string][] = [
  ['#ffd700', '#fff4b8'], // Gold & Champagne
  ['#ff2e4c', '#ffae00'], // Crimson & Gold
  ['#00f0ff', '#a855f7'], // Cyan & Violet
  ['#38ff7a', '#ffd700'], // Emerald & Gold
  ['#ff45e6', '#70d6ff']  // Magenta & Sky Blue
]

const NUM_SHELLS = 5
const SPARKS_PER_SHELL = 110
const TOTAL_SPARKS = NUM_SHELLS * SPARKS_PER_SHELL

interface FireworkShellState {
  phase: 'cooldown' | 'ascending' | 'exploding'
  timer: number
  duration: number
  launchX: number
  launchY: number
  launchZ: number
  burstX: number
  burstY: number
  burstZ: number
  c1: THREE.Color
  c2: THREE.Color
  sparkVel: Float32Array
  sparkColorMix: Float32Array
  sparkTwinklePhase: Float32Array
}

export const NewYearFireworks = () => {
  const { holiday } = useHoliday()
  const linesGeoRef = useRef<THREE.BufferGeometry>(null)
  const pointsGeoRef = useRef<THREE.BufferGeometry>(null)
  const flashLightRef = useRef<THREE.PointLight>(null)

  const {
    shells,
    linePositions,
    lineColors,
    pointPositions,
    pointColors
  } = useMemo(() => {
    const shellList: FireworkShellState[] = []
    for (let s = 0; s < NUM_SHELLS; s++) {
      shellList.push({
        phase: 'cooldown',
        // Stagger initial launches so the first shell fires almost immediately
        timer: s === 0 ? 0.15 : 0.5 + s * 0.7 + Math.random() * 0.6,
        duration: 1.0,
        launchX: 0,
        launchY: -2.0,
        launchZ: -6.0,
        burstX: 0,
        burstY: 2.5,
        burstZ: -6.0,
        c1: new THREE.Color('#ffd700'),
        c2: new THREE.Color('#ffffff'),
        sparkVel: new Float32Array(SPARKS_PER_SHELL * 3),
        sparkColorMix: new Float32Array(SPARKS_PER_SHELL),
        sparkTwinklePhase: new Float32Array(SPARKS_PER_SHELL)
      })
    }

    return {
      shells: shellList,
      linePositions: new Float32Array(TOTAL_SPARKS * 2 * 3),
      lineColors: new Float32Array(TOTAL_SPARKS * 2 * 3),
      pointPositions: new Float32Array(TOTAL_SPARKS * 3),
      pointColors: new Float32Array(TOTAL_SPARKS * 3)
    }
  }, [])

  const resetShellToLaunch = (shell: FireworkShellState) => {
    shell.phase = 'ascending'
    shell.timer = 0
    shell.duration = 0.55 + Math.random() * 0.25

    shell.launchX = (Math.random() - 0.5) * 14.0
    shell.launchY = -2.0
    shell.launchZ = -3.5 - Math.random() * 9.5

    shell.burstX = shell.launchX + (Math.random() - 0.5) * 1.6
    shell.burstY = 1.3 + Math.random() * 3.4
    shell.burstZ = shell.launchZ + (Math.random() - 0.5) * 1.0

    const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)]
    shell.c1.set(palette[0])
    shell.c2.set(palette[1])

    const isDoubleRing = Math.random() < 0.35
    const baseSpeed = 3.6 + Math.random() * 2.2

    for (let i = 0; i < SPARKS_PER_SHELL; i++) {
      // Uniform random point on sphere
      const u = Math.random()
      const v = Math.random()
      const theta = u * 2.0 * Math.PI
      const phi = Math.acos(2.0 * v - 1.0)

      const dx = Math.sin(phi) * Math.cos(theta)
      const dy = Math.cos(phi)
      const dz = Math.sin(phi) * Math.sin(theta)

      const layerMult = isDoubleRing && i < SPARKS_PER_SHELL * 0.35 ? 0.55 : (0.82 + Math.random() * 0.36)
      const speed = baseSpeed * layerMult

      shell.sparkVel[i * 3 + 0] = dx * speed
      shell.sparkVel[i * 3 + 1] = dy * speed
      shell.sparkVel[i * 3 + 2] = dz * speed
      shell.sparkColorMix[i] = isDoubleRing && i < SPARKS_PER_SHELL * 0.35 ? 0.9 : Math.random()
      shell.sparkTwinklePhase[i] = Math.random() * Math.PI * 2
    }
  }

  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((state, rawDelta) => {
    if (holiday !== 'newyear') return
    const dt = Math.min(rawDelta, 0.05)
    const elapsed = state.clock.elapsedTime

    let brightestIntensity = 0
    let brightestX = 0
    let brightestY = 2
    let brightestZ = -5
    let brightestColor: THREE.Color | null = null

    const gravity = 2.6
    const drag = 2.1

    for (let s = 0; s < NUM_SHELLS; s++) {
      const shell = shells[s]
      const baseIdx = s * SPARKS_PER_SHELL

      if (shell.phase === 'cooldown') {
        shell.timer -= dt
        // Hide all sparks for this shell
        for (let i = 0; i < SPARKS_PER_SHELL; i++) {
          const idx = baseIdx + i
          pointPositions[idx * 3 + 1] = -9999
          linePositions[idx * 6 + 1] = -9999
          linePositions[idx * 6 + 4] = -9999
          pointColors[idx * 3 + 0] = 0
          pointColors[idx * 3 + 1] = 0
          pointColors[idx * 3 + 2] = 0
        }
        if (shell.timer <= 0) {
          resetShellToLaunch(shell)
        }
      } else if (shell.phase === 'ascending') {
        shell.timer += dt
        const p = clamp(shell.timer / shell.duration, 0, 1)
        const easeP = 1.0 - (1.0 - p) * (1.0 - p)
        const prevP = Math.max(0, 1.0 - (1.0 - Math.max(0, p - 0.14)) * (1.0 - Math.max(0, p - 0.14)))

        const hx = mix(shell.launchX, shell.burstX, p)
        const hy = mix(shell.launchY, shell.burstY, easeP)
        const hz = mix(shell.launchZ, shell.burstZ, p)

        const tx = mix(shell.launchX, shell.burstX, Math.max(0, p - 0.14))
        const ty = mix(shell.launchY, shell.burstY, prevP)
        const tz = mix(shell.launchZ, shell.burstZ, Math.max(0, p - 0.14))

        // Use first 8 sparks as ascending rocket + sparks trail, hide the rest
        for (let i = 0; i < SPARKS_PER_SHELL; i++) {
          const idx = baseIdx + i
          if (i === 0) {
            pointPositions[idx * 3 + 0] = hx
            pointPositions[idx * 3 + 1] = hy
            pointPositions[idx * 3 + 2] = hz
            pointColors[idx * 3 + 0] = 3.5
            pointColors[idx * 3 + 1] = 2.8
            pointColors[idx * 3 + 2] = 1.5

            linePositions[idx * 6 + 0] = hx
            linePositions[idx * 6 + 1] = hy
            linePositions[idx * 6 + 2] = hz
            linePositions[idx * 6 + 3] = tx
            linePositions[idx * 6 + 4] = ty
            linePositions[idx * 6 + 5] = tz

            lineColors[idx * 6 + 0] = 3.2
            lineColors[idx * 6 + 1] = 2.4
            lineColors[idx * 6 + 2] = 1.1
            lineColors[idx * 6 + 3] = 0.0
            lineColors[idx * 6 + 4] = 0.0
            lineColors[idx * 6 + 5] = 0.0
          } else {
            pointPositions[idx * 3 + 1] = -9999
            linePositions[idx * 6 + 1] = -9999
            linePositions[idx * 6 + 4] = -9999
          }
        }

        if (p >= 1.0) {
          shell.phase = 'exploding'
          shell.timer = 0
          shell.duration = 1.65 + Math.random() * 0.45
        }
      } else if (shell.phase === 'exploding') {
        shell.timer += dt
        const t = shell.timer
        const progress = clamp(t / shell.duration, 0, 1)

        // Analytical position with exponential drag: pos(t) = burst + v0 * (1 - exp(-drag * t)) / drag - 0.5 * g * t^2
        const dispFactor = (1.0 - Math.exp(-drag * t)) / drag
        const tTail = Math.max(0, t - 0.09)
        const tailDispFactor = (1.0 - Math.exp(-drag * tTail)) / drag

        const fade = Math.pow(1.0 - progress, 1.55)
        // HDR boost (>1.1 triggers Bloom)
        const hdrBoost = 3.6 * fade

        // Track brightest burst for dynamic scene flash light
        const flashStrength = Math.max(0, 1.0 - progress * 1.8) * 18.0
        if (flashStrength > brightestIntensity) {
          brightestIntensity = flashStrength
          brightestX = shell.burstX
          brightestY = shell.burstY
          brightestZ = shell.burstZ
          brightestColor = shell.c1
        }

        for (let i = 0; i < SPARKS_PER_SHELL; i++) {
          const idx = baseIdx + i
          const vx = shell.sparkVel[i * 3 + 0]
          const vy = shell.sparkVel[i * 3 + 1]
          const vz = shell.sparkVel[i * 3 + 2]

          const px = shell.burstX + vx * dispFactor
          const py = shell.burstY + vy * dispFactor - 0.5 * gravity * t * t
          const pz = shell.burstZ + vz * dispFactor

          const tx = shell.burstX + vx * tailDispFactor
          const ty = shell.burstY + vy * tailDispFactor - 0.5 * gravity * tTail * tTail
          const tz = shell.burstZ + vz * tailDispFactor

          // Late-stage crackle/glitter
          const twinkle =
            progress > 0.45
              ? 0.55 + 0.45 * Math.sin(elapsed * 30.0 + shell.sparkTwinklePhase[i])
              : 1.0

          tmpColor.lerpColors(shell.c1, shell.c2, shell.sparkColorMix[i])
          const r = tmpColor.r * hdrBoost * twinkle
          const g = tmpColor.g * hdrBoost * twinkle
          const b = tmpColor.b * hdrBoost * twinkle

          pointPositions[idx * 3 + 0] = px
          pointPositions[idx * 3 + 1] = py
          pointPositions[idx * 3 + 2] = pz
          pointColors[idx * 3 + 0] = r
          pointColors[idx * 3 + 1] = g
          pointColors[idx * 3 + 2] = b

          linePositions[idx * 6 + 0] = px
          linePositions[idx * 6 + 1] = py
          linePositions[idx * 6 + 2] = pz
          linePositions[idx * 6 + 3] = tx
          linePositions[idx * 6 + 4] = ty
          linePositions[idx * 6 + 5] = tz

          lineColors[idx * 6 + 0] = r
          lineColors[idx * 6 + 1] = g
          lineColors[idx * 6 + 2] = b
          lineColors[idx * 6 + 3] = r * 0.1
          lineColors[idx * 6 + 4] = g * 0.1
          lineColors[idx * 6 + 5] = b * 0.1
        }

        if (progress >= 1.0) {
          shell.phase = 'cooldown'
          // Intermittent pause before this shell slot launches again
          shell.timer = 0.6 + Math.random() * 2.2
        }
      }
    }

    if (linesGeoRef.current) {
      linesGeoRef.current.attributes.position.needsUpdate = true
      linesGeoRef.current.attributes.color.needsUpdate = true
    }
    if (pointsGeoRef.current) {
      pointsGeoRef.current.attributes.position.needsUpdate = true
      pointsGeoRef.current.attributes.color.needsUpdate = true
    }
    if (flashLightRef.current) {
      flashLightRef.current.intensity = brightestIntensity
      if (brightestColor) {
        flashLightRef.current.position.set(brightestX, brightestY, brightestZ)
        flashLightRef.current.color.copy(brightestColor)
      }
    }
  })

  if (holiday !== 'newyear') return null

  return (
    <group>
      <pointLight
        ref={flashLightRef}
        position={[0, 2.5, -5]}
        intensity={0}
        distance={22}
        decay={2}
      />
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={linesGeoRef}>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <points frustumCulled={false}>
        <bufferGeometry ref={pointsGeoRef}>
          <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[pointColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.14}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  )
}

// ---------------------------------------------------------------------------
// EASTER 3D PROPS: Procedural Spring Lawn Patch & Hidden Egg Hunt
// ---------------------------------------------------------------------------

const EGG_COLORS = [
  { base: '#ff80ab', stripe: '#ffffba' }, // Rose pink & lemon
  { base: '#70d6ff', stripe: '#ffffff' }, // Sky blue & crisp white
  { base: '#ffd166', stripe: '#ff80ab' }, // Sunshine yellow & pink
  { base: '#bbf2c0', stripe: '#70d6ff' }, // Mint & sky blue
  { base: '#c77dff', stripe: '#ffffba' }, // Lavender & soft gold
  { base: '#ff9ebb', stripe: '#bbf2c0' }, // Baby pink & mint
  { base: '#90e0ef', stripe: '#ffd166' }, // Aqua & yellow
  { base: '#e0aaff', stripe: '#ffffff' }  // Lilac & white
]

const EasterEgg = ({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  color,
  stripeColor
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  color: string
  stripeColor: string
}) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Egg Body */}
      <mesh position={[0, 0.14, 0]} scale={[1, 1.38, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
      </mesh>
      {/* Decorative middle band */}
      <mesh position={[0, 0.14, 0]} scale={[1.02, 0.28, 1.02]}>
        <cylinderGeometry args={[0.13, 0.13, 0.1, 16]} />
        <meshStandardMaterial color={stripeColor} roughness={0.4} />
      </mesh>
    </group>
  )
}

const EasterProps = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  // Generate grass blades and hidden eggs deterministically
  const { grassBlades, hiddenEggs } = useMemo(() => {
    const blades: { x: number; z: number; rotY: number; lean: number; height: number; col: string }[] = []
    const bladeColors = ['#4caf50', '#66bb6a', '#388e3c', '#81c784', '#2e7d32']

    for (let i = 0; i < 90; i++) {
      const r = 0.35 + Math.sqrt(Math.random()) * 2.1
      const theta = Math.random() * Math.PI * 2
      blades.push({
        x: Math.cos(theta) * r,
        z: Math.sin(theta) * r,
        rotY: Math.random() * Math.PI,
        lean: 0.1 + Math.random() * 0.22,
        height: 0.28 + Math.random() * 0.22,
        col: bladeColors[Math.floor(Math.random() * bladeColors.length)]
      })
    }

    const eggs: { pos: [number, number, number]; rot: [number, number, number]; s: number; c: string; sc: string }[] = [
      { pos: [-1.45, 0.0, 0.85], rot: [0.35, 0.4, 0.2], s: 0.95, c: EGG_COLORS[0].base, sc: EGG_COLORS[0].stripe },
      { pos: [1.3, 0.0, -0.65], rot: [-0.25, 0.8, -0.3], s: 1.05, c: EGG_COLORS[1].base, sc: EGG_COLORS[1].stripe },
      { pos: [-0.95, 0.0, -1.2], rot: [0.4, -0.5, 0.15], s: 0.9, c: EGG_COLORS[2].base, sc: EGG_COLORS[2].stripe },
      { pos: [0.85, 0.0, 1.25], rot: [-0.3, 0.2, 0.35], s: 1.0, c: EGG_COLORS[3].base, sc: EGG_COLORS[3].stripe },
      { pos: [-1.65, 0.0, -0.35], rot: [0.2, 1.1, -0.2], s: 0.92, c: EGG_COLORS[4].base, sc: EGG_COLORS[4].stripe },
      { pos: [1.5, 0.0, 0.75], rot: [-0.35, -0.6, 0.25], s: 0.98, c: EGG_COLORS[5].base, sc: EGG_COLORS[5].stripe },
      { pos: [-0.4, 0.0, 1.55], rot: [0.45, 0.3, -0.3], s: 1.02, c: EGG_COLORS[6].base, sc: EGG_COLORS[6].stripe },
      { pos: [0.35, 0.0, -1.45], rot: [-0.2, -0.9, 0.3], s: 0.88, c: EGG_COLORS[7].base, sc: EGG_COLORS[7].stripe }
    ]

    return { grassBlades: blades, hiddenEggs: eggs }
  }, [])

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Spring lawn disc */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.5, 36]} />
        <meshStandardMaterial color="#439b38" roughness={0.78} />
      </mesh>
      {/* Inner raised meadow mound */}
      <mesh position={[0, -0.05, 0]} scale={[1.8, 0.2, 1.8]} receiveShadow>
        <sphereGeometry args={[1.2, 24, 16]} />
        <meshStandardMaterial color="#3b8b30" roughness={0.72} />
      </mesh>

      {/* Procedural grass tufts */}
      {grassBlades.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[b.lean, b.rotY, 0]}>
          <mesh position={[0, b.height * 0.5, 0]}>
            <coneGeometry args={[0.035, b.height, 4]} />
            <meshStandardMaterial color={b.col} roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* Woven Wicker Easter Basket in center */}
      <group position={[0, 0.02, 0]}>
        {/* Basket Bowl */}
        <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.65, 0.44, 0.58, 20, 1, true]} />
          <meshStandardMaterial color="#a76d38" roughness={0.78} />
        </mesh>
        {/* Basket base plate */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.08, 20]} />
          <meshStandardMaterial color="#8a5323" roughness={0.8} />
        </mesh>
        {/* Braided rim */}
        <mesh position={[0, 0.61, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.65, 0.06, 12, 24]} />
          <meshStandardMaterial color="#8a5323" roughness={0.7} />
        </mesh>
        {/* Basket handle */}
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.64, 0.05, 12, 28, Math.PI]} />
          <meshStandardMaterial color="#8a5323" roughness={0.7} />
        </mesh>
        {/* Handle top bow */}
        <mesh position={[0, 1.37, 0]} scale={[1, 0.6, 0.5]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#ff80ab" roughness={0.5} />
        </mesh>

        {/* Shredded Easter grass nest inside */}
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.58, 0.42, 0.32, 18]} />
          <meshStandardMaterial color="#bbf2c0" roughness={0.85} />
        </mesh>

        {/* Eggs in basket */}
        <EasterEgg position={[-0.22, 0.44, 0.08]} rotation={[0.2, 0.4, 0.3]} scale={1.1} color={EGG_COLORS[0].base} stripeColor={EGG_COLORS[0].stripe} />
        <EasterEgg position={[0.22, 0.44, -0.05]} rotation={[-0.2, -0.4, -0.25]} scale={1.1} color={EGG_COLORS[1].base} stripeColor={EGG_COLORS[1].stripe} />
        <EasterEgg position={[0.02, 0.48, 0.22]} rotation={[0.3, 0.1, -0.2]} scale={1.05} color={EGG_COLORS[2].base} stripeColor={EGG_COLORS[2].stripe} />
        <EasterEgg position={[0.0, 0.52, -0.16]} rotation={[-0.25, 0.3, 0.2]} scale={1.08} color={EGG_COLORS[4].base} stripeColor={EGG_COLORS[4].stripe} />
      </group>

      {/* Hidden eggs around lawn */}
      {hiddenEggs.map((egg, i) => (
        <EasterEgg
          key={i}
          position={egg.pos}
          rotation={egg.rot}
          scale={egg.s}
          color={egg.c}
          stripeColor={egg.sc}
        />
      ))}

      <pointLight position={[0, 1.6, 0]} color="#fff9db" intensity={2.2} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// VALENTINE'S 3D PROPS: Ruby Velvet Heart Chocolate Box & Long-Stem Rose
// ---------------------------------------------------------------------------

const ValentinesProps = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  const heartExtrudeGeo = useMemo(() => {
    const shape = new THREE.Shape()
    const d = 0.65
    shape.moveTo(0, d * 0.32)
    shape.bezierCurveTo(d * 0.2, d * 0.82, d * 0.92, d * 0.72, d * 0.92, d * 0.2)
    shape.bezierCurveTo(d * 0.92, -d * 0.32, d * 0.42, -d * 0.62, 0, -d * 0.95)
    shape.bezierCurveTo(-d * 0.42, -d * 0.62, -d * 0.92, -d * 0.32, -d * 0.92, d * 0.2)
    shape.bezierCurveTo(-d * 0.92, d * 0.72, -d * 0.2, d * 0.82, 0, d * 0.32)

    const extrudeSettings = {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04
    }
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    geo.center()
    return geo
  }, [])

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Velvet Heart Box */}
      <group position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={heartExtrudeGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color="#b91c1c"
            roughness={0.35}
            metalness={0.12}
          />
        </mesh>
        {/* Gold cross ribbon */}
        <mesh position={[0, 0, 0.15]} scale={[0.12, 1.25, 0.02]}>
          <boxGeometry />
          <meshStandardMaterial color="#ffd700" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.15]} scale={[1.25, 0.12, 0.02]}>
          <boxGeometry />
          <meshStandardMaterial color="#ffd700" metalness={0.75} roughness={0.3} />
        </mesh>
        {/* Ribbon Bow in center */}
        <mesh position={[0, 0, 0.18]} scale={[0.2, 0.2, 0.1]}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial color="#ffd700" metalness={0.75} roughness={0.3} />
        </mesh>
      </group>

      {/* Long-stem red rose lying next to the heart box */}
      <group position={[0.7, 0.06, 0.35]} rotation={[0, 0.6, 0]}>
        {/* Stem */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 1.1, 8]} />
          <meshStandardMaterial color="#2d6a4f" roughness={0.7} />
        </mesh>
        {/* Leaves */}
        <mesh position={[-0.15, 0.02, 0.06]} rotation={[0.4, 0.2, 0.5]} scale={[0.18, 0.02, 0.09]}>
          <sphereGeometry />
          <meshStandardMaterial color="#38b000" roughness={0.6} />
        </mesh>
        <mesh position={[0.15, 0.02, -0.06]} rotation={[-0.3, -0.2, -0.5]} scale={[0.18, 0.02, 0.09]}>
          <sphereGeometry />
          <meshStandardMaterial color="#38b000" roughness={0.6} />
        </mesh>
        {/* Rose bloom */}
        <group position={[0.58, 0.08, 0]}>
          <mesh scale={[0.16, 0.14, 0.16]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color="#d90429" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.04, 0]} scale={[0.12, 0.12, 0.12]}>
            <sphereGeometry args={[1, 14, 14]} />
            <meshStandardMaterial color="#9b2226" roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Delicious chocolate truffles */}
      <group position={[-0.65, 0.05, 0.45]}>
        <mesh scale={[0.08, 0.07, 0.08]}>
          <sphereGeometry />
          <meshStandardMaterial color="#3d1e11" roughness={0.4} />
        </mesh>
        <mesh position={[0.15, 0, 0.1]} scale={[0.08, 0.07, 0.08]}>
          <sphereGeometry />
          <meshStandardMaterial color="#221109" roughness={0.4} />
        </mesh>
      </group>

      <pointLight position={[0, 0.8, 0.2]} color="#ff4d6d" intensity={2.8} distance={5} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// ST. PATRICK'S 3D PROPS: Cast-Iron Pot of Gold, Shamrock & Golden Horseshoe
// ---------------------------------------------------------------------------

const StPatricksProps = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Cast-iron Cauldron */}
      <group position={[0, 0.45, 0]}>
        {/* Pot belly */}
        <mesh scale={[0.65, 0.52, 0.65]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 20]} />
          <meshStandardMaterial color="#1a1c20" roughness={0.55} metalness={0.35} />
        </mesh>
        {/* Rim */}
        <mesh position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.065, 12, 28]} />
          <meshStandardMaterial color="#22252a" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* 3 Legs */}
        {[-0.35, 0, 0.35].map((x, i) => (
          <mesh key={i} position={[x * 0.8, -0.42, (i === 1 ? -0.32 : 0.25)]}>
            <cylinderGeometry args={[0.05, 0.07, 0.2, 10]} />
            <meshStandardMaterial color="#141618" roughness={0.6} metalness={0.4} />
          </mesh>
        ))}

        {/* Mounded shimmering gold coins filling pot */}
        <mesh position={[0, 0.38, 0]} scale={[0.52, 0.22, 0.52]}>
          <sphereGeometry args={[1, 20, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.88} roughness={0.2} />
        </mesh>
        {/* Individual coins on top & spilling */}
        <mesh position={[0.1, 0.52, 0.05]} rotation={[0.2, 0.3, 0.15]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          <meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.18} />
        </mesh>
        <mesh position={[-0.15, 0.51, -0.08]} rotation={[-0.2, -0.4, 0.3]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.18} />
        </mesh>
        <mesh position={[0.42, 0.38, 0.18]} rotation={[0.8, 0.2, -0.5]}>
          <cylinderGeometry args={[0.09, 0.09, 0.02, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.18} />
        </mesh>
      </group>

      {/* Spilled gold coins on ground */}
      <group position={[0.55, 0.02, 0.25]}>
        <mesh rotation={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.18} />
        </mesh>
        <mesh position={[0.16, 0.01, 0.08]} rotation={[0.1, 0.8, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
          <meshStandardMaterial color="#ffc107" metalness={0.9} roughness={0.18} />
        </mesh>
        <mesh position={[0.08, 0.02, -0.15]} rotation={[-0.1, 0.2, 0.15]}>
          <cylinderGeometry args={[0.09, 0.09, 0.02, 16]} />
          <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.18} />
        </mesh>
      </group>

      {/* Lucky 4-Leaf Shamrock sprig */}
      <group position={[-0.55, 0.04, 0.3]} rotation={[0, 0.4, 0]}>
        {/* Stem */}
        <mesh position={[-0.1, 0, 0.1]} rotation={[0, 0.5, Math.PI / 2.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
          <meshStandardMaterial color="#1b4332" roughness={0.6} />
        </mesh>
        {/* 4 Clover leaflets */}
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle, idx) => (
          <mesh
            key={idx}
            position={[Math.cos(angle) * 0.09, 0.02, Math.sin(angle) * 0.09]}
            rotation={[-Math.PI / 2, 0, angle]}
            scale={[0.08, 0.08, 0.01]}
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#00a86b" roughness={0.45} />
          </mesh>
        ))}
      </group>

      {/* Golden Horseshoe */}
      <group position={[-0.45, 0.02, -0.35]} rotation={[-Math.PI / 2, 0, 0.7]}>
        <mesh scale={[0.26, 0.3, 0.04]}>
          <torusGeometry args={[0.7, 0.16, 12, 24, Math.PI * 1.35]} />
          <meshStandardMaterial color="#ffd700" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      <pointLight position={[0, 1.0, 0]} color="#4ade80" intensity={2.6} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// THANKSGIVING 3D PROPS: Wicker Cornucopia, Harvest Pumpkins & Pumpkin Pie
// ---------------------------------------------------------------------------

const ThanksgivingProps = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  const hornGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.55, 0.35, 0),
      new THREE.Vector3(-0.25, 0.18, 0.15),
      new THREE.Vector3(0.12, 0.08, 0.05),
      new THREE.Vector3(0.55, 0.12, -0.15),
      new THREE.Vector3(0.85, 0.32, -0.22)
    ])
    return new THREE.TubeGeometry(curve, 32, 0.28, 16, false)
  }, [])

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* Cornucopia Horn */}
      <mesh geometry={hornGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#99582a" roughness={0.82} />
      </mesh>
      {/* Flared mouth rim */}
      <mesh position={[-0.55, 0.35, 0]} rotation={[0, -0.5, 0]}>
        <torusGeometry args={[0.34, 0.05, 12, 24]} />
        <meshStandardMaterial color="#7f4f24" roughness={0.78} />
      </mesh>

      {/* Harvest bounty spilling from cornucopia */}
      {/* Mini pumpkin */}
      <group position={[-0.72, 0.14, 0.15]} scale={0.24}>
        <mesh scale={[1, 0.8, 1]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color="#ea580c" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.3, 8]} />
          <meshStandardMaterial color="#2d6a4f" roughness={0.7} />
        </mesh>
      </group>

      {/* Golden acorn squash / gourd */}
      <group position={[-0.85, 0.12, -0.18]} scale={0.22} rotation={[0.4, 0.2, 0.6]}>
        <mesh scale={[0.8, 1.4, 0.8]}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} />
        </mesh>
      </group>

      {/* Red autumn apples */}
      <group position={[-0.52, 0.08, 0.42]} scale={0.12}>
        <mesh>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.3, 6]} />
          <meshStandardMaterial color="#4a2810" roughness={0.8} />
        </mesh>
      </group>
      <group position={[-0.42, 0.08, -0.32]} scale={0.11}>
        <mesh>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial color="#c1121f" roughness={0.35} />
        </mesh>
      </group>

      {/* Freshly baked Pumpkin Pie on rustic plate */}
      <group position={[0.45, 0.04, 0.45]} rotation={[0, -0.4, 0]}>
        {/* Plate */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.46, 0.4, 0.04, 24]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.3} />
        </mesh>
        {/* Pie Crust rim */}
        <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.4, 0.04, 12, 24]} />
          <meshStandardMaterial color="#d4a373" roughness={0.75} />
        </mesh>
        {/* Spiced Pumpkin Filling */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.06, 24]} />
          <meshStandardMaterial color="#bc6c25" roughness={0.6} />
        </mesh>
        {/* Whipped cream swirl */}
        <mesh position={[0, 0.12, 0]} scale={[0.12, 0.1, 0.12]}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial color="#fffdf0" roughness={0.25} />
        </mesh>
      </group>

      <pointLight position={[-0.4, 0.9, 0.1]} color="#f59e0b" intensity={2.6} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// BAKED HOLIDAY SCENE PROP TRANSFORMS
// ---------------------------------------------------------------------------

const SCENE_PROP_PARAMS = {
  tree: {
    position: [-4.70, -2.00, -3.20] as [number, number, number],
    rotationY: 0.35,
    scale: 3.20
  },
  snowman: {
    position: [2.35, -2.00, -7.80] as [number, number, number],
    rotationY: -0.85,
    scale: 1.35
  },
  pumpkin: {
    position: [-3.80, -2.00, -2.50] as [number, number, number],
    rotationY: 1.03,
    scale: 1.10
  },
  yearNeon: {
    position: [2.95, -1.55, -6.80] as [number, number, number],
    rotationY: -0.32,
    scale: 0.95,
    color: '#ffd700',
    intensity: 2.50
  },
  easter: {
    position: [-3.80, -2.00, -2.80] as [number, number, number],
    rotationY: 0.25,
    scale: 0.85
  },
  valentines: {
    position: [-3.60, -1.98, -2.50] as [number, number, number],
    rotationY: 0.35,
    scale: 1.15
  },
  stpatricks: {
    position: [-3.60, -1.98, -2.50] as [number, number, number],
    rotationY: 0.15,
    scale: 1.10
  },
  thanksgiving: {
    position: [-3.60, -1.98, -2.50] as [number, number, number],
    rotationY: -0.20,
    scale: 1.05
  }
} as const

export const HolidaySceneProps = () => {
  const { holiday } = useHoliday()

  if (!holiday) return null

  return (
    <Suspense fallback={null}>
      <group>
        {holiday === 'winter' && (
          <>
            <ChristmasTreeProp
              position={SCENE_PROP_PARAMS.tree.position}
              rotationY={SCENE_PROP_PARAMS.tree.rotationY}
              scale={SCENE_PROP_PARAMS.tree.scale}
            />
            <SnowmanProp
              position={SCENE_PROP_PARAMS.snowman.position}
              rotationY={SCENE_PROP_PARAMS.snowman.rotationY}
              scale={SCENE_PROP_PARAMS.snowman.scale}
            />
            <Suspense fallback={null}>
              <FlyingSleighProp />
            </Suspense>
          </>
        )}

        {holiday === 'halloween' && (
          <JackOLanternProp
            position={SCENE_PROP_PARAMS.pumpkin.position}
            rotationY={SCENE_PROP_PARAMS.pumpkin.rotationY}
            scale={SCENE_PROP_PARAMS.pumpkin.scale}
          />
        )}

        {holiday === 'newyear' && (
          <>
            <NewYearNeonSignProp
              position={SCENE_PROP_PARAMS.yearNeon.position}
              rotationY={SCENE_PROP_PARAMS.yearNeon.rotationY}
              scale={SCENE_PROP_PARAMS.yearNeon.scale}
              color={SCENE_PROP_PARAMS.yearNeon.color}
              intensity={SCENE_PROP_PARAMS.yearNeon.intensity}
            />
            <NewYearFireworks />
          </>
        )}

        {holiday === 'easter' && (
          <EasterProps
            position={SCENE_PROP_PARAMS.easter.position}
            rotationY={SCENE_PROP_PARAMS.easter.rotationY}
            scale={SCENE_PROP_PARAMS.easter.scale}
          />
        )}

        {holiday === 'valentines' && (
          <ValentinesProps
            position={SCENE_PROP_PARAMS.valentines.position}
            rotationY={SCENE_PROP_PARAMS.valentines.rotationY}
            scale={SCENE_PROP_PARAMS.valentines.scale}
          />
        )}

        {holiday === 'stpatricks' && (
          <StPatricksProps
            position={SCENE_PROP_PARAMS.stpatricks.position}
            rotationY={SCENE_PROP_PARAMS.stpatricks.rotationY}
            scale={SCENE_PROP_PARAMS.stpatricks.scale}
          />
        )}

        {holiday === 'thanksgiving' && (
          <ThanksgivingProps
            position={SCENE_PROP_PARAMS.thanksgiving.position}
            rotationY={SCENE_PROP_PARAMS.thanksgiving.rotationY}
            scale={SCENE_PROP_PARAMS.thanksgiving.scale}
          />
        )}
      </group>
    </Suspense>
  )
}
