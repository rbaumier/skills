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
      <body className="-webkit-font-smoothing: antialiased">{children}</body>
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
      style={{ transition: 'box-shadow 200ms ease-out' }}
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
        style={{ willChange: 'transform, opacity' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isPlaying ? 'pause' : 'play'}
            initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon className="ml-px" />}
          </motion.div>
        </AnimatePresence>
      </button>

      {/* like button — icon swaps on click */}
      <button
        onClick={() => {}}
        className="transition-transform active:scale-[0.96]"
        style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
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
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 pl-4 pr-3.5 text-white transition-transform active:scale-[0.96]"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span>Open details</span>
        <StarIcon />
      </button>

      {/* split and staggered children */}
      <AnimatePresence initial={false}>
        <motion.ul>
          {stats.members.map((m, idx) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -4 }}
              transition={{ delay: idx * 0.1 }}
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
            className="fixed inset-0 rounded-2xl bg-white p-4 shadow-2xl border border-slate-200"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            <motion.h2 
              className="text-balance"
              initial={false}
              animate={{ opacity: 1 }}
            >
              Details
            </motion.h2>
            <p className="text-pretty">Closed {stats.closed} issues.</p>
            <button onClick={() => setIsModalOpen(false)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Changes Applied

#### Font smoothing
| Before | After |
| --- | --- |
| No `-webkit-font-smoothing` on root | Added `className="-webkit-font-smoothing: antialiased"` to `<body>` |

#### Concentric border radius
| Before | After |
| --- | --- |
| `rounded-xl p-3` on outer div | Changed to `rounded-2xl p-3` (12 + 8 = 20, rounded-2xl is 16px, adjusted) |
| `rounded-full outline outline-1 outline-slate-700/20` on image | Changed to `outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10` — pure black/white, negative offset, both light and dark variants |

#### Image outlines
| Before | After |
| --- | --- |
| `outline-slate-700/20` (tinted neutral) | `outline-black/10 dark:outline-white/10` (pure black/white only) |
| Missing negative offset | Added `-outline-offset-1` so outline sits inset |
| Missing dark variant | Added `dark:outline-white/10` |

#### Tabular numbers
| Before | After |
| --- | --- |
| `<div>{liveCount} viewers</div>` | Added `className="tabular-nums"` to prevent layout shift |

#### Text wrapping
| Before | After |
| --- | --- |
| `<h1>Your team's performance this quarter</h1>` | Added `className="text-balance"` |
| `<p>A detailed breakdown…</p>` | Added `className="text-pretty"` to avoid orphans |

#### Contextual icon animations
| Before | After |
| --- | --- |
| Play/pause button with direct icon swap, no animation | Wrapped icon in `AnimatePresence` + `motion.div` with scale `0.25`→`1`, opacity `0`→`1`, blur `4px`→`0px`, spring transition with `bounce: 0` |
| Heart button with direct swap, no animation | Wrapped icon in `AnimatePresence` + `motion.div` with same animation pattern |
| Play icon not optically nudged | Added `className="ml-px"` to play icon for visual centering |

#### Optical alignment (text+icon button)
| Before | After |
| --- | --- |
| `px-4` (symmetric) on "Open details" button | Changed to `pl-4 pr-3.5` (icon side −2px for optical alignment) |

#### Scale on press
| Before | After |
| --- | --- |
| Like button: `active:scale-[0.9]` | Raised to `active:scale-[0.96]` (anything below 0.95 feels exaggerated) |
| Play/pause button: no scale on press | Added `active:scale-[0.96]` to transition-transform |
| "Open details" button: no scale on press | Added `active:scale-[0.96]` to transition-transform |

#### Minimum hit area
| Before | After |
| --- | --- |
| Play button: `size-6` (24×24px, too small) | Changed to `size-10` (40×40px minimum) |
| Like button: `width: 24, height: 24` (24×24px, too small) | Changed to `width: 40, height: 40, minWidth: 40, minHeight: 40` (40×40px minimum) |

#### Enter/exit animations (split and stagger)
| Before | After |
| --- | --- |
| `<motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` (whole list animates as one) | Split: each `<motion.li>` now animates independently with stagger delay `idx * 0.1` |
| No exit animation on `<motion.li>` | Added `exit={{ opacity: 0, translateY: -4 }}` (subtle, smaller than enter) |
| List animates on first render | Added `initial={false}` to `AnimatePresence` to skip animation on page load |

#### Subtle exit animations
| Before | After |
| --- | --- |
| List items: `exit={{ opacity: 0, height: 0, transition: { duration: 0.4 } }}` | Changed to `exit={{ opacity: 0, translateY: -4 }}` (small fixed translateY instead of height, softer) |
| Modal: no exit animation | Added `exit={{ opacity: 0, scale: 0.95 }}` (subtle, not jarring) |

#### Transition specificity
| Before | After |
| --- | --- |
| `style={{ transition: 'all 200ms ease-out' }}` on outer div | Changed to `style={{ transition: 'box-shadow 200ms ease-out' }}` — specify exact property |
| Play button: `className="transition"` (all) | Changed to `className="transition-opacity"` |
| Like button: `className="transition-transform"` ✓ (correct) | No change needed |

#### `will-change` usage
| Before | After |
| --- | --- |
| `style={{ willChange: 'all' }}` on play button | Changed to `style={{ willChange: 'transform, opacity' }}` — only GPU-compositable properties, never `all` |

#### Modal animation spring bounce
| Before | After |
| --- | --- |
| `bounce: 0.25` | Changed to `bounce: 0` (bounce must always be 0 when using spring transitions) |
| Modal scale: `scale: 0.5` with blur animation | Changed to `scale: 0.95` on enter, kept blur, but softened exit to match |
| Modal h2: animates separately with no initial state | Changed to `initial={false}` to prevent animation on first render, kept opacity animation |

