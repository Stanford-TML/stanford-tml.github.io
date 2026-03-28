import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, useScroll, Text3D, Html, MeshReflectorMaterial } from '@react-three/drei'
import { getSectionOffsets, getTotalPages } from '../ScrollManager'
import * as THREE from 'three'
import { fetchHomeContent } from '../services/cms'

const ROBOT_PATH = '/gltf/run_small/run_small.gltf'
const FONT_URL = '/fonts/Concert One_Regular.json'

export const JoinUsSection = () => {
  const { startPage, duration } = getSectionOffsets('joinUs')
  const totalPages = getTotalPages()
  const group = useRef<THREE.Group>(null)
  const htmlRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  const scroll = useScroll()
  const { viewport, gl, camera } = useThree()

  const [hasTriggered, setHasTriggered] = useState(false)
  const [lightsOn, setLightsOn] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const currentOpacity = useRef(0)

  const [content, setContent] = useState({ titleLine1: '', titleLine2: '', description: '', button: '' })

  useEffect(() => {
    const loadContent = async () => {
      const data = await fetchHomeContent()
      if (data && data.joinUs) setContent(data.joinUs)
    }
    loadContent()
  },[])

  // --- CONTROLS ---
  const {
    mainPosition, mainScale, lettersOffset, letterKerning, lettersRotation, robotPosition, robotRotation, playbackSpeed, fallenTPosition, fallenTRotation, floorPosition, floorScale, textOffset, triggerThreshold, neonColor, neonIntensity
  } = {
    mainPosition: new THREE.Vector3(-1.8, -1, -5),
    mainScale: 1.2,
    lettersOffset: new THREE.Vector3(-3, 0, -2),
    letterKerning: 1.8,
    lettersRotation: new THREE.Euler(0, 0.3, 0),
    robotPosition: new THREE.Vector3(-10.8, 0.0, -3.3),
    robotRotation: new THREE.Euler(0, 0.4, 0),
    playbackSpeed: 1.0,
    fallenTPosition: new THREE.Vector3(-4.2, 0.0, -1.8),
    fallenTRotation: new THREE.Euler(-1.57, 0, 0.2),
    floorPosition: new THREE.Vector3(-2, 0, -1),
    floorScale: 0.6,
    textOffset: new THREE.Vector2(51, -10),
    triggerThreshold: 0.1,
    neonColor: '#ff4545',
    neonIntensity: 8
  }

  const { scene, animations } = useGLTF(ROBOT_PATH)
  const { actions } = useAnimations(animations, group)

  useLayoutEffect(() => {
    if (!scene || !actions) return
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.frustumCulled = false
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    const actionName = Object.keys(actions)[0]
    const action = actions[actionName]
    if (action) {
      action.reset().play().paused = true
      action.time = 0
      action.getMixer().update(0)
    }
    setIsReady(true)
  }, [scene, actions])

  // Background compilation to prevent lag spike when scrolling down
  useEffect(() => {
    const timer = setTimeout(() => {
      if (group.current) gl.compile(group.current, camera)
    }, 2500) // Delay compile well out of the way of initial load
    return () => clearTimeout(timer)
  }, [gl, camera])

  useFrame((state, delta) => {
    if (!group.current) return

    const startY = startPage * viewport.height

    // 1. ADDED DELAY: The animation won't start until we scroll 1 Viewport Height past the start
    const animStart = startY + viewport.height

    // 2. PIN START: The 'lock-in' happens 1 Viewport Height after animation starts
    const pinStart = animStart + viewport.height

    const pinEnd = startY + (duration - 1) * viewport.height

    const currentY = scroll.offset * (totalPages - 1) * viewport.height

    // Visibility optimization
    const isVisible = currentY > (startY - viewport.height * 0.5) && currentY < (pinEnd + viewport.height * 2)

    if (!isVisible) {
      group.current.position.y = -9999
      currentOpacity.current = 0
      if (htmlRef.current) {
        htmlRef.current.style.opacity = '0'
        htmlRef.current.style.pointerEvents = 'none'
      }
      // Hide footer when offscreen
      if (footerRef.current) {
        footerRef.current.style.opacity = '0'
        footerRef.current.style.pointerEvents = 'none'
      }
      return
    }

    // --- POSITION LOGIC ---
    let xPos = 0
    let yPos = 0

    if (currentY < animStart) {
      // PHASE 0: DELAY (Dead Zone) - Stay offscreen
      xPos = -viewport.width * 1.5
    } else if (currentY >= animStart && currentY < pinStart) {
      // PHASE 1: ENTERING - Ease in from left
      const progress = (currentY - animStart) / (pinStart - animStart)
      xPos = -viewport.width * (1 - progress)
    } else if (currentY >= pinStart && currentY <= pinEnd) {
      // PHASE 2: PINNED
      xPos = 0
    } else if (currentY > pinEnd) {
      // PHASE 3: EXITING
      yPos = (currentY - pinEnd)
    }

    group.current.position.set(
      mainPosition.x + xPos,
      mainPosition.y + yPos,
      mainPosition.z
    )

    // --- HTML ANIMATION ---
    if (htmlRef.current) {
      let translateVW = 100
      let translateVH = 0

      if (currentY < animStart) {
        translateVW = 100 // Stay offscreen
      } else if (currentY >= animStart && currentY < pinStart) {
        const progress = (currentY - animStart) / (pinStart - animStart)
        translateVW = 100 * (1 - progress)
      } else if (currentY >= pinStart && currentY <= pinEnd) {
        translateVW = 0
        translateVH = 0
      } else if (currentY > pinEnd) {
        const progress = (currentY - pinEnd) / viewport.height
        translateVH = -100 * progress
        translateVW = 0
      }
      htmlRef.current.style.transform = `translate3d(${translateVW}vw, ${translateVH}vh, 0)`
    }

    // --- ANIMATION TRIGGERS ---
    let pinProgress = 0
    if (currentY > pinStart && currentY < pinEnd) {
      pinProgress = (currentY - pinStart) / (pinEnd - pinStart)
    } else if (currentY >= pinEnd) {
      pinProgress = 1
    }

    if (!hasTriggered && pinProgress > triggerThreshold) {
      setHasTriggered(true)
      const actionName = Object.keys(actions)[0]
      const action = actions[actionName]
      if (action) {
        action.reset()
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
        action.paused = false
        action.play()
      }
    }

    if (hasTriggered && !lightsOn) {
      const actionName = Object.keys(actions)[0]
      const action = actions[actionName]
      if (action) {
        const clipDuration = action.getClip().duration
        if (action.time >= clipDuration * 0.3) {
          setLightsOn(true)
        }
      }
    }

    const action = actions[Object.keys(actions)[0]]
    if (action) {
      action.getMixer().update(delta * playbackSpeed * 0.03)
    }

    // --- OPACITY FADE ---
    let targetOpacity = 0
    if (currentY > animStart + (viewport.height * 0.5)) {
      targetOpacity = 1
    }
    currentOpacity.current = THREE.MathUtils.damp(currentOpacity.current, targetOpacity, 10, delta)

    // Driven purely via DOM ref to avoid react state updates triggering mass DOM re-renders every 16ms
    if (htmlRef.current) {
      htmlRef.current.style.opacity = currentOpacity.current.toString()
      htmlRef.current.style.pointerEvents = currentOpacity.current > 0.1 ? 'auto' : 'none'
    }
    if (footerRef.current) {
      footerRef.current.style.opacity = currentOpacity.current.toString()
      footerRef.current.style.pointerEvents = currentOpacity.current > 0.1 ? 'auto' : 'none'
    }
  })

  const responsiveScale = viewport.width < 5 ? 0.6 : 1
  const letterSize = 1.5

  return (
    <group ref={group} scale={mainScale * responsiveScale} position={[0, -9999, 0]}>

      {/* 1. Fallen T (Off state only) */}
      <group position={fallenTPosition} rotation={fallenTRotation}>
        <Neon3DLetter char="T" position={[0, 0, 0]} isOn={false} color={neonColor} intensity={0} size={letterSize} />
      </group>

      {/* 2. Robot */}
      <group position={robotPosition} rotation={robotRotation}>
        <primitive object={scene} />
      </group>

      {/* 3. Standing Letters (M & L) with Active Lights */}
      <group position={lettersOffset} rotation={lettersRotation}>
        <Neon3DLetter char="M" position={[0, 0, 0]} isOn={lightsOn} color={neonColor} intensity={neonIntensity} size={letterSize} />
        <Neon3DLetter char="L" position={[letterKerning, 0, 0]} isOn={lightsOn} color={neonColor} intensity={neonIntensity} size={letterSize} />
      </group>

      {/* 4. Floor */}
      <mesh position={floorPosition} rotation={[-Math.PI / 2, 0, 0]} scale={floorScale}>
        <circleGeometry args={[5, 64]} />
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
      <mesh position={[floorPosition.x, floorPosition.y - 0.1, floorPosition.z]} rotation={[0, 0, 0]} scale={floorScale} castShadow receiveShadow>
        <cylinderGeometry args={[5, 5, 0.1, 64]} />
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

      {/* 5. HTML Overlay */}
      <Html
        fullscreen
        portal={{ current: gl.domElement.parentNode as HTMLElement }}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none' }}
      >
        {/* SLIDING CONTENT */}
        <div
          onWheel={(e) => { scroll.el.scrollTop += e.deltaY }}
          ref={htmlRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            display: 'flex',
            transform: 'translate3d(100vw, 0, 0)',
            willChange: 'transform'
          }}
        >
          <div style={{ flex: 1 }} />

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingRight: '10%',
            transform: `translate(${textOffset.x}%, ${textOffset.y}%)`,
            pointerEvents: 'auto',
            textAlign: 'left'
          }}>
            <h2 style={{ fontSize: '4rem', margin: 0, textTransform: 'uppercase', lineHeight: 0.9, fontFamily: 'sans-serif', color: 'white' }}>
              {content.titleLine1}<br /> <span style={{ color: '#af1414', textShadow: '0 0 20px #af1414' }}>{content.titleLine2}</span>
            </h2>
            <p style={{ maxWidth: '400px', fontSize: '1.1rem', marginTop: '20px', fontFamily: 'sans-serif', color: '#ffffff' }}>
              {content.description}
            </p>
            <a href="#join" style={{ textDecoration: 'none' }}>
              <button
                className="join-button" // Optional: for external CSS
                style={{
                  marginTop: '30px',
                  padding: '15px 40px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  background: '#af1414',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  width: 'fit-content',
                  boxShadow: '0 0 15px rgba(175, 20, 20, 0.5)',
                  // HOVER LOGIC VIA INLINE TRANSITION
                  transition: 'all 0.2s ease-out',
                }}
                // Standard DOM event handlers for hover effects that don't need React State
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e31b1b';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(227, 27, 27, 0.8)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#af1414';
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(175, 20, 20, 0.5)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {content.button}
              </button>
            </a>

          </div>
        </div>

        {/* STATIC CREDITS FOOTER */}
        <div
          ref={footerRef}
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '15%',
            width: '100%',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#ffffff',
            fontFamily: 'Montserrat, sans-serif',
            letterSpacing: '1px',
            pointerEvents: 'auto',
            opacity: 0, // Starts hidden, driven by useFrame
            willChange: 'opacity'
          }}
        >
          © 2026 The Movement Lab. Site by Jonathan Tseng.
          Additional assets by Mittergen (Sketchfab), neverworks (Thingiverse), and Mixamo.
        </div>
      </Html>
    </group>
  )
}

