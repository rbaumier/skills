# Grade — vue e1 iter1

| id | PASS/FAIL | evidence |
|----|-----------|----------|
| composition-api | PASS | All 5 SFCs use `<script setup lang="ts">` (lines 18, 64, 98, 143, 202). No `data()`/`methods()`/`created()`/`provide()` anywhere. |
| computed-not-template | PASS | `priceWithTax = computed(() => props.product.price * (1 + props.taxRate))` (L39); `cartTotal = computed(() => props.cart.reduce(...))` (L115-117); template renders `{{ priceWithTax }}` / `{{ cartTotal }}`, no inline math. |
| no-destructure-reactive | PASS | State uses `ref<...>([])` not `reactive`; props kept as `const props = defineProps<Props>()` and accessed as `props.product` / `props.cart` (L36, L78, L113) — never destructured. |
| typed-props-emits | PASS | `const props = defineProps<Props>()` (L36) and `const emit = defineEmits<{ addToCart: [product: Product] }>()` (L37), plus typed `cartUpdated` emit (L170). |
| script-template-style-order | FAIL | In every SFC `<template>` still precedes `<script>` (e.g. ProductCard: `<template>` L3, `<script setup>` L18; same for CartItem L57/64, CartSummary L90/98, ProductsPage L127/143, PageHeader L195/202). Required order `<script>` → `<template>` → `<style>` not applied. |
| no-unsanitized-vhtml | PASS | `v-html` removed entirely — no `v-html` occurrence in the output file (only `userBio` of the original is gone, no DOMPurify needed since binding dropped). |
| stable-key | PASS | `:key="product.id"` (L132) and `:key="item.id"` (L93) — stable identifiers, not the object. |
| v-if-v-else | PASS | `<span v-if="product.stock > 0">In stock</span>` / `<span v-else>Out of stock</span>` (L8-9). Opposite conditions collapsed into v-if/v-else. |
| declarative-template | PASS | `reduce` moved into `cartTotal` computed (L115-117) and tax calc into `priceWithTax` computed (L39); template only references the computed refs. |
| views-zero-html | PASS | ProductsPage composes `<PageHeader>` (L129), `<ProductCard>` (L131), `<CartSummary>` (L139); no inline product-card/cart-summary/page__header markup or CSS in the page (only minimal structural `<div>` wrappers). |
| repeated-pattern-extracted | FAIL | ProductCard still repeats `product-card__row` 3x verbatim for Category/Weight/Rating (L11-13). No row/detail component extracted. |
| composable-extracted | FAIL | Cart state and side effects remain inline in ProductsPage: `const cart = ref<CartItem[]>([])` (L167) and `const addToCart = (product) => {...}` (L181-189). No `useCart`/composable created. |
| formatting-in-utils | FAIL | Prices still formatted inline in templates via raw number + literal `$`: `${{ priceWithTax }}` (L6), `${{ itemTotal }}` (L60), `${{ cartTotal }}` (L94). No utils module / `formatPrice` helper exists. |
| props-down-events-up | PASS | Cart passed down via prop `:cart="cart"` (L139) to CartSummary; updates flow up via `@add-to-cart="addToCart"` emit (L136-137, L37). No provide/inject. |
| provide-inject-deep-only | PASS | No `provide(` or `inject(` anywhere in the output; original `provide({ cart })` removed. |
| v-model-form-only | PASS | No `v-model` introduced anywhere; no form controls exist, consistent with the rule. |
| no-unjustified-features | PASS | No `Suspense`, `KeepAlive`, or `v-memo` present in any SFC. |

**Summary: 13 PASS / 17.**
