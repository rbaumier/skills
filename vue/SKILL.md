---
name: vue
description: Vue 3 Composition API, `<script setup>`, TypeScript, reactivity, components, data flow, performance.
---

# Vue

> Vue 3.5. Always Composition API with `<script setup lang="ts">`.

## Pre-Output Checklist (run before emitting any SFC)

Scan every file you are about to output against this list. A single miss is a FAIL — fix it before responding.

- [ ] **Macros called ONCE each.** `defineProps`, `defineEmits`, `defineModel` appear at most ONE TIME per `<script setup>`. Never call the same macro twice. Never re-declare `props`/`emit`.
- [ ] **Macros at the TOP, used AFTER.** `const props = defineProps<...>()` / `const emit = defineEmits<...>()` sit at the very top of `<script setup>`, ABOVE any `computed`/`watch`/function that reads `props` or `emit`. Referencing `props`/`emit` before its `const` line is a temporal-dead-zone crash.
- [ ] **Views hold ZERO presentation markup AND ZERO `<style>`.** A page/view `<template>` contains ONLY: component tags (`<ProductCard>`, `<CartSummary>`…), control-flow (`v-for`/`v-if`/`v-else`), and AT MOST ONE bare top-level wrapper element with NO `class`/`style`/CSS attribute. FORBIDDEN in a view, no exceptions: any `<h1>`–`<h6>`, `<section>`, `<header>`, `<footer>`, `<p>`, `<span>`, `<ul>`/`<li>`, or `<div>`/element carrying a `class` (incl. layout/grid classes like `products-list`, `page-container`), AND any `<style>` block at all (even one styling only layout/grid). A grid/flex layout class is presentation → it and its CSS move into a wrapper component (e.g. `<ProductsGrid>`). The view itself must contain NO CSS and NO classed elements. Check: if the view has a `<style>` block, or ANY element with a `class`, you are NOT done — extract that block into a component.
- [ ] **No inline arithmetic/format in templates.** No `*`, `reduce`, `.toFixed`, `$`-glued numbers in `{{ }}` — use `computed()` + a `utils/` formatter.
- [ ] **Block order:** `<script setup>` → `<template>` → `<style>`, every file.
- [ ] **Repeated markup ≥2x extracted** into a component.
- [ ] **Every `:key` is a stable id** (e.g. `product.id`), never the object.

## Rules

### Reactivity
- Always `<script setup lang="ts">`, never Options API setup()
- Derive with computed(), never recompute in templates
- Destructuring reactive objects breaks reactivity; use ref or toRefs. WHY: `const { count } = reactive({ count: 0 })` copies the primitive — count is now a plain number, not reactive. Use `const { count } = toRefs(state)` to get a ref that stays connected
- `.value` confusion: ref() needs .value in script, auto-unwraps in template. reactive() never needs .value. If you see `.value` on a reactive object property, that's a bug. If you miss `.value` on a ref in script, you're comparing the Ref object itself (always truthy)
- Reactive proxy identity hazard: `reactive()` returns a Proxy -- comparing reactive objects with `===` always returns false even for the same source. Use `toRaw()` to compare identity, or stick to `ref()`
- Reactivity same-tick batching: watchers only fire once per tick -- multiple synchronous mutations trigger the watcher once with the final value. Use `nextTick()` between mutations or `watchEffect` with `flush: 'sync'` (sparingly) if you need intermediate values
- `markRaw()` for non-reactive instances: third-party class instances (Axios, Chart.js, map instances) break when wrapped in `reactive()`. Use `markRaw()` to opt out, or store in `shallowRef()`. WHY: Vue's proxy traps interfere with internal getters/setters
- Refs in collections: refs inside arrays, Maps, or Sets are NOT auto-unwrapped. `reactive([ref(1)])[0]` gives the Ref object, not the value. Use `.value` explicitly or store plain values in reactive collections
- Prefer shallowRef when deep reactivity unneeded
- Prefer TypeScript with typed interfaces

### SFC Structure
- **Block order is `<script setup>` FIRST, then `<template>`, then `<style>` — in that exact order, top to bottom.** `<template>` must NEVER come before `<script setup>`. If you are editing an SFC where `<template>` is at the top, MOVE `<script setup>` above it — leaving the template first is a FAIL, not a style preference. WHY: script-first lets a reader see the component's data and types before the markup that consumes them, matching how the SFC compiler and most tooling expect blocks. Review check: open the file, look at the first non-comment block — if it is not `<script setup>`, reorder.
- No v-html without sanitization (XSS); use DOMPurify if needed
- v-for must have :key with stable identifier
- v-if/v-else pairs, not two opposite v-if conditions
- Keep templates declarative; move branching/derivation to script

