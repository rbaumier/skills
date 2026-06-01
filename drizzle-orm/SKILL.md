---
name: drizzle-orm
description: "Use when writing Drizzle ORM schemas, migrations, queries, or debugging Drizzle type errors in TypeScript projects."
---

# Drizzle ORM

## Pre-output checklist (run before emitting code)
- M:N relation (products↔categories, users↔roles, posts↔tags)? → an explicit junction table with a **composite `primaryKey`**, never an array of FK ids on either side.
- Any `db.query.X.findMany/findFirst({ with: { ... } })`? → the referenced relations MUST be declared: `import { relations }` + exported `xRelations`/`yRelations` on BOTH sides. `with` cannot resolve at runtime without them.
- Serverless handler? → `Pool` + `drizzle()` created ONCE at module top-level (outside the handler), `max: 1`. Never instantiate them inside the handler, never `pool.end()` per request.

## Rules

### Schema
- `json('col').$type<T>()` for typed JSON columns, never leave as unknown/any
- `typeof table.$inferSelect` and `$inferInsert` for types (not InferSelectModel)
- camelCase TS properties, snake_case DB columns: `productId: integer('product_id')`
- **Timestamp columns** — always `timestamp('col', { withTimezone: true })` not bare `timestamp('col')`. Without timezone, timestamps are ambiguous when servers/clients are in different zones. Add `.defaultNow()` for `createdAt`, use `.$onUpdate(() => new Date())` for `updatedAt`
- **Schema organization** — export all tables from a central `schema/index.ts` barrel file. Import the full schema object into `drizzle()` config: `drizzle(client, { schema })`. Relations must reference tables from the same schema object — split files work only if re-exported together
- **Every FK column gets an index** — review checklist: if you see a column that references another table (`productId`, `userId`, anything ending in `Id`), it MUST have an index in the table-config callback. No exceptions. WHY: FKs are joined and filtered constantly; without an index every join is a full table scan. Pattern: `pgTable('orders', { ...cols }, (t) => ({ productIdx: index('product_idx').on(t.productId), userIdx: index('user_idx').on(t.userId) }))`. Also index frequently queried columns

### Relations
- **Many-to-many MUST use an explicit junction table** — review checklist: if two entities relate as M:N (products↔categories, users↔roles, posts↔tags), neither table holds the other's id; you MUST create a third link table. Missing junction table = many-to-many not implemented = FAIL. Pattern: `export const productsToCategories = pgTable('products_to_categories', { productId: integer('product_id').references(() => products.id), categoryId: integer('category_id').references(() => categories.id) }, (t) => ({ pk: primaryKey({ columns: [t.productId, t.categoryId] }) }))`. The composite `primaryKey` is required — it prevents duplicate pairs. WHY: a single FK column can only model one-to-many; M:N has no home on either table
- **Relational queries REQUIRE declared relations** — use `db.query.X.findMany({ with: { ... } })` for relational queries, not manual joins. But `with` resolves nothing unless the relations are declared: every table referenced in a `with` clause MUST have an exported `relations()` definition on BOTH sides, and the schema object passed to `drizzle(client, { schema })` must include them. Review checklist: if you write `db.query.products.findMany({ with: { orders } })`, you MUST also `import { relations } from 'drizzle-orm'` and export `productsRelations`/`ordersRelations`, else the query is non-functional. Pattern: `export const productsRelations = relations(products, ({ many }) => ({ orders: many(orders) })); export const ordersRelations = relations(orders, ({ one }) => ({ product: one(products, { fields: [orders.productId], references: [products.id] }) }));`
- **Aggregation belongs to SQL, not to application code** -- whatever the DB can compute (joins, sub-selects, `json_agg`/`array_agg`, `count`, ordering, filtering, deduplication, group-by) **must** be in the query, not rebuilt in TS with `Map`/`for`/`.filter().map()`. Fetching flat rows just to reshape them is slower than the DB and a vector for off-by-one bugs. Prefer `db.query.X.findMany({ with: { ... } })` with explicit `defineRelations`, or a single `select` with explicit joins/aggregates. If you find yourself rebuilding parent/child relations in code, the schema lacks a relation declaration — fix the schema, not the handler. Only acceptable in-code post-processing: final domain transformation (DB row → API contract), never the join itself. Reviews: handler fetching flat rows then reshaping them in JS to nest children under parents -> flag "move the join into SQL"

