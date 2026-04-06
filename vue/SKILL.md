---
name: vue
description: Vue 3 Composition API, `<script setup>`, TypeScript, reactivity, components, data flow, performance.
---

# Vue

> Vue 3.5. Always Composition API with `<script setup lang="ts">`.

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

Reactive proxy identity hazard: `reactive()` returns a Proxy — comparing reactive objects with `===` always returns false even for the same source. Use `toRaw()` to compare identity, or stick to `ref()` which wraps primitives directly.

Reactivity same-tick batching: watchers only fire once per tick — multiple synchronous mutations to the same ref trigger the watcher only once with the final value. If you need to observe intermediate values, use `nextTick()` between mutations or `watchEffect` with `flush: 'sync'` (use sparingly — sync watchers bypass Vue's optimization).

markRaw() for non-reactive instances: third-party class instances (Axios, Chart.js, map instances) break when wrapped in reactive(). Use `markRaw()` to opt them out of reactivity, or store them in `shallowRef()`. WHY: Vue's proxy traps interfere with internal getters/setters of library objects.

refs in collections: refs inside arrays, Maps, or Sets are NOT auto-unwrapped. `const list = reactive([ref(1)]); list[0]` gives the Ref object, not the value. Use `.value` explicitly or prefer storing plain values in reactive collections.

### SFC Structure
- Section order: `<script>` -> `<template>` -> `<style>`
- No v-html without sanitization (XSS); use DOMPurify if needed
- v-for must have :key with stable identifier
- v-if/v-else pairs, not two opposite v-if conditions
- Keep templates declarative; move branching/derivation to script

### Component Splitting
- CRUD features: split into container + input/form + list/item + footer/actions
- **Views are composition surfaces only** -- zero raw HTML/CSS in page-level views. Every visual pattern = a component. If you're writing `<div class="section__title">` in a view, extract it
- **Repeated pattern (2+) = component** -- same HTML structure appearing twice = extract immediately. This includes inner patterns: if a `<div>` with label + value repeats inside a component, extract it too. Reviews: any repeated HTML structure at any nesting level -> flag "extract component"
- Extract state/side effects into composables (useXxx())
- Composable internal structure order: (1) dependencies/imports, (2) primary state (ref/reactive), (3) state metadata (loading/error), (4) computed, (5) methods, (6) lifecycle hooks, (7) return. Predictable structure makes composables scannable
- VueUse before custom composables: check if @vueuse/core already provides it (200+ utilities: useLocalStorage, useDebounceFn, useIntersectionObserver, useClipboard, etc.)
- **Formatting/calculation logic in utils, not in views or components** -- `Intl.DateTimeFormat`, `Math.ceil`, data transforms belong in `utils/`, imported by both composables and components
- Create component map before implementation (responsibilities + props/emits)
- Feature folder layout: components/<feature>/, composables/use<Feature>.ts

Composable structure order: follow a consistent internal order — (1) dependencies/imports, (2) primary state (ref/reactive), (3) state metadata (loading/error), (4) computed, (5) methods, (6) lifecycle hooks, (7) return. WHY: predictable structure makes composables scannable and reviewable.

VueUse before custom composables: before writing a custom composable, check if VueUse (@vueuse/core) already provides it. Covers 200+ utilities: useLocalStorage, useDebounceFn, useIntersectionObserver, useClipboard, etc. Prefer VueUse composables over custom code for maintainability.

### Data Flow
- Props down, events up as primary model
- provide/inject ONLY for deep-tree dependencies, not parent-child
- Typed contracts: defineProps, defineEmits, InjectionKey
- v-model only for true two-way contracts (form controls)
- URL state for ephemeral filters: filters, sort order, pagination, search queries belong in the URL (query params or path), not in component state or Pinia. Users can share/bookmark filtered views, browser back/forward works, state survives refresh

URL state for ephemeral filters: filters, sort order, pagination, and search queries belong in the URL (query params or path), not in component state or Pinia. WHY: users can share/bookmark filtered views, browser back/forward works, and state survives refresh.

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

Vue 3 reactivity debugging hooks: use `onRenderTracked` and `onRenderTriggered` in dev to trace unexpected re-renders. Pass `{ onTrack, onTrigger }` options to `computed()` and `watch()` to debug specific reactive dependencies. Remove in production.

Pinia setup store: always return ALL state from setup stores — state not returned is invisible to DevTools, SSR hydration, and `$reset()`. Use `return { count, name, increment }` not just `return { increment }`.

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

Template ref unwrapping is top-level only: nested refs in template expressions render as [object Object]. `{{ state.nested.refValue }}` won't unwrap if `state` is reactive and `refValue` is a ref nested more than one level deep. Unwrap in script via computed or access `.value` explicitly.

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
