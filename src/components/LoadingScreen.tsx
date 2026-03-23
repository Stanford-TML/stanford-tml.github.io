import { useControls } from 'leva'
import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { rand } from 'three/tsl'
import { randInt } from 'three/src/math/MathUtils.js'

export const LoadingScreen = () => {
  const { progress, active } = useProgress()
  const [shown, setShown] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  
  // Animation loop removed to prevent JS thread blocking. Using CSS keyframes instead!
  
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

  const frames = Array.from({ length: 22 }, (_, i) => i + 1)

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
        @keyframes loadingFrame {
          0%, 4.544% { opacity: 1; }
          4.545%, 100% { opacity: 0; }
        }
      `}</style>

      {/* PNG SEQUENCE */}
      <div style={{ 
          marginBottom: '0px', 
          transform: `translateY(${-20}px)`,
          width: `${250}px`,
          height: `${250}px`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
      }}>
         {frames.map((frame, index) => (
             <img 
                key={frame}
                src={`/assets/loading/${frame.toString().padStart(4, '0')}.png`} 
                style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain',
                    opacity: 0,
                    animation: `loadingFrame ${22 * (1000/30)}ms infinite`,
                    animationDelay: `${index * (1000/30)}ms`
                }}
                alt="loading"
             />
         ))}
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