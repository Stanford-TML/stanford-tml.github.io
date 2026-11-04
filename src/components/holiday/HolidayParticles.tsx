import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useHoliday, isMajorHoliday } from '../../utils/holiday'

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

    const easterPalette = [
      new THREE.Color('#ff2d75'), // Deep petal rose
      new THREE.Color('#ff6b9d'), // Saturated cherry blossom
      new THREE.Color('#ffc107'), // Golden daffodil
      new THREE.Color('#a855f7'), // Spring lilac
      new THREE.Color('#06b6d4'), // Bright robin-egg blue
      new THREE.Color('#22c55e')  // Fresh spring green
    ]

    if (holiday === 'halloween') {
      c1.set('#ff5500')
      c2.set('#a832ff')
    } else if (holiday === 'newyear') {
      c1.set('#ffd700')
      c2.set('#fff6cc')
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

      if (holiday === 'easter') {
        const cChoice = easterPalette[i % easterPalette.length]
        col[i * 3 + 0] = cChoice.r
        col[i * 3 + 1] = cChoice.g
        col[i * 3 + 2] = cChoice.b
      } else {
        cMix.lerpColors(c1, c2, Math.random())
        col[i * 3 + 0] = cMix.r
        col[i * 3 + 1] = cMix.g
        col[i * 3 + 2] = cMix.b
      }
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
      blending: (holiday === 'winter' || holiday === 'easter') ? THREE.NormalBlending : THREE.AdditiveBlending,
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
        varying float vMode;

        void main() {
          vColor = aColor;
          vMode = uMode;
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
        varying float vMode;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float radial;
          if (vMode > 1.5) {
            // Elongated fluttering blossom petal
            float d = length(vec2(uv.x * 1.5, uv.y));
            if (d > 0.48) discard;
            radial = smoothstep(0.48, 0.20, d);
          } else {
            float d = length(uv);
            if (d > 0.5) discard;
            radial = smoothstep(0.5, 0.08, d);
          }
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
