// FILE: src/components/HolidayEffects.tsx
import { useMemo, useRef, useEffect, useState, useLayoutEffect, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScroll, useGLTF, useAnimations, useFont, Text3D } from '@react-three/drei'
import * as THREE from 'three'
import { useHoliday, getUpcomingYear, isMajorHoliday, isMinorHoliday } from '../../utils/holiday'
import { getSectionOffsets, getTotalPages } from '../../ScrollManager'
import { computeLocalBoundingBox } from '../HolidayHat'

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

import { fract, mix, clamp, smoothstep, hash3 } from './holidayMath'

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

const build3DSnowCapGeometry = (
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
