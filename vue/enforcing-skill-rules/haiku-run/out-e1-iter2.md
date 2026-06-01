```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCart } from '@/composables/useCart'
import { formatPrice } from '@/utils/format'
import ProductCard from './ProductCard.vue'
import ProductDetailRow from './ProductDetailRow.vue'
import CartItem from './CartItem.vue'

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
const taxRate = ref(0.1)
const { cart, addToCart, removeFromCart } = useCart()

const cartTotal = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.qty * item.price, 0)
})

const formattedCartTotal = computed(() => formatPrice(cartTotal.value))

onMounted(async () => {
  const res = await fetch('/api/products')
  products.value = await res.json()
})

const handleAddToCart = (product: Product) => {
  addToCart(product)
}

const handleRemoveFromCart = (productId: string) => {
  removeFromCart(productId)
}
</script>

<template>
  <div>
    <header class="page__header">
      <h1 class="page__title">Products</h1>
      <span>{{ products.length }} items</span>
    </header>

    <div class="products-list">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :tax-rate="taxRate"
        @add-to-cart="handleAddToCart"
      />
    </div>

    <section class="cart-summary">
      <h2>Cart ({{ cart.length }})</h2>
      <div v-if="cart.length === 0" class="cart-empty">
        Your cart is empty
      </div>
      <div v-else>
        <CartItem
          v-for="item in cart"
          :key="item.id"
          :item="item"
          @remove="handleRemoveFromCart"
        />
        <div class="cart-total">
          Total: {{ formattedCartTotal }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page__title {
  font-size: 1.5rem;
}

.products-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cart-summary {
  margin-top: 2rem;
  border-top: 1px solid #ccc;
  padding-top: 1rem;
}

.cart-empty {
  color: #999;
  padding: 1rem;
}

.cart-total {
  font-weight: bold;
  padding: 1rem 0;
  border-top: 1px solid #ddd;
}
</style>
```

**composables/useCart.ts:**

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
  stock: number
}

export function useCart() {
  const cart = ref<CartItem[]>([])

  const addToCart = (product: Product) => {
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

  const removeFromCart = (productId: string) => {
    const idx = cart.value.findIndex(item => item.id === productId)
    if (idx > -1) {
      cart.value.splice(idx, 1)
    }
  }

  return {
    cart,
    addToCart,
    removeFromCart,
  }
}
```

**utils/format.ts:**

```typescript
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

export function formatWeight(weight: number): string {
  return `${weight}kg`
}
```

**components/ProductCard.vue:**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'
import ProductDetailRow from './ProductDetailRow.vue'

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

defineProps<Props>()
defineEmits<Emits>()

const priceWithTax = computed(() => {
  return props.product.price * (1 + props.taxRate)
})

const formattedPrice = computed(() => formatPrice(priceWithTax.value))

const isInStock = computed(() => props.product.stock > 0)

const isOutOfStock = computed(() => props.product.stock <= 0)

const emit = defineEmits<Emits>()
const props = defineProps<Props>()
</script>

<template>
  <div class="product-card">
    <div class="product-card__name">{{ product.name }}</div>
    <div class="product-card__price">{{ formattedPrice }}</div>
    <div class="product-card__stock">
      <span v-if="isInStock">In stock</span>
      <span v-else>Out of stock</span>
    </div>
    <ProductDetailRow label="Category" :value="product.category" />
    <ProductDetailRow label="Weight" :value="formatWeight(product.weight)" />
    <ProductDetailRow label="Rating" :value="`${product.rating}/5`" />
    <button
      v-if="isInStock"
      @click="$emit('addToCart', product)"
      class="add-to-cart-btn"
    >
      Add to Cart
    </button>
  </div>
</template>

<style scoped>
.product-card {
  border: 1px solid #ccc;
  padding: 1rem;
  margin: 0.5rem 0;
  border-radius: 4px;
}

.product-card__name {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.product-card__price {
  font-size: 1.25rem;
  color: #2c5f2d;
  margin-bottom: 0.5rem;
}

.product-card__stock {
  margin-bottom: 1rem;
}

.add-to-cart-btn {
  background: #007bff;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-to-cart-btn:hover {
  background: #0056b3;
}
</style>
```

**components/ProductDetailRow.vue:**

```vue
<script setup lang="ts">
interface Props {
  label: string
  value: string
}

defineProps<Props>()
</script>

<template>
  <div class="product-detail-row">
    <span class="label">{{ label }}</span>
    <span class="value">{{ value }}</span>
  </div>
</template>

<style scoped>
.product-detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.label {
  font-weight: 500;
}

.value {
  color: #666;
}
</style>
```

**components/CartItem.vue:**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'

interface CartItemData {
  id: string
  name: string
  price: number
  qty: number
}

interface Props {
  item: CartItemData
}

interface Emits {
  remove: [productId: string]
}

defineProps<Props>()
defineEmits<Emits>()

const itemTotal = computed(() => props.item.qty * props.item.price)
const formattedTotal = computed(() => formatPrice(itemTotal.value))

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <div class="cart-item">
    <div class="cart-item__info">
      <span class="cart-item__name">{{ item.name }}</span>
      <span class="cart-item__qty">x{{ item.qty }}</span>
    </div>
    <div class="cart-item__price">{{ formattedTotal }}</div>
    <button
      @click="$emit('remove', item.id)"
      class="cart-item__remove"
    >
      Remove
    </button>
  </div>
</template>

<style scoped>
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #eee;
}

.cart-item__info {
  flex: 1;
}

.cart-item__name {
  margin-right: 1rem;
  font-weight: 500;
}

.cart-item__qty {
  color: #666;
}

.cart-item__price {
  font-weight: bold;
  margin: 0 1rem;
}

.cart-item__remove {
  background: #dc3545;
  color: white;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.875rem;
}

.cart-item__remove:hover {
  background: #c82333;
}
</style>
```
