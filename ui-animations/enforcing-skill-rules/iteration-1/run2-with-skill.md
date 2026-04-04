# Motion Design Audit — SaaS Productivity Dashboard

## Reconnaissance

**Project type**: SaaS productivity dashboard
**Existing animation style**: Framer Motion used inconsistently — some elements animated, many conditional renders lack animation entirely
**Motion gaps found**: 3 conditional renders without AnimatePresence (`showPanel`, tab swap, loading/content)
**Proposed perspective weighting**:
- **Primary**: Emil Kowalski — SaaS dashboard demands restraint, speed, purposeful motion
- **Secondary**: Jakub Krehel — Production polish for enter/exit states
- **Selective**: Jhey Tompkins — Only for empty states or onboarding if applicable

---

## Issues Found (18 total)

---

### CRITICAL (Must Fix)

#### 1. Missing AnimatePresence on sidebar conditional render
**Lines**: `{showPanel && (<div className="sidebar" ...>)}`
**Rule**: Conditional renders must be wrapped in `AnimatePresence` for exit animations. Without it, the sidebar just disappears — no exit animation is possible.
**Checklist**: Motion Gap Analysis — "Each conditional render either has AnimatePresence wrapper OR doesn't need animation"
**Severity**: Critical

#### 2. Tab content swap has no animation
**Lines**: `{activeTab === 'home' ? <HomeContent /> : <SettingsContent />}`
**Rule**: Mode switches (tabs, toggles) must animate their content changes, not just the switch itself. This is a ternary swap with zero transition.
**Checklist**: Motion Gap Analysis — "Mode switches (tabs, toggles) animate their content changes"
**Severity**: Critical

#### 3. Loading to Content is an instant swap
**Lines**: `{isLoading ? <Spinner /> : <DataTable data={data} />}`
**Rule**: Loading-to-content transitions must be smooth, not instant swaps. Needs AnimatePresence with crossfade or sequential exit/enter.
**Checklist**: Motion Gap Analysis — "Loading → Content transitions are smooth, not instant swaps"
**Severity**: Critical

#### 4. Animating layout properties (width/height)
**Lines**: `animate={{ width: 300, height: 'auto' }}` on notification items
**Rule**: Only animate `transform` and `opacity` — these are GPU-accelerated. Animating `width` and `height` triggers layout recalculation every frame, killing performance.
**Checklist**: Performance — "Animations use transform/opacity (not layout properties)"
**Severity**: Critical

#### 5. Missing `prefers-reduced-motion` support
**Rule**: No reduced motion handling anywhere in the component. Every animation must respect `prefers-reduced-motion: reduce`. This is an accessibility requirement, not optional.
**Checklist**: Accessibility — "Respects prefers-reduced-motion: reduce"
**Severity**: Critical

