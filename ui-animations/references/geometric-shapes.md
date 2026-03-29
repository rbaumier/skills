# Geometric Shapes & Creative Coding

Patterns for creating geometric shapes, grids, and Tetris-style animations in React.

## Table of Contents
1. [Decision Matrix](#decision-matrix)
2. [SVG Programático](#svg-programático)
3. [Canvas 2D](#canvas-2d)
4. [CSS Grid + GSAP](#css-grid--gsap)
5. [Zdog (Pseudo-3D)](#zdog-pseudo-3d)
6. [p5.js Creative Coding](#p5js-creative-coding)
7. [Tetris-Style Patterns](#tetris-style-patterns)

## Decision Matrix

| Necesidad | Herramienta | Por qué |
|-----------|-------------|---------|
| Formas vectoriales simples | SVG en JSX | Nativo, animable con GSAP/Motion |
| Grids animados | CSS Grid + GSAP | Layout + animaciones |
| Dibujo programático | Canvas 2D | Performance, píxeles |
| Pseudo-3D estilizado | Zdog | Flat design 3D, ~2kb |
| Creative coding/arte | p5.js | Ecosistema, comunidad |
| Formas 3D reales | Three.js | WebGL completo |

## SVG Programático

### Formas Básicas en React

```tsx
'use client'

// Todas las formas SVG son elementos JSX nativos
export function GeometricShapes() {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      {/* Rectángulo */}
      <rect x="10" y="10" width="80" height="80" fill="#ff6b6b" />

      {/* Cuadrado con bordes redondeados */}
      <rect x="110" y="10" width="80" height="80" rx="10" fill="#4ecdc4" />

      {/* Círculo */}
      <circle cx="250" cy="50" r="40" fill="#45b7d1" />

      {/* Elipse */}
      <ellipse cx="350" cy="50" rx="40" ry="25" fill="#96ceb4" />

      {/* Línea */}
      <line x1="10" y1="120" x2="90" y2="180" stroke="#fff" strokeWidth="3" />

      {/* Polilínea (líneas conectadas) */}
      <polyline
        points="110,180 150,120 190,180"
        fill="none"
        stroke="#ffeaa7"
        strokeWidth="3"
      />

      {/* Polígono (cerrado) - Triángulo */}
      <polygon points="250,120 210,180 290,180" fill="#dfe6e9" />

      {/* Polígono - Hexágono */}
      <polygon
        points="350,120 380,140 380,170 350,190 320,170 320,140"
        fill="#a29bfe"
      />

      {/* Path - Forma custom */}
      <path
        d="M10,220 L50,260 L10,300 L50,300 Z"
        fill="#fd79a8"
      />

      {/* Path - Curva Bézier */}
      <path
        d="M110,260 Q150,200 190,260"
        fill="none"
        stroke="#00cec9"
        strokeWidth="3"
      />
    </svg>
  )
}
```

### Generador de Polígonos

```tsx
'use client'

function generatePolygonPoints(
  sides: number,
  radius: number,
  centerX: number,
  centerY: number
): string {
  const points: string[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    points.push(`${x},${y}`)
  }
  return points.join(' ')
}

export function RegularPolygon({
  sides,
  radius,
  cx,
  cy,
  fill,
}: {
  sides: number
  radius: number
  cx: number
  cy: number
  fill: string
}) {
  const points = generatePolygonPoints(sides, radius, cx, cy)
  return <polygon points={points} fill={fill} />
}

// Uso
<svg viewBox="0 0 400 400">
  <RegularPolygon sides={3} radius={40} cx={50} cy={50} fill="#ff6b6b" />   {/* Triángulo */}
  <RegularPolygon sides={5} radius={40} cx={150} cy={50} fill="#4ecdc4" /> {/* Pentágono */}
  <RegularPolygon sides={6} radius={40} cx={250} cy={50} fill="#45b7d1" /> {/* Hexágono */}
  <RegularPolygon sides={8} radius={40} cx={350} cy={50} fill="#96ceb4" /> {/* Octágono */}
</svg>
```

### SVG Animado con GSAP

```tsx
'use client'

import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function AnimatedShapes() {
  const svgRef = useRef<SVGSVGElement>(null)

  useGSAP(() => {
    // Rotar polígono
    gsap.to('.rotating-shape', {
      rotation: 360,
      transformOrigin: 'center center',
      duration: 4,
      ease: 'none',
      repeat: -1,
    })

    // Pulsar círculo
    gsap.to('.pulsing-circle', {
      scale: 1.2,
      duration: 0.8,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: -1,
    })

    // Morph path
    gsap.to('.morphing-rect', {
      attr: { rx: 40 },
      duration: 1,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: -1,
    })
  }, { scope: svgRef })

  return (
    <svg ref={svgRef} viewBox="0 0 400 200">
      <polygon
        className="rotating-shape"
        points="50,20 80,80 20,80"
        fill="#ff6b6b"
      />
      <circle
        className="pulsing-circle"
        cx="150"
        cy="50"
        r="30"
        fill="#4ecdc4"
      />
      <rect
        className="morphing-rect"
        x="220"
        y="20"
        width="60"
        height="60"
        rx="0"
        fill="#45b7d1"
      />
    </svg>
  )
}
```

### SVG Animado con Motion

```tsx
'use client'

import { motion } from 'motion/react'

export function MotionShapes() {
  return (
    <svg viewBox="0 0 400 200">
      <motion.polygon
        points="50,20 80,80 20,80"
        fill="#ff6b6b"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '50px 50px' }}
      />

      <motion.circle
        cx="150"
        cy="50"
        r="30"
        fill="#4ecdc4"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />

      <motion.rect
        x="220"
        y="20"
        width="60"
        height="60"
        fill="#45b7d1"
        animate={{ rx: [0, 30, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </svg>
  )
}
```

## Canvas 2D

### Setup Básico en React

```tsx
'use client'

import { useRef, useEffect } from 'react'

export function CanvasShapes() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    // Configurar tamaño
    canvas.width = 400
    canvas.height = 400

    // Limpiar
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Rectángulo
    ctx.fillStyle = '#ff6b6b'
    ctx.fillRect(10, 10, 80, 80)

    // Rectángulo con borde
    ctx.strokeStyle = '#4ecdc4'
    ctx.lineWidth = 3
    ctx.strokeRect(110, 10, 80, 80)

    // Círculo
    ctx.beginPath()
    ctx.arc(250, 50, 40, 0, Math.PI * 2)
    ctx.fillStyle = '#45b7d1'
    ctx.fill()

    // Triángulo
    ctx.beginPath()
    ctx.moveTo(350, 10)
    ctx.lineTo(390, 90)
    ctx.lineTo(310, 90)
    ctx.closePath()
    ctx.fillStyle = '#96ceb4'
    ctx.fill()

    // Polígono regular (hexágono)
    drawPolygon(ctx, 50, 150, 40, 6, '#a29bfe')

  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  color: string
) {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
    const px = x + radius * Math.cos(angle)
    const py = y + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}
```

### Canvas Animado con requestAnimationFrame

```tsx
'use client'

import { useRef, useEffect } from 'react'

interface Shape {
  x: number
  y: number
  size: number
  rotation: number
  rotationSpeed: number
  color: string
  sides: number
}

export function AnimatedCanvasShapes() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = 600
    canvas.height = 400

    // Crear formas
    const shapes: Shape[] = Array.from({ length: 10 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 20 + Math.random() * 40,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      sides: 3 + Math.floor(Math.random() * 5),
    }))

    function drawPolygon(shape: Shape) {
      ctx.save()
      ctx.translate(shape.x, shape.y)
      ctx.rotate(shape.rotation)

      ctx.beginPath()
      for (let i = 0; i < shape.sides; i++) {
        const angle = (i * 2 * Math.PI) / shape.sides - Math.PI / 2
        const px = shape.size * Math.cos(angle)
        const py = shape.size * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = shape.color
      ctx.fill()

      ctx.restore()
    }

    let animationId: number

    function animate() {
      ctx.fillStyle = 'rgba(26, 26, 46, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      shapes.forEach((shape) => {
        shape.rotation += shape.rotationSpeed
        drawPolygon(shape)
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => cancelAnimationFrame(animationId)
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## CSS Grid + GSAP

### Grid de Bloques Animados (Tetris-style)

```tsx
'use client'

import { useRef } from 'react'
import { gsap, useGSAP, stagger } from '@/lib/gsap'

export function AnimatedGrid() {
  const gridRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.grid-block', {
      scale: 0,
      rotation: 180,
      opacity: 0,
      duration: 0.6,
      stagger: {
        amount: 1,
        grid: [4, 4],
        from: 'center',
      },
      ease: 'back.out(1.7)',
    })
  }, { scope: gridRef })

  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#a29bfe']

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-4 gap-2 w-64 h-64"
    >
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="grid-block aspect-square rounded-lg"
          style={{ backgroundColor: colors[i % colors.length] }}
        />
      ))}
    </div>
  )
}
```

### Grid con Hover Interactivo

```tsx
'use client'

