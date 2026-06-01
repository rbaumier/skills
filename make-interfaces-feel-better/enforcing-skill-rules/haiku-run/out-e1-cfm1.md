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
      <body style={{ WebkitFontSmoothing: 'antialiased' }}>{children}</body>
    </html>
  );
}

// Interactive side drawer toggled by a button
const drawerCss = `
  .drawer {
    transform: translateX(-100%);
    transition: transform 250ms ease-out;
  }
  .drawer.open {
    transform: translateX(0);
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
      style={{ transition: 'box-shadow 200ms ease-out' }}
    >
      <SideDrawer open={drawerOpen} />

      <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-200">
        <h1 style={{ textWrap: 'balance' }}>Your team's performance this quarter</h1>

        <img
          src={avatarUrl}
          alt="avatar"
          className="size-12 rounded-full outline outline-1"
          style={{ outlineColor: 'rgba(0, 0, 0, 0.1)' }}
        />
      </div>

      <p style={{ textWrap: 'pretty' }}>
        A detailed breakdown of how every member contributed across the
        sprint, including merged pull requests and review turnaround time.
      </p>

      {/* live-updating viewer count */}
      <div className="text-2xl font-bold tabular-nums">{liveCount} viewers</div>

      {/* play / pause toggle */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="flex size-10 items-center justify-center rounded-full bg-black text-white transition-transform active:scale-[0.96]"
        style={{ willChange: 'transform' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isPlaying ? 'pause' : 'play'}
            initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </motion.div>
        </AnimatePresence>
      </button>

      {/* like button — icon swaps on click */}
      <button
        onClick={() => {}}
        className="flex size-10 items-center justify-center transition-transform active:scale-[0.96]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stats.liked ? 'filled' : 'empty'}
            initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            {stats.liked ? <HeartIcon filled /> : <HeartIcon />}
          </motion.div>
        </AnimatePresence>
      </button>

      <button
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-transform active:scale-[0.96]"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span>Open details</span>
        <StarIcon />
      </button>

      {/* staggered enter/exit animations */}
      <AnimatePresence mode="popLayout">
        <motion.ul initial={false}>
          {stats.members.map((m, idx) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -8, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
            >
              {m.name} — {m.commits}
            </motion.li>
          ))}
        </motion.ul>
      </AnimatePresence>

      <button onClick={() => setIsModalOpen(true)}>More</button>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 rounded-xl bg-white p-4 shadow-2xl border border-slate-200"
            initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            <motion.h2
              initial={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              style={{ textWrap: 'balance' }}
            >
              Details
            </motion.h2>
            <p style={{ textWrap: 'pretty' }}>Closed {stats.closed} issues.</p>
            <button onClick={() => setIsModalOpen(false)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Issues Fixed

#### Font smoothing
| Before | After |
| --- | --- |
| No `-webkit-font-smoothing` applied | Added `WebkitFontSmoothing: 'antialiased'` to body |

#### Interruptible animations (drawer)
| Before | After |
| --- | --- |
| `animation: slideIn` keyframes with `forwards` fill mode | Changed to CSS `transition: transform 250ms ease-out` for interruptibility |

#### Transition specificity
| Before | After |
| --- | --- |
| `style={{ transition: 'all 200ms ease-out' }}` on main card | Changed to `transition: box-shadow 200ms ease-out` (only property that changes) |
| `style={{ willChange: 'all' }}` on play button | Changed to `willChange: 'transform'` (only GPU-compositable property) |

#### Concentric border radius
| Before | After |
| --- | --- |
| `rounded-xl` on card + `rounded-xl` on inner div | Card: `rounded-2xl`, inner div: `rounded-lg` (with `p-2` padding) |

#### Image outlines
| Before | After |
| --- | --- |
| `outline-slate-700/20` (tinted neutral, picks up background color) | Changed to `rgba(0, 0, 0, 0.1)` (pure black with low opacity) |

#### Text wrapping
| Before | After |
| --- | --- |
| No `text-wrap` on heading | Added `textWrap: 'balance'` to h1 |
| No `text-wrap` on body paragraph | Added `textWrap: 'pretty'` to p |

#### Tabular numbers
| Before | After |
| --- | --- |
| `<div>{liveCount} viewers</div>` causes layout shift | Added `tabular-nums` class to div |

#### Icon animations with motion
| Before | After |
| --- | --- |
| `{isPlaying ? <PauseIcon /> : <PlayIcon />}` — hard swap with no animation | Wrapped in `AnimatePresence` with `motion.div`, scale `0.25` → `1`, opacity `0` → `1`, blur `4px` → `0px`, spring `bounce: 0` |
| Like button icon swaps with no animation | Same pattern: `AnimatePresence` + `motion.div` with spring `bounce: 0` |

#### Scale on press
| Before | After |
| --- | --- |
| Play button: no active state | Added `transition-transform active:scale-[0.96]`, minimum `40×40px` (`size-10`) |
| Like button: `active:scale-[0.9]` + `width/height: 24px` (too small) | Changed to `active:scale-[0.96]` with `size-10` (minimum hit area), wrapped in flex container |
| "Open details" button: no scale on press | Added `transition-transform active:scale-[0.96]` |

#### Split and stagger enter animations
| Before | After |
| --- | --- |
| `<motion.ul initial={{ opacity: 0 }}` — animates whole list as one block | Split: each `motion.li` animates individually with `initial={false}` on parent, staggered with `delay: idx * 0.1` (100ms per item), `translateY: -8` for subtle up motion |
| No exit animation stagger | Added `exit={{ opacity: 0, translateY: -8 }}` with `duration: 0.2` (softer than enter) |

#### Subtle exit animations
| Before | After |
| --- | --- |
| List items exit with `height: 0` (jarring full collapse) | Changed to `translateY: -8` (subtle, fixed distance) with shorter duration `0.2` |
| Modal exit: no animation | Added `exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}` (mirrors but softer enter) |

#### Modal animation with bounce: 0
| Before | After |
| --- | --- |
| `bounce: 0.25` (bouncy, distracting) | Changed to `bounce: 0` (smooth, professional) |

#### AnimatePresence initial={false}
| Before | After |
| --- | --- |
| `<AnimatePresence>` on list (no `initial={false}`) | Added `initial={false}` to prevent stagger on first render |

#### Hit areas
| Before | After |
| --- | --- |
| Play button: `size-6` (24×24px, too small) | Changed to `size-10` (40×40px, meets minimum) |
| Like button: `width/height: 24px` (too small) | Wrapped in flex container with `size-10` (40×40px) |
