# Advanced Animation Patterns

Three.js integration, WebGL, Canvas effects, and advanced SVG animations.

## Table of Contents
1. [Three.js + GSAP](#threejs--gsap)
2. [WebGL Shaders](#webgl-shaders)
3. [Canvas Effects](#canvas-effects)
4. [Image Sequences](#image-sequences)
5. [SVG Advanced](#svg-advanced)
6. [View Transitions API](#view-transitions-api)

## Three.js + GSAP

### Setup

```bash
npm install three @types/three @react-three/fiber @react-three/drei
```

### Basic Integration

```tsx
'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

function AnimatedMesh() {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (!meshRef.current) return

    // GSAP can animate Three.js objects directly
    gsap.to(meshRef.current.rotation, {
      x: Math.PI * 2,
      y: Math.PI * 2,
      scrollTrigger: {
        trigger: '#canvas-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    })

    gsap.to(meshRef.current.position, {
      z: 2,
      scrollTrigger: {
        trigger: '#canvas-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    })
  }, [])

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

export function ThreeScene() {
  return (
    <div id="canvas-container" className="h-[300vh]">
      <div className="fixed inset-0">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <AnimatedMesh />
        </Canvas>
      </div>
    </div>
  )
}
```

### Material Animation

```tsx
function AnimatedMaterial() {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)

  useEffect(() => {
    if (!materialRef.current) return

    gsap.to(materialRef.current, {
      opacity: 0.5,
      metalness: 1,
      roughness: 0,
      scrollTrigger: {
        trigger: '#scene',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    })
  }, [])

  return (
    <meshStandardMaterial
      ref={materialRef}
      color="#ffffff"
      transparent
    />
  )
}
```

### Camera Animation

```tsx
function CameraRig() {
  const { camera } = useThree()

  useEffect(() => {
    gsap.to(camera.position, {
      x: 5,
      y: 2,
      z: 3,
      scrollTrigger: {
        trigger: '#scene',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: () => camera.lookAt(0, 0, 0)
      }
    })
  }, [camera])

  return null
}
```

### Scroll-Linked Animation with useFrame

```tsx
function ScrollLinkedMesh() {
  const meshRef = useRef<THREE.Mesh>(null)
  const scrollProgress = useRef(0)

  useEffect(() => {
    ScrollTrigger.create({
      trigger: '#canvas-container',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scrollProgress.current = self.progress
      }
    })
  }, [])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y = scrollProgress.current * Math.PI * 2
      meshRef.current.position.y = Math.sin(scrollProgress.current * Math.PI) * 2
    }
  })

  return (
    <mesh ref={meshRef}>
      <torusKnotGeometry args={[1, 0.3, 128, 16]} />
      <meshNormalMaterial />
    </mesh>
  )
}
```

## WebGL Shaders

### Custom Shader Material with GSAP

```tsx
'use client'

import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const vertexShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uProgress;

  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin(pos.x * 10.0 + uTime) * 0.1 * uProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  varying vec2 vUv;
  uniform float uProgress;

  void main() {
    vec3 color = mix(vec3(0.0), vec3(1.0, 0.5, 0.0), uProgress);
    gl_FragColor = vec4(color, 1.0);
  }
`

function ShaderPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useRef({
    uTime: { value: 0 },
    uProgress: { value: 0 }
  })

  useEffect(() => {
    gsap.to(uniforms.current.uProgress, {
      value: 1,
      scrollTrigger: {
        trigger: '#shader-scene',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    })
  }, [])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh>
      <planeGeometry args={[4, 4, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
      />
    </mesh>
  )
}
```

### Image Distortion Shader

```tsx
const distortionFragment = `
  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Distortion based on progress
    float distortion = sin(uv.y * 10.0 + uTime) * 0.1 * uProgress;
    uv.x += distortion;

    vec4 color = texture2D(uTexture, uv);
    gl_FragColor = color;
  }
`

function DistortedImage({ src }: { src: string }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const texture = useLoader(TextureLoader, src)

  const uniforms = useRef({
    uTexture: { value: texture },
    uProgress: { value: 0 },
    uTime: { value: 0 }
  })

  useEffect(() => {
    gsap.to(uniforms.current.uProgress, {
      value: 1,
      duration: 1,
      ease: 'power2.out'
    })
  }, [])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms.current}
        fragmentShader={distortionFragment}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
      />
    </mesh>
  )
}
```

## Canvas Effects

### Particle System on Scroll

```tsx
'use client'

import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const scrollProgress = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    // Setup canvas
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Create particles
    for (let i = 0; i < 100; i++) {
      particles.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1
      })
    }

    // ScrollTrigger
    ScrollTrigger.create({
      trigger: '#particle-section',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scrollProgress.current = self.progress
      }
    })

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.current.forEach(p => {
        // Move particles faster based on scroll
        p.x += p.vx * (1 + scrollProgress.current * 5)
        p.y += p.vy * (1 + scrollProgress.current * 5)

        // Wrap around
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // Draw
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + scrollProgress.current * 0.5})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 + scrollProgress.current), 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <div id="particle-section" className="h-[300vh]">
      <canvas ref={canvasRef} className="fixed inset-0" />
    </div>
  )
}
```

## Image Sequences

### Scroll-Driven Image Sequence

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function ImageSequence({ frameCount = 120, basePath }: {
  frameCount?: number
  basePath: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const images = useRef<HTMLImageElement[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Preload images
    let loadedCount = 0
    for (let i = 0; i < frameCount; i++) {
      const img = new Image()
      img.src = `${basePath}/frame_${i.toString().padStart(4, '0')}.jpg`
      img.onload = () => {
        loadedCount++
        if (loadedCount === frameCount) setLoaded(true)
      }
      images.current.push(img)
    }
  }, [frameCount, basePath])

  useEffect(() => {
    if (!loaded) return

    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const container = containerRef.current!

    // Set canvas size
    canvas.width = images.current[0].width
    canvas.height = images.current[0].height

    // Draw first frame
    ctx.drawImage(images.current[0], 0, 0)

    // Animate frame
    const frameObj = { frame: 0 }

    gsap.to(frameObj, {
      frame: frameCount - 1,
      snap: 'frame',
      ease: 'none',
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        pin: true,
      },
      onUpdate: () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(images.current[Math.round(frameObj.frame)], 0, 0)
      }
    })
  }, [loaded, frameCount])

  return (
    <div ref={containerRef} className="h-[500vh]">
      <div className="fixed inset-0 flex items-center justify-center">
        {!loaded && <div>Loading frames...</div>}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  )
}
```

