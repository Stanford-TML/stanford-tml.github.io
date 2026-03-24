import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, useTexture, Text3D, Grid } from '@react-three/drei'
import { useControls, folder } from 'leva'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'

// --- ASSET PATHS ---
const PATHS = {
  kick: '/gltf/kick/kick.gltf',
  sim2real: '/gltf/sim2real/sim2real.gltf',
  fall: '/gltf/fall/fall.gltf',
  football: '/assets/football.jpg',
  safetyKick: '/gltf/kick_sign/kick_sign.gltf',
  safetyDefeat: '/gltf/defeat/defeat.gltf',
  pick: '/gltf/pick/pick.gltf',
  tree: '/assets/meshes/tree.obj',
  muscle: '/gltf/muscle/muscle-v2.glb',
  exo: '/gltf/exo/exo.glb',
  font: '/fonts/Concert One_Regular.json'
}

// Preload
useGLTF.preload(PATHS.kick)
useGLTF.preload(PATHS.sim2real)
useGLTF.preload(PATHS.fall)
useGLTF.preload(PATHS.safetyKick)
useGLTF.preload(PATHS.safetyDefeat)
useGLTF.preload(PATHS.pick)
useGLTF.preload(PATHS.exo)
// @ts-ignore
useLoader.preload(OBJLoader, PATHS.tree)

// --- SHARED UTILS & SHADERS ---

const applyHoloShader = (mesh: THREE.Mesh, colorHex: string) => {
    const colorObj = new THREE.Color(colorHex)
    const holoMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1.0, 
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.FrontSide 
    })

    holoMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 }
        shader.uniforms.uHoloColor = { value: colorObj }

        // Inject uniforms and varyings safely via <common>
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
             varying vec3 vWorldPos;`
        )
        
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
             vWorldPos = worldPosition.xyz;`
        )

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
             uniform float uTime;
             uniform vec3 uHoloColor;
             varying vec3 vWorldPos;`
        )

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float dotProduct = dot(viewDir, vNormal);
            float fresnel = pow(1.0 - abs(dotProduct), 2.0); 
            
            float noise = fract(sin(dot(vWorldPos.xy, vec2(12.9898, 78.233))) * 43758.5453);
            float scanRaw = sin(vWorldPos.y * 200.0 - uTime * 3.0 + (noise * 0.2));
            float scanLine = pow(max(0.0, scanRaw), 0.01 + (noise * 0.04)); 
            
            vec3 intensity = uHoloColor * 0.1; 
            intensity += uHoloColor * scanLine * (2.0 + noise * 2.0); 
            intensity += uHoloColor * fresnel * 3.0; 
            
            float alphaNoise = (noise > 0.5) ? 0.0 : 1.0;
            float alpha = 0.1 + (fresnel * 0.5) + (scanLine * 0.1 * alphaNoise);
            
            gl_FragColor = vec4(intensity, clamp(alpha, 0.0, 1.0));`
        )
        mesh.userData.shader = shader
    }
    mesh.material = holoMat
}

const applyIgnitionShader = (material: THREE.MeshStandardMaterial, color: string) => {
    material.color.set('white')
    material.emissive.set(color)
    material.emissiveIntensity = 20
    material.toneMapped = false
    material.transparent = true
    
    // Create a reference object for the uniform
    const uGrowth = { value: -1.0 }
    material.userData.uGrowth = uGrowth 

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uGrowth = uGrowth
        
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
             varying vec3 vLocalPos;`
        )
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vLocalPos = position;`
        )
        
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
             uniform float uGrowth;
             varying vec3 vLocalPos;`
        )
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
             if (vLocalPos.y > uGrowth) discard;`
        )
    }
}

const HoloGrass = ({ color = "#00ff44", opacity = 1 }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (meshRef.current) {
        const material = meshRef.current.material as THREE.MeshStandardMaterial
        if (material.userData.shader) {
            material.userData.shader.uniforms.uTime.value = state.clock.elapsedTime
        }
    }
  })

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: "#050505", transparent: true, opacity: opacity, roughness: 1, metalness: 0 })
    
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.uniforms.uColor = { value: new THREE.Color(color) }
      
      shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
           varying vec2 vUv;`
      )
      
      shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>', 
          `#include <begin_vertex> 
           vUv = uv;`
      )
      
      shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
           uniform float uTime; 
           uniform vec3 uColor; 
           varying vec2 vUv;`
      )
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>', 
        `
        #include <dithering_fragment>
        float noise = fract(sin(dot(vUv * 50.0, vec2(12.9898, 78.233))) * 43758.5453);
        float grid = sin(vUv.x * 200.0) * sin(vUv.y * 200.0);
        float blades = pow(max(0.0, grid), 5.0) * noise;
        float wave = sin(vUv.y * 10.0 - uTime * 2.0) * 0.5 + 0.5;
        vec3 finalColor = uColor * blades * 5.0 * wave;
        gl_FragColor.rgb += finalColor;
        gl_FragColor.a = clamp(blades + 0.1, 0.0, 1.0);
        `
      )
      mat.userData.shader = shader
    }
    return mat
  }, [color, opacity])

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
       <mesh ref={meshRef} material={material}><circleGeometry args={[3, 64]} /></mesh>
       {/* Removed the Grid component to prevent floating artifact */}
    </group>
  )
}

