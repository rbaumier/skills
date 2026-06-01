---
name: ui-ux
description: >
  Comprehensive UI/UX mega-skill: design systems, visual hierarchy, spacing, color, typography,
  depth, shadows, layout, accessibility WCAG, mobile design, responsive, dark mode theming,
  anti-AI-slop design philosophy (3-dial system, 100 AI tells), interface review & audit
  (technical + design critique + polish), refinement toolkit (simplify, tone down, clarify,
  align, harden, adapt, optimize), enhancement dimensions (visual impact, color strategy,
  delight, onboarding), creative arsenal (hero paradigms, navigation, layouts, cards, bento),
  design thinking, UX writing, interaction design, Laws of UX, release readiness.
---

# UI/UX

Design, review, refine, and enhance user interfaces.

Match your need below, then read the linked file.

| Need | Read |
|------|------|
| Anti-AI-slop checks, 3-dial system, top 20 anti-patterns, design personality | [design-philosophy.md](design-philosophy.md) |
| Visual hierarchy, Laws of UX, spacing, typography, color, shadows, tokens | [design-principles.md](design-principles.md) |
| Visual impact, color strategy, delight, onboarding, simplify, tone down, harden, responsive | [enhancement-and-refinement.md](enhancement-and-refinement.md) |
| 4-phase audit workflow: anti-patterns, technical, design critique, polish checklist | [review-audit.md](review-audit.md) |
| Accessibility, forms, touch, code/design smells, performance guardrails, mobile, i18n | [accessibility-and-interaction.md](accessibility-and-interaction.md) |
| Hero paradigms, navigation, layouts, cards, bento, micro-interactions, project setup | [creative-arsenal.md](creative-arsenal.md) |

## View State Completeness

Every view that fetches data must design for three states beyond the happy path. These are not edge cases -- they are the first states users see. Design them before the populated state. In reviews: if a component only handles the "data loaded" state, flag the missing states.

**Loading**: skeleton screens over spinners. Skeletons mirror the layout of the content being loaded, reducing perceived load time by ~30%. Use CSS `background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;`. In reviews: if a loading state shows a centered spinner instead of a skeleton matching the expected content layout, flag it.

**Empty**: guide users to action. Never show a blank page or "No data found". Empty states need: (1) an illustration or icon explaining the state, (2) a clear message explaining WHY it's empty, (3) a primary CTA button for the next logical action (e.g., "Create your first project"). Design empty states as onboarding opportunities.

**Error**: recovery paths, not just messages. Every error state must include: (1) what went wrong (plain language, not error codes), (2) why it happened (if known), (3) how to fix it (specific action), (4) a retry button if the error might be transient. Never show raw error messages or stack traces.

## Accessibility Essentials

**Touch targets**: minimum 44x44px (WCAG) / 48x48dp (Material). Add padding/margin if the visual element is smaller. Space interactive elements at least 8px apart. In reviews: if a clickable icon or link is visually smaller than 44px without adequate padding, flag it.

**Focus management for modals**: (1) trap focus inside (Tab cycles within modal only), (2) move focus to the first interactive element or close button, (3) on close: return focus to the triggering element. Use `aria-modal="true"` and `role="dialog"`. Prevent background scroll with `overflow: hidden` on body.

**Form validation UX**: show errors inline next to the field, not in a toast or summary. Validate on blur (when user leaves field), not on every keystroke or only on submit. Use `aria-describedby` to connect error messages to inputs. Preserve user input on error -- never clear the form.

## Pre-Output Checklist (DO NOT SKIP)

Before returning ANY UI code, walk this list top to bottom and fix every hit. These are the most-missed rules and they live HERE, in the body, on purpose -- do not assume a reference file covers it. Each item gives the exact trigger and the exact fix.

