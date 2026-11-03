// FILE: src/utils/holoShader.ts
import * as THREE from 'three'

/**
 * Applies the custom holographic scanline + fresnel rim shader to a mesh.
 * Stores `shader` on `mesh.userData.shader` for per-frame `uTime` uniform updates.
 */
export const applyHoloShader = (mesh: THREE.Mesh, colorHex: string) => {
  const colorObj = new THREE.Color(colorHex)
  const holoMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    transparent: true,
    opacity: 1.0,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.FrontSide
  })

  holoMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uHoloColor = { value: colorObj }

    // Inject uniforms and varyings safely via <common>
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vWorldPos;`
    )

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vWorldPos = worldPosition.xyz;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       uniform vec3 uHoloColor;
       varying vec3 vWorldPos;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float dotProduct = dot(viewDir, vNormal);
      float fresnel = pow(1.0 - abs(dotProduct), 2.0); 
      
      float noise = fract(sin(dot(vWorldPos.xy, vec2(12.9898, 78.233))) * 43758.5453);
      float scanRaw = sin(vWorldPos.y * 200.0 - uTime * 3.0 + (noise * 0.2));
      float scanLine = pow(max(0.0, scanRaw), 0.01 + (noise * 0.04)); 
      
      vec3 intensity = uHoloColor * 0.1; 
      intensity += uHoloColor * scanLine * (2.0 + noise * 2.0); 
      intensity += uHoloColor * fresnel * 3.0; 
      
      float alphaNoise = (noise > 0.5) ? 0.0 : 1.0;
      float alpha = 0.1 + (fresnel * 0.5) + (scanLine * 0.1 * alphaNoise);
      
      gl_FragColor = vec4(intensity, clamp(alpha, 0.0, 1.0));`
    )
    mesh.userData.shader = shader
  }
  mesh.material = holoMat
}