const NeonLetter = ({ char, position, rotation, isActive, color, intensity, size, isFallen }: any) => {
  const [emissiveIntensity, setEmissiveIntensity] = useState(0)
  useFrame((state) => {
    if (!isActive || isFallen) {
       setEmissiveIntensity(THREE.MathUtils.lerp(emissiveIntensity, 0, 0.2))
       return
    }
    const time = state.clock.elapsedTime
    const noise = Math.sin(time * 20) * 0.2 + (Math.random() > 0.95 ? 1 : 0) 
    setEmissiveIntensity(THREE.MathUtils.lerp(emissiveIntensity, intensity + noise, 0.2))
  })
  return (
    <group position={position} rotation={rotation}>
      <pointLight position={[0.5, 0.5, 1]} intensity={emissiveIntensity} color={color} distance={5} decay={2}/>
      <Text3D font={PATHS.font} size={size} height={size/5} bevelEnabled bevelSize={0.05} bevelThickness={0.05} castShadow>
        {char}<meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
      </Text3D>
      <group position={[0, 0, 0.2]}> 
        <Text3D font={PATHS.font} size={size} height={size/6}>
            {char}<meshStandardMaterial color={(isActive && !isFallen) ? "black" : "#111"} emissive={color} emissiveIntensity={emissiveIntensity} toneMapped={false} />
        </Text3D>
      </group>
    </group>
  )
}

const calculateBallPos = (
    t: number, 
    start: THREE.Vector3, 
    target: THREE.Vector3, 
    gravity: number, 
    ballRadius: number
): { pos: THREE.Vector3, rot: number } => {
    
    // --- Phase A: Incoming (Throw) ---
    // t < 0: Before throw
    // 0 < t < 0.5: In air
    const T_THROW = 0.5
    
    if (t < 0) return { pos: start, rot: 0 }
    
    if (t < T_THROW) {
        const p = t / T_THROW
        const pos = new THREE.Vector3().lerpVectors(start, target, p)
        pos.y += Math.sin(p * Math.PI) * 0.5
        return { pos, rot: p * 5 }
    }
    
    // --- Phase B: Rebound & Drop ---
    // tPhysics starts at 0 when ball hits the target
    const tPhysics = t - T_THROW
    
    // Initial Rebound Velocity (Simulated)
    // Ball hits robot at `target`, bounces off slightly up and away
    const vRebound = new THREE.Vector3(1., 2.0, 1.) 
    
    // Physics Equation: P = P0 + V0*t + 0.5*g*t^2
    const floorY = ballRadius + 0.04
    
    // 1. Calculate trajectory from IMPACT to FLOOR
    // y = target.y + vy*t - 0.5*g*t^2
    // We solve for t when y = floorY to find the first bounce time
    const dy = target.y - floorY
    const a = 0.5 * gravity
    const b = -vRebound.y
    const c = -dy
    
    // Quadratic formula to find time to hit floor: (-b + sqrt(b^2 - 4ac)) / 2a
    // Since we define g as positive 9.8, the equation is y = y0 + vt - 0.5gt^2
    // 0 = (y0 - floor) + vt - 0.5gt^2  =>  0.5gt^2 - vt - (y0-floor) = 0
    const qa = 0.5 * gravity
    const qb = -vRebound.y
    const qc = -(target.y - floorY)
    
    const discriminant = qb*qb - 4*qa*qc
    const timeToFloor = (-qb + Math.sqrt(Math.max(0, discriminant))) / (2*qa)
    
    if (tPhysics < timeToFloor) {
        // Falling from robot to floor
        const curT = tPhysics
        const x = target.x + vRebound.x * curT
        const z = target.z + vRebound.z * curT
        const y = target.y + (vRebound.y * curT) - (0.5 * gravity * curT * curT)
        return { pos: new THREE.Vector3(x, y, z), rot: (T_THROW * 5) + curT * 5 }
    }
    
    // --- Phase C: Floor Bounces ---
    let tBounce = tPhysics - timeToFloor
    let bounceIndex = 0
    let vY = (vRebound.y - gravity * timeToFloor) * -0.6 // Impact velocity * restitution
    let currentY = floorY
    
    // Horizontal velocity persists but decays
    let vX = vRebound.x 
    let vZ = vRebound.z
    
    // Position where it first hits the floor
    let startX = target.x + vRebound.x * timeToFloor
    let startZ = target.z + vRebound.z * timeToFloor
    
    while(true) {
        // Duration of this floor bounce: 2 * vY / g
        const bounceDuration = (2 * vY) / gravity
        
        if (tBounce < bounceDuration) {
             const x = startX + vX * tBounce
             const z = startZ + vZ * tBounce
             const y = floorY + (vY * tBounce) - (0.5 * gravity * tBounce * tBounce)
             return { pos: new THREE.Vector3(x, y, z), rot: 3 * Math.log(5 * t) }
        }
        
        // Next bounce
        tBounce -= bounceDuration
        bounceIndex++
        
        // Update physics for next bounce
        startX += vX * bounceDuration
        startZ += vZ * bounceDuration
        
        vY *= 0.6 // Restitution
        vX *= 0.8 // Friction
        vZ *= 0.8 // Friction
        
        const rollFriction = 0.5
        if (vY < 0.2) {
            // Rolling
            const rollTime = tBounce
            const x = startX + vX * rollTime * Math.pow(rollFriction, rollTime)
            const z = startZ + vZ * rollTime * Math.pow(rollFriction, rollTime)
            return { pos: new THREE.Vector3(x, floorY, z), rot: 3 * Math.log(5 * t) }
        }
    }
}


