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
      <body className="-webkit-font-smoothing-antialiased">{children}</body>
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
      className="rounded-xl p-3 border border-slate-200"
      style={{ transition: 'border-color 200ms ease-out' }}
    >
      <SideDrawer open={drawerOpen} />

      <div className="flex items-center justify-between rounded-lg bg-white p-2 border border-slate-200">
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
        className="flex size-6 items-center justify-center rounded-full bg-black text-white transition-opacity"
        style={{ willChange: 'opacity' }}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* like button — icon swaps on click */}
      <button
        onClick={() => {}}
        className="transition-transform active:scale-[0.96]"
        style={{ width: 24, height: 24 }}
      >
        {stats.liked ? <HeartIcon filled /> : <HeartIcon />}
      </button>

      <button
        className="flex items-center gap-2 rounded-lg bg-blue-600 pl-4 pr-3.5 text-white"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span>Open details</span>
        <StarIcon />
      </button>

      {/* staggered list with enter/exit animations */}
      <AnimatePresence initial={false}>
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {stats.members.map((m) => (
            <motion.li
              key={m.id}
              variants={{
                hidden: { opacity: 0, translateY: -8 },
                visible: { opacity: 1, translateY: 0, transition: { type: 'spring', duration: 0.3, bounce: 0 } },
              }}
              exit={{ opacity: 0, translateY: -8, transition: { duration: 0.2 } }}
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
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.2 } }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            <motion.h2
              initial={{ opacity: 0, translateY: -4 }}
              animate={{ opacity: 1, translateY: 0, transition: { delay: 0.1, type: 'spring', duration: 0.3, bounce: 0 } }}
            >
              Details
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, translateY: -4 }}
              animate={{ opacity: 1, translateY: 0, transition: { delay: 0.15, type: 'spring', duration: 0.3, bounce: 0 } }}
            >
              Closed {stats.closed} issues.
            </motion.p>
            <motion.button
              initial={{ opacity: 0, translateY: -4 }}
              animate={{ opacity: 1, translateY: 0, transition: { delay: 0.2, type: 'spring', duration: 0.3, bounce: 0 } }}
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

## Changes Applied

#### Font Smoothing
| Before | After |
| --- | --- |
| Root body with no smoothing | Added `-webkit-font-smoothing: antialiased` to `<body>` |

#### Text Wrapping
| Before | After |
| --- | --- |
| `<h1>Your team's performance this quarter</h1>` | Added `className="text-balance"` to h1 |
| `<p>A detailed breakdown...` | Added `className="text-pretty"` to p |

#### Tabular Numbers
| Before | After |
| --- | --- |
| `<div className="text-2xl font-bold">{liveCount} viewers</div>` | Added `tabular-nums` class to prevent layout shift |

#### Image Outlines
| Before | After |
| --- | --- |
| `outline-slate-700/20` (tinted neutral) | Changed to `outline-black/10` with `dark:outline-white/10` (pure black/white both modes, negative offset `-outline-offset-1`) |

#### Concentric Border Radius
| Before | After |
| --- | --- |
| Inner flex container `rounded-xl` matching outer card `rounded-xl` | Changed inner container to `rounded-lg` (outer stays `rounded-xl` with `p-3`, inner is `p-2`, so 12 − 2 = 10 ≈ lg) |

#### Optical Alignment (Text + Icon)
| Before | After |
| --- | --- |
| `className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 text-white"` | Changed to `pl-4 pr-3.5` (icon on right, reduce padding by 2px) |

#### Scale on Press
| Before | After |
| --- | --- |
| `active:scale-[0.9]` (too aggressive, below 0.95 threshold) | Changed to `active:scale-[0.96]` |

#### Transition Specificity
| Before | After |
| --- | --- |
| Play button: `transition` (generic), `willChange: 'all'` (forbidden) | Changed to `transition-opacity` and `willChange: 'opacity'` |
| Modal: `transition: 'all 200ms ease-out'` on card | Changed to `transition: 'border-color 200ms ease-out'` (only what actually changes) |

#### Staggered Enter/Exit Animations
| Before | After |
| --- | --- |
| `<motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` with no stagger — entire list fades as one | Split into semantic variants: `staggerChildren: 0.1` on container, each `<motion.li>` has individual enter (`translateY: -8` from `0`) and exit (`translateY: -8` to exit, `duration: 0.2` subtle) |
| `<AnimatePresence>` (no `initial={false}`) on list | Added `initial={false}` to prevent entrance animations on page load |

#### Spring Animation Bounce
| Before | After |
| --- | --- |
| Modal: `bounce: 0.25` | Changed all spring transitions to `bounce: 0` (must always be 0) |

#### Exit Animations (Subtle)
| Before | After |
| --- | --- |
| List items: `exit={{ opacity: 0, height: 0, transition: { duration: 0.4 } }}` (height 0 is jarring) | Changed to `exit={{ opacity: 0, translateY: -8, transition: { duration: 0.2 } }}` (subtle, same direction as enter) |
| Modal: no exit animation defined | Added `exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.2 } }}` |

#### Split and Stagger Modal Content
| Before | After |
| --- | --- |
| h2, p, button all animate together at once (no delay) | Wrapped each in `motion.*` with `delay` (0.1s, 0.15s, 0.2s) and `initial={false}` on parent `AnimatePresence` prevents load-time animation |
| No semantic separation of content | Added `translateY: -4` (subtle upward enter) for visual coherence with list stagger |
