// FILE: src/components/RobotRig.tsx
const MODEL_PATH = 'gltf/push/push.gltf'
const BONE_NAME = 'mixamorigRightHand'
const ANIMATION_NAME = 'Y-bot|Y-botAction'

const ANIMATION_CONFIG = {
  startDelay: 0.05,
  endDelay: 0.05,
  loopCount: 3,
  boxSize: [7, 4, 1],
  boxColor: '#ffffffca',
  cornerRadius: 0.1,
  handOffset: [-0.05, -0.4, 1.2],
  strideTweak: 0,
  debugWireframe: false
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useGraph, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, useScroll, Html, RoundedBox } from '@react-three/drei'
import { getSectionOffsets, getTotalPages } from '../ScrollManager'
import { fetchHomeContent } from '../services/cms'
import * as THREE from 'three'
import type { GLTF } from 'three-stdlib'
import { ProgressiveImage } from '../components/ProgressiveImage'

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

  const {
    startDelay, endDelay, loopCount, boxSize, boxColor, handOffset, cornerRadius, strideTweak, debugWireframe
  } = ANIMATION_CONFIG

  const responsiveScale = viewport.width < 5 ? viewport.width / 5 : 1

  //@ts-ignore
  const { scene, animations } = useGLTF(MODEL_PATH) as GLTFResult
  const { nodes } = useGraph(scene)
  const { actions } = useAnimations(animations, group)

  const [bone, setBone] = useState<THREE.Bone | null>(null)
  const [stride, setStride] = useState(0)
  const [calibrationOffset, setCalibrationOffset] = useState(new THREE.Vector3(0, 0, 0))

  const smoothedTime = useRef(0)

  const [content, setContent] = useState({ name: '', title: '', description: '' })

  useEffect(() => {
    const loadContent = async () => {
      const data = await fetchHomeContent()
      if (data && data.robot) setContent(data.robot)
    }
    loadContent()
  }, [])

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

    const { duration: introDuration } = getSectionOffsets('intro')
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
      currentHandPos.x + (boxSize[0] / 2 * responsiveScale) - (handOffset[0] * responsiveScale),
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
          // 1. HALVE THE 3D SCALE (0.1 -> 0.05)
          scale={0.05 * responsiveScale}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {/* Inject a style to force the ProgressiveImage to act as a background cover */}
          <style>{`
            .portal-image-container img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
          `}</style>

          <div
            onWheel={(e) => {
              scroll.el.scrollTop += e.deltaY
            }}
            style={{
              // 2. DOUBLE THE BASE CSS DIMENSIONS
              width: '2800px',  // 1400px -> 2800px
              height: '1600px', // 800px -> 1600px
              background: '#ffffff',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              userSelect: 'text',
              cursor: 'auto',
              display: 'flex',
              flexDirection: 'row', 
              overflow: 'hidden',
              borderRadius: '40px', // 20px -> 40px
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)', // Doubled shadow spread
              fontFamily: 'Montserrat, sans-serif',
              transformOrigin: 'center'
            }}>

            {/* Left Side: Full Height Image */}
            <div className="portal-image-container" style={{
              width: '1100px', // 550px -> 1100px
              height: '100%',
              flexShrink: 0,
              backgroundColor: '#e0e0e0'
            }}>
              <ProgressiveImage highResSrc="assets/cover_photo.jpg" alt={content.name} />
            </div>

            {/* Right Side: Content Area */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '160px 200px', // 80px 100px -> 160px 200px
              boxSizing: 'border-box',
              justifyContent: 'center',
              backgroundColor: '#f9f9f9'
            }}>

              <img 
                src="/assets/SUSig-red.png" 
                alt="Stanford University" 
                style={{ 
                  display: 'block', 
                  height: '5rem', // 2.5rem -> 5rem
                  margin: '0 auto 0 0', 
                  width: 'auto',           
                  objectFit: 'contain'
                }} 
              />

              {/* Description Body */}
              <p style={{
                fontSize: '3.2rem', // 1.6rem -> 3.2rem
                color: '#4d4c47',
                lineHeight: '1.6em',
                margin: '40px 0 100px 0', // 20px 0 50px 0 -> 40px 0 100px 0
                fontWeight: 400
              }}>
                {content.description}
              </p>

              {/* Signature Block */}
              <div style={{
                borderTop: '4px solid #eaeaea', // 2px -> 4px
                paddingTop: '60px', // 30px -> 60px
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'right',
              }}>
                <h2 style={{ 
                  margin: '0 0 16px 0', // 8px -> 16px
                  fontSize: '3.2rem', // 1.6rem -> 3.2rem
                  color: '#2e2d29', 
                  fontWeight: 700 
                }}>
                  - {content.name}
                </h2>
                <p style={{ 
                  margin: 0, 
                  fontSize: '2.4rem', // 1.2rem -> 2.4rem
                  color: '#8C1515', 
                  fontWeight: 600, 
                  textTransform: 'uppercase', 
                  letterSpacing: '2px' // 1px -> 2px
                }}>
                  {content.title}
                </p>
              </div>

            </div>
          </div>
        </Html>
      </RoundedBox>
    </>
  )
}