```vue
<!-- ProductCard.vue -->
<template>
  <div class="product-card">
    <div class="product-card__name">{{ product.name }}</div>
    <div class="product-card__price">${{ priceWithTax }}</div>
    <div class="product-card__stock">
      <span v-if="product.stock > 0">In stock</span>
      <span v-else>Out of stock</span>
    </div>
    <div class="product-card__row"><span>Category</span><span>{{ product.category }}</span></div>
    <div class="product-card__row"><span>Weight</span><span>{{ product.weight }}kg</span></div>
    <div class="product-card__row"><span>Rating</span><span>{{ product.rating }}/5</span></div>
    <button v-if="product.stock > 0" @click="handleAddToCart">Add to Cart</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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

const props = defineProps<Props>()
const emit = defineEmits<{ addToCart: [product: Product] }>()

const priceWithTax = computed(() => props.product.price * (1 + props.taxRate))

const handleAddToCart = () => {
  emit('addToCart', props.product)
}
</script>

<style scoped>
.product-card { border: 1px solid #ccc; padding: 1rem; margin: 0.5rem 0; }
.product-card__name { font-weight: bold; }
.product-card__price { color: #0066cc; }
.product-card__stock { margin: 0.5rem 0; }
.product-card__row { display: flex; justify-content: space-between; padding: 0.25rem 0; }
</style>
```

```vue
<!-- CartItem.vue -->
<template>
  <div class="cart-item">
    <span>{{ item.name }} x{{ item.qty }}</span>
    <span>${{ itemTotal }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface CartItem {
  id: string
  name: string
  qty: number
  price: number
}

interface Props {
  item: CartItem
}

const props = defineProps<Props>()

const itemTotal = computed(() => props.item.qty * props.item.price)
</script>

<style scoped>
.cart-item { display: flex; justify-content: space-between; padding: 0.5rem 0; }
</style>
```

```vue
<!-- CartSummary.vue -->
<template>
  <div class="cart-summary">
    <h2>Cart ({{ cart.length }})</h2>
    <CartItem v-for="item in cart" :key="item.id" :item="item" />
    <div>Total: ${{ cartTotal }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CartItem from './CartItem.vue'

interface CartItemWithId {
  id: string
  name: string
  qty: number
  price: number
}

interface Props {
  cart: CartItemWithId[]
}

const props = defineProps<Props>()

const cartTotal = computed(() =>
  props.cart.reduce((sum, item) => sum + item.qty * item.price, 0)
)
</script>

<style scoped>
.cart-summary { margin-top: 2rem; border-top: 1px solid #ccc; padding-top: 1rem; }
</style>
```

```vue
<!-- ProductsPage.vue -->
<template>
  <div>
    <PageHeader title="Products" :item-count="products.length" />
    <div>
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :tax-rate="taxRate"
        @add-to-cart="addToCart"
      />
    </div>
    <CartSummary :cart="cart" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProductCard from './ProductCard.vue'
import CartSummary from './CartSummary.vue'
import PageHeader from './PageHeader.vue'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  weight: number
  rating: number
}

interface CartItem {
  id: string
  name: string
  price: number
  qty: number
}

const products = ref<Product[]>([])
const cart = ref<CartItem[]>([])
const taxRate = 0.1

const emit = defineEmits<{ cartUpdated: [cart: CartItem[]] }>()

onMounted(() => {
  fetchProducts()
})

const fetchProducts = async () => {
  const res = await fetch('/api/products')
  products.value = await res.json()
}

const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.id === product.id)
  if (existing) {
    existing.qty++
  } else {
    cart.value.push({ id: product.id, name: product.name, price: product.price, qty: 1 })
  }
  emit('cartUpdated', cart.value)
}
</script>
```

```vue
<!-- PageHeader.vue -->
<template>
  <div class="page__header">
    <h1 class="page__title">{{ title }}</h1>
    <span>{{ itemCount }} items</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  itemCount: number
}

defineProps<Props>()
</script>

<style scoped>
.page__header { display: flex; justify-content: space-between; margin-bottom: 1rem; }
.page__title { font-size: 1.5rem; }
</style>
```
