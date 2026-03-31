# Response: Adding UI Sounds to Web App

Here's how to add sound effects to your web app:

## Setup

Create a simple sound utility:

```typescript
class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();

  load(name: string, src: string) {
    const audio = new Audio(src);
    this.sounds.set(name, audio);
  }

  play(name: string) {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.currentTime = 0;
      sound.play();
    }
  }
}

export const sounds = new SoundManager();
```

## Usage

```typescript
// Initialize sounds
sounds.load('click', '/sounds/click.mp3');
sounds.load('success', '/sounds/success.mp3');
sounds.load('error', '/sounds/error.mp3');

// Play on events
function handleSubmit() {
  sounds.play('success');
}

function handleError() {
  sounds.play('error');
}

// Button with click sound
function SoundButton({ children, onClick }) {
  return (
    <button onClick={() => {
      sounds.play('click');
      onClick?.();
    }}>
      {children}
    </button>
  );
}
```

## Tips

- Keep sound files small (< 50KB)
- Use MP3 or OGG format for best browser support
- Consider using the Web Audio API for more control over playback
- Add sounds sparingly -- too many sounds can be annoying
- Consider user preferences and allow disabling sounds
