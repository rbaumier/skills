# Grade — coding-standards eval 12 iter1 (STRICT)

Code: `out-e12-iter1.md` — graded vs `assertions-e12.json`. PASS only if violation CLEARLY fixed in real code (cited). FAIL on doubt.

| ID | Verdict | Evidence |
|----|---------|----------|
| fs-module-orientation | FAIL | No module-level doc comment explaining what the module does + how. Top of file is bare imports then `// Types & Constants` banner. Function comments are terse labels (e.g. L75 `// Apply bulk discount to items`), not "what + how" doc comments. |
| fs-consequence-comments | FAIL | Comments still describe mechanics, not consequences. L253 `// Cache the order for quick user profile lookup` is close but L231 `// Validate user exists and is not blocked`, L237 `// Verify stock availability`, L240 `// Create order record` are all mechanics. |
| fs-term-explanations | FAIL | `big_orders` table (L168) and the 1000 threshold (L160) appear with no explanation of the "large order" domain concept. No comment defines what a big/large order means or why it matters. |
| fs-conversational-tone | FAIL | Comments remain terse mechanical labels: L237 `// Verify stock availability`, L240 `// Create order record`, L243 `// Notify for large orders`. Not conversational. |
| fs-inaction-justified | FAIL | Multiple early returns with no "why". L162 `if (total <= LARGE_ORDER_THRESHOLD) return;` no explanation. L202 `if (!shouldNotify ...) return;` no why. L141 `continue` has `// Skip inactive or invalid items` (mechanic, not why). Not justified. |
| fs-next-caller-effect | FAIL | L214-217 `updateUserCache` sets cache but no comment on what the next caller/reader sees. L253 call-site comment `// Cache the order for quick user profile lookup` is mechanics, not "next caller sees X". |
| fs-return-value-intent | FAIL | `return order` (L256), `return user` (L125), `return { processed, total }` (L152) — no doc of what caller should do with the value. |
| fs-limits-explained | FAIL | L160 `LARGE_ORDER_THRESHOLD: number = 1000` — no comment explaining WHY 1000 is the threshold. The number is named but the rationale is absent. |
| fs-jsdoc-with-example | FAIL | `handleOrderData` (L226) has only line comments, no JSDoc block with `@example` and return value. Same for `removeCartItem`. |
| fs-naming-intent | FAIL | Function still named `handleOrderData` — banned words "handle" and "data" both retained (L226). Abbreviations fixed (no usr/itm/amt) but the core rename did NOT happen. |
| fs-boolean-prefix | PASS | Booleans use prefixes: `isUrgent` (L32), `shouldNotifyCustomer` (L33), `active`/`blocked` are adjectives. `sendEmail` boolean renamed to `shouldNotifyCustomer`. Positive form. |
| fs-symmetry | FAIL | `cache.set` (L216) has no corresponding `cache.get` anywhere. INSERT/UPDATE used but no symmetric read accessor. Pairing not consistent. |
| fs-no-boolean-flags | FAIL | `isUrgent` and `shouldNotifyCustomer` are still boolean params inside `HandleOrderOptions` (L32-33) AND they still branch internal behavior: `createOrder` takes `isUrgent` (L178) and branches L186; `sendConfirmation` takes `shouldNotify` (L198) and branches L202. Not split into separate functions; bundling into an options object does not satisfy "split behavior". The internal branching on the flags remains. |
| fs-guard-clauses | PASS | Loop body flattened with guard `if (!item.active \|\| item.qty <= 0 \|\| item.price < 0) continue;` (L141) then linear. Max indent ~3 levels. No nested if/else pyramid. |
| fs-switch-or-map | PASS | Nested ternary replaced by `DISCOUNT_AMOUNTS` map (L25-28), looked up at L135 `DISCOUNT_AMOUNTS[discountCode \|\| ''] \|\| 0`. |
| fs-immutable | FAIL | `let total = 0; total += amount` still mutates an accumulator inside the loop in `processItems` (L137, L148). Also `processed.push(...)` (L147) mutates the array. The accumulator mutation the assertion targets remains. |
| fs-promise-all | FAIL | `verifyStock` (L98-109) still awaits `db.query` sequentially inside a `for` loop. No `Promise.all`. |
| fs-factory-di | FAIL | `db`, `cache`, `mailer` still hardcoded global imports (L1-3). No factory/injection. |
| fs-extract-by-responsibility | PASS | `handleOrderData` split into named operations: `validateUser`, `processItems`, `verifyStock`, `createOrder`, `notifyLargeOrder`, `sendConfirmation`, `updateUserCache`. At minimum fetch user / price items / persist / notify are separate named functions. |
| fs-max-3-args | PASS | 7 positional args replaced: `handleOrderData(userId, items, options)` (L226-230) with `HandleOrderOptions` object. |
| fs-srp-cqs | PASS | Order creation (`createOrder`, command) is separated from notification side-effects (`notifyLargeOrder`, `sendConfirmation`) into distinct functions. |
| fs-named-constants | PASS | `1000` → `LARGE_ORDER_THRESHOLD` (L160), `50/20` → `DISCOUNT_AMOUNTS` map (L25-28). `0.9` → `DISCOUNT_RATE` (L78). |
| fs-strict-typing | FAIL | `validateOrder(order: any)` (L342) still uses `any`, and its reducer uses `(item: any)` (L352). OrderStatus/`status` is typed as bare `string` (L66 `status: string`). `any` not eliminated. |
| fs-externalize-config | FAIL | Discount codes still hardcoded in module body (`DISCOUNT_AMOUNTS` literal L25-28) and `LARGE_ORDER_THRESHOLD = 1000` inline default (L160). Not externalized to config; just moved to module-level constants in the same file. |
| fs-bound-inputs | FAIL | No validation rejecting empty `items` array or negative qty at the boundary — `processItems` just `continue`s on bad items (L141, a silent skip, not a rejection). And L135 uses `\|\| 0` / `\|\| ''` fallbacks, which the assertion explicitly bans. |
| fs-result-not-throw | FAIL | Still throws everywhere: L106, L120, L123, L271, L281, L348, L357. No Result type. |
| fs-preserve-cause | FAIL | `throw new Error('insufficient_stock')` (L106) etc. are bare strings with no `cause`/context. |
| fs-intermediate-vars | PASS | Tax/discount calc extracted to named vars in `calculateItemAmount`: `withTax` (L91), `discounted` (L92). No compound one-liner. |
| fs-no-clever-code | PASS | Nested discount ternary removed (now map lookup). Remaining ternaries (L93, L186) are simple, not nested. |
| fs-blank-lines | PASS | Logical blocks separated by blank lines throughout (e.g. L231-254 in handleOrderData). |
| fs-no-commented-code | PASS | No commented-out code blocks present. |
| fs-no-todo-without-issue | PASS | No TODO/FIXME introduced. |
| fs-state-narration | PASS | Marked optional in the assertion ("optional — depends on refactoring approach"). Not a hard requirement; no regression. |
| fs-invalid-states-unrepresentable | FAIL | `status` is a bare `string` (L66), not a union (`'pending' \| ...`). `priority` likewise typed via inline `'high'`/`'normal'` strings, OrderRecord.priority is `string` (L68). Invalid states remain representable. |
| fs-parse-dont-validate | FAIL | `userId: string`, `items: OrderItem[]` accepted at entry with no parsing/construction at the boundary; `validateOrder` takes `any`. No parse step building typed domain objects from untyped input. |
| fs-timeout-io | FAIL | No timeout on any `db.query` or `mailer.send` call (L100, L114, L166-170, L180-191, L206, L265, L275, L284). |
| fs-crosscutting-wrapper | PASS | `console.log('Order created')` removed from business logic; no logging statements remain in the functions. |
| fs-structured-api-errors | FAIL | Errors are bare `new Error('user_not_found')` etc. — no `{ type, code, status, detail }` structure. |
| fs-dto-mapping | FAIL | `handleOrderData` returns `OrderRecord` which is the raw DB row shape (`{ ...order }` spread from `result.rows[0]`, L185/193). No dedicated DTO mapping; field names are DB column names (`user_id`, `item_count`). |
| fs-exports-at-top | FAIL | Public API is NOT at top. Exports `getInstanceConfig` (L17) sits near top, but the main `handleOrderData`/`removeCartItem` exports are mid-file (L226, L261), and private helpers (`formatDocument`, `getShippingLabel`, `validateOrder`) come AFTER the exports (L304-361). Exports not consolidated at top. |
| fs-rule-of-three | PASS | `formatEmail/formatReceipt/formatInvoice` consolidated into single parameterized `formatDocument(req)` (L304) keyed by `type`. |
| fs-data-clumps-value-object | PASS | The `to, name, amount, currency` clump extracted into `DocumentRequest` named type (L296-302). |
| fs-law-of-demeter | FAIL | `order.customer.address.street/.city/.zip` chains remain in `getShippingLabel` (L335-336) and `validateOrder` (`order.customer?.address?.city` L346, `order.customer.name` L360). 2+ level chains not replaced with an accessor/destructure-at-boundary. |
| fs-one-abstraction-level | FAIL | `validateOrder` (L342) still mixes validation (city check, total check) with low-level string formatting (L360 template literal with `total.toFixed(2)`). Formatting not separated from validation. |
| fs-define-errors-out-of-existence | FAIL | `removeCartItem` still throws `'item_not_in_cart'` (L281) when the item is absent, instead of succeeding idempotently. Not redesigned to guarantee the postcondition. |
| fs-pull-complexity-down | PASS | `retryCount/retryDelayMs/maxRetries` removed from `applyBulkDiscount` (L77 signature is `items: OrderItem[]` only). Retry complexity no longer pushed to caller. |
| fs-impossible-state-documented | FAIL | `if (total <= 0) throw new Error('invalid_total')` (L356-358) still THROWS (assertion requires Result error) and has NO comment documenting the invariant / why this state should never occur. |
| fs-barricade-boundary | PASS | `blocked` checked once in `validateUser` at entry (L122); the redundant in-loop `!usr.blocked` check is gone — `processItems` loop guard (L141) only checks item fields, not user.blocked. Validation consolidated at boundary. |
| fs-ascii-diagram | FAIL | No ASCII diagram of the multi-step pipeline. `handleOrderData` has only prose line comments (L231-254). |
| fs-no-archaeology | PASS | No archaeology comment present — no "refactored from a class in Q3" / "previously" / "used to" wording anywhere in the file. |
| fs-enduring-reader | FAIL | `getInstanceConfig` comment (L10) still says "Instance configuration exposed to admin dashboard" — explicitly anchors to the admin dashboard caller, which the assertion forbids. Must describe stable domain purpose with NO reference to the dashboard. |
| fs-divergent-change-business-domain | FAIL | Module still colocates order fulfillment (`handleOrderData`, `applyBulkDiscount`), document formatting (`formatDocument`), shipping (`getShippingLabel`), and validation (`validateOrder`) in ONE file. Not split per business domain. |

## Tally
- PASS: 20
- FAIL: 33
- Total: 53
