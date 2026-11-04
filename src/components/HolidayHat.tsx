// FILE: src/components/HolidayHat.tsx
import { useMemo, useRef, useLayoutEffect, Suspense, Fragment } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useFBX, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useHoliday, type HolidayType, isMajorHoliday } from '../utils/holiday'
import { applyHoloShader } from '../utils/holoShader'

const SANTA_HAT_PATH = '/assets/misc/santahat.fbx'
const BUNNY_EARS_PATH = '/assets/misc/bunny_ears.glb'

// Normalized base factor: santahat.fbx is ~69.34 units tall (brim radius ~38 units),
// so multiplying by 1 / 69.34 (0.01442) makes scale=1.0 equal to 1 head-height!
const FBX_UNIT_NORMALIZATION = 1 / 69.34

// Reference base-center & height of the calibrated Santa hat (in normalized hat space).
// Aligning any other hat's AABB bottom-center and height to this reference lets all
// hats share the exact same RIG_HAT_TRANSFORMS.
const SANTA_REF_BASE_CENTER: [number, number, number] = [-0.076, 0.0, -0.001]
const SANTA_REF_HEIGHT = 1.0

// Preload the hat assets so they are ready with the scene
useFBX.preload(SANTA_HAT_PATH)
useGLTF.preload(BUNNY_EARS_PATH, true, true)

export type RigKind = 'ybot' | 'g1'

export interface HatTransformConfig {
  /** Offset in normalized head-height units (+Y is up, +Z is forward, +X is character left) */
  position: [number, number, number]
  /** Euler rotation in radians [pitch (X), yaw (Y), roll (Z)] */
  rotation: [number, number, number]
  /** Uniform scale multiplier relative to 1 head-height */
  scale: number
}

/**
 * Calibrated transform presets for attaching hats to Mixamo Y-Bot vs. Unitree G1 head bones.
 * All coordinates are normalized to `headLength` (the distance from `mixamorigHead` to
 * `mixamorigHeadTop_End`).
 */
export const RIG_HAT_TRANSFORMS: Record<RigKind, HatTransformConfig> = {
  ybot: {
    position: [0.12, -0.42, -0.30],
    rotation: [-0.70, 0.12, -0.16],
    scale: 1.23
  },
  g1: {
    position: [0.02, -0.28, -0.42],
    rotation: [-0.54, 0.44, -0.28],
    scale: 0.85
  }
}

export const HALLOWEEN_HAT_TRANSFORMS: Record<RigKind, HatTransformConfig> = {
  ybot: {
    position: [0.18, -0.42, -0.52],
    rotation: [-1.02, 1.18, 0.08],
    scale: 1.85
  },
  g1: {
    position: [0.21, -0.28, -0.05],
    rotation: [-0.54, -0.38, -0.22],
    scale: 1.53
  }
}

export const EASTER_HAT_TRANSFORMS: Record<RigKind, HatTransformConfig> = {
  ybot: {
    position: [0.12, -0.06, -0.30],
    rotation: [-0.70, 0.12, -0.16],
    scale: 1.15
  },
  g1: {
    position: [0.02, -0.18, 0.00],
    rotation: [0.22, 0.40, -6.36],
    scale: 1.30
  }
}

/** Default probability [0..1] that any given character gets a hat on page load */
const DEFAULT_HAT_SPAWN_CHANCE = 0.55

/** Rotation jitter ranges in radians [pitch, yaw, roll] so each hat sits at a slightly unique angle */
const ROTATION_JITTER_RANGE: [number, number, number] = [0.14, 0.36, 0.16]

interface DetectedHeadBone {
  bone: THREE.Object3D
  rigKind: RigKind
  headLength: number
  shouldRender: boolean
  rotJitter: [number, number, number]
}

const detectRigKind = (headTopBone: THREE.Object3D): RigKind => {
  let curr: THREE.Object3D | null = headTopBone.parent
  while (curr) {
    if (curr.name === 'G1' || curr.name.startsWith('G1')) {
      return 'g1'
    }
    curr = curr.parent
  }
  const py = Math.abs(headTopBone.position.y)
  const pz = Math.abs(headTopBone.position.z)
  if (py > 0 && pz / py < 0.22) {
    return 'g1'
  }
  return 'ybot'
}

