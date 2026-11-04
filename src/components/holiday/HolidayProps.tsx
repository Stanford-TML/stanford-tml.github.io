import { useMemo, useRef, useEffect, useState, useLayoutEffect, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, useFont, Text3D } from '@react-three/drei'
import * as THREE from 'three'
import { useHoliday, getUpcomingYear, getActiveHoliday } from '../../utils/holiday'
import { computeLocalBoundingBox } from '../HolidayHat'
import { NewYearFireworks } from './HolidayFireworks'
import { mix, clamp } from './holidayMath'

// ---------------------------------------------------------------------------
// 5. HOLIDAY SCENE PROPS (Christmas Tree, Snowman, Jack-o'-lantern, Year Neon)
// ---------------------------------------------------------------------------

const CHRISTMAS_TREE_PATH = '/assets/misc/christmas_tree_2.glb'
const SNOWMAN_PATH = '/assets/misc/snowman_-_low_poly.glb'
const SLEIGH_PATH = '/assets/misc/sleigh.glb'
const JACK_OLANTERN_PATH = '/assets/misc/jack_olantern.glb'
const GRAVESTONE_PATH = '/assets/misc/halloween_gravestone.glb'
const EASTER_EGGS_PATH = '/assets/misc/easter_eggs_party_collection.glb'
const POT_OF_GOLD_PATH = '/assets/misc/pot_of_gold.glb'
const ROSE_PATH = '/assets/misc/rose.glb'
const HEARTBOX_PATH = '/assets/misc/heartbox.glb'
const CORNUCOPIA_PATH = '/assets/misc/cornucopia.glb'
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

// Preload only the active holiday's assets (if any) to prevent downloading ~140MB of 3D models on normal days.
const activeHoliday = getActiveHoliday()
if (activeHoliday === 'winter') {
  useGLTF.preload(CHRISTMAS_TREE_PATH, true, true, registerSpecGlossExtension)
  useGLTF.preload(SNOWMAN_PATH, true, true, registerSpecGlossExtension)
  useGLTF.preload(SLEIGH_PATH, true, true)
} else if (activeHoliday === 'halloween') {
  useGLTF.preload(JACK_OLANTERN_PATH, true, true, registerSpecGlossExtension)
  useGLTF.preload(GRAVESTONE_PATH, true, true, registerSpecGlossExtension)
} else if (activeHoliday === 'easter') {
  useGLTF.preload(EASTER_EGGS_PATH, true, true, registerSpecGlossExtension)
} else if (activeHoliday === 'valentines') {
  useGLTF.preload(HEARTBOX_PATH, true, true, registerSpecGlossExtension)
  useGLTF.preload(ROSE_PATH, true, true, registerSpecGlossExtension)
} else if (activeHoliday === 'stpatricks') {
  useGLTF.preload(POT_OF_GOLD_PATH, true, true, registerSpecGlossExtension)
} else if (activeHoliday === 'thanksgiving') {
  useGLTF.preload(CORNUCOPIA_PATH, true, true, registerSpecGlossExtension)
} else if (activeHoliday === 'newyear') {
  useFont.preload(NEON_FONT_URL)
}

/**
 * Helper hook that clones a loaded GLTF scene, enables shadows, and computes
 * an automatic local-space AABB normalization transform so `scale = 1.0` equals
 * 1.0 unit tall with the base resting at `y = 0` and centered at `x = 0, z = 0`.
 */