**View states (render ALL THREE -- the #1 regression; ADD them even if the starting code only has the populated branch)**

Any component that displays fetched/list data MUST render loading, empty, AND error branches as real JSX -- not comments, not "framework ready" notes. If the input only renders the populated state, you ADD the missing branches. Introduce an `isLoading` / `error` state (or props) if none exists. Concrete shape to emit:

```tsx
if (isLoading) {
  // Skeleton MIRRORS the populated layout (same card count/shape), never a centered spinner.
  return (
    <div className="grid grid-cols-[2fr_1fr] gap-6" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/10 p-5">
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton mt-3 h-3 w-full rounded" />
        </div>
      ))}
      <style>{`.skeleton{background:linear-gradient(90deg,#1f2937 25%,#374151 50%,#1f2937 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}@keyframes shimmer{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.skeleton{animation:none}}`}</style>
    </div>
  );
}

if (error) {
  // Real error UI: what + why + how-to-fix + retry. Never a raw message or a // comment.
  return (
    <div className="rounded-xl border border-white/10 p-8">
      <h2 className="text-lg font-bold text-zinc-100">Couldn't load projects</h2>
      <p className="mt-1 text-zinc-400">The server didn't respond. Check your connection and try again.</p>
      <button onClick={retry} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white active:scale-[0.98]">Retry</button>
    </div>
  );
}

if (filtered.length === 0) {
  // Empty = onboarding. LEFT-ALIGNED inside a contained panel, NOT a bare text-center afterthought.
  return (
    <div className="rounded-xl border border-white/10 p-8 max-w-md">
      <FolderOpen aria-hidden="true" className="h-10 w-10 text-zinc-500" />
      <h2 className="mt-4 text-lg font-bold text-zinc-100">No projects yet</h2>
      <p className="mt-1 text-zinc-400">Projects you create will show up here.</p>
      <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white active:scale-[0.98]">Create your first project</button>
    </div>
  );
}
```

- [ ] **Loading state exists and is a layout-matching skeleton.** A view that only renders populated + empty FAILS. Emit the `isLoading` skeleton branch above. A centered `<Spinner/>` does not count -- the skeleton must mirror the real layout.
- [ ] **Error state is real UI, not a comment.** A `// error framework ready` note FAILS. Render the `error` branch above: what went wrong (plain language), why, how to fix, and a working retry button.
- [ ] **Empty state is contained and left-aligned, not a centered afterthought.** A bare `<div className="text-center py-16">No data</div>` FAILS even with a CTA. Put it in a bordered/contained panel, left-align the text, and include icon + why-message + primary CTA as shown above.

**Typography**
- [ ] **No Inter / Roboto / Open Sans / system-ui as the brand font.** Inter is the #1 AI tell. Replace `fontFamily: 'Inter, ...'` with `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi` (still keep `system-ui, sans-serif` as fallback). Banned for premium/creative work.
- [ ] **Max 2 font weights total, and they must be 400 + 700.** Count every `font-*` class. `font-semibold` (600) + `font-bold` (700) + `font-medium` (500) = 3 weights = FAIL. Pick exactly `font-normal` (400) and `font-bold` (700) -- a dramatic 300-point gap. Never pair adjacent weights like 600+500 (only 100 apart; invisible contrast).
- [ ] **Hierarchy = weight + color + space, not size alone.** Making every heading `font-bold text-zinc-100` and only changing `text-3xl` -> `text-lg` FAILS -- that is size-only. Each level must differ on at least TWO of {size, weight, color}. Within the 400/700 weight budget, downshift sub-headings to the body weight and a dimmer color:
  ```tsx
  <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">Your Workspace</h2>
  <h3 className="text-lg font-normal uppercase tracking-wide text-zinc-400">Activity</h3>
  ```
  Here the h3 is smaller AND lighter weight AND a dimmer color than the h2 -- three signals, not one.
- [ ] **`text-wrap: balance` on every heading** (h1/h2/h3) to kill orphans. Tailwind: `text-balance`. Use `text-pretty` on body paragraphs.
- [ ] **`tabular-nums` on every number that changes** (percentages, counts, prices, timers) so layout doesn't shift. Tailwind: `tabular-nums`. The `{progress}%` readout needs it.

**Color**
- [ ] **Max 1 accent color, saturation < 80%.** Two saturated accents (e.g. `indigo` for actions + `emerald` for status) is a tell. Keep one accent; render secondary/status meaning with neutral tints or a muted/desaturated semantic color, not a second vivid hue.
- [ ] **COUNT your distinct text-color classes; MAX 3 (foreground, muted-foreground, +1).** Before returning, list every distinct `text-zinc-*` / `text-gray-*` shade you actually emitted across the WHOLE file (header, cards, AND the activity/recent feed -- that buried `text-zinc-200` on a feed `<p>` is the usual 4th). The allowed three roles, one shade each: primary `text-zinc-100`, secondary `text-zinc-400`, tertiary/muted `text-zinc-500`. A 4th distinct shade = FAIL -- supprime-la: map `text-zinc-200`/`text-zinc-300` -> `text-zinc-100`, `text-zinc-600` -> `text-zinc-500`. (Accent link color like `text-indigo-400` and white/red status text are exempt from this count.) Concrete trap from a real failure: the populated cards used `text-zinc-100/400/500` (3, fine) but the activity feed used `<p className="text-sm text-zinc-200">` -- that single parasite shade made it 4 = FAIL. Self-report "exactly 3 colors" only AFTER you have grepped and the count is literally 3.
- [ ] **Borders use alpha tokens, not hardcoded shades.** Replace `border-zinc-800` / `border-zinc-700` with `border-white/10` (dark) or `border-black/10` (light) so they adapt across themes.
- [ ] **Status must not rely on color alone** (WCAG 1.4.1). A green/emerald "active" badge needs an icon, shape, or text difference in addition to the color.

**Shadows & motion (the box-shadow trap)**
- [ ] **Never `transition: box-shadow` or `transition-shadow` or `transition-all` on a hover-shadow.** Animating box-shadow forces expensive repaints. Put the larger shadow on a `::after` pseudo-element at `opacity: 0` and animate the pseudo-element's `opacity` on hover instead.
- [ ] **Never pure-black shadows.** No `rgba(0,0,0,...)`. Tint to the surface hue, e.g. `rgba(17,24,39,0.3)`.
- [ ] **Never the generic `ease` keyword.** Use a deliberate curve: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for entrances. No bounce/elastic easing.
- [ ] **One global `prefers-reduced-motion` guard must cover EVERY transition/animation you render -- not just the skeleton.** The skeleton's local `@media(prefers-reduced-motion:reduce){.skeleton{animation:none}}` does NOT satisfy this: it only fires in the loading branch and only kills the shimmer. Your populated UI still ships `transition-colors`, `active:scale-[0.98]` + `transition-transform`, and `transition-all` (e.g. the progress bar) -- all unguarded = FAIL. Emit ONE always-rendered global block that neutralizes them wherever they live. Drop this `<style>` at the top level of the component (outside the loading/error/empty conditionals so it renders in every state):
  ```tsx
  <style>{`@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important;scroll-behavior:auto!important}}`}</style>
  ```
  Checklist before returning: every class among `transition-colors`, `transition-transform`, `transition-all`, `transition-opacity`, `active:scale-*`, `animate-*` is covered by this universal `*` guard. If the only `prefers-reduced-motion` in the file sits inside the skeleton's `<style>`, you have NOT done this -- add the global block above. Not optional.