#### 6. Keyboard shortcut triggers animation
**Lines**: `onKeyDown` handler for Cmd+K opens search modal with animation
**Rule**: Keyboard-initiated actions should not animate (Emil's rule). The search modal should appear instantly when triggered via keyboard shortcut.
**Checklist**: Interaction Patterns — "Keyboard shortcuts don't animate"
**Severity**: Critical

#### 7. Continuous decorative spinner without purpose or pause control
**Lines**: `animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}`
**Rule**: No continuous animations without purpose. Looping animations must be pausable. A decorative spinner that rotates forever is a performance drain and accessibility concern.
**Checklist**: Performance — "No continuous animations without purpose"; Accessibility — "Looping animations can be paused"
**Severity**: Critical

---

### IMPORTANT (Should Fix)

#### 8. Animating from `scale(0)`
**Lines**: `initial={{ opacity: 0, scale: 0 }}`
**Rule**: Never animate from `scale(0)` — use `0.9+` minimum. Scale from zero looks unnatural and jarring. Emil's rule: start from `scale(0.95)` or `scale(0.96)`.
**Checklist**: State Transitions — "Elements don't animate from scale(0) (use 0.9+ instead)"
**Severity**: Important

#### 9. Duration too long (1.5s for card animations)
**Lines**: `transition={{ duration: 1.5 }}`
**Rule**: User-initiated transitions should be 300ms max. 1.5s is 5x too long. For a SaaS dashboard (Emil primary), this feels sluggish. Even for small state changes, 180-260ms is the range.
**Checklist**: Easing & Timing — "Durations appropriate for context (Emil: under 300ms)"
**Severity**: Important

#### 10. Linear easing for motion
**Lines**: `ease: 'linear'`
**Rule**: No linear easing for motion — ever. Linear feels robotic and unnatural. Use ease-out for entrances (`[0.16, 1, 0.3, 1]` or `power2.out`), ease-in for exits.
**Checklist**: Core Principles — "no linear for motion"
**Severity**: Important

#### 11. Stagger delay too slow (200ms per item)
**Lines**: `delay: i * 0.2`
**Rule**: Stagger per item must be max 50ms. At 200ms per item, a list of 10 items takes 2 seconds just in stagger delays. Use `delay: i * 0.04` or `i * 0.05` max.
**Checklist**: Duration Thresholds — "Stagger per item: max 50ms"
**Severity**: Important

#### 12. No blur in enter animation
**Lines**: `initial={{ opacity: 0, scale: 0 }}` — missing `filter: "blur(4px)"`
**Rule**: Enter animations should combine opacity + translateY + blur (Jakub's recipe). The blur-to-sharp transition adds depth and polish.
**Checklist**: Enter/Exit States — "Enter animations combine opacity + translateY + blur"
**Severity**: Important

#### 13. Duration-based transitions on interactive elements instead of springs
**Lines**: All transitions use `duration` instead of spring physics
**Rule**: Springs should be used for interactive elements — they are interruptible, velocity-preserving, and feel more natural. For a SaaS dashboard, spring animations on cards and interactive elements allow interruption mid-animation.
**Checklist**: Core Principles — "Springs for gestures, interruptible motion, velocity preservation"
**Severity**: Important

#### 14. `transition: 'all 0.5s ease'` on button
**Lines**: `style={{ transition: 'all 0.5s ease' }}`
**Rule**: Two issues here: (a) Never use `transition: all` — specify exact properties (e.g., `transition: 'background-color 0.15s ease-out, transform 0.15s ease-out'`). (b) Default `ease` should be replaced with custom Bezier curves. `all` causes the browser to watch every single CSS property for changes.
**Checklist**: Performance — "CSS transitions (not keyframes) for interruptible animations"; Easing & Timing — "Custom Bezier curves used instead of built-in easing"
**Severity**: Important

#### 15. Hover/press duration too slow (500ms)
**Lines**: `transition: 'all 0.5s ease'` on button
**Rule**: Hover/press feedback should be 120-180ms, not 500ms. 500ms feels laggy and unresponsive for a productivity tool.
**Checklist**: Duration Thresholds — "Hover/press feedback: 120-180ms"
**Severity**: Important

#### 16. `will-change` set to multiple properties permanently
**Lines**: `style={{ willChange: 'width, height, transform, opacity' }}`
**Rule**: `will-change` should be used sparingly and specifically — apply before animation, remove after. Setting it permanently on multiple properties wastes GPU memory and can actually degrade performance.
**Checklist**: Performance — "will-change used sparingly and specifically"
**Severity**: Important

#### 17. Button has no press/active scale feedback
**Lines**: The toggle button has no `:active` or `whileTap` handler
**Rule**: Buttons should have scale feedback on press — `scale(0.97)` on `:active` or `whileTap={{ scale: 0.97 }}`. This provides tactile confirmation that the press registered.
**Checklist**: State Transitions — "Button press has scale feedback (scale(0.97) on :active)"
**Severity**: Important

---

### NICE TO HAVE

#### 18. Tooltip always has same delay — should use first-delayed, subsequent-instant pattern
**Lines**: `transition={{ duration: 0.5, delay: 0.3 }}`
**Rule**: Tooltips should be delayed + animated on first hover, then instant on subsequent hovers (within a timeout window). This prevents tooltips from feeling sluggish during rapid scanning. Duration 0.5s is also too long — should be ~0.15-0.2s.
**Checklist**: Interaction Patterns — "Tooltips: first delayed + animated, subsequent instant"
**Severity**: Nice to Have (but tooltip duration of 0.5s is Important)

---

## Fixed Code

```tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// -------------------------------------------------------
// Reduced-motion hook: respects prefers-reduced-motion.
// When active, all animations resolve to instant transitions.
// -------------------------------------------------------
const instantTransition = { duration: 0 };

// -------------------------------------------------------
// Tooltip delay pattern: first tooltip is delayed,
// subsequent tooltips within 300ms window are instant.
// -------------------------------------------------------
const useTooltipDelay = (baseDelay = 0.3) => {
  const lastShown = useRef<number>(0);
  const getDelay = () => {
    const now = Date.now();
    // If shown within last 300ms, instant
    const delay = now - lastShown.current < 300 ? 0 : baseDelay;
    lastShown.current = now;
    return delay;
  };
  return getDelay;
};

// -------------------------------------------------------
// Shared spring config for interactive elements.
// Springs are interruptible and velocity-preserving.
// -------------------------------------------------------
const snappySpring = { type: 'spring', stiffness: 500, damping: 30 };

// -------------------------------------------------------
// Enter/exit animation variants following Jakub's recipe:
// opacity + translateY + blur for enters,
// subtler exit (smaller translateY, same blur fade).
// -------------------------------------------------------
const panelVariants = {
  hidden: { opacity: 0, x: -8, filter: 'blur(4px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, x: -4, filter: 'blur(4px)' },
};

const contentVariants = {
  hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -4, filter: 'blur(4px)' },
};

const cardVariants = {
  // FIX: scale starts at 0.96 (not 0), includes blur
  hidden: { opacity: 0, scale: 0.96, filter: 'blur(4px)' },
  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
};

const notificationVariants = {
  // FIX: use transform (scale/translateX) instead of width/height
  hidden: { opacity: 0, scale: 0.95, x: 20 },
  visible: { opacity: 1, scale: 1, x: 0 },
  exit: { opacity: 0, scale: 0.95, x: 20 },
};

function Dashboard() {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [notifications, setNotifications] = useState([]);

  // FIX: Respect prefers-reduced-motion globally
  const shouldReduceMotion = useReducedMotion();

  const getTooltipDelay = useTooltipDelay(0.3);

  // FIX: Keyboard shortcut opens search WITHOUT animation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      // Open instantly — no animation for keyboard-initiated actions
      setSearchOpen(true);
    }
  }, []);

  // Transition helper: returns instant if reduced motion preferred
  const t = (transition: any) =>
    shouldReduceMotion ? instantTransition : transition;

  return (
    <div>
      {/* ------------------------------------------------
          FIX: AnimatePresence wraps the conditional render
          so the sidebar gets a proper exit animation.
          ------------------------------------------------ */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="sidebar"
            style={{ width: 300 }}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={t({ type: 'spring', duration: 0.35, bounce: 0 })}
          >
            <h2>Settings</h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX: Tab content swap now animates with
          AnimatePresence mode="wait" for sequential
          exit-then-enter transitions.
          ------------------------------------------------ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={t({ type: 'spring', duration: 0.3, bounce: 0 })}
        >
          {activeTab === 'home' ? <HomeContent /> : <SettingsContent />}
        </motion.div>
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX: Card list — multiple issues resolved:
          - scale starts at 0.96 (not 0)
          - includes blur in enter animation
          - spring transition (interruptible)
          - stagger capped at 40ms per item
          - no linear easing
          ------------------------------------------------ */}
      <div className="grid">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            transition={t({
              type: 'spring',
              duration: 0.45,
              bounce: 0,
              delay: i * 0.04, // 40ms stagger (max 50ms rule)
            })}
          >
            <Card item={item} />
          </motion.div>
        ))}
      </div>

      {/* ------------------------------------------------
          FIX: Tooltip uses first-delayed, subsequent-instant
          pattern. Duration reduced to 0.15s.
          ------------------------------------------------ */}
      <motion.div
        className="tooltip"
        initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={t({
          type: 'spring',
          duration: 0.15,
          bounce: 0,
          delay: getTooltipDelay(),
        })}
      >
        Help text
      </motion.div>

      {/* ------------------------------------------------
          FIX: Button — multiple issues resolved:
          - Specific properties instead of transition: all
          - 150ms duration (within 120-180ms range)
          - Custom easing curve (not default ease)
          - whileTap scale feedback at 0.97
          ------------------------------------------------ */}
      <motion.button
        onClick={() => setShowPanel(!showPanel)}
        whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
        style={{
          transition:
            'background-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        Toggle
      </motion.button>

      {/* ------------------------------------------------
          FIX: Loading → Content uses AnimatePresence
          for smooth crossfade transition instead of
          instant swap.
          ------------------------------------------------ */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={t({ duration: 0.15 })}
          >
            <Spinner />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={t({ type: 'spring', duration: 0.3, bounce: 0 })}
          >
            <DataTable data={data} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX: Notification list — multiple issues resolved:
          - Animates transform/opacity only (not width/height)
          - will-change removed (not needed permanently)
          - AnimatePresence for exit animations
          ------------------------------------------------ */}
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            variants={notificationVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={t(snappySpring)}
          >
            {n.message}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX: Decorative spinner REMOVED entirely.
          Continuous purposeless animation is a performance
          drain and accessibility issue. If a loading
          indicator is needed, it should only appear during
          actual loading and be pausable.
          ------------------------------------------------ */}

      {/* ------------------------------------------------
          FIX: Keyboard shortcut handler — search modal
          opens instantly without animation when triggered
          via keyboard (Emil's rule).
          ------------------------------------------------ */}
      <button onKeyDown={handleKeyDown}>
        Search (Cmd+K)
      </button>
    </div>
  );
}
```

---

## Summary Table

| # | Issue | Severity | Rule Source |
|---|-------|----------|-------------|
| 1 | Sidebar conditional render missing AnimatePresence | Critical | Motion Gap Analysis |
| 2 | Tab swap has no animation | Critical | Motion Gap Analysis |
| 3 | Loading-to-content instant swap | Critical | Motion Gap Analysis |
| 4 | Animating width/height (layout properties) | Critical | Performance / Core Principles |
| 5 | No `prefers-reduced-motion` support | Critical | Accessibility |
| 6 | Keyboard shortcut triggers animation | Critical | Emil's Interaction Patterns |
| 7 | Continuous purposeless spinner, not pausable | Critical | Performance / Accessibility |
| 8 | Animating from `scale(0)` | Important | Emil's rule / State Transitions |
| 9 | Duration 1.5s (5x too long) | Important | Duration Thresholds |
| 10 | Linear easing for motion | Important | Core Principles |
| 11 | Stagger 200ms/item (4x too slow) | Important | Duration Thresholds |
| 12 | No blur in enter animation | Important | Jakub's Enter Recipe |
| 13 | Duration-based instead of spring for interactive | Important | Core Principles |
| 14 | `transition: all` on button | Important | Performance |
| 15 | Hover/press duration 500ms (3x too slow) | Important | Duration Thresholds |
| 16 | `will-change` on 4 properties permanently | Important | Performance |
| 17 | No button press scale feedback | Important | State Transitions |
| 18 | Tooltip always same delay (no first/subsequent pattern) | Nice to Have | Emil's Interaction Patterns |

---

## Designer Perspective Summary

**Emil (Primary — SaaS dashboard)**:
- All durations must be under 300ms
- Keyboard actions must not animate
- High-frequency interactions get minimal/no animation
- Custom Bezier curves, never default `ease`
- `transition: all` is banned — specify exact properties
- Springs for interruptible interactive elements

**Jakub (Secondary — production polish)**:
- Enter recipe: opacity + translateY + blur(4px)
- Exit animations subtler than enters
- Spring transitions with `bounce: 0` for professional feel

**Jhey (Selective — not applicable here)**:
- SaaS dashboard has no playful/experimental context
- Could apply to empty states or onboarding flows if they existed
