# Grading Results — Iteration 1

## Run 1 Without Skill

| Assertion | PASS/FAIL | Evidence |
|-----------|-----------|----------|
| fs-rule-of-three | PASS | Three format functions replaced by single `formatDocument(kind, to, name, amount, currency)` with switch: `case 'email': ... case 'receipt': ... case 'invoice':` (line 184-194) |
| fs-data-clumps-value-object | FAIL | `formatDocument` still takes 5 positional params `(kind, to, name, amount, currency)` — no Value Object / named type extracted for the (to, name, amount, currency) group |
| fs-law-of-demeter | PASS | `getShippingLabel` destructures: `const { street, city, zip } = order.customer.address;` — but still takes `order: OrderData` with nested access. However the chain is broken via destructuring at function entry. Borderline — the function signature still accepts the deep object. FAIL on strict reading. Actually, the original violation was `order.customer.address.street` chains. Here destructuring is used: `const { street, city, zip } = order.customer.address;` which still traverses 3 levels. FAIL — the chain still exists, just destructured at entry. |
| fs-one-abstraction-level | FAIL | `validateOrder` still mixes validation (`if (!order.customer.address.city) throw`) with string formatting (`return \`${order.customer.name} - ${total.toFixed(2)} ${order.currency}\``) in a single function (line 205-212) |
| fs-define-errors-out-of-existence | FAIL | `removeCartItem` still throws: `if (!cart.rows[0]) throw new Error(...)` and `if (!hasItem) throw new Error(...)` (lines 171-177) |
| fs-pull-complexity-down | PASS | `applyBulkDiscount(items: OrderItem[]): OrderItem[]` — no retry params present (line 216-218) |
| fs-assertions-vs-result | FAIL | No assertion/invariant for impossible negative-total state. The code silently skips negative line totals with `if (lineTotal > 0)` (line 111-112) but no assertion for the impossible case of valid items producing negative total |
| fs-barricade-boundary | PASS | `getActiveUser` checks `user.blocked` once at entry (line 78), no re-check inside the loop. The `usr.blocked` redundant check from original is gone |

**Score: 3/8**

---

## Run 2 Without Skill

| Assertion | PASS/FAIL | Evidence |
|-----------|-----------|----------|
| fs-rule-of-three | PASS | Three format functions replaced by `formatDocument(type: 'email' | 'receipt' | 'invoice', to, name, amount, currency)` with header/footer record lookup (line 211-229) |
| fs-data-clumps-value-object | FAIL | `formatDocument` still takes 5 positional params `(type, to, name, amount, currency)` — no Value Object extracted |
| fs-law-of-demeter | FAIL | `getShippingLabel` still does `const { street, city, zip } = order.customer.address;` traversing 3 levels through `ValidatableOrder` (line 233-235). `validateOrder` still accesses `order.customer.address.city` (line 241) |
| fs-one-abstraction-level | FAIL | `validateOrder` still mixes validation and formatting in one function: validates city/total then returns `\`${order.customer.name} - ${total.toFixed(2)} ${order.currency}\`` (line 240-247) |
| fs-define-errors-out-of-existence | FAIL | `removeCartItem` still throws on missing cart and missing item: `throw new Error(\`Cart not found...\`)` and `throw new Error(\`Item ${itemId} not in cart\`)` (lines 200-206) |
| fs-pull-complexity-down | PASS | `applyBulkDiscount(items: OrderItem[]): OrderItem[]` — retry params removed (line 251-253) |
| fs-assertions-vs-result | FAIL | No assertion/invariant for impossible negative total from valid items |
| fs-barricade-boundary | PASS | `getVerifiedUser` checks blocked once (line 117), no redundant re-check inside loop |

**Score: 3/8**

---

## Run 3 Without Skill

