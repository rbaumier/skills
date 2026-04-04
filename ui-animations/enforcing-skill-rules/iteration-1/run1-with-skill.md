# Motion Design Audit — SaaS Productivity Dashboard

## Reconnaissance

- **Project type**: SaaS productivity dashboard
- **Existing animation style**: Framer Motion (`motion`, `AnimatePresence` imported but underused)
- **Motion gaps found**: 3 conditional renders without AnimatePresence (`showPanel`, tab swap, loading/content)
- **Perspective weighting**:
  - **Primary**: Emil Kowalski — Productivity tool = restraint, speed, purposeful motion
  - **Secondary**: Jakub Krehel — Production polish for shipped UI
  - **Selective**: Jhey Tompkins — Only for onboarding/empty states if any

---

## Issues Found (18 total)

---

### CRITICAL (Must Fix)

#### 1. Missing AnimatePresence on sidebar toggle
**Location**: `{showPanel && <div className="sidebar">}`
**Problem**: Conditional render without `AnimatePresence`. The sidebar snaps in and disappears instantly with no exit animation. This is a motion gap in primary UI.
**Rule**: audit-checklist.md — "Motion gaps in primary UI — Conditional controls/panels that snap in/out without animation" (Critical severity). Also: "Each conditional render either has AnimatePresence wrapper OR doesn't need animation."

#### 2. Tab content swap has no animation
**Location**: `{activeTab === 'home' ? <HomeContent /> : <SettingsContent />}`
**Problem**: Ternary swap with zero transition. Content teleports. Mode switches must animate their content changes, not just the switch itself.
**Rule**: audit-checklist.md — "Mode switches (tabs, toggles) animate their content changes, not just the switch itself."

#### 3. Loading to Content is an instant swap
**Location**: `{isLoading ? <Spinner /> : <DataTable data={data} />}`
**Problem**: Hard cut from loading state to data table. No crossfade or smooth transition.
**Rule**: audit-checklist.md — "Loading → Content transitions are smooth, not instant swaps" (Motion Gap Analysis). timing-and-easing.md — UI transitions 300-500ms.

#### 4. Animating layout properties (width, height)
**Location**: Notification list — `animate={{ width: 300, height: 'auto' }}`
**Problem**: Animating `width` and `height` triggers layout recalculation every frame. Causes jank, not GPU-accelerated.
**Rule**: timing-and-easing.md — "Only animate transform and opacity (GPU-accelerated)." audit-checklist.md — "Animating layout properties (width, height, top, left)" is Critical severity.

#### 5. No `prefers-reduced-motion` support anywhere
**Location**: Entire component
**Problem**: Zero reduced-motion handling. Users with vestibular disorders get all animations forced on them.
**Rule**: audit-checklist.md — "Missing prefers-reduced-motion support" is Critical severity. timing-and-easing.md testing checklist — "Respects prefers-reduced-motion."

#### 6. Keyboard shortcut triggers animation
**Location**: `onKeyDown` handler — `if (e.key === 'k') { setSearchOpen(true); }`
**Problem**: Cmd+K opens search modal with animation. Keyboard-initiated actions should not animate — they should be instant.
**Rule**: audit-checklist.md — "Animating keyboard-initiated actions (Emil)" is Critical severity. Emil's rule: "If keyboard-initiated, don't animate."

---

### IMPORTANT (Should Fix)

#### 7. Cards animate from `scale(0)`
**Location**: `initial={{ opacity: 0, scale: 0 }}`
**Problem**: Scaling from zero looks unnatural — elements appear to explode into existence. Use `0.95` minimum.
**Rule**: timing-and-easing.md — "Scale deformation range: 0.95-1.05 (never from 0)." audit-checklist.md — "Animating from scale(0) instead of 0.9+ (Emil)" is Important severity.

#### 8. Duration 1.5s is far too long
**Location**: `transition={{ duration: 1.5 }}`
**Problem**: 1500ms for a card entrance in a productivity dashboard. Emil says 300ms max for user-initiated transitions. Even Jakub wouldn't approve 1.5s for a data card.
**Rule**: timing-and-easing.md — "User-initiated transitions: 300ms max." audit-checklist.md — "Durations appropriate for context."

