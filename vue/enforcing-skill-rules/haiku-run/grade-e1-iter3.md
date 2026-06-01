# Grade — vue / e1 / iter3

Code: `out-e1-iter3.md` vs `assertions-e1.json`. STRICT.

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | composition-api | PASS | Every SFC opens with `<script setup lang="ts">` (e.g. ProductCard L132, ProductsPage L330). No `export default { data/methods/created/provide }` anywhere. |
| 2 | computed-not-template | PASS | Taxed price via `priceWithTax = computed(() => formatPrice(...))` L156-158; cart total via `total = computed(() => formatCartTotal(props.items))` L278. Templates render `{{ priceWithTax }}` / `{{ total }}`. |
| 3 | no-destructure-reactive | PASS | State is `ref<T[]>([])` not `reactive()` (useCart L56, useProducts L18). Composable returns are destructured but those are refs, not reactive objects; props read via `props.product` (L156,160), never destructured. No `reactive()` destructuring present. |
| 4 | typed-props-emits | PASS | `defineProps<{...}>` and `defineEmits<{ addToCart: [product: Product] }>` with TS generics (ProductCard L147-154; CartSummary L270-276). No `this.$emit`. |
| 5 | script-template-style-order | PASS | Every SFC orders `<script setup>` → `<template>` → `<style scoped>` (ProductCard L132/167/182; CartSummary L258/285/304). |
| 6 | no-unsanitized-vhtml | PASS | No `v-html` in any file (grep-confirmed below). `userBio` removed entirely (noted L434). Violation eliminated. |
| 7 | stable-key | PASS | `:key="product.id"` (ProductsPage L356), `:key="item.id"` (CartSummary L293). No object-as-key. |
| 8 | v-if-v-else | PASS | Stock rendered with `<span v-if="isInStock">In stock</span><span v-else>Out of stock</span>` (ProductCard L172-174). Opposite-condition pair replaced with v-if/v-else. |
| 9 | declarative-template | PASS | `reduce` lives in `formatCartTotal` (formatters L96); tax calc in `formatPrice` (L81). Templates have no reduce/tax expressions. (Minor `(qty*price).toFixed(2)` remains in CartItemRow L234 — simple display arithmetic, not the flagged complex expressions; the two named traps are gone.) |
| 10 | views-zero-html | FAIL | ProductsPage still renders a layout wrapper plus raw structural HTML: `<div class="page-container">` (L350) and `<div class="products-list">` (L353) with its own `<style scoped>` grid CSS (L367-380). Assertion requires page-level view to use components, not raw HTML/CSS. The view still owns markup and styling beyond pure component composition. |
| 11 | repeated-pattern-extracted | PASS | `product-card__row` (Category/Weight/Rating) extracted into `ProductDetailRow.vue`, used 3x (ProductCard L175-177). |
| 12 | composable-extracted | PASS | Cart state + addToCart/removeFromCart extracted into `useCart.ts` (L55-75). No inline cart reactive/provide in the view. |
| 13 | formatting-in-utils | PASS | Price/weight/total formatting in `utils/formatters.ts` (L80-98); components import and call them. |
| 14 | props-down-events-up | PASS | Cart flows down as `:items="cart"`, updates up via `@removeItem`/`@addToCart` emits (ProductsPage L354-363). No provide/inject for cart. |
| 15 | provide-inject-deep-only | PASS | No `provide`/`inject` calls anywhere (grep-confirmed). |
| 16 | v-model-form-only | PASS | No `v-model` anywhere; no form inputs added (grep-confirmed). |
| 17 | no-unjustified-features | PASS | No `Suspense`, `KeepAlive`, or `v-memo` anywhere (grep-confirmed). |

**Passed: 16 / 17**

## Notes / risks
- ProductsPage uses `tax-rate="0.1"` (L358) — a string literal bound statically, not `:tax-rate="0.1"`. Type would be string, not number. Not covered by any assertion, so not graded, but a real defect.
- `handleAddToCart(product: any)` (L340) uses `any`. Not graded (typed-props-emits is about defineProps/defineEmits, which pass).
- views-zero-html graded FAIL: the page view still contains raw `<div>` layout markup and scoped grid CSS rather than delegating to components only.
