# Geometric Puzzles & Dissections

Animated geometric puzzles: Dudeney dissections, tangrams, tessellations, Penrose tiles, and more. SVG + GSAP for precise animated transformations.

## Table of Contents

- [Dudeney Dissections](#dudeney-dissections)
- [Interactive Tangram](#interactive-tangram)
- [Tessellations](#tessellations)
- [Penrose Tiles](#penrose-tiles)
- [Polyominoes](#polyominoes)
- [Geometric Transformations](#geometric-transformations)
- [Dissection Puzzle Framework](#dissection-puzzle-framework)

---

## Dudeney Dissections

The famous equilateral triangle → square dissection with 4 hinged pieces.

```tsx
'use client'
import { useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

// Triangle-to-square: 4 pieces with precise SVG paths
// Coordinates based on Dudeney's original 4-piece hinged dissection
const TRIANGLE_PIECES = [
  { id: 'A', tri: 'M 0,173.2 L 50,86.6 L 100,173.2 Z', sq: 'M 0,0 L 100,0 L 100,86.6 L 0,86.6 Z' },
  { id: 'B', tri: 'M 50,86.6 L 100,0 L 150,86.6 Z', sq: 'M 100,0 L 200,0 L 200,86.6 L 100,86.6 Z' },
  { id: 'C', tri: 'M 100,173.2 L 150,86.6 L 200,173.2 Z', sq: 'M 0,86.6 L 100,86.6 L 100,173.2 L 0,173.2 Z' },
  { id: 'D', tri: 'M 50,86.6 L 100,173.2 L 150,86.6 L 100,0 Z', sq: 'M 100,86.6 L 200,86.6 L 200,173.2 L 100,173.2 Z' },
]

const COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#f59e0b']

export function DudeneyDissection() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isSquare, setIsSquare] = useState(false)

  useGSAP(() => {
    // Initial setup — start as triangle
    TRIANGLE_PIECES.forEach((piece, i) => {
      const el = svgRef.current!.querySelector(`#piece-${piece.id}`)
      if (el) {
        gsap.set(el, { attr: { d: piece.tri } })
      }
    })
  }, { scope: svgRef })

  const morph = () => {
    const target = !isSquare
    TRIANGLE_PIECES.forEach((piece, i) => {
      const el = svgRef.current!.querySelector(`#piece-${piece.id}`)
      if (el) {
        gsap.to(el, {
          attr: { d: target ? piece.sq : piece.tri },
          duration: 1.5,
          ease: 'power2.inOut',
          delay: i * 0.15,
        })
      }
    })
    setIsSquare(target)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <svg ref={svgRef} viewBox="-10 -10 220 200" className="w-80 h-80">
        {TRIANGLE_PIECES.map((piece, i) => (
          <path
            key={piece.id}
            id={`piece-${piece.id}`}
            d={piece.tri}
            fill={COLORS[i]}
            stroke="#000"
            strokeWidth="1.5"
            className="cursor-pointer"
          />
        ))}
      </svg>
      <button
        onClick={morph}
        className="px-6 py-3 bg-white text-black font-mono text-sm uppercase tracking-wider"
      >
        {isSquare ? 'To Triangle' : 'To Square'}
      </button>
    </div>
  )
}
```

## Interactive Tangram

7 draggable pieces with snap-to-position.

```tsx
'use client'
import { useRef, useState, useCallback } from 'react'
import { gsap } from '@/lib/gsap'

interface TangramPiece {
  id: string; name: string; points: string; color: string
  homeX: number; homeY: number; homeRotate: number
}

const PIECES: TangramPiece[] = [
  { id: 'lg1', name: 'Large Triangle 1', points: '0,0 200,0 100,100', color: '#ef4444', homeX: 0, homeY: 0, homeRotate: 0 },
  { id: 'lg2', name: 'Large Triangle 2', points: '0,0 100,100 0,200', color: '#f97316', homeX: 0, homeY: 0, homeRotate: 0 },
  { id: 'md', name: 'Medium Triangle', points: '0,0 100,0 50,50', color: '#eab308', homeX: 100, homeY: 100, homeRotate: 0 },
  { id: 'sm1', name: 'Small Triangle 1', points: '0,0 100,0 50,50', color: '#22c55e', homeX: 100, homeY: 0, homeRotate: 90 },
  { id: 'sm2', name: 'Small Triangle 2', points: '0,0 100,0 50,50', color: '#06b6d4', homeX: 50, homeY: 150, homeRotate: 180 },
  { id: 'sq', name: 'Square', points: '0,0 50,0 50,50 0,50', color: '#8b5cf6', homeX: 100, homeY: 50, homeRotate: 45 },
  { id: 'par', name: 'Parallelogram', points: '0,0 50,0 100,50 50,50', color: '#ec4899', homeX: 50, homeY: 50, homeRotate: 0 },
]

// Target shapes: each piece's target transform
const TARGETS = {
  house: { lg1: { x: 50, y: 100, r: 0 }, lg2: { x: 0, y: 200, r: -90 }, md: { x: 25, y: 50, r: 0 }, sm1: { x: 0, y: 100, r: 90 }, sm2: { x: 150, y: 100, r: 0 }, sq: { x: 75, y: 150, r: 0 }, par: { x: 100, y: 100, r: 0 } },
  cat: { lg1: { x: 30, y: 80, r: 45 }, lg2: { x: 30, y: 80, r: -45 }, md: { x: 80, y: 180, r: 180 }, sm1: { x: 0, y: 0, r: 0 }, sm2: { x: 120, y: 0, r: 90 }, sq: { x: 60, y: 30, r: 0 }, par: { x: 60, y: 130, r: 0 } },
}

export function Tangram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeTarget, setActiveTarget] = useState<keyof typeof TARGETS | null>(null)
  const dragState = useRef<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)

  const animateToTarget = useCallback((target: keyof typeof TARGETS) => {
    const t = TARGETS[target]
    PIECES.forEach((piece, i) => {
      const el = svgRef.current!.querySelector(`#tangram-${piece.id}`) as SVGGElement
      const data = t[piece.id as keyof typeof t]
      if (el && data) {
        gsap.to(el, {
          x: data.x,
          y: data.y,
          rotation: data.r,
          duration: 0.8,
          ease: 'back.out(1.2)',
          delay: i * 0.08,
          transformOrigin: 'center center',
        })
      }
    })
    setActiveTarget(target)
  }, [])

  const scatter = useCallback(() => {
    PIECES.forEach((piece, i) => {
      const el = svgRef.current!.querySelector(`#tangram-${piece.id}`) as SVGGElement
      if (el) {
        gsap.to(el, {
          x: Math.random() * 250,
          y: Math.random() * 250,
          rotation: Math.random() * 360,
          duration: 0.6,
          ease: 'power2.out',
          delay: i * 0.05,
        })
      }
    })
    setActiveTarget(null)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent, pieceId: string) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const el = svg.querySelector(`#tangram-${pieceId}`) as SVGGElement
    const transform = gsap.getProperty(el)
    dragState.current = {
      id: pieceId,
      startX: svgPt.x,
      startY: svgPt.y,
      offsetX: (transform('x') as number) || 0,
      offsetY: (transform('y') as number) || 0,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const el = svg.querySelector(`#tangram-${dragState.current.id}`)
    if (el) {
      gsap.set(el, {
        x: dragState.current.offsetX + (svgPt.x - dragState.current.startX),
        y: dragState.current.offsetY + (svgPt.y - dragState.current.startY),
      })
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    dragState.current = null
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        className="w-96 h-96 bg-gray-950 rounded-lg touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {PIECES.map(piece => (
          <g
            key={piece.id}
            id={`tangram-${piece.id}`}
            onPointerDown={e => handlePointerDown(e, piece.id)}
            className="cursor-grab active:cursor-grabbing"
          >
            <polygon
              points={piece.points}
              fill={piece.color}
              stroke="#000"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </g>
        ))}
      </svg>
      <div className="flex gap-3">
        {Object.keys(TARGETS).map(target => (
          <button
            key={target}
            onClick={() => animateToTarget(target as keyof typeof TARGETS)}
            className={`px-4 py-2 text-sm font-mono uppercase ${activeTarget === target ? 'bg-white text-black' : 'border border-white/30 text-white/70'}`}
          >
            {target}
          </button>
        ))}
        <button onClick={scatter} className="px-4 py-2 text-sm font-mono uppercase border border-white/30 text-white/70">
          Scatter
        </button>
      </div>
    </div>
  )
}
```

## Tessellations

Regular, semi-regular, and Escher-style animated tessellations.

```tsx
'use client'
import { useRef, useEffect } from 'react'

