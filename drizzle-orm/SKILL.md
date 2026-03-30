---
name: drizzle-orm
description: "Type-safe SQL ORM for TypeScript with zero runtime overhead"
---

# Drizzle ORM

## Rules

### Schema
- `json('col').$type<T>()` for typed JSON columns, never leave as unknown/any
- `typeof table.$inferSelect` and `$inferInsert` for types (not InferSelectModel)
- camelCase TS properties, snake_case DB columns: `productId: integer('product_id')`
- Define indexes on FKs and frequently queried columns

### Relations
- Many-to-many: explicit junction table with `primaryKey({ columns: [t.aId, t.bId] })`
- Use `db.query.X.findMany({ with: { ... } })` for relational queries, not manual joins

### Queries
- Cursor pagination `gt(t.id, lastSeenId)` for large datasets, not OFFSET

### Transactions
- `db.transaction()` for ALL multi-step data modifications
- Auto-rolls back on error; no partial writes occur

### Migrations
- `drizzle-kit generate` then `drizzle-kit migrate`
- Config: `} satisfies Config` not `const config: Config =`

### Performance
- Select specific columns for large tables: `db.select({ id, email })` not `select()`
- Paginate production queries; never fetch all rows
- Serverless: cache db instance outside handler, `pool max: 1`

### General (non-discriminating)
- pgTable with column imports from drizzle-orm/pg-core
- relations() with one/many; filter operators (eq, gt, like) from drizzle-orm
- sql template tag for raw SQL, never string concatenation
