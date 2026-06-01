# Grade — e1 iter2 (STRICT)

| # | id | verdict | evidence / reasoning |
|---|----|---------|----------------------|
| 1 | json-typed | PASS | L25: `metadata: json('metadata').$type<ProductMetadata>()` — typed JSON column, `ProductMetadata` interface defined L15-19. |
| 2 | infer-select | PASS | L32: `export type Product = typeof products.$inferSelect;` and L51 same for orders. No `InferSelectModel`. |
| 3 | camel-snake-mapping | PASS | L26: `createdAt: timestamp('created_at', ...)`, L27 `updatedAt: timestamp('updated_at', ...)`, L42 `productId: integer('product_id', ...)`. camelCase TS → snake_case DB names. |
| 4 | fk-indexes | PASS | L47: `productIdIdx: index('orders_product_id_idx').on(t.productId)`, L48: `userIdIdx: index('orders_user_id_idx').on(t.userId)`. Both FK columns indexed. |
| 5 | junction-table | FAIL | `primaryKey` is imported (L13) but NEVER used. No junction table for many-to-many exists anywhere in the schema. The trap target (M2M) is simply absent — neither the violation nor the corrected pattern is present. Aspirational import only. |
| 6 | relational-queries | FAIL | L60-77 uses `db.query.products.findFirst({ with: { orders: {...} } })` — the relational API shape. BUT no `relations()` are declared in schema.ts (no `relations` import, no `productsRelations`/`ordersRelations` exports). The `with: { orders }` clause cannot resolve at runtime without defined relations, so the relational query is non-functional. The correction is superficial/aspirational, not a working relational query. |
| 7 | cursor-pagination | PASS | L88 & L100: `.where(cursor ? gt(products.id, cursor) : undefined)` — keyset/cursor pagination via `gt(id, cursor)`, no OFFSET. |
| 8 | transaction | PASS | L105-117: `db.transaction(async (tx) => { ... })` wraps both `tx.update(...)` calls (the two-step stock transfer). |
| 9 | satisfies-config | PASS | L9: `} satisfies Config;` — not `const config: Config =`. |
| 10 | select-columns | PASS | L81-86, L93-98, L121-125, L145-149: every `select()` lists explicit columns `{ id, name, price, ... }`; no bare `select()`. |
| 11 | paginate-production | PASS | No `getAllProducts`. `getProducts`/`getProductsByPage` both `.limit(50)`/`.limit(20)`; serverless query also `.limit(50)`. No unbounded full-table fetch. |
| 12 | serverless-pool | FAIL | L137-144: `new Pool(...)` AND `drizzle(pool, ...)` are created INSIDE `handler()`, then `pool.end()` is called every invocation (L151). `max: 1` is set, but the core trap — Pool/db not cached outside the handler — is uncorrected. db is rebuilt and torn down per request. |
| 13 | sql-no-concat | PASS | L127: `.where(sql\`${products.name} ILIKE ${\`%${userInput}%\`}\`)` — uses the `sql` template tag with a parameterized binding for `userInput`; no string concatenation into raw SQL. |

{"passed":10,"total":13,"fails":[{"id":"junction-table","why":"No junction table exists; primaryKey imported but never used; M2M neither violated nor implemented"},{"id":"relational-queries","why":"db.query...with:{orders} used but no relations() defined in schema (no relations import/exports), so the relational query is non-functional/aspirational"},{"id":"serverless-pool","why":"new Pool() and drizzle() created inside handler and pool.end() per invocation; not cached outside despite max:1"}]}
