import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text3D, useScroll, useGLTF, useAnimations, Text } from '@react-three/drei'
import * as THREE from 'three'
import { getSectionOffsets } from '../ScrollManager'
import { getHomeContentSync } from '../services/cms'

const FONT_URL = '/fonts/Montserrat_Regular.json'
const BUTTON_FONT_URL = '/fonts/Montserrat-Regular.ttf' 

// --- NEON SIGN COMPONENT ---
const NeonSign = ({ text, position, color, intensity, size }: any) => {
  return (
    <group position={position}>
      {/* 1. The Black Backing */}
      <Text3D 
        font={FONT_URL} 
        size={size} 
        height={size/5} 
        bevelEnabled 
        bevelSize={0.01} 
        bevelThickness={0.01}
        castShadow
      >
        {text}
        <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.8} />
      </Text3D>
      
      {/* 2. The Emissive Front Layer (slightly offset forward) */}
      <group position={[0, 0, 0.02]}> 
        <Text3D 
          font={FONT_URL} 
          size={size} 
          height={size/6}   
        >
            {text}
            <meshStandardMaterial 
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

// --- HELPER COMPONENT FOR INDIVIDUAL ROBOTS ---
const IntroRobot = ({ path, name, defaultPos, defaultRot, defaultScale }: any) => {
  const group = useRef<THREE.Group>(null)
  
  // @ts-ignore
  const { scene, animations } = useGLTF(path)
  const { actions } = useAnimations(animations, group)
  // @ts-ignore
  const { position, rotation, scale } = { position: defaultPos, rotation: defaultRot, scale: defaultScale }

  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    if (actions && Object.keys(actions).length > 0) {
      const actionName = Object.keys(actions)[0]
      const action = actions[actionName]
      if(action) action.reset().fadeIn(0.5).play()
    }
  }, [scene, actions])

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  )
}

// --- 3D BUTTON COMPONENT ---
const IntroButton = ({ text, index, gap, yPos, scale }: any) => {
    const [hovered, setHovered] = useState(false)
    const xPos = (index - 2) * gap 

    const handlePointerOver = () => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
    }

    const handlePointerOut = () => {
        setHovered(false)
        document.body.style.cursor = 'auto'
    }

    return (
        <group position={[xPos, yPos, 0]}>
            <Text
                font={BUTTON_FONT_URL}
                fontSize={scale}
                color={hovered ? "#a30d0e" : "#333333"}
                anchorX="center"
                anchorY="middle"
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onClick={() => window.location.hash = text === 'Home' ? '#home' : `#${text.toLowerCase()}`}
            >
                {text.toUpperCase()}
            </Text>
            <mesh visible={false}>
                <planeGeometry args={[scale * 4, scale * 1.5]} />
                <meshBasicMaterial color="red" />
            </mesh>
        </group>
    )
}

// --- MAIN COMPONENT ---


export const IntroSection = () => {
  const group = useRef<THREE.Group>(null)
  const scroll = useScroll()
  const { viewport } = useThree()
  const { duration } = getSectionOffsets('intro')
  
  const { 
    textPosition, textSize, textColor, textRoughness, 
    neonColor, neonIntensity, neonSize, neonOffset,
    showRobots, buttonScale, buttonX, buttonY, buttonGap,
  } = {
    textPosition: new THREE.Vector3(-2.8, 0, 0), textSize: 0.4, textColor: '#ab2121', textRoughness: 0.8,
    showRobots: true, neonColor: '#e52b2b', neonIntensity: 7, neonSize: 0.12, neonOffset: new THREE.Vector3(2.5, -0.3, 0.1),
    buttonScale: 0.15, buttonX: 0.8, buttonY: 1.4, buttonGap: 1.6
  }

  // Fetch synchronously to prevent late Suspense from breaking the RobotRig calibration
  const homeData = getHomeContentSync()
  const content = homeData?.intro || {
      title: "The Movement Lab",
      subtitle: "Unifying Movement Intelligence",
       navLinks: ["Home", "People", "Publications", "Courses", "Join"]
     }
  const links = content.navLinks

  useFrame(() => {
    if (!group.current) return
    const scrollOffset = scroll.offset
    const totalPages = scroll.pages 
    
    const currentScrollY = scrollOffset * (totalPages - 1) * viewport.height
    const exitPoint = duration * viewport.height
    const shouldBeVisible = currentScrollY < (exitPoint + viewport.height)

    // Directly mutate the Three.js object to bypass React re-renders!
    group.current.visible = shouldBeVisible
    
    if (!shouldBeVisible) return
    group.current.position.z = -currentScrollY * 0.5
  })

  return (
    <group ref={group}>

      {/* 3D TITLE */}
      <group position={textPosition}>
        <Text3D 
          font={FONT_URL} 
          size={textSize} 
          height={0.2} 
          curveSegments={6}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.02}
          bevelOffset={0.0}
          bevelSegments={5}
          castShadow 
          receiveShadow
        >
          {content.title}
          <meshStandardMaterial 
            color={textColor} 
            metalness={0.1} 
            roughness={textRoughness} 
          />
        </Text3D>
        
        <NeonSign 
          text={content.subtitle}
          position={neonOffset}
          isOn={true}
          color={neonColor}
          intensity={neonIntensity}
          size={neonSize}
        />
      </group>

      {/* GLTF ROBOTS */}
      {showRobots && (
        <group>
             <IntroRobot 
                path="/gltf/g1_lay/g1_lay.gltf"
                name="Robot: Lay"
                defaultPos={[1.45, 0.41, 0]} 
                defaultRot={[-0.07, -1.44, 0]}
                defaultScale={0.5}
            />
            <IntroRobot 
                path="/gltf/g1_sit_loop/g1_sit_loop.gltf"
                name="Robot: Sit (G1)"
                defaultPos={[-2.7, 0.31, 0.07]}
                defaultRot={[0, -1.4, 0]}
                defaultScale={0.5}
            />
            <IntroRobot 
                path="/gltf/run_pose/run_pose.gltf"
                name="Robot: Run Pose"
                defaultPos={[3.5, -2.03, -3.34]}
                defaultRot={[0, -1, 0]}
                defaultScale={1}
            />
            <IntroRobot 
                path="/gltf/sit_loop/sit_loop.gltf"
                name="Robot: Sit (Std)"
                defaultPos={[-3.5, -2, -4]} 
                defaultRot={[0, 0.9, 0]}
                defaultScale={1}
            />
             <IntroRobot 
                path="/gltf/jacks/jacks.gltf"
                name="Robot: Jumping Jacks"
                defaultPos={[1.38, 0.27, 1.8]} 
                defaultRot={[0, 4.42, 0]}
                defaultScale={0.3}
            />
        </group>
      )}

      {/* 3D NAVIGATION BUTTONS */}
      <group position={[buttonX, buttonY, 0]}>
         {links.map((link: any, i: any) => (
             <IntroButton 
                key={link} 
                text={link} 
                index={i} 
                gap={buttonGap} 
                yPos={0} 
                scale={buttonScale} 
             />
         ))}
      </group>

    </group>
  )
}