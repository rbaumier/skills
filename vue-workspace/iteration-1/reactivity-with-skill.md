# Reactivity - With Skill

## Prompt
Create a Vue component for a shopping cart. Fix and improve the given Options API component that uses reactive() inside data(), destructures reactive objects, and computes total via a method called in the template.

## Response

Several issues in the original code:

1. **Options API**: The skill requires Composition API with `<script setup lang="ts">`.
2. **Destructuring reactive**: Destructuring a reactive object (`const { x } = reactive({...})`) **breaks reactivity**. Use `toRefs()` or access properties directly.
3. **Method in template**: `total()` is called as a method in the template. Derived values should use `computed()` to avoid unnecessary recomputation.
4. **No TypeScript**: Skill requires TypeScript.

### Component map

- **ShoppingCart.vue** - single focused component (this is small enough for one file)
  - Responsibility: manage cart items, display total
  - Props: none (self-contained demo)

### Implementation

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

interface CartItem {
  name: string
  price: number
  quantity: number
}

const items = ref<CartItem[]>([])

const total = computed(() =>
  items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
)

function addItem(item: CartItem) {
  items.value.push(item)
}

function removeItem(index: number) {
  items.value.splice(index, 1)
}
</script>

<template>
  <div class="shopping-cart">
    <h2>Shopping Cart</h2>
    <div v-for="(item, index) in items" :key="index">
      <span>{{ item.name }} - ${{ item.price }} x {{ item.quantity }}</span>
      <button @click="removeItem(index)">Remove</button>
    </div>
    <p>Total: ${{ total }}</p>
    <button @click="addItem({ name: 'New Item', price: 9.99, quantity: 1 })">
      Add Item
    </button>
  </div>
</template>
```

### Key fixes

- **Composition API with `<script setup lang="ts">`** instead of Options API.
- **`ref<CartItem[]>`** instead of `reactive()` — simpler for a single array. Note: `ref()` is appropriate here because we need deep reactivity on the array items (tracking pushes, splices). If we only needed top-level replacement, `shallowRef` would be preferred.
- **`computed()`** for `total` instead of a method — Vue caches the result and only recomputes when dependencies change, avoiding recomputation on every render.
- **No destructuring of reactive objects** — we use `ref` directly and access via `.value` in script (note: `.value` is not needed in template because Vue auto-unwraps refs).
- **TypeScript interfaces** for type safety on `CartItem`.
- **SFC order**: `<script>` first, then `<template>` (no `<style>` needed here).