## SVG Advanced

### Path Morphing with Anime.js

```tsx
'use client'

import { useRef, useEffect } from 'react'
import anime from 'animejs'

export function MorphingSVG() {
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    anime({
      targets: pathRef.current,
      d: [
        { value: 'M50,10 L90,90 L10,90 Z' },           // Triangle
        { value: 'M50,10 A40,40 0 1,1 50,90 A40,40 0 1,1 50,10' }, // Circle
        { value: 'M10,10 L90,10 L90,90 L10,90 Z' },   // Square
      ],
      duration: 3000,
      easing: 'easeInOutQuad',
      loop: true,
      direction: 'alternate',
    })
  }, [])

  return (
    <svg viewBox="0 0 100 100" className="w-64 h-64">
      <path
        ref={pathRef}
        d="M50,10 L90,90 L10,90 Z"
        fill="none"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  )
}
```

### Motion Path Animation

```tsx
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
gsap.registerPlugin(MotionPathPlugin)

function MotionPathAnimation() {
  const ballRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.to(ballRef.current, {
      motionPath: {
        path: '#motion-path',
        align: '#motion-path',
        alignOrigin: [0.5, 0.5],
        autoRotate: true,
      },
      duration: 5,
      ease: 'none',
      scrollTrigger: {
        trigger: '#motion-container',
        start: 'top center',
        end: 'bottom center',
        scrub: 1,
      }
    })
  })

  return (
    <div id="motion-container" className="relative h-[200vh]">
      <svg className="fixed top-0 left-0 w-full h-screen">
        <path
          id="motion-path"
          d="M100,300 Q400,50 700,300 T1300,300"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
        />
      </svg>
      <div
        ref={ballRef}
        className="fixed w-10 h-10 bg-white rounded-full"
      />
    </div>
  )
}
```

## View Transitions API

### Native Page Transitions (Chrome)

```tsx
// For simple transitions without libraries
'use client'

import { useRouter } from 'next/navigation'

export function TransitionLink({ href, children }: {
  href: string
  children: React.ReactNode
}) {
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()

    if (!document.startViewTransition) {
      router.push(href)
      return
    }

    document.startViewTransition(() => {
      router.push(href)
    })
  }

  return (
    <a href={href} onClick={handleClick}>
      {children}
    </a>
  )
}
```

```css
/* View Transition CSS */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.5s;
}

::view-transition-old(root) {
  animation: fade-out 0.5s ease-out;
}

::view-transition-new(root) {
  animation: fade-in 0.5s ease-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Named View Transitions

```tsx
// Give elements view-transition-name for morphing
<div style={{ viewTransitionName: 'hero-image' }}>
  <img src="/hero.jpg" />
</div>
```

```css
::view-transition-old(hero-image),
::view-transition-new(hero-image) {
  animation-duration: 0.3s;
}
```