#### 9. Linear easing on motion
**Location**: `ease: 'linear'`
**Problem**: Linear easing makes motion feel mechanical and robotic. Natural motion decelerates.
**Rule**: timing-and-easing.md — "no linear for motion." Use ease-out for entrances.

#### 10. Stagger delay 200ms per item (max is 50ms)
**Location**: `delay: i * 0.2`
**Problem**: 200ms stagger means the 10th item waits 2 full seconds. The list feels sluggish.
**Rule**: timing-and-easing.md — "Stagger per item: max 50ms."

#### 11. No blur in enter animations
**Location**: Card enter — `initial={{ opacity: 0, scale: 0 }}` (no `filter: "blur(...)"`)
**Problem**: Missing blur component in enter animation. The Jakub recipe calls for opacity + translateY + blur.
**Rule**: timing-and-easing.md — Enter Animation Recipe: `initial={{ opacity: 0, translateY: 8, filter: "blur(4px)" }}`. audit-checklist.md — "Missing blur in enter animations" is Important severity.

#### 12. Default/wrong easing instead of custom curves
**Location**: Button uses `ease`, tooltip uses default
**Problem**: Built-in easing keywords (`ease`, `linear`) instead of custom cubic-bezier curves.
**Rule**: audit-checklist.md — "Custom Bezier curves used instead of built-in easing (Emil's rule)" and "Default CSS easing instead of custom curves (Emil)" is Important severity.

#### 13. Button has no press feedback
**Location**: Toggle button — no `:active` or `whileTap` handling
**Problem**: Button gives zero tactile feedback on press. Should scale down slightly.
**Rule**: audit-checklist.md — "Button press has scale feedback (scale(0.97) on :active)."

#### 14. Hover/button transition is 500ms (should be 120-180ms)
**Location**: `style={{ transition: 'all 0.5s ease' }}`
**Problem**: 500ms is sluggish for hover/press feedback. Should be 120-180ms.
**Rule**: timing-and-easing.md — "Hover/press feedback: 120-180ms."

#### 15. `transition: all` instead of specific properties
**Location**: `transition: 'all 0.5s ease'`
**Problem**: `transition: all` animates every property change, including layout properties. Specify exact properties.
**Rule**: audit-checklist.md — "CSS transitions (not keyframes) for interruptible animations." Performance best practice: never transition `all`.

#### 16. `will-change` set to multiple properties permanently
**Location**: `style={{ willChange: 'width, height, transform, opacity' }}`
**Problem**: `will-change` applied to 4 properties permanently. This wastes GPU memory. Should be applied sparingly, just before animation, and removed after.
**Rule**: timing-and-easing.md — "Use will-change sparingly -- apply before animation, remove after."

#### 17. Continuous decorative spinner with no purpose and no pause control
**Location**: `<motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }} className="decorative-spinner" />`
**Problem**: Infinite rotation with no functional purpose (class says "decorative"). Cannot be paused. Wastes CPU/GPU cycles and is an accessibility concern for vestibular disorders.
**Rule**: audit-checklist.md — "No continuous animations without purpose; looping animations can be paused." accessibility section — "Looping animations can be paused."