// --- SCENE 1: DYNAMIC MOTION (Kick) ---
export const SceneDynamicMotion = ({ progress, isActive }: any) => {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(PATHS.kick)
  const { actions } = useAnimations(animations, group)
  
  const { pos, rot, finishProgress } = useControls('Turntable', {
    'Topic 01': folder({
        pos: { value: [3, 0, 8], step: 0.1, label: 'Position' },
        rot: { value: [0, 10, 0], step: 0.1, label: 'Rotation' },
        finishProgress: { value: 0.85, min: 0.5, max: 1.0, label: 'Anim Finish %' }
    })
  })

  useFrame(() => {
    if (!actions || !group.current) return
    const action = actions[Object.keys(actions)[0]]
    if (action) {
      const duration = action.getClip().duration
      action.play().paused = true
      
      // Calculate effective time: Map progress (0 -> 1) to (0 -> finishProgress)
      // Once progress > finishProgress, the animation holds at the last frame.
      const effectiveProgress = Math.min(progress / finishProgress, 1.0)
      
      action.time = effectiveProgress * duration
      action.getMixer().update(0)
    }
  })

  return <group ref={group} position={pos} rotation={rot}><primitive object={scene} /></group>
}

// --- SCENE 2: RETARGETING (Sim2Real) ---
export const SceneRetargeting = ({ isActive }: any) => {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(PATHS.sim2real)
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions } = useAnimations(animations, group)
  
  const { pos, rot, scale, holoColor } = useControls('Turntable', {
    'Topic 02': folder({
        pos: { value: [0, 0, 8], step: 0.1, label: 'Position' },
        rot: { value: [0, 0, 0], step: 0.1, label: 'Rotation' },
        scale: { value: 1, min: 0.1, max: 2, step: 0.1 },
        holoColor: '#00ccff'
    })
  })

  useEffect(() => {
    if (!actions) return
    const action = actions[Object.keys(actions)[0]]
    if (action) {
        action.reset().setLoop(THREE.LoopRepeat, Infinity).play()
    }
  }, [actions])

  // Use layout effect to apply shaders immediately before paint
  useLayoutEffect(() => {
      clonedScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
             const m = child as THREE.Mesh
             if (m.name === 'Alpha_Joints' || m.name === 'Alpha_Surface') applyHoloShader(m, holoColor)
          }
      })
  }, [clonedScene, holoColor])

  useFrame((state) => {
    clonedScene.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && mesh.userData.shader) mesh.userData.shader.uniforms.uTime.value = state.clock.elapsedTime
    })
    if (!actions) return
    const action = actions[Object.keys(actions)[0]]
    if (action) {
        if(!action.isRunning()) action.play()
        action.paused = !isActive
    }
  })

  return <group ref={group} position={pos} rotation={rot} scale={scale}><primitive object={clonedScene} /></group>
}

