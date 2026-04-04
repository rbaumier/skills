# Eval: full-sweep (run 1, with skill)

## Prompt

Fix all issues in the provided `SettingsPage` TSX component.

---

## Issues Found (21 total)

### 1. `h-screen` on page wrapper
**Rule**: Use `min-h-[100dvh]` not `h-screen` (causes mobile layout jumping on iOS/Android when address bar collapses).
**Line**: `<div className="h-screen ...`
**Fix**: Replace `h-screen` with `min-h-[100dvh]`.

### 2. Pure black background (`bg-black`)
**Rule**: Never use pure black (#000). Use off-black like `bg-zinc-950` or a tinted charcoal.
**Line**: `bg-black`
**Fix**: Replace with `bg-zinc-950`.

### 3. Default font `Inter`
**Rule**: Inter/Roboto/Arial are AI-slop tells. Use distinctive fonts like Geist, Outfit, Cabinet Grotesk, Satoshi.
**Line**: `style={{ fontFamily: 'Inter, sans-serif' }}`
**Fix**: Replace with `fontFamily: 'Geist, sans-serif'` (or Satoshi/Outfit).

### 4. Purple-to-blue gradient text on heading
**Rule**: AI Color Palette anti-pattern -- purple-to-blue gradients are BANNED. Gradient text on headings is also separately banned (decorative, not meaningful).
**Line**: `bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent`
**Fix**: Remove gradient text entirely. Use a solid color with appropriate weight for hierarchy.

### 5. Heading missing `text-wrap: balance`
**Rule**: Headings should use `text-wrap: balance`.
**Line**: `<h1 className="text-4xl ...`
**Fix**: Add `text-balance` (Tailwind) or `style={{ textWrap: 'balance' }}`.

### 6. Nested cards (card inside card)
**Rule**: Never nest cards inside cards. Flatten hierarchy, use spacing.
**Line**: Outer `div` with `border rounded shadow-sm` contains inner `div` with `border rounded shadow-sm`.
**Fix**: Remove the inner card's border and shadow. Use spacing to separate content areas.

### 7. Pure black shadows
**Rule**: Never use `rgba(0,0,0,...)` for shadows. Tint shadows toward the background hue using deep neutrals like `rgba(17, 24, 39, 0.08)`.
**Line**: `style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}`
**Fix**: Replace with `boxShadow: '0 4px 6px rgba(17, 24, 39, 0.08)'`.

### 8. `outline-none` without `:focus-visible` replacement
**Rule**: Never remove outline without providing a `:focus-visible` ring replacement. This breaks keyboard accessibility.
**Line**: `className="outline-none border px-2 py-1"` on input.
**Fix**: Replace with `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 outline-none`.

### 9. Paste blocked on input
**Rule**: Never block paste (`onPaste` with `preventDefault`). This is a code smell and accessibility violation (password managers, assistive tools).
**Line**: `onPaste={(e) => e.preventDefault()}`
**Fix**: Remove the `onPaste` handler entirely.

### 10. Input missing label
**Rule**: Form inputs must have associated labels. `<span>API Key</span>` is not a `<label>`.
**Line**: `<span>API Key</span>` followed by `<input>`.
**Fix**: Replace `<span>` with `<label htmlFor="api-key">API Key</label>` and add `id="api-key"` to the input.

### 11. Tabular nums missing on price values
**Rule**: Use `font-variant-numeric: tabular-nums` on number columns/displays so digits align.
**Line**: Three `<span>` elements showing `$1,234.56`, `$789.00`, `$12,345.00`.
**Fix**: Add `style={{ fontVariantNumeric: 'tabular-nums' }}` or Tailwind `tabular-nums` class.

### 12. `div` with `onClick` instead of `<button>`
**Rule**: `<button>` for actions, `<a>` for navigation -- never `<div onClick>`.
**Line**: `<div ... onClick={() => toggleNotifications()} ...>`
**Fix**: Replace `<div>` with `<button>`. Add proper `type="button"`.

### 13. Direct `box-shadow` animation on hover
**Rule**: Animate shadows via pseudo-element opacity technique, never `transition: box-shadow`.
**Line**: `style={{ transition: 'box-shadow 0.3s ease' }}` + `onMouseEnter` setting `boxShadow`.
**Fix**: Use a pseudo-element with the target shadow, animate its `opacity` from 0 to 1 on hover. Remove inline event handlers for shadow.

### 14. `transition-all` instead of explicit properties
**Rule**: Never use `transition: all` -- list properties explicitly.
**Line**: `className="transition-all duration-300"` (appears twice).
**Fix**: Replace with specific properties, e.g., `transition-opacity duration-300` or `transition-transform duration-300`.

### 15. Generic "Submit" button label on destructive action
**Rule**: Button labels must be verb + noun ("Delete Account", "Save API Key"). Never use generic "Submit".
**Line**: `<button ... onClick={() => deleteAccount()}>Submit</button>`
**Fix**: Change label to "Delete Account".

### 16. Destructive action styled as primary
**Rule**: Destructive actions should NOT be primary (solid red). Use secondary style (outline/muted) + confirmation dialog or undo pattern.
**Line**: `className="bg-red-600 text-white px-6 py-2 rounded text-lg"`
**Fix**: Change to outline/secondary style: `className="border border-red-600 text-red-600 hover:bg-red-50 px-6 py-2 rounded text-lg"`. Add confirmation step.

### 17. Icon button without `aria-label`
**Rule**: Icon-only buttons must have `aria-label` for screen readers.
**Line**: `<button className="p-1"><TrashIcon className="w-4 h-4" /></button>`
**Fix**: Add `aria-label="Delete"` and `<TrashIcon aria-hidden="true" />`.

### 18. Icon button with tiny hit area
**Rule**: Touch targets must be >= 44px. A `p-1` button with a 16px icon is ~24px -- far too small.
**Fix**: Increase padding or use a pseudo-element to expand the hit area: `className="p-2 relative"` with `after:absolute after:inset-[-8px]`.

### 19. Bounce animation
**Rule**: Bounce/elastic easing is dated and tacky. Use `ease-out` with quart/quint/expo curves.
**Line**: `style={{ animation: 'bounce 1s infinite' }}`
**Fix**: Remove bounce animation. If attention is needed, use a subtle pulse with `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) or a badge indicator instead.

### 20. Animating `left` property in keyframes
**Rule**: Only animate `transform` and `opacity`. Never animate `top`, `left`, `width`, `height` -- they trigger layout recalculation.
**Line**: `@keyframes slideIn { from { left: -100px; ... } to { left: 0; ... } }`
**Fix**: Replace with `transform: translateX(-100px)` / `transform: translateX(0)`.

### 21. `user-scalable=no` and `maximum-scale=1` in viewport meta
**Rule**: Never disable zoom. This is an accessibility violation (WCAG 1.4.4).
**Line**: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />`
**Fix**: Remove `maximum-scale=1` and `user-scalable=no`.

### 22. Error message with no explanation
**Rule**: Error messages must include what happened + why + how to fix. "Invalid input" tells the user nothing.
**Line**: `<p className="text-red-500 text-sm">Invalid input</p>`
**Fix**: Provide specific context, e.g., "API key must be 32 characters. Check your dashboard for the correct key."

### 23. `mb-4` margins instead of `gap` on parent
**Rule**: Use `gap` for sibling spacing instead of margins (eliminates margin collapse issues, cleaner).
**Line**: `mb-4` on multiple child divs within `<div className="flex flex-col">`.
**Fix**: Add `gap-4` on the parent flex container, remove `mb-4` from children.

---

## Fixed Code

```tsx
import React from 'react';

export default function SettingsPage() {
  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100"
      style={{ fontFamily: 'Geist, sans-serif' }}
    >
      {/* 
        Heading: solid color, no gradient text, text-wrap balance.
        Using zinc-100 for primary text on dark background.
      */}
      <h1
        className="text-4xl font-bold text-zinc-100"
        style={{ textWrap: 'balance' }}
      >
        Settings
      </h1>

      {/* Parent flex uses gap instead of mb-4 on children */}
      <div className="flex flex-col gap-6">

        {/* 
          Flattened card: removed nested card structure.
          Shadow uses tinted neutral, not pure black.
        */}
        <div
          className="p-4 border border-zinc-800 rounded-lg"
          style={{
            boxShadow: '0 4px 6px rgba(17, 24, 39, 0.08)',
          }}
        >
          {/* Input section: no card wrapper, just spacing */}
          <div className="flex flex-col gap-2">
            <label htmlFor="api-key" className="text-sm font-medium text-zinc-400">
              API Key
            </label>
            <input
              id="api-key"
              type="text"
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 rounded-md
                         outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950"
              placeholder="Enter your API key"
              autoComplete="off"
            />
            {/* No onPaste blocking */}
          </div>

          {/* Price display: tabular-nums for alignment */}
          <div className="mt-4 flex gap-4 tabular-nums text-zinc-300">
            <span className="text-lg">$1,234.56</span>
            <span className="text-lg">$789.00</span>
            <span className="text-lg">$12,345.00</span>
          </div>
        </div>

        {/* 
          Toggle: <button> instead of <div onClick>.
          Shadow animation via CSS pseudo-element, not inline box-shadow.
          Explicit transition property, not transition-all.
        */}
        <button
          type="button"
          className="p-4 border border-zinc-800 rounded-lg text-left
                     transition-opacity duration-200
                     hover:bg-zinc-900 relative group"
          onClick={() => toggleNotifications()}
        >
          <span className="text-zinc-200">Enable notifications</span>
          {/* 
            Shadow lift effect via pseudo-element opacity,
            not direct box-shadow transition.
          */}
          <span
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
                       transition-opacity duration-200 pointer-events-none"
            style={{
              boxShadow: '0 8px 16px rgba(17, 24, 39, 0.2)',
            }}
            aria-hidden="true"
          />
        </button>

        {/* 
          Destructive action: secondary style (outline), not primary solid red.
          Label is verb+noun ("Delete Account"), not generic "Submit".
        */}
        <button
          type="button"
          className="border border-red-500 text-red-400 hover:bg-red-950
                     px-6 py-2 rounded-lg text-sm font-medium
                     transition-colors duration-200"
          onClick={() => {
            if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
              deleteAccount();
            }
          }}
        >
          Delete Account
        </button>

        {/* 
          Icon button: aria-label for screen readers,
          adequate touch target (44px min via padding + pseudo-element).
        */}
        <button
          type="button"
          className="p-2 relative text-zinc-400 hover:text-zinc-200
                     transition-colors duration-200
                     after:absolute after:inset-[-8px] after:content-['']"
          aria-label="Delete item"
        >
          <TrashIcon className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* 
          Bell button: no bounce animation.
          Subtle pulse with ease-out-expo if attention needed.
          Explicit transition property.
        */}
        <button
          type="button"
          className="p-2 relative text-zinc-400 hover:text-zinc-200
                     transition-colors duration-200"
          aria-label="Notifications"
        >
          <BellIcon aria-hidden="true" />
        </button>
      </div>

      {/* 
        Keyframe animation: uses transform instead of left.
        Only animates transform + opacity (GPU-composited).
      */}
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

      {/* 
        Error message: specific, actionable, explains what + why + fix.
        Not just "Invalid input".
      */}
      <p className="text-red-400 text-sm mt-2" role="alert">
        API key must be 32 characters. Find your key in
        <a href="/dashboard/keys" className="underline ml-1">your dashboard</a>.
      </p>

      {/* 
        Viewport meta: NO maximum-scale or user-scalable=no.
        Users must be able to zoom (WCAG 1.4.4).
      */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
      />
    </div>
  );
}
```

---

## Summary of all issues mapped to assertions

| # | Issue | Rule Violated |
|---|-------|---------------|
| 1 | `h-screen` on wrapper | Use `min-h-[100dvh]` |
| 2 | `bg-black` (pure #000) | Off-black only (zinc-950) |
| 3 | `Inter` font family | Use Geist/Outfit/Satoshi |
| 4 | Purple-to-blue gradient on h1 | AI color palette banned + no gradient text |
| 5 | Missing `text-wrap: balance` on heading | Headings need balance |
| 6 | Nested cards (border+shadow inside border+shadow) | Flatten hierarchy |
| 7 | `rgba(0,0,0,0.1)` shadow | Tint shadows to background hue |
| 8 | `outline-none` without focus-visible | Must provide `:focus-visible` ring |
| 9 | `onPaste preventDefault` | Never block paste |
| 10 | Missing `<label>` on input | Forms need labels |
| 11 | Prices without `tabular-nums` | `font-variant-numeric: tabular-nums` |
| 12 | `<div onClick>` for toggle | Use `<button>`, not `<div>` |
| 13 | Direct `box-shadow` transition | Pseudo-element opacity technique |
| 14 | `transition-all` | List properties explicitly |
| 15 | "Submit" label on delete action | Verb + noun: "Delete Account" |
| 16 | Solid red primary for destructive action | Secondary style + confirmation |
| 17 | Icon button without `aria-label` | `aria-label` required |
| 18 | Tiny 24px icon button hit area | Min 44px touch target |
| 19 | `bounce 1s infinite` animation | No bounce/elastic easing |
| 20 | `left` property in keyframes | Only `transform` + `opacity` |
| 21 | `user-scalable=no`, `maximum-scale=1` | Never disable zoom |
| 22 | "Invalid input" error message | Must include what + why + fix |
| 23 | `mb-4` margins vs `gap` | Use `gap` on flex parent |