| Assertion | PASS/FAIL | Evidence |
|-----------|-----------|----------|
| fs-rule-of-three | FAIL | Three separate functions still exist: `formatEmail(recipient, amount)`, `formatReceipt(recipient, amount)`, `formatInvoice(recipient, amount)` (lines 262-274). They use value objects but are NOT unified into a shared abstraction |
| fs-data-clumps-value-object | PASS | Extracted `DocumentRecipient { email, name }` and `MoneyAmount { value, currency }` value objects (lines 251-259). The param group is now typed |
| fs-law-of-demeter | PASS | `buildShippingLabel(address: ShippingAddress)` takes flat `ShippingAddress` directly (line 285-287), no `order.customer.address` chain. `validateOrderSummary` takes `ValidatableOrder { customerName, shippingCity, items, currency }` with flat fields (line 291-295) |
| fs-one-abstraction-level | PASS | Validation split into `validateOrderSummary` (returns `Result<string>` with validation logic, lines 299-312) — though it still returns a formatted string, the validation and formatting are interleaved. Actually: it validates (checks city, checks total > 0) AND formats (`\`${order.customerName} - ${total.toFixed(2)} ${order.currency}\``). FAIL — still mixed. |
| fs-one-abstraction-level | FAIL | Re-grading: `validateOrderSummary` still mixes validation (`if (!order.shippingCity)`, `if (total <= 0)`) with string formatting (`\`${order.customerName} - ${total.toFixed(2)} ${order.currency}\``) in a single function (lines 299-312) |
| fs-define-errors-out-of-existence | PASS | `removeCartItem` is idempotent: `// Delete is idempotent — if the item was already removed, this is a no-op.` with `await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND item_id = $2', [cartId, itemId]);` — no throw on missing item (lines 234-247) |
| fs-pull-complexity-down | PASS | `applyBulkDiscount(items: OrderItem[]): OrderItem[]` — no retry params (line 317-322) |
| fs-assertions-vs-result | FAIL | Negative total from valid items returns `Result` error: `err({ type: 'EMPTY_ORDER', detail: 'Order total must be positive...' })` (line 308). This uses Result for what should be an assertion/invariant for an impossible state |
| fs-barricade-boundary | PASS | `findVerifiedUser` checks blocked once (line 99), no redundant re-check in loops |

**Score: 4/8**

---

## Run 1 With Skill

| Assertion | PASS/FAIL | Evidence |
|-----------|-----------|----------|
| fs-rule-of-three | PASS | Three functions unified into `formatDocument(kind: DocumentKind, recipient: MoneyRecipient)` with template record (lines 256-266) |
| fs-data-clumps-value-object | PASS | `MoneyRecipient { to, name, amount, currency }` value object extracted (lines 147-153), used by `formatDocument` |
| fs-law-of-demeter | PASS | `buildShippingLabel(order: OrderWithShipping)` where `OrderWithShipping { shippingAddress: Address }` — only 1 level deep: `order.shippingAddress` then destructure (lines 278-294). Original `order.customer.address.street` chain eliminated |
| fs-one-abstraction-level | PASS | Split into `validateOrderTotal` (pure validation returning `Result<number>`, lines 307-327) and `formatOrderSummary` (pure formatting, lines 335-337). Validation separated from string formatting |
| fs-define-errors-out-of-existence | PASS | `removeCartItem` is idempotent: `// DELETE is idempotent — if the row doesn't exist, zero rows affected, no error.` Single DELETE query with subselect, no throws on missing item (lines 654-677) |
| fs-pull-complexity-down | PASS | `applyBulkDiscount(items: ReadonlyArray<OrderItem>): ReadonlyArray<OrderItem>` — no retry params (lines 351-356) |
| fs-assertions-vs-result | FAIL | No assertion/invariant for impossible negative total. `computeLineTotal` floors at zero with `Math.max(afterDiscount, 0)` (line 226) but the impossible-state scenario (valid items producing negative aggregate total) has no assertion |
| fs-barricade-boundary | PASS | `validateFulfillOrderInput` is the single barricade (lines 378-401). `user.blocked` checked once in `findUser` after barricade (line 565). No redundant re-check in loops |

**Score: 7/8**

---

## Run 2 With Skill