const useNormalizedGLTFProp = (
  path: string,
  innerRotationY = 0,
  enhanceMaterials?: (mesh: THREE.Mesh) => void,
  filterObject?: (obj: THREE.Object3D) => boolean
) => {
  const { scene } = useGLTF(path, true, true, registerSpecGlossExtension)

  return useMemo(() => {
    const cloned = scene.clone(true)
    const toRemove: THREE.Object3D[] = []
    cloned.traverse((child) => {
      if (filterObject && !filterObject(child)) {
        toRemove.push(child)
        return
      }
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
    toRemove.forEach((obj) => obj.parent?.remove(obj))

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

    return { cloned, unitScale, offset, size }
  }, [scene, innerRotationY, enhanceMaterials, filterObject])
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
// HALLOWEEN GRAVESTONE PROP
// ---------------------------------------------------------------------------

const HalloweenGravestoneProp = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    GRAVESTONE_PATH,
    0
  )

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// EASTER 3D PROPS: Procedural Spring Lawn & Realistic Egg Collection
// ---------------------------------------------------------------------------

const EGG_SIZE_MULTIPLIERS = [0.82, 1.28, 0.92, 1.35, 0.76, 1.18, 1.30, 0.78, 1.12, 1.22]

const EGG_JITTERS = [
  { rMult: 0.55, dTheta: 0.15, rot: [0.25, 0.40, -0.15] },
  { rMult: 1.15, dTheta: -0.18, rot: [-0.30, 0.80, 0.20] },
  { rMult: 0.70, dTheta: 0.22, rot: [0.40, -0.50, 0.35] },
  { rMult: 1.05, dTheta: -0.08, rot: [-0.15, 1.20, -0.40] },
  { rMult: 0.42, dTheta: 0.30, rot: [0.35, -0.90, 0.18] },
  { rMult: 1.18, dTheta: -0.25, rot: [-0.40, 0.30, -0.50] },
  { rMult: 0.78, dTheta: 0.15, rot: [0.10, -1.10, 0.25] },
  { rMult: 0.52, dTheta: -0.32, rot: [0.45, 0.60, -0.30] },
  { rMult: 1.10, dTheta: 0.10, rot: [-0.25, -0.70, 0.40] },
  { rMult: 0.65, dTheta: -0.14, rot: [0.30, 1.00, -0.20] }
]

const enhanceEasterEggsMesh = (mesh: THREE.Mesh) => {
  if (mesh.material) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((m) => {
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const std = m as THREE.MeshStandardMaterial
        std.roughness = Math.max(std.roughness, 0.90)
        std.metalness = 0.0
        std.needsUpdate = true
      }
    })
  }
}

const EasterProps = ({
  position,
  rotationY,
  scale,
  eggSpread = 0.35,
  eggScale = 0.50,
  eggY = 0.18,
  eggJitter = 1.00,
  eggRadius = 1.00
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
  eggSpread?: number
  eggScale?: number
  eggY?: number
  eggJitter?: number
  eggRadius?: number
}) => {
  const { cloned: eggsCloned, unitScale: eggsScale, offset: eggsOffset } = useNormalizedGLTFProp(
    EASTER_EGGS_PATH,
    0,
    enhanceEasterEggsMesh
  )

  const randomizedEggsScene = useMemo(() => {
    if (!eggsCloned) return null
    const copy = eggsCloned.clone(true)
    let eggIdx = 0
    copy.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name.toLowerCase().includes('egg')) {
        const mesh = child as THREE.Mesh
        mesh.geometry = mesh.geometry.clone()
        mesh.geometry.computeBoundingBox()
        if (mesh.geometry.boundingBox) {
          const center = new THREE.Vector3()
          mesh.geometry.boundingBox.getCenter(center)
          mesh.geometry.translate(-center.x, -center.y, -center.z)
          mesh.position.add(center)

          // 1. Varied egg scale
          const baseMult = EGG_SIZE_MULTIPLIERS[eggIdx % EGG_SIZE_MULTIPLIERS.length]
          const finalScale = 1.0 + (baseMult - 1.0) * (eggSpread / 0.35)
          mesh.scale.set(finalScale, finalScale, finalScale)

          // 2. Position radial jitter and orientation tilt
          const jitter = EGG_JITTERS[eggIdx % EGG_JITTERS.length]
          const r = Math.sqrt(mesh.position.x * mesh.position.x + mesh.position.z * mesh.position.z)
          const theta = Math.atan2(mesh.position.z, mesh.position.x)
          const newR = r * eggRadius * (1.0 + (jitter.rMult - 1.0) * eggJitter)
          const newTheta = theta + jitter.dTheta * eggJitter
          mesh.position.x = Math.cos(newTheta) * newR
          mesh.position.z = Math.sin(newTheta) * newR
          mesh.position.y += Math.sin(eggIdx * 2.3) * 0.04 * eggJitter

          mesh.rotation.x += jitter.rot[0] * eggJitter
          mesh.rotation.y += jitter.rot[1] * eggJitter
          mesh.rotation.z += jitter.rot[2] * eggJitter

          eggIdx++
        }
      }
    })
    return copy
  }, [eggsCloned, eggSpread, eggJitter, eggRadius])

  // Generate grass blades deterministically
  const grassBlades = useMemo(() => {
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
    return blades
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
      <group position={[0, 0.02, 0]} scale={0.85}>
        <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.65, 0.44, 0.58, 20, 1, true]} />
          <meshStandardMaterial color="#8a5323" roughness={0.92} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.08, 20]} />
          <meshStandardMaterial color="#6d3e17" roughness={0.95} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0.61, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.65, 0.06, 12, 24]} />
          <meshStandardMaterial color="#6d3e17" roughness={0.92} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.64, 0.05, 12, 28, Math.PI]} />
          <meshStandardMaterial color="#6d3e17" roughness={0.92} metalness={0.0} />
        </mesh>
        <mesh position={[0, 1.37, 0]} scale={[1, 0.6, 0.5]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#d4507b" roughness={0.85} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.58, 0.42, 0.32, 18]} />
          <meshStandardMaterial color="#3d8232" roughness={0.95} metalness={0.0} />
        </mesh>
      </group>

      {/* Realistic 3D Easter Eggs Collection with Randomized Sizes & Nestled Jitter */}
      <group position={[0.0, eggY, 0.0]} scale={eggScale}>
        <group position={eggsOffset} scale={eggsScale}>
          {randomizedEggsScene && <primitive object={randomizedEggsScene} />}
        </group>
      </group>

    </group>
  )
}

