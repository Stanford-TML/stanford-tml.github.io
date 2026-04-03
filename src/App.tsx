// FILE: src/App.tsx
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import { Suspense, useState, useEffect } from 'react'
import { Experience } from './components/Experience'
import { getTotalPages } from './ScrollManager'
import { LoadingScreen } from './components/LoadingScreen'
import "./App.css";
import { SceneWarmup } from './components/SceneWarmup'
import { MobileHome } from './pages/MobileHome'
import { People } from './pages/People'
import { Join } from './pages/Join'
import { Courses } from './pages/Courses'
import { Publications } from './pages/Publications'
import { StickyNav } from './components/StickyNav'
import { GlobalBackToTop } from './components/GlobalBackToTop'
import { NotFound } from './pages/NotFound'

// NEW: Helper function to detect if true hardware acceleration is available
const checkHardwareAcceleration = () => {
  try {
    const canvas = document.createElement('canvas')
    // failIfMajorPerformanceCaveat rejects the context creation if it's relying on a slow software fallback
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) || 
               canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true }) as WebGLRenderingContext | null

    if (!gl) return false

    // Extra safety: Explicitly check the renderer name to catch sneaky software renderers
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase()
      if (renderer.includes('swiftshader') || renderer.includes('llvmpipe') || renderer.includes('software')) {
        return false
      }
    }
    
    return true
  } catch (e) {
    return false
  }
}

const HAS_ACCELERATION = checkHardwareAcceleration()

function App() {
  const totalPages = getTotalPages()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [currentRoute, setCurrentRoute] = useState(window.location.hash || '#home')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    
    const handleHashChange = () => setCurrentRoute(window.location.hash || '#home')
    window.addEventListener('hashchange', handleHashChange)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('hashchange', handleHashChange)
    }
  },[])

  const renderPage = () => {
    const currentPath = window.location.pathname
    const basePath = import.meta.env.BASE_URL
    
    if (currentPath !== basePath && currentPath !== `${basePath}index.html`) {
      return <NotFound />
    }

    if (currentRoute === '#people') return <People />
    if (currentRoute === '#publications') return <Publications />
    if (currentRoute === '#courses') return <Courses />
    if (currentRoute === '#join') return <Join />
    
    if (currentRoute === '' || currentRoute === '#' || currentRoute === '#home') {
      
      // Serve MobileHome if the screen is small OR if they lack a hardware GPU
      if (isMobile || !HAS_ACCELERATION) {
        return <MobileHome />
      }

      return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <LoadingScreen />

          <Canvas
            shadows
            camera={{ position: [0, 0, 5], fov: 40 }}
            gl={{ antialias: true }}
          >
            <color attach="background" args={['#e0e0e0']} />
            
            <Suspense fallback={null}>
              <ScrollControls pages={totalPages} damping={0.2}>
                <SceneWarmup />
                <Experience />
              </ScrollControls>
            </Suspense>
          </Canvas>
        </div>
      )
    }

    return <NotFound />
  }

  return (
    <>
      {/* Updated conditional rendering for navigation components to also account for !HAS_ACCELERATION */}
      {(currentRoute !== '#home' || isMobile || !HAS_ACCELERATION) && <StickyNav isVisible={true} />}
      {renderPage()}
      {(currentRoute !== '#home' || isMobile || !HAS_ACCELERATION) && <GlobalBackToTop />}
    </>
  )
}

export default App