// --- SCENE 3: PHYSICAL CONSISTENCY (Fall) ---
export const ScenePhysicalConsistency = ({ isActive, progress }: any) => {
  const group = useRef<THREE.Group>(null)
  const ballRef = useRef<THREE.Mesh>(null)
  const { scene, animations } = useGLTF(PATHS.fall)
  const { actions } = useAnimations(animations, group)
  const soccerTexture = useTexture(PATHS.football)

  const { pos, rot, ballStartPos, ballTargetOffset, gravity, ballSize, showBall, animStartOffset } = useControls('Turntable', {
    'Topic 03': folder({
        pos: { value: [2.5, 0, 9], step: 0.1, label: 'Robot Pos' },
        rot: { value: [0, 4, 0], step: 0.1, label: 'Robot Rot' },
        ballStartPos: { value: [2, 1.5, 2], step: 0.1, label: 'Entry Position' },
        ballTargetOffset: { value: [0.1, 0.8, 1.7], step: 0.01, label: 'Impact Offset' }, 
        gravity: { value: 9.8, min: 1, max: 20 },
        ballSize: { value: 0.15, min: 0.05, max: 0.5 },
        showBall: true,
        animStartOffset: { value: 0.2, min: 0, max: 0.5, label: 'Start Delay' }
    })
  })

  useFrame(() => {
    if (!actions) return
    const action = actions[Object.keys(actions)[0]]
    if (action) {
      if(!action.isRunning()) {
          action.play()
          action.paused = true
      }
      const duration = action.getClip().duration
      
      // Offset logic:
      // If progress < animStartOffset, we stay at 0
      // Map (animStartOffset -> 1) to (0 -> 1)
      let adjustedProgress = 0
      if (progress > animStartOffset) {
          adjustedProgress = (progress - animStartOffset) / (1 - animStartOffset)
      }
      
      action.time = adjustedProgress * duration
      action.getMixer().update(0)

      if (ballRef.current && showBall) {
        if (adjustedProgress <= 0.001) {
            ballRef.current.visible = false
        } else {
            ballRef.current.visible = true
            const currentAnimTime = adjustedProgress * duration
            
            // Sync logic: We want the ball to hit the robot at exactly the frame the robot gets hit.
            // Let's assume the robot gets hit at 0.03 * duration (based on previous impactFrame).
            const robotImpactTime = 0.03 * duration
            const physicsImpactTime = 0.5 // T_THROW in helper
            
            // If currentAnimTime == robotImpactTime, we want physicsT == physicsImpactTime
            const timeOffset = physicsImpactTime - robotImpactTime
            const physicsT = currentAnimTime + timeOffset
            
            const start = new THREE.Vector3(...ballStartPos)
            const target = new THREE.Vector3(...ballTargetOffset)
            
            const { pos, rot } = calculateBallPos(physicsT, start, target, gravity, ballSize / 2)
            
            ballRef.current.position.copy(pos)
            ballRef.current.rotation.x = rot
            ballRef.current.rotation.z = -rot
        }
      }
    }
  })

  return (
    <group position={pos} rotation={rot}>
        <group ref={group}><primitive object={scene} /></group>
        {showBall && <mesh ref={ballRef} castShadow receiveShadow><sphereGeometry args={[ballSize, 32, 32]} /><meshStandardMaterial map={soccerTexture} /></mesh>}
    </group>
  )
}

