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
  [/g1_lay.*buffer\.bin/i, 14.93],
  [/g1_sit_loop.*buffer\.bin/i, 15.09],
  [/g1_.*buffer\.bin/i, 15.0],
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
  // Holiday assets
  [/sleigh\.glb/i, 28.0],
  [/santahat\.fbx/i, 20.6],
  [/christmas_tree.*\.glb/i, 8.3],
  [/snowman.*\.glb/i, 0.6],
  [/pot_of_gold\.glb/i, 19.8],
  [/cornucopia\.glb/i, 16.8],
  [/halloween_gravestone\.glb/i, 27.5],
  [/jack_olantern\.glb/i, 3.5],
  [/rose\.glb/i, 12.1],
  [/heartbox\.glb/i, 1.1],
  [/easter_eggs.*\.glb/i, 1.4],
  // Fallbacks
  [/\.(glb|fbx|bin)/i, 2.5],
  [/\.(gltf|json|obj|png|jpg|hdr|ttf|wasm)/i, 0.3],
]

function getAssetWeightMB(url: string): number {
  for (const [pattern, weight] of ASSET_WEIGHTS) {
    if (pattern.test(url)) return weight
  }
  return 0.5
}

function getTotalExpectedMB(): number {
  const holiday = getActiveHoliday()
  let total = 140 // base non-holiday scene ~140 MB
  if (holiday === 'winter') total += 68 // 140 + 68 = 208 MB
  else if (holiday === 'halloween') total += 31 // 140 + 31 = 171 MB
  else if (holiday === 'stpatricks') total += 20 // 140 + 20 = 160 MB
  else if (holiday === 'thanksgiving') total += 17 // 140 + 17 = 157 MB
  else if (holiday === 'valentines') total += 13 // 140 + 13 = 153 MB
  else if (holiday === 'easter') total += 8 // 140 + 8 = 148 MB
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
  const fadeTriggeredRef = useRef(false)
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
    let downloadsDoneTime: number | null = null

    const updateLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1) // clamp max dt to 100ms
      lastTime = now
      const elapsed = Math.max(0.1, (now - startTime) / 1000)

      const isComplete = rawCompleteRef.current
      if (isComplete && downloadsDoneTime === null) {
        downloadsDoneTime = now
      }

      // Check whether Three.js has rendered its initial frames to the canvas
      const isSceneReady =
        (typeof window !== 'undefined' && !!(window as any).__TML_SCENE_READY) ||
        (downloadsDoneTime !== null && now - downloadsDoneTime > 3000)

      let target: number

      if (!isComplete) {
        // Real byte-based milestone (0 to 92%)
        const byteRatio = loadedBytesRef.current / totalExpectedMB.current
        const byteTarget = Math.min(92, byteRatio * 92)

        // Steady in-flight progression:
        // Advance at a steady, noticeable rate rather than stalling
        const effectiveSpeed = Math.max(8, loadedBytesRef.current / elapsed)
        const estimatedInFlightMB = Math.min(30, effectiveSpeed * 1.0)
        const inFlightTarget = Math.min(90, ((loadedBytesRef.current + estimatedInFlightMB) / totalExpectedMB.current) * 92)

        target = Math.max(byteTarget, inFlightTarget)
      } else if (!isSceneReady) {
        // Downloads complete; WebGL is compiling initial shaders behind the scenes
        // Hold smoothly at 95% while the GPU warms up
        target = 95
      } else {
        // Initial frames rendered; smoothly glide home to 100%
        target = 100
      }

      targetProgressRef.current = target
      const curr = currentProgressRef.current

      if (isSceneReady && isComplete) {
        // Smoothly accelerate from 95% through to 100%
        const distance = 100 - curr
        const speed = Math.max(distance * 4.0, 25)
        currentProgressRef.current = Math.min(100, curr + speed * dt)

        if (currentProgressRef.current >= 100 && !fadeTriggeredRef.current) {
          fadeTriggeredRef.current = true
          // Hold at 100% briefly so user clearly sees full completion, then fade out smoothly
          setTimeout(() => {
            setIsFadingOut(true)
            setTimeout(() => setShown(false), 550)
          }, 350)
        }
      } else if (curr < target) {
        // Smooth acceleration toward target milestone
        const distance = target - curr
        const speed = isComplete ? 2.5 : Math.max(2.5, distance * 0.3)
        currentProgressRef.current = Math.min(target, curr + distance * Math.min(1, dt * speed))
      } else if (curr < 92) {
        // Maintain continuous perceptible motion (at least ~1.5% per second) so it never freezes
        const headroom = 92 - curr
        const minVelocity = Math.max(1.5, headroom * 0.1)
        currentProgressRef.current = Math.min(92, curr + dt * minVelocity)
      }

      // Directly update the DOM bar width on animation frame (no CSS transition lag)
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

  // Safety fallback: only if animation loop stalls indefinitely
  useEffect(() => {
    if (!active && rawPercent === 100) {
      const fallback = setTimeout(() => {
        if (!fadeTriggeredRef.current) {
          fadeTriggeredRef.current = true
          setIsFadingOut(true)
          setTimeout(() => setShown(false), 600)
        }
      }, 15000)
      return () => clearTimeout(fallback)
    }
  }, [active, rawPercent])

  if (!shown) return null

  const getStageText = (percent: number) => {
    if (percent < 20) return "Wrangling Robots..."
    if (percent < 40) return "Compiling Code..."
    if (percent < 60) return "Calibrating Sensors..."
    if (percent < 80) return "Optimizing Algorithms..."
    if (percent < 92) return "Training Models..."
    return "Simulating Environments..."
  }

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
          from { transform: translate3d(0px, 0px, 0px); }
          to { transform: translate3d(-5500px, 0px, 0px); }
        }
      `}</style>

      {/* COMPOSITOR-THREAD SPRITESHEET ANIMATION (Uninterrupted by main thread freezes) */}
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
        <div style={{ width: '250px', height: '141px', overflow: 'hidden', position: 'relative' }}>
          <img
            src="/assets/loading_spritesheet.webp"
            alt=""
            onLoad={() => setSpriteReady(true)}
            style={{
              width: '5500px',
              height: '141px',
              maxWidth: 'none',
              display: 'block',
              willChange: 'transform',
              animation: 'loadingRunnerSprite 733.33ms steps(22) infinite',
              opacity: spriteReady ? 1 : 0,
              transition: 'opacity 0.2s ease',
              transform: 'translate3d(0,0,0)'
            }}
          />
        </div>
      </div>
      
      <div style={{ width: '300px', height: '2px', background: '#ccc', borderRadius: '4px', overflow: 'hidden' }}>
        <div 
          ref={barRef}
          style={{ 
            width: `${displayPercent}%`, 
            height: '100%', 
            background: '#af1414',
            willChange: 'width'
          }} 
        />
      </div>
      <p style={{ margin: 0, marginTop: '20px', lineHeight: 1, fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
        {getStageText(displayPercent)} {displayPercent}%
      </p>
    </div>
  )
}
