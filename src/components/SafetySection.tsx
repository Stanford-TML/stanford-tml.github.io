import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import { useGLTF, useAnimations, useScroll, Text3D, Html, MeshReflectorMaterial, Grid } from '@react-three/drei'
import { useControls, folder } from 'leva'
import * as THREE from 'three'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { getSectionOffsets, getTotalPages } from '../ScrollManager'

const KICK_ROBOT_PATH = 'gltf/kick_sign/kick_sign.gltf' 
const DEFEAT_ROBOT_PATH = 'gltf/defeat/defeat.gltf'
const PICK_ROBOT_PATH = 'gltf/pick/pick.gltf'
const TREE_PATH = 'assets/meshes/tree.obj'
const FONT_URL = 'Concert One_Regular.json'

// --- PRELOADING ---
useGLTF.preload(KICK_ROBOT_PATH)
useGLTF.preload(DEFEAT_ROBOT_PATH)
useGLTF.preload(PICK_ROBOT_PATH)
// @ts-ignore
useLoader.preload(OBJLoader, TREE_PATH)

// GRASS
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
    const mat = new THREE.MeshStandardMaterial({
      color: "#050505",
      transparent: true,
      opacity: opacity,
      roughness: 1,
      metalness: 0,
    })

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.uniforms.uColor = { value: new THREE.Color(color) }

      // 1. FORCE vUv IN VERTEX SHADER
      shader.vertexShader = `
        varying vec2 vUv;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vUv = uv;
        `
      )

      // 2. DECLARE vUv IN FRAGMENT SHADER AND APPLY LOGIC
      shader.fragmentShader = `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        float noise = fract(sin(dot(vUv * 50.0, vec2(12.9898, 78.233))) * 43758.5453);
        
        // Vertical "blades" based on UV and time
        float grid = sin(vUv.x * 200.0) * sin(vUv.y * 200.0);
        float blades = pow(max(0.0, grid), 5.0) * noise;
        
        // Pulsing wave
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
       <mesh ref={meshRef} material={material}>
         <circleGeometry args={[3, 64]} />
       </mesh>
       <Grid position={[0, 0, 0.01]} args={[6, 6]} sectionSize={1} cellSize={0.2} sectionColor={color} cellColor={color} infiniteGrid />
    </group>
  )
}
// --- SHADER HELPERS ---

const applyIgnitionShader = (material: THREE.MeshStandardMaterial, growth: { value: number }, color: string) => {
    material.color.set('white')
    material.emissive.set(color)
    material.emissiveIntensity = 20
    material.toneMapped = false
    material.transparent = true

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uGrowth = growth
        shader.vertexShader = `
            varying vec3 vLocalPos;
            ${shader.vertexShader}
        `.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vLocalPos = position;`
        )
        shader.fragmentShader = `
            uniform float uGrowth;
            varying vec3 vLocalPos;
            ${shader.fragmentShader}
        `.replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
             // Discard pixels above the growth threshold
             if (vLocalPos.y > uGrowth) discard;
            `
        )
    }
}

const applyHoloShader = (mesh: THREE.Mesh, colorHex: string) => {
    const colorObj = new THREE.Color(colorHex)
    const holoMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1.0, 
        roughness: 1.0,
        metalness: 0.0,
        side: THREE.FrontSide // FrontSide prevents internal geometry Z-fighting
    })

    holoMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 }
        shader.uniforms.uHoloColor = { value: colorObj }
        
        shader.vertexShader = `
            varying vec3 vWorldPos;
            ${shader.vertexShader}
        `
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vWorldPos = worldPosition.xyz;
            `
        )

        shader.fragmentShader = `
            uniform float uTime;
            uniform vec3 uHoloColor;
            varying vec3 vWorldPos;
            ${shader.fragmentShader}
        `
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            
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
            
            gl_FragColor = vec4(intensity, clamp(alpha, 0.0, 1.0));
            `
        )
        mesh.userData.shader = shader
    }
    mesh.material = holoMat
}

// --- SUB-COMPONENTS ---

const NeonLetter = ({ char, position, rotation, isActive, color, intensity, size, isFallen }: any) => {
  const [emissiveIntensity, setEmissiveIntensity] = useState(0)

  useFrame((state) => {
    if (!isActive || isFallen) {
       setEmissiveIntensity(THREE.MathUtils.lerp(emissiveIntensity, 0, 0.2))
       return
    }
    const time = state.clock.elapsedTime
    const noise = Math.sin(time * 20) * 0.2 + (Math.random() > 0.95 ? 1 : 0) 
    const target = intensity + noise
    setEmissiveIntensity(THREE.MathUtils.lerp(emissiveIntensity, target, 0.2))
  })

  return (
    <group position={position} rotation={rotation}>
      <pointLight 
        position={[0.5, 0.5, 1]} 
        intensity={emissiveIntensity } 
        color={color} 
        distance={5} 
        decay={2}
      />
      <Text3D 
        font={FONT_URL} 
        size={size} 
        height={size/5} 
        bevelEnabled 
        bevelSize={0.05} 
        bevelThickness={0.05}
        castShadow
      >
        {char}
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
      </Text3D>
      <group position={[0, 0, 0.2]}> 
        <Text3D font={FONT_URL} size={size} height={size/6}>
            {char}
            <meshStandardMaterial 
                color={(isActive && !isFallen) ? "black" : "#111"} 
                emissive={color} 
                emissiveIntensity={emissiveIntensity} 
                toneMapped={false} 
            />
        </Text3D>
      </group>
    </group>
  )
}

const PickRobot = ({ visible }: { visible: boolean }) => {
    const group = useRef<THREE.Group>(null)
    const { scene, animations } = useGLTF(PICK_ROBOT_PATH)
    const tree = useLoader(OBJLoader, TREE_PATH)
    const { actions } = useAnimations(animations, group)
    
    // Clone tree so we can modify materials without side effects if reused
    const treeClone = useMemo(() => tree.clone(), [tree])

    const { 
        robotPos, robotRot, robotScale,
        treePos, treeScale, treeRot,
        barkColor, leafColor,
        appleName,
        w1, w2, w3
    } = useControls('Safety Section', {
        'Robot: Pick Scene': folder({
        robotPos: { value: [-2.3, -1.02, -1.5], step: 0.01 },
        robotRot: { value: [0, -0.8, 0], step: 0.1 },
        robotScale: { value: 1, min: 0.1, max: 3 },
        treePos: { value: [-1, -1, -1], step: 0.1 },
        treeRot: { value: [0, 0, 0], step: 0.1 },
        treeScale: { value: 0.1, min: 0.001, max: 1, step: 0.01 },
        barkColor: '#8b4513',
        leafColor: '#00ff44',   
        appleName: { value: 'apple001', label: 'Apple Mesh Name' },
        w1: { value: [0.12, 0.28], min: 0, max: 1, label: 'Pick Window 1' },
        w2: { value: [0.4, 0.55], min: 0, max: 1, label: 'Pick Window 2' },
        w3: { value: [0.65, 0.81], min: 0, max: 1, label: 'Pick Window 3' },
        })
    })

    // --- DEBUG LOGS & SHADER SETUP ---
    useEffect(() => {
        if (visible) {
            // @ts-ignore
            treeClone.traverse(c => {
                if ((c as THREE.Mesh).isMesh) {
                    applyHoloShader(c as THREE.Mesh, c.name.toLowerCase().includes('wood') ? barkColor : leafColor)
                }
            })
        }
    }, [scene, treeClone, barkColor, leafColor, visible])

    useFrame((state) => {
        if (!actions || !group.current) return
        
        // Update Shader Time
        treeClone.traverse((child: any) => {
            const mesh = child as THREE.Mesh
            if (mesh.isMesh && mesh.userData.shader) {
                mesh.userData.shader.uniforms.uTime.value = state.clock.elapsedTime
            }
        })

        const action = actions[Object.keys(actions)[0]]
        if (!action) return

        if (!action.isRunning()) action.play()
        
        const clip = action.getClip()
        const duration = clip.duration
        const time = action.time % duration
        const p = time / duration // Normalized progress 0..1
        
        // --- APPLE VISIBILITY LOGIC ---
        const isPicked = 
            (p > w1[0] && p < w1[1]) ||
            (p > w2[0] && p < w2[1]) ||
            (p > w3[0] && p < w3[1])

        const apple = group.current.getObjectByName(appleName)
        if (apple) {
            apple.visible = isPicked
        }
    })

    return (
        <group ref={group} visible={visible}>
            <group position={robotPos} rotation={robotRot} scale={robotScale}>
                <primitive object={scene} />
            </group>
            <primitive 
                object={treeClone} 
                position={treePos} 
                rotation={treeRot}
                scale={treeScale} 
            />
        </group>
    )
}

// --- MAIN SECTION ---

export const SafetySection = () => {
  const group = useRef<THREE.Group>(null)
  
  // KICK SCENE REFS
  const kickGroup = useRef<THREE.Group>(null)
  const defeatGroup = useRef<THREE.Group>(null)
  const tGroup = useRef<THREE.Group>(null)
  const saberGrowth = useRef({ value: -1.0 }) 
  
  const scroll = useScroll()
  const { viewport, gl } = useThree()
  
  // STATE
  const [activeScene, setActiveScene] = useState<'kick' | 'pick'>('kick')
  const [tFallen, setTFallen] = useState(false)
  const [textOpacity, setTextOpacity] = useState(0)
  
  const { 
    sectionVisible, globalOffset,
    kickPos, kickRot, kickScale,
    defeatPos, defeatRot, defeatScale,
    signPos, signScale,
    impactFrame, neonColor, slideDistance,
    textTop, textRight,
    floorPosition, floorScale,
    saberIgniteFrame, saberColor, saberMaxLength
  } = useControls('Safety Section', {
    sectionVisible: true,
    globalOffset: { value: [0, 0, -2], step: 0.1 },
    slideDistance: { value: 25, min: 10, max: 50 },
    textTop: { value: 30, min: 0, max: 100, step: 1 },
    textRight: { value: 10, min: 0, max: 100, step: 1 },
    floorPosition: { value: [-2, -1, -2], step: 0.1 },
    floorScale: { value: 1.5, min: 0.01, max: 5 },
    'Robot: Kick': folder({
        kickPos: { value: [-3, -1, -0.5], step: 0.01 },
        kickRot: { value: [0, 1.5, 0], step: 0.1 },
        kickScale: { value: 1, min: 0.1, max: 3 }
    }),
    'Robot: Defeat': folder({
        defeatPos: { value: [0.7, -2, 0.7], step: 0.1 },
        defeatRot: { value: [0, 10, 0], step: 0.1 },
        defeatScale: { value: 1, min: 0.1, max: 3 }
    }),
    'Sign': folder({
        signPos: { value: [-3.7, -1, -2], step: 0.1 },
        signScale: { value: 1.1, min: 0.5, max: 3 },
        impactFrame: { value: 0.17, min: 0, max: 1, label: 'Kick Impact %' }, 
        neonColor: '#ff4545'
    }),
    'Saber Properties': folder({
        saberIgniteFrame: { value: 0.6, min: 0, max: 1, label: 'Ignite Progress %' },
        saberColor: '#00ff00',
        saberMaxLength: { value: 1.2, min: 0.1, max: 3 }
    }),
  })

  const kickGltf = useGLTF(KICK_ROBOT_PATH, true) as any
  const defeatGltf = useGLTF(DEFEAT_ROBOT_PATH, true) as any

  const { actions: kickActions } = useAnimations(kickGltf?.animations || [], kickGroup)
  const { actions: defeatActions } = useAnimations(defeatGltf?.animations || [], defeatGroup)

  useEffect(() => {
    if (!kickGltf) return
    kickGltf.scene.traverse((child: any) => {
        if (child.isMesh) {
            if (child.name.toLowerCase().includes('blade')) {
                applyIgnitionShader(child.material, saberGrowth.current, saberColor)
            }
        }
    })
  }, [kickGltf, saberColor])

  useFrame((state, delta) => {
    if (!group.current) return

    const { startPage, duration, endPage } = getSectionOffsets('safety')
    const totalPages = getTotalPages()
    
    // --- SCROLL SPLIT LOGIC ---
    // We split the total duration into two halves.
    // Half 1: Kick Scene
    // Half 2: Pick Scene
    
    const scrollY = scroll.offset * (totalPages - 1) * viewport.height
    const sectionStart = startPage * viewport.height
    const sectionLength = duration * viewport.height
    const midPoint = sectionStart + (sectionLength * 0.5)

    let xPos = 0
    let kickAnimProgress = 0
    let currentScene: 'kick' | 'pick' = 'kick'
    let isVisible = false
    
    // Determine Phase
    if (scrollY < midPoint) {
        // --- PHASE 1: KICK SCENE ---
        currentScene = 'kick'
        const phaseLength = sectionLength * 0.5
        const phaseProgress = (scrollY - sectionStart) / phaseLength // 0 to 1
        
        // Animation Logic:
        // 0.0 - 0.2: Slide In (Right -> Center)
        // 0.2 - 0.8: Pinned (Play Animation)
        // 0.8 - 1.0: Slide Out (Center -> Left)

        if (phaseProgress < 0.2) {
             // Entry: 25 -> 0
             const entryP = phaseProgress / 0.2
             xPos = THREE.MathUtils.lerp(slideDistance, 0, entryP)
        } else if (phaseProgress > 0.8) {
             // Exit: 0 -> -37.5
             const exitP = (phaseProgress - 0.8) / 0.2
             xPos = THREE.MathUtils.lerp(0, -slideDistance * 1.5, exitP)
        } else {
             // Pinned
             xPos = 0
             // Map 0.2-0.8 range to 0-1 for animation
             kickAnimProgress = (phaseProgress - 0.2) / 0.6
        }
        
        // Global Entry Check (Before Section)
        if (scrollY < sectionStart) {
            xPos = slideDistance 
            isVisible = scrollY > (sectionStart - viewport.height)
        } else {
            isVisible = true
        }

    } else {
        // --- PHASE 2: PICK SCENE ---
        currentScene = 'pick'
        const phaseLength = sectionLength * 0.5
        const phaseProgress = (scrollY - midPoint) / phaseLength // 0 to 1

        if (phaseProgress < 0.2) {
             // Entry: 25 -> 0
             const entryP = phaseProgress / 0.2
             xPos = THREE.MathUtils.lerp(slideDistance, 0, entryP)
        } else if (phaseProgress > 0.8) {
             // Exit: 0 -> -37.5
             const exitP = (phaseProgress - 0.8) / 0.2
             xPos = THREE.MathUtils.lerp(0, -slideDistance * 1.5, exitP)
        } else {
             xPos = 0
        }
        
        // Global Exit Check
        if (scrollY > (sectionStart + sectionLength)) {
            isVisible = false
        } else {
            isVisible = true
        }
    }

    setActiveScene(currentScene)
    group.current.position.x = xPos
    setTextOpacity(THREE.MathUtils.damp(textOpacity, (isVisible && Math.abs(xPos) < 5) ? 1 : 0, 10, delta))

    // --- KICK SCENE ANIMATION ---
    if (kickActions) {
        const kActionName = Object.keys(kickActions)[0]
        const kAction = kickActions[kActionName]
        if (kAction) {
            const d = kAction.getClip().duration
            kAction.play().paused = true
            
            // Only update time if we are in the Kick scene and pinned
            if (currentScene === 'kick' && xPos === 0) {
                 kAction.time = kickAnimProgress * d
                 kAction.getMixer().update(0)
                 
                 // Logic
                 if (kickAnimProgress > impactFrame) setTFallen(true)
                 else setTFallen(false)
                 
                 const targetGrowth = kickAnimProgress > saberIgniteFrame ? saberMaxLength : -0.1
                 saberGrowth.current.value = THREE.MathUtils.lerp(saberGrowth.current.value, targetGrowth, 0.1)
            }
        }
    }

    if (defeatActions) {
         // Logic for defeat robot...
         // Simple simplified logic: play if fallen
         const dAction = defeatActions[Object.keys(defeatActions)[0]]
         if(dAction && currentScene === 'kick') {
             dAction.play() // Let it loop or run
         }
    }

    // FALLING T
    if (tGroup.current) {
        const targetRotZ = tFallen ? -Math.PI / 2 : 0
        tGroup.current.rotation.x = THREE.MathUtils.lerp(tGroup.current.rotation.x, targetRotZ, 0.15)
        tGroup.current.position.z = THREE.MathUtils.lerp(tGroup.current.position.z, tFallen ? -0.2 : 0, 0.05)
    }
  })

  if (!sectionVisible) return null

  return (
    <group ref={group}>
        <group position={globalOffset}>
            
            {/* FLOOR LOGIC */}
            <group position={floorPosition}>
                {activeScene === 'kick' ? (
                   <group>
                        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={floorScale}>
                            <circleGeometry args={[2, 64]} />
                            <MeshReflectorMaterial
                                mirror={0.7}
                                blur={[300, 100]}
                                resolution={1024}
                                mixBlur={1}
                                mixStrength={40}
                                roughness={1}
                                depthScale={1.2}
                                minDepthThreshold={0.4}
                                maxDepthThreshold={1.4}
                                color="#151515"
                                metalness={0.5}
                            />
                        </mesh>
                        <mesh position={[0, -0.1, 0]} rotation={[0, 0, 0]} scale={floorScale} castShadow receiveShadow>
                            <cylinderGeometry args={[2, 2, 0.1, 64]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                   </group>
                ) : (
                   <group scale={floorScale}>
                       <HoloGrass color={activeScene === 'pick' ? "#00ff44" : "#ff4545"} />
                   </group>
                )}
            </group>

            {/* SCENE 1: KICK */}
            {activeScene === 'kick' && (
                <group>
                    <group ref={kickGroup} position={kickPos} rotation={kickRot} scale={kickScale}>
                        {kickGltf && <primitive object={kickGltf.scene} />}
                    </group>

                    <group position={signPos} scale={signScale}>
                        <group ref={tGroup}>
                            <NeonLetter char="T" position={[0.4, 0, 0]} isActive={true} isFallen={tFallen} color={neonColor} intensity={8} size={1} />
                        </group>
                        <NeonLetter char="M" position={[1.2, 0, 0]} isActive={!tFallen} color={neonColor} intensity={8} size={1} />
                        <NeonLetter char="L" position={[2.4, 0, 0]} isActive={!tFallen} color={neonColor} intensity={8} size={1} />
                    </group>

                    <group ref={defeatGroup} position={defeatPos} rotation={defeatRot} scale={defeatScale}>
                        {defeatGltf && <primitive object={defeatGltf.scene} />}
                    </group>
                </group>
            )}

            {/* SCENE 2: PICK */}
            {activeScene === 'pick' && (
                <PickRobot visible={true} />
            )}

            {/* UI OVERLAY */}
            <Html portal={{ current: gl.domElement.parentNode as HTMLElement }} fullscreen zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                <div 
                onWheel={(e) => { scroll.el.scrollTop += e.deltaY }}
                style={{
                    position: 'absolute', 
                    top: `${textTop}%`, 
                    right: `${textRight}%`,
                    transform: 'translateY(-50%)', 
                    opacity: textOpacity,
                    pointerEvents: textOpacity > 0.1 ? 'auto' : 'none', 
                    transition: 'opacity 0.3s ease-out, top 0.1s, right 0.1s', 
                    width: '350px', 
                    background: 'rgba(255, 255, 255, 0.95)', 
                    padding: '30px',
                    borderRadius: '12px', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    fontFamily: 'sans-serif', 
                    color: '#000', 
                    borderLeft: '4px solid #af1414'
                    }}>
                    
                    {activeScene === 'kick' ? (
                        <>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>Research Topic 04</h3>
                            <h2 style={{ margin: '0 0 15px 0', fontSize: '2rem', fontWeight: '800', lineHeight: '1' }}>
                                Robot Safety
                            </h2>
                            <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.6', color: '#555' }}>
                                When robots interact with the environment, accidents happen. 
                                We study failure cases to build more robust recovery policies and ensure safe human-robot collaboration.
                            </p>
                        </>
                    ) : (
                        <>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>Research Topic 05</h3>
                            <h2 style={{ margin: '0 0 15px 0', fontSize: '2rem', fontWeight: '800', lineHeight: '1' }}>
                                Interaction
                            </h2>
                            <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.6', color: '#555' }}>
                                Precise manipulation requires real-time perception. 
                                Here we demonstrate whole-body coordination for delicate tasks like fruit picking, using soft-contact estimation.
                            </p>
                        </>
                    )}
                </div>
            </Html>
        </group>
    </group>
  )
}