// --- SCENE 4: ROBOT SAFETY (Kick Sign) ---
export const SceneRobotSafety = ({ isActive, progress }: any) => {
    const kickGroup = useRef<THREE.Group>(null)
    const defeatGroup = useRef<THREE.Group>(null)
    const tGroup = useRef<THREE.Group>(null)
    const [tFallen, setTFallen] = useState(false)
    const [sabers, setSabers] = useState<THREE.Material[]>([])
    
    const kickGltf = useGLTF(PATHS.safetyKick, true) as any
    const defeatGltf = useGLTF(PATHS.safetyDefeat, true) as any
    const { actions: kickActions } = useAnimations(kickGltf?.animations || [], kickGroup)
    const { actions: defeatActions } = useAnimations(defeatGltf?.animations || [], defeatGroup)

    const { kickPos, kickRot, defeatPos, defeatRot, signPos, neonColor, impactFrame, saberColor, saberMaxLength, saberIgniteFrame } = useControls('Turntable', {
        'Topic 04': folder({
            kickPos: { value: [-0.7, 0, 8], step: 0.01 },
            kickRot: { value: [0, 1.7, 0], step: 0.1 },
            defeatPos: { value: [2, 0, 9], step: 0.1 },
            defeatRot: { value: [0, 10.5, 0], step: 0.1 },
            signPos: { value: [-1.5, 0, 6.5], step: 0.1 },
            neonColor: '#ff4545',
            impactFrame: { value: 0.17, min: 0, max: 1 }, 
            saberColor: '#59ff59',
            saberMaxLength: { value: 1.2, min: 0.1, max: 3 },
            saberIgniteFrame: { value: 0.6, min: 0, max: 1 }
        })
    })

    // Use LayoutEffect for shaders to prevent flash
    useLayoutEffect(() => {
        if (!kickGltf) return
        const foundSabers: THREE.Material[] = []
        kickGltf.scene.traverse((child: any) => {
            if (child.isMesh && child.name.toLowerCase().includes('blade')) {
                applyIgnitionShader(child.material, saberColor)
                foundSabers.push(child.material)
            }
        })
        setSabers(foundSabers)
    }, [kickGltf, saberColor])

    useFrame(() => {
        // We removed checks for !isActive to ensure we can scrub backwards to 0
        // and reset the scene even if it's inactive (progress will be 0).
        
        if (kickActions) {
            const act = kickActions[Object.keys(kickActions)[0]]
            if (act) {
                const d = act.getClip().duration
                act.play().paused = true
                act.time = progress * d
                act.getMixer().update(0)
                
                // Update fallen state based on progress
                const shouldBeFallen = progress > impactFrame
                if (shouldBeFallen !== tFallen) setTFallen(shouldBeFallen)
            }
        }
        
        // Handle Sabers
        const targetGrowth = progress > saberIgniteFrame ? saberMaxLength : -0.1
        sabers.forEach((mat: any) => {
             if (mat.userData.uGrowth) {
                 mat.userData.uGrowth.value = THREE.MathUtils.lerp(mat.userData.uGrowth.value, targetGrowth, 0.1)
             }
        })

        // Handle Defeated Robot
        if (defeatActions) {
            const act = defeatActions[Object.keys(defeatActions)[0]]
            if (act) {
                if (tFallen) {
                    if (!act.isRunning()) act.reset().play()
                } else {
                    // Reset/Stop if we scrolled back
                    if (act.isRunning()) act.stop()
                }
            }
        }

        if (tGroup.current) {
            const targetRotZ = tFallen ? -Math.PI / 2 : 0
            tGroup.current.rotation.x = THREE.MathUtils.lerp(tGroup.current.rotation.x, targetRotZ, 0.15)
            tGroup.current.position.z = THREE.MathUtils.lerp(tGroup.current.position.z, tFallen ? -0.2 : 0, 0.05)
        }
    })

    return (
        <group>
             <group ref={kickGroup} position={kickPos} rotation={kickRot}><primitive object={kickGltf.scene} /></group>
             <group ref={defeatGroup} position={defeatPos} rotation={defeatRot}><primitive object={defeatGltf.scene} /></group>
             <group position={signPos} scale={1.1}>
                <group ref={tGroup}>
                    <NeonLetter char="T" position={[0.4, 0, 0]} isActive={true} isFallen={tFallen} color={neonColor} intensity={6} size={1} />
                </group>
                <NeonLetter char="M" position={[1.2, 0, 0]} isActive={true && !tFallen} color={neonColor} intensity={6} size={1} />
                <NeonLetter char="L" position={[2.4, 0, 0]} isActive={true && !tFallen} color={neonColor} intensity={6} size={1} />
            </group>
        </group>
    )
}