**Interaction & a11y**
- [ ] **Every input has an associated label -- a placeholder is NOT a label.** A search box with only `placeholder="Search..."` FAILS. Either wrap a visible `<label>` or attach a hidden one. Associate it explicitly:
  ```tsx
  <label htmlFor="project-search" className="sr-only">Search projects</label>
  <input id="project-search" type="search" placeholder="Search projects..." />
  ```
  An `aria-label="Search projects"` on the input is also acceptable, but one of the two MUST be present on every text/search/select/checkbox input.
- [ ] **`outline-none` requires a `:focus-visible` replacement.** Use `focus-visible:ring-2 focus-visible:ring-offset-2` -- the `focus-visible:` variant (not `focus:`), and a real ring (not a border-color change). A `focus:border-*` swap does NOT count.
- [ ] **Tactile `:active` feedback on buttons.** Add `active:scale-[0.98]` or `active:-translate-y-[1px]`. Color-only `active:bg-*` does not count as tactile.
- [ ] **Every decorative icon gets `aria-hidden="true"`** -- including the search-input icon, not just feed icons. `pointer-events-none` is layout, not accessibility; it does NOT replace `aria-hidden`. (Error/loading/empty: see the View states block at the top of this checklist.)

**Layout & spacing**
- [ ] **No 3-column equal card grid.** `grid grid-cols-3 gap-4` of identical cards is the classic AI grid. Use `grid-cols-[2fr_1fr]` asymmetry, a 2-col zig-zag, or `auto-fit minmax()`.
- [ ] **No centered hero/H1** at DESIGN_VARIANCE >= 4 (default 8). Left-align headings; avoid `mx-auto text-center` on hero blocks.
- [ ] **Concentric border radius.** Inner radius = outer radius - padding. A `rounded-xl` (12px) card holding `rounded-lg` (8px) items with `p-5` is wrong; same-level elements share one radius.
- [ ] **No cards nested inside cards.** Activity items wrapped in `bg-*/50 rounded-lg` inside an already-bordered `section` is double-nesting. Flatten with `divide-y` + spacing instead.
- [ ] **Deliberate spacing scale.** Don't sprinkle arbitrary `gap-3`/`gap-4`/`mb-3`/`mb-4`/`mb-6`/`mb-8`. Pick a rhythm (e.g. 4 / 8 / 16 / 32) and apply it consistently.

