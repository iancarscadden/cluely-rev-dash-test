"use client"

import { Suspense, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF, OrbitControls } from "@react-three/drei"
import * as THREE from "three"

// Model component that loads and animates the GLTF
function Model() {
  const { scene } = useGLTF("/model.gltf")
  const modelRef = useRef<THREE.Group>(null)

  // Slow rotation animation
  useFrame((state, delta) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += delta * 0.2 // Slow rotation speed
    }
  })

  return (
    <group ref={modelRef}>
      <primitive object={scene} scale={[0.7, 0.7, 0.7]} />
    </group>
  )
}

// Loading fallback component
function Loader() {
  return (
    <mesh>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshStandardMaterial color="gray" opacity={0.1} transparent />
    </mesh>
  )
}

export default function ModelBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
      <div className="w-full h-full max-w-4xl max-h-4xl">
        <Canvas
          camera={{
            position: [0, 0, 5],
            fov: 75,
          }}
          style={{
            background: "white",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Ambient lighting */}
          <ambientLight intensity={0.3} />
          
          {/* Directional lighting */}
          <directionalLight
            position={[10, 10, 5]}
            intensity={0.5}
            castShadow
          />
          
          {/* Point light for additional illumination */}
          <pointLight position={[-10, -10, -10]} intensity={0.3} />

          {/* Model with suspense for loading */}
          <Suspense fallback={<Loader />}>
            <Model />
          </Suspense>

          {/* Optional: OrbitControls for debugging (remove in production) */}
          {/* <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} /> */}
        </Canvas>
      </div>
    </div>
  )
}

// Preload the model for better performance
useGLTF.preload("/model.gltf") 