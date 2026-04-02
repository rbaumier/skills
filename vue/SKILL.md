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
- Destructuring reactive objects breaks reactivity; use ref or toRefs
- Prefer shallowRef when deep reactivity unneeded
- Prefer TypeScript with typed interfaces

### SFC Structure
- Section order: `<script>` -> `<template>` -> `<style>`
- No v-html without sanitization (XSS); use DOMPurify if needed
- v-for must have :key with stable identifier
- v-if/v-else pairs, not two opposite v-if conditions
- Keep templates declarative; move branching/derivation to script

### Component Splitting
- CRUD features: split into container + input/form + list/item + footer/actions
- **Views are composition surfaces only** -- zero raw HTML/CSS in page-level views. Every visual pattern = a component. If you're writing `<div class="section__title">` in a view, extract it
- **Repeated pattern (2+) = component** -- same HTML structure appearing twice = extract immediately, not later. Reviews: repeated HTML block -> flag "extract component"
- Extract state/side effects into composables (useXxx())
- **Formatting/calculation logic in utils, not in views or components** -- `Intl.DateTimeFormat`, `Math.ceil`, data transforms belong in `utils/`, imported by both composables and components
- Create component map before implementation (responsibilities + props/emits)
- Feature folder layout: components/<feature>/, composables/use<Feature>.ts

### Data Flow
- Props down, events up as primary model
- provide/inject ONLY for deep-tree dependencies, not parent-child
- Typed contracts: defineProps, defineEmits, InjectionKey
- v-model only for true two-way contracts (form controls)

### Optional Features
- Don't add features by default; audit and reject unjustified ones
- Performance optimization is a post-functionality pass
- Pick simplest animation approach (Transition/TransitionGroup with CSS)
- Justify each less-common feature (Suspense, KeepAlive, v-memo, virtualization)

### General (non-discriminating)
- ref() auto-unwraps in templates, .value in script
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