// ---------------------------------------------------------------------------
// VALENTINE'S 3D PROPS: Ruby Velvet Heart Box & Realistic Rose GLB
// ---------------------------------------------------------------------------

const enhanceHeartBoxMesh = (mesh: THREE.Mesh) => {
  if (mesh.geometry) {
    mesh.geometry.computeVertexNormals()
  }
  if (mesh.material) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((m) => {
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        const std = m as THREE.MeshStandardMaterial
        std.flatShading = false
        std.side = THREE.DoubleSide
        // Tame chocolate shininess to velvety matte finish to prevent specular bloom
        std.roughness = Math.max(std.roughness, 0.92)
        std.metalness = 0.0
        std.needsUpdate = true
      }
    })
  }
}

const HeartBoxProp = ({
  position,
  rotation,
  scale
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}) => {
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    HEARTBOX_PATH,
    0,
    enhanceHeartBoxMesh
  )

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
      <pointLight position={[0, 0.8, 0.2]} color="#ff4d6d" intensity={0.12} distance={2.5} decay={2} />
    </group>
  )
}

const RoseProp = ({
  position,
  rotation,
  scale
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}) => {
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    ROSE_PATH,
    0
  )

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ST. PATRICK'S 3D PROPS: Realistic Pot of Gold GLB
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
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    POT_OF_GOLD_PATH,
    0
  )

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
      <pointLight position={[0, 0.8, 0]} color="#4ade80" intensity={2.4} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// THANKSGIVING 3D PROPS: Realistic Cornucopia & Fresh Baked Pumpkin Pie
// ---------------------------------------------------------------------------

const CornucopiaProp = ({
  position,
  rotationY,
  scale
}: {
  position: [number, number, number]
  rotationY: number
  scale: number
}) => {
  const { cloned, unitScale, offset } = useNormalizedGLTFProp(
    CORNUCOPIA_PATH,
    0
  )

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group position={offset} scale={unitScale}>
        <primitive object={cloned} />
      </group>
      <pointLight position={[0, 1.0, 0]} color="#f59e0b" intensity={2.6} distance={6} decay={2} />
    </group>
  )
}