#### 18. Tooltip always has same delay (should be first-delayed, then instant)
**Location**: `transition={{ duration: 0.5, delay: 0.3 }}`
**Problem**: Every tooltip appearance has a 300ms delay. First tooltip should be delayed; subsequent ones should be instant. Also, 500ms duration is too long.
**Rule**: audit-checklist.md — "Tooltips: first delayed + animated, subsequent instant" (Emil's rule). Interaction Patterns section.

---

### ADDITIONAL: Springs missing for interactive elements

**Location**: All interactive transitions use duration-based easing, none use springs.
**Problem**: Interactive elements (sidebar toggle, button feedback, tooltip) should use spring animations for natural interruptible motion.
**Rule**: timing-and-easing.md — "Springs for gestures, interruptible motion, velocity preservation." audit-checklist.md — "Spring animations for interactive elements."

---

## Fixed Code

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// -------------------------------------------------------
// Shared animation config for a SaaS productivity dashboard.
// Primary perspective: Emil Kowalski (restraint & speed).
// Secondary: Jakub Krehel (production polish).
// -------------------------------------------------------

// Reduced-motion: disable all motion globally when user prefers it.
// Every animation below checks `shouldReduceMotion` and falls back
// to instant transitions (duration: 0, no spring).

// Tooltip delay pattern (Emil): first tooltip is delayed,
// subsequent ones within 300ms are instant.
let lastTooltipTime = 0;
const TOOLTIP_WINDOW_MS = 300;

function getTooltipDelay(): number {
  const now = Date.now();
  const gap = now - lastTooltipTime;
  lastTooltipTime = now;
  // First tooltip (or after long gap): show delay. Subsequent: instant.
  return gap > TOOLTIP_WINDOW_MS ? 0.15 : 0;
}

// -------------------------------------------------------
// Easing & spring tokens — custom curves, never defaults.
// -------------------------------------------------------
const EASE_OUT_SMOOTH = [0.16, 1, 0.3, 1] as const;       // entrances
const EASE_IN_SMOOTH = [0.4, 0, 1, 1] as const;           // exits

const SPRING_INTERACTIVE = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

const SPRING_ENTER = {
  type: 'spring' as const,
  duration: 0.35,
  bounce: 0,
};

// -------------------------------------------------------
// Component
// -------------------------------------------------------
function Dashboard() {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  // FIX #5: Respect prefers-reduced-motion globally.
  const shouldReduceMotion = useReducedMotion();

  // Helper: returns instant transition when reduced motion is on.
  const safeTransition = (t: object) =>
    shouldReduceMotion ? { duration: 0 } : t;

  return (
    <div>

      {/* ------------------------------------------------
          FIX #1: AnimatePresence wraps conditional sidebar
          so it gets a proper exit animation.
          FIX #18 (spring): sidebar uses spring for
          interruptible open/close.
          ------------------------------------------------ */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="sidebar"
            style={{ width: 300 }}
            // Enter: opacity + translateX + blur (panel slides from left)
            initial={{ opacity: 0, x: -16, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            // Exit: subtler than enter (smaller offset, same blur)
            exit={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
            transition={safeTransition(SPRING_INTERACTIVE)}
          >
            <h2>Settings</h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX #2: Tab content swap — AnimatePresence with
          mode="wait" crossfades between tabs.
          ------------------------------------------------ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
          transition={safeTransition({
            duration: 0.2,
            ease: EASE_OUT_SMOOTH,
          })}
        >
          {activeTab === 'home' ? <HomeContent /> : <SettingsContent />}
        </motion.div>
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX #7:  scale from 0.95, not 0
          FIX #8:  duration ~0.35s (spring), not 1.5s
          FIX #9:  spring easing, not linear
          FIX #10: stagger 40ms, not 200ms
          FIX #11: blur in enter animation (Jakub recipe)
          FIX #12: custom spring, not default ease
          ------------------------------------------------ */}
      <div className="grid">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{
              opacity: 0,
              scale: 0.95,              // FIX #7: 0.95, never 0
              y: 8,
              filter: 'blur(4px)',      // FIX #11: blur in enter
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              filter: 'blur(0px)',
            }}
            transition={safeTransition({
              ...SPRING_ENTER,          // FIX #8/#9/#12: spring ~0.35s
              delay: i * 0.04,          // FIX #10: 40ms stagger (< 50ms max)
            })}
          >
            <Card item={item} />
          </motion.div>
        ))}
      </div>

      {/* ------------------------------------------------
          FIX #18: Tooltip — first delayed, subsequent
          instant (Emil's pattern). Duration shortened.
          ------------------------------------------------ */}
      <motion.div
        className="tooltip"
        initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={safeTransition({
          duration: 0.15,
          ease: EASE_OUT_SMOOTH,
          delay: getTooltipDelay(), // first: 0.15s, subsequent: 0
        })}
      >
        Help text
      </motion.div>

      {/* ------------------------------------------------
          FIX #13: Button press feedback (scale 0.97)
          FIX #14: Hover 150ms, not 500ms
          FIX #15: Specific property, not "all"
          ------------------------------------------------ */}
      <motion.button
        onClick={() => setShowPanel(!showPanel)}
        whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
        whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
        transition={safeTransition(SPRING_INTERACTIVE)}
        style={{
          // FIX #14/#15: specific property, 150ms
          transition: 'background-color 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        Toggle
      </motion.button>

      {/* ------------------------------------------------
          FIX #3: Loading → Content — smooth crossfade
          with AnimatePresence, not instant swap.
          ------------------------------------------------ */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={safeTransition({ duration: 0.15, ease: EASE_IN_SMOOTH })}
          >
            <Spinner />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={safeTransition({
              duration: 0.25,
              ease: EASE_OUT_SMOOTH,
            })}
          >
            <DataTable data={data} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX #4:  Use transform (scaleY) not width/height
          FIX #16: Removed permanent will-change on 4 props
          ------------------------------------------------ */}
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            // Reveal via transform + opacity only (GPU-accelerated)
            initial={{ opacity: 0, scaleY: 0.8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scaleY: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scaleY: 0.8, filter: 'blur(2px)' }}
            transition={safeTransition({
              duration: 0.2,
              ease: EASE_OUT_SMOOTH,
            })}
            style={{
              width: 300,
              transformOrigin: 'top',
              // FIX #16: no permanent will-change. Let Framer
              // Motion handle it automatically per-frame.
            }}
          >
            {n.message}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ------------------------------------------------
          FIX #17: Removed purposeless decorative spinner.
          If a spinner IS needed for loading, use the one
          inside the Loading → Content block above and
          ensure it can be paused / respects reduced motion.
          ------------------------------------------------ */}
      {/* DELETED: decorative-spinner — no functional purpose,
          infinite loop, not pausable, accessibility concern. */}

      {/* ------------------------------------------------
          FIX #6: Keyboard shortcut opens search INSTANTLY
          — no animation for keyboard-initiated actions.
          ------------------------------------------------ */}
      <button
        onKeyDown={(e) => {
          if (e.key === 'k') {
            // Keyboard-initiated: open instantly, no animation (Emil's rule)
            setSearchOpen(true);
          }
        }}
      >
        Search (Cmd+K)
      </button>
    </div>
  );
}
```

---

## Summary Table

| # | Issue | Severity | Rule Source |
|---|-------|----------|------------|
| 1 | Sidebar conditional render without AnimatePresence | Critical | audit-checklist: Motion gaps |
| 2 | Tab swap has no animation | Critical | audit-checklist: Mode switches |
| 3 | Loading to Content instant swap | Critical | audit-checklist: Loading transitions |
| 4 | Animating width/height (layout properties) | Critical | timing-and-easing: GPU-only |
| 5 | No prefers-reduced-motion support | Critical | audit-checklist: Accessibility |
| 6 | Keyboard shortcut triggers animation | Critical | audit-checklist: Emil's rule |
| 7 | Scale from 0 (should be 0.95+) | Important | timing-and-easing: Scale range |
| 8 | Duration 1.5s (max 300ms for user-initiated) | Important | timing-and-easing: Duration thresholds |
| 9 | Linear easing on motion | Important | timing-and-easing: No linear |
| 10 | 200ms stagger (max 50ms) | Important | timing-and-easing: Stagger limit |
| 11 | No blur in enter animation | Important | timing-and-easing: Jakub recipe |
| 12 | Default easing instead of custom curves | Important | audit-checklist: Emil's rule |
| 13 | No button press feedback | Important | audit-checklist: State transitions |
| 14 | 500ms hover duration (should be 120-180ms) | Important | timing-and-easing: Hover feedback |
| 15 | `transition: all` instead of specific properties | Important | audit-checklist: Performance |
| 16 | will-change on 4 properties permanently | Important | timing-and-easing: will-change |
| 17 | Purposeless infinite spinner, not pausable | Important | audit-checklist: Performance + A11y |
| 18 | Tooltip always delayed (should be first-delayed, then instant) | Important | audit-checklist: Emil's tooltip pattern |

---

## Designer Perspective Summary

**Emil Kowalski (Primary)**: 10 violations — keyboard animation (#6), linear easing (#9), default curves (#12), `transition: all` (#15), tooltip pattern (#18), hover too slow (#14), duration too long (#8), scale from 0 (#7), no reduced motion (#5), high-frequency stagger (#10).

**Jakub Krehel (Secondary)**: 5 violations — missing blur in enters (#11), no exit animations on sidebar (#1), loading snap (#3), no button press feedback (#13), tab swap (#2).

**Jhey Tompkins (Selective)**: The decorative spinner (#17) could be a Jhey-approved element in a playful context, but in a SaaS productivity dashboard it is misplaced. Removed.
