# Refactored Vue Component

## `ProductsPage.vue`

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ProductCard from '@/components/Products/ProductCard.vue'
import ProductsList from '@/components/Products/ProductsList.vue'
import CartSummary from '@/components/Cart/CartSummary.vue'
import { useCart } from '@/composables/useCart'
import DOMPurify from 'dompurify'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  weight: number
  rating: number
}

const products = ref<Product[]>([])
const { cart, addToCart, removeFromCart } = useCart()
const userBio = ref('')
const TAX_RATE = 0.1

const productsCount = computed(() => products.value.length)

onMounted(async () => {
  await fetchProducts()
})

async function fetchProducts() {
  try {
    const res = await fetch('/api/products')
    products.value = await res.json()
  } catch (error) {
    console.error('Failed to fetch products:', error)
  }
}

function handleAddToCart(product: Product) {
  addToCart(product)
}

function getSanitizedBio(): string {
  return DOMPurify.sanitize(userBio.value)
}
</script>

<template>
  <div>
    <ProductsHeader :count="productsCount" />
    <ProductsList :products :tax-rate="TAX_RATE" @add-to-cart="handleAddToCart" />
    <div v-if="userBio" v-html="getSanitizedBio()"></div>
    <CartSummary :items="cart" @remove="removeFromCart" />
  </div>
</template>
```

## `components/Products/ProductsHeader.vue`

```vue
<script setup lang="ts">
interface Props {
  count: number
}

defineProps<Props>()
</script>

<template>
  <header class="products-header">
    <h1 class="products-header__title">Products</h1>
    <span class="products-header__count">{{ count }} items</span>
  </header>
</template>

<style scoped>
.products-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.products-header__title {
  font-size: 1.5rem;
}

.products-header__count {
  display: flex;
  align-items: center;
}
</style>
```

## `components/Products/ProductsList.vue`

```vue
<script setup lang="ts">
interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  weight: number
  rating: number
}

interface Props {
  products: Product[]
  taxRate: number
}

interface Emits {
  addToCart: [product: Product]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function handleAddToCart(product: Product) {
  emit('addToCart', product)
}
</script>

<template>
  <div class="products-list">
    <ProductCard
      v-for="product in props.products"
      :key="product.id"
      :product
      :tax-rate="props.taxRate"
      @add-to-cart="handleAddToCart"
    />
  </div>
</template>

<style scoped>
.products-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
```

## `components/Products/ProductCard.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import ProductStock from './ProductStock.vue'
import ProductDetail from './ProductDetail.vue'
import { formatPrice } from '@/utils/format'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  weight: number
  rating: number
}

interface Props {
  product: Product
  taxRate: number
}