const findHeadTopBones = (
  root: THREE.Object3D | null | undefined,
  spawnChance: number
): DetectedHeadBone[] => {
  if (!root) return []
  const results: DetectedHeadBone[] = []

  root.traverse((obj) => {
    if (
      obj.name === 'mixamorigHeadTop_End' ||
      obj.name === 'mixamorig:HeadTop_End'
    ) {
      const len = obj.position.length()
      const headLength = len > 0.0001 ? len : 0.1963
      const shouldRender = spawnChance >= 1.0 ? true : Math.random() < spawnChance
      const rotJitter: [number, number, number] = [
        (Math.random() - 0.5) * ROTATION_JITTER_RANGE[0],
        (Math.random() - 0.5) * ROTATION_JITTER_RANGE[1],
        (Math.random() - 0.5) * ROTATION_JITTER_RANGE[2]
      ]
      results.push({
        bone: obj,
        rigKind: detectRigKind(obj),
        headLength,
        shouldRender,
        rotJitter
      })
    }
  })

  return results
}

/**
 * Loads `/assets/misc/santahat.fbx` once and shares its geometry & material across all characters.
 * Note: `receiveShadow` is disabled and tangent-less `normalMap` is omitted to prevent
 * self-shadowing acne and sub-pixel derivative flickering under the dark Turntable spotlight.
 */
const SantaHatFBXModel = () => {
  const fbx = useFBX(SANTA_HAT_PATH)

  const meshes = useMemo(() => {
    const extracted: {
      geometry: THREE.BufferGeometry
      material: THREE.Material | THREE.Material[]
      position: THREE.Vector3
      rotation: THREE.Euler
      scale: THREE.Vector3
    }[] = []

    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        m.geometry.computeVertexNormals()

        let mat: THREE.Material | THREE.Material[] = m.material
        if (!Array.isArray(mat) && (mat as any).map) {
          const orig = mat as THREE.MeshPhongMaterial
          if (orig.map) {
            orig.map.anisotropy = 4
          }
          mat = new THREE.MeshStandardMaterial({
            map: orig.map,
            roughness: 0.88,
            metalness: 0.0,
            envMapIntensity: 0.15,
            emissive: new THREE.Color('#180606'),
            emissiveIntensity: 0.15,
            side: THREE.FrontSide
          })
        }
        extracted.push({
          geometry: m.geometry,
          material: mat,
          position: m.position.clone(),
          rotation: m.rotation.clone(),
          scale: m.scale.clone()
        })
      }
    })
    return extracted
  }, [fbx])

  return (
    <group scale={FBX_UNIT_NORMALIZATION}>
      {meshes.map((item, i) => (
        <mesh
          key={i}
          geometry={item.geometry}
          material={item.material}
          position={item.position}
          rotation={item.rotation}
          scale={item.scale}
          castShadow
          receiveShadow={false}
        />
      ))}
    </group>
  )
}

/**
 * Computes the bounding box of `root` in `root`'s own local coordinate space,
 * completely ignoring `root.matrix` and all parent/ancestor `matrixWorld` transforms.
 */
export const computeLocalBoundingBox = (root: THREE.Object3D): THREE.Box3 => {
  const box = new THREE.Box3()
  const traverseLocal = (node: THREE.Object3D, parentLocalMatrix: THREE.Matrix4) => {
    node.updateMatrix()
    const currentMatrix =
      node === root
        ? new THREE.Matrix4()
        : new THREE.Matrix4().multiplyMatrices(parentLocalMatrix, node.matrix)

    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh
      if (mesh.geometry) {
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox()
        }
        if (mesh.geometry.boundingBox) {
          const meshBox = mesh.geometry.boundingBox.clone().applyMatrix4(currentMatrix)
          box.union(meshBox)
        }
      }
    }

    for (let i = 0; i < node.children.length; i++) {
      traverseLocal(node.children[i], currentMatrix)
    }
  }

  traverseLocal(root, new THREE.Matrix4())
  return box
}

/**
 * Automatically aligns a hat's AABB (bottom-center and height) to match the
 * calibrated Santa hat reference AABB in pure local space.
 */
