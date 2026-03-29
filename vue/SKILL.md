---
name: vue
description: Vue 3 Composition API, `<script setup>`, TypeScript, reactivity, built-in components, best practices, and performance. Use for any Vue, .vue files, Vue Router, Pinia, or Vite with Vue work. ALWAYS use Composition API with `<script setup lang="ts">` unless the project explicitly requires Options API.
metadata:
  author: Anthony Fu, vuejs-ai
  version: "2026.3.21"
  source: Generated from https://github.com/vuejs/docs and vuejs-ai best practices
---

# Vue

> Based on Vue 3.5. Always use Composition API with `<script setup lang="ts">`.

## Core Principles

- **Keep state predictable:** one source of truth, derive everything else.
- **Make data flow explicit:** Props down, Events up for most cases.
- **Favor small, focused components:** easier to test, reuse, and maintain.
- **Avoid unnecessary re-renders:** use computed properties and watchers wisely.
- **Readability counts:** write clear, self-documenting code.

## Gotchas
- Destructuring a reactive object (`const { x } = reactive({...})`) breaks reactivity. Use `toRefs()` or access properties directly.
- `ref()` auto-unwraps in templates but NOT in `<script>` — always use `.value` in script, never in template.
- `watchEffect` runs immediately on creation. If you only want to react to changes, use `watch` with explicit sources.
- `shallowRef` exists — don't use `ref()` for large objects where you only need top-level reactivity tracking.
- Pinia stores are singletons. `$reset()` only works with Options API stores, not Setup stores.

## Preferences

- Prefer TypeScript over JavaScript
- Prefer `<script setup lang="ts">` over `<script>`
- For performance, prefer `shallowRef` over `ref` if deep reactivity is not needed
- Always use Composition API over Options API
- Discourage using Reactive Props Destructure

## Workflow

Use this skill as an instruction set. Follow the workflow in order unless the user explicitly asks for a different order.

### 1) Confirm architecture before coding (required)

- Default stack: Vue 3 + Composition API + `<script setup lang="ts">`.
- If the project explicitly uses Options API, adapt accordingly.

#### 1.1 Must-read core references (required)

Before implementing any Vue task, read and apply these core references:
- [reactivity](references/reactivity.md) - Reactivity core patterns
- [sfc](references/sfc.md) - SFC structure, styling, and template patterns
- [component-data-flow](references/component-data-flow.md) - Props/emits/v-model/provide-inject
- [composables](references/composables.md) - Composable organization patterns

Keep these references in active working context for the entire task.

#### 1.2 Plan component boundaries before coding (required)

Create a brief component map before implementation for any non-trivial feature.

- Define each component's single responsibility in one sentence.
- Keep entry/root and route-level view components as composition surfaces by default.
- Move feature UI and feature logic out of entry/root/view components unless the task is intentionally a tiny single-file demo.
- Define props/emits contracts for each child component in the map.
- Prefer a feature folder layout (`components/<feature>/...`, `composables/use<Feature>.ts`) when adding more than one component.

### 2) Apply essential Vue foundations (required)

These are essential, must-know foundations. Apply all of them in every Vue task using the core references already loaded in section `1.1`.

#### Reactivity

- Keep source state minimal (`ref`/`reactive`), derive everything possible with `computed`.
- Use watchers for side effects if needed.
- Avoid recomputing expensive logic in templates.

#### SFC structure and template safety

- Keep SFC sections in this order: `<script>` -> `<template>` -> `<style>`.
- Keep SFC responsibilities focused; split large components.
- Keep templates declarative; move branching/derivation to script.
- Apply Vue template safety rules (`v-html`, list rendering, conditional rendering choices).

#### Keep components focused

Split a component when it has **more than one clear responsibility** (e.g. data orchestration + UI, or multiple independent UI sections).

- Prefer **smaller components + composables** over one "mega component"
- Move **UI sections** into child components (props in, events out).
- Move **state/side effects** into composables (`useXxx()`).

Apply objective split triggers. Split the component if **any** condition is true:

- It owns both orchestration/state and substantial presentational markup for multiple sections.
- It has 3+ distinct UI sections (for example: form, filters, list, footer/status).
- A template block is repeated or could become reusable (item rows, cards, list entries).

Entry/root and route view rule:

