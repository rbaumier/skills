# Performance & Indexing — Without Skill

## Prompt
Optimize queries on a 50M-row `orders` table: active orders per user sorted by date, text search, pagination through order history, and recent orders.

## Response

### 1. Active orders for a user, sorted by created_at DESC

```sql
CREATE INDEX idx_orders_user_status ON orders (user_id, status, created_at DESC);

SELECT * FROM orders
WHERE user_id = $1 AND status = 'active'
ORDER BY created_at DESC;
```

### 2. Text search on description

Add a column and use pattern matching:

```sql
SELECT * FROM orders
WHERE description LIKE '%search_term%';
```

For better performance, consider a trigram index:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_orders_desc_trgm ON orders USING GIN (description gin_trgm_ops);
```

### 3. Paginate through order history

```sql
SELECT * FROM orders
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET $2;
```

Create a supporting index:

```sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
```

### 4. Recent orders (last hour)

```sql
CREATE INDEX idx_orders_created ON orders (created_at);

SELECT * FROM orders
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### Notes
- Composite indexes should match query column order
- Consider `EXPLAIN ANALYZE` to verify index usage
- Monitor index size vs. query improvement tradeoff
