import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useHoliday } from '../../utils/holiday'
import { mix, clamp } from './holidayMath'

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
