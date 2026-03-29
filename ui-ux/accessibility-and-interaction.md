# Accessibility, Interaction & Platform

> Deep references: [references/interaction-design.md](references/interaction-design.md), [references/css-techniques.md](references/css-techniques.md)

## Forms
- Label above input, error below, helper text optional
- Correct `type`, `inputmode`, `autocomplete`. Never block paste
- Accept messy input, normalize it (Postel's Law)
- Submit button enabled until request starts; spinner during request
- Errors inline next to fields; focus first error on submit

## Accessibility
- `<button>` for actions, `<a>` for navigation -- never `<div onClick>`
- `aria-label` on icon buttons, `aria-hidden="true"` on decorative icons
- `aria-live="polite"` for async updates
- `:focus-visible` over `:focus` -- visible ring, never removed without replacement
- Contrast: 4.5:1 normal text, 3:1 large text, 3:1 UI components
- Touch targets >= 44px. Text readable at 200% zoom
- Audit: axe-core -> keyboard nav -> screen reader -> contrast check

## Touch & Interaction
- Expand hit areas with pseudo-elements (`inset: -8px -12px`)
- `touch-action: manipulation` to prevent double-tap zoom delay
- `overscroll-behavior: contain` in modals/drawers
- Native `<dialog>` for modals (built-in focus trap, Escape key)
- Popover API for tooltips/dropdowns (light-dismiss, proper stacking)

## Anti-Patterns (flag these in reviews)

### Code Smells
- `user-scalable=no` or `maximum-scale=1` disabling zoom
- `onPaste` with `preventDefault`
- `transition: all` -- list properties explicitly
- `outline-none` without `focus-visible` replacement
- `<div>`/`<span>` with click handlers (should be `<button>`)
- Images without dimensions (causes CLS)
- Large arrays `.map()` without virtualization
- Form inputs without labels
- Icon buttons without `aria-label`
- Hardcoded date/number formats (use `Intl.*`)
- Animating `box-shadow` directly
- Hardcoded border colors (`#e5e5e5`) instead of alpha tokens
- Pure black shadows instead of deep neutrals
- Inconsistent shadow directions
- `h-screen` instead of `min-h-[100dvh]`
- Complex flexbox percentage math instead of CSS Grid
- `useState` for continuous animations (use `useMotionValue`)

### Design Smells
- Wrapping everything in cards
- Nesting cards inside cards
- 3-column equal card grids
- Same spacing everywhere
- Center-aligned everything
- Generic avatars and placeholder names
- AI copywriting cliches
- Emojis in UI code/markup
- Modals for everything
- Missing empty/loading/error states

## Performance Guardrails

- **DOM Cost**: Grain/noise filters on fixed `pointer-events-none` pseudo-elements only, never scrolling containers
- **Hardware Acceleration**: Animate `transform` and `opacity` exclusively -- never `top`, `left`, `width`, `height`
- **Shadow Animation**: Pseudo-element `opacity` technique, never `transition: box-shadow`
- **Z-Index Restraint**: Semantic scale only (sticky, modal-backdrop, modal, toast, tooltip) -- never arbitrary `z-50`
- **Viewport Stability**: `min-h-[100dvh]` not `h-screen`
- **Layout**: CSS Grid over complex flexbox math
- **Isolation**: CPU-heavy perpetual animations in their own memoized Client Components

## Mobile & i18n

### Mobile
- Mobile != small desktop; design for one-handed, bad-network users
- FlatList/FlashList for long lists, never ScrollView
- Tokens in SecureStore/Keychain, never AsyncStorage
- Handle all states: loading, error, empty, success
- Follow platform conventions (iOS vs Android)

### i18n
- Dates/times: `Intl.DateTimeFormat`. Numbers/currency: `Intl.NumberFormat`
- CSS logical properties for RTL (`margin-inline-start`, `padding-inline`)
- 30-40% space budget for translations

### Content & Copy
- Active voice: "Install the CLI" not "The CLI will be installed"
- Specific button labels: "Save API Key" not "Continue"
- Error messages include fix/next step
- `&` over "and" where space-constrained
