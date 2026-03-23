// FILE: src/components/Experience.tsx
import { Environment, useScroll, Scroll, OrbitControls, Grid, Html  } from '@react-three/drei'
import { useControls } from 'leva'
import { useState, useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three' 
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing' 
import { RobotRig } from './RobotRig.tsx'
import { TurntableSection } from './TurntableSection.tsx'
import { JoinUsSection } from './JoinUsSection.tsx' 
import { IntroSection } from './IntroSection.tsx'
import { StickyNav } from './StickyNav.tsx'
import { getTotalPages, SECTION_ORDER, SECTIONS, getSectionOffsets } from '../ScrollManager'

export const Experience = () => {
  const [isNavVisible, setIsNavVisible] = useState(false)
  const scroll = useScroll()
  const totalPages = getTotalPages()

  const ambientLightRef = useRef<THREE.AmbientLight>(null)
  const dirLightRef = useRef<THREE.DirectionalLight>(null)
  const spotLightRef = useRef<THREE.SpotLight>(null)

  const { debugOrbit } = useControls('Debug', {
    debugOrbit: { value: false, label: 'Unlock Orbit Controls' }
  })

  // --- 1. SCENE COLORS & LIGHTING ---
  const { 
    bgColor, fogColor, floorColor, gridColor, gridSectionColor,
    ambientColor, ambientIntensity, dirLightColor, dirLightIntensity, dirLightPosition, envIntensity,
    darknessLevel, spotPos, spotTarget, spotIntensity, spotColor, spotAngle, spotPenumbra
  } = useControls('Scene Colors & Lights', {
    bgColor: '#c7c7c7',
    fogColor: '#9d9d9d',
    floorColor: '#a0a0a0',
    gridColor: '#af1414',
    gridSectionColor: '#767676',
    ambientColor: '#ffffff',
    ambientIntensity: { value: 0.4, min: 0, max: 2 },
    dirLightColor: '#ffffff',
    dirLightIntensity: { value: 1.5, min: 0, max: 5 },
    dirLightPosition: { value: [5, 10, 5] },
    envIntensity: { value: 0.5, min: 0, max: 2 },
    darknessLevel: { value: 0.95, min: 0, max: 1, step: 0.05, label: 'Turntable Darkness' },
    spotPos: { value: [0, 10, 8], step: 0.1, label: 'Spotlight Pos' },
    spotTarget: { value: [-2, 2, -1], step: 0.1, label: 'Spotlight Target' },
    spotIntensity: { value: 1500, min: 0, max: 5000, label: 'Spotlight Intensity' },
    spotColor: '#ffddbc',
    spotAngle: { value: 0.35, min: 0.1, max: 1.5, step: 0.05 },
    spotPenumbra: { value: 0.9, min: 0, max: 1, step: 0.01 }
  })

  // Create a stable target object for the spotlight to point at
  const spotTargetObj = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
      spotTargetObj.position.set(spotTarget[0], spotTarget[1], spotTarget[2])
  }, [spotTarget])

  // Base colors for interpolation
  const baseBgColor = useMemo(() => new THREE.Color(bgColor), [bgColor])
  const baseFogColor = useMemo(() => new THREE.Color(fogColor), [fogColor])
  const targetDarkColor = useMemo(() => new THREE.Color('#000000'), [])

  // --- 2. EFFECTS ---
  const { parallaxIntensity, bloomThreshold, bloomIntensity } = useControls('Effects', {
    parallaxIntensity: { value: 0.1, min: 0, max: 1, step: 0.05 },
    bloomThreshold: { value: 1.1, min: 0, max: 5, step: 0.1 },
    bloomIntensity: { value: 1.5, min: 0, max: 5, step: 0.1 }
  })

  const { floorHeight } = useControls('Global Floor', {
    floorHeight: { value: -2, min: -5, max: 0, step: 0.1 },
  })

  useFrame((state) => {
    if(scroll) {
      // Calculate Darkness
      const totalScrollUnits = totalPages - 1
      const currentScrollPages = scroll.offset * totalScrollUnits
      const { startPage: turntableStart } = getSectionOffsets('turntable')
      
      let dimProgress = 0
      if (currentScrollPages > turntableStart - 1.0) {
          dimProgress = THREE.MathUtils.clamp((currentScrollPages - (turntableStart - 1.0)) / 1.0, 0, 1)
      }

      // Apply Darkness to Lights
      const currentIntensityFactor = 1.0 - (darknessLevel * dimProgress)
      
      if (ambientLightRef.current) ambientLightRef.current.intensity = ambientIntensity * currentIntensityFactor
      if (dirLightRef.current) dirLightRef.current.intensity = dirLightIntensity * currentIntensityFactor
      
      // Apply Darkness to Environment
      if ('environmentIntensity' in state.scene) {
          (state.scene as any).environmentIntensity = envIntensity * currentIntensityFactor * currentIntensityFactor
      }
      
      // Apply Darkness to Background & Fog
      if (state.scene.background instanceof THREE.Color) {
          state.scene.background.lerpColors(baseBgColor, targetDarkColor, dimProgress * darknessLevel)
      }
      if (state.scene.fog instanceof THREE.Fog) {
          state.scene.fog.color.lerpColors(baseFogColor, targetDarkColor, dimProgress * darknessLevel)
      }

      // Turn on spotlight
      if (spotLightRef.current) spotLightRef.current.intensity = spotIntensity * dimProgress
    }

    if (!debugOrbit) {
      const { pointer, camera } = state
      const targetX = pointer.x * parallaxIntensity
      const targetY = pointer.y * parallaxIntensity
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.05)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05)
      camera.lookAt(0, 0, 0)
    }
  })

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[fogColor, 10, 50]} />
      {debugOrbit && <OrbitControls makeDefault />}
      <Environment preset="city" environmentIntensity={envIntensity} />
      
      <ambientLight ref={ambientLightRef} intensity={ambientIntensity} color={ambientColor} />
      <directionalLight 
        ref={dirLightRef}
        position={dirLightPosition} 
        intensity={dirLightIntensity} 
        color={dirLightColor}
        castShadow 
        shadow-mapSize={[4096, 4096]}
        shadow-normalBias={0.04}
        shadow-bias={-0.0001}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* SPOTLIGHT POINTED AT ACTIVE SLOT */}
       <primitive object={spotTargetObj} />
       <spotLight 
           position={spotPos} 
           ref={spotLightRef}
           target={spotTargetObj} 
           intensity={spotIntensity} 
           color={spotColor}
           angle={spotAngle}
           penumbra={spotPenumbra}
           castShadow 
           decay={2}
           distance={50}
       />

      {/* GLOBAL FLOOR */}
      <group position={[0, floorHeight, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshStandardMaterial color={floorColor} roughness={1} metalness={0} />
        </mesh>
        <Grid
            position={[0, 0.01, 0]}
            args={[40, 40]}
            cellSize={2}
            cellThickness={1}
            cellColor={gridColor}
            sectionSize={5}
            sectionThickness={1}
            sectionColor={gridSectionColor}
            fadeDistance={40}
            fadeStrength={1.5}
            infiniteGrid
        />
      </group>
      {/* Backdrop Portal Wall */}
      <group position={[0, 10, -25]}>
          <mesh receiveShadow>
              <planeGeometry args={[60, 40]} />
              <meshStandardMaterial color={floorColor} roughness={0.9} />
          </mesh>
          <Grid
              position={[0, 0, 0.01]}
              rotation={[Math.PI / 2, 0, 0]}
              args={[60, 40]}
              cellSize={2}
              cellThickness={1}
              cellColor={gridColor}
              sectionSize={5}
              sectionThickness={1.5}
              sectionColor={gridSectionColor}
              fadeDistance={30}
              fadeStrength={1}
          />
      </group>

      {/* SECTIONS */}
      <IntroSection />
      <RobotRig />
      <TurntableSection />
      <JoinUsSection />

      <EffectComposer>
        <Bloom luminanceThreshold={bloomThreshold} mipmapBlur intensity={bloomIntensity} radius={0.6} />
      </EffectComposer>

      <NavWrapper />

      {/* DYNAMIC SCROLL SPACERS */}
      <Scroll html style={{ width: '100%' }}>
        {SECTION_ORDER.map((key) => (
          <section 
            key={key} 
            style={{ 
              height: `${SECTIONS[key] * 100}vh`, 
              pointerEvents: 'none',
            }} 
          />
        ))}
      </Scroll>
    </>
  )
}
const NavWrapper = () => {
  const scroll = useScroll()
  const totalPages = getTotalPages()
  const [isNavVisible, setIsNavVisible] = useState(false)

  useFrame(() => {
    if (scroll) {
      const show = scroll.offset > (1 / totalPages)
      if (show !== isNavVisible) setIsNavVisible(show)
    }
  })

  return (
    <Html 
      portal={{ current: document.body }}
      transform={false}
      calculatePosition={() => [0, 0]}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999999 }}
    >
      <StickyNav isVisible={isNavVisible} />
    </Html>
  )
}