import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function InteractiveGrid() {
  const gridRef = useRef<HTMLDivElement>(null)

  const { contextSafe } = useGSAP({ scope: gridRef })

  const handleMouseEnter = contextSafe((e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      scale: 1.1,
      rotation: 5,
      duration: 0.3,
      ease: 'power2.out',
    })
  })

  const handleMouseLeave = contextSafe((e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      scale: 1,
      rotation: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)',
    })
  })

  return (
    <div ref={gridRef} className="grid grid-cols-5 gap-2">
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      ))}
    </div>
  )
}
```

## Zdog (Pseudo-3D)

### Instalación

```bash
npm install zdog
# O para React
npm install react-zdog
```

### Formas Básicas con Zdog

```tsx
'use client'

import { useRef, useEffect } from 'react'
import Zdog from 'zdog'

export function ZdogShapes() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const illo = new Zdog.Illustration({
      element: canvasRef.current!,
      zoom: 2,
      dragRotate: true,
    })

    // Cubo (usando Rect para cada cara)
    const cube = new Zdog.Box({
      addTo: illo,
      width: 60,
      height: 60,
      depth: 60,
      stroke: false,
      color: '#ff6b6b',
      leftFace: '#4ecdc4',
      rightFace: '#45b7d1',
      topFace: '#96ceb4',
      bottomFace: '#ffeaa7',
    })

    // Cilindro
    new Zdog.Cylinder({
      addTo: illo,
      diameter: 40,
      length: 60,
      stroke: false,
      color: '#a29bfe',
      backface: '#74b9ff',
      translate: { x: 100 },
    })

    // Cono
    new Zdog.Cone({
      addTo: illo,
      diameter: 50,
      length: 70,
      stroke: false,
      color: '#fd79a8',
      backface: '#e84393',
      translate: { x: -100 },
    })

    // Hemisferio
    new Zdog.Hemisphere({
      addTo: illo,
      diameter: 50,
      stroke: false,
      color: '#00cec9',
      backface: '#81ecec',
      translate: { y: 80 },
    })

    // Animación
    function animate() {
      illo.rotate.y += 0.01
      illo.rotate.x += 0.005
      illo.updateRenderGraph()
      requestAnimationFrame(animate)
    }
    animate()
  }, [])

  return <canvas ref={canvasRef} width={400} height={400} />
}
```

### Zdog Custom Shapes

```tsx
// Forma L (estilo Tetris)
new Zdog.Shape({
  addTo: illo,
  path: [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 30 },
    { x: 60, y: 30 },
    { x: 60, y: 60 },
    { x: 0, y: 60 },
  ],
  closed: true,
  stroke: 20,
  color: '#ff6b6b',
})

