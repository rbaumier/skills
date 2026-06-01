# Grade: drizzle-orm e1 iter3

| # | ID | Verdict | Evidence |
|---|----|---------|----------|
| 1 | json-typed | PASS | L21 `metadata: json('metadata').$type<Record<string, unknown>>()` — typed JSON via `.$type<T>()`. |
| 2 | infer-select | PASS | L51-55 use `typeof products.$inferSelect` / `$inferInsert`, no `InferSelectModel`. |
| 3 | camel-snake-mapping | PASS | L22 `createdAt: timestamp('created_at', ...)`, L23 `updatedAt: timestamp('updated_at', ...)`, L35 `productId: integer('product_id')`, L36 `userId: integer('user_id')` — camelCase TS props map to snake_case DB columns. |
| 4 | fk-indexes | PASS | L40-41 `productIdx: index('orders_product_idx').on(t.productId)` and `userIdx: index('orders_user_idx').on(t.userId)` — both FK columns indexed. |
| 5 | relational-queries | PASS | L90-95 `db.query.products.findFirst({ where, with: { orders: true } })` — relational query, not manual join. |
| 6 | cursor-pagination | PASS | L98-108 `getProducts` uses `.where(gt(products.id, cursor)).limit(limit)` — cursor pagination via `gt(id, ...)`, no OFFSET. |
| 7 | transaction | PASS | L124-138 `transferStock` wraps both updates in `db.transaction(async (tx) => { ... })`. |
| 8 | satisfies-config | PASS | L5-9 `const config = { ... } satisfies Config;` not `const config: Config =`. |
| 9 | select-columns | PASS | L100-105, L114-118, L142-146, L168-173 — all selects specify explicit columns `{ id, name, price, ... }`, no bare `select()`. |
| 10 | paginate-production | PASS | No `getAllProducts`. `getProducts`/`getProductsByPage` both `.limit()`; serverless handler `.limit(100)`; search `.limit(50)`. No unbounded fetch-all. |
| 11 | serverless-pool | PASS | L157-164 `Pool({ ..., max: 1 })` and `dbInstance` cached OUTSIDE `handler` (L166); no Pool created inside handler. |
| 12 | sql-no-concat | PASS | L148 `sql\`${products.name} ILIKE ${\`%${userInput}%\`}\`` — `sql` template tag, userInput passed as bound param, no SQL string concatenation. |
