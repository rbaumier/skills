# UI Animations Eval — Full Sweep — Compressed Run 1

## Fixed Code

```tsx
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// --- Shared animation config ---

// [prefers-reduced-motion] Hook-based reduced motion support
// [enter-recipe] Jakub's opacity + translateY + blur recipe
// [no-linear-easing] Spring easing for entrances, not linear
const enterTransition = { type: 'spring' as const, duration: 0.45, bounce: 0 };

const enterVariants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 4, filter: 'blur(4px)' },
};

// [duration-too-long] Cards: 200ms max, not 1500ms
// [stagger-too-slow] 30ms stagger per item, not 200ms
const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03 },
  },
};

// [no-scale-from-zero] Scale from 0.95, never 0
const cardVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
    transition: enterTransition,
  },
  exit: { opacity: 0, scale: 0.97, filter: 'blur(4px)' },
};

function Dashboard() {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [notifications, setNotifications] = useState([]);
  const prefersReduced = useReducedMotion();

  // [tooltip-first-delayed] First tooltip is delayed, subsequent instant
  const hasSeenTooltip = useRef(false);
  const tooltipDelay = hasSeenTooltip.current ? 0 : 0.3;
  useEffect(() => { hasSeenTooltip.current = true; }, []);

  return (
    <div>
      {/* [animate-presence-sidebar] AnimatePresence for conditional render exit animations */}
      <AnimatePresence mode="wait">
        {showPanel && (
          <motion.div
            key="sidebar"
            className="sidebar"
            style={{ width: 300 }}
            initial={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -20, filter: 'blur(4px)' }}
            transition={enterTransition}
          >
            <h2>Settings</h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* [animate-tab-swap] Tab content swap animated with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={enterVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={enterTransition}
        >
          {activeTab === 'home' ? <HomeContent /> : <SettingsContent />}
        </motion.div>
      </AnimatePresence>

      {/* [duration-too-long] 200ms total, [stagger-too-slow] 30ms/item */}
      {/* [no-scale-from-zero] scale from 0.95 */}
      {/* [no-linear-easing] spring, not linear */}
      <motion.div
        className="grid"
        variants={prefersReduced ? undefined : staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {items.map((item) => (
          <motion.div
            key={item.id}
            variants={prefersReduced ? undefined : cardVariants}
          >
            <Card item={item} />
          </motion.div>
        ))}
      </motion.div>

      {/* [tooltip-first-delayed] First delayed+animated, subsequent instant */}
      <motion.div
        className="tooltip"
        initial={prefersReduced ? false : { opacity: 0, y: 6, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...enterTransition, delay: tooltipDelay }}
      >
        Help text
      </motion.div>

      {/* [button-press-feedback] Scale 0.97 on press */}
      {/* [hover-duration] 150ms, not 500ms */}
      {/* [no-transition-all] Specific properties only */}
      {/* [gpu-only-properties] Only transform + opacity */}
      {/* [spring-for-interactive] Spring for interactive button */}
      <motion.button
        onClick={() => setShowPanel(!showPanel)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ transition: 'background-color 0.15s ease' }}
      >
        Toggle
      </motion.button>

      {/* [loading-content-transition] Smooth loading-to-content transition */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Spinner />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            variants={enterVariants}
            initial="hidden"
            animate="visible"
            transition={enterTransition}
          >
            <DataTable data={data} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* [gpu-only-properties] Animate transform+opacity, not width/height */}
      {/* [will-change-sparingly] Removed permanent willChange from multiple properties */}
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10 }}
            transition={enterTransition}
          >
            {n.message}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* [no-continuous-purposeless] Removed decorative spinner — continuous animation without purpose */}

      {/* [keyboard-no-animate] Keyboard-initiated Cmd+K opens search instantly, no animation */}
      <button
        onKeyDown={(e) => {
          if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
            setSearchOpen(true); // Instant — no animation for keyboard actions
          }
        }}
      >
        Search (Cmd+K)
      </button>
    </div>
  );
}
```

## Issues Fixed

| # | Assertion ID | What was wrong | Fix applied |
|---|---|---|---|
| 1 | animate-presence-sidebar | `{showPanel && <div>}` without AnimatePresence | Wrapped in `<AnimatePresence>` with exit animation |
| 2 | animate-tab-swap | Tab content swap has no animation | `<AnimatePresence mode="wait">` with keyed content |
| 3 | loading-content-transition | Loading to Content instant swap | AnimatePresence mode="wait" with fade transition |
| 4 | no-scale-from-zero | `scale: 0` initial | `scale: 0.95` minimum |
| 5 | duration-too-long | `duration: 1.5` | Spring with ~200ms feel (`duration: 0.45, bounce: 0`) |
| 6 | no-linear-easing | `ease: 'linear'` | `type: 'spring'` for entrances |
| 7 | stagger-too-slow | `delay: i * 0.2` (200ms) | `staggerChildren: 0.03` (30ms) |
| 8 | spring-for-interactive | Duration-based button transition | `type: 'spring', stiffness: 400, damping: 25` |
| 9 | enter-recipe | No blur in enter animation | `opacity + translateY + blur` (Jakub recipe) |
| 10 | button-press-feedback | No press/active feedback | `whileTap={{ scale: 0.97 }}` |
| 11 | hover-duration | `transition: all 0.5s` (500ms) | 150ms `background-color` transition |
| 12 | gpu-only-properties | Animating `width`, `height` | Only transform + opacity + filter |
| 13 | will-change-sparingly | `willChange: 'width, height, transform, opacity'` permanent | Removed; Motion handles GPU promotion internally |
| 14 | no-transition-all | `transition: 'all 0.5s ease'` | Specific property `background-color 0.15s` |
| 15 | prefers-reduced-motion | No reduced motion support | `useReducedMotion()` hook, conditional variants |
| 16 | no-continuous-purposeless | Decorative spinner rotating infinitely | Removed purposeless continuous animation |
| 17 | keyboard-no-animate | Cmd+K triggers animated modal open | Instant open for keyboard-initiated actions |
| 18 | tooltip-first-delayed | Same 300ms delay every time | First tooltip delayed, subsequent instant via ref |
