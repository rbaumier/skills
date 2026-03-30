---
name: frontend
description: "Build UI components, pages, dashboards, 3D scenes. Trigger on 'component', 'page', 'layout', 'design system', 'responsive', 'forms', 'server component'."
---

## Gotchas
- `"use client"` only for hooks/event handlers/browser APIs — over-marking kills SSR
- `useEffect` for derived state = anti-pattern. Compute inline during render, never sync with effects
- `key={index}` dynamic lists = silent bugs on reorder/delete. Stable IDs only
- Next.js `fetch()` Server Components caches by default prod. `{ cache: 'no-store' }` or `revalidate`
- Importing server component into client component silently becomes client-side. Client-into-server fine, reverse NOT

## Rules

### Component Architecture
- Composition (Card+CardHeader) not boolean props (each doubles states)
- Compound components (Context+Provider) for sibling shared state. Never prop-drill
- Variant prop with defined values, not boolean modes (isPrimary, isGhost...)
- Children over renderX props. Render props ONLY when passing data back
- File order: types -> hooks -> useMemo -> useCallback -> render -> default export
- Context: state+actions+meta; provider only place knowing state impl. Lift state into provider for sibling access
- Controlled/uncontrolled via slot pattern. Semantic props (isLoading not loading), sensible defaults
- className/style overrides. Error Boundaries with retry

### React 19 + Server Components
- `useActionState` forms, `useOptimistic` optimistic UI, `use()` promises/context; ref is regular prop (no forwardRef)
- React Compiler auto-memoizes; less manual useMemo/useCallback
- Prefer server components; `"use client"` only for interactivity/browser APIs
- Minimize RSC boundary serialization, pass only needed fields

### State Management
- local: useState/useReducer. feature-shared: Context+Reducer. server: TanStack Query/SWR. global: Zustand/Jotai
- Zustand: ALWAYS `useStore(s => s.count)`, NEVER destructure full store — unnecessary re-renders
- Suspense-first: `useSuspenseQuery` + `<Suspense fallback={<Skeleton/>}>`. NOT isLoading early returns
- Never `if (isLoading) return <Spinner/>` — use `if (loading && !data)` to avoid flash when data exists
- No inline fetch; isolate in feature `api/` layer. All responses typed

### UX Patterns
- Error hierarchy: inline (field) > toast (recoverable) > banner (partial) > full screen (fatal)
- Disable buttons + loading indicator during async submission. Every list needs empty state

### Project Structure
- Feature-based: `features/{name}/api/`, `components/`, `hooks/`, `types/`, `index.ts`
- Shared UI `components/ui/`, layouts `components/layout/`. `@/` = src/
- Types colocated with feature, NOT global `types/` dump
- No feature logic in shared components; use hooks/context not prop drilling
- TS strict, no `any`, `import type`, JSDoc public APIs. Folder-based routing, lazy-load routes

### Styling
- Design tokens always, never hard-coded colors/spacing
- Dark: bg-neutral-bg1/bg2/bg3 layers, border-border-subtle, glass via `@layer`
- Tailwind+CVA | CSS Modules | MUI sx | @layer+backdrop-blur glassmorphism

### Performance
- Virtualize >50 items: `@tanstack/react-virtual`. No barrel imports; direct imports
- `Promise.all()` independent ops, start early/await late. Debounce search 300-500ms, cleanup effects
- next/dynamic heavy components, lazy load routes/charts/modals. Core Web Vitals (LCP/INP/CLS)
- Profile before optimizing. Performance regressions = bugs

### Accessibility
- Semantic HTML, ARIA labels/roles, keyboard nav
- Focus trap modals, restore focus to trigger on close
- WCAG 2.1 AA contrast. `prefers-reduced-motion`: disable transforms, opacity only

### Animation & 3D
- Framer Motion staggerChildren/spring/useScroll. GSAP ScrollTrigger+scrub, Lenis smooth scroll
- Parallax: bg 0.2x, mid 0.5x, fg 1.0x, floating 1.2x. No scroll hijacking/overload
- R3F | Spline | Three.js. <100K polys, GLB+draco+webp <5MB. 3D only if image won't suffice

### Presentations & Portfolio
- HTML: single file, zero deps, inline CSS/JS, scroll-snap, keyboard+touch, progress bar
- PPT: python-pptx extract -> confirm -> style -> HTML
- Portfolio 30s: identity/skills/work/contact. Case studies: quantified outcomes not tasks

### Misc
- React Flow: memo nodes, NodeResizer, typed data. Scaffold: component/types/styles/tests/stories/barrel
- No silent errors; surface via toast/UI. Vue 3: composables+provide/inject. Svelte 5: runes+snippets
- FFCI (Fit+Reuse+Perf-Complexity-Maintenance): proceed >=6, redesign <=2
