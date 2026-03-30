# Operational & Migrations — With Skill

## Prompt
Handle in production: rename column, add NOT NULL constraint, add index on large table, fix autovacuum falling behind.

## Response

### 1. Rename `name` to `full_name` (10M rows, live traffic)

Use the **Expand and Contract** pattern — never do a direct `ALTER TABLE RENAME COLUMN` which breaks existing app code instantly:

**Step 1 — Expand**: Add nullable new column
```sql
SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN full_name TEXT;
```

**Step 2 — Dual Write**: Deploy app code that writes to both `name` and `full_name`

**Step 3 — Backfill**: Copy existing data
```sql
UPDATE users SET full_name = name WHERE full_name IS NULL;
-- Do in batches of 10k to avoid long-running transactions
```

**Step 4 — Switch Reads**: Deploy app code that reads from `full_name`

**Step 5 — Contract**: Drop old column
```sql
SET lock_timeout = '5s';
ALTER TABLE users DROP COLUMN name;
```

### 2. Add NOT NULL constraint to `email`

Do NOT use `ALTER TABLE users ALTER COLUMN email SET NOT NULL` directly — it scans the entire table while holding an `ACCESS EXCLUSIVE` lock.

Use **ADD CONSTRAINT ... NOT VALID then VALIDATE**:

```sql
SET lock_timeout = '5s';

-- Step 1: Add constraint without validating existing rows (instant, no scan)
ALTER TABLE users ADD CONSTRAINT users_email_not_null
  CHECK (email IS NOT NULL) NOT VALID;

-- Step 2: Validate in a separate transaction (scans but holds ShareUpdateExclusiveLock, not AccessExclusive)
ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;
```

### 3. Add index on large table

Always use **CREATE INDEX CONCURRENTLY** — regular `CREATE INDEX` takes a `SHARE` lock that blocks all writes:

```sql
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY idx_table_column ON large_table (column_name);
```

If it fails partway, drop the invalid index and retry:
```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_table_column;
```

### 4. Autovacuum falling behind on high-write table

**Tune autovacuum to run more frequently** on that specific table. Never disable autovacuum — it prevents XID wraparound and reclaims dead tuples.

```sql
ALTER TABLE high_churn_table SET (
  autovacuum_vacuum_threshold = 50,
  autovacuum_vacuum_scale_factor = 0.01,    -- trigger at 1% dead tuples instead of default 20%
  autovacuum_vacuum_cost_delay = 2,          -- less throttling
  autovacuum_vacuum_cost_limit = 1000        -- more aggressive
);
```

Monitor with:
```sql
SELECT relname, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
WHERE relname = 'high_churn_table';
```

### Key principles
- **Lock timeout (~5s)** on every migration DDL statement to prevent write queue pileups
- **Expand and Contract** for any breaking schema change
- **CONCURRENTLY** for index creation — avoids table locks
- **NOT VALID + VALIDATE** for constraint addition — avoids full table lock during scan
- **Never disable autovacuum** — tune it to run more frequently instead