const AABBAlignedHat = ({
  children,
  depKey
}: {
  children: React.ReactNode
  depKey: string
}) => {
  const alignRef = useRef<THREE.Group>(null)
  const contentRef = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const alignGroup = alignRef.current
    const contentGroup = contentRef.current
    if (!alignGroup || !contentGroup) return

    const localBox = computeLocalBoundingBox(contentGroup)
    if (localBox.isEmpty()) return

    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    localBox.getSize(size)
    localBox.getCenter(center)

    const s = size.y > 0.0001 ? SANTA_REF_HEIGHT / size.y : 1.0
    alignGroup.scale.setScalar(s)
    alignGroup.position.set(
      SANTA_REF_BASE_CENTER[0] - center.x * s,
      SANTA_REF_BASE_CENTER[1] - localBox.min.y * s,
      SANTA_REF_BASE_CENTER[2] - center.z * s
    )
  }, [depKey])

  return (
    <group ref={alignRef}>
      <group ref={contentRef}>{children}</group>
    </group>
  )
}

const BunnyEarsModel = () => {
  const { scene } = useGLTF(BUNNY_EARS_PATH, true, true)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = false
      }
    })
    return c
  }, [scene])

  return <primitive object={cloned} />
}

/**
 * Fallback primitive models for Halloween and New Year's (until custom assets are added),
 * automatically AABB-aligned to the Santa hat reference frame.
 */
const HolidayHatGeometry = ({
  holiday
}: {
  holiday: Exclude<HolidayType, null>
}) => {
  if (holiday === 'winter') {
    return <SantaHatFBXModel />
  }

  if (holiday === 'halloween') {
    return (
      <AABBAlignedHat depKey="halloween">
        <group>
          <mesh position={[0, 0.025, 0]} castShadow receiveShadow={false}>
            <cylinderGeometry args={[0.64, 0.68, 0.05, 32]} />
            <meshStandardMaterial color="#1f1629" roughness={0.8} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.11, 0]} castShadow receiveShadow={false}>
            <cylinderGeometry args={[0.42, 0.45, 0.13, 24]} />
            <meshStandardMaterial
              color="#ff6b00"
              emissive="#ff4500"
              emissiveIntensity={0.4}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, 0.11, 0.44]} castShadow receiveShadow={false}>
            <boxGeometry args={[0.16, 0.14, 0.05]} />
            <meshStandardMaterial color="#ffb700" roughness={0.25} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.54, -0.03]} rotation={[-0.12, 0, 0.08]} castShadow receiveShadow={false}>
            <coneGeometry args={[0.43, 0.92, 24]} />
            <meshStandardMaterial color="#1f1629" roughness={0.8} metalness={0.1} />
          </mesh>
        </group>
      </AABBAlignedHat>
    )
  }

  if (holiday === 'newyear') {
    return (
      <AABBAlignedHat depKey="newyear">
        <group>
          <mesh position={[0, 0.03, 0]} castShadow receiveShadow={false}>
            <cylinderGeometry args={[0.62, 0.62, 0.06, 32]} />
            <meshStandardMaterial color="#141418" roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.46, 0]} castShadow receiveShadow={false}>
            <cylinderGeometry args={[0.46, 0.42, 0.82, 32]} />
            <meshStandardMaterial color="#141418" roughness={0.35} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.14, 0]} castShadow receiveShadow={false}>
            <cylinderGeometry args={[0.445, 0.435, 0.15, 32]} />
            <meshStandardMaterial
              color="#ffd700"
              emissive="#ffae00"
              emissiveIntensity={0.35}
              roughness={0.2}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[0, 0.28, 0.45]} rotation={[0, 0, Math.PI / 4]} castShadow receiveShadow={false}>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial
              color="#fff3b0"
              emissive="#ffd700"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      </AABBAlignedHat>
    )
  }

  if (holiday === 'easter') {
    return (
      <AABBAlignedHat depKey="easter">
        <BunnyEarsModel />
      </AABBAlignedHat>
    )
  }

  return null
}

interface HoloHatInstanceProps {
  holiday: Exclude<HolidayType, null>
  isHolographic?: boolean
  holoColor?: string
}

const HoloHatInstance = ({
  holiday,
  isHolographic = false,
  holoColor = '#00ccff'
}: HoloHatInstanceProps) => {
  const groupRef = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    if (!isHolographic || !groupRef.current) return
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        applyHoloShader(child as THREE.Mesh, holoColor)
      }
    })
  }, [isHolographic, holoColor, holiday])

  useFrame((state) => {
    if (!isHolographic || !groupRef.current) return
    groupRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && mesh.userData?.shader?.uniforms?.uTime) {
        mesh.userData.shader.uniforms.uTime.value = state.clock.elapsedTime
      }
    })
  })

  return (
    <group ref={groupRef}>
      <HolidayHatGeometry holiday={holiday} />
    </group>
  )
}

