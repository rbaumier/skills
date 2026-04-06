# Run 1 — With Skill

## Prompt

Fix all issues in the provided `DashboardPage` TSX component.

---

## Issues Found (50 total)

### 1. `h-screen` on page wrapper
**Rule**: Use `min-h-[100dvh]` not `h-screen` (mobile address bar collapse causes layout jumping).
**Line**: `<div className="h-screen bg-black"`
**Fix**: Replace `h-screen` with `min-h-[100dvh]`.

### 2. Pure black background (`bg-black`)
**Rule**: Never pure black (#000). Use off-black like `bg-zinc-950` or tinted charcoal.
**Line**: `bg-black`
**Fix**: Replace with `bg-zinc-950`.

### 3. Default font `Inter`
**Rule**: Inter/Roboto/Arial are AI-slop tells. Use distinctive fonts: Geist, Outfit, Cabinet Grotesk, Satoshi.
**Line**: `style={{ fontFamily: 'Inter, sans-serif' }}`
**Fix**: Replace with `fontFamily: 'Geist, sans-serif'`.

### 4. Missing antialiased font smoothing
**Rule**: Apply `-webkit-font-smoothing: antialiased` on the body/root element.
**Line**: Root `<div>` has no font smoothing.
**Fix**: Add `antialiased` class (Tailwind) to the root div.

### 5. `user-scalable=no` and `maximum-scale=1`
**Rule**: Never disable zoom. WCAG 1.4.4 violation.
**Line**: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />`
**Fix**: Remove `maximum-scale=1` and `user-scalable=no`. Also: `<meta>` does not belong inside a component return -- move to `<head>` via framework mechanism.

### 6. Purple-to-blue gradient text on heading (AI Color Palette)
**Rule**: Cyan-on-dark, purple-to-blue gradients, neon accents are BANNED. Gradient text on headings is separately banned (decorative, not meaningful).
**Line**: `bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent` on `<h1>`.
**Fix**: Remove gradient. Use solid color with weight for hierarchy.

### 7. Filler copy: "Elevate Your Workflow"
**Rule**: "Elevate", "Seamless", "Unleash", "Next-Gen" are banned filler. Use concrete, specific language.
**Line**: `Elevate Your Workflow`
**Fix**: Replace with something specific to the product, e.g., "Team Activity".

### 8. Oversized H1 (`text-8xl`) as sole hierarchy tool
**Rule**: Control hierarchy with weight + color, not massive scale alone. Dramatic size alone is a template tell.
**Line**: `className="text-8xl font-semibold"`
**Fix**: Reduce to `text-3xl` or `text-4xl`, use `font-bold` + color contrast for hierarchy.

### 9. Center-aligned everything
**Rule**: Left-align + asymmetric feels more designed. Don't center everything.
**Line**: `text-center` on both `<h1>` and `<p>`.
**Fix**: Remove `text-center`, use left alignment.

### 10. Heading missing `text-wrap: balance`
**Rule**: Headings should use `text-wrap: balance`.
**Line**: `<h1>` has no text-wrap.
**Fix**: Add `style={{ textWrap: 'balance' }}` or Tailwind `text-balance`.

### 11. Passive voice in copy
**Rule**: Active voice: "Install the CLI" not "The CLI will be installed".
**Line**: `"The CLI will be installed on your system."`
**Fix**: Rewrite to active: "Install the CLI on your system." or remove if irrelevant to a dashboard.

### 12. `fontSize: '1.5em'` -- em units for type
**Rule**: `px` or `rem` only, never `em` for type scale.
**Line**: `style={{ fontSize: '1.5em' }}`
**Fix**: Replace with `text-base` or a specific rem/px value. Also remove the conflicting `text-sm` class.

### 13. 3-column equal card grid
**Rule**: No 3-column equal card grids. Use asymmetric grid, zig-zag, or horizontal scroll.
**Line**: `grid grid-cols-3 gap-4 p-4 w-full`
**Fix**: Use asymmetric layout, e.g., `grid-cols-[2fr_1fr]` or `auto-fit` with `minmax`.

### 14. Pure black shadow (`rgba(0,0,0,0.1)`)
**Rule**: Never pure black shadows. Tint to background hue: `rgba(17, 24, 39, 0.08)`.
**Line**: `style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}`
**Fix**: Replace with `boxShadow: '0 4px 6px rgba(17, 24, 39, 0.08)'`.

### 15. Nested cards (card inside card)
**Rule**: Never nest cards. Flatten hierarchy with spacing.
**Line**: Outer `div` with `border rounded-lg shadow-md` contains inner `div` with `border rounded-2xl shadow-sm`.
**Fix**: Remove inner card's border and shadow. Use spacing only.

### 16. Inconsistent border-radius (`rounded-lg` + `rounded-2xl` + `rounded-sm` + `rounded`)
**Rule**: Pick ONE border-radius system and use it everywhere.
**Line**: `rounded-lg`, `rounded-2xl`, `rounded-sm`, `rounded` all mixed.
**Fix**: Standardize on `rounded-lg` everywhere.

### 17. `outline-none` without `:focus-visible` replacement
**Rule**: Never remove outline without providing a `:focus-visible` ring. Breaks keyboard accessibility.
**Line**: `className="outline-none border px-2 py-1 bg-white"` on input.
**Fix**: Replace with `outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`.

### 18. Pure white background on input (`bg-white`)
**Rule**: Never pure white (#fff). Use tinted off-white.
**Line**: `bg-white` on the input.
**Fix**: Replace with `bg-zinc-50` or a tinted off-white.

### 19. Paste blocked on input
**Rule**: Never block paste. Accessibility violation (password managers, assistive tools).
**Line**: `onPaste={(e) => e.preventDefault()}`
**Fix**: Remove the `onPaste` handler entirely.

### 20. Label "Email:" on self-explanatory input
**Rule**: Labels are a last resort. Drop if format is self-explanatory (placeholder shows email format).
**Line**: `<label>Email:</label>` next to input with `placeholder="john@example.com"`.
**Fix**: The placeholder makes the format obvious. However, for a11y, keep a visually-hidden label. Use `sr-only` class.

### 21. Input missing associated label (a11y)
**Rule**: Form inputs must have associated `<label>` with `htmlFor` or wrap the input. The current `<label>` has no `htmlFor` and no wrapping.
**Line**: `<label>Email:</label>` followed by `<input>` with no `id`.
**Fix**: Add `id="email"` to input, `htmlFor="email"` to label (or use visually-hidden label).

### 22. Generic placeholder "john@example.com"
**Rule**: No generic "John Doe" / "example.com" placeholders. Use creative, product-specific alternatives.
**Line**: `placeholder="john@example.com"`
**Fix**: Replace with `placeholder="you@company.com"` or something contextual.

### 23. Hero metric layout (big number + small label + gradient)
**Rule**: Big number + small label + gradient accent = template AI tell.
**Line**: `<span className="text-6xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">2,847</span>` + `<p className="text-sm text-gray-400">Total Users</p>`
**Fix**: Remove gradient from metric. Use solid color. Reduce size differential. Integrate into data table or contextual layout.

### 24. Gradient text on metric (cyan-to-blue)
**Rule**: Gradient text banned, especially on metrics. Cyan-on-dark is AI color palette.
**Line**: `from-cyan-400 to-blue-500 bg-clip-text text-transparent` on the 2,847 metric.
**Fix**: Use solid `text-zinc-100` for the number.

### 25. Tabular-nums missing on number displays
**Rule**: `font-variant-numeric: tabular-nums` on number columns/displays so digits align.
**Line**: `2,847`, `$1,234.56`, `$789.00` -- all without tabular-nums.
**Fix**: Add `tabular-nums` class to all numeric displays.

### 26. `marginLeft: '16px'` instead of CSS logical property
**Rule**: Use CSS logical properties for RTL support: `margin-inline-start` not `marginLeft`.
**Line**: `style={{ marginLeft: '16px' }}`
**Fix**: Replace with `style={{ marginInlineStart: '16px' }}` or Tailwind `ms-4`.

### 27. Too many text colors (4+)
**Rule**: 2-3 text colors only: dark (primary), grey (secondary), light grey (tertiary).
**Line**: `text-blue-500`, `text-emerald-600`, `text-purple-400`, `text-gray-500` all used as status colors.
**Fix**: Use semantic color indicators (small dots/badges) alongside consistent text colors (zinc-100, zinc-400, zinc-500).

### 28. Too many font weights mixed (font-bold + font-semibold + font-medium)
**Rule**: 2 font weights for UI: normal (400/500) and bold (600/700). No 600+500 pairing.
**Line**: `font-bold`, `font-semibold`, `font-medium` all present.
**Fix**: Standardize on `font-normal` (400) and `font-bold` (700). Dramatic pairing, not subtle.

### 29. Weight contrast too subtle (600 vs 500)
**Rule**: Dramatic weight pairing: 700+400, not 600+500. Adjacent weights are visually indistinguishable.
**Line**: `font-semibold` (600) paired with `font-medium` (500) in the item list.
**Fix**: Use `font-bold` (700) + `font-normal` (400).

### 30. Line length unconstrained (w-full paragraph with no max-width)
**Rule**: 45-75 chars/line. Use `max-width: 20-35em` on prose.
**Line**: `<p className="text-gray-500 font-medium" style={{ maxWidth: '100%' }}>Lorem ipsum...`
**Fix**: Replace `maxWidth: '100%'` with `maxWidth: '32em'` or Tailwind `max-w-prose`.

### 31. Lorem ipsum filler copy
**Rule**: No filler copy. Write real, specific content or at minimum indicate what belongs there.
**Line**: `Lorem ipsum dolor sit amet, consectetur adipiscing elit...`
**Fix**: Replace with real descriptive content for the feature.

### 32. Grey text on colored background
**Rule**: Never grey text on colored backgrounds. Use same-hue shade.
**Line**: `<p className="text-gray-500" style={{ background: '#dbeafe' }}>Info text on blue</p>`
**Fix**: Replace `text-gray-500` with a blue-tinted text color like `text-blue-700` on the blue background.

### 33. Image without width/height (CLS)
**Rule**: Images must have `width` and `height` attributes to prevent Cumulative Layout Shift.
**Line**: `<img src="/avatar.png" alt="User" />`
**Fix**: Add `width={48} height={48}` (or appropriate dimensions).

### 34. Generic avatar name "John Doe" + "jane@example.com"
**Rule**: No generic John Doe / example.com placeholders.
**Line**: `<p>John Doe</p>` and `<p>jane@example.com</p>`
**Fix**: Use contextual placeholder names or real data bindings.

### 35. `div onClick` for toggle action
**Rule**: `<button>` for actions, `<a>` for navigation -- never `<div onClick>`.
**Line**: `<div className="card p-4 border rounded cursor-pointer" onClick={() => toggleNotifications()}>`
**Fix**: Replace with `<button type="button">`.

### 36. Three identical primary CTA buttons
**Rule**: 1 primary action per page. Multiple same-weight CTAs create decision paralysis (Hick's Law).
**Line**: Three `bg-blue-600 text-white` buttons: "Save Settings", "Export Data", "Create Report".
**Fix**: One primary (Save Settings), others as secondary (outline) or tertiary (text link).

### 37. Button labels are verb+noun (good) but hierarchy is wrong
**Rule**: "Save Settings", "Export Data", "Create Report" are good labels. But all three as primary violates the 1-primary-per-page rule.
**Fix**: Keep labels. Fix visual hierarchy: primary, secondary, tertiary.

### 38. Destructive action styled as primary (solid red)
**Rule**: Destructive actions use secondary style + confirmation. Never solid primary red.
**Line**: `<button className="bg-red-600 text-white px-6 py-2 rounded-lg text-lg">`
**Fix**: Use outline style: `border border-red-500 text-red-400 hover:bg-red-950`. Add confirmation.

### 39. Icon button (TrashIcon) without `aria-label`
**Rule**: Icon-only buttons must have `aria-label`.
**Line**: `<button className="p-1 w-4 h-4"><TrashIcon className="w-4 h-4" /></button>`
**Fix**: Add `aria-label="Delete"`. Add `aria-hidden="true"` to the icon.

### 40. Icon button touch target too small (16px)
**Rule**: Touch targets >= 44px. `w-4 h-4` = 16px -- far too small.
**Line**: `className="p-1 w-4 h-4"`
**Fix**: Remove `w-4 h-4` from button. Use adequate padding: `p-2.5` minimum. Expand with pseudo-element.

### 41. BellIcon button without `aria-label`
**Rule**: Icon-only buttons must have `aria-label`.
**Line**: `<button className="transition-all duration-300" style={{ animation: 'bounce 1s infinite' }}><BellIcon /></button>`
**Fix**: Add `aria-label="Notifications"`. Add `aria-hidden="true"` to the icon.

### 42. Bounce animation (`bounce 1s infinite`)
**Rule**: Bounce/elastic easing is dated, tacky. Use ease-out-quart/quint/expo.
**Line**: `style={{ animation: 'bounce 1s infinite' }}`
**Fix**: Remove. If attention needed, use a subtle dot indicator or a brief pulse with `cubic-bezier(0.16, 1, 0.3, 1)`.

### 43. `transition-all` instead of explicit properties
**Rule**: Never `transition: all`. List properties explicitly.
**Line**: `className="transition-all duration-300"`
**Fix**: Replace with `transition-colors duration-200` or `transition-transform duration-200`.

### 44. Semantic z-index violation (9999, 10000)
**Rule**: Semantic z-index scale: dropdown(100), sticky(200), modal-backdrop(300), modal(400), toast(500), tooltip(600). Never arbitrary 9999.
**Line**: `style={{ zIndex: 9999 }}` and `style={{ zIndex: 10000 }}`
**Fix**: Use `zIndex: 300` for modal backdrop, `zIndex: 400` for modal content.

### 45. Modal for simple action (enabling dark mode)
**Rule**: Modals are lazy. Use inline toggle, sheet, or drawer for simple actions.
**Line**: A full modal asking "Are you sure you want to enable dark mode?"
**Fix**: Replace with an inline toggle switch. No confirmation needed for a reversible preference.

### 46. Modal missing accessibility attributes
**Rule**: Modals need `role="dialog"`, `aria-modal="true"`, focus trap, and return focus on close.
**Line**: `<div className="custom-modal">` -- no role, no aria, no focus management.
**Fix**: If keeping a modal (for destructive actions), use native `<dialog>` or add proper ARIA + focus trap.

### 47. Direct box-shadow animation on hover (CSS)
**Rule**: Animate shadows via pseudo-element opacity, never `transition: box-shadow`.
**Line**: `.card:hover { box-shadow: 0 8px 16px rgba(0,0,0,0.2); transition: box-shadow 0.3s; }`
**Fix**: Use a `::after` pseudo-element with the target shadow, transition its `opacity`.

### 48. `@font-face` without `font-display: swap`
**Rule**: Always include `font-display: swap` in `@font-face` declarations.
**Line**: `@font-face { font-family: 'CustomFont'; src: url('/font.woff2'); }`
**Fix**: Add `font-display: swap;`.

### 49. Animating `left` property in keyframes
**Rule**: Only animate `transform` and `opacity`. Never `top`, `left`, `width`, `height` -- triggers layout recalculation.
**Line**: `@keyframes slideIn { from { left: -100px; ... } to { left: 0; ... } }`
**Fix**: Replace with `transform: translateX(-100px)` / `transform: translateX(0)`.

### 50. `button:focus` instead of `button:focus-visible`
**Rule**: `:focus-visible` over `:focus`. Focus rings should only show for keyboard users, not mouse clicks.
**Line**: `button:focus { outline: 2px solid blue; }`
**Fix**: Change to `button:focus-visible { outline: 2px solid blue; }`.

### 51. `mb-4` margins on list children instead of `gap` on parent
**Rule**: Use `gap` for sibling spacing. Eliminates margin collapse, cleaner.
**Line**: `mb-4` on each item in the `.map()` list.
**Fix**: Wrap in a flex/grid parent with `gap-4`, remove `mb-4` from children.

### 52. Wrapping every item in a card (border + rounded + shadow)
**Rule**: Not everything needs a card container. Reserve cards for grouped, interactive content.
**Line**: Every mapped item has `border rounded-lg shadow-md`.
**Fix**: Use simple rows with dividers or spacing. Reserve shadow for elevated interactive elements.

### 53. Error message "Invalid input" with no explanation
**Rule**: Errors must include: what happened + why + how to fix. "Invalid input" is useless.
**Line**: `<p className="text-red-500 text-sm">Invalid input</p>`
**Fix**: Provide specific message: "Email format is invalid. Use format: you@company.com".

### 54. Error message not connected to input via `aria-describedby`
**Rule**: Use `aria-describedby` to connect error messages to inputs.
**Fix**: Add `id="email-error"` on error `<p>`, add `aria-describedby="email-error"` on the input.

### 55. Empty state: "No items found" with no guidance
**Rule**: Empty states need 5 elements: (1) what will be here, (2) why it matters, (3) how to get started, (4) visual interest, (5) contextual help.
**Line**: `<div className="empty-state"><p>No items found</p></div>`
**Fix**: Full empty state with illustration, explanation, and CTA.

### 56. Console.log debug comment + TODO comment
**Rule**: No console.log, no TODO in production code.
**Line**: `{/* console.log('debug render') */}` and `{/* TODO: fix layout */}`
**Fix**: Remove both comments entirely.

---

## Fixed Code

```tsx
import React, { useState } from 'react';

