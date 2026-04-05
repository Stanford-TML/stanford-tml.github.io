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

const checkHardwareAcceleration = () => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) || 
               canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true }) as WebGLRenderingContext | null

    if (!gl) return false

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

// Robust Mobile Detection
const checkIsMobile = () => {
  // 1. Standard mobile width check
  if (window.innerWidth < 768) return true;
  
  // 2. Landscape phone check (it might be 900px wide, but only 400px tall!)
  if (window.innerWidth < 950 && window.innerHeight < 500) return true;
  
  // 3. User Agent check (catches phones and tablets regardless of orientation)
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return true;
  console.log("User Agent:", navigator.userAgent);
  
  return false;
}

const HAS_ACCELERATION = checkHardwareAcceleration()

function App() {
  const totalPages = getTotalPages()
  
  // Use the new robust check for our initial state
  const [isMobile, setIsMobile] = useState(checkIsMobile())
  const[currentRoute, setCurrentRoute] = useState(window.location.hash || '#home')

  // Scroll to top on route change to prevent weird scroll positions when navigating
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentRoute])

  useEffect(() => {
    // Re-evaluate on resize (e.g., if a desktop user resizes their window)
    const handleResize = () => setIsMobile(checkIsMobile())
    window.addEventListener('resize', handleResize)
    
    const handleHashChange = () => setCurrentRoute(window.location.hash || '#home')
    window.addEventListener('hashchange', handleHashChange)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('hashchange', handleHashChange)
    }
  },[])

  // Determine if we should show the Lite mode
  const userPref = localStorage.getItem('experiencePref') // returns 'lite', '3d', or null
  
  // If the user picked a preference, honor it. Otherwise, auto-detect based on hardware/mobile.
  const isLiteMode = userPref ? userPref === 'lite' : (isMobile || !HAS_ACCELERATION)

  // Toggle function that saves to local storage and reloads
  const toggleMode = () => {
    const newMode = isLiteMode ? '3d' : 'lite'
    localStorage.setItem('experiencePref', newMode)
    
    // We force a hard reload when switching to completely clear the WebGL context memory
    window.location.reload()
  }

  const validRoutes =['', '#', '#home', '#people', '#publications', '#courses', '#join'];

  const currentPath = window.location.pathname;
  const basePath = import.meta.env.BASE_URL;
  
  // A page is "Not Found" if the path is wrong, OR if the hash is not in our approved list
  const isBadPath = currentPath !== basePath && currentPath !== `${basePath}index.html`;
  const isBadHash = !validRoutes.includes(currentRoute);
  
  const isNotFound = isBadPath || isBadHash;

  // Update isHomePage to require that we aren't on a 404 page
  const isHomePage = !isNotFound && (currentRoute === '' || currentRoute === '#' || currentRoute === '#home');

  const renderPage = () => {
    // 1. If the path or hash is bad, instantly return NotFound
    if (isNotFound) {
      return <NotFound />;
    }

    // 2. Normal Hash Routing
    if (currentRoute === '#people') return <People />
    if (currentRoute === '#publications') return <Publications />
    if (currentRoute === '#courses') return <Courses />
    if (currentRoute === '#join') return <Join />
    
    // Explicitly check for Home
    if (currentRoute === '' || currentRoute === '#' || currentRoute === '#home') {
      
      if (isLiteMode) {
        return <MobileHome />
      }

      return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <LoadingScreen />

          <Canvas shadows camera={{ position: [0, 0, 5], fov: 40 }} gl={{ antialias: true }}>
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

    // This is just a typescript fallback now, the `isNotFound` check catches all bad routes natively
    return <NotFound /> 
  }

  return (
    <>
      {/* ONLY show the Escape Hatch Button on the Home page */}
      {isHomePage && !isMobile && (
        <button
          onClick={toggleMode}
          style={{
            position: 'fixed',
            bottom: '40px',
            left: '40px',
            padding: '15px',
            fontSize: '18px',
            background: '#af1414',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            zIndex: 1000000,
            width: '180px',
            height: '50px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'background 0.3s, transform 0.3s',
            fontFamily: 'Montserrat, sans-serif'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e31b1b'
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#af1414'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {isLiteMode ? "✨ 3D Mode" : "⚡ Lite Mode"}
        </button>
      )}

      {!isNotFound && (currentRoute !== '#home' || isLiteMode) && <StickyNav isVisible={true} />}
      {renderPage()}
      {!isNotFound && (currentRoute !== '#home' || isLiteMode) && <GlobalBackToTop />}
    </>
  )
}

export default App