const Neon3DLetter = ({ char, position, isOn, color, intensity, size }: any) => {
  const [emissiveIntensity, setEmissiveIntensity] = useState(0)

  useFrame((state) => {
    if (!isOn) {
      setEmissiveIntensity(THREE.MathUtils.lerp(emissiveIntensity, 0, 0.1))
      return
    }
    const time = state.clock.elapsedTime
    const noise = Math.sin(time * 20) * 0.2 + (Math.random() > 0.95 ? 1 : 0)
    const target = intensity + noise
    setEmissiveIntensity(THREE.MathUtils.lerp(emissiveIntensity, target, 0.2))
  })

  return (
    <group position={position}>
      <pointLight
        position={[0.5, 0.5, 1]}
        intensity={emissiveIntensity * 2}
        color={color}
        distance={8}
        decay={2}
      />
      <Text3D
        font={FONT_URL}
        size={size}
        height={size / 5}
        bevelEnabled
        bevelSize={0.05}
        bevelThickness={0.05}
        castShadow
      >
        {char}
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
      </Text3D>
      <group position={[0, 0, 0.2]}>
        <Text3D
          font={FONT_URL}
          size={size}
          height={size / 6}
        >
          {char}
          <meshStandardMaterial
            color={isOn ? "black" : "#222"}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            toneMapped={false}
          />
        </Text3D>
      </group>
    </group>
  )
}