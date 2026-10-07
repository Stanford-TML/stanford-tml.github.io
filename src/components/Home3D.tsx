// FILE: src/components/Home3D.tsx
// The full 3D home page. App.tsx lazy-loads this module so that three.js and the
// ~140 MB of models that TurntableScenes preloads are only fetched when the 3D
// experience is actually shown (never in Lite mode, on mobile, or on other pages).
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import { Suspense } from 'react'
import { Experience } from './Experience'
import { LoadingScreen } from './LoadingScreen'
import { SceneWarmup } from './SceneWarmup'
import { getTotalPages } from '../ScrollManager'

export default function Home3D() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <LoadingScreen />

      <Canvas shadows camera={{ position: [0, 0, 5], fov: 40 }} gl={{ antialias: true }}>
        <color attach="background" args={['#e0e0e0']} />
        <Suspense fallback={null}>
          <ScrollControls pages={getTotalPages()} damping={0.2}>
            <SceneWarmup />
            <Experience />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  )
}