// Forma T
new Zdog.Shape({
  addTo: illo,
  path: [
    { x: 0, y: 0 },
    { x: 90, y: 0 },
    { x: 90, y: 30 },
    { x: 60, y: 30 },
    { x: 60, y: 60 },
    { x: 30, y: 60 },
    { x: 30, y: 30 },
    { x: 0, y: 30 },
  ],
  closed: true,
  stroke: 20,
  color: '#4ecdc4',
  translate: { x: 100 },
})
```

## p5.js Creative Coding

### Instalación

```bash
npm install p5 @types/p5
npm install @p5-wrapper/react
```

### Setup Básico con React

```tsx
'use client'

import { useRef, useEffect } from 'react'
import p5 from 'p5'

export function P5Sketch() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(400, 400)
        p.background(26, 26, 46)
      }

      p.draw = () => {
        p.background(26, 26, 46, 10)

        // Formas geométricas
        p.noStroke()

        // Triángulo rotante
        p.push()
        p.translate(100, 100)
        p.rotate(p.frameCount * 0.02)
        p.fill(255, 107, 107)
        p.triangle(0, -40, -35, 20, 35, 20)
        p.pop()

        // Hexágono
        p.push()
        p.translate(200, 200)
        p.rotate(-p.frameCount * 0.01)
        p.fill(78, 205, 196)
        p.beginShape()
        for (let i = 0; i < 6; i++) {
          const angle = p.TWO_PI / 6 * i - p.HALF_PI
          const x = p.cos(angle) * 50
          const y = p.sin(angle) * 50
          p.vertex(x, y)
        }
        p.endShape(p.CLOSE)
        p.pop()

        // Estrella
        p.push()
        p.translate(300, 300)
        p.rotate(p.frameCount * 0.015)
        p.fill(150, 206, 180)
        drawStar(p, 0, 0, 20, 50, 5)
        p.pop()
      }
    }

    function drawStar(p: p5, x: number, y: number, r1: number, r2: number, points: number) {
      const angle = p.TWO_PI / points
      const halfAngle = angle / 2
      p.beginShape()
      for (let a = -p.HALF_PI; a < p.TWO_PI - p.HALF_PI; a += angle) {
        let sx = x + p.cos(a) * r2
        let sy = y + p.sin(a) * r2
        p.vertex(sx, sy)
        sx = x + p.cos(a + halfAngle) * r1
        sy = y + p.sin(a + halfAngle) * r1
        p.vertex(sx, sy)
      }
      p.endShape(p.CLOSE)
    }

    const p5Instance = new p5(sketch, containerRef.current!)

    return () => p5Instance.remove()
  }, [])

  return <div ref={containerRef} />
}
```

### p5.js con @p5-wrapper/react

```tsx
'use client'

