import { useProgress } from '@react-three/drei'
import { useEffect, useState, useRef } from 'react'
import { getActiveHoliday } from '../utils/holiday'

// Weight table for known scene assets (in Megabytes).
// Raw Three.js useProgress counts files (1 file = 1 unit).
// Weighting by actual payload size prevents 10 tiny JSON manifests (0.1 MB each) from
// falsely consuming 50% of the progress bar and stalling for multiple seconds during heavy binary downloads.
const ASSET_WEIGHTS: [RegExp, number][] = [
  [/kick_sign.*buffer\.bin/i, 18.36],
  [/sim2real.*buffer\.bin/i, 17.64],
  [/jacks.*buffer\.bin/i, 16.01],
  [/exo\.glb/i, 13.19],
  [/muscle.*\.glb/i, 10.85],
  [/pick.*\.bin/i, 4.94],
  [/run_small.*buffer\.bin/i, 2.72],
  [/kick.*buffer\.bin/i, 2.58],
  [/fall.*buffer\.bin/i, 2.56],
  [/defeat.*buffer\.bin/i, 2.53],
  [/push.*buffer\.bin/i, 2.43],
  [/sit_loop.*buffer\.bin/i, 2.43],
  [/run_pose.*buffer\.bin/i, 2.32],
  [/g1_.*buffer\.bin/i, 15.0],
  // Holiday assets
  [/sleigh\.glb/i, 28.0],
  [/santahat\.fbx/i, 20.6],
  [/pot_of_gold\.glb/i, 19.8],
  [/cornucopia\.glb/i, 16.8],
  [/halloween_gravestone\.glb/i, 27.5],
  [/rose\.glb/i, 12.1],
  [/heartbox\.glb/i, 6.0],
  [/easter_eggs.*\.glb/i, 4.0],
  [/christmas_tree.*\.glb/i, 8.3],
  [/jack_olantern\.glb/i, 3.5],
  // Fallbacks
  [/\.(glb|fbx|bin)/i, 2.5],
  [/\.(gltf|json|obj|png|jpg|hdr|ttf)/i, 0.3],
]

function getAssetWeightMB(url: string): number {
  for (const [pattern, weight] of ASSET_WEIGHTS) {
    if (pattern.test(url)) return weight
  }
  return 0.5
}

function getTotalExpectedMB(): number {
  const holiday = getActiveHoliday()
  let total = 103 // base non-holiday scene ~103 MB
  if (holiday === 'winter') total += 57
  else if (holiday === 'halloween') total += 31
  else if (holiday === 'stpatricks') total += 20
  else if (holiday === 'thanksgiving') total += 17
  else if (holiday === 'valentines') total += 18
  else if (holiday === 'easter') total += 8
  return total
}