// --- SCENE 5: INTERACTION (Pick) ---
export const SceneInteraction = ({ isActive }: any) => {
    const group = useRef<THREE.Group>(null)
    const { scene, animations } = useGLTF(PATHS.pick)
    const tree = useLoader(OBJLoader, PATHS.tree)
    const { actions } = useAnimations(animations, group)
    const treeClone = useMemo(() => tree.clone(), [tree])

    const { robotPos, robotRot, treePos, treeScale, barkColor, leafColor, w1, w2, w3, grassPos, grassScale } = useControls('Turntable', {
        'Topic 05': folder({
            robotPos: { value: [-0.5, -0.03, 7.5], step: 0.01 },
            robotRot: { value: [0, -0.8, 0], step: 0.1 },
            treePos: { value: [1, 0, 8], step: 0.1 },
            treeScale: { value: 0.1, min: 0.001, max: 1 },
            barkColor: '#8b4513',
            leafColor: '#00ff44',   
            w1: { value: [0.12, 0.28], min: 0, max: 1 },
            w2: { value: [0.4, 0.55], min: 0, max: 1 },
            w3: { value: [0.65, 0.81], min: 0, max: 1 },
            grassPos: { value: [1, 0.1, 8], step: 0.1 },
            grassScale: { value: 0.75, min: 0.1, max: 5 }
        })
    })

    // Use LayoutEffect to apply shaders immediately. Removed isActive dependency.
    useLayoutEffect(() => {
        // @ts-ignore
        treeClone.traverse(c => {
            if ((c as THREE.Mesh).isMesh) {
                applyHoloShader(c as THREE.Mesh, c.name.toLowerCase().includes('wood') ? barkColor : leafColor)
            }
        })
    }, [treeClone, barkColor, leafColor])

    useFrame((state) => {
        // Shader time update always runs to prevent freeze if visible in bg
        treeClone.traverse((child: any) => {
            if (child.isMesh && child.userData.shader) child.userData.shader.uniforms.uTime.value = state.clock.elapsedTime
        })
        
        if (!actions || !group.current) return
        const action = actions[Object.keys(actions)[0]]
        if (!action) return
        
        // Loop logic
        if (!action.isRunning()) action.play()
        action.paused = !isActive
        
        // Apple visibility logic
        if (isActive) {
            const duration = action.getClip().duration
            const time = action.time % duration
            const p = time / duration 
            
            const isPicked = (p > w1[0] && p < w1[1]) || (p > w2[0] && p < w2[1]) || (p > w3[0] && p < w3[1])
            const apple = group.current.getObjectByName('apple001')
            if (apple) apple.visible = isPicked
        }
    })

    return (
        <group ref={group}>
            <group position={robotPos} rotation={robotRot}><primitive object={scene} /></group>
            <primitive object={treeClone} position={treePos} scale={treeScale} />
            <group position={grassPos} scale={grassScale}><HoloGrass color="#00ff44" opacity={0.6} /></group>
        </group>
    )
}

// --- SCENE 6: MUSCLE (Material & Init Fixes) ---

// Define material once to ensure efficient compilation
const MUSCLE_MATERIAL = new THREE.MeshStandardMaterial({
    color: "#bd4f4f", // Reddish muscle color
    roughness: 0.8,   // Not too shiny
    metalness: 0.1,
    side: THREE.DoubleSide
})