### Component Splitting
- CRUD features: split into container + input/form + list/item + footer/actions
- **Views are composition surfaces only -- ZERO presentation markup and ZERO `<style>` in a page-level view.** A view/page `<template>` may contain ONLY: child component tags, control-flow directives (`v-for`/`v-if`/`v-else`), and at most ONE bare top-level wrapper element carrying NO `class` and NO `style`. It may NOT contain presentation blocks like `<section>`, `<header>`, `<h1>`/`<h2>`, or `<div class="cart-summary">`; it may NOT contain ANY element bearing a `class` (a layout/grid class like `products-list` is presentation too — wrap it in a `<ProductsGrid>` component); and it may NOT carry a `<style scoped>` block of any kind (not even layout/grid CSS) — every style lives in a component. Extracting ONE component and leaving the rest of the page as raw markup is a FAIL: EVERY distinct presentation block must become its own component. Threshold: if a chunk of the template has its own heading, its own CSS class, or its own styling intent (a card, a header bar, a summary panel, an empty-state), it is a presentation block → extract it into `components/<Feature>/<Name>.vue` and render `<Name … />` in the view. Review check before finishing: open the page view, look at its `<template>` — if any tag is NOT a component/`v-for`/`v-if`/bare wrapper, OR a `<style>` block exists, you are not done. Example: a `cart-summary` `<section>` with `<h2>`, total, and empty-state markup → `<CartSummary :items :total />` with all that markup + CSS moved into `CartSummary.vue`.
- **Repeated markup ≥2x = extract a sub-component, immediately.** Same HTML structure appearing two or more times — even INSIDE a single component, even just a `<div>` with a label + value — MUST become its own component rendered in a `v-for` or invoked N times. Copy-pasting the same block 2 or 3 times is a FAIL even if it "works". Review check before finishing: scan each SFC for any markup block that appears more than once; if found, extract it. WHY: duplicated markup drifts (one copy gets a fix, the others rot) and inflates the template past the point a reader can scan it. Example: three rows `<div class="row"><span>{{ label }}</span><span>{{ value }}</span></div>` → one `<DetailRow :label :value />` rendered via `v-for`.
- **Shared/reusable state + its mutations = extract a composable `use*`.** Any block of reactive state plus the functions that mutate it (a cart, a selection, a wizard step, fetched data + loading/error) MUST move out of the page/component into a `composables/useXxx.ts` — do NOT leave `const x = ref(...)` next to its `const updateX = () => {...}` inline in a view. Trigger threshold: state that is shared across components, reused, or carries its own mutation logic → extract. Review check before finishing: in each view, look for `ref`/`reactive` declarations sitting beside the functions that change them; if found, that pair belongs in a composable. WHY: inline state couples the view to the logic, blocks reuse, and makes the unit untestable. Example: `cart` ref + `addToCart`/`removeFromCart` in a page → `useCart()` returning `{ cart, addToCart, removeFromCart }`.
- Composable internal structure order: (1) dependencies/imports, (2) primary state (ref/reactive), (3) state metadata (loading/error), (4) computed, (5) methods, (6) lifecycle hooks, (7) return. Predictable structure makes composables scannable
- VueUse before custom composables: check if @vueuse/core already provides it (200+ utilities: useLocalStorage, useDebounceFn, useIntersectionObserver, useClipboard, etc.)
- **Any display formatting goes through a `utils/` helper — NEVER inline in the template.** Currency, dates, percentages, truncation, pluralization, `Intl.*`, `Math.ceil`, data transforms: write a named helper (e.g. `formatPrice(value)`) in `utils/` and call it. Writing the format inline — e.g. a literal `$` glued to a number like `${{ price }}`, or `{{ value.toFixed(2) }}` in the markup — is a FAIL: it duplicates the rule across every usage and hides locale/rounding decisions in the template. Review check before finishing: scan templates for literal currency symbols, `.toFixed`, `.toLocaleString`, or `Intl.` calls; each one becomes `{{ formatPrice(value) }}` backed by a util. WHY: one helper = one place to change the format, testable in isolation, reusable across components and composables. Example: `${{ priceWithTax }}` → `{{ formatPrice(priceWithTax) }}` with `formatPrice` living in `utils/`.
- Create component map before implementation (responsibilities + props/emits)
- Feature folder layout: components/<feature>/, composables/use<Feature>.ts

