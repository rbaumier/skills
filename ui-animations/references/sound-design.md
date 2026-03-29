# Sound Design for UI

Patterns for adding purposeful sound to interfaces using both audio files and Web Audio API synthesis.

## Table of Contents
1. [When to Use Sound](#when-to-use-sound)
2. [When NOT to Use Sound](#when-not-to-use-sound)
3. [Sound Weight and Duration](#sound-weight-and-duration)
4. [Implementation Rules](#implementation-rules)
5. [Sound Accessibility](#sound-accessibility)
6. [Sound Synthesis (Web Audio API)](#sound-synthesis-web-audio-api)
7. [Sound Design Patterns](#sound-design-patterns)

## When to Use Sound

Sound is appropriate for **confirmations** (payments, uploads, form submissions) and **errors/warnings that can't be overlooked**:

```tsx
async function handlePayment() {
  await processPayment();
  playSound("success");
  showConfirmation();
}

function handleError(error: Error) {
  playSound("error");
  showErrorToast(error.message);
}
```

## When NOT to Use Sound

- **No decorative sound**: Never add sound to hover, focus, or moments with no informational value
- **No high-frequency interaction sound**: Never on typing, keyboard navigation, scrolling
- **No punishing sound**: Errors should use gentle alerts, never harsh buzzers

## Sound Weight and Duration

Sound weight must match action importance, and duration must match action duration:

```tsx
// Correct: weight matches action
function handleToggle() {
  playSound("soft-click");    // Minor action = subtle sound
  setEnabled(!enabled);
}

function handlePurchase() {
  playSound("success-chime"); // Major action = richer sound
  completePurchase();
}

// Correct: duration matches action
function handleClick() {
  playSound("click");          // 50ms sound for instant action
}
```

## Implementation Rules

### Default Volume

**Default volume is subtle** -- start at `0.3`, never `1.0`:

```tsx
const DEFAULT_VOLUME = 0.3;
```

### Preload Audio Files

**Preload audio files** to avoid playback delay:

```tsx
const sounds = {
  success: new Audio("/sounds/success.mp3"),
  error: new Audio("/sounds/error.mp3"),
};

Object.values(sounds).forEach(audio => audio.load());

function playSound(name: keyof typeof sounds) {
  sounds[name].currentTime = 0;
  sounds[name].play();
}
```

### Reset Before Replay

**Reset `currentTime` before replay** to allow rapid re-triggering:

```tsx
function playSound() {
  audio.currentTime = 0;
  audio.play();
}
```

## Sound Accessibility

### Visual Equivalent Required

Every audio cue must have a corresponding visual feedback -- sound never replaces visual:

```tsx
function SubmitButton({ onClick }) {
  const [status, setStatus] = useState("idle");

  const handleClick = () => {
    playSound("success");
    setStatus("success"); // Visual equivalent
    onClick();
  };

  return <button data-status={status}>Submit</button>;
}
```

### Respect prefers-reduced-motion

Use `prefers-reduced-motion` as proxy for sound sensitivity:

```tsx
function playSound(name: string) {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion) return;
  audio.play();
}
```

### Provide a Toggle Setting

```tsx
function App() {
  const { soundEnabled } = usePreferences();
  return (
    <SoundProvider enabled={soundEnabled}>
      {children}
    </SoundProvider>
  );
}
```

### Independent Volume Control

Allow volume adjustment independent of system volume:

```tsx
function playSound() {
  const { volume } = usePreferences();
  audio.volume = volume;
  audio.play();
}
```

## Sound Synthesis (Web Audio API)

For programmatic sound generation without audio files.

### AudioContext Management

**Reuse a single AudioContext** -- never create one per sound:

```ts
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}
```

**Resume suspended context** before playing (browsers suspend until user gesture):

```ts
function playSound() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}
```

**Clean up nodes after playback** to prevent memory leaks:

```ts
source.start();
source.onended = () => {
  source.disconnect();
  gain.disconnect();
};
```

### Envelope Shaping

**Use exponential ramps** for natural decay (not linear). **Target `0.001`, never `0`** (exponential ramps cannot target zero). **Always set initial value before ramping** to avoid glitches:

```ts
const t = ctx.currentTime;
gain.gain.setValueAtTime(0.3, t);                        // Initial value
gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);  // Decay to near-zero
```

## Sound Design Patterns

### Filtered Noise for Clicks/Taps

Use filtered noise (not oscillators) for UI click sounds:

```ts
// Create noise burst (5-15ms duration)
const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < data.length; i++) {
  data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 50);
}

// Shape with bandpass filter (3000-6000Hz, Q: 2-5)
const filter = ctx.createBiquadFilter();
filter.type = "bandpass";
filter.frequency.value = 4000;
filter.Q.value = 3;
source.connect(filter).connect(gain).connect(ctx.destination);
```

### Oscillators for Tonal Sounds

Use oscillators with pitch movement for pops, confirmations:

```ts
osc.frequency.setValueAtTime(400, t);
osc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
```

### Synthesis Parameters

| Parameter | Range | Notes |
|-----------|-------|-------|
| Click duration | 5-15ms | `ctx.sampleRate * 0.008` |
| Bandpass filter | 3000-6000Hz | Crisp, not boomy |
| Filter Q | 2-5 | Focused but not harsh |
| Gain | Never exceed 1.0 | Default `0.3`, prevents clipping |

## NEVER Rules

- Never create a new `AudioContext` per sound (reuse one)
- Never use `gain.gain.exponentialRampToValueAtTime(0, ...)` (use `0.001`)
- Never skip `setValueAtTime()` before a ramp (causes glitches)
- Never forget `source.onended` cleanup (memory leak)
- Never use volume `1.0` as default (use `0.3`)
- Never add sound without visual equivalent
- Never add sound to hover, focus, or typing interactions