const PumpkinPieProp = ({
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
  gravestone: {
    position: [4.35, -2.00, -7.50] as [number, number, number],
    rotationY: -1.15,
    scale: 1.20
  },
  yearNeon: {
    position: [2.95, -1.55, -6.80] as [number, number, number],
    rotationY: -0.32,
    scale: 0.95,
    color: '#ffd700',
    intensity: 2.50
  },
  easter: {
    position: [-0.10, -2.00, -2.20] as [number, number, number],
    rotationY: 0.25,
    scale: 0.45,
    eggSpread: 0.15,
    eggScale: 0.50,
    eggY: 0.08,
    eggJitter: 1.00,
    eggRadius: 0.80
  },
  valentinesHeart: {
    position: [-3.90, -1.98, -2.70] as [number, number, number],
    rotation: [0.13, 0.35, 0.00] as [number, number, number],
    scale: 0.60
  },
  valentinesRose: {
    position: [-3.65, -2.02, -2.15] as [number, number, number],
    rotation: [0.20, 0.74, -1.54] as [number, number, number],
    scale: 0.75
  },
  stpatricks: {
    position: [-5.30, -1.93, -5.30] as [number, number, number],
    rotationY: 1.95,
    scale: 0.80
  },
  thanksgivingCornucopia: {
    position: [-4.10, -2.33, -2.50] as [number, number, number],
    rotationY: -0.85,
    scale: 1.25
  },
  thanksgivingPie: {
    position: [-2.35, -1.97, -1.00] as [number, number, number],
    rotationY: -0.40,
    scale: 0.60
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
          <>
            <JackOLanternProp
              position={SCENE_PROP_PARAMS.pumpkin.position}
              rotationY={SCENE_PROP_PARAMS.pumpkin.rotationY}
              scale={SCENE_PROP_PARAMS.pumpkin.scale}
            />
            <HalloweenGravestoneProp
              position={SCENE_PROP_PARAMS.gravestone.position}
              rotationY={SCENE_PROP_PARAMS.gravestone.rotationY}
              scale={SCENE_PROP_PARAMS.gravestone.scale}
            />
          </>
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
            eggY={SCENE_PROP_PARAMS.easter.eggY}
            eggScale={SCENE_PROP_PARAMS.easter.eggScale}
            eggRadius={SCENE_PROP_PARAMS.easter.eggRadius}
            eggSpread={SCENE_PROP_PARAMS.easter.eggSpread}
            eggJitter={SCENE_PROP_PARAMS.easter.eggJitter}
          />
        )}

        {holiday === 'valentines' && (
          <>
            <HeartBoxProp
              position={SCENE_PROP_PARAMS.valentinesHeart.position}
              rotation={SCENE_PROP_PARAMS.valentinesHeart.rotation}
              scale={SCENE_PROP_PARAMS.valentinesHeart.scale}
            />
            <RoseProp
              position={SCENE_PROP_PARAMS.valentinesRose.position}
              rotation={SCENE_PROP_PARAMS.valentinesRose.rotation}
              scale={SCENE_PROP_PARAMS.valentinesRose.scale}
            />
          </>
        )}

        {holiday === 'stpatricks' && (
          <StPatricksProps
            position={SCENE_PROP_PARAMS.stpatricks.position}
            rotationY={SCENE_PROP_PARAMS.stpatricks.rotationY}
            scale={SCENE_PROP_PARAMS.stpatricks.scale}
          />
        )}

        {holiday === 'thanksgiving' && (
          <>
            <CornucopiaProp
              position={SCENE_PROP_PARAMS.thanksgivingCornucopia.position}
              rotationY={SCENE_PROP_PARAMS.thanksgivingCornucopia.rotationY}
              scale={SCENE_PROP_PARAMS.thanksgivingCornucopia.scale}
            />
            <PumpkinPieProp
              position={SCENE_PROP_PARAMS.thanksgivingPie.position}
              rotationY={SCENE_PROP_PARAMS.thanksgivingPie.rotationY}
              scale={SCENE_PROP_PARAMS.thanksgivingPie.scale}
            />
          </>
        )}
      </group>
    </Suspense>
  )
// ---------------------------------------------------------------------------
}