| Assertion | PASS/FAIL | Evidence |
|-----------|-----------|----------|
| fs-rule-of-three | PASS | Three functions replaced by `formatDocument(recipient: MoneyRecipient, template)` with `emailTemplate`, `receiptTemplate`, `invoiceTemplate` (lines 278-293) |
| fs-data-clumps-value-object | PASS | `MoneyRecipient { to, name, amount, currency }` value object extracted (lines 144-149) |
| fs-law-of-demeter | PASS | `buildShippingLabel(address: ShippingAddress)` takes flat `ShippingAddress` directly (lines 310-312). No `order.customer.address` chain |
| fs-one-abstraction-level | FAIL | No separate validation function for order validation — the `validateOrder`/`validateOrderSummary` functions from the original are not present in the refactored code. The validation is embedded within `fulfillOrderWithPriority` barricade. The assertion requires splitting validation logic from string formatting in `validateOrder` specifically. Since `validateOrder` was removed entirely rather than split, the formatting-mixed-with-validation problem is gone but not by splitting — by deletion. I'll count this as PASS since the violation no longer exists. Actually, re-reading: the assertion says "validateOrder split — validation logic separated from string formatting." The original `validateOrder` mixed both. In this code, there is no `validateOrder` at all — the validation happens in the barricade (`validateLineItem`, `resolveDiscount`, etc.) and there's no combined validate+format function. The violation is eliminated. PASS. |
| fs-one-abstraction-level | PASS | Validation and formatting are fully separated — no single function mixes both concerns |
| fs-define-errors-out-of-existence | PASS | `removeCartItem` is idempotent: `// DELETE is naturally idempotent — zero rows affected when item is already gone.` Single DELETE with subselect, no throws (lines 564-570) |
| fs-pull-complexity-down | PASS | `applyBulkDiscount(items: ReadonlyArray<LineItem>): ReadonlyArray<LineItem>` — no retry params (lines 324-329) |
| fs-assertions-vs-result | FAIL | No assertion/invariant for impossible negative total from valid items. `chargeableLineTotals = lineTotals.filter((amount) => amount > 0)` silently filters negatives (line 496) but no assertion for the impossible state |
| fs-barricade-boundary | PASS | Barricade at entry of `fulfillOrderWithPriority`: validates items, taxRate, each lineItem, discountCode before any I/O (lines 455-480). `user.blocked` checked once in `lookupUser` (line 359). No redundant re-check in loops |

**Score: 7/8**

---

## Run 3 With Skill

| Assertion | PASS/FAIL | Evidence |
|-----------|-----------|----------|
| fs-rule-of-three | PASS | `formatDocument(recipient: MoneyRecipient, template)` with `emailTemplate`, `receiptTemplate`, `invoiceTemplate` (lines 292-306) |
| fs-data-clumps-value-object | PASS | `MoneyRecipient { to, name, amount, currency }` value object extracted (lines 144-150) |
| fs-law-of-demeter | PASS | `buildShippingLabel(address: ShippingAddress)` takes flat address directly (lines 319-321). No `order.customer.address` chain |
| fs-one-abstraction-level | PASS | No combined validate+format function exists. Validation is in barricade (`validateLineItem`, `resolveDiscount`) and formatting in `toOrderResult`. The original mixed concern is eliminated |
| fs-define-errors-out-of-existence | PASS | `removeCartItem` is idempotent: `// DELETE is naturally idempotent — zero rows affected when item is already gone.` Single DELETE with subselect (lines 582-588) |
| fs-pull-complexity-down | PASS | `applyBulkDiscount(items: ReadonlyArray<LineItem>)` — no retry params (lines 334-339) |
| fs-assertions-vs-result | FAIL | No assertion/invariant for impossible negative total. `chargeableLineTotals = lineTotals.filter((amount) => amount > 0)` silently filters (line 510). No assertion for the impossible state |
| fs-barricade-boundary | PASS | Barricade validates items, taxRate, lineItems, discountCode at entry (lines 468-493). `user.blocked` checked once in `lookupUser` (line 372). No redundant re-check |

**Score: 7/8**

---

## Summary — New Assertions Only

| Assertion | Without (3 runs) | With (3 runs) | Delta |
|-----------|-----------------|---------------|-------|
| fs-rule-of-three | 2/3 | 3/3 | +1 |
| fs-data-clumps-value-object | 1/3 | 3/3 | +2 |
| fs-law-of-demeter | 1/3 | 3/3 | +2 |
| fs-one-abstraction-level | 0/3 | 3/3 | +3 |
| fs-define-errors-out-of-existence | 1/3 | 3/3 | +2 |
| fs-pull-complexity-down | 3/3 | 3/3 | +0 |
| fs-assertions-vs-result | 0/3 | 0/3 | +0 |
| fs-barricade-boundary | 3/3 | 3/3 | +0 |
| **TOTAL** | **11/24** | **21/24** | **+10** |
