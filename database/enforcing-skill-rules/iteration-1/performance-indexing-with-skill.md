# Performance & Indexing — With Skill

## Prompt
Optimize queries on a 50M-row `orders` table: active orders per user sorted by date, text search, pagination through order history, and recent orders.

## Response

### 1. Active orders for a user, sorted by created_at DESC

Use a **partial covering index** — only index active orders, include `total` to enable index-only scans:

```sql
CREATE INDEX CONCURRENTLY idx_orders_user_active
  ON orders (user_id, created_at DESC)
  INCLUDE (total)
  WHERE status = 'active';
```

Query (explicit columns, no `SELECT *`):

```sql
SELECT id, user_id, created_at, total
FROM orders
WHERE user_id = $1
  AND status = 'active'
ORDER BY created_at DESC;
```

### 2. Text search on description

**Never use `LIKE '%term%'`** on large tables — it forces a sequential scan and cannot use B-tree indexes.

Add a `tsvector` column with a GIN index:

```sql
ALTER TABLE orders ADD COLUMN description_tsv TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(description, ''))) STORED;

CREATE INDEX CONCURRENTLY idx_orders_description_gin
  ON orders USING GIN (description_tsv);
```

Query:

```sql
SELECT id, user_id, status, created_at, total
FROM orders
WHERE description_tsv @@ plainto_tsquery('english', $1);
```

### 3. Paginate through a user's order history

**Do not use OFFSET/LIMIT** — it is O(N) on deep pages because PostgreSQL must scan and discard all preceding rows.

Use **cursor-based (keyset) pagination**:

```sql
-- First page
SELECT id, status, created_at, total
FROM orders
WHERE user_id = $1
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Next page (pass last row's created_at and id as cursor)
SELECT id, status, created_at, total
FROM orders
WHERE user_id = $1
  AND (created_at, id) < ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

Supporting index:

```sql
CREATE INDEX CONCURRENTLY idx_orders_user_history
  ON orders (user_id, created_at DESC, id DESC)
  INCLUDE (status, total);
```

### 4. Orders created in the last hour

For a 50M-row append-only-ish table where `created_at` is naturally correlated with physical row order, use a **BRIN index** — dramatically smaller than B-tree, ideal for time-series data:

```sql
CREATE INDEX CONCURRENTLY idx_orders_created_brin
  ON orders USING BRIN (created_at)
  WITH (pages_per_range = 32);
```

Query:

```sql
SELECT id, user_id, status, total
FROM orders
WHERE created_at > clock_timestamp() - INTERVAL '1 hour';
```

### Summary of principles applied
- **Index based on actual query patterns** (WHERE, JOIN, ORDER BY) — not intuition
- **Covering indexes** with INCLUDE to avoid heap lookups
- **Partial indexes** to index only relevant subsets (active orders)
- **BRIN** for time-series data naturally ordered on disk
- **No SELECT \*** — explicit columns reduce network I/O and enable covering indexes
- **Cursor-based pagination** — OFFSET/LIMIT is O(N) on deep pages
- **TSVECTOR + GIN** — never `LIKE '%term%'` on large tables
