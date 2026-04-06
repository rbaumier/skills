---
name: frontend
description: "Build UI components, pages, dashboards, 3D scenes. Trigger on 'component', 'page', 'layout', 'design system', 'responsive', 'forms', 'server component'."
---

## Context Gathering Protocol

Design work produces generic output without project context. Before any UI implementation, you MUST have answers to these blocking questions:

1. **Target audience** — Who uses this product and in what context? (e.g. "B2B SaaS admins on desktop" vs "teens on mobile")
2. **Use cases** — What jobs are they trying to get done?
3. **Brand personality/tone** — How should the interface feel? (e.g. "playful and casual" vs "enterprise and serious")

**Where to find answers** (in order):
1. Check loaded instructions for a **Design Context** section — if present, proceed
2. Check `.impeccable.md` at project root — if it has the context, proceed
3. If neither has it: ASK the user before writing any UI code. You cannot infer audience/tone from code — code tells you *what* was built, not *who it's for*

## The AI Slop Test

Before shipping any UI, run this checklist. If 3+ items are true, the design looks AI-generated:

- [ ] Uses cyan-on-dark, purple-to-blue gradients, or neon accents on dark backgrounds
- [ ] Identical card grids with icon + heading + text, repeated endlessly
- [ ] Gradient text on headings or metrics for "impact"
- [ ] Glassmorphism everywhere (blur effects, glass cards, glow borders)
- [ ] Everything centered, no asymmetry
- [ ] Big number + small label hero metric layout
- [ ] Uses Inter/Roboto/system defaults — no typographic personality
- [ ] Pure black (#000) or pure white (#fff) — never tinted
- [ ] Same spacing everywhere — no visual rhythm
- [ ] Cards nested inside cards

**The test**: If someone saw this UI and said "AI made this", would they be right? A distinctive interface makes someone ask "how was this made?" not "which AI made this?"

## Gotchas
- `"use client"` only for hooks/event handlers/browser APIs — over-marking kills SSR
- `useEffect` for derived state = anti-pattern. Compute inline during render, never sync with effects
- `key={index}` dynamic lists = silent bugs on reorder/delete. Stable IDs only
- Next.js `fetch()` Server Components caches by default prod. `{ cache: 'no-store' }` or `revalidate`
- Importing server component into client component silently becomes client-side. Client-into-server fine, reverse NOT

## Rules

### Component Architecture

**File colocation** — keep everything related to a component together:
```
src/components/
  TaskList/
    TaskList.tsx          # Component implementation
    TaskList.test.tsx     # Tests
    TaskList.stories.tsx  # Storybook stories (if using)
    use-task-list.ts      # Custom hook (if complex state)
    types.ts              # Component-specific types
```

- Composition (Card+CardHeader) not boolean props (each doubles states)
- Compound components (Context+Provider) for sibling shared state. Never prop-drill
- Variant prop with defined values, not boolean modes (isPrimary, isGhost...)
- Children over renderX props. Render props ONLY when passing data back
- File order: types -> hooks -> useMemo -> useCallback -> render -> default export
- Context: state+actions+meta; provider only place knowing state impl. Lift state into provider for sibling access
- Controlled/uncontrolled via slot pattern. Semantic props (isLoading not loading), sensible defaults
- className/style overrides. Error Boundaries with retry
- Components over 200 lines must be split. Each component does one thing.
- **Design-to-code translation: extract intent before pixels** -- when implementing from Figma/design, extract in order: 1) Purpose (what should the user understand/do first?), 2) Visual hierarchy (primary/secondary/tertiary), 3) Stretch behavior (what grows, what's fixed), 4) States (loading/error/empty/disabled), 5) Edge cases (long text, 0 items, slow network). Never copy px values -- translate to scale/ratios/constraints. Fixed values are exceptions that need justification.

**Composition over configuration** — props create exponential state space, children are linear:
```tsx
// Good: Composable — each piece is independent
<Card>
  <CardHeader>
    <CardTitle>Tasks</CardTitle>
  </CardHeader>
  <CardBody>
    <TaskList tasks={tasks} />
  </CardBody>
</Card>

// Bad: Over-configured — title+headerVariant+bodyPadding = 8 combinations to test
<Card
  title="Tasks"
  headerVariant="large"
  bodyPadding="md"
  content={<TaskList tasks={tasks} />}
/>
```

**Separate data fetching from presentation** — container handles data/states, presentational component is pure rendering:
```tsx
// Container: owns data, loading, error, empty states
export function TaskListContainer() {
  const { tasks, isLoading, error, refetch } = useTasks();
  if (isLoading) return <TaskListSkeleton />;
  if (error) return <ErrorState message="Failed to load tasks" retry={refetch} />;
  if (tasks.length === 0) return <EmptyState message="No tasks yet" />;
  return <TaskList tasks={tasks} />;
}

// Presentational: pure rendering, easily testable, reusable
export function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul role="list" className="divide-y">
      {tasks.map(task => <TaskItem key={task.id} task={task} />)}
    </ul>
  );
}
```

### Forms

**Controlled vs uncontrolled** — use uncontrolled (refs, FormData) for simple submit-only forms. Use controlled (useState) when you need: real-time validation, conditional fields, or derived values.

**Validation UX rules**:
- Validate on blur (not on every keystroke) for fields the user hasn't submitted yet
- Validate on change AFTER the first blur or submission attempt
- Show field-level errors inline next to the field, not in a toast
- Server validates regardless of client — client validation is UX, not security

**Form patterns with useActionState + progressive enhancement** -- forms should work without JS via standard form submission, then enhance with `useActionState` for inline validation and optimistic UI. Always: `<form action={formAction}>` not `onSubmit`. Server validates regardless of client. Display field-level errors from server response. Reset form state on success.

### React 19 + Server Components
- `useActionState` forms, `useOptimistic` optimistic UI, `use()` promises/context; ref is regular prop (no forwardRef)
- React Compiler auto-memoizes; less manual useMemo/useCallback
- Prefer server components; `"use client"` only for interactivity/browser APIs
- Minimize RSC boundary serialization, pass only needed fields

### State Management
- local: useState/useReducer. feature-shared: Context+Reducer. server: TanStack Query/SWR. global: Zustand/Jotai
- URL state (searchParams) for filters, pagination, shareable UI state — don't put shareable state in useState
- Zustand: ALWAYS `useStore(s => s.count)`, NEVER destructure full store — unnecessary re-renders
- Suspense-first: `useSuspenseQuery` + `<Suspense fallback={<Skeleton/>}>`. NOT isLoading early returns
- Never `if (isLoading) return <Spinner/>` — use `if (loading && !data)` to avoid flash when data exists
- No inline fetch; isolate in feature `api/` layer. All responses typed
- Avoid prop drilling deeper than 3 levels — introduce context or restructure the component tree

### UX Patterns
- Error hierarchy: inline (field) > toast (recoverable) > banner (partial) > full screen (fatal)
- Disable buttons + loading indicator during async submission. Every list needs empty state
- Skeleton loading for content areas, spinners only for actions. Use `aria-busy="true"` on loading regions

### Accessibility

**Semantic HTML landmarks first, ARIA second** -- use `<main>` (once), `<header>`, `<footer>`, `<nav>`, `<aside>` for page landmarks. `<article>` for self-contained content, `<section>` for thematic groups with heading. `<figure>`/`<figcaption>` for media. Heading levels (`h1`-`h6`) must never skip levels. ARIA roles only when no semantic HTML equivalent exists.

**Keyboard navigation** — every interactive element must work with keyboard:
```tsx
<button onClick={handleClick}>Click me</button>        // Focusable by default
<div onClick={handleClick}>Click me</div>               // NOT focusable — never do this
// If you must use a non-semantic element (you rarely must):
<div role="button" tabIndex={0} onClick={handleClick}
     onKeyDown={e => e.key === 'Enter' && handleClick()}>
```

**ARIA labels** — label interactive elements that lack visible text:
```tsx
<button aria-label="Close dialog"><XIcon /></button>
<input aria-label="Search tasks" type="search" />
// Prefer visible <label htmlFor="email"> over aria-label when possible
```

**Focus management**:
- Focus trap modals — Tab cycles within the modal, not behind it
- Move focus to dialog close button (or first focusable element) on open
- Restore focus to the trigger element on close
- After dynamic content changes (route change, item deletion), move focus to a meaningful target

**WCAG 2.1 AA**:
- Contrast: 4.5:1 for normal text, 3:1 for large text
- `prefers-reduced-motion`: disable transforms, opacity only
- Never use color as the sole indicator of state — pair with icons, text, or patterns
- Don't rely solely on placeholder text for input purpose — use labels

### Responsive Design

**Mobile-first breakpoints** — start with the smallest screen, add complexity upward:
```tsx
// Tailwind: mobile-first responsive
<div className="
  grid grid-cols-1      /* Mobile: single column */
  sm:grid-cols-2        /* ≥640px: 2 columns */
  lg:grid-cols-3        /* ≥1024px: 3 columns */
  gap-4
">
```

Test at these breakpoints: 320px, 768px, 1024px, 1440px.

**CSS container queries for component-based responsive design** -- use `@container` instead of `@media` for components that must adapt to their parent, not the viewport. Define containers: `container-type: inline-size`. Query them: `@container (min-width: 400px) { ... }`. Tailwind: `@container` / `@lg:`. Components become portable across layouts without media query rewrites. Use `@media` only for page-level layout shifts.

### Project Structure
- Feature-based: `features/{name}/api/`, `components/`, `hooks/`, `types/`, `index.ts`
- Shared UI `components/ui/`, layouts `components/layout/`. `@/` = src/
- Types colocated with feature, NOT global `types/` dump
- No feature logic in shared components; use hooks/context not prop drilling
- TS strict, no `any`, `import type`, JSDoc public APIs. Folder-based routing, lazy-load routes
- **Micro-frontend decision gate** -- micro-frontends only when: 3+ teams own distinct UI areas AND teams deploy at different cadences AND coordination cost exceeds MFE overhead. Do NOT use when: single team, early-stage product, strong UI cohesion needed (cross-boundary animations), or performance is critical (extra network round-trips). Wrong splits are expensive to undo.

### Typography Guidelines
- Choose fonts that have personality — avoid overused fonts (Inter, Roboto, Arial, Open Sans, system defaults)
- Pair a distinctive display font with a refined body font
- Use a modular type scale with fluid sizing: `clamp(1rem, 0.5rem + 1vw, 1.5rem)`
- Vary font weights and sizes to create clear visual hierarchy — don't use the same size everywhere
- Heading levels form a semantic hierarchy: h1 (page title, one per page) > h2 (section) > h3 (subsection). Never skip levels. Never use heading styles on non-heading content.
- No monospace typography as lazy shorthand for "developer vibes"
- No large icons with rounded corners above every heading — they rarely add value

### Color & Theme Guidelines
- Use oklch/color-mix/light-dark for perceptually uniform palettes
- Semantic color tokens (`text-primary`, `bg-surface`, `border-default`) — never raw hex in components
- Tint your neutrals toward your brand hue — even subtle tinting creates subconscious cohesion
- Dominant colors with sharp accents outperform timid, evenly-distributed palettes
- Never use gray text on colored backgrounds — use a shade of the background color instead
- Never use pure black (#000) or pure white (#fff) — always tint
- Dark mode is not just "invert colors" — it requires its own palette with adjusted contrast

### Styling
- Design tokens always, never hard-coded colors/spacing. Use the project's spacing scale — no arbitrary pixel values
- Dark: bg-neutral-bg1/bg2/bg3 layers, border-border-subtle, glass via `@layer`
- Tailwind+CVA | CSS Modules | MUI sx | @layer+backdrop-blur glassmorphism
- **Anchor Positioning for tooltips/popovers** -- CSS `anchor()` function positions elements relative to another element without JS. Replaces Floating UI/Popper for most tooltip/popover cases. `position-anchor: --my-trigger; top: anchor(bottom); left: anchor(center);`. Progressive enhancement: fall back to fixed positioning.

### Performance
- Virtualize >50 items: `@tanstack/react-virtual`. No barrel imports; direct imports
- `Promise.all()` independent ops, start early/await late. Debounce search 300-500ms, cleanup effects
- next/dynamic heavy components, lazy load routes/charts/modals. Core Web Vitals (LCP/INP/CLS)
- Profile before optimizing. Performance regressions = bugs
- **PWA baseline for any web app** -- every web app should have: `manifest.json` (name, icons 192+512, display: standalone, theme_color), a service worker with cache-first for static assets + network-first for API, and `<meta name='theme-color'>`. Test with DevTools Application panel. This is progressive enhancement -- costs nothing if unused, massive UX win when installed.

### Animation & 3D
- Framer Motion staggerChildren/spring/useScroll. GSAP ScrollTrigger+scrub, Lenis smooth scroll
- Parallax: bg 0.2x, mid 0.5x, fg 1.0x, floating 1.2x. No scroll hijacking/overload
- **View Transitions API for SPA navigation** -- use `document.startViewTransition()` for page-level transitions instead of wrapping everything in AnimatePresence. Browser-native, works with any framework, costs 0 JS bundle. Define transition names via `view-transition-name` CSS property. Combine with `@media (prefers-reduced-motion: reduce)` to disable.
- R3F | Spline | Three.js. <100K polys, GLB+draco+webp <5MB. 3D only if image won't suffice

### Presentations & Portfolio
- HTML: single file, zero deps, inline CSS/JS, scroll-snap, keyboard+touch, progress bar
- PPT: python-pptx extract -> confirm -> style -> HTML
- Portfolio 30s: identity/skills/work/contact. Case studies: quantified outcomes not tasks

### Misc
- React Flow: memo nodes, NodeResizer, typed data. Scaffold: component/types/styles/tests/stories/barrel
- No silent errors; surface via toast/UI. Vue 3: composables+provide/inject. Svelte 5: runes+snippets
- FFCI (Fit+Reuse+Perf-Complexity-Maintenance): proceed >=6, redesign <=2

### Verification Checklist
After building UI:
- [ ] Component renders without console errors
- [ ] All interactive elements are keyboard accessible (Tab through the page)
- [ ] Screen reader can convey the page's content and structure
- [ ] Responsive: works at 320px, 768px, 1024px, 1440px
- [ ] Loading, error, and empty states all handled
- [ ] Follows the project's design system (spacing, colors, typography)
- [ ] No accessibility warnings in dev tools or axe-core
