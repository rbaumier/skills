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
      className="rounded-2xl p-3 shadow-sm"
    >
      <SideDrawer open={drawerOpen} />

      <div className="flex items-center justify-between rounded-lg bg-white p-2 shadow-sm">
        <h1 className="text-wrap-balance">Your team's performance this quarter</h1>

        <img
          src={avatarUrl}
          alt="avatar"
          className="size-12 rounded-full outline outline-1"
          style={{ outlineColor: 'rgba(0, 0, 0, 0.1)' }}
        />
      </div>

      <p className="text-wrap-pretty">
        A detailed breakdown of how every member contributed across the
        sprint, including merged pull requests and review turnaround time.
      </p>

      {/* live-updating viewer count */}
      <div className="text-2xl font-bold font-variant-numeric-tabular-nums">{liveCount} viewers</div>

      {/* play / pause toggle */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="flex size-10 items-center justify-center rounded-full bg-black text-white"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="pause"
              initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <PauseIcon />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            >
              <PlayIcon />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* like button — icon swaps on click */}
      <button
        onClick={() => {}}
        className="transition-transform active:scale-[0.96]"
        style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {stats.liked ? <HeartIcon filled /> : <HeartIcon />}
      </button>

      <button
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-transform active:scale-[0.96]"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <span>Open details</span>
        <StarIcon />
      </button>

      {/* staggered enter animations */}
      <AnimatePresence initial={false}>
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1, delayChildren: 0 }}
        >
          {stats.members.map((m, idx) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, translateY: -10, transition: { duration: 0.15 } }}
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
            className="fixed inset-0 rounded-xl bg-white p-4 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, translateY: 10, filter: 'blur(4px)', transition: { duration: 0.15 } }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          >
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
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