import dynamic from 'next/dynamic'
import type { P5CanvasInstance } from '@p5-wrapper/react'

// Importar dinámicamente para evitar SSR issues
const ReactP5Wrapper = dynamic(
  () => import('@p5-wrapper/react').then((mod) => mod.ReactP5Wrapper),
  { ssr: false }
)

function sketch(p5: P5CanvasInstance) {
  p5.setup = () => {
    p5.createCanvas(400, 400)
  }

  p5.draw = () => {
    p5.background(26, 26, 46)
    p5.fill(255, 107, 107)
    p5.noStroke()

    // Polígonos que siguen al mouse
    p5.push()
    p5.translate(p5.mouseX, p5.mouseY)
    p5.rotate(p5.frameCount * 0.02)
    regularPolygon(p5, 0, 0, 40, 6)
    p5.pop()
  }
}

function regularPolygon(p5: P5CanvasInstance, x: number, y: number, r: number, sides: number) {
  p5.beginShape()
  for (let i = 0; i < sides; i++) {
    const angle = p5.TWO_PI / sides * i - p5.HALF_PI
    p5.vertex(x + p5.cos(angle) * r, y + p5.sin(angle) * r)
  }
  p5.endShape(p5.CLOSE)
}

export function P5WrapperDemo() {
  return <ReactP5Wrapper sketch={sketch} />
}
```

## Tetris-Style Patterns

### Piezas de Tetris como Componentes

```tsx
'use client'

import { motion } from 'motion/react'

type TetrisPiece = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