export const SceneMuscle = ({ isActive, progress }: any) => {
    const { gl, camera } = useThree()
    
    // 1. Load Asset
    const { scene, animations } = useGLTF(PATHS.muscle)
    
    // 2. Clone scene
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
    
    // 3. Process Animations: Force Discrete Interpolation (Snapping)
    const processedAnimations = useMemo(() => {
        animations.forEach(clip => {
            // if (!clip.name.includes("vtp"))
                clip.tracks.forEach(track => {
                    track.setInterpolation(THREE.InterpolateDiscrete)
                })
        })
        return animations
    }, [animations])
    
    // 4. Bind Animations
    const { actions, names, mixer } = useAnimations(processedAnimations, clonedScene)

    const [morphMeshes, setMorphMeshes] = useState<THREE.Mesh[]>([])

    const { pos, rot, scale, scrubMode, animSpeed, debugWireframe } = useControls('Turntable', {
        'Topic 06 (Muscle)': folder({
            pos: { value: [0, 0.91, 8], step: 0.1 },
            rot: { value: [1.6, 0, 2], step: 0.1 },
            scale: { value: 1.0, min: 0.1, max: 5 },
            scrubMode: { value: true, label: 'Scrub by Scroll' },
            animSpeed: { value: 0.5, min: 0.1, max: 2, render: (get) => !get('Turntable.Topic 06 (Muscle).scrubMode') },
            debugWireframe: false,
        })
    })

    // 5. Init: Apply Material, Identify Meshes, PRE-COMPILE, and PRE-WARM
    useLayoutEffect(() => {
        const muscles: THREE.Mesh[] = []
        
        clonedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh
                
                // --- A. Identify & Style Muscles ---
                if (m.name.includes("Variant")) {
                    m.material = MUSCLE_MATERIAL
                    m.frustumCulled = false 
                    m.visible = true // Force visible temporarily for the compiler
                    muscles.push(m)
                }
                // --- B. Identify Bones ---
                else if (m.name.includes("vtp")) {
                    m.frustumCulled = false
                    m.visible = true // Ensure bones are always visible
                }
            }
        })
        setMorphMeshes(muscles)

        // --- C. Pre-Compile (Fixes Lag Spike) ---
        gl.compile(clonedScene, camera)

        // --- D. Pre-Warm State (Fixes Initial Invisibility) ---
        const START_TIME = 0.04 
        
        if (actions && names.length > 0) {
            names.forEach((name) => {
                const action = actions[name]
                if (action) {
                    action.play()
                    action.enabled = true
                    action.setEffectiveWeight(1)
                    action.paused = true // Keep paused for explicit time control
                    action.setLoop(THREE.LoopOnce, 1) // Prevent varying clip lengths from looping out of sync
                    action.clampWhenFinished = true
                    action.time = START_TIME
                }
            })
            
            // --- FULL ANIMATION PRE-WARM ---
            // Scrub through the entire timeline to force Three.js to initialize all PropertyBindings,
            // Interpolants, and cache any lazy-evaluated track data for the dozens of muscles.
            const masterAction = actions[names[0]]
            const duration = masterAction?.getClip().duration || 1.0
            
            for (let step = 0; step <= 10; step++) {
                const t = (step / 10) * duration;
                names.forEach(name => {
                    if (actions[name]) actions[name].time = t;
                });
                mixer.update(0);
            }
            
            // Reset to start time
            names.forEach(name => {
                if (actions[name]) actions[name].time = START_TIME;
            });
            mixer.update(0)
            
            // Run visibility logic immediately for the start time
            for (let m = 0; m < muscles.length; m++) {
                const mesh = muscles[m]
                if (!mesh.morphTargetInfluences) continue
                let isActive = false
                const influences = mesh.morphTargetInfluences
                for(let i = 0; i < influences.length; i++) {
                    if (influences[i] > 0.5) {
                        isActive = true
                        break
                    }
                }
                mesh.visible = isActive
            }
        }

    }, [clonedScene, actions, names, mixer, gl, camera])

    // 6. Wireframe Toggle
    useEffect(() => {
        clonedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh
                if (m.material) {
                    (m.material as THREE.MeshStandardMaterial).wireframe = debugWireframe
                }
            }
        })
    }, [debugWireframe, clonedScene])

    // 7. Animation Loop
    useFrame((state, delta) => {
        if (!actions || names.length === 0) return
        
        const masterAction = actions[names[0]]
        const duration = masterAction?.getClip().duration || 1.0
        const START_TIME = 0.04 
        
        let time = START_TIME
        if (scrubMode) {
             time = Math.max(START_TIME, progress * duration)
        } else {
             const autoTime = (state.clock.elapsedTime * animSpeed) % duration
             time = Math.max(START_TIME, autoTime)
        }

        for (let i = 0; i < names.length; i++) {
            const act = actions[names[i]]
            if (act) act.time = time
        }
        mixer.update(0)

        // 8. Fast Visibility Toggle (Thresholding)
        for (let m = 0; m < morphMeshes.length; m++) {
            const mesh = morphMeshes[m]
            if (!mesh.morphTargetInfluences) continue
            
            let isActive = false
            const influences = mesh.morphTargetInfluences
            for(let i = 0; i < influences.length; i++) {
                if (influences[i] > 0.5) {
                    isActive = true
                    break
                }
            }
            mesh.visible = isActive
        }
    })

    return (
        <group position={pos} rotation={rot} scale={scale}>
            <primitive object={clonedScene} />
        </group>
    )
}

