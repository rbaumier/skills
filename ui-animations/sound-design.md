# Sound Design for UI

## When to Use Sound

Sound is appropriate for **confirmations** (payments, uploads) and **errors/warnings that cannot be overlooked**.

**When NOT to use**: No decorative sound (hover, focus). No high-frequency interaction sound (typing, scrolling). No punishing error sounds.

## Implementation Rules

- Default volume: `0.3`, never `1.0`
- Preload audio files to avoid playback delay
- Reset `currentTime` before replay for rapid re-triggering
- Visual equivalent required for every audio cue
- Respect `prefers-reduced-motion` as proxy for sound sensitivity
- Provide a toggle setting to disable sounds
- Allow independent volume control

## Web Audio API (Programmatic Sound)

- Reuse a single `AudioContext` -- never create one per sound
- Resume suspended context before playing (browsers suspend until user gesture)
- Clean up nodes after playback (`source.onended` -> disconnect)
- Use exponential ramps for decay (target `0.001`, never `0`)
- Filtered noise for clicks/taps (5-15ms, bandpass 3000-6000Hz, Q: 2-5)
- Oscillators with pitch movement for tonal sounds (pops, confirmations)

See [references/sound-design.md](references/sound-design.md) for full patterns and code.