interface Emits {
  addToCart: [product: Product]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const priceWithTax = computed(() => 
  props.product.price * (1 + props.taxRate)
)

const canAddToCart = computed(() => props.product.stock > 0)

function handleAddToCart() {
  emit('addToCart', props.product)
}
</script>

<template>
  <div class="product-card">
    <h3 class="product-card__name">{{ product.name }}</h3>
    <div class="product-card__price">{{ formatPrice(priceWithTax) }}</div>
    <ProductStock :stock="product.stock" />
    <div class="product-card__details">
      <ProductDetail label="Category" :value="product.category" />
      <ProductDetail label="Weight" :value="`${product.weight}kg`" />
      <ProductDetail label="Rating" :value="`${product.rating}/5`" />
    </div>
    <button
      v-if="canAddToCart"
      class="product-card__button"
      @click="handleAddToCart"
    >
      Add to Cart
    </button>
  </div>
</template>

<style scoped>
.product-card {
  border: 1px solid #ccc;
  padding: 1rem;
  margin-bottom: 0.5rem;
}

.product-card__name {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.product-card__price {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.product-card__details {
  margin: 0.5rem 0;
}

.product-card__button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.product-card__button:hover {
  background: #0056b3;
}
</style>
```

## `components/Products/ProductStock.vue`

```vue
<script setup lang="ts">
interface Props {
  stock: number
}

defineProps<Props>()

function isInStock(stock: number): boolean {
  return stock > 0
}
</script>

<template>
  <div class="product-stock">
    <span v-if="isInStock(stock)" class="product-stock__in">In stock</span>
    <span v-else class="product-stock__out">Out of stock</span>
  </div>
</template>

<style scoped>
.product-stock {
  margin-bottom: 0.5rem;
}

.product-stock__in {
  color: #28a745;
}

.product-stock__out {
  color: #dc3545;
}
</style>
```

## `components/Products/ProductDetail.vue`

```vue
<script setup lang="ts">
interface Props {
  label: string
  value: string
}

defineProps<Props>()
</script>

<template>
  <div class="product-detail">
    <span class="product-detail__label">{{ label }}</span>
    <span class="product-detail__value">{{ value }}</span>
  </div>
</template>

<style scoped>
.product-detail {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.product-detail__label {
  font-weight: 500;
}
</style>
```

## `components/Cart/CartSummary.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import CartItem from './CartItem.vue'
import { formatPrice } from '@/utils/format'

interface CartItemType {
  id: string
  name: string
  price: number
  qty: number
}

interface Props {
  items: CartItemType[]
}

interface Emits {
  remove: [productId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const total = computed(() => 
  props.items.reduce((sum, item) => sum + item.qty * item.price, 0)
)

function handleRemove(productId: string) {
  emit('remove', productId)
}
</script>

<template>
  <aside v-if="items.length" class="cart-summary">
    <h2 class="cart-summary__title">Cart ({{ items.length }})</h2>
    <div class="cart-summary__items">
      <CartItem
        v-for="item in items"
        :key="item.id"
        :item
        @remove="handleRemove"
      />
    </div>
    <div class="cart-summary__total">
      Total: {{ formatPrice(total) }}
    </div>
  </aside>
</template>

<style scoped>
.cart-summary {
  margin-top: 2rem;
  border-top: 1px solid #ccc;
  padding-top: 1rem;
}

.cart-summary__title {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.cart-summary__items {
  margin-bottom: 1rem;
}

.cart-summary__total {
  font-weight: bold;
  font-size: 1.1rem;
}
</style>
```

## `components/Cart/CartItem.vue`

```vue
<script setup lang="ts">
import { formatPrice } from '@/utils/format'

interface CartItemType {
  id: string
  name: string
  price: number
  qty: number
}

interface Props {
  item: CartItemType
}

interface Emits {
  remove: [productId: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const subtotal = computed(() => props.item.qty * props.item.price)

function handleRemove() {
  emit('remove', props.item.id)
}
</script>

<template>
  <div class="cart-item">
    <div class="cart-item__info">
      <span class="cart-item__name">{{ item.name }}</span>
      <span class="cart-item__qty">x{{ item.qty }}</span>
    </div>
    <div class="cart-item__actions">
      <span class="cart-item__subtotal">{{ formatPrice(subtotal) }}</span>
      <button class="cart-item__remove" @click="handleRemove">Remove</button>
    </div>
  </div>
</template>

<style scoped>
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.cart-item__info {
  flex: 1;
}

.cart-item__name {
  margin-right: 0.5rem;
}

.cart-item__qty {
  color: #666;
}

.cart-item__actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.cart-item__subtotal {
  font-weight: bold;
  min-width: 3rem;
  text-align: right;
}

.cart-item__remove {
  padding: 0.25rem 0.5rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.cart-item__remove:hover {
  background: #c82333;
}
</style>
```

## `composables/useCart.ts`

```typescript
import { ref, computed } from 'vue'

interface CartItem {
  id: string
  name: string
  price: number
  qty: number
}

interface Product {
  id: string
  name: string
  price: number
  [key: string]: any
}

export function useCart() {
  // Primary state
  const cart = ref<CartItem[]>([])

  // Computed state derived from cart
  const cartTotal = computed(() => 
    cart.value.reduce((sum, item) => sum + item.qty * item.price, 0)
  )

  const itemCount = computed(() => 
    cart.value.reduce((sum, item) => sum + item.qty, 0)
  )

  // Methods
  function addToCart(product: Product) {
    const existing = cart.value.find(item => item.id === product.id)
    
    if (existing) {
      existing.qty++
    } else {
      cart.value.push({
        id: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
      })
    }
  }

  function removeFromCart(productId: string) {
    const idx = cart.value.findIndex(item => item.id === productId)
    if (idx > -1) {
      cart.value.splice(idx, 1)
    }
  }

  function clearCart() {
    cart.value = []
  }

  // Return
  return {
    cart,
    cartTotal,
    itemCount,
    addToCart,
    removeFromCart,
    clearCart,
  }
}
```

## `utils/format.ts`

```typescript
/**
 * Format a number as USD currency.
 * @param value - The numeric value to format
 * @returns Formatted currency string (e.g., "$12.99")
 */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}
```

---

## Key Fixes Applied

1. **Switched to Composition API + `<script setup>`**: Replaced Options API with modern `<script setup lang="ts">`.

2. **Extracted view markup**: ProductsPage is now a pure composition surface with only component tags and control flow.

3. **Extracted components**: ProductCard, ProductStock, ProductDetail, CartSummary, CartItem, ProductsHeader, ProductsList all moved into separate components with proper `<style scoped>`.

4. **Extracted composable**: useCart() now holds cart state + mutations (addToCart, removeFromCart) — no inline state in the view.

5. **Extracted formatting**: formatPrice() utility centralizes currency formatting — no inline `{{ }}` arithmetic or `$` gluing.

6. **Fixed v-for keys**: Using stable `product.id` instead of the object itself.

7. **Fixed v-if/v-else**: ProductStock uses single `v-if/v-else` instead of two opposite `v-if` conditions.

8. **Fixed v-html sanitization**: Added DOMPurify to sanitize userBio before rendering.

9. **Macros called once**: defineProps/defineEmits each appear exactly once, at the top of `<script setup>`, before computed/watch/functions that use them.

10. **Fixed repeated markup**: Product detail rows extracted into ProductDetail component. Cart items extracted into CartItem component.

11. **No presentation in views**: ProductsPage template contains ONLY: component tags, control flow (v-if), and computed values passed as props. NO styling, NO classed divs.

12. **Proper TypeScript types**: All interfaces defined, props/emits strongly typed with generics.
