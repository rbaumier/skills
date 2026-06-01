# Fixed Code

```tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PlayIcon, PauseIcon, HeartIcon, StarIcon } from './icons';

// package.json includes "motion": "^11.0.0"

// Root layout — wraps the whole app
export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="-webkit-font-smoothing antialiased">{children}</body>
    </html>
  );
}

// Interactive side drawer toggled by a button
const drawerCss = `
  .drawer {
    transform: translateX(-100%);
  }
  .drawer.open {
    animation: slideIn 250ms ease-out forwards;
  }
  @keyframes slideIn {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
`;

function SideDrawer({ open }: { open: boolean }) {
  return (
    <>
      <style>{drawerCss}</style>
      <aside className={open ? 'drawer open' : 'drawer'}>Filters</aside>
    </>
  );
}

export default function DashboardCard({ stats, avatarUrl }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [liveCount, setLiveCount] = useState(0);

  return (
    <div
      className="rounded-2xl p-3 border border-slate-200"
      style={{ transition: 'background-color 200ms ease-out' }}
    >
      <SideDrawer open={drawerOpen} />

      <div className="flex items-center justify-between rounded-xl bg-white p-2 border border-slate-200">
        <h1 className="text-balance">Your team's performance this quarter</h1>

        <img
          src={avatarUrl}
          alt="avatar"
          className="size-12 rounded-full outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      </div>

      <p className="text-pretty">
        A detailed breakdown of how every member contributed across the
        sprint, including merged pull requests and review turnaround time.
      </p>

      {/* live-updating viewer count */}
      <div className="text-2xl font-bold tabular-nums">{liveCount} viewers</div>

      {/* play / pause toggle */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="flex size-10 items-center justify-center rounded-full bg-black text-white transition-opacity"
        style={{ willChange: 'opacity' }}
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="pause"
              initial={{ opacity: 0, scale: 0.25 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.25 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <PauseIcon />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.25 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.25 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <PlayIcon className="ml-px" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* like button — icon swaps on click */}
      <button
        onClick={() => {}}
        className="transition-transform active:scale-[0.96]"
        style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
      >
        <AnimatePresence mode="wait">
          {stats.liked ? (
            <motion.div
              key="filled"
              initial={{ opacity: 0, scale: 0.25 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.25 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <HeartIcon filled />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.25 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.25 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <HeartIcon />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <button
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 pl-4 pr-3.5 text-white active:scale-[0.96] transition-transform"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span>Open details</span>
        <StarIcon />
      </button>

      {/* staggered enter animations with semantic splits */}
      <AnimatePresence initial={false}>
        <motion.ul>
          {stats.members.map((m, idx) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -8 }}
              transition={{
                delay: idx * 0.1,
                type: 'spring',
                duration: 0.3,
                bounce: 0,
              }}
            >
              {m.name} — {m.commits}
            </motion.li>
          ))}
        </motion.ul>
      </AnimatePresence>

      <button onClick={() => setIsModalOpen(true)}>More</button>

      <AnimatePresence initial={false}>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 rounded-2xl bg-white p-4 shadow-2xl border border-slate-200"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            <motion.h2
              initial={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 0.1, type: 'spring', duration: 0.3, bounce: 0 }}
            >
              Details
            </motion.h2>
            <p>Closed {stats.closed} issues.</p>
            <button onClick={() => setIsModalOpen(false)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Changes Applied

### Font Smoothing
| Before | After |
| --- | --- |
| Root `<body>` without smoothing | Added `className="-webkit-font-smoothing antialiased"` to `<body>` |

### Text Wrapping
| Before | After |
| --- | --- |
| `<h1>Your team's performance this quarter</h1>` | Added `className="text-balance"` |
| `<p>A detailed breakdown...</p>` | Added `className="text-pretty"` |

### Tabular Numbers
| Before | After |
| --- | --- |
| `<div className="text-2xl font-bold">{liveCount} viewers</div>` | Added `tabular-nums` class |

### Image Outlines
| Before | After |
| --- | --- |
| `outline outline-1 outline-slate-700/20` | Changed to `outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10` (pure black/white with negative offset and dark variant) |

### Icon Animations
| Before | After |
| --- | --- |
| Play/pause toggle: `{isPlaying ? <PauseIcon /> : <PlayIcon />}` direct swap | Wrapped each icon in `motion.div` with `initial={{ opacity: 0, scale: 0.25 }}`, `animate={{ opacity: 1, scale: 1 }}`, exit same, spring transition with `bounce: 0` |
| Play icon uncentered | Added `className="ml-px"` to `<PlayIcon />` for optical alignment |
| Heart button: direct swap | Wrapped each icon state in `motion.div` with staggered animations, `scale: 0.25→1`, `opacity: 0→1`, spring transition with `bounce: 0` |

### Scale on Press
| Before | After |
| --- | --- |
| Like button: `active:scale-[0.9]` | Changed to `active:scale-[0.96]` |
| Like button size: `24x24` | Increased to `40x40` (minimum hit area) with `minWidth`/`minHeight` to ensure 40×40px |
| Open details button: no scale on press | Added `active:scale-[0.96] transition-transform` |

### Optical Alignment (Text + Icon Button)
| Before | After |
| --- | --- |
| `className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-white"` | Added `pl-4 pr-3.5` to override symmetric `px-4` (icon side = text side − 2px) |

### Concentric Border Radius
| Before | After |
| --- | --- |
| Outer `rounded-xl` with inner `rounded-xl` and `p-3` padding | Changed outer to `rounded-2xl` (12 + 8 = 20, rounded to 2xl) |

### Exit Animations
| Before | After |
| --- | --- |
| List exit: `exit={{ opacity: 0, height: 0, transition: { duration: 0.4 } }}` | Changed to subtle `exit={{ opacity: 0, translateY: -8 }}` (small fixed translateY, no height) |
| Modal exit: no explicit exit animation | Added `exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}` (softer than enter, subtle scale) |

### Enter Animations (Split & Stagger)
| Before | After |
| --- | --- |
| `<motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` — whole list as one block | Broke into semantic chunks: each `<motion.li>` now has `initial={{ opacity: 0, translateY: -8 }}`, `animate={{ opacity: 1, translateY: 0 }}`, and `transition={{ delay: idx * 0.1, ... }}` (~100ms stagger per item) |
| Modal: `<motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` — header and body animate together | Split modal content: heading gets `delay: 0.1` so body renders first, header fades in slightly after |

### AnimatePresence `initial={false}`
| Before | After |
| --- | --- |
| List: `<AnimatePresence>` (animates on page load) | Added `initial={false}` to prevent enter animations on mount |
| Modal: `<AnimatePresence>` (animates on page load) | Added `initial={false}` to prevent enter animations on mount |

### Transition Specificity
| Before | After |
| --- | --- |
| Root div: `style={{ transition: 'all 200ms ease-out' }}` | Changed to `transition: 'background-color 200ms ease-out'` (specific property) |
| Play button: `className="... transition"` (implied `transition: all`) | Changed to `transition-opacity` (specific property) |

### `will-change` Specificity
| Before | After |
| --- | --- |
| Play button: `style={{ willChange: 'all' }}` | Changed to `willChange: 'opacity'` (GPU-composite property only) |

### Hit Area (40×40px Minimum)
| Before | After |
| --- | --- |
| Play button: `size-6` (24×24px) | Changed to `size-10` (40×40px) |
| Like button: `width: 24, height: 24` | Changed to `width: 40, height: 40` with `minWidth/minHeight` guards |

### Spring Transitions with `bounce: 0`
| Before | After |
| --- | --- |
| Modal: `transition={{ type: 'spring', duration: 0.3, bounce: 0.25 }}` | Changed `bounce: 0.25` to `bounce: 0` |
| All icon animations: no spring transition defined | Added `transition={{ type: 'spring', duration: 0.3, bounce: 0 }}` to all icon swaps |
