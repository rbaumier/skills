# Response: Adding UI Sounds to Web App

## When to Use Sound

Sound is appropriate **only** for:
- **Confirmations**: payment success, file upload complete
- **Errors/warnings that cannot be overlooked**: critical failures

**Never use sound for**: hover, focus, typing, scrolling, or any decorative/high-frequency interaction. No punishing error sounds.

## Implementation

```typescript
// Singleton AudioContext -- NEVER create one per sound
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  // Resume suspended context (browsers suspend until user gesture)
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Programmatic confirmation sound (oscillator with pitch movement)
export function playConfirmation() {
  const ctx = getAudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.frequency.setValueAtTime(440, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)

  gain.gain.setValueAtTime(0.3, ctx.currentTime) // Default volume 0.3, NEVER 1.0
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3) // Target 0.001, never 0

  osc.start()
  osc.stop(ctx.currentTime + 0.3)

  // Clean up nodes after playback
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

// Click/tap sound (filtered noise, 5-15ms)
export function playTap() {
  const ctx = getAudioContext()
  const bufferSize = ctx.sampleRate * 0.01 // 10ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 4000 // 3000-6000Hz range
  filter.Q.value = 3 // Q: 2-5

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.3, ctx.currentTime) // Default volume 0.3
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.01)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()

  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
}
```

## Sound Manager with Required Controls

```typescript
class SoundManager {
  private enabled = true
  private volume = 0.3 // Default 0.3, never 1.0

  toggle() { this.enabled = !this.enabled }
  setVolume(v: number) { this.volume = Math.min(v, 0.8) } // Cap volume

  play(soundFn: () => void) {
    if (!this.enabled) return
    soundFn()
  }
}
```

## Mandatory Requirements

1. **Visual equivalent for every audio cue** -- toast notification, icon change, color shift. Sound-only feedback is never acceptable.
2. **Toggle setting** to disable all sounds -- respect user preference.
3. **Independent volume control** -- don't tie to system volume only.
4. **Respect `prefers-reduced-motion`** as proxy for sound sensitivity.
5. **Preload audio files** to avoid playback delay.
6. **Reset `currentTime`** before replay for rapid re-triggering.
