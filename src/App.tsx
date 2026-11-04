// FILE: src/App.tsx
import { Suspense, lazy, useState, useEffect } from 'react'
import "./App.css";
import { MobileHome } from './pages/MobileHome'
import { StickyNav } from './components/StickyNav'
import { GlobalBackToTop } from './components/GlobalBackToTop'
import { NotFound } from './pages/NotFound'

// Loaded on demand: subpages and the 3D scene are code-split so the initial bundle
// is minimal and doesn't download markdown parsers, heavy publications, or 3D models.
const Home3D = lazy(() => import('./components/Home3D'))
const People = lazy(() => import('./pages/People').then(m => ({ default: m.People })))
const Join = lazy(() => import('./pages/Join').then(m => ({ default: m.Join })))
const Courses = lazy(() => import('./pages/Courses').then(m => ({ default: m.Courses })))
const Publications = lazy(() => import('./pages/Publications').then(m => ({ default: m.Publications })))

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
  
  return false;
}

const HAS_ACCELERATION = checkHardwareAcceleration()

const InitialLoadingFallback = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: '#e0e0e0', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', zIndex: 9999999,
    pointerEvents: 'none'
  }}>
    <style>{`
      @keyframes loadingRunnerSprite {
        from { background-position: 0px 0px; }
        to { background-position: -5500px 0px; }
      }
    `}</style>
    <div style={{ 
      marginBottom: '0px', 
      transform: 'translateY(-20px)',
      width: '250px',
      height: '250px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div
        style={{
          width: '250px',
          height: '141px',
          backgroundImage: "url('/assets/loading_spritesheet.webp')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: '5500px 141px',
          animation: 'loadingRunnerSprite 733.33ms steps(22) infinite',
          willChange: 'background-position',
          transform: 'translateZ(0)'
        }}
      />
    </div>
    <div style={{ width: '300px', height: '2px', background: '#ccc', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ width: '5%', height: '100%', background: '#af1414' }} />
    </div>
    <p style={{ margin: 0, marginTop: '20px', lineHeight: 1, fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
      INITIALIZING EXPERIENCE...
    </p>
  </div>
)

function App() {
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
    if (currentRoute === '#people') return <Suspense fallback={<div style={{ minHeight: '80vh', background: '#e0e0e0' }} />}><People /></Suspense>
    if (currentRoute === '#publications') return <Suspense fallback={<div style={{ minHeight: '80vh', background: '#e0e0e0' }} />}><Publications /></Suspense>
    if (currentRoute === '#courses') return <Suspense fallback={<div style={{ minHeight: '80vh', background: '#e0e0e0' }} />}><Courses /></Suspense>
    if (currentRoute === '#join') return <Suspense fallback={<div style={{ minHeight: '80vh', background: '#e0e0e0' }} />}><Join /></Suspense>
    
    // Explicitly check for Home
    if (currentRoute === '' || currentRoute === '#' || currentRoute === '#home') {
      
      if (isLiteMode) {
        return <MobileHome />
      }

      return (
        // The fallback renders the runner loading screen while the 3D chunk downloads
        <Suspense fallback={<InitialLoadingFallback />}>
          <Home3D />
        </Suspense>
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
          className="lite-mode-btn"
          style={{
            position: 'fixed',
            bottom: '40px',
            left: '40px',
            padding: '15px',
            fontSize: '18px',
            background: '#af1414',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            zIndex: 10000000,
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