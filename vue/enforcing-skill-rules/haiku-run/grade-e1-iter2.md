# Grade: out-e1-iter2.md

Strict grading. Each assertion judged only on the final code. Citations from the actual files.

| # | ID | Verdict | Evidence / Reasoning |
|---|----|---------|----------------------|
| 1 | composition-api | PASS | All SFCs open with `<script setup lang="ts">` (lines 2, 186, 289, 325). No `export default`, no `data()/methods()/created()`. Options API fully removed. |
| 2 | computed-not-template | PASS | Cart total via `cartTotal` computed (line 24-26) and `formattedCartTotal` (line 28); template only renders `{{ formattedCartTotal }}` (line 74). Taxed price via `priceWithTax` computed in ProductCard (line 213-215), template renders `{{ formattedPrice }}` (line 230). No inline arithmetic in templates. |
| 3 | no-destructure-reactive | PASS | Cart is `ref<CartItem[]>([])` (line 137), not `reactive()`. `useCart()` returns an object and is consumed via property access `{ cart, addToCart, removeFromCart }` returned from a function — this is destructuring of a plain return object (refs preserved), not destructuring of a `reactive()` object, which is the documented safe pattern. No `reactive()` destructuring anywhere. |
| 4 | typed-props-emits | FAIL | Intent present but code is broken/duplicated. ProductCard declares `defineProps<Props>()` AND `defineEmits<Emits>()` twice (lines 210-211 then again 223-224) and references `props`/`emit` before their declaration (lines 213, 219, 221 use `props` but `const props = defineProps` is line 224). CartItem has the same duplication (lines 344-345 then 350-351) with `props` used at line 347 before declared at 350. This does not compile (`defineProps`/`defineEmits` can each be called only once; temporal-dead-zone reference error). A broken implementation is not a clean correction. |
| 5 | script-template-style-order | PASS | Every SFC orders `<script setup>` → `<template>` → `<style scoped>` (main: 2/44/81; ProductCard: 186/227/248; ProductDetailRow: 289/298/305; CartItem: 325/354/370). |
| 6 | no-unsanitized-vhtml | PASS | No `v-html` anywhere in the output. `userBio` is gone entirely. Violation removed. |
| 7 | stable-key | PASS | All `v-for` use stable ids: `:key="product.id"` (line 54), `:key="item.id"` (line 69). No object-as-key. |
| 8 | v-if-v-else | PASS | Stock rendering uses `<span v-if="isInStock">In stock</span><span v-else>Out of stock</span>` (lines 232-233). Opposite conditions replaced by v-if/v-else. (Note: `isOutOfStock` computed at line 221 is now dead/unused, but the assertion target is satisfied.) |
| 9 | declarative-template | PASS | `reduce` moved to `cartTotal` computed (line 25); tax calc moved to `priceWithTax` computed (line 214); item total moved to `itemTotal` computed (CartItem line 347). No complex expressions remain in templates. |
| 10 | views-zero-html | FAIL | Page-level component still renders raw HTML/CSS, not only components. The `cart-summary` section is built inline with raw `<section>`, `<h2>`, `<div class="cart-empty">`, `<div class="cart-total">` markup plus a full `<style scoped>` block for `.page__header`, `.cart-summary`, `.cart-empty`, `.cart-total` (lines 61-77, 81-114). The assertion requires the page view to use components (e.g. CartSummary); the cart summary was NOT extracted into a component. Only ProductCard was extracted. Partial, not corrected. |
| 11 | repeated-pattern-extracted | PASS | The 3x repeated `product-card__row` is replaced by `<ProductDetailRow>` used 3 times (lines 235-237) with the row extracted into `components/ProductDetailRow.vue` (lines 288-320). |
| 12 | composable-extracted | PASS | Cart state + addToCart/removeFromCart extracted into `composables/useCart.ts` (lines 119-165) and consumed via `const { cart, addToCart, removeFromCart } = useCart()` (line 22). No inline cart logic, no `provide()`. |
| 13 | formatting-in-utils | PASS | Price formatting in `utils/format.ts` `formatPrice` (lines 171-176); weight formatting `formatWeight` (lines 178-180). Used via computed `formatPrice(...)`. No inline price formatting in templates. |
| 14 | props-down-events-up | PASS | `product`/`taxRate` passed down as props (lines 55-56), updates flow up via `@add-to-cart` / `@remove` emits (lines 57, 71). No provide/inject for cart sharing. |
| 15 | provide-inject-deep-only | PASS | No `provide`/`inject` anywhere in the output. The original provide/inject for parent-child is removed. |
| 16 | v-model-form-only | PASS | No `v-model` used anywhere, and there are no form controls. Correctly not added where unjustified. |
| 17 | no-unjustified-features | PASS | No `Suspense`, `KeepAlive`, or `v-memo` present. No unjustified features added. |

## Notes on FAILs

- **typed-props-emits**: The TypeScript-generic intent is visible, but the code is non-compiling: `defineProps`/`defineEmits` are each called twice in both ProductCard and CartItem, and `props`/`emit` are referenced above their declarations (TDZ). A correction that does not run is not a clean correction. FAIL.
- **views-zero-html**: The cart summary remains raw HTML + scoped CSS in the page-level view; it was not extracted into a CartSummary component. The "page renders raw HTML" violation is only partially addressed. FAIL.

{"passed":15,"total":17,"fails":[{"id":"typed-props-emits","why":"defineProps/defineEmits each called twice in ProductCard.vue (210-211,223-224) and CartItem.vue (344-345,350-351); props/emit referenced before declaration (TDZ). Non-compiling, not a clean correction."},{"id":"views-zero-html","why":"Page-level view still renders cart summary as raw HTML (section/h2/div lines 61-77) with scoped CSS (81-114); only ProductCard extracted, no CartSummary component."}]}
