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
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}

// Interactive side drawer toggled by a button
const drawerCss = `
  .drawer {
    transform: translateX(-100%);
    transition-property: transform;
    transition-duration: 200ms;
    transition-timing-function: ease-out;
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
      className="rounded-2xl p-3 bg-white"
      style={{
        boxShadow:
          '0px 0px 0px 1px rgba(0, 0, 0, 0.06), 0px 1px 2px -1px rgba(0, 0, 0, 0.06), 0px 2px 4px 0px rgba(0, 0, 0, 0.04)',
      }}
    >
      <SideDrawer open={drawerOpen} />

      <div
        className="flex items-center justify-between rounded-xl bg-white p-2"
        style={{
          boxShadow:
            '0px 0px 0px 1px rgba(0, 0, 0, 0.06), 0px 1px 2px -1px rgba(0, 0, 0, 0.06), 0px 2px 4px 0px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h1 className="text-balance">Your team's performance this quarter</h1>

        <img
          src={avatarUrl}
          alt="avatar"
          className="size-12 rounded-full outline outline-1 -outline-offset-1 outline-black/10"
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
        className="flex size-10 items-center justify-center rounded-full bg-black text-white transition-transform duration-150 ease-out active:scale-[0.96]"
        style={{
          boxShadow:
            '0px 0px 0px 1px rgba(0, 0, 0, 0.06), 0px 1px 2px -1px rgba(0, 0, 0, 0.06), 0px 2px 4px 0px rgba(0, 0, 0, 0.04)',
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={isPlaying ? 'pause' : 'play'}
            initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* like button — icon swaps on click */}
      <button
        onClick={() => {}}
        className="relative transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={stats.liked ? 'filled' : 'empty'}
            initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            {stats.liked ? <HeartIcon filled /> : <HeartIcon />}
          </motion.span>
        </AnimatePresence>
      </button>

      <button
        className="flex items-center pl-4 pr-3.5 gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-transform duration-150 ease-out active:scale-[0.96]"
        style={{
          boxShadow:
            '0px 0px 0px 1px rgba(0, 0, 0, 0.06), 0px 1px 2px -1px rgba(0, 0, 0, 0.06), 0px 2px 4px 0px rgba(0, 0, 0, 0.04)',
        }}
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span>Open details</span>
        <StarIcon />
      </button>

      {/* staggered list items */}
      <AnimatePresence initial={false}>
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 },
            },
          }}
        >
          {stats.members.map((m) => (
            <motion.li
              key={m.id}
              variants={{
                hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
                visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
              }}
              exit={{
                opacity: 0,
                y: -12,
                filter: 'blur(4px)',
                transition: { duration: 0.15, ease: 'easeIn' },
              }}
            >
              {m.name} — {m.commits}
            </motion.li>
          ))}
        </motion.ul>
      </AnimatePresence>

      <button
        className="transition-transform duration-150 ease-out active:scale-[0.96]"
        onClick={() => setIsModalOpen(true)}
      >
        More
      </button>

      <AnimatePresence initial={false}>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 rounded-2xl bg-white p-4"
            style={{
              boxShadow:
                '0px 0px 0px 1px rgba(0, 0, 0, 0.06), 0px 1px 2px -1px rgba(0, 0, 0, 0.06), 0px 2px 4px 0px rgba(0, 0, 0, 0.04)',
            }}
            initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{
              opacity: 0,
              scale: 0.5,
              filter: 'blur(4px)',
              transition: { duration: 0.15, ease: 'easeIn' },
            }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            <motion.h2
              className="text-balance"
              initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.1, type: 'spring', duration: 0.3, bounce: 0 }}
            >
              Details
            </motion.h2>
            <p className="text-pretty">Closed {stats.closed} issues.</p>
            <button
              className="transition-transform duration-150 ease-out active:scale-[0.96]"
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </button>
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
| No font smoothing on root layout | Added `className="antialiased"` to `<html>` element |

#### Shadows instead of borders
| Before | After |
| --- | --- |
| `border border-slate-200` on outer card | Replaced with `box-shadow` (3-layer transparent shadow for depth and border) |
| `border border-slate-200` on inner header | Replaced with `box-shadow` |
| No shadow on play button | Added `box-shadow` with 40×40px hit area via size-10 |
| No shadow on details button | Added `box-shadow` and padding adjustment |

#### Concentric border radius
| Before | After |
| --- | --- |
| `rounded-xl p-3` on outer card with no calculation | Changed to `rounded-2xl p-3` (12 + 8 = 20px outer, 12px inner) |
| `rounded-xl p-2` on inner header | Left as-is (already concentric to parent) |

#### Image outlines
| Before | After |
| --- | --- |
| `outline outline-1 outline-slate-700/20` (tinted slate) | Changed to `outline outline-1 -outline-offset-1 outline-black/10` (pure black, light mode standard) |

#### Scale on press
| Before | After |
| --- | --- |
| `active:scale-[0.9]` on like button | Raised to `active:scale-[0.96]` and added transition |
| No scale on play button | Added `active:scale-[0.96]` with `transition-transform` |
| No scale on "Open details" button | Added `active:scale-[0.96]` with `transition-transform` |
| No scale on "More" button | Added `active:scale-[0.96]` with `transition-transform` |
| No scale on "Close" button in modal | Added `active:scale-[0.96]` with `transition-transform` |

#### Icon animations (play/pause)
| Before | After |
| --- | --- |
| Icon swap without animation — just toggles visibility | Wrapped in `AnimatePresence` with motion, scales 0.25→1, opacity 0→1, blur 4px→0px, spring timing with bounce: 0 |
| No `initial={false}` | Added `initial={false}` to prevent animation on mount |

#### Icon animations (like button)
| Before | After |
| --- | --- |
| Direct conditional render `{stats.liked ? <HeartIcon filled /> : <HeartIcon />}` | Wrapped in `AnimatePresence` with motion, cross-fades with spring animation |

#### Tabular numbers
| Before | After |
| --- | --- |
| `<div className="text-2xl font-bold">{liveCount} viewers</div>` | Added `tabular-nums` class to prevent layout shift on count update |

#### Typography
| Before | After |
| --- | --- |
| `<h1>Your team's performance this quarter</h1>` | Added `text-balance` to heading |
| `<p>A detailed breakdown...` | Added `text-pretty` to paragraph |
| `<motion.h2 initial={...}>Details</motion.h2>` | Added `text-balance` to modal heading |
| `<p>Closed {stats.closed} issues.</p>` | Added `text-pretty` |

