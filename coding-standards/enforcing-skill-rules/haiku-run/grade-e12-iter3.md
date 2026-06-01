# Grade: coding-standards / e12 / iter3

STRICT grading — PASS only if the violation is clearly corrected in the actual code (cited). FAIL on doubt / aspirational / delegated.

| # | ID | Verdict | Evidence |
|---|----|---------|----------|
| 1 | fs-module-orientation | PASS | Lines 2-13: module doc "Order processing module... Fetches user, validates stock, calculates totals... creates orders, and notifies" + "Key operations" bullet list. |
| 2 | fs-consequence-comments | PASS | L89 "Large orders ($1000+) trigger manual fraud review and special handling"; L373 "failure does not block order creation"; L194 "Blocked users cannot transact". Consequence-oriented. |
| 3 | fs-term-explanations | PASS | L89 explains large order ($1000+ → fraud review); L352 big_orders purpose ("for fraud review"). Domain terms explained. |
| 4 | fs-conversational-tone | PASS | Comments are full sentences (L194, L266, L373), not terse mechanical labels. |
| 5 | fs-inaction-justified | PASS | L266 "Skip inactive items—they are filtered by policy, not validated"; L194 blocked-user rejection justified. |
| 6 | fs-next-caller-effect | PASS | No raw cache.set remains; persistence comments describe effect (L352 records for fraud review). Original `cache.set` violation removed entirely. |
| 7 | fs-return-value-intent | PASS | L426 "Returns the created order DTO or a ProcessError on first failure"; helper docs name return meaning (L166, L227). |
| 8 | fs-limits-explained | PASS | L89-90 "Large orders ($1000+) trigger manual fraud review" with named const LARGE_ORDER_THRESHOLD = 1000. |
| 9 | fs-jsdoc-with-example | PASS | L414-427 placeOrder doc names consumer-visible effect + return meaning; getInstanceConfig L98-103. |
| 10 | fs-naming-intent | PASS | handleOrderData → placeOrder (no banned handle/data/process). Full words: user, item, quantity, price, amount, currency, stock. No u/usr/itm/ct/amt/s. |
| 11 | fs-boolean-prefix | PASS | sendEmail → shouldNotifyCustomer (L42, positive should- prefix). |
| 12 | fs-symmetry | PASS | Naming pairs consistent (fetchUser/fetchStock, createOrderRecord). No orphan set without get. |
| 13 | fs-no-boolean-flags | PASS | isUrgent → OrderPriority union (L39); sendEmail → NotificationConfig object (L41-44). Boolean branching params removed. |
| 14 | fs-guard-clauses | PASS | placeOrder is flat sequential guard returns (L433-447); validateOrderItems uses early `continue`/return, max ~3 indent. |
| 15 | fs-switch-or-map | PASS | Discount ternary chain → DISCOUNT_AMOUNTS map (L93-96) resolved in resolveDiscount (L213). |
| 16 | fs-immutable | PASS | calculateOrderTotal uses reduce (L306-309), countActiveItems uses filter (L317). No let/+=/++ accumulators. |
| 17 | fs-promise-all | FAIL | validateOrderItems L265-290: `for (const item of items)` with `await fetchStock(...)` (L278) — stock checks run SEQUENTIALLY, not Promise.all. |
| 18 | fs-factory-di | PASS | OrderServiceDeps { database, mailer, logger } injected (L152-156); no global db/cache/mailer imports (only types L15). |
| 19 | fs-extract-by-responsibility | PASS | Split into fetchUser, validateUserNotBlocked, resolveDiscount, validateOrderItems, calculateOrderTotal, createOrderRecord, recordLargeOrder, sendOrderConfirmation. Responsibility-driven. |
| 20 | fs-max-3-args | PASS | placeOrder(input, deps) — 7 positional args replaced with OrderInput options object (L23-30). |
| 21 | fs-srp-cqs | PASS | createOrderRecord (command) separate from sendOrderConfirmation / recordLargeOrder notifications. |
| 22 | fs-named-constants | PASS | LARGE_ORDER_THRESHOLD = 1000 (L90); DISCOUNT_AMOUNTS FREE50:50/FREE20:20 (L93-96); BULK_DISCOUNT_RATE (L546). |
| 23 | fs-strict-typing | PASS | OrderInput, OrderItem, User typed (L23-66); no `any`; OrderStatus is union (L21). |
| 24 | fs-externalize-config | PASS | Discount codes + threshold extracted to module-level consts (L90, L93-96), not inline in function body. |
| 25 | fs-bound-inputs | FAIL | item.quantity <= 0 rejected (L270), but: (a) check sits AFTER `if (!item.active) continue` so an inactive item with negative qty is skipped not rejected; (b) NO empty-items array rejection. Assertion requires rejecting empty items. |
| 26 | fs-result-not-throw | PASS | All paths return Result (L178, L198, L271); no `throw` anywhere in code. |
| 27 | fs-preserve-cause | PASS | catch (cause) preserves context: L187 detail String(cause), L369 `${cause}`, L380 logs { cause }. |
| 28 | fs-intermediate-vars | PASS | subtotal extracted (L306), discountAmount (L443), itemCount (L451), confirmationDoc (L398). No compound one-liner. |
| 29 | fs-no-clever-code | PASS | Nested discount ternary gone; replaced by map lookup in resolveDiscount (L211-221). |
| 30 | fs-blank-lines | PASS | Logical blocks separated by blank lines (e.g. L432/440/445/449 in placeOrder; section banners). |
| 31 | fs-no-commented-code | PASS | No commented-out code. Comments are explanatory prose only. |
| 32 | fs-no-todo-without-issue | PASS | No TODO/FIXME present in the code. |
| 33 | fs-state-narration | PASS | (optional) placeOrder narrates journey via step comments (L432, L440, L445, L449, L464). |
| 34 | fs-invalid-states-unrepresentable | PASS | OrderStatus union (L21), OrderPriority union (L39), User.status union (L65). No bare status strings as types. |
| 35 | fs-parse-dont-validate | PASS | Typed OrderInput/OrderItem at boundary; resolveDiscount parses code→amount Result (L211); validateUserNotBlocked. No `any`. |
| 36 | fs-timeout-io | FAIL | No timeout on any I/O: database.query (L173, L234, L331, L362, L512, L524) and mailer.send (L375, L404) have no timeout/AbortSignal. Can hang forever. |
| 37 | fs-crosscutting-wrapper | FAIL | Logging called directly inside business logic: deps.logger.info('Order created') in placeOrder (L485); deps.logger.warn in recordLargeOrder (L380) and sendOrderConfirmation (L410). No withLogging/withTracing wrapper. |
| 38 | fs-structured-api-errors | FAIL | ProcessError is { type, detail } only (L80-83). Missing `code` and `status` fields. Assertion requires { type, code, status, detail }. |
| 39 | fs-dto-mapping | PASS | OrderRecord DTO defined (L53-60); createOrderRecord returns typed OrderRecord via RETURNING projection (L331-342), not raw row passthrough. |
| 40 | fs-exports-at-top | FAIL | Exports scattered: getInstanceConfig (L104) mid-file, placeOrder (L428) after many private helpers, removeCartItem (L506), applyBulkDiscount (L545) at bottom. Public API not grouped at top; private helpers (fetchUser etc.) precede main exports. |
| 41 | fs-rule-of-three | PASS | formatEmail/formatReceipt/formatInvoice unified into formatDocument + DOCUMENT_TEMPLATES map (L122-146). |
| 42 | fs-data-clumps-value-object | PASS | (to, name, amount, currency) extracted to DocumentRequest type (L46-51). |
| 43 | fs-law-of-demeter | PASS | No order.customer.address.street chains in code; access is destructured/flat (order.total, order.id). |
| 44 | fs-one-abstraction-level | PASS | validateOrder split: validateOrderItems (validation) separate; calculateOrderTotal handles math; no string formatting mixed into validation. |
| 45 | fs-define-errors-out-of-existence | PASS | removeCartItem idempotent: L500-505 doc "if the item is not in the cart, the operation succeeds (postcondition: item is not in cart)"; DELETE succeeds on 0 rows (L523-527). |
| 46 | fs-pull-complexity-down | PASS | applyBulkDiscount(items) only (L545) — retryCount/retryDelayMs/maxRetries params removed; no retry pushed to caller. |
| 47 | fs-impossible-state-documented | PASS | L453-462: `if (total <= 0)` returns Result error (not throw); comment "Enforce postcondition: total must be positive" + detail "order calculation produced invalid result" documents the invariant. |
| 48 | fs-barricade-boundary | PASS | usr.blocked checked once at entry via validateUserNotBlocked (L437) in placeOrder; not re-checked inside validateOrderItems loop. |
| 49 | fs-pipeline-flow-documented | PASS | placeOrder doc lists the multi-step pipeline as a bullet list "Steps:" (L417-424). |
| 50 | fs-no-archaeology | PASS | No "originally", "refactored from", "used to", "previously" comments anywhere. Module doc (L2-13) describes present behavior only. |
| 51 | fs-enduring-reader | PASS | getInstanceConfig comment (L98-103) describes stable domain purpose ("Warning threshold triggers alerts at 10% failure rate. Disable threshold stops processing at 30%"). No admin-dashboard / instance-settings-page reference. |
| 52 | fs-divergent-change-business-domain | PASS | Domains separated into delimited banner sections: Document Formatting (L111), Core Operations (L158), Cart Operations (L490), Bulk Operations (L537). Not interleaved into one function. |

## Summary

- Passed: 47
- Failed: 6
- Fails: fs-promise-all, fs-bound-inputs, fs-timeout-io, fs-crosscutting-wrapper, fs-structured-api-errors, fs-exports-at-top