**Content (the "John Doe" effect)**
- [ ] **No generic placeholder names.** "John Doe", "Sarah Chen", "Jane Doe", "Jack Su" are AI tells. Invent distinctive, contextual names (e.g. "Mara Okonkwo", "Devin Asato").
- [ ] **No filler words.** Strip "seamlessly", "elevate", "unleash", "next-gen". A subtitle that just restates the heading ("Manage and track all your projects seamlessly in one place") is redundant -- cut it or replace with concrete value.
- [ ] **No generic link/button labels.** "Learn More" says nothing. Use verb+noun: "View details", "Open project".

## Reference Files

| File | Scope |
|------|-------|
| [references/typography.md](references/typography.md) | Type scales, pairing, loading, OpenType, variable fonts, fluid type |
| [references/color-and-contrast.md](references/color-and-contrast.md) | OKLCH, palettes, 60-30-10, dark mode, contrast, tinted neutrals |
| [references/spatial-design.md](references/spatial-design.md) | Spacing systems, grids, container queries, concentric radius |
| [references/shadows.md](references/shadows.md) | Layered shadows, elevation scale, animation technique |
| [references/css-techniques.md](references/css-techniques.md) | Pseudo-elements, View Transitions API |
| [references/motion-design.md](references/motion-design.md) | Duration/easing rules, reduced motion, perceived performance |
| [references/interaction-design.md](references/interaction-design.md) | 8 interactive states, focus rings, forms, modals, keyboard nav |
| [references/responsive-design.md](references/responsive-design.md) | Mobile-first, fluid design, container queries, safe areas |
| [references/ux-writing.md](references/ux-writing.md) | Button labels, error messages, empty states, voice/tone |
| [references/anti-ai-slop.md](references/anti-ai-slop.md) | 3-dial definitions, 100 AI Tells, design engineering directives |
| [references/advanced-browser-apis.md](references/advanced-browser-apis.md) | View Transitions morphing, `@starting-style`, scroll-driven animations, `@property`, spring physics, virtual scrolling |
| [references/creative-arsenal.md](references/creative-arsenal.md) | Hero paradigms, navigation, layouts, cards, bento, micro-interactions |