- Keep entry/root and route view components thin: app shell/layout, provider wiring, and feature composition.
- Do not place full feature implementations in entry/root/view components when those features contain independent parts.
- For CRUD/list features (todo, table, catalog, inbox), split at least into:
  - feature container component
  - input/form component
  - list (and/or item) component
  - footer/actions or filter/status component
- Allow a single-file implementation only for very small throwaway demos; if chosen, explicitly justify why splitting is unnecessary.

#### Component data flow

- Use props down, events up as the primary model.
- Use `v-model` only for true two-way component contracts.
- Use provide/inject only for deep-tree dependencies or shared context.
- Keep contracts explicit and typed with `defineProps`, `defineEmits`, and `InjectionKey` as needed.

#### Composables

- Extract logic into composables when it is reused, stateful, or side-effect heavy.
- Keep composable APIs small, typed, and predictable.
- Separate feature logic from presentational components.

### 3) Consider optional features only when requirements call for them

#### 3.1 Standard optional features

Do not add these by default. Load the matching reference only when the requirement exists.

- Slots: parent needs to control child content/layout -> [component-slots](references/component-slots.md)
- Fallthrough attributes: wrapper/base components must forward attrs/events safely -> [component-fallthrough-attrs](references/component-fallthrough-attrs.md)
- Built-in component `<KeepAlive>` for stateful view caching -> [component-keep-alive](references/component-keep-alive.md)
- Built-in component `<Teleport>` for overlays/portals -> [component-teleport](references/component-teleport.md)
- Built-in component `<Suspense>` for async subtree fallback boundaries -> [component-suspense](references/component-suspense.md)
- Animation-related features: pick the simplest approach that matches the required motion behavior.
  - Built-in component `<Transition>` for enter/leave effects -> [component-transition](references/component-transition.md)
  - Built-in component `<TransitionGroup>` for animated list mutations -> [component-transition-group](references/component-transition-group.md)
  - Class-based animation for non-enter/leave effects -> [animation-class-based-technique](references/animation-class-based-technique.md)
  - State-driven animation for user-input-driven animation -> [animation-state-driven-technique](references/animation-state-driven-technique.md)

#### 3.2 Less-common optional features

Use these only when there is explicit product or technical need.

- Directives: behavior is DOM-specific and not a good composable/component fit -> [directives](references/directives.md)
- Async components: heavy/rarely-used UI should be lazy loaded -> [component-async](references/component-async.md)
- Render functions only when templates cannot express the requirement -> [render-functions](references/render-functions.md)
- Plugins when behavior must be installed app-wide -> [plugins](references/plugins.md)
- State management patterns: app-wide shared state crosses feature boundaries -> [state-management](references/state-management.md)

### 4) Run performance optimization after behavior is correct

Performance work is a post-functionality pass. Do not optimize before core behavior is implemented and verified.

- Large list rendering bottlenecks -> [perf-virtualize-large-lists](references/perf-virtualize-large-lists.md)
- Static subtrees re-rendering unnecessarily -> [perf-v-once-v-memo-directives](references/perf-v-once-v-memo-directives.md)
- Over-abstraction in hot list paths -> [perf-avoid-component-abstraction-in-lists](references/perf-avoid-component-abstraction-in-lists.md)
- Expensive updates triggered too often -> [updated-hook-performance](references/updated-hook-performance.md)

### 5) Final self-check before finishing

- Core behavior works and matches requirements.
- All must-read references were read and applied.
- Reactivity model is minimal and predictable.
- SFC structure and template rules are followed.
- Components are focused and well-factored, splitting when needed.
- Entry/root and route view components remain composition surfaces unless there is an explicit small-demo exception.
- Component split decisions are explicit and defensible (responsibility boundaries are clear).
- Data flow contracts are explicit and typed.
- Composables are used where reuse/complexity justifies them.
- Moved state/side effects into composables if applicable.
- Optional features are used only when requirements demand them.
- Performance changes were applied only after functionality was complete.

## Quick Reference

### Component Template

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  title: string
  count?: number
}>()

const emit = defineEmits<{
  update: [value: string]
}>()

const model = defineModel<string>()

const doubled = computed(() => (props.count ?? 0) * 2)

watch(() => props.title, (newVal) => {
  console.log('Title changed:', newVal)
})

onMounted(() => {
  console.log('Component mounted')
})
</script>

<template>
  <div>{{ title }} - {{ doubled }}</div>
</template>
```

### Key Imports

```ts
// Reactivity
import { ref, shallowRef, computed, reactive, readonly, toRef, toRefs, toValue } from 'vue'