export const SceneExo = ({ isActive, progress }: any) => {
    const group = useRef<THREE.Group>(null)
    const explosionRef = useRef<THREE.Mesh>(null)
    const explosionMatRef = useRef<THREE.MeshStandardMaterial>(null)
    const { scene, animations } = useGLTF(PATHS.exo)
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
    const { actions } = useAnimations(animations, group)

    const motionLineGroupRef = useRef<THREE.Group>(null)
    const motionLineMatRef = useRef<THREE.MeshStandardMaterial>(null)
    const lightMatRefs = useRef<THREE.MeshStandardMaterial[]>([])

    const { 
        pos, rot, scale, 
        minRoughness, 
        spotPos, spotIntensity, spotColor, 
        explosionFrame, explosionColor, explosionPos,
        motionLineColor, motionLineRotation, motionLineOffset, motionLineLength, motionLineThickness,
        motionLineSpeed, motionLineOpacity, motionLineIntensity,
        lightIntensity, lightOnFrame
    } = useControls('Turntable', {
        'Topic 07 (Exo)': folder({
            pos: { value: [1, 0.2, 5], step: 0.1 },
            rot: { value: [0, -0.5, 0], step: 0.1 },
            scale: { value: 0.1, min: 0.01, max: 5 },
            minRoughness: { value: 0.4, min: 0, max: 1, step: 0.05 },
            spotPos: { value: [0, 8, 4], step: 0.1 },
            spotIntensity: { value: 0, min: 0, max: 10000 },
            spotColor: '#ffffff',
            explosionFrame: { value: 0.945, min: 0, max: 1, step: 0.005 },
            explosionColor: '#ff8c00',
            explosionPos: { value: [12, -1, 22], step: 0.1 },
            motionLineColor: '#ffffff',
            motionLineOffset: { value: 1.55, min: 0, max: 10, step: 0.01 },
            motionLineRotation: { value:[-0.45, 0, 0.0], step: 0.01 },
            motionLineLength: { value: 11, min: 1, max: 50 },
            motionLineThickness: { value: 2.5, min: 0.05, max: 5 },
            motionLineSpeed: { value: 10, min: 0.1, max: 20, step: 0.1 },
            motionLineOpacity: { value: 0.7, min: 0, max: 1, step: 0.05 },
            motionLineIntensity: { value: 3, min: 0, max: 50, step: 1 },
            lightIntensity: { value: 10, min: 0, max: 100, step: 0.1 },
            lightOnFrame: { value: 0.84, min: 0, max: 1, step: 0.01 }
        })
    })

    useLayoutEffect(() => {
        clonedScene.traverse((child: any) => {
            if (child.isMesh && child.material) {
                // Clone material to avoid affecting other instances
                child.material = child.material.clone()
                if (child.material.roughness !== undefined && child.material.roughness < minRoughness) {
                    child.material.roughness = minRoughness
                }
                
                // Grab reference to the light material
                if (child.material.name && child.material.name.toLowerCase().includes('lightmaterial')) {
                    lightMatRefs.current.push(child.material)
                }
            }
        })
    },[clonedScene, minRoughness])

    useFrame(() => {
        if (!actions || !group.current) return
        const action = actions[Object.keys(actions)[0]]
        if (action) {
            action.play().paused = true
            const duration = action.getClip().duration
            const START_TIME = .5 
            action.time = Math.max(START_TIME, progress * duration)
            action.getMixer().update(0)
        }

        // Light Material Logic
        lightMatRefs.current.forEach((lightMat) => {
            lightMat.emissiveIntensity = progress >= lightOnFrame ? lightIntensity : 0
        })

        // Explosion & Motion Line Logic
        if (progress >= explosionFrame) {
            const expProgress = Math.min((progress - explosionFrame) / 0.1, 1.0)
            
            if (explosionRef.current && explosionMatRef.current) {
                explosionRef.current.visible = true
                const currentScale = 3 + expProgress * 17
                explosionRef.current.scale.set(currentScale, currentScale, currentScale)
                explosionMatRef.current.opacity = 1.0 - expProgress
            }

            if (motionLineGroupRef.current && motionLineMatRef.current) {
                motionLineGroupRef.current.visible = true
                const start = new THREE.Vector3(explosionPos[0], explosionPos[1] + motionLineOffset, explosionPos[2])
                
                motionLineGroupRef.current.position.copy(start)
                // Directly apply Euler angles instead of using lookAt
                motionLineGroupRef.current.rotation.set(motionLineRotation[0], motionLineRotation[1], motionLineRotation[2])
                
                // Apply speed multiplier to the line's expansion
                const lineExpProgress = Math.min(expProgress * motionLineSpeed, 1.0)
                motionLineGroupRef.current.scale.set(motionLineThickness, motionLineThickness, motionLineLength * lineExpProgress)
                
                // Apply opacity multiplier
                motionLineMatRef.current.opacity = Math.max(0, 1.0 - expProgress) * motionLineOpacity
            }
        } else {
            if (explosionRef.current) explosionRef.current.visible = false
            if (motionLineGroupRef.current) motionLineGroupRef.current.visible = false
        }
    })

    return (
        <group ref={group} position={pos} rotation={rot} scale={scale}>
            <spotLight 
                position={spotPos} 
                intensity={spotIntensity} 
                color={spotColor} 
                castShadow 
                distance={20} 
                decay={2} 
                angle={0.8} 
                penumbra={0.5} 
            />
            <primitive object={clonedScene} />
            <mesh ref={explosionRef} visible={false} position={explosionPos}>
                <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial 
                    ref={explosionMatRef} 
                    color={explosionColor} 
                    emissive={explosionColor} 
                    emissiveIntensity={10} 
                    transparent 
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <group ref={motionLineGroupRef} visible={false}>
                <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[1, 1, 1, 16]} />
                    <meshStandardMaterial 
                        ref={motionLineMatRef}
                        color={motionLineColor}
                        emissive={motionLineColor}
                        emissiveIntensity={motionLineIntensity}
                        transparent
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            </group>
        </group>
    )
}