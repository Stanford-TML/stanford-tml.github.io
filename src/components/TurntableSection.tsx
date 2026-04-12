// FILE: src/components/TurntableSection.tsx
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useScroll, MeshReflectorMaterial } from '@react-three/drei'
import { getSectionOffsets, getTotalPages } from '../ScrollManager'
import * as THREE from 'three'
import { fetchTurntable } from '../services/cms'

import { 
    SceneDynamicMotion, 
    SceneRetargeting, 
    SceneRobotSafety,
    SceneInteraction,
    SceneMuscle,
    SceneExo
} from '../components/TurntableScenes'

const SCENES =[
    SceneDynamicMotion,
    SceneRobotSafety,
    SceneInteraction,
    SceneRetargeting,
    SceneMuscle,
    SceneExo
]

export const TurntableSection = () => {
  const TURNTABLE_SIZE = 10
  const outerGroup = useRef<THREE.Group>(null)
  const turntableGroup = useRef<THREE.Group>(null)
  
  const uiRef = useRef<HTMLDivElement>(null)
  const highlightsRef = useRef<HTMLDivElement>(null)
  const scroll = useScroll()
  const { viewport, gl, camera, size } = useThree()
  
  const { 
    position, exitSpeed, scale, textRight, debugForceVisible, animationDelay,
  } = {
    position:[-1, -1.5, -TURNTABLE_SIZE], exitSpeed: 1.0, scale: 1, textRight: 2, debugForceVisible: false, animationDelay: 0.2
  }
  
  const[turntableContent, setTurntableContent] = useState<any[]>([])
  const [activeSlot, setActiveSlot] = useState(0)
  const [currentHighlightIndex, setCurrentHighlightIndex] = useState(0)
  const[isHovered, setIsHovered] = useState(false)
  const [isSectionVisible, setIsSectionVisible] = useState(false)

  // Calculate space in the component body for React rendering
  const currentAspect = size.width / size.height;
  const hasEnoughSpace = (size.width > 1200 && currentAspect > 2.0) || size.width > 1400;

  useEffect(() => {
      setCurrentHighlightIndex(0)
  }, [activeSlot])

  useEffect(() => {
      const currentItem = turntableContent[activeSlot] || turntableContent[0] || {}
      const count = currentItem.highlights?.length || 0
      if (count <= 1 || isHovered) return
      
      const interval = setInterval(() => {
          setCurrentHighlightIndex(prev => (prev + 1) % count)
      }, 5000)
      
      return () => clearInterval(interval)
  }, [activeSlot, turntableContent, isHovered])
  
  const opacityRef = useRef(0)
  const [slotProgress, setSlotProgress] = useState(0)
  const slotEnterTime = useRef(0)
  const [isDelayed, setIsDelayed] = useState(false)

  useEffect(() => {
    const loadContent = async () => {
      try {
        const data = await fetchTurntable()
        if (data && data.length > 0) setTurntableContent(data)
      } catch (error) {
        console.error("Failed to load turntable content", error)
      }
    }
    loadContent()
  },[])

  const contentItem = turntableContent[activeSlot] || turntableContent[0] || {}

  useFrame((state, delta) => {
    if (!outerGroup.current || !turntableGroup.current) return

    // Recalculate space inside useFrame to guarantee fluid 3D sliding on window resize
    const frameAspect = state.size.width / state.size.height;
    // either extremely wide or wide enough with a luxurious aspect ratio
    const frameHasEnoughSpace = (state.size.width > 1200 && frameAspect > 2.0) || state.size.width > 1400;

    const targetX = frameHasEnoughSpace ? position[0] : position[0] - 1.5;

    const {duration: durationPages, startPage} = getSectionOffsets('turntable')
    const totalPages = getTotalPages()
    
    const scrollY = scroll.offset * (totalPages - 1) * viewport.height
    const startY = startPage * viewport.height
    const endY = (startPage + durationPages) * viewport.height

    const isOffScreenUp = scrollY > (endY + viewport.height * 2)
    const isOffScreenDown = scrollY < (startY - viewport.height * 10) 

    let yPos = position[1]
    if (isOffScreenUp || isOffScreenDown) {
        if (!debugForceVisible) yPos = -9999
    } else {
        if (scrollY > endY) {
            yPos = position[1] + (scrollY - endY) * exitSpeed
        }
    }
    
    let newX = outerGroup.current.position.x;
    if (yPos === -9999) {
        newX = targetX; 
    } else {
        newX = THREE.MathUtils.damp(newX, targetX, 5, delta);
    }

    outerGroup.current.position.set(newX, yPos, position[2])

    if (yPos === -9999) return 
    
    const currentScrollPages = scroll.offset * (totalPages - 1)
    let localProgress = 0
    if (currentScrollPages >= startPage) {
      localProgress = (currentScrollPages - startPage) / durationPages
    }
    localProgress = THREE.MathUtils.clamp(localProgress, 0, 1)

    const TOTAL_SLOTS = SCENES.length
    const rawSlot = localProgress * TOTAL_SLOTS
    const currentSlotIndex = Math.min(Math.floor(rawSlot), TOTAL_SLOTS - 1)
    const progressInSlot = rawSlot - currentSlotIndex
    
    if (currentSlotIndex !== activeSlot) {
        const isBackwards = currentSlotIndex < activeSlot
        setActiveSlot(currentSlotIndex)
        slotEnterTime.current = state.clock.elapsedTime - (isBackwards ? (animationDelay + 1) : 0)
        setSlotProgress(isBackwards ? 1 : 0)
        return
    }

    const timeInSlot = state.clock.elapsedTime - slotEnterTime.current
    const _isDelayed = timeInSlot < animationDelay
    if (_isDelayed !== isDelayed) setIsDelayed(_isDelayed)

    const targetProgress = _isDelayed ? 0 : progressInSlot
    
    const wantedProgress = THREE.MathUtils.damp(slotProgress, targetProgress, 6, delta)
    let step = wantedProgress - slotProgress
    const maxStep = 0.8 * delta
    step = THREE.MathUtils.clamp(step, -maxStep, maxStep)
    
    setSlotProgress(slotProgress + step)
    
    const targetRotationY = -currentSlotIndex * ((Math.PI * 2) / TOTAL_SLOTS)
    turntableGroup.current.rotation.y = THREE.MathUtils.damp(turntableGroup.current.rotation.y, targetRotationY, 5, delta)

    const isActive = (currentScrollPages > startPage && currentScrollPages < (startPage + durationPages)) && localProgress > 0
    const targetOpacity = (isActive || debugForceVisible) ? 1 : 0
    
    opacityRef.current = THREE.MathUtils.damp(opacityRef.current, targetOpacity, 10, delta)

    const currentlyVisible = targetOpacity > 0 || opacityRef.current > 0.05
    if (currentlyVisible !== isSectionVisible) {
        setIsSectionVisible(currentlyVisible)
    }
    
    if (uiRef.current) {
        uiRef.current.style.opacity = opacityRef.current.toString()
        uiRef.current.style.pointerEvents = opacityRef.current > 0.1 ? 'auto' : 'none'
    }
    
    if (highlightsRef.current) {
        const hasHighlights = contentItem.highlights && contentItem.highlights.length > 0
        const highlightOpacity = (opacityRef.current > 0.1 && hasHighlights && frameHasEnoughSpace) ? opacityRef.current : 0
        
        highlightsRef.current.style.opacity = highlightOpacity.toString()
        highlightsRef.current.style.pointerEvents = highlightOpacity > 0.1 ? 'auto' : 'none'
        // highlightsRef.current.style.display = highlightOpacity > 0.01 ? 'auto' : 'none'
    }
  })

  const responsiveScale = viewport.width < 5 ? 0.8 : 1
  const finalScale = responsiveScale * scale

  useEffect(() => {
    if (!turntableGroup.current) return
    const timer = setTimeout(() => {
        const scenes = turntableGroup.current!.children
        const hiddenObjects: THREE.Object3D[] =[]
        scenes.forEach(child => {
            child.traverse((c: any) => {
               c.frustumCulled = false 
               if (!c.visible) {
                   c.visible = true
                   hiddenObjects.push(c)
               }
            })
            gl.compile(child, camera)
        })
        hiddenObjects.forEach(c => c.visible = false)
    }, 50)
    return () => clearTimeout(timer)
  }, [gl, camera])

  // A unified smart scroll handler that perfectly handles nested overflow divs
  const handleSmartScroll = (e: React.WheelEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const isScrollable = el.scrollHeight > el.clientHeight;
      const isAtTop = el.scrollTop === 0;
      const isAtBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 1;

      if (isScrollable) {
          if ((e.deltaY < 0 && !isAtTop) || (e.deltaY > 0 && !isAtBottom)) {
              e.stopPropagation();
              return; 
          }
      }
      scroll.el.scrollTop += e.deltaY;
  };

  // Reusable Highlights Renderer (Injects Left or Right based on layout)
  const renderHighlightsCarousel = (isCompact: boolean) => {
      const align = isCompact ? 'left' : 'right';
      return (
        <>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#aaa', letterSpacing: '2px', textTransform: 'uppercase', textAlign: align, flexShrink: 0 }}>
              Lab Highlights
            </h3>
            <div style={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
                <div style={{ display: 'flex', width: '100%', height: '100%', transition: 'transform 0.5s ease-in-out', transform: `translateX(-${currentHighlightIndex * 100}%)` }}>
                    {contentItem.highlights && contentItem.highlights.map((hl: any, i: number) => (
                        <div key={i} style={{
                            flex: '0 0 100%', width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                            textAlign: align, paddingRight: isCompact ? '0' : '10px', boxSizing: 'border-box', overflowY: 'auto'
                        }}>
                            {hl.title && <h4 style={{ margin: '0 0 12px 0', fontSize: '1.3rem', color: '#fff', fontWeight: '700', wordWrap: 'break-word' }}>{hl.title}</h4>}
                            {hl.description && <p style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#bbb', lineHeight: '1.5', wordWrap: 'break-word', whiteSpace: 'normal' }}>{hl.description}</p>}
                            {hl.link && <a href={hl.link} target="_blank" rel="noreferrer" style={{ display: 'inline-block', margin: '0 0 15px 0', fontSize: '1rem', color: '#af1414', lineHeight: '1.5', textDecoration: 'none', fontWeight: 'bold' }}>Read More →</a>}
                            
                            {hl.videoType === 'youtube' && hl.videoId && (
                                <div style={{ marginTop: '15px', marginBottom: '15px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                    {isSectionVisible && (
                                        <iframe width="100%" 
                                        height="180" 
                                        src={`https://www.youtube.com/embed/${hl.videoId}`} 
                                        title="YouTube video player" 
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen></iframe>
                                    )}
                                </div>
                            )}
                            {hl.videoType === 'upload' && hl.videoUrl && (
                                <div style={{ marginTop: '15px', marginBottom: '15px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                    {/* Only mount the video tag if the section is actually visible */}
                                    {isSectionVisible && (
                                        <video 
                                            src={hl.videoUrl}
                                            disablePictureInPicture 
                                            controlsList="nodownload"
                                            width="100%" 
                                            height="auto" 
                                            style={{ maxHeight: '180px', objectFit: 'cover', borderRadius: '8px' }} 
                                            controls 
                                            autoPlay 
                                            muted 
                                            loop
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {contentItem.highlights && contentItem.highlights.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexShrink: 0 }}>
                    <button onClick={() => setCurrentHighlightIndex(prev => (prev - 1 + contentItem.highlights.length) % contentItem.highlights.length)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}>←</button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {contentItem.highlights.map((_: any, idx: number) => (
                            <div key={idx} style={{ width: '8px', height: '8px', borderRadius: '50%', background: idx === currentHighlightIndex ? '#af1414' : 'rgba(255,255,255,0.3)', transition: 'background 0.3s' }} />
                        ))}
                    </div>
                    <button onClick={() => setCurrentHighlightIndex(prev => (prev + 1) % contentItem.highlights.length)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}>→</button>
                </div>
            )}
        </>
      )
  };

  return (
    <group ref={outerGroup} scale={finalScale}>
       <group ref={turntableGroup}>
           {SCENES.map((SceneComponent, index) => {
               const slotAngle = index * ((Math.PI * 2) / SCENES.length)
               const isCurrentSlot = activeSlot === index
               return (
                   <group key={index} rotation={[0, slotAngle, 0]}>
                       <SceneComponent isActive={isCurrentSlot && !isDelayed} progress={isCurrentSlot ? slotProgress : (activeSlot > index ? 1 : 0)} />
                   </group>
               )
           })}

           <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
             <circleGeometry args={[TURNTABLE_SIZE, 64]} />
             <MeshReflectorMaterial mirror={0.2} blur={[300, 100]} resolution={1024} mixBlur={1} mixStrength={40} roughness={0.7} depthScale={1.2} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#151515" metalness={0.5} />
           </mesh>
           <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0]} receiveShadow castShadow>
             <cylinderGeometry args={[TURNTABLE_SIZE, TURNTABLE_SIZE, 0.2, 64]} />
             <meshStandardMaterial color="#111" />
           </mesh>
       </group>

      <Html 
        portal={{ current: gl.domElement.parentNode as HTMLElement }}  
        calculatePosition={() => [0, 0]}
        zIndexRange={[100, 0]} 
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none' }}
      >
        
        {/* Right Panel (Description AND Conditional Highlights) */}
        <div ref={uiRef} 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onWheel={handleSmartScroll}
          style={{
              position: 'absolute', top: '10%', bottom: '5%', right: `${textRight}%`, width: '450px', 
              background: 'rgba(20, 20, 20, 0.85)', padding: '40px', opacity: 0, pointerEvents: 'none', 
              transition: 'opacity 0.1s ease-out', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', fontFamily: 'sans-serif', 
              color: '#fff', borderLeft: '4px solid #af1414', overflowY: 'auto', display: 'flex', flexDirection: 'column'
            }}>
          
          <div style={{ flexShrink: 0 }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#aaa', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {contentItem.label}
              </h3>
              <h2 style={{ margin: '0 0 15px 0', fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.1' }}>
                {contentItem.title}
              </h2>
              <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.6', color: '#ccc' }}>
                {contentItem.description}
              </p>
          </div>

          {/* Inject the Highlights Component underneath if there is NOT enough space for a dual-panel layout */}
          {!hasEnoughSpace && contentItem.highlights && contentItem.highlights.length > 0 && (
             <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', minHeight: '400px', flexShrink: 0 }}>
                 {renderHighlightsCarousel(true)}
             </div>
          )}
        </div>

        {/* Left Panel (Classic Highlights) */}
        <div ref={highlightsRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onWheel={handleSmartScroll}
          style={{
              position: 'absolute', top: '10%', bottom: '5%', left: `${textRight}%`, width: '400px', 
              background: 'rgba(20, 20, 20, 0.85)', padding: '40px', pointerEvents: 'none', 
              opacity: 0,
              transition: 'opacity 0.1s ease-out, border 0.3s ease, box-shadow 0.3s ease', backdropFilter: 'blur(10px)', 
              border: isHovered ? '1px solid rgba(175, 20, 20, 0.5)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', boxShadow: isHovered ? '0 20px 40px rgba(175, 20, 20, 0.15)' : '0 20px 40px rgba(0,0,0,0.5)',
              fontFamily: 'sans-serif', color: '#fff', borderRight: '4px solid #af1414', overflow: 'hidden', 
              display: 'flex', flexDirection: 'column'
            }}>
            
            {hasEnoughSpace && renderHighlightsCarousel(false)}
        </div>

      </Html>
    </group>
  )
}