type TessType = 'triangular' | 'hexagonal' | 'cairo'

export function Tessellation({ type = 'hexagonal', animate = true }: {
  type?: TessType; animate?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2
    ctx.scale(2, 2)

    let time = 0

    const drawHexGrid = (t: number) => {
      const size = 30
      const hSpacing = size * Math.sqrt(3)
      const vSpacing = size * 1.5

      for (let row = -1; row < h / vSpacing + 1; row++) {
        for (let col = -1; col < w / hSpacing + 1; col++) {
          const x = col * hSpacing + (row % 2 ? hSpacing / 2 : 0)
          const y = row * vSpacing

          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const angle = ((60 * i - 30) * Math.PI) / 180
            const px = x + size * Math.cos(angle + t * 0.3)
            const py = y + size * Math.sin(angle + t * 0.3)
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()

          const hue = ((x + y) * 0.5 + t * 50) % 360
          ctx.fillStyle = `hsla(${hue}, 60%, 50%, 0.7)`
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }
    }

    const drawTriGrid = (t: number) => {
      const size = 35
      const height = size * Math.sqrt(3) / 2

      for (let row = -1; row < h / height + 1; row++) {
        for (let col = -1; col < w / size + 1; col++) {
          const upward = (row + col) % 2 === 0
          const x = col * (size / 2)
          const y = row * height

          ctx.beginPath()
          if (upward) {
            ctx.moveTo(x, y + height)
            ctx.lineTo(x + size / 2, y)
            ctx.lineTo(x + size, y + height)
          } else {
            ctx.moveTo(x, y)
            ctx.lineTo(x + size, y)
            ctx.lineTo(x + size / 2, y + height)
          }
          ctx.closePath()

          const hue = ((row * 40 + col * 20) + t * 30) % 360
          ctx.fillStyle = `hsla(${hue}, 50%, 55%, 0.8)`
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'
          ctx.stroke()
        }
      }
    }

    const drawCairo = (t: number) => {
      const size = 40
      for (let row = -1; row < h / size + 2; row++) {
        for (let col = -1; col < w / size + 2; col++) {
          const x = col * size
          const y = row * size
          const wobble = Math.sin(t + col * 0.3 + row * 0.3) * 3

          // Cairo pentagon approximation
          ctx.beginPath()
          ctx.moveTo(x + wobble, y)
          ctx.lineTo(x + size * 0.7, y + wobble)
          ctx.lineTo(x + size, y + size * 0.3)
          ctx.lineTo(x + size * 0.5, y + size * 0.7 + wobble)
          ctx.lineTo(x, y + size * 0.4)
          ctx.closePath()

          const hue = ((col + row) * 30 + t * 20) % 360
          ctx.fillStyle = `hsla(${hue}, 45%, 55%, 0.8)`
          ctx.fill()
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'
          ctx.stroke()
        }
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h)
      const t = animate ? time : 0

      switch (type) {
        case 'hexagonal': drawHexGrid(t); break
        case 'triangular': drawTriGrid(t); break
        case 'cairo': drawCairo(t); break
      }

      if (animate) {
        time += 0.01
        animRef.current = requestAnimationFrame(render)
      }
    }
    render()
    return () => cancelAnimationFrame(animRef.current)
  }, [type, animate])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## Penrose Tiles

Kite and dart aperiodic tiling with deflation generation.

```tsx
'use client'
import { useRef, useEffect } from 'react'

type PenroseTile = { type: 'kite' | 'dart'; vertices: [number, number][] }

const PHI = (1 + Math.sqrt(5)) / 2

function generatePenrose(depth: number, cx: number, cy: number, radius: number): PenroseTile[] {
  // Start with a sun (10 kites)
  let tiles: PenroseTile[] = []
  for (let i = 0; i < 10; i++) {
    const a1 = ((i * 36) * Math.PI) / 180
    const a2 = (((i + 1) * 36) * Math.PI) / 180
    const mid = (((i * 36 + 18)) * Math.PI) / 180
    tiles.push({
      type: 'kite',
      vertices: [
        [cx, cy],
        [cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius],
        [cx + Math.cos(mid) * radius / PHI, cy + Math.sin(mid) * radius / PHI],
        [cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius],
      ],
    })
  }

  // Subdivide
  for (let d = 0; d < depth; d++) {
    const newTiles: PenroseTile[] = []
    for (const tile of tiles) {
      const [A, B, C, D] = tile.vertices
      if (tile.type === 'kite') {
        const E: [number, number] = [A[0] + (B[0] - A[0]) / PHI, A[1] + (B[1] - A[1]) / PHI]
        const F: [number, number] = [A[0] + (D[0] - A[0]) / PHI, A[1] + (D[1] - A[1]) / PHI]
        newTiles.push({ type: 'kite', vertices: [A, E, C, F] })
        newTiles.push({ type: 'dart', vertices: [E, B, C, E] })
        newTiles.push({ type: 'dart', vertices: [F, C, D, F] })
      } else {
        const E: [number, number] = [B[0] + (A[0] - B[0]) / PHI, B[1] + (A[1] - B[1]) / PHI]
        newTiles.push({ type: 'kite', vertices: [E, B, C, E] })
        newTiles.push({ type: 'dart', vertices: [A, E, C, D] })
      }
    }
    tiles = newTiles
  }
  return tiles
}

export function PenroseTiling({ depth = 3 }: { depth?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2
    ctx.scale(2, 2)

    const tiles = generatePenrose(depth, w / 2, h / 2, Math.min(w, h) * 0.45)
    let drawn = 0

    const animate = () => {
      if (drawn >= tiles.length) return

      const batch = Math.min(10, tiles.length - drawn)
      for (let i = 0; i < batch; i++) {
        const tile = tiles[drawn + i]
        ctx.beginPath()
        tile.vertices.forEach(([x, y], j) => {
          if (j === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()

        ctx.fillStyle = tile.type === 'kite'
          ? `hsla(220, 60%, 50%, 0.7)`
          : `hsla(40, 70%, 55%, 0.7)`
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
      drawn += batch

      if (drawn < tiles.length) {
        animRef.current = requestAnimationFrame(animate)
      }
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [depth])

  return <canvas ref={canvasRef} className="w-full h-full bg-gray-950" />
}
```

## Polyominoes

Pentomino puzzle with animated placement.

```tsx
'use client'
import { useRef, useCallback } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

// All 12 pentomino shapes (relative cell positions)
const PENTOMINOES: { name: string; cells: [number, number][]; color: string }[] = [
  { name: 'F', cells: [[0,1],[1,0],[1,1],[1,2],[2,2]], color: '#ef4444' },
  { name: 'I', cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], color: '#f97316' },
  { name: 'L', cells: [[0,0],[1,0],[2,0],[3,0],[3,1]], color: '#eab308' },
  { name: 'N', cells: [[0,0],[1,0],[1,1],[2,1],[3,1]], color: '#22c55e' },
  { name: 'P', cells: [[0,0],[0,1],[1,0],[1,1],[2,0]], color: '#06b6d4' },
  { name: 'T', cells: [[0,0],[0,1],[0,2],[1,1],[2,1]], color: '#8b5cf6' },
  { name: 'U', cells: [[0,0],[0,2],[1,0],[1,1],[1,2]], color: '#ec4899' },
  { name: 'V', cells: [[0,0],[1,0],[2,0],[2,1],[2,2]], color: '#14b8a6' },
  { name: 'W', cells: [[0,0],[1,0],[1,1],[2,1],[2,2]], color: '#f43f5e' },
  { name: 'X', cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], color: '#a855f7' },
  { name: 'Y', cells: [[0,0],[1,0],[1,1],[2,0],[3,0]], color: '#fb923c' },
  { name: 'Z', cells: [[0,0],[0,1],[1,1],[2,1],[2,2]], color: '#38bdf8' },
]

const CELL_SIZE = 28

export function PentominoShowcase() {
  const svgRef = useRef<SVGSVGElement>(null)

  useGSAP(() => {
    const pieces = svgRef.current!.querySelectorAll('.pentomino-group')
    gsap.from(pieces, {
      scale: 0,
      rotation: 180,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'back.out(1.7)',
      transformOrigin: 'center center',
    })
  }, { scope: svgRef })

  return (
    <svg ref={svgRef} viewBox="0 0 500 200" className="w-full max-w-2xl">
      {PENTOMINOES.map((piece, pi) => {
        const offsetX = (pi % 6) * 80 + 10
        const offsetY = Math.floor(pi / 6) * 100 + 10

        return (
          <g key={piece.name} className="pentomino-group">
            {piece.cells.map(([r, c], ci) => (
              <rect
                key={ci}
                x={offsetX + c * CELL_SIZE}
                y={offsetY + r * CELL_SIZE}
                width={CELL_SIZE - 2}
                height={CELL_SIZE - 2}
                rx={3}
                fill={piece.color}
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={1}
              />
            ))}
            <text
              x={offsetX + 10}
              y={offsetY - 5}
              className="text-xs fill-white/50 font-mono"
            >
              {piece.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

## Geometric Transformations

Animated rotation, reflection, dilation, and composition.

```tsx
'use client'
import { useRef, useState } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

type TransformType = 'rotate' | 'reflect' | 'dilate' | 'compose'

export function GeometricTransform({ type = 'rotate' }: { type?: TransformType }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [playing, setPlaying] = useState(false)

  const animate = () => {
    if (playing) return
    setPlaying(true)
    const shape = svgRef.current!.querySelector('#transform-shape')!
    const ghost = svgRef.current!.querySelector('#transform-ghost')!

    gsap.set(ghost, { opacity: 0.3 })

    const tl = gsap.timeline({ onComplete: () => setPlaying(false) })

    switch (type) {
      case 'rotate':
        tl.to(shape, { rotation: 90, duration: 1.5, ease: 'power2.inOut', transformOrigin: '200 200' })
          .to(shape, { rotation: 0, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200', delay: 0.5 })
        break
      case 'reflect':
        tl.to(shape, { scaleX: -1, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200' })
          .to(shape, { scaleX: 1, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200', delay: 0.5 })
        break
      case 'dilate':
        tl.to(shape, { scale: 1.8, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200' })
          .to(shape, { scale: 1, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200', delay: 0.5 })
        break
      case 'compose':
        tl.to(shape, { rotation: 45, scale: 1.3, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200' })
          .to(shape, { scaleX: -1, duration: 0.8, ease: 'power2.inOut', transformOrigin: '200 200' })
          .to(shape, { rotation: 0, scale: 1, scaleX: 1, duration: 1, ease: 'power2.inOut', transformOrigin: '200 200', delay: 0.5 })
        break
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <svg ref={svgRef} viewBox="0 0 400 400" className="w-80 h-80">
        {/* Axes */}
        <line x1="200" y1="0" x2="200" y2="400" stroke="rgba(255,255,255,0.1)" strokeDasharray="4" />
        <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(255,255,255,0.1)" strokeDasharray="4" />
        {/* Ghost (original position) */}
        <polygon
          id="transform-ghost"
          points="160,140 240,140 260,200 240,260 160,260 140,200"
          fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4"
          opacity="0"
        />
        {/* Shape */}
        <polygon
          id="transform-shape"
          points="160,140 240,140 260,200 240,260 160,260 140,200"
          fill="rgba(139, 92, 246, 0.6)" stroke="#8b5cf6" strokeWidth="2"
        />
        {/* Center marker */}
        <circle cx="200" cy="200" r="3" fill="#fff" />
      </svg>
      <button
        onClick={animate}
        disabled={playing}
        className="px-6 py-3 bg-white text-black font-mono text-sm uppercase tracking-wider disabled:opacity-50"
      >
        {type}
      </button>
    </div>
  )
}
```

## Dissection Puzzle Framework

Reusable framework for any SVG-based dissection puzzle.

```tsx
'use client'
import { useRef, useCallback } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

interface PuzzlePiece {
  id: string
  path: string          // SVG path data
  color: string
  states: Record<string, { x: number; y: number; rotation: number; scale?: number }>
}

interface DissectionPuzzleProps {
  pieces: PuzzlePiece[]
  viewBox?: string
  initialState: string
  className?: string
}

export function DissectionPuzzle({ pieces, viewBox = '0 0 400 400', initialState, className }: DissectionPuzzleProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const currentState = useRef(initialState)

  useGSAP(() => {
    pieces.forEach(piece => {
      const el = svgRef.current!.querySelector(`#dp-${piece.id}`)
      const state = piece.states[initialState]
      if (el && state) {
        gsap.set(el, {
          x: state.x,
          y: state.y,
          rotation: state.rotation,
          scale: state.scale ?? 1,
          transformOrigin: 'center center',
        })
      }
    })
  }, { scope: svgRef })

  const transitionTo = useCallback((targetState: string) => {
    if (currentState.current === targetState) return
    pieces.forEach((piece, i) => {
      const el = svgRef.current!.querySelector(`#dp-${piece.id}`)
      const state = piece.states[targetState]
      if (el && state) {
        gsap.to(el, {
          x: state.x,
          y: state.y,
          rotation: state.rotation,
          scale: state.scale ?? 1,
          duration: 1.2,
          ease: 'power2.inOut',
          delay: i * 0.1,
          transformOrigin: 'center center',
        })
      }
    })
    currentState.current = targetState
  }, [pieces])

  const availableStates = pieces[0] ? Object.keys(pieces[0].states) : []

  return (
    <div className={`flex flex-col items-center gap-4 ${className ?? ''}`}>
      <svg ref={svgRef} viewBox={viewBox} className="w-80 h-80">
        {pieces.map(piece => (
          <path
            key={piece.id}
            id={`dp-${piece.id}`}
            d={piece.path}
            fill={piece.color}
            stroke="#000"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="flex gap-2">
        {availableStates.map(state => (
          <button
            key={state}
            onClick={() => transitionTo(state)}
            className="px-4 py-2 text-sm font-mono uppercase border border-white/30 hover:bg-white hover:text-black transition-colors"
          >
            {state}
          </button>
        ))}
      </div>
    </div>
  )
}

// Example usage:
// <DissectionPuzzle
//   initialState="triangle"
//   pieces={[
//     {
//       id: 'p1',
//       path: 'M 0 0 L 50 0 L 25 43 Z',
//       color: '#f43f5e',
//       states: {
//         triangle: { x: 100, y: 100, rotation: 0 },
//         square: { x: 150, y: 50, rotation: 45 },
//       },
//     },
//     // ... more pieces
//   ]}
// />
```

## Choosing the Right Puzzle

| Puzzle | Best For | Complexity |
|--------|----------|------------|
| Dudeney | Math demonstrations, educational | Medium |
| Tangram | Interactive play, creativity | Low-Medium |
| Tessellation | Backgrounds, patterns | Low |
| Penrose | Mathematical beauty, wow factor | High |
| Polyominoes | Game-like interactions | Medium |
| Transformations | Educational, geometric concepts | Low |
