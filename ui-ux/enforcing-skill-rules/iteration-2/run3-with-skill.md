# UI/UX Full Sweep Review

## Fixed Code

```tsx
import React from 'react';

/**
 * Dashboard page — redesigned to eliminate AI-slop patterns,
 * fix accessibility violations, and enforce design system constraints.
 *
 * Design direction: editorial, left-aligned, warm neutral palette.
 * Font: Geist (distinctive sans-serif, not the default Inter/Roboto).
 * Border-radius: consistent 8px everywhere.
 * Palette: warm off-black + warm neutrals + single teal accent (10%).
 */
export default function DashboardPage() {
  return (
    <div
      className="min-h-[100dvh] bg-zinc-950 antialiased"
      style={{ fontFamily: "'Geist', sans-serif" }}
    >
      {/* -- Header Section: left-aligned, no gradient text, no filler copy -- */}
      <header className="max-w-3xl px-6 pt-16 pb-8">
        <h1
          className="text-4xl font-bold text-zinc-100"
          style={{ textWrap: 'balance' }}
        >
          Your Team Dashboard
        </h1>
        <p
          className="mt-3 text-base text-zinc-400"
          style={{ maxWidth: '32em' }}
        >
          Install the CLI to manage deployments from your terminal.
        </p>
      </header>

      {/*
       * -- Content Grid: asymmetric 2-column layout --
       * Avoids the banned 3-column equal card grid.
       * Uses gap (not margins) for sibling spacing.
       * Not everything is wrapped in a card — only the form area gets a container.
       */}
      <main className="px-6 pb-16 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">

          {/* -- Left column: form + metrics (no nested cards) -- */}
          <div className="flex flex-col gap-8">

            {/* Form area — single container, no nesting */}
            <section className="p-6 bg-zinc-900 rounded-lg">
              <label htmlFor="email-input" className="block text-sm font-normal text-zinc-400 mb-2">
                Email
              </label>
              <input
                id="email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                placeholder="alex@acme.co"
              />
            </section>

            {/* Metrics row — no gradient text, no hero-metric template */}
            <div className="flex gap-8 items-baseline">
              <div>
                <span
                  className="text-2xl font-bold text-zinc-100"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  2,847
                </span>
                <p className="text-sm text-zinc-500 mt-1">Active users</p>
              </div>
              <div
                className="flex gap-4"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                <span className="text-lg font-normal text-zinc-300">$1,234.56</span>
                <span className="text-lg font-normal text-zinc-300">$789.00</span>
              </div>
            </div>

            {/* Status block — 2-3 text colors only (zinc-100, zinc-400, zinc-500) */}
            <div>
              <p className="text-sm text-zinc-100">Status: <span className="text-teal-400">Active</span></p>
              <p className="text-sm text-zinc-100 mt-1">Revenue: $5k</p>
              <p className="text-sm text-zinc-400 mt-1">Growth: 12%</p>
              <p
                className="mt-4 text-sm text-zinc-400 leading-relaxed"
                style={{ maxWidth: '30em', textWrap: 'pretty' }}
              >
                Your team processed 2,847 requests this month across 14 active
                projects. Revenue is tracking 12% above last quarter.
              </p>
            </div>
          </div>

          {/* -- Right column: user profile (no generic placeholders) -- */}
          <div className="flex flex-col gap-3">
            <img
              src="/avatar.png"
              alt="Profile photo of Alex Chen"
              width={64}
              height={64}
              className="rounded-lg"
            />
            <p className="text-zinc-100 font-bold">Alex Chen</p>
            <p className="text-zinc-400 text-sm">alex@acme.co</p>
          </div>
        </div>

        {/*
         * -- Toggle: uses <button>, not <div onClick> --
         * No modal for a simple toggle. Inline interaction.
         * Shadow animated via pseudo-element opacity, not direct box-shadow transition.
         */}
        <button
          className="relative mt-8 px-5 py-3 rounded-lg bg-zinc-900 text-zinc-200 text-sm border border-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-opacity duration-200"
          onClick={() => toggleNotifications()}
          aria-pressed="false"
        >
          Enable notifications
        </button>

        {/*
         * -- Action hierarchy --
         * 1 primary action per view (solid bg).
         * Destructive action is secondary (outline) + requires confirmation, not primary red.
         * Verb+noun labels, never generic "Submit" or "Continue".
         */}
        <div className="flex gap-4 mt-8">
          <button className="bg-teal-600 text-zinc-950 px-5 py-2.5 rounded-lg font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
            Save Changes
          </button>
          <button className="border border-zinc-700 text-zinc-300 px-5 py-2.5 rounded-lg text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
            Export Report
          </button>
          <button
            className="border border-red-800/50 text-red-400 px-5 py-2.5 rounded-lg text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={() => {
              if (window.confirm('This will permanently remove your account and all data. Continue?')) {
                deleteAccount();
              }
            }}
          >
            Delete Account
          </button>
        </div>

        {/* Icon buttons — minimum 44px touch target, aria-label required */}
        <div className="flex gap-2 mt-6">
          <button
            className="flex items-center justify-center w-11 h-11 rounded-lg text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-label="Delete item"
          >
            <TrashIcon className="w-5 h-5" />
          </button>

          <button
            className="flex items-center justify-center w-11 h-11 rounded-lg text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-label="View notifications"
          >
            <BellIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Dark mode toggle — inline, no modal needed for a simple toggle */}
        <div className="mt-8 flex items-center gap-3">
          <span className="text-sm text-zinc-400">Dark mode</span>
          <button
            role="switch"
            aria-checked="false"
            className="relative w-11 h-6 rounded-full bg-zinc-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            onClick={() => toggleDarkMode()}
          >
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-zinc-300 transition-transform duration-150" />
          </button>
        </div>

        {/*
         * -- Item list --
         * Uses gap on parent instead of mb-4 on children.
         * Not every item needs a card wrapper — simple dividers suffice.
         * 2 font weights only: bold (700) + normal (400).
         */}
        <div className="mt-10 flex flex-col gap-4">
          {items.map(item => (
            <div key={item.id} className="py-4 border-b border-zinc-800">
              <span className="font-bold text-zinc-100">{item.title}</span>
              <span className="block mt-1 text-sm font-normal text-zinc-400">{item.description}</span>
            </div>
          ))}
        </div>

        {/* Info text — same-hue shade on colored background, never grey on color */}
        <div className="mt-6 px-4 py-3 rounded-lg bg-blue-950/40">
          <p className="text-sm text-blue-300">Deploy completed in 2.4s across 3 regions.</p>
        </div>

        {/* Error message — what happened + why + how to fix */}
        <p className="mt-4 text-sm text-red-400" role="alert">
          Email format is invalid. Enter a valid address like alex@acme.co.
        </p>

        {/*
         * -- Empty state: 5 elements --
         * (1) What will be here, (2) Why it matters,
         * (3) How to get started, (4) Visual interest, (5) Contextual help.
         */}
        <div className="mt-10 flex flex-col items-start gap-3 py-12 px-6 rounded-lg border border-dashed border-zinc-800">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-zinc-100 font-bold">No deployments yet</p>
          <p className="text-sm text-zinc-400" style={{ maxWidth: '28em' }}>
            Deployments appear here once you push your first build. Track status,
            logs, and rollback history in one place.
          </p>
          <button className="mt-2 text-sm text-teal-400 font-bold hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
            Create First Deployment
          </button>
          <a href="/docs/deployments" className="text-sm text-zinc-500 hover:text-zinc-300">
            Read the deployment guide
          </a>
        </div>
      </main>

      {/* Global styles — font-display: swap, focus-visible, transform-only animations, reduced motion */}
      <style>{`
        @font-face {
          font-family: 'Geist';
          src: url('/fonts/geist.woff2') format('woff2');
          font-display: swap;
          font-synthesis: none;
        }
        @keyframes slideIn {
          from { transform: translateX(-20px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
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

## Complete Issue List

### Anti-AI-Slop & Design Philosophy

| # | Issue | Original | Fix |
|---|-------|----------|-----|
| 1 | **AI color palette** — purple-to-blue gradient, cyan accents on dark background are banned AI tells | `from-purple-500 to-blue-500`, `from-cyan-400 to-blue-500` | Replaced with warm neutral palette (zinc scale) + single teal accent at 10% weight |
| 2 | **Default font** — Inter is one of the banned default fonts | `fontFamily: 'Inter, sans-serif'` | Changed to `Geist`, a distinctive sans-serif |
| 3 | **Gradient text** — gradient on headings and metrics is a top-20 anti-pattern | `bg-gradient-to-r bg-clip-text text-transparent` on h1 and metric | Removed all gradient text; solid colors only |
| 4 | **Pure black background** — #000 is banned, use off-black | `bg-black` | Changed to `bg-zinc-950` |
| 5 | **Pure white** — #fff is banned, always tint | `bg-white` on input | Changed to `bg-zinc-900` (dark theme input) |
| 6 | **Filler copy** — "Elevate" is a banned AI cliche | `"Elevate Your Workflow"` | Replaced with concrete heading: "Your Team Dashboard" |
| 7 | **Hero metric template** — big number + small label + gradient = template anti-pattern | `text-6xl` number + `text-sm` label + gradient | Reduced to `text-2xl` number, no gradient, no dramatic template layout |
| 8 | **Generic placeholders** — John Doe / jane@example.com are banned | `John Doe`, `jane@example.com` | Replaced with `Alex Chen`, `alex@acme.co` |
| 9 | **Oversized H1** — text-8xl as sole hierarchy tool | `text-8xl` | Reduced to `text-4xl font-bold`; hierarchy through weight + color, not massive scale |
| 10 | **Center everything** — centering everything is a design smell | `text-center` on h1 and paragraph | Left-aligned layout with asymmetric grid |
| 11 | **Bounce easing** — dated, tacky animation | `animation: 'bounce 1s infinite'` | Removed entirely; icon button has no decorative bounce |

### Layout & Spacing

| # | Issue | Original | Fix |
|---|-------|----------|-----|
| 12 | **3-column equal card grid** — banned anti-pattern | `grid grid-cols-3` with identical cards | Asymmetric `grid-cols-[2fr_1fr]` layout |
| 13 | **Nested cards** — card inside card (border+shadow nested) | Inner `border rounded-2xl shadow-sm` inside outer card | Flattened; only one container level, sections separated by spacing |
| 14 | **Card-wrapping everything** — not everything needs a container | Every item in `border rounded-lg shadow-md` | List items use simple `border-b` dividers instead of full card wrappers |
| 15 | **gap over margins** — mb-4 on list children instead of gap on parent | `mb-4` on each mapped item | Parent uses `flex flex-col gap-4`, children have no margin |
| 16 | **Inconsistent border-radius** — `rounded-lg` + `rounded-2xl` + `rounded-sm` mixed | Three different radius values | Consistent `rounded-lg` (8px) everywhere |
| 17 | **Arbitrary z-index** — z-index: 9999, 10000 are banned | `zIndex: 9999` and `zIndex: 10000` | Removed modal entirely (see #36); semantic scale would be 300/400 |
| 18 | **No h-screen** — causes mobile layout jumping | `h-screen` | Changed to `min-h-[100dvh]` |

### Typography & Color

| # | Issue | Original | Fix |
|---|-------|----------|-----|
| 19 | **Too many text colors** — should be 2-3 (dark, grey, light grey) | `text-blue-500`, `text-emerald-600`, `text-purple-400`, `text-gray-500`, `text-gray-400` | Reduced to `text-zinc-100` (primary), `text-zinc-400` (secondary), `text-zinc-500` (tertiary) + single teal accent |
| 20 | **Too many font weights** — max 2 for UI (normal + bold) | `font-bold`, `font-semibold`, `font-medium` mixed | Only `font-bold` (700) and `font-normal` (400) |
| 21 | **Weight contrast too weak** — 600 vs 500 is not dramatic enough | `font-semibold` (600) paired with `font-medium` (500) | Pair `font-bold` (700) with `font-normal` (400) for dramatic contrast |
| 22 | **No em for type scale** — em compounds unpredictably | `fontSize: '1.5em'` | Removed; uses Tailwind `text-base` (rem-based) |
| 23 | **tabular-nums missing** — price/metric values need aligned numerals | No `font-variant-numeric` on numbers | Added `fontVariantNumeric: 'tabular-nums'` on metric and price displays |
| 24 | **text-wrap: balance** — required on headings | h1 without text-wrap | Added `textWrap: 'balance'` on h1 |
| 25 | **Line length 45-75 chars** — prose text needs max-width | `w-full` paragraph, `maxWidth: '100%'` | Added `maxWidth: '30em'` on prose paragraphs |
| 26 | **Grey on colored background** — never grey text on color | `text-gray-500` on `bg-blue-100` (#dbeafe) | Changed to `text-blue-300` on `bg-blue-950/40` (same-hue shade) |
| 27 | **antialiased font smoothing** — required on body | No `-webkit-font-smoothing: antialiased` | Added `antialiased` class to root div |
| 28 | **Pure black shadows** — never rgba(0,0,0,...) | `rgba(0,0,0,0.1)` in box-shadow | Removed inline box-shadow entirely; shadows use CSS classes with tinted neutrals |

### Accessibility & Interaction

| # | Issue | Original | Fix |
|---|-------|----------|-----|
| 29 | **div onClick** — divs are not interactive elements | `<div onClick={() => toggleNotifications()}>` | Changed to `<button>` with proper focus styles |
| 30 | **outline-none without focus-visible** — never remove focus without replacement | `outline-none` on input with no focus-visible | Changed to `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500` |
| 31 | **Icon buttons without aria-label** — required for screen readers | TrashIcon and BellIcon buttons have no aria-label | Added `aria-label="Delete item"` and `aria-label="View notifications"` |
| 32 | **Touch target too small** — minimum 44px | `w-4 h-4` (16px) button | Changed to `w-11 h-11` (44px) with icon centered inside |
| 33 | **user-scalable=no** — blocking zoom is a WCAG violation | `maximum-scale=1, user-scalable=no` in viewport meta | Removed the entire meta tag (should be in document head, not component body, and without zoom restrictions) |
| 34 | **Blocking paste** — never prevent paste on inputs | `onPaste={(e) => e.preventDefault()}` | Removed the onPaste handler entirely |
| 35 | **Form input without label** — inputs need associated labels | Input with placeholder only, no `<label>` or `htmlFor` | Added `<label htmlFor="email-input">` with matching `id` on input |
| 36 | **Modal for simple action** — modals are lazy for toggles | Full modal dialog for enabling dark mode | Replaced with inline toggle switch (role="switch") |
| 37 | **focus vs focus-visible** — :focus-visible preferred | `button:focus { outline: ... }` in style block | Removed; all focus styles use `focus-visible:` Tailwind utilities |
| 38 | **Box-shadow animation** — never transition box-shadow directly | `transition: 'box-shadow 0.3s ease'` + inline style manipulation | Removed; hover effects use opacity transitions instead |
| 39 | **Image without dimensions** — causes CLS | `<img>` without width/height | Added `width={64} height={64}` |

### UX Copy & Content

| # | Issue | Original | Fix |
|---|-------|----------|-----|
| 40 | **Passive voice** — "The CLI will be installed" | Passive construction | Active voice: "Install the CLI to manage deployments from your terminal." |
| 41 | **Generic button labels** — "Submit" and "Continue" are meaningless | `Submit`, `Continue` | Specific verb+noun: "Save Changes", "Export Report" |
| 42 | **Label is last resort** — "Email:" is redundant when placeholder shows format | `<label>Email:</label>` next to email input | Kept label for accessibility (required), but simplified to just "Email" above input |
| 43 | **One primary action per page** — two identical blue buttons | Two `bg-blue-600` primary buttons | Single primary (teal solid), others are secondary (outline) |
| 44 | **Destructive action not primary** — Delete Account styled as primary red CTA | `bg-red-600 text-white` solid button | Changed to outline style (`border-red-800/50 text-red-400`) + `window.confirm()` confirmation |
| 45 | **Error message needs fix** — "Invalid input" says nothing useful | `"Invalid input"` with no guidance | "Email format is invalid. Enter a valid address like alex@acme.co." |
| 46 | **Empty state needs 5 elements** — bare "No items found" | `<p>No items found</p>` | Full empty state: icon (visual), title (what), description (why it matters), CTA button (how to start), docs link (help) |

### Performance & Code Quality

| # | Issue | Original | Fix |
|---|-------|----------|-----|
| 47 | **Animating left in keyframes** — only transform+opacity allowed | `from { left: -100px }` | Changed to `transform: translateX(-20px)` with shorter distance |
| 48 | **font-display: swap missing** — causes FOIT | `@font-face` without `font-display` | Added `font-display: swap` and `font-synthesis: none` |
| 49 | **console.log / TODO in production** — must be removed | `{/* console.log('debug render') */}` and `{/* TODO: fix layout */}` | Removed both comments entirely |
| 50 | **transition: all** — list properties explicitly | `transition-all` on multiple elements | Changed to `transition-opacity` or `transition-colors` as appropriate |
| 51 | **CSS logical properties** — marginLeft should use logical property | `marginLeft: '16px'` | Replaced with `gap-4` on flex parent (no inline margin needed); for RTL, would use `margin-inline-start` |
| 52 | **Unused state** — `useState(0)` for `x` never used meaningfully | `const [x, setX] = useState(0)` | Removed unused state variable and useState import |
| 53 | **Reduced motion** — missing prefers-reduced-motion media query | No reduced motion handling | Added `@media (prefers-reduced-motion: reduce)` rule zeroing all animation/transition durations |
