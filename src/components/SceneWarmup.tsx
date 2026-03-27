import { useGLTF, useProgress } from '@react-three/drei'
import { useMemo } from 'react'
import { SkeletonUtils } from 'three-stdlib'

// We need to define paths here again or import them. 
// Importing constants from TurntableScenes is better if possible, 
// but for robustness we'll just hardcode the keys here as we just need to load *something*.
const PATHS = {
  kick: '/gltf/kick/kick.gltf',
  sim2real: '/gltf/sim2real/sim2real.gltf',
  // fall: '/gltf/fall/fall.gltf',
  safetyKick: '/gltf/kick_sign/kick_sign.gltf',
  safetyDefeat: '/gltf/defeat/defeat.gltf',
  pick: '/gltf/pick/pick.gltf',
  muscle: '/gltf/muscle/muscle-compact.glb',
  exo: '/gltf/exo/exo.glb',
}

export const SceneWarmup = () => {
  // Once the loading screen is gone (active=false), we unmount this entire tree
  // to avoid conflicts with the main scene.
  const { active } = useProgress()
  
  // We only render if we are actively loading (or just finished).
  // Once active is false, this component returns null, disposing the clones.
  if (!active) return null

  return (
    <group position={[0, -50, 0]} scale={0.001} visible={true}>
      <WarmupAsset url={PATHS.kick} />
      <WarmupAsset url={PATHS.sim2real} />
      {/* <WarmupAsset url={PATHS.fall} /> */}
      <WarmupAsset url={PATHS.safetyKick} />
      <WarmupAsset url={PATHS.safetyDefeat} />
      <WarmupAsset url={PATHS.pick} />
      <WarmupAsset url={PATHS.muscle} />
      <WarmupAsset url={PATHS.exo} />
    </group>
  )
}

const WarmupAsset = ({ url }: { url: string }) => {
  const gltf = useGLTF(url)
  // Clone the scene so we don't steal the original from the cache
  // But since we are rendering it, materials/geometry (which are shared) get compiled.
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
  
  return <primitive object={clone} />
}