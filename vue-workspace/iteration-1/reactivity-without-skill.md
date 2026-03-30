# Reactivity - Without Skill

## Prompt
Create a Vue component for a shopping cart. Fix and improve the given Options API component that uses reactive() inside data(), destructures reactive objects, and computes total via a method called in the template.

## Response

Here's an improved shopping cart component:

```vue
<template>
  <div class="shopping-cart">
    <h2>Shopping Cart</h2>
    <div v-for="(item, index) in cart.items" :key="index">
      <span>{{ item.name }} - ${{ item.price }} x {{ item.quantity }}</span>
      <button @click="removeItem(index)">Remove</button>
    </div>
    <div>Total: ${{ total() }}</div>
    <button @click="addItem({ name: 'New Item', price: 9.99, quantity: 1 })">Add Item</button>
  </div>
</template>

<script>
import { reactive } from 'vue'

export default {
  setup() {
    const cart = reactive({ items: [] })

    const { items } = cart // destructure for convenience

    function addItem(item) {
      cart.items.push(item)
    }

    function removeItem(index) {
      cart.items.splice(index, 1)
    }

    function total() {
      return cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    }

    return { cart, items, addItem, removeItem, total }
  }
}
</script>
```

Key improvements:
- Moved from Options API `data()` to `setup()` function with Composition API
- Used `reactive()` properly in setup
- Added remove functionality
- Structured the component better

This is a clean, working shopping cart component using Vue 3's Composition API.
