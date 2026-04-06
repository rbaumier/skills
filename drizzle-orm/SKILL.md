---
name: drizzle-orm
description: "Use when writing Drizzle ORM schemas, migrations, queries, or debugging Drizzle type errors in TypeScript projects."
---

# Drizzle ORM

## Rules

### Schema
- `json('col').$type<T>()` for typed JSON columns, never leave as unknown/any
- `typeof table.$inferSelect` and `$inferInsert` for types (not InferSelectModel)
- camelCase TS properties, snake_case DB columns: `productId: integer('product_id')`
- **Timestamp columns** — always `timestamp('col', { withTimezone: true })` not bare `timestamp('col')`. Without timezone, timestamps are ambiguous when servers/clients are in different zones. Add `.defaultNow()` for `createdAt`, use `.$onUpdate(() => new Date())` for `updatedAt`
- **Schema organization** — export all tables from a central `schema/index.ts` barrel file. Import the full schema object into `drizzle()` config: `drizzle(client, { schema })`. Relations must reference tables from the same schema object — split files work only if re-exported together
- Define indexes on FKs and frequently queried columns

### Relations
- Many-to-many: explicit junction table with `primaryKey({ columns: [t.aId, t.bId] })`
- Use `db.query.X.findMany({ with: { ... } })` for relational queries, not manual joins

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
- Select specific columns for large tables: `db.select({ id, email })` not `select()`
- Paginate production queries; never fetch all rows
- **Connection pool sizing** — Neon/Supabase with PgBouncer: `max: 1` per serverless instance. Long-running servers: `max: (cpu_cores * 2) + 1`. Always set `idleTimeoutMillis` (30s) and `connectionTimeoutMillis` (5s) to prevent connection leaks

### drizzle-zod Integration
- `createInsertSchema(table)` and `createSelectSchema(table)` from `drizzle-zod` to auto-generate Zod schemas from your Drizzle table. WHY: single source of truth — schema changes propagate to validation automatically, no manual sync between DB schema and API validation
- Refine generated schemas for API input: `createInsertSchema(users).omit({ id: true, createdAt: true })` — strip auto-generated fields that clients should never send
- Use with tRPC or API routes: `const input = createInsertSchema(users).omit({ id: true }).parse(req.body)` — validates AND types in one step

### General (non-discriminating)
- pgTable with column imports from drizzle-orm/pg-core
- relations() with one/many; filter operators (eq, gt, like) from drizzle-orm
- **Parameterized raw SQL** — when using `sql` template tag with user input, always use `sql.placeholder('name')` for prepared statements or the tagged template literal. NEVER `sql.raw(userInput)` — it bypasses parameterization and enables SQL injection
- sql template tag for raw SQL, never string concatenation
