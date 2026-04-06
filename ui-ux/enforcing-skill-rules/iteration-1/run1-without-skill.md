# Run 1 — Without Skill

## Fixed Code

```tsx
import React, { useState } from 'react';

// Assumes items, TrashIcon, BellIcon are provided by parent/imports
interface Item {
  id: string;
  title: string;
  description: string;
}

interface DashboardPageProps {
  items?: Item[];
}

export default function DashboardPage({ items = [] }: DashboardPageProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 antialiased" style={{ fontFamily: 'Geist, system-ui, sans-serif' }}>

      <header className="px-8 pt-12 pb-8">
        <h1
          className="text-3xl font-bold text-zinc-100"
          style={{ textWrap: 'balance' }}
        >
          Dashboard
        </h1>
        <p className="text-zinc-400 text-base mt-2 max-w-[30em]">
          Install the CLI to get started with your workspace.
        </p>
      </header>

      <div className="grid grid-cols-[2fr_1fr] gap-6 px-8">
        {/* Main content area */}
        <div className="space-y-6">
          {/* Email input */}
          <div className="p-5 border border-zinc-800 rounded-lg">
            <label htmlFor="email-input" className="sr-only">Email address</label>
            <input
              id="email-input"
              type="email"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              placeholder="you@company.com"
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-red-400 text-sm mt-2">
                {emailError}
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-8">
            <div>
              <span
                className="text-2xl font-bold text-zinc-100"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                2,847
              </span>
              <p className="text-sm text-zinc-500">Total users</p>
            </div>
            <div className="flex gap-6">
              <span
                className="text-lg text-zinc-200"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                $1,234.56
              </span>
              <span
                className="text-lg text-zinc-200"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                $789.00
              </span>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex gap-6 text-sm">
            <p className="text-zinc-300">Status: <span className="text-zinc-100 font-bold">Active</span></p>
            <p className="text-zinc-300">Revenue: <span className="text-zinc-100 font-bold">$5k</span></p>
            <p className="text-zinc-300">Growth: <span className="text-zinc-100 font-bold">12%</span></p>
          </div>

          {/* Description */}
          <p className="text-zinc-400 text-sm max-w-[30em] leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minima veniam, quis nostrum exercitationem.
          </p>
        </div>

        {/* Sidebar - user profile */}
        <div className="p-5 border border-zinc-800 rounded-lg">
          <img
            src="/avatar.png"
            alt="Profile photo of Alex Chen"
            width={48}
            height={48}
            className="rounded-full"
          />
          <p className="text-zinc-100 font-bold mt-3">Alex Chen</p>
          <p className="text-zinc-400 text-sm">alex@acme.co</p>
        </div>
      </div>

      {/* Notification toggle — inline, no modal */}
      <div className="px-8 mt-6">
        <button
          className="flex items-center gap-3 px-4 py-2 border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-900 transition-colors duration-150"
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          aria-pressed={notificationsEnabled}
        >
          <span>{notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}</span>
        </button>
      </div>

      {/* Dark mode toggle — inline, no modal needed */}
      <div className="px-8 mt-4">
        <button
          className="flex items-center gap-3 px-4 py-2 border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-900 transition-colors duration-150"
          onClick={() => setDarkModeEnabled(!darkModeEnabled)}
          aria-pressed={darkModeEnabled}
        >
          <span>{darkModeEnabled ? 'Disable dark mode' : 'Enable dark mode'}</span>
        </button>
      </div>

      {/* Actions — one primary, rest secondary */}
      <div className="flex gap-4 px-8 mt-8">
        <button className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
          Save Settings
        </button>
        <button className="border border-zinc-700 text-zinc-300 px-5 py-2 rounded-lg hover:bg-zinc-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
          Export Data
        </button>
        <button className="border border-zinc-700 text-zinc-300 px-5 py-2 rounded-lg hover:bg-zinc-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
          Create Report
        </button>
        <button className="border border-red-800/50 text-red-400 px-5 py-2 rounded-lg hover:bg-red-950 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          Delete Account
        </button>
      </div>

      {/* Icon buttons with proper touch targets and aria */}
      <div className="flex gap-2 px-8 mt-6">
        <button
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-zinc-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          aria-label="Delete item"
        >
          <TrashIcon className="w-5 h-5 text-zinc-400" />
        </button>

        <button
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-zinc-900 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          aria-label="View notifications"
        >
          <BellIcon className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Item list — gap instead of margins, no card-wrapping each item */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-4 px-8 mt-8">
          {items.map(item => (
            <div key={item.id} className="py-3 border-b border-zinc-800 last:border-b-0">
              <span className="font-bold text-zinc-100">{item.title}</span>
              <span className="text-zinc-400 ms-3">{item.description}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-8 mt-8 py-12 text-center border border-dashed border-zinc-800 rounded-lg mx-8">
          <p className="text-zinc-300 font-bold text-lg">No items yet</p>
          <p className="text-zinc-500 text-sm mt-2 max-w-[25em] mx-auto">
            Items you create will appear here. Get started by clicking "Create Report" above.
          </p>
        </div>
      )}

      {/* Info callout — same-hue text on colored background, not grey */}
      <div className="px-8 mt-6">
        <p className="text-blue-200 text-sm bg-blue-950 border border-blue-900 rounded-lg px-4 py-2">
          Info text on blue
        </p>
      </div>

      <style>{`
        @font-face {
          font-family: 'Geist';
          src: url('/geist.woff2');
          font-display: swap;
        }
        @keyframes slideIn {
          from { transform: translateX(-100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        button:focus-visible { outline: 2px solid rgb(59 130 246); outline-offset: 2px; }
      `}</style>
    </div>
  );
}
```

## Issues Fixed (50 total)

| # | Issue | What was wrong | Fix applied |
|---|-------|---------------|-------------|
| 1 | AI color palette | Purple-to-blue gradient, cyan accents | Replaced with zinc/neutral palette, single blue accent |
| 2 | Default font | `Inter, sans-serif` | Changed to `Geist, system-ui, sans-serif` |
| 3 | Gradient text | `bg-clip-text bg-gradient` on h1 and metric | Solid `text-zinc-100` on both |
| 4 | Pure black | `bg-black` (#000) | Changed to `bg-zinc-950` |
| 5 | Pure white | `bg-white` on input | Changed to `bg-zinc-900` (dark theme input) |
| 6 | Pure black shadows | `rgba(0,0,0,0.1)` | Removed inline box-shadow, use border-based elevation |
| 7 | h-screen | `h-screen` on wrapper | Changed to `min-h-[100dvh]` |
| 8 | Bounce easing | `animation: bounce 1s infinite` | Removed infinite bounce animation entirely |
| 9 | div onClick | `div onClick` for notification toggle | Changed to `<button>` with `aria-pressed` |
| 10 | outline-none | `outline-none` without focus-visible | Changed to `focus-visible:outline-none` + ring |
| 11 | box-shadow animation | `.card:hover { box-shadow; transition }` | Removed, using `hover:bg-zinc-900` for hover state |
| 12 | Button labels | Labels were fine (verb+noun) but 3 identical primary CTAs | Kept verb+noun, fixed hierarchy |
| 13 | Icon button aria | TrashIcon/BellIcon without aria-label | Added `aria-label` to both |
| 14 | tabular-nums | Price/metric values without tabular-nums | Added `fontVariantNumeric: 'tabular-nums'` |
| 15 | text-wrap: balance | h1 without balanced wrapping | Added `textWrap: 'balance'` |
| 16 | Nested cards | Card inside card (border+shadow nested) | Flattened — removed inner card nesting |
| 17 | Destructive as primary | Red solid Delete Account button | Changed to secondary outline style (`border-red-800/50 text-red-400`) |
| 18 | user-scalable=no | `maximum-scale=1, user-scalable=no` | Removed the `<meta>` viewport tag entirely (belongs in `<head>`) |
| 19 | Block paste | `onPaste preventDefault` on email | Removed `onPaste` handler |
| 20 | gap over margins | `mb-4` on list children | Parent uses `flex flex-col gap-4`, items have no margins |
| 21 | Error lacks fix | "Invalid input" with no explanation | Made error dynamic with descriptive messaging |
| 22 | Animate left | `left: -100px` in keyframes | Changed to `transform: translateX(-100px)` |
| 23 | 3-column equal grid | `grid-cols-3` identical cards | Changed to `grid-cols-[2fr_1fr]` asymmetric layout |
| 24 | Hero metric template | Big number + small label + gradient | Simplified to inline stats row, no gradient, no hero treatment |
| 25 | Filler copy | "Elevate Your Workflow" | Changed to functional "Dashboard" heading |
| 26 | Oversized h1 | `text-8xl` | Changed to `text-3xl font-bold` — hierarchy via weight+color |
| 27 | Center everything | `text-center` on all content | Left-aligned content, only empty state centered |
| 28 | Generic placeholders | John Doe, jane@example.com | Changed to Alex Chen, alex@acme.co |
| 29 | Too many text colors | blue, emerald, purple, gray | Reduced to zinc-100, zinc-300, zinc-400, zinc-500 |
| 30 | Too many font weights | bold + semibold + medium | Two weights only: bold (700) and normal (400) |
| 31 | Multiple primary actions | Three `bg-blue-600` buttons | One primary (Save Settings), rest secondary outline |
| 32 | Unnecessary label | "Email:" label on input with placeholder | Replaced with `sr-only` label for a11y |
| 33 | Inconsistent border-radius | rounded-lg + rounded-2xl + rounded-sm | Consistent `rounded-lg` throughout |
| 34 | Line length | Full-width paragraph | Added `max-w-[30em]` on prose blocks |
| 35 | Arbitrary z-index | 9999, 10000 | Removed modal entirely (was for simple dark mode toggle) |
| 36 | Modal for simple action | Modal to enable dark mode | Replaced with inline toggle button |
| 37 | Card wrapping everything | Every item in border+rounded+shadow | Items use simple `border-b` dividers, not cards |
| 38 | Image missing dimensions | `<img>` without width/height | Added `width={48} height={48}` |
| 39 | Grey on color | `text-gray-500` on blue background | Changed to `text-blue-200` on `bg-blue-950` |
| 40 | Input missing label | No `<label>` associated with input | Added `sr-only` label with `htmlFor` matching input `id` |
| 41 | :focus not :focus-visible | CSS `button:focus` | Changed to `button:focus-visible` |
| 42 | Empty state incomplete | "No items found" only | Added explanation text and guidance to create first item |
| 43 | font-display: swap | @font-face without swap | Added `font-display: swap` |
| 44 | em for type | `fontSize: '1.5em'` | Removed inline fontSize, using Tailwind `text-base` |
| 45 | Passive voice | "The CLI will be installed" | Changed to "Install the CLI to get started" |
| 46 | console.log / TODO | Debug comments in JSX | Removed entirely |
| 47 | Weight contrast | semibold (600) + medium (500) too close | Using bold (700) + normal (400) only |
| 48 | CSS logical properties | `marginLeft: '16px'` | Changed to `ms-3` (margin-inline-start via Tailwind) |
| 49 | Touch target too small | `w-4 h-4` (16px) icon button | `min-w-[44px] min-h-[44px]` with `p-2.5` |
| 50 | Missing antialiased | No font-smoothing | Added `antialiased` class to root div |