// Watchers
import { watch, watchEffect, watchPostEffect, onWatcherCleanup } from 'vue'

// Lifecycle
import { onMounted, onUpdated, onUnmounted, onBeforeMount, onBeforeUpdate, onBeforeUnmount } from 'vue'

// Utilities
import { nextTick, defineComponent, defineAsyncComponent } from 'vue'
```

## Reference Files Index

### Core (must-read)

| Topic | Description | Reference |
|-------|-------------|-----------|
| Script Setup & Macros | `<script setup>`, defineProps, defineEmits, defineModel, defineExpose, defineOptions, defineSlots, generics | [script-setup-macros](references/script-setup-macros.md) |
| Reactivity & Lifecycle | ref, shallowRef, computed, watch, watchEffect, effectScope, lifecycle hooks, composables | [core-new-apis](references/core-new-apis.md) |
| Reactivity Best Practices | Choosing reactive primitives, computed vs watchers, async cleanup | [reactivity](references/reactivity.md) |
| SFC Structure | SFC layout, scoped styles, template patterns, v-if/v-show, v-for keys | [sfc](references/sfc.md) |
| Component Data Flow | Props/emits, v-model, provide/inject, TypeScript contracts | [component-data-flow](references/component-data-flow.md) |
| Composable Patterns | Composition, options objects, readonly state, feature organization | [composables](references/composables.md) |

### Built-in Components & Directives

| Topic | Description | Reference |
|-------|-------------|-----------|
| Built-in Components (API) | Transition, Teleport, Suspense, KeepAlive, v-memo, custom directives API | [advanced-patterns](references/advanced-patterns.md) |
| Transition Best Practices | Single element enter/leave, keys, mode, performant CSS | [component-transition](references/component-transition.md) |
| TransitionGroup Best Practices | List animations, stable keys, staggered effects | [component-transition-group](references/component-transition-group.md) |
| Teleport Best Practices | Overlay positioning, responsive disable, logical hierarchy | [component-teleport](references/component-teleport.md) |
| Suspense Best Practices | Async coordination, fallback timing, nesting order | [component-suspense](references/component-suspense.md) |
| KeepAlive Best Practices | Cache control, include/exclude, activation hooks, router caching | [component-keep-alive](references/component-keep-alive.md) |
| Slots Best Practices | Shorthand, conditional wrappers, defineSlots, fallback content | [component-slots](references/component-slots.md) |
| Fallthrough Attrs | Hyphenated access, useAttrs reactivity, listener forwarding | [component-fallthrough-attrs](references/component-fallthrough-attrs.md) |
| Directive Best Practices | DOM-only usage, cleanup, typing, SSR | [directives](references/directives.md) |

### Animation

| Topic | Description | Reference |
|-------|-------------|-----------|
| Class-based Animation | Shake/pulse/highlight effects on mounted elements | [animation-class-based-technique](references/animation-class-based-technique.md) |
| State-driven Animation | Style bindings + CSS transitions, mouse/scroll/progress animations | [animation-state-driven-technique](references/animation-state-driven-technique.md) |

### Advanced Features

| Topic | Description | Reference |
|-------|-------------|-----------|
| Async Components | Lazy hydration (SSR), loading delay, defineAsyncComponent | [component-async](references/component-async.md) |
| Render Functions | h(), JSX, withModifiers, withDirectives, functional components | [render-functions](references/render-functions.md) |
| Plugins | app.use() contract, symbol injection keys, typed composable wrappers | [plugins](references/plugins.md) |
| State Management | Local-first, singleton composables, Pinia for SSR, createGlobalState | [state-management](references/state-management.md) |

### Performance

| Topic | Description | Reference |
|-------|-------------|-----------|
| Virtual Lists | vue-virtual-scroller, @tanstack/vue-virtual, when to virtualize | [perf-virtualize-large-lists](references/perf-virtualize-large-lists.md) |
| v-once & v-memo | Skip unnecessary updates for static/conditional content | [perf-v-once-v-memo-directives](references/perf-v-once-v-memo-directives.md) |
| List Abstraction | Flatten component hierarchies in hot rendering paths | [perf-avoid-component-abstraction-in-lists](references/perf-avoid-component-abstraction-in-lists.md) |
| Updated Hook | Avoid expensive operations in onUpdated, prefer watchers | [updated-hook-performance](references/updated-hook-performance.md) |
