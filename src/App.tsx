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
import {Join } from './pages/Join'
import { Courses } from './pages/Courses'
import { Publications } from './pages/Publications'
import { StickyNav } from './components/StickyNav'
import { GlobalBackToTop } from './components/GlobalBackToTop'
import { NotFound } from './pages/NotFound'

function App() {
  const totalPages = getTotalPages()
  const[isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const[currentRoute, setCurrentRoute] = useState(window.location.hash || '#home')

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
    // 1. Check if the user typed an invalid path (e.g., /invalid-path instead of /#/invalid)
    // import.meta.env.BASE_URL handles GitHub Pages sub-directories automatically!
    const currentPath = window.location.pathname
    const basePath = import.meta.env.BASE_URL
    
    // If they are not at the exact base path (or index.html), force 404
    if (currentPath !== basePath && currentPath !== `${basePath}index.html`) {
      return <NotFound />
    }

    // 2. Normal Hash Routing
    if (currentRoute === '#people') return <People />
    if (currentRoute === '#publications') return <Publications />
    if (currentRoute === '#courses') return <Courses />
    if (currentRoute === '#join') return <Join />
    
    // Explicitly check for Home
    if (currentRoute === '' || currentRoute === '#' || currentRoute === '#home') {
      if (isMobile) {
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

    // If no hashes matched, return 404
    return <NotFound />
  }

  return (
    <>
      {/* Render a global nav for non-home pages or mobile. Desktop Home handles its own nav inside Experience.tsx */}
      {(currentRoute !== '#home' || isMobile) && <StickyNav isVisible={true} />}
      {renderPage()}
      {(currentRoute !== '#home' || isMobile) && <GlobalBackToTop />}
    </>
  )
}

export default App