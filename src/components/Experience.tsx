// FILE: src/components/Experience.tsx
import { Environment, useScroll, Scroll, OrbitControls, Grid, Html  } from '@react-three/drei'
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

  const { debugOrbit } = { debugOrbit: false }

  // --- 1. SCENE COLORS & LIGHTING ---
  const { 
    bgColor, fogColor, floorColor, gridColor, gridSectionColor,
    ambientColor, ambientIntensity, dirLightColor, dirLightIntensity, dirLightPosition, envIntensity,
    darknessLevel, spotPos, spotTarget, spotIntensity, spotColor, spotAngle, spotPenumbra
  } = {
    bgColor: '#c7c7c7', fogColor: '#9d9d9d', floorColor: '#a0a0a0', gridColor: '#af1414', gridSectionColor: '#767676',
    ambientColor: '#ffffff', ambientIntensity: 0.4, dirLightColor: '#ffffff', dirLightIntensity: 1.5, dirLightPosition: new THREE.Vector3(5.0, 10.0, 5.0), envIntensity: 0.5,
    darknessLevel: 0.95, spotPos: new THREE.Vector3(0, 10, 8), spotTarget:new THREE.Vector3(-2.0, 2.0, -1.0), spotIntensity: 1500, spotColor: '#ffddbc', spotAngle: 0.35, spotPenumbra: 0.9
  }

  // Create a stable target object for the spotlight to point at
  const spotTargetObj = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
      spotTargetObj.position.set(spotTarget.x, spotTarget.y, spotTarget.z)
  }, [spotTarget])

  // Base colors for interpolation
  const baseBgColor = useMemo(() => new THREE.Color(bgColor), [bgColor])
  const baseFogColor = useMemo(() => new THREE.Color(fogColor), [fogColor])
  const targetDarkColor = useMemo(() => new THREE.Color('#000000'), [])

  // --- 2. EFFECTS ---
  const { parallaxIntensity, bloomThreshold, bloomIntensity } = { parallaxIntensity: 0.1, bloomThreshold: 1.1, bloomIntensity: 1.5 }

  const { floorHeight } = { floorHeight: -2 }

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
  const[showBackToTop, setShowBackToTop] = useState(false)

  useFrame(() => {
    if (scroll) {
      const show = scroll.offset > (1 / totalPages)
      if (show !== isNavVisible) setIsNavVisible(show)
      
      const showTop = scroll.offset > 0.2
      if (showTop !== showBackToTop) setShowBackToTop(showTop)
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
      {showBackToTop && (
        <button
          onClick={() => scroll.el.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'absolute', bottom: '40px', right: '40px', padding: '15px', fontSize: '20px',
            background: '#af1414', color: 'white', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)', pointerEvents: 'auto', width: '180px', height: '50px',
            display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background 0.3s, transform 0.3s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e31b1b'; e.currentTarget.style.transform = 'scale(1.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#af1414'; e.currentTarget.style.transform = 'scale(1)' }}
        >
          Back to Top ↑
        </button>
      )}
    </Html>
  )
}