/**
 * DashboardPage — refactored to eliminate all UI/UX anti-patterns.
 *
 * Key design decisions:
 * - Font: Geist (distinctive, not Inter/Roboto)
 * - Palette: zinc-950 bg, zinc-100/400/500 text (3-tier hierarchy)
 * - Border-radius: rounded-lg everywhere (one system)
 * - Weights: font-normal (400) + font-bold (700) only
 * - Shadows: tinted to zinc, never pure black
 * - Layout: asymmetric grid, left-aligned, gap-based spacing
 */
export default function DashboardPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased"
      style={{ fontFamily: 'Geist, sans-serif' }}
    >
      {/*
        Header: left-aligned, solid color, balanced wrapping.
        No gradient text. No "Elevate" filler. Concrete heading.
      */}
      <header className="px-6 pt-12 pb-8 max-w-5xl">
        <h1
          className="text-3xl font-bold text-zinc-100"
          style={{ textWrap: 'balance' }}
        >
          Team Activity
        </h1>
        <p
          className="text-zinc-400 text-base mt-2 max-w-[32em]"
          style={{ textWrap: 'pretty' }}
        >
          Track usage, manage billing, and configure your workspace.
        </p>
      </header>

      {/*
        Asymmetric grid: 2fr + 1fr instead of 3 equal columns.
        Gap-based spacing, no margins on children.
        Responsive: stacks on small screens.
      */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 px-6 max-w-5xl">

        {/* --- Main content column --- */}
        <div className="flex flex-col gap-6">

          {/*
            Email input section — NOT nested in a card-within-a-card.
            Flattened: single card boundary, spacing separates sections.
          */}
          <section
            className="p-5 border border-zinc-800/60 rounded-lg"
            style={{
              boxShadow:
                '0 1px 2px rgba(17, 24, 39, 0.06), 0 4px 8px rgba(17, 24, 39, 0.04)',
            }}
          >
            <div className="flex flex-col gap-3">
              {/*
                Visually-hidden label for a11y.
                Placeholder is self-explanatory so label is sr-only.
                No onPaste blocking. No outline-none without focus-visible.
                Off-white tint (zinc-900), not pure white.
              */}
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2.5
                           rounded-lg outline-none
                           focus-visible:ring-2 focus-visible:ring-offset-2
                           focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950"
                placeholder="you@company.com"
                aria-describedby="email-error"
              />
            </div>

            {/*
              Metrics row: solid color, tabular-nums, no gradient.
              No hero-metric template (big number + tiny label + gradient).
              Moderate size difference, integrated layout.
            */}
            <div className="mt-5 flex items-baseline gap-6">
              <div>
                <span className="text-2xl font-bold text-zinc-100 tabular-nums">
                  2,847
                </span>
                <p className="text-sm text-zinc-500 mt-0.5">Active users</p>
              </div>
              <div
                className="flex gap-4 tabular-nums text-zinc-300 text-base"
                style={{ marginInlineStart: '0' }}
              >
                <span>$1,234.56</span>
                <span>$789.00</span>
              </div>
            </div>
          </section>

          {/*
            Status section: no card wrapper (not everything needs a card).
            2-3 text colors only: zinc-100, zinc-400, zinc-500.
            Semantic color via small indicator dots, not colored text.
            Prose constrained to 32em.
          */}
          <section className="px-1">
            <div className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                $5k revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                12% growth
              </span>
            </div>
            <p
              className="text-sm text-zinc-500 mt-3 max-w-[32em] leading-relaxed"
              style={{ textWrap: 'pretty' }}
            >
              Your workspace has been active for 30 days. Usage is trending
              upward across all integrations. Review the billing section to
              adjust your plan before the next cycle.
            </p>
          </section>

          {/*
            Notifications toggle: <button> not <div onClick>.
            Shadow hover via pseudo-element opacity, not direct box-shadow.
            Explicit transition property, not transition-all.
          */}
          <button
            type="button"
            className="p-4 border border-zinc-800/60 rounded-lg text-left
                       transition-colors duration-200
                       hover:bg-zinc-900 relative group"
            onClick={() => setNotificationsEnabled((v) => !v)}
          >
            <span className="text-zinc-200">
              {notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            </span>
            <span
              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100
                         transition-opacity duration-200 pointer-events-none"
              style={{
                boxShadow: '0 8px 16px rgba(17, 24, 39, 0.15)',
              }}
              aria-hidden="true"
            />
          </button>

          {/*
            Action row:
            - 1 primary action (Save Settings) -- solid bg
            - Others are secondary (outline) or tertiary (text)
            - Destructive is secondary outline + confirmation, not solid red
            - All labels are verb+noun
          */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold
                         transition-colors duration-200 hover:bg-blue-700
                         focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950"
            >
              Save Settings
            </button>
            <button
              type="button"
              className="border border-zinc-600 text-zinc-300 px-5 py-2.5 rounded-lg
                         font-normal transition-colors duration-200
                         hover:bg-zinc-800
                         focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950"
            >
              Export Data
            </button>
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-200 px-3 py-2.5 rounded-lg
                         font-normal transition-colors duration-200
                         focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950"
            >
              Create Report
            </button>
            <button
              type="button"
              className="border border-red-500/50 text-red-400 px-5 py-2.5 rounded-lg
                         font-normal transition-colors duration-200
                         hover:bg-red-950
                         focus-visible:ring-2 focus-visible:ring-offset-2
                         focus-visible:ring-red-500 focus-visible:ring-offset-zinc-950
                         ms-auto"
              onClick={() => {
                if (
                  window.confirm(
                    'This will permanently delete your account and all data. Continue?'
                  )
                ) {
                  deleteAccount();
                }
              }}
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* --- Sidebar column --- */}
        <div className="flex flex-col gap-6">

          {/* Profile card: real data bindings, not "John Doe" */}
          <div className="p-5 border border-zinc-800/60 rounded-lg">
            <img
              src="/avatar.png"
              alt="Profile photo for current user"
              width={48}
              height={48}
              className="rounded-full"
            />
            <p className="text-zinc-100 font-bold mt-3">{user.name}</p>
            <p className="text-zinc-500 text-sm">{user.email}</p>
          </div>

          {/*
            Dark mode: inline toggle, no modal.
            Reversible preference does not need confirmation.
          */}
          <label className="flex items-center gap-3 cursor-pointer px-1">
            <span className="text-zinc-300 text-sm">Dark mode</span>
            <input
              type="checkbox"
              role="switch"
              checked={darkMode}
              onChange={() => setDarkMode((v) => !v)}
              className="sr-only peer"
            />
            <span
              className="w-10 h-6 rounded-full bg-zinc-700 peer-checked:bg-blue-600
                         relative transition-colors duration-200
                         after:absolute after:top-1 after:start-1
                         after:w-4 after:h-4 after:rounded-full after:bg-zinc-100
                         after:transition-transform after:duration-200
                         peer-checked:after:translate-x-4"
              aria-hidden="true"
            />
          </label>
        </div>
      </div>

      {/*
        Icon buttons: aria-label, adequate touch targets (min 44px),
        no bounce animation, explicit transition properties.
      */}
      <div className="flex items-center gap-2 px-6 mt-6">
        <button
          type="button"
          className="p-2.5 relative text-zinc-400 hover:text-zinc-200
                     transition-colors duration-200 rounded-lg
                     focus-visible:ring-2 focus-visible:ring-offset-2
                     focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950
                     after:absolute after:inset-[-4px] after:content-['']"
          aria-label="Delete item"
        >
          <TrashIcon className="w-5 h-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="p-2.5 relative text-zinc-400 hover:text-zinc-200
                     transition-colors duration-200 rounded-lg
                     focus-visible:ring-2 focus-visible:ring-offset-2
                     focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950
                     after:absolute after:inset-[-4px] after:content-['']"
          aria-label="Notifications"
        >
          <BellIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/*
        Items list: gap on parent instead of mb-4 on children.
        Simple rows with dividers, not every item in a card.
        Weight pairing: font-bold (700) + font-normal (400).
      */}
      <div className="flex flex-col gap-0 px-6 mt-8 max-w-5xl">
        {items.map((item) => (
          <div
            key={item.id}
            className="py-4 border-b border-zinc-800/40 last:border-b-0"
          >
            <span className="font-bold text-zinc-100">{item.title}</span>
            <span className="font-normal text-zinc-400 ms-3">
              {item.description}
            </span>
          </div>
        ))}
      </div>

      {/*
        Info banner: same-hue text on colored bg (blue-700 on blue-100).
        Never grey text on colored background.
      */}
      <div className="px-6 mt-6 max-w-5xl">
        <p className="text-blue-700 text-sm bg-blue-50 px-4 py-3 rounded-lg">
          Your plan renews on May 1. Review billing settings to make changes.
        </p>
      </div>

      {/*
        Error message: specific, actionable (what + why + how to fix).
        Connected to input via aria-describedby. role="alert" for screen readers.
      */}
      <div className="px-6 mt-4 max-w-5xl">
        <p
          id="email-error"
          className="text-red-400 text-sm"
          role="alert"
        >
          That email format looks wrong. Try something like you@company.com.
        </p>
      </div>

      {/*
        Empty state: all 5 elements covered.
        (1) What will be here, (2) Why it matters, (3) How to start,
        (4) Visual interest (icon), (5) Contextual help.
      */}
      <div className="px-6 mt-8 max-w-5xl text-center py-16">
        <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <InboxIcon className="w-6 h-6 text-zinc-500" aria-hidden="true" />
        </div>
        <p className="text-zinc-300 font-bold">No activity yet</p>
        <p className="text-zinc-500 text-sm mt-1 max-w-[24em] mx-auto">
          Activity from your team will appear here once members start
          using the workspace. Invite your first teammate to get started.
        </p>
        <button
          type="button"
          className="mt-4 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold
                     transition-colors duration-200 hover:bg-blue-700
                     focus-visible:ring-2 focus-visible:ring-offset-2
                     focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-950"
        >
          Invite Teammate
        </button>
        <p className="text-zinc-600 text-xs mt-3">
          Need help? <a href="/docs/quickstart" className="underline hover:text-zinc-400">Read the quickstart guide</a>
        </p>
      </div>

      {/*
        Global styles:
        - Keyframes use transform + opacity only (no left/top)
        - focus-visible, not focus
        - font-display: swap on @font-face
        - prefers-reduced-motion respected
        - No bounce. Easing: cubic-bezier(0.16, 1, 0.3, 1) (ease-out-expo)
      */}
      <style>{`
        @font-face {
          font-family: 'CustomFont';
          src: url('/font.woff2');
          font-display: swap;
        }
        @keyframes slideIn {
          from { transform: translateX(-24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        button:focus-visible {
          outline: 2px solid oklch(0.7 0.15 250);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
```

---

## Summary of All Issues

| # | Issue | Rule Violated |
|---|-------|---------------|
| 1 | `h-screen` on wrapper | `min-h-[100dvh]` not `h-screen` |
| 2 | `bg-black` (#000) | Off-black only (zinc-950) |
| 3 | `Inter` font | Geist/Outfit/Satoshi, not Inter |
| 4 | Missing antialiased smoothing | `-webkit-font-smoothing: antialiased` on body |
| 5 | `user-scalable=no`, `maximum-scale=1` | Never block zoom |
| 6 | Purple-to-blue gradient on h1 | AI color palette banned + no gradient text |
| 7 | "Elevate Your Workflow" | No filler copy |
| 8 | `text-8xl` as sole hierarchy | Weight + color, not massive scale alone |
| 9 | `text-center` on everything | Left-align + asymmetric |
| 10 | Missing `text-wrap: balance` on heading | Headings need balance |
| 11 | Passive voice "will be installed" | Active voice |
| 12 | `fontSize: '1.5em'` | px or rem only, never em |
| 13 | `grid-cols-3` equal cards | Asymmetric layout, not 3-col equal |
| 14 | `rgba(0,0,0,0.1)` shadow | Tint shadows, never pure black rgba |
| 15 | Nested cards | Flatten hierarchy with spacing |
| 16 | Mixed border-radius | One consistent system |
| 17 | `outline-none` without focus-visible | Must provide `:focus-visible` ring |
| 18 | `bg-white` on input | No pure white, use tinted off-white |
| 19 | `onPaste preventDefault` | Never block paste |
| 20 | `Email:` label on self-explanatory input | Labels are last resort |
| 21 | Input missing associated `<label>` for a11y | Form inputs need labels |
| 22 | `john@example.com` placeholder | No generic example.com |
| 23 | Big number + gradient = hero metric template | No hero metric layout |
| 24 | Cyan-to-blue gradient on metric | No gradient text on metrics |
| 25 | Numbers without `tabular-nums` | `font-variant-numeric: tabular-nums` |
| 26 | `marginLeft: '16px'` | CSS logical properties (`margin-inline-start`) |
| 27 | 4+ text colors | 2-3 text colors only |
| 28 | 3 font weights mixed | 2 weights: normal + bold |
| 29 | 600 vs 500 weight pairing | Dramatic: 700+400, not 600+500 |
| 30 | `maxWidth: '100%'` on prose | 45-75 chars, `max-w-prose` |
| 31 | Lorem ipsum filler | Real content |
| 32 | Grey text on blue background | Same-hue shade, never grey on color |
| 33 | `<img>` without width/height | Dimensions prevent CLS |
| 34 | "John Doe" / "jane@example.com" | No generic placeholders |
| 35 | `div onClick` for toggle | `<button>` for actions |
| 36 | Three identical primary buttons | 1 primary per page |
| 37 | Verb+noun labels (good) but wrong hierarchy | Fix visual weight |
| 38 | Solid red destructive as primary | Secondary + confirmation |
| 39 | TrashIcon button no `aria-label` | Icon buttons need aria-label |
| 40 | 16px icon button touch target | Min 44px touch target |
| 41 | BellIcon button no `aria-label` | Icon buttons need aria-label |
| 42 | `bounce 1s infinite` | No bounce easing |
| 43 | `transition-all` | List properties explicitly |
| 44 | `z-index: 9999` / `10000` | Semantic z-index scale |
| 45 | Modal for dark mode toggle | No modals for simple actions |
| 46 | Modal missing a11y attributes | `role="dialog"`, focus trap |
| 47 | Direct `box-shadow` animation | Pseudo-element opacity technique |
| 48 | `@font-face` without `font-display: swap` | `font-display: swap` required |
| 49 | Animating `left` in keyframes | Only `transform` + `opacity` |
| 50 | `button:focus` not `button:focus-visible` | `:focus-visible` over `:focus` |
| 51 | `mb-4` on list children | `gap` on parent, not margins |
| 52 | Every item wrapped in card | Not everything needs a card |
| 53 | "Invalid input" error | What + why + how to fix |
| 54 | Error not connected via `aria-describedby` | Connect errors to inputs |
| 55 | "No items found" empty state | 5 elements: what, why, how, visual, help |
| 56 | Console.log debug + TODO comment | No console.log/TODO in production |