export interface CharacterHatProps {
  /** The loaded GLTF scene (or cloned scene) containing the character skeleton */
  scene: THREE.Object3D | null | undefined
  /** Optional override for rig type ('ybot' or 'g1'); auto-detected if omitted */
  rigKindOverride?: RigKind
  /** Probability [0..1] that this character spawns with a hat on page load (default 0.55; pass 1.0 to always show) */
  spawnChance?: number
  /** Additional local position tweak in head-height units */
  positionOffset?: [number, number, number]
  /** Additional local Euler rotation tweak in radians */
  rotationOffset?: [number, number, number]
  /** Additional scale multiplier */
  scaleMultiplier?: number
  /** Whether the hat is visible */
  visible?: boolean
  /** Explicit override for holographic shader appearance */
  isHolographic?: boolean
  /** Holographic tint color (defaults to '#00ccff') */
  holoColor?: string
}

export const CharacterHat = ({
  scene,
  rigKindOverride,
  spawnChance = DEFAULT_HAT_SPAWN_CHANCE,
  positionOffset = [0, 0, 0],
  rotationOffset = [0, 0, 0],
  scaleMultiplier = 1,
  visible = true,
  isHolographic,
  holoColor
}: CharacterHatProps) => {
  const { holiday } = useHoliday()

  const detectedHolo = useMemo(() => {
    if (isHolographic !== undefined) {
      return { isHolo: isHolographic, color: holoColor || '#00ccff' }
    }
    if (!scene) return { isHolo: false, color: '#00ccff' }
    let found = false
    let color = holoColor || '#00ccff'
    scene.traverse((child) => {
      if (!found && (child as THREE.Mesh).isMesh) {
        const u = (child as THREE.Mesh).userData?.shader?.uniforms?.uHoloColor
        if (u && u.value) {
          found = true
          if (!holoColor && (u.value as THREE.Color).getHexString) {
            color = '#' + (u.value as THREE.Color).getHexString()
          }
        }
      }
    })
    return { isHolo: found, color }
  }, [scene, isHolographic, holoColor])

  const headBones = useMemo(
    () => findHeadTopBones(scene, spawnChance),
    [scene, spawnChance]
  )

  if (!holiday || !isMajorHoliday(holiday) || !visible || headBones.length === 0) return null

  return (
    <>
      {headBones.map(({ bone, rigKind: detectedKind, headLength, shouldRender, rotJitter }, idx) => {
        if (!shouldRender) return null

        const kind = rigKindOverride || detectedKind
        const baseConfig: HatTransformConfig =
          holiday === 'halloween'
            ? HALLOWEEN_HAT_TRANSFORMS[kind]
            : holiday === 'easter'
            ? EASTER_HAT_TRANSFORMS[kind]
            : RIG_HAT_TRANSFORMS[kind]

        const finalPos: [number, number, number] = [
          baseConfig.position[0] + positionOffset[0],
          baseConfig.position[1] + positionOffset[1],
          baseConfig.position[2] + positionOffset[2]
        ]
        const finalRot: [number, number, number] = [
          baseConfig.rotation[0] + rotJitter[0] + rotationOffset[0],
          baseConfig.rotation[1] + rotJitter[1] + rotationOffset[1],
          baseConfig.rotation[2] + rotJitter[2] + rotationOffset[2]
        ]
        const hatScale = baseConfig.scale * scaleMultiplier

        const portalKey = `hat-${bone.uuid}-${idx}`
        return (
          <Fragment key={portalKey}>
            {createPortal(
              // Outer group normalizes coordinates so 1.0 unit === 1 headLength in local bone space
              <group scale={headLength}>
                <group
                  position={finalPos}
                  rotation={finalRot}
                  scale={hatScale}
                >
                  <Suspense fallback={null}>
                    <HoloHatInstance
                      holiday={holiday}
                      isHolographic={detectedHolo.isHolo}
                      holoColor={detectedHolo.color}
                    />
                  </Suspense>
                </group>
              </group>,
              bone
            )}
          </Fragment>
        )
      })}
    </>
  )
}
