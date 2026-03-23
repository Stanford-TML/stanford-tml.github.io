// FILE: src/components/RobotRig.tsx
const MODEL_PATH = 'gltf/push/push.gltf'
const BONE_NAME = 'mixamorigRightHand'
const ANIMATION_NAME = 'Y-bot|Y-botAction'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useGraph, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, useScroll, Html, RoundedBox } from '@react-three/drei'
import { getSectionOffsets, getTotalPages } from '../ScrollManager'
import { fetchHomeContent } from '../services/cms'
import { useControls } from 'leva'
import * as THREE from 'three'
import type { GLTF } from 'three-stdlib'

type GLTFResult = GLTF & {
  nodes: { [key: string]: THREE.SkinnedMesh | THREE.Bone }
  materials: { [key: string]: THREE.Material }
}

export const RobotRig = () => {
  const { startPage, duration } = getSectionOffsets('robot')
  const totalPages = getTotalPages()
  const group = useRef<THREE.Group>(null)
  const boxRef = useRef<THREE.Mesh>(null)
  
  const { gl, viewport } = useThree() 
  const scroll = useScroll()

  // --- LEVA CONTROLS ---
  const { 
    startDelay,
    endDelay,
    loopCount, 
    boxSize, 
    boxColor, 
    handOffset, 
    cornerRadius,
    strideTweak,
    debugWireframe
  } = useControls('Animation', {
    startDelay: { value: 0.05, min: 0, max: 0.2, step: 0.01, label: 'Start Delay' },
    endDelay: { value: 0.05, min: 0, max: 0.2, step: 0.01, label: 'End Delay' },
    loopCount: { value: 3, min: 1, max: 20, step: 0.5, label: 'Walk Cycles' },
    boxSize: { value: [7, 4, 1], step: 0.1 },
    boxColor: '#ffffffca',
    cornerRadius: { value: 0.1, min: 0, max: 0.5 },
    handOffset: { value: [-0.05, -0.4, 1.2], step: 0.01 },
    strideTweak: { value: 0, min: -1, max: 1 },
    debugWireframe: false,
  })

  const responsiveScale = viewport.width < 5 ? viewport.width / 5 : 1

  //@ts-ignore
  const { scene, animations } = useGLTF(MODEL_PATH) as GLTFResult
  const { nodes } = useGraph(scene)
  const { actions } = useAnimations(animations, group)
  
  const [bone, setBone] = useState<THREE.Bone | null>(null)
  const [stride, setStride] = useState(0)
  const [calibrationOffset, setCalibrationOffset] = useState(new THREE.Vector3(0,0,0))
  
  const smoothedTime = useRef(0)

  const [content, setContent] = useState({ name: '', title: '', description: '' })

  useEffect(() => {
    const loadContent = async () => {
      const data = await fetchHomeContent()
      if (data && data.robot) setContent(data.robot)
    }
    loadContent()
  },[])

  // --- SETUP ---
  useEffect(() => {
    const foundBone = nodes[BONE_NAME] as THREE.Bone
    if (foundBone) setBone(foundBone)
  }, [nodes])

    useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.frustumCulled = false
      }
    })
  }, [scene])

  // --- CALIBRATION ---
  useLayoutEffect(() => {
    if (!bone || !group.current || !actions[ANIMATION_NAME]) return

    const action = actions[ANIMATION_NAME]!
    const clip = action.getClip()
    const duration = clip.duration
    const mixer = action.getMixer()

    // Measure Stride
    action.reset().play().paused = true
    
    action.time = 0
    mixer.update(0)
    scene.updateMatrixWorld(true)
    const rootBone = nodes['mixamorigHips'] || bone
    const startPos = new THREE.Vector3()
    rootBone.getWorldPosition(startPos)

    action.time = duration
    mixer.update(0)
    scene.updateMatrixWorld(true)
    const endPos = new THREE.Vector3()
    rootBone.getWorldPosition(endPos)

    setStride(endPos.x - startPos.x)

    // Hand Calibration
    action.time = 0
    mixer.update(0)
    scene.updateMatrixWorld(true)

    const handStartPos = new THREE.Vector3()
    bone.getWorldPosition(handStartPos)

    const boxHalfWidth = boxSize[0] / 2
    const targetHandPos = new THREE.Vector3(
      -boxHalfWidth + handOffset[0],
      handOffset[1],
      handOffset[2]
    )

    const diff = new THREE.Vector3().subVectors(targetHandPos, handStartPos)
    setCalibrationOffset(diff)
    
  }, [bone, actions, scene, boxSize, handOffset])


  // --- ANIMATION LOOP ---
  useFrame((state, delta) => {
    const action = actions[ANIMATION_NAME]
    if (!action || !bone || !boxRef.current || !group.current) return

    const clip = action.getClip()
    const clipDuration = clip.duration
    const totalScrollUnits = totalPages - 1
    const currentScrollY = scroll.offset * totalScrollUnits * viewport.height
    
    const {duration: introDuration} = getSectionOffsets('intro')
    const introHeight = introDuration * viewport.height
    const robotHeight = duration * viewport.height
    
    const pinStart = startPage * viewport.height
    const pinEnd = introHeight + robotHeight
    
    let yPos = 0
    
    if (currentScrollY < pinStart) {
      yPos = -pinStart + currentScrollY
    }
    else if (currentScrollY > pinEnd) {
      yPos = currentScrollY - pinEnd
    }
    else {
      yPos = 0
    }

    const pinDistance = pinEnd - pinStart
    const startBuffer = pinDistance * startDelay
    const endBuffer = pinDistance * endDelay
    
    const animStart = pinStart + startBuffer
    const animEnd = pinEnd - endBuffer
    const animDistance = animEnd - animStart

    let animProgress = 0
    if (currentScrollY > animStart && currentScrollY < animEnd) {
      animProgress = (currentScrollY - animStart) / animDistance
    } else if (currentScrollY >= animEnd) {
      animProgress = 1
    }

    const targetTime = animProgress * clipDuration * loopCount
    smoothedTime.current = THREE.MathUtils.damp(smoothedTime.current, targetTime, 10, delta)
    
    const currentAnimTime = smoothedTime.current % clipDuration

    action.time = currentAnimTime
    action.getMixer().update(0)

    const effectiveStride = stride + strideTweak
    
    // FIX: To perfectly remove loop stutters and allow continuous root motion,
    // we take the total linear progression we want, and SUBTRACT the native 
    // root bone offset happening within the clip at this exact frame.
    const walkOffset = (smoothedTime.current / clipDuration) * effectiveStride - (currentAnimTime / clipDuration) * stride
    
    group.current.position.set(
      calibrationOffset.x + walkOffset,
      calibrationOffset.y + yPos,
      calibrationOffset.z
    )

    // Force matrix update so our bone read for the box is completely in sync with the new position
    group.current.updateMatrixWorld(true)

    const currentHandPos = new THREE.Vector3()
    bone.getWorldPosition(currentHandPos)
    
    boxRef.current.position.set(
      currentHandPos.x + (boxSize[0]/2 * responsiveScale) - (handOffset[0] * responsiveScale),
      yPos, 
      1 
    )

    boxRef.current.rotation.set(0, 0, 0)
  })

  return (
    <>
      <group scale={responsiveScale}>
        <group ref={group} dispose={null}>
          <primitive object={scene} />
        </group>
      </group>
      
      <RoundedBox 
        ref={boxRef}
        args={[boxSize[0] * responsiveScale, boxSize[1] * responsiveScale, boxSize[2] * responsiveScale]} 
        radius={cornerRadius * responsiveScale} 
        smoothness={4}
      >
        <meshStandardMaterial 
          color={boxColor} 
          wireframe={debugWireframe}
        />
        
        <Html 
          portal={{ current: gl.domElement.parentNode as HTMLElement }}
          transform 
          // position the pane right in front of the center of the box
          position={[0, 0, (boxSize[2] * responsiveScale) / 2 + 0.01]} 
          // Safe outer scale to prevent CSS matrix floating point precision drift in browsers
          scale={0.1 * responsiveScale}
          style={{ 
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {
            // Make sure scrolling still works if the mouse is over the text box
          }
          <div 
          onWheel={(e) => {
              scroll.el.scrollTop += e.deltaY
            }}
          style={{
            width: '1400px',
            height: '800px', // Matches 7:4 aspect ratio of the 3D box
            background: '#ffffff',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
            userSelect: 'text',
            cursor: 'auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '20px', // Visually mimics 3D box rounded corners
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            fontFamily: 'Montserrat, sans-serif',
            // Inner 2D scale combined with outer 0.1 scale exactly maps 1400px to the 3D box width
            // transform: `scale(${(boxSize[0] / 1400) / 0.1})`, 
            transformOrigin: 'center'
          }}>
            {/* Top Navigation / Branding Bar */}
            <div style={{
              width: '100%',
              height: '100px',
              backgroundColor: '#8C1515', // Stanford Cardinal Red
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 60px',
              boxSizing: 'border-box',
              color: 'white'
            }}>
              <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, letterSpacing: '2px' }}>
                The Movement Lab
              </h1>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 400, opacity: 0.9 }}>
                Stanford University
              </h2>
            </div>

            {/* Main Content Area */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              padding: '80px 60px',
              boxSizing: 'border-box',
              gap: '80px',
              alignItems: 'center',
              backgroundColor: '#f9f9f9'
            }}>
              {/* Profile Sidebar */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                width: '350px',
                flexShrink: 0
              }}>
                <img 
                  src="assets/karen.jpg" 
                  alt={content.name}
                  style={{
                    width: '300px', 
                    height: '300px',
                    objectFit: 'cover',
                    borderRadius: '50%', 
                    border: '8px solid #ffffff',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    marginBottom: '30px'
                  }} 
                />
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{margin: '0 0 10px 0', fontSize: '2.4rem', color: '#2e2d29', fontWeight: 700}}>
                    {content.name}
                  </h2>
                  <p style={{margin: 0, fontSize: '1.4rem', color: '#8C1515', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px'}}>
                    {content.title}
                  </p>
                </div>
              </div>
              
              {/* Description Body */}
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '2rem', 
                  color: '#4d4c47', 
                  lineHeight: '1.6em', 
                  margin: 0,
                  fontWeight: 400
                }}>
                  {content.description}
                </p>
              </div>
            </div>
          </div>
        </Html>
      </RoundedBox>
    </>
  )
}