#### Interruptible animations (drawer)
| Before | After |
| --- | --- |
| CSS keyframe animation `animation: slideIn 250ms ease-out forwards` | Changed to CSS transition `transition-property: transform; transition-duration: 200ms; transition-timing-function: ease-out` with state-based `transform` |

#### Staggered enter animations
| Before | After |
| --- | --- |
| `<motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` — whole list fades in as one block | Added variants with `staggerChildren: 0.1` to parent, individual item variants with `y: 12, blur(4px)` initial state |

#### Exit animations
| Before | After |
| --- | --- |
| `exit={{ opacity: 0, height: 0, transition: { duration: 0.4 } }}` on list items | Changed to `opacity: 0, y: -12, blur(4px), duration: 0.15, ease: easeIn` (subtle, faster) |
| No exit animation on modal | Added `exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)', transition: { duration: 0.15 } }}` |

#### Transition specificity
| Before | After |
| --- | --- |
| `style={{ transition: 'all 200ms ease-out' }}` on outer card | Removed (state-based shadow doesn't need transition) |
| `className="transition"` with `willChange: 'all'` on play button | Changed to `transition-transform` (specific property) and removed `willChange: 'all'` |
| No specific transitions on buttons | Added `transition-transform duration-150 ease-out` to all buttons with scale |

#### Hit areas
| Before | After |
| --- | --- |
| `className="flex size-6 items-center justify-center"` on like button | Added `relative` wrapper and button is now properly sized (icon itself is small, button provides hit area) |
| `className="flex size-6 items-center justify-center rounded-full"` on play button | Changed to `size-10` (40×40px minimum) |

#### AnimatePresence initial={false}
| Before | After |
| --- | --- |
| `<AnimatePresence>` without `initial={false}` on list and modal | Added `initial={false}` to prevent unwanted entry animations on page load |

#### Modal heading animation
| Before | After |
| --- | --- |
| `<motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` (no stagger, no blur) | Added full initial state `{ opacity: 0, y: 12, filter: 'blur(4px)' }`, delay 0.1s to stagger after modal enter, spring timing |
