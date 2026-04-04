# Full Sweep: Settings Page Fix

## Fixed Code

```tsx
import React from 'react';

export default function SettingsPage() {
  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100"
      style={{ fontFamily: 'Geist, sans-serif' }}
    >
      <h1
        className="text-4xl font-bold text-zinc-50"
        style={{ textWrap: 'balance' }}
      >
        Settings
      </h1>

      <div className="flex flex-col gap-6">
        {/* --- API Key Section --- */}
        <div className="p-4">
          <label htmlFor="api-key-input" className="block text-sm font-medium text-zinc-300 mb-1">
            API Key
          </label>
          <input
            id="api-key-input"
            type="text"
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            placeholder="Enter key"
          />
        </div>

        {/* --- Financial Figures --- */}
        <div className="p-4">
          <div
            className="flex gap-6"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="text-lg text-zinc-200">$1,234.56</span>
            <span className="text-lg text-zinc-200">$789.00</span>
            <span className="text-lg text-zinc-200">$12,345.00</span>
          </div>
        </div>

        {/* --- Notification Toggle --- */}
        <button
          className="p-4 border border-zinc-700 rounded-md text-left transition-shadow duration-200 relative group"
          onClick={() => toggleNotifications()}
        >
          <span>Enable notifications</span>
          {/* Shadow animation via pseudo-element opacity, not direct box-shadow transition */}
          <span
            className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
            style={{ boxShadow: '0 8px 16px rgba(17, 24, 39, 0.25)' }}
            aria-hidden="true"
          />
        </button>

        {/* --- Delete Account (destructive = secondary style + confirmation) --- */}
        <button
          className="border border-red-500/40 text-red-400 bg-transparent px-6 py-2 rounded-md text-sm hover:bg-red-500/10 transition-colors duration-150"
          onClick={() => {
            if (window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
              deleteAccount();
            }
          }}
        >
          Delete Account
        </button>

        {/* --- Icon button with aria-label and proper touch target --- */}
        <button className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Delete item">
          <TrashIcon className="w-4 h-4" />
        </button>

        {/* --- Bell icon: no bounce, no decorative animation --- */}
        <button aria-label="Notifications">
          <BellIcon />
        </button>
      </div>

      {/* Slide-in animation uses transform + opacity only */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Error message explains what went wrong and how to fix it */}
      <p className="text-red-400 text-sm" role="alert">
        API key format is invalid. Please enter a 32-character alphanumeric key (e.g. sk-abc123...).
      </p>

      {/* Viewport: no maximum-scale, no user-scalable=no */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </div>
  );
}
```

---

## Issues Found and Fixed (21)