### Data Flow
- Props down, events up as primary model
- provide/inject ONLY for deep-tree dependencies, not parent-child
- **Typed contracts: `defineProps<{}>`, `defineEmits<{}>`, `InjectionKey` — and each macro is called EXACTLY ONCE per component.** `defineProps` and `defineEmits` are compiler macros, not functions: calling either of them twice in the same `<script setup>` is a compile error. Declare them once, at the very TOP of the block, and capture the result in a `const` (`const props = defineProps<Props>()`, `const emit = defineEmits<Emits>()`). Every `computed`, `watch`, or function that reads `props` or `emit` MUST come AFTER that `const` — referencing it earlier is a temporal-dead-zone crash. Never re-declare `props`/`emit` lower in the file to "add a field"; instead edit the single generic. Review check before finishing: in each SFC count the `defineProps`/`defineEmits` occurrences — if either is >1, or if `props`/`emit` is used above its declaration, FIX it. Correct shape:
  ```vue
  <script setup lang="ts">
  // macros first, ONE each, captured in a const
  const props = defineProps<{ product: Product; taxRate: number }>()
  const emit = defineEmits<{ addToCart: [product: Product] }>()
  // everything that reads props/emit comes AFTER
  const priceWithTax = computed(() => props.product.price * (1 + props.taxRate))
  function add() { emit('addToCart', props.product) }
  </script>
  ```
- v-model only for true two-way contracts (form controls)
- URL state for ephemeral filters: filters, sort order, pagination, search queries belong in the URL (query params or path), not in component state or Pinia. Users can share/bookmark filtered views, browser back/forward works, state survives refresh

### Problem Playbooks

#### Lifecycle Cleanup
- Every addEventListener, setInterval, setTimeout, WebSocket, or subscription in onMounted MUST have a matching cleanup in onUnmounted. Missing cleanup = memory leak that grows with every route navigation
- watchEffect returns a stop handle; store it if the watcher is conditional. For watch(), the cleanup callback in onUnmounted is sufficient since watch auto-stops when component unmounts — but only if the component actually unmounts (KeepAlive keeps it alive)

#### Reactivity Debugging
- Use `onRenderTracked` and `onRenderTriggered` in dev to trace unexpected re-renders. Pass `{ onTrack, onTrigger }` options to `computed()` and `watch()` to debug specific reactive dependencies. Remove in production

#### SSR / Nuxt Diagnostics
- `window is not defined` or `document is not defined` = client-only code running on server. Fix: wrap in `onMounted()` (runs client-only) or use `<ClientOnly>` component
- Hydration mismatch = server HTML differs from client render. Common causes: Date.now(), Math.random(), browser-only APIs in setup, conditional rendering based on viewport. Fix: move dynamic values to onMounted or use useId() for stable SSR-safe IDs
- `process.client` / `import.meta.client` guard for code that must only run in browser but is not in a lifecycle hook

#### Pinia Deep Patterns
- `$patch` for batch state updates — triggers only ONE reactive flush instead of one per property. Use object form for simple updates: `store.$patch({ count: 1, name: 'new' })`. Use function form when you need the current state: `store.$patch(state => { state.items.push(item) })`
- Store composition: one store can import and use another store inside its actions/getters. Call `useOtherStore()` inside the action, not at store definition top-level — otherwise you get circular dependency issues
- `storeToRefs(store)` to destructure state/getters reactively. Plain destructure loses reactivity. Actions can be destructured directly (they are plain functions)
- Setup stores: always return ALL state from setup stores -- state not returned is invisible to DevTools, SSR hydration, and `$reset()`. Use `return { count, name, increment }` not just `return { increment }`

### Optional Features
- Don't add features by default; audit and reject unjustified ones
- Performance optimization is a post-functionality pass
- Pick simplest animation approach (Transition/TransitionGroup with CSS)
- Justify each less-common feature (Suspense, KeepAlive, v-memo, virtualization)

### General (non-discriminating)
- ref() auto-unwraps in templates, .value in script
- Template ref unwrapping is top-level only: nested refs in template expressions render as [object Object]. `{{ state.nested.refValue }}` won't unwrap if `state` is reactive and `refValue` is nested >1 level deep. Unwrap in script via computed or `.value`
- No reactive props destructure
- TransitionGroup with CSS for simple list animations

## Quick Reference

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{ title: string; count?: number }>()
const emit = defineEmits<{ update: [value: string] }>()
const model = defineModel<string>()
const doubled = computed(() => (props.count ?? 0) * 2)
</script>

<template>
  <div>{{ title }} - {{ doubled }}</div>
</template>
```

## References
- Core: [reactivity](references/reactivity.md), [sfc](references/sfc.md), [component-data-flow](references/component-data-flow.md), [composables](references/composables.md)
- Optional: component-slots, component-fallthrough-attrs, component-keep-alive, component-teleport, component-suspense, component-transition, component-transition-group
- Performance: perf-virtualize-large-lists, perf-v-once-v-memo-directives, perf-avoid-component-abstraction-in-lists
