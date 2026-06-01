# Grade — e1 iter1

| id | PASS/FAIL | evidence |
|----|-----------|----------|
| json-typed | PASS | `metadata: json('metadata').$type<Record<string, unknown>>()` (line 18) — `.$type<T>()` applied. |
| infer-select | PASS | `export type Product = typeof products.$inferSelect;` (line 22) — uses `$inferSelect`, not `InferSelectModel`. |
| camel-snake-mapping | PASS | `createdAt: timestamp('created_at', ...)` (lines 19, 34) and `productId: integer('product_id')`, `userId: integer('user_id')` (lines 31-32) — camelCase TS props map to snake_case DB column names. |
| fk-indexes | FAIL | `orders` table (lines 29-35) declares `productId`/`userId` but defines NO indexes. No second table-config arg, no `index()`/`.on()` anywhere. FK columns remain unindexed. |
| junction-table | FAIL | No junction table exists. `categories` table (lines 24-27) has only `id`+`name`, no composite `primaryKey`, no link table between products and categories. Many-to-many is simply absent — not implemented via junction table. |
| relational-queries | PASS | `db.query.products.findFirst({ where: ..., with: { orders: true } })` (lines 51-56) — uses relational query API with `with`, not two separate queries. |
| cursor-pagination | PASS | `getProductsByPage(lastSeenId)` uses `.where(gt(products.id, lastSeenId))` (lines 63-68) — cursor pagination via `gt(id, lastSeenId)`, no OFFSET. |
| transaction | PASS | `transferStock` wraps both updates in `db.transaction(async (tx) => { ... })` (lines 71-76). |
| satisfies-config | PASS | `export default { ... } satisfies Config;` (lines 5-9) — uses `satisfies`, not `const config: Config =`. |
| select-columns | FAIL | All selects use `db.select()` with no column list: `getAllProducts` (line 60), `getProductsByPage` (line 64), `searchProducts` (line 79), handler (line 84). No `select({ id, name })` anywhere. Violation still present. |
| paginate-production | FAIL | `getAllProducts()` still does `db.select().from(products)` fetching all rows (lines 59-61). Function name unchanged, no pagination, no limit. Trap intact. Handler (line 84) also fetches all rows. |
| serverless-pool | FAIL | `db.ts` (lines 42-43) creates `new Pool({ connectionString: ... })` with NO `max: 1`. The handler (lines 83-86) reuses the module `db`, but the pool lacks `max: 1`, which the rule explicitly requires. Fix incomplete. |
| sql-no-concat | PASS | `searchProducts` uses `sql\`name ILIKE ${userInput}\`` (line 79) — parameterized via sql template tag, no string concatenation. Same for arithmetic in `transferStock` (lines 73-74). |