| # | Issue ID | What Was Wrong | Rule Violated | Fix Applied |
|---|----------|---------------|---------------|-------------|
| 1 | `no-ai-color-palette` | `bg-gradient-to-r from-purple-500 to-blue-500` on the heading -- classic AI color palette (purple-to-blue gradient). | Anti-pattern #1: AI Color Palette banned | Removed gradient entirely. Plain `text-zinc-50` for the heading. |
| 2 | `no-default-fonts` | `fontFamily: 'Inter, sans-serif'` -- Inter is a generic AI-default font. | Anti-pattern #2: Inter/Roboto/Arial banned | Replaced with `Geist, sans-serif`. |
| 3 | `no-gradient-text` | `bg-clip-text text-transparent` used to create gradient text on the h1. | Anti-pattern #4: No gradient text on headings | Removed gradient text effect, used solid color. |
| 4 | `no-pure-black` | `bg-black` sets the page background to pure `#000000`. | Anti-pattern #9: No pure black | Changed to `bg-zinc-950` (off-black with slight warmth). |
| 5 | `no-pure-black-shadows` | `boxShadow: '0 4px 6px rgba(0,0,0,0.1)'` uses pure black shadow. | Shadow rules: tint toward background hue | Removed inline shadow on the old outer card. Shadow on the hover pseudo-element uses `rgba(17, 24, 39, 0.25)` (deep neutral, not pure black). |
| 6 | `no-h-screen` | `h-screen` on the root `<div>` causes mobile layout jumping (100vh != visual viewport on iOS). | Anti-pattern #18: Use `min-h-[100dvh]` | Replaced with `min-h-[100dvh]`. |
| 7 | `no-bounce-easing` | `animation: 'bounce 1s infinite'` on the bell button -- bounce is dated/tacky. | Anti-pattern #8: No bounce/elastic easing | Removed the bounce animation entirely. Bell button is now static. |
| 8 | `no-div-onclick` | `<div onClick={() => toggleNotifications()}>` -- a div is not an interactive element. | Accessibility: `<button>` for actions, never `<div onClick>` | Changed to a `<button>` element. |
| 9 | `no-outline-none` | `outline-none` on the input with no `:focus-visible` replacement -- keyboard users lose focus indication. | Accessibility: never remove outline without focus-visible replacement | Replaced with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`. |
| 10 | `no-box-shadow-animation` | `transition: 'box-shadow 0.3s ease'` and `onMouseEnter` directly animating `box-shadow` -- expensive, triggers paint. | Performance: pseudo-element opacity technique for shadow animation | Used an absolutely positioned pseudo-element `<span>` with `transition-opacity` that contains the shadow. Group hover toggles its opacity. |
| 11 | `button-verb-noun` | Button labeled "Submit" for a destructive delete action -- generic, misleading. | UX Writing: verb + noun labels ("Delete Account", not "Submit") | Changed to "Delete Account". |
| 12 | `icon-button-aria` | `<button><TrashIcon /></button>` has no accessible name -- screen readers announce it as an empty button. | Accessibility: icon buttons must have `aria-label` | Added `aria-label="Delete item"`. Also added `aria-label="Notifications"` to the bell button. |
| 13 | `tabular-nums` | Price values (`$1,234.56`, `$789.00`, `$12,345.00`) displayed without tabular figures -- digits shift when values change. | Typography: `font-variant-numeric: tabular-nums` on number displays | Added `fontVariantNumeric: 'tabular-nums'` on the container. |
| 14 | `text-wrap-balance` | The `<h1>` has no `text-wrap: balance` -- headings can break unevenly on narrow viewports. | Typography: headings use `text-wrap: balance` | Added `style={{ textWrap: 'balance' }}` on the h1. |
| 15 | `no-nesting-cards` | A card (border + rounded + shadow) nested inside another card (border + rounded + shadow) -- visual clutter, unclear hierarchy. | Anti-pattern #10: Never nest cards inside cards | Flattened hierarchy. Removed both the outer and inner card wrappers, replaced with simple sections using spacing. |
| 16 | `destructive-not-primary` | `bg-red-600 text-white` makes the delete button look like a primary action -- dangerous, invites accidental clicks. | Destructive actions: secondary style + confirmation, not primary | Changed to outline/ghost style (`border border-red-500/40 text-red-400 bg-transparent`) with a `window.confirm()` confirmation dialog. |
| 17 | `no-user-scalable-no` | `maximum-scale=1, user-scalable=no` in the viewport meta -- blocks pinch-to-zoom, accessibility violation. | Code smell: never disable zoom | Removed `maximum-scale=1` and `user-scalable=no` from the viewport meta tag. |
| 18 | `no-block-paste` | `onPaste={(e) => e.preventDefault()}` on the API key input -- blocks password managers, frustrates users. | Code smell: never block paste | Removed the `onPaste` handler entirely. |
| 19 | `gap-over-margins` | `mb-4` on each child div instead of `gap` on the flex parent -- margin-based spacing is fragile and creates unwanted trailing margin. | Layout: `gap` for sibling spacing, not margins | Replaced individual `mb-4` with `gap-6` on the parent `flex flex-col` container. |
| 20 | `error-msg-includes-fix` | `"Invalid input"` -- tells the user nothing about what went wrong or how to fix it. | UX Writing: error messages must include what + why + how to fix | Replaced with `"API key format is invalid. Please enter a 32-character alphanumeric key (e.g. sk-abc123...)."` Added `role="alert"` for screen reader announcement. |
| 21 | `animate-transform-opacity` | `@keyframes slideIn` animates the `left` property -- triggers layout reflow on every frame. | Performance: only animate `transform` and `opacity` | Changed `left: -100px` / `left: 0` to `transform: translateX(-100px)` / `transform: translateX(0)`. Also added `prefers-reduced-motion` media query. |

---

## Additional Improvements

- **Label for input**: Added a proper `<label>` element with `htmlFor` linking to the input's `id` -- form inputs must have associated labels.
- **Touch targets**: Increased the trash icon button padding to `p-3` with `min-w-[44px] min-h-[44px]` to meet the 44px minimum touch target.
- **`transition-all` removed**: The notification toggle and bell button both had `transition-all` which animates every property. Replaced with specific property transitions (`transition-shadow`, `transition-opacity`, `transition-colors`).
- **Reduced motion**: Added a `prefers-reduced-motion` media query to disable animations for users who have opted out of motion.