const PIECES: Record<TetrisPiece, { shape: number[][]; color: string }> = {
  I: { shape: [[1, 1, 1, 1]], color: '#00f5ff' },
  O: { shape: [[1, 1], [1, 1]], color: '#ffeb3b' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#9c27b0' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#4caf50' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f44336' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#2196f3' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#ff9800' },
}

export function TetrisPiece({
  type,
  size = 30,
  rotation = 0,
}: {
  type: TetrisPiece
  size?: number
  rotation?: number
}) {
  const piece = PIECES[type]

  return (
    <motion.div
      className="inline-grid gap-0.5"
      style={{
        gridTemplateColumns: `repeat(${piece.shape[0].length}, ${size}px)`,
      }}
      animate={{ rotate: rotation }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      {piece.shape.flat().map((cell, i) => (
        <motion.div
          key={i}
          className="rounded-sm"
          style={{
            width: size,
            height: size,
            backgroundColor: cell ? piece.color : 'transparent',
            boxShadow: cell ? 'inset 2px 2px 4px rgba(255,255,255,0.3)' : 'none',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: cell ? 1 : 0 }}
          transition={{ delay: i * 0.05 }}
        />
      ))}
    </motion.div>
  )
}

// Uso
export function TetrisDemo() {
  return (
    <div className="flex gap-8 flex-wrap">
      <TetrisPiece type="I" />
      <TetrisPiece type="O" />
      <TetrisPiece type="T" />
      <TetrisPiece type="S" />
      <TetrisPiece type="Z" />
      <TetrisPiece type="J" />
      <TetrisPiece type="L" />
    </div>
  )
}
```

### Tetris Falling Animation

```tsx
'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const COLORS = ['#00f5ff', '#ffeb3b', '#9c27b0', '#4caf50', '#f44336', '#2196f3', '#ff9800']

interface FallingBlock {
  id: number
  x: number
  color: string
}

export function TetrisFalling() {
  const [blocks, setBlocks] = useState<FallingBlock[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setBlocks((prev) => [
        ...prev.slice(-20), // Mantener últimos 20
        {
          id: idRef.current++,
          x: Math.random() * 80 + 10, // 10-90%
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        },
      ])
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full h-96 overflow-hidden bg-gray-900 rounded-lg">
      <AnimatePresence>
        {blocks.map((block) => (
          <motion.div
            key={block.id}
            className="absolute w-8 h-8 rounded"
            style={{
              left: `${block.x}%`,
              backgroundColor: block.color,
              boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.3)',
            }}
            initial={{ y: -50, rotate: 0 }}
            animate={{ y: 400, rotate: 180 }}
            exit={{ opacity: 0 }}
            transition={{
              y: { duration: 2, ease: 'easeIn' },
              rotate: { duration: 2, ease: 'linear' },
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
```

### Grid Board con GSAP

```tsx
'use client'

import { useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

const GRID_SIZE = 10
const CELL_SIZE = 30

export function TetrisBoard() {
  const boardRef = useRef<HTMLDivElement>(null)
  const [grid, setGrid] = useState<string[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''))
  )

  const { contextSafe } = useGSAP({ scope: boardRef })

  const handleCellClick = contextSafe((row: number, col: number) => {
    const colors = ['#00f5ff', '#ffeb3b', '#9c27b0', '#4caf50', '#f44336']
    const newColor = colors[Math.floor(Math.random() * colors.length)]

    // Animar el click
    gsap.fromTo(
      `[data-cell="${row}-${col}"]`,
      { scale: 0, rotation: 180 },
      { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.7)' }
    )

    setGrid((prev) => {
      const newGrid = [...prev]
      newGrid[row] = [...newGrid[row]]
      newGrid[row][col] = newGrid[row][col] ? '' : newColor
      return newGrid
    })
  })

  return (
    <div
      ref={boardRef}
      className="inline-grid gap-1 p-2 bg-gray-900 rounded-lg"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)` }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            data-cell={`${rowIndex}-${colIndex}`}
            className="rounded cursor-pointer transition-colors"
            style={{
              width: CELL_SIZE,
              height: CELL_SIZE,
              backgroundColor: cell || '#2d2d2d',
              boxShadow: cell ? 'inset 2px 2px 4px rgba(255,255,255,0.3)' : 'none',
            }}
            onClick={() => handleCellClick(rowIndex, colIndex)}
          />
        ))
      )}
    </div>
  )
}
```

## Recursos

- [p5.js](https://p5js.org/) - Creative coding
- [Zdog](https://zzz.dog/) - Pseudo-3D engine
- [@p5-wrapper/react](https://github.com/P5-wrapper/react) - React wrapper
- [SVG Tutorial MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
- [Canvas API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