### Queries
- Cursor pagination `gt(t.id, lastSeenId)` for large datasets, not OFFSET
- **`.returning()` on every insert/update** — always chain `.returning()` after insert/update to get the created/modified row back in one round-trip instead of a separate SELECT. `db.insert(users).values({...}).returning()` returns the full row with generated `id`, `createdAt`, etc. Without it you waste a round-trip on a follow-up SELECT, and risk reading stale data under concurrency
- **Soft delete pattern**: add `deletedAt: timestamp('deleted_at')` column, filter with `isNull(t.deletedAt)` on every query. WHY: hard deletes break FK integrity and lose audit trail. Create a helper `withActive(query)` to avoid forgetting the filter — one missed isNull and you leak "deleted" data to users
- **Upsert**: `.onConflictDoUpdate({ target: t.email, set: { name: sql`excluded.name`, updatedAt: new Date() } })` after `.insert().values()`. Use `onConflictDoNothing()` when you only care about existence (idempotent inserts). The `excluded` keyword references the row that would have been inserted
- **Batch insert**: `db.insert(t).values(arrayOfRows).returning()`. For large batches (1000+), chunk into groups of 500 — most DBs have a parameter limit (~65535 for Postgres). A 10-column table hits this at ~6500 rows. Chunk to be safe
- **Multi-tenant RLS pattern** — add `tenantId` column to all tenant-scoped tables + composite indexes. Create a helper `withTenant(tenantId)` that wraps queries with `and(eq(t.tenantId, tenantId), ...)`. Never rely on application-level filtering alone — a missed where clause leaks cross-tenant data

### Transactions
- `db.transaction()` for ALL multi-step data modifications
- Auto-rolls back on error; no partial writes occur

### Migrations
- **`drizzle-kit push` for development, `generate`+`migrate` for production** — `push` applies schema diff directly (fast iteration, no migration files). `generate` creates SQL migration files for reviewable, reproducible production deploys. Never use `push` in production — it can drop columns with data
- Config: `} satisfies Config` not `const config: Config =`

### Performance
- **Never `db.select()` bare — always pass a column list** — review checklist: every `db.select()` with empty parens is a violation; replace with `db.select({ id: t.id, name: t.name })` listing only the columns the caller uses. This is not "for large tables only" — do it on every select. Before: `db.select().from(products)`. After: `db.select({ id: products.id, name: products.name }).from(products)`. WHY: bare select fetches every column including large/unused ones, wasting bandwidth and coupling the query to schema changes
- **Every list/`getAll` query MUST be paginated — there is no unbounded fetch** — review checklist: if a function returns a list (named `getAll*`, `list*`, `findMany`, or any `.from(t)` without a limit), it MUST have `.limit()` plus cursor (`gt(t.id, lastSeenId)`) or offset. A function named `getAllProducts` is a trap, not a license to fetch everything — rename to `getProducts(cursor)` and add `.limit(N)`. Before: `db.select({...}).from(products)`. After: `db.select({...}).from(products).where(gt(products.id, cursor)).limit(50)`. WHY: an unbounded fetch grows with the table and will eventually OOM or time out in production
- **Connection pool — in serverless, create the pool ONCE at module scope with `max: 1`** — review checklist: in a serverless/edge handler (Neon/Supabase/Lambda/Vercel) the `Pool` and `drizzle()` MUST be created once at module top-level (outside the handler) so they are reused across warm invocations, and `new Pool({...})` MUST set `max: 1`. Two violations to catch: (1) `new Pool()`/`drizzle()` instantiated INSIDE the handler — rebuilds the pool every request; (2) `pool.end()` called per invocation — tears down the connection you just paid to open and breaks reuse. Each serverless instance opens its own pool; without `max: 1` you exhaust the database's connection limit under load. Pattern: `const pool = new Pool({ connectionString, max: 1, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }); const db = drizzle(pool, { schema }); export async function handler(event) { /* use db, no end() */ }`. Long-running servers only: `max: (cpu_cores * 2) + 1`. Always set `idleTimeoutMillis` (30s) and `connectionTimeoutMillis` (5s) to prevent connection leaks

### drizzle-zod Integration
- `createInsertSchema(table)` and `createSelectSchema(table)` from `drizzle-zod` to auto-generate Zod schemas from your Drizzle table. WHY: single source of truth — schema changes propagate to validation automatically, no manual sync between DB schema and API validation
- Refine generated schemas for API input: `createInsertSchema(users).omit({ id: true, createdAt: true })` — strip auto-generated fields that clients should never send
- Use with tRPC or API routes: `const input = createInsertSchema(users).omit({ id: true }).parse(req.body)` — validates AND types in one step

### General (non-discriminating)
- pgTable with column imports from drizzle-orm/pg-core
- relations() with one/many; filter operators (eq, gt, like) from drizzle-orm
- **Parameterized raw SQL** — when using `sql` template tag with user input, always use `sql.placeholder('name')` for prepared statements or the tagged template literal. NEVER `sql.raw(userInput)` — it bypasses parameterization and enables SQL injection
- sql template tag for raw SQL, never string concatenation
- use .findFirst() to get the first matching row
