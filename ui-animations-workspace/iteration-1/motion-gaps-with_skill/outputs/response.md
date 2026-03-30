# Response: Adding Animations to Dashboard

Your dashboard has the classic "motion gap" problem -- conditional UI changes that lack animation are often worse than poorly-tuned animations. Here's a systematic approach:

## Step 1: Motion Gap Audit

First, search your codebase for all conditional renders:

```bash
grep -n "&&\s*(" --include="*.tsx" --include="*.jsx" -r .
grep -n "?\s*<" --include="*.tsx" --include="*.jsx" -r .
```

Every `{isOpen && <Modal />}`, `{activeTab === 'settings' && <Settings />}` is a potential motion gap.

## Step 2: Wrap All Conditional Renders with AnimatePresence

```tsx
import { motion, AnimatePresence } from 'motion/react'
```

## Modals (Enter + Exit)

```tsx
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(2px)' }}
        transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
        className="fixed z-50"
      >
        {children}
      </motion.div>
    </>
  )}
</AnimatePresence>
```

**Key**: Enter uses `opacity + translateY(20) + blur(4px)`. Exit is **subtler** than enter -- smaller translateY (10 vs 20), less blur (2px vs 4px). Exit should feel like a quick dismissal, not a dramatic departure.

## Tabs (Content Transition, Not Just Indicator)

Mode switches must animate their **content changes**, not just the tab indicator:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
    transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
  >
    {tabContent}
  </motion.div>
</AnimatePresence>
```

Exit goes **up and subtle** (-4px), enter comes from **below** (+8px). Exit is intentionally more subtle.

## Settings Panel (Conditional Controls)

Settings panels with conditional controls need enter/exit animations:

```tsx
<AnimatePresence>
  {showAdvanced && (
    <motion.div
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
      transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
    >
      <AdvancedSettings />
    </motion.div>
  )}
</AnimatePresence>
```

## The Recipe

Every enter animation follows this pattern (Jakub's recipe):
- **Enter**: `opacity: 0 → 1`, `translateY: 8 → 0`, `filter: blur(4px) → blur(0px)`
- **Exit**: Same properties but **subtler values** -- smaller translateY, less blur, faster duration
- **Spring with bounce: 0** for professional feel
- Elements must never just disappear -- always animate out
