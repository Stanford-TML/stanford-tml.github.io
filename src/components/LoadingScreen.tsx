import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

export const LoadingScreen = () => {
  const { progress, active } = useProgress()
  const [shown, setShown] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [spriteReady, setSpriteReady] = useState(false)
  
  useEffect(() => {
    const img = new Image()
    img.src = '/assets/loading_spritesheet.webp'
    if (img.complete) {
      setSpriteReady(true)
    } else {
      img.onload = () => setSpriteReady(true)
    }
  }, [])
  
  useEffect(() => {
    // Wait until loading is fully complete
    if (!active && progress === 100) {
      // Delay the fade out by 1.5 seconds. 
      // This allows ThreeJS to freeze the main thread to compile initial shaders 
      // completely hidden behind the loading screen, eliminating the visual stall!
      const delay = setTimeout(() => {
        setIsFadingOut(true)
        setTimeout(() => setShown(false), 500)
      }, 1500)
      return () => clearTimeout(delay)
    }
  }, [active, progress])

  if (!shown) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#e0e0e0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
      transition: 'opacity 0.5s ease-in-out',
      opacity: isFadingOut ? 0 : 1, // Fixes initial flash by defaulting to 1
      pointerEvents: 'none'
    }}>
      
      <style>{`
        @keyframes loadingRunnerSprite {
          from { background-position: 0px 0px; }
          to { background-position: -5500px 0px; }
        }
      `}</style>

      {/* ATOMIC SPRITESHEET ANIMATION (No scanline decodes or frame flickering) */}
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
              opacity: spriteReady ? 1 : 0,
              transition: 'opacity 0.2s ease',
              willChange: 'background-position',
              transform: 'translateZ(0)'
            }}
         />
      </div>
      
      <div style={{ width: '300px', height: '2px', background: '#ccc', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#af1414', transition: 'width 0.2s' }} />
      </div>
      <p style={{ marginTop: '20px', fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
        {[
        "Wrangling Robots...",
        "Compiling Code...",
        "Calibrating Sensors...",
        "Optimizing Algorithms...",
        "Training Models...",
        "Simulating Environments..."
      ][Math.floor(progress / 20)]} {Math.round(progress)}%
      </p>
    </div>
  )
}