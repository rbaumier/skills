# Audio Reactive Animations

Tone.js y Web Audio API para experiencias sonoras interactivas estilo Awwwards.

## Table of Contents
1. [Decision Matrix](#decision-matrix)
2. [Tone.js Setup](#tonejs-setup)
3. [React Integration](#react-integration)
4. [Synths & Sounds](#synths--sounds)
5. [Audio Reactive Visuals](#audio-reactive-visuals)
6. [Scroll Audio](#scroll-audio)
7. [Hover & Click Sounds](#hover--click-sounds)
8. [Web Audio API Native](#web-audio-api-native)

## Decision Matrix

| Necesidad | Herramienta | Por qué |
|-----------|-------------|---------|
| Sintetizadores/música | Tone.js | API musical completa |
| Efectos simples (clicks) | Web Audio API nativo | Sin dependencias |
| Audio reactivo al scroll | Tone.js + ScrollTrigger | Sync con animaciones |
| Visualizador de audio | Web Audio Analyzer | FFT data |
| Samples/loops | Tone.Sampler | Fácil de usar |

## Tone.js Setup

### Instalación

```bash
npm install tone
```

### Importación

```tsx
import * as Tone from 'tone'

// O importar módulos específicos
import { Synth, FMSynth, Sampler, Transport, Destination } from 'tone'
```

## React Integration

### Audio Context Requirement

**IMPORTANTE**: El audio web requiere interacción del usuario para iniciar.

```tsx
'use client'

import { useState, useCallback } from 'react'
import * as Tone from 'tone'

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isAudioReady, setIsAudioReady] = useState(false)

  const initAudio = useCallback(async () => {
    await Tone.start()
    setIsAudioReady(true)
    console.log('Audio context started')
  }, [])

  return (
    <>
      {!isAudioReady && (
        <button
          onClick={initAudio}
          className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-white text-black rounded-full"
        >
          Enable Sound
        </button>
      )}
      {children}
    </>
  )
}
```

### Custom Hook: useTone

```tsx
'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import * as Tone from 'tone'

export function useTone() {
  const [isReady, setIsReady] = useState(false)

  const start = useCallback(async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start()
    }
    setIsReady(true)
  }, [])

  return { isReady, start, Tone }
}
```

### Custom Hook: useSynth

```tsx
'use client'

import { useRef, useEffect, useMemo } from 'react'
import * as Tone from 'tone'

export function useSynth(type: 'synth' | 'fm' | 'am' | 'membrane' = 'synth') {
  const synthRef = useRef<Tone.Synth | Tone.FMSynth | Tone.AMSynth | Tone.MembraneSynth | null>(null)

  useEffect(() => {
    // Crear synth según tipo
    switch (type) {
      case 'fm':
        synthRef.current = new Tone.FMSynth().toDestination()
        break
      case 'am':
        synthRef.current = new Tone.AMSynth().toDestination()
        break
      case 'membrane':
        synthRef.current = new Tone.MembraneSynth().toDestination()
        break
      default:
        synthRef.current = new Tone.Synth().toDestination()
    }

    return () => {
      synthRef.current?.dispose()
    }
  }, [type])

  const play = (note: string = 'C4', duration: string = '8n') => {
    if (Tone.context.state === 'running') {
      synthRef.current?.triggerAttackRelease(note, duration)
    }
  }

  return { play, synth: synthRef }
}
```

## Synths & Sounds

### Tipos de Sintetizadores

```tsx
'use client'

import { useEffect, useRef } from 'react'
import * as Tone from 'tone'

export function SynthDemo() {
  const synthsRef = useRef<{
    basic: Tone.Synth | null
    fm: Tone.FMSynth | null
    am: Tone.AMSynth | null
    membrane: Tone.MembraneSynth | null
    pluck: Tone.PluckSynth | null
    metal: Tone.MetalSynth | null
  }>({
    basic: null,
    fm: null,
    am: null,
    membrane: null,
    pluck: null,
    metal: null,
  })

  useEffect(() => {
    // Synth básico (saw/sine/square wave)
    synthsRef.current.basic = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.8 },
    }).toDestination()

    // FM Synth (metallic, bells)
    synthsRef.current.fm = new Tone.FMSynth({
      modulationIndex: 10,
      harmonicity: 3,
    }).toDestination()

    // AM Synth (tremolo effect)
    synthsRef.current.am = new Tone.AMSynth().toDestination()

    // Membrane Synth (kicks, drums)
    synthsRef.current.membrane = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
    }).toDestination()

    // Pluck Synth (guitar-like)
    synthsRef.current.pluck = new Tone.PluckSynth().toDestination()

    // Metal Synth (hi-hats, cymbals)
    synthsRef.current.metal = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination()

    return () => {
      Object.values(synthsRef.current).forEach((s) => s?.dispose())
    }
  }, [])

  const playNote = async (type: keyof typeof synthsRef.current, note = 'C4') => {
    await Tone.start()
    synthsRef.current[type]?.triggerAttackRelease(note, '8n')
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => playNote('basic')}>Basic</button>
      <button onClick={() => playNote('fm')}>FM</button>
      <button onClick={() => playNote('am')}>AM</button>
      <button onClick={() => playNote('membrane', 'C2')}>Kick</button>
      <button onClick={() => playNote('pluck')}>Pluck</button>
      <button onClick={() => playNote('metal')}>Metal</button>
    </div>
  )
}
```

### Efectos de Audio

```tsx
// Crear cadena de efectos
const reverb = new Tone.Reverb({ decay: 2, wet: 0.5 }).toDestination()
const delay = new Tone.FeedbackDelay('8n', 0.5).connect(reverb)
const distortion = new Tone.Distortion(0.4).connect(delay)
const synth = new Tone.Synth().connect(distortion)

// O conectar en serie
synth.chain(distortion, delay, reverb, Tone.Destination)
```

### Sampler (Samples de Audio)

```tsx
'use client'

import { useEffect, useRef } from 'react'
import * as Tone from 'tone'

export function useSampler(samples: Record<string, string>) {
  const samplerRef = useRef<Tone.Sampler | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    samplerRef.current = new Tone.Sampler({
      urls: samples,
      onload: () => setIsLoaded(true),
    }).toDestination()

    return () => samplerRef.current?.dispose()
  }, [samples])

  const play = (note: string, duration?: string) => {
    if (isLoaded && Tone.context.state === 'running') {
      samplerRef.current?.triggerAttackRelease(note, duration || '8n')
    }
  }

  return { play, isLoaded }
}

// Uso
const { play, isLoaded } = useSampler({
  C4: '/sounds/piano-c4.mp3',
  E4: '/sounds/piano-e4.mp3',
  G4: '/sounds/piano-g4.mp3',
})
```

## Audio Reactive Visuals

### Analyzer + Canvas

```tsx
'use client'

import { useRef, useEffect } from 'react'
import * as Tone from 'tone'

export function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyzerRef = useRef<Tone.Analyser | null>(null)
  const playerRef = useRef<Tone.Player | null>(null)

  useEffect(() => {
    // Crear analyzer
    analyzerRef.current = new Tone.Analyser('waveform', 256)

    // Player conectado al analyzer
    playerRef.current = new Tone.Player({
      url: '/audio/track.mp3',
      loop: true,
    }).connect(analyzerRef.current)

    analyzerRef.current.toDestination()

    // Animation loop
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    function draw() {
      const values = analyzerRef.current?.getValue() as Float32Array

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = '#00f5ff'
      ctx.beginPath()

      const sliceWidth = canvas.width / values.length
      let x = 0

      for (let i = 0; i < values.length; i++) {
        const v = (values[i] + 1) / 2 // Normalize -1 to 1 → 0 to 1
        const y = v * canvas.height

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)

        x += sliceWidth
      }

      ctx.stroke()
      requestAnimationFrame(draw)
    }

    draw()

    return () => {
      playerRef.current?.dispose()
      analyzerRef.current?.dispose()
    }
  }, [])

  const togglePlay = async () => {
    await Tone.start()
    if (playerRef.current?.state === 'started') {
      playerRef.current.stop()
    } else {
      playerRef.current?.start()
    }
  }

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={200} className="bg-black" />
      <button onClick={togglePlay}>Play/Pause</button>
    </div>
  )
}
```

### FFT Bars Visualizer

```tsx
'use client'

import { useRef, useEffect } from 'react'
import * as Tone from 'tone'

export function FFTVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fftRef = useRef<Tone.FFT | null>(null)

  useEffect(() => {
    fftRef.current = new Tone.FFT(64)

    // Conectar micrófono o audio
    const mic = new Tone.UserMedia().connect(fftRef.current)
    mic.open()

    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const barCount = 64

    function draw() {
      const values = fftRef.current?.getValue() as Float32Array

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = canvas.width / barCount
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']

      for (let i = 0; i < barCount; i++) {
        // FFT values are in dB, normalize to 0-1
        const value = (values[i] + 140) / 140
        const barHeight = value * canvas.height

        ctx.fillStyle = colors[i % colors.length]
        ctx.fillRect(
          i * barWidth,
          canvas.height - barHeight,
          barWidth - 2,
          barHeight
        )
      }

      requestAnimationFrame(draw)
    }

    draw()

    return () => {
      mic.close()
      fftRef.current?.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} width={600} height={300} className="bg-black" />
}
```

## Scroll Audio

### Audio Reactivo al Scroll con GSAP

```tsx
'use client'

import { useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'

export function ScrollAudio() {
  const containerRef = useRef<HTMLDivElement>(null)
  const synthRef = useRef<Tone.Synth | null>(null)
  const filterRef = useRef<Tone.Filter | null>(null)

  useEffect(() => {
    filterRef.current = new Tone.Filter(200, 'lowpass').toDestination()
    synthRef.current = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
    }).connect(filterRef.current)

    return () => {
      synthRef.current?.dispose()
      filterRef.current?.dispose()
    }
  }, [])

  useGSAP(() => {
    // Cambiar frecuencia del filtro con scroll
    ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        // Mapear progreso a frecuencia (200Hz - 5000Hz)
        const freq = 200 + self.progress * 4800
        filterRef.current?.frequency.rampTo(freq, 0.1)
      },
    })

    // Trigger notas en secciones específicas
    const sections = gsap.utils.toArray<HTMLElement>('.audio-section')
    const notes = ['C4', 'E4', 'G4', 'B4']

    sections.forEach((section, i) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        onEnter: async () => {
          await Tone.start()
          synthRef.current?.triggerAttackRelease(notes[i % notes.length], '8n')
        },
      })
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="h-[400vh]">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="audio-section h-screen flex items-center justify-center">
          Section {i}
        </div>
      ))}
    </div>
  )
}
```

### Pitch Basado en Scroll Progress

```tsx
'use client'

import { useRef, useEffect } from 'react'
import * as Tone from 'tone'

export function ScrollPitch() {
  const oscillatorRef = useRef<Tone.Oscillator | null>(null)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    oscillatorRef.current = new Tone.Oscillator({
      frequency: 220,
      type: 'sine',
    }).toDestination()

    const handleScroll = () => {
      const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight)
      // Mapear scroll a frecuencia (110Hz - 880Hz = 2 octavas)
      const freq = 110 * Math.pow(2, scrollPercent * 2)
      oscillatorRef.current?.frequency.rampTo(freq, 0.05)
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      oscillatorRef.current?.dispose()
    }
  }, [])

  const toggleSound = async () => {
    await Tone.start()
    if (isPlayingRef.current) {
      oscillatorRef.current?.stop()
    } else {
      oscillatorRef.current?.start()
    }
    isPlayingRef.current = !isPlayingRef.current
  }

  return (
    <button onClick={toggleSound} className="fixed bottom-4 right-4">
      Toggle Scroll Sound
    </button>
  )
}
```

## Hover & Click Sounds

### Hook para UI Sounds

```tsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import * as Tone from 'tone'

const UI_SOUNDS = {
  hover: { note: 'G5', duration: '32n', synth: 'pluck' },
  click: { note: 'C4', duration: '16n', synth: 'membrane' },
  success: { note: 'C5', duration: '8n', synth: 'fm' },
  error: { note: 'A2', duration: '4n', synth: 'membrane' },
}

export function useUISound() {
  const synthsRef = useRef<{
    pluck: Tone.PluckSynth | null
    membrane: Tone.MembraneSynth | null
    fm: Tone.FMSynth | null
  }>({ pluck: null, membrane: null, fm: null })

  useEffect(() => {
    synthsRef.current.pluck = new Tone.PluckSynth().toDestination()
    synthsRef.current.membrane = new Tone.MembraneSynth().toDestination()
    synthsRef.current.fm = new Tone.FMSynth().toDestination()

    // Reducir volumen para UI sounds
    Object.values(synthsRef.current).forEach((s) => {
      if (s) s.volume.value = -12
    })

    return () => {
      Object.values(synthsRef.current).forEach((s) => s?.dispose())
    }
  }, [])

  const play = useCallback(async (type: keyof typeof UI_SOUNDS) => {
    if (Tone.context.state !== 'running') return

    const config = UI_SOUNDS[type]
    const synth = synthsRef.current[config.synth as keyof typeof synthsRef.current]
    synth?.triggerAttackRelease(config.note, config.duration)
  }, [])

  return { play }
}

// Uso en componente
export function SoundButton({ children }: { children: React.ReactNode }) {
  const { play } = useUISound()

  return (
    <button
      onMouseEnter={() => play('hover')}
      onClick={() => play('click')}
      className="px-4 py-2 bg-white text-black rounded"
    >
      {children}
    </button>
  )
}
```

### Magnetic Button con Sonido

```tsx
'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import * as Tone from 'tone'

export function MagneticSoundButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const synthRef = useRef<Tone.PluckSynth | null>(null)

  // Inicializar synth
  useState(() => {
    synthRef.current = new Tone.PluckSynth().toDestination()
    synthRef.current.volume.value = -15
  })

  const handleMouse = async (e: React.MouseEvent) => {
    const { left, top, width, height } = ref.current!.getBoundingClientRect()
    const x = (e.clientX - left - width / 2) * 0.3
    const y = (e.clientY - top - height / 2) * 0.3
    setPosition({ x, y })

    // Pitch basado en posición
    await Tone.start()
    const note = Math.round(60 + (x / 50) * 12) // MIDI note
    const freq = Tone.Frequency(note, 'midi').toFrequency()
    synthRef.current?.triggerAttackRelease(freq, '32n')
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={() => setPosition({ x: 0, y: 0 })}
      animate={position}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
      className="px-8 py-4 bg-white text-black rounded-full"
    >
      {children}
    </motion.button>
  )
}
```

## Web Audio API Native

### Sin Tone.js (Lightweight)

```tsx
'use client'

import { useRef, useCallback } from 'react'

export function useNativeAudio() {
  const contextRef = useRef<AudioContext | null>(null)

  const getContext = useCallback(() => {
    if (!contextRef.current) {
      contextRef.current = new AudioContext()
    }
    return contextRef.current
  }, [])

  const playTone = useCallback((frequency: number, duration: number = 0.1) => {
    const ctx = getContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  }, [getContext])

  const playClick = useCallback(() => playTone(800, 0.05), [playTone])
  const playHover = useCallback(() => playTone(1200, 0.03), [playTone])

  return { playTone, playClick, playHover }
}
```

## Best Practices

### 1. Siempre Esperar Interacción del Usuario

```tsx
// El audio NO funciona sin interacción
document.addEventListener('click', async () => {
  await Tone.start()
}, { once: true })
```

### 2. Dispose de Recursos

```tsx
useEffect(() => {
  const synth = new Tone.Synth().toDestination()
  return () => synth.dispose() // Importante!
}, [])
```

### 3. Volumen Apropiado para UI

```tsx
synth.volume.value = -12 // -12dB para efectos sutiles
```

### 4. Respetar Preferencias del Usuario

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const isMuted = localStorage.getItem('audio-muted') === 'true'
```

## Recursos

- [Tone.js](https://tonejs.github.io/)
- [Tone.js GitHub Wiki](https://github.com/Tonejs/Tone.js/wiki)
- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Reactronica](https://reactronica.com/) - React + Tone.js
