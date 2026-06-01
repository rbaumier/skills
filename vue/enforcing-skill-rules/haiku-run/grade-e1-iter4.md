# Grade — vue / e1 / iter4

Strict grading: PASS only if the violation is clearly corrected in the actual code (with citation).

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | composition-api | PASS | All SFCs use `<script setup lang="ts">` (line 6, 66, 102, 154, 253, 290, 322, 397). No Options API anywhere. |
| 2 | computed-not-template | PASS | `priceWithTax = computed(...)` (182-184), `total = computed(...)` (345-347); template renders `formatPrice(priceWithTax)` / `formatPrice(total)`, no inline arithmetic. |
| 3 | no-destructure-reactive | PASS | State uses `ref` (508), no `reactive()` objects; `useCart()` returns refs, no destructuring of a reactive object. |
| 4 | typed-props-emits | PASS | `defineProps<Props>()` + `defineEmits<Emits>()` with TS generics (122-123, 179-180, 342-343, 415-416). No `this.$emit`. |
| 5 | script-template-style-order | PASS | Every SFC ordered script → template → style (e.g. 6/53/81, 154/193/213). |
| 6 | no-unsanitized-vhtml | PASS | `getSanitizedBio()` returns `DOMPurify.sanitize(userBio.value)` (48-49), used in `v-html="getSanitizedBio()"` (57). |
| 7 | stable-key | PASS | `:key="product.id"` (135) and `:key="item.id"` (361), not the object. |
| 8 | v-if-v-else | PASS | ProductStock uses `v-if="isInStock(stock)"` / `v-else` (267-268); single condition, no opposite duplicate. |
| 9 | declarative-template | PASS | reduce + tax calc moved to script computeds (182-184, 345-347, 511-513). |
| 10 | views-zero-html | PASS | ProductsPage template is component tags + control flow only (53-60); no classed product/cart divs. |
| 11 | repeated-pattern-extracted | PASS | `ProductDetail` component reused 3x for Category/Weight/Rating (199-201). |
| 12 | composable-extracted | PASS | `composables/useCart.ts` holds `cart` state + `addToCart`/`removeFromCart` (506-555); consumed via `useCart()` (25). |
| 13 | formatting-in-utils | PASS | `formatPrice` in `utils/format.ts` (566-571); no inline `$`/arithmetic formatting in templates. |
| 14 | props-down-events-up | PASS | Cart passed down as `:items="cart"` (58); mutations via `@remove`/`@add-to-cart` emits. No provide/inject. |
| 15 | provide-inject-deep-only | PASS | No `provide()`/`inject()` anywhere in the output. |
| 16 | v-model-form-only | PASS | No `v-model` used; no form controls added. |
| 17 | no-unjustified-features | PASS | No Suspense, KeepAlive, or v-memo present. |

**Result: 17/17 PASS.**

Note (not an assertion failure): `CartItem.vue` calls `computed()` (418) but only imports `formatPrice` (398), missing `import { computed } from 'vue'` — a real bug, but no assertion targets import correctness, and assertion #2 only requires the computation use `computed()` rather than inline (satisfied).
