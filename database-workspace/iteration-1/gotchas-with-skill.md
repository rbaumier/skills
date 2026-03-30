# Gotchas — With Skill

## Prompt
Review the provided PostgreSQL code for issues (TRUNCATE, SELECT *, NOW(), schema with VARCHAR/FLOAT/TIMESTAMP, missing FK indexes, 5 instances x 20 pool).

## Response

### Issues Found

#### 1. `TRUNCATE TABLE audit_logs` — ACCESS EXCLUSIVE lock

**Problem**: `TRUNCATE` is **not MVCC-safe** — it acquires an `ACCESS EXCLUSIVE` lock, blocking all concurrent reads and writes. If this migration runs during live traffic, it will cause downtime.

**Fix**: Use `DELETE FROM` instead:
```sql
DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '90 days';
```

#### 2. `SELECT *` — wastes bandwidth and breaks on schema changes

**Problem**: `SELECT *` fetches all columns including ones you don't need, wastes network I/O, and **breaks when columns are added** to the table. It also prevents covering index optimizations.

**Fix**: List columns explicitly:
```sql
SELECT u.id, u.email, o.id AS order_id, o.created_at, o.total
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.created_at > now() - INTERVAL '1 hour';
```

#### 3. `NOW()` in transactions — returns same value throughout

**Problem**: `NOW()` (and `CURRENT_TIMESTAMP`) returns the **same value for the entire transaction**. If this query is inside a long-running transaction, the "1 hour" window is relative to transaction start, not wall-clock time.

**Fix**: Use `clock_timestamp()` if you need actual wall-clock time:
```sql
WHERE o.created_at > clock_timestamp() - INTERVAL '1 hour'
```

#### 4. `VARCHAR(255)` — should be `TEXT`

**Problem**: `VARCHAR(255)` adds an arbitrary length constraint with no performance benefit. PostgreSQL stores `TEXT` and `VARCHAR` identically internally.

**Fix**: Use `TEXT`:
```sql
name TEXT NOT NULL,
```

#### 5. `FLOAT` for price — floating-point precision errors

**Problem**: `FLOAT` (IEEE 754) causes precision errors for monetary values. `0.1 + 0.2 != 0.3`.

**Fix**: Use `NUMERIC` for money:
```sql
price NUMERIC NOT NULL,
```

#### 6. `TIMESTAMP` without timezone — should be `TIMESTAMPTZ`

**Problem**: Bare `TIMESTAMP` (without time zone) loses timezone context. Data from different timezones becomes ambiguous.

**Fix**: Use `TIMESTAMPTZ`:
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
```

#### 7. Missing foreign key indexes on `order_items`

**Problem**: `order_id` and `product_id` have foreign key constraints but **no explicit indexes**. PostgreSQL does **NOT** auto-index foreign key columns (unlike primary keys). This causes:
- Slow JOIN queries on these columns
- **CASCADE lock issues** — deleting a parent row scans the entire child table

**Fix**:
```sql
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
```

#### 8. Connection pool exhaustion — 5 × 20 = 100

**Problem**: 5 app instances × 20 pool size = **100 connections**, which hits PostgreSQL's default `max_connections = 100`. No headroom for admin connections, monitoring, or new instances.

**Fix**: Use **PgBouncer** in transaction mode as a connection pooler between app and database. Keep actual DB connections under 100:
```
# PgBouncer config
pool_mode = transaction
default_pool_size = 20
max_client_conn = 200
```