export const LoadingScreen = () => {
  const { progress: rawPercent, active } = useProgress()
  const [shown, setShown] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [spriteReady, setSpriteReady] = useState(false)
  const [displayPercent, setDisplayPercent] = useState(0)

  const barRef = useRef<HTMLDivElement>(null)
  const loadedItemsRef = useRef<Set<string>>(new Set())
  const loadedBytesRef = useRef(0)
  const totalExpectedMB = useRef(getTotalExpectedMB())
  const currentProgressRef = useRef(0)
  const targetProgressRef = useRef(0)
  const activeRef = useRef(active)
  activeRef.current = active

  // Track raw percent completion
  const rawCompleteRef = useRef(false)
  if (!active && rawPercent >= 100) {
    rawCompleteRef.current = true
  }

  // Preload runner spritesheet
  useEffect(() => {
    const img = new Image()
    img.src = '/assets/loading_spritesheet.webp'
    if (img.complete) {
      setSpriteReady(true)
    } else {
      img.onload = () => setSpriteReady(true)
    }
  }, [])

  // Synchronously subscribe to Zustand useProgress store.
  // This ensures NO loaded items are missed due to React 19 render batching.
  useEffect(() => {
    // @ts-ignore
    const unsub = useProgress.subscribe((state: any) => {
      const itemUrl = state.item
      if (itemUrl && !loadedItemsRef.current.has(itemUrl)) {
        loadedItemsRef.current.add(itemUrl)
        const weight = getAssetWeightMB(itemUrl)
        loadedBytesRef.current += weight
        if (import.meta.env.DEV) {
          console.log(
            `[Loading:Asset] ${state.loaded}/${state.total} (+${weight} MB, total ${loadedBytesRef.current.toFixed(1)} MB): ${itemUrl}`
          )
        }
      }
    })
    return () => unsub()
  }, [])

  // Continuous animation loop with periodic console trace
  useEffect(() => {
    let animId: number
    let lastTime = performance.now()
    const startTime = performance.now()
    let lastTraceTime = performance.now()
    let lastReportedInt = -1

    const updateLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1) // clamp max dt to 100ms
      lastTime = now
      const elapsed = Math.max(0.1, (now - startTime) / 1000)

      const isComplete = rawCompleteRef.current
      let target: number

      if (isComplete) {
        // Downloads complete: smoothly bridge the shader warmup window to 100%
        target = 100
      } else {
        // Real byte-based milestone (0 to 92%)
        const byteRatio = loadedBytesRef.current / totalExpectedMB.current
        const byteTarget = Math.min(92, byteRatio * 92)

        // Steady in-flight progression:
        // Assume active streaming across connections.
        // Advance at a steady, noticeable rate (e.g. ~3% per sec) rather than stalling.
        const effectiveSpeed = Math.max(8, loadedBytesRef.current / elapsed)
        const estimatedInFlightMB = Math.min(35, effectiveSpeed * 1.0)
        const inFlightTarget = Math.min(90, ((loadedBytesRef.current + estimatedInFlightMB) / totalExpectedMB.current) * 92)

        target = Math.max(byteTarget, inFlightTarget)
      }

      targetProgressRef.current = target
      const curr = currentProgressRef.current

      if (isComplete) {
        // Smoothly accelerate into 100%
        const distance = 100 - curr
        currentProgressRef.current = Math.min(100, curr + Math.max(distance * dt * 3.5, dt * 18))
      } else if (curr < target) {
        // Smooth acceleration toward target milestone
        const distance = target - curr
        const speed = Math.max(2.0, distance * 0.25)
        currentProgressRef.current = Math.min(target, curr + distance * Math.min(1, dt * speed))
      } else if (curr < 92) {
        // Maintain continuous perceptible motion (at least ~1.2% per second) so it never freezes
        const headroom = 92 - curr
        const minVelocity = Math.max(1.2, headroom * 0.08)
        currentProgressRef.current = Math.min(92, curr + dt * minVelocity)
      }

      // Directly update the DOM bar width with CSS transition on GPU compositor thread
      if (barRef.current) {
        barRef.current.style.width = `${currentProgressRef.current.toFixed(1)}%`
      }

      // Only dispatch React state when the rounded integer percentage changes
      // This saves 80%+ React re-render cycles, leaving the JS thread free for 3D model parsing!
      const currentInt = Math.min(100, Math.round(currentProgressRef.current))
      if (currentInt !== lastReportedInt) {
        lastReportedInt = currentInt
        setDisplayPercent(currentInt)
      }

      // Periodic diagnostic trace in dev console every 600ms
      if (import.meta.env.DEV && now - lastTraceTime >= 600) {
        lastTraceTime = now
        console.log(
          `[Loading:Trace ${(elapsed).toFixed(1)}s] Display: ${currentProgressRef.current.toFixed(1)}%, Target: ${target.toFixed(1)}%, Loaded: ${loadedBytesRef.current.toFixed(1)}/${totalExpectedMB.current}MB, Active: ${activeRef.current}`
        )
      }

      if (shown) {
        animId = requestAnimationFrame(updateLoop)
      }
    }

    animId = requestAnimationFrame(updateLoop)
    return () => cancelAnimationFrame(animId)
  }, [shown])

  // Fade out once fully complete
  useEffect(() => {
    if (!active && rawPercent === 100) {
      // 1.5s delay allows ThreeJS to compile initial shaders completely hidden
      const delay = setTimeout(() => {
        setIsFadingOut(true)
        setTimeout(() => setShown(false), 500)
      }, 1500)
      return () => clearTimeout(delay)
    }
  }, [active, rawPercent])

  if (!shown) return null

  const stageIndex = Math.min(5, Math.floor(displayPercent / 20))

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#e0e0e0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999999,
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
        <div 
          ref={barRef}
          style={{ 
            width: `${displayPercent}%`, 
            height: '100%', 
            background: '#af1414',
            transition: 'width 0.15s linear',
            willChange: 'width'
          }} 
        />
      </div>
      <p style={{ margin: 0, marginTop: '20px', lineHeight: 1, fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
        {[
        "Wrangling Robots...",
        "Compiling Code...",
        "Calibrating Sensors...",
        "Optimizing Algorithms...",
        "Training Models...",
        "Simulating Environments..."
      ][stageIndex]} {displayPercent}%
      </p>
    </div>
  )
}
