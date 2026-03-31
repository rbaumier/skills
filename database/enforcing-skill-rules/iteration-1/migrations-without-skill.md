# Operational & Migrations — Without Skill

## Prompt
Handle in production: rename column, add NOT NULL constraint, add index on large table, fix autovacuum falling behind.

## Response

### 1. Rename `name` to `full_name`

```sql
ALTER TABLE users RENAME COLUMN name TO full_name;
```

Then update your application code to reference `full_name` instead of `name` and deploy.

### 2. Add NOT NULL constraint to `email`

First, backfill any NULL values:
```sql
UPDATE users SET email = 'unknown@example.com' WHERE email IS NULL;
```

Then add the constraint:
```sql
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

### 3. Add index on large table

```sql
CREATE INDEX idx_large_table_col ON large_table (column_name);
```

Consider running during low-traffic periods to minimize impact. You can also use `CREATE INDEX CONCURRENTLY` to avoid locking the table:

```sql
CREATE INDEX CONCURRENTLY idx_large_table_col ON large_table (column_name);
```

### 4. Autovacuum falling behind

You can try increasing the autovacuum workers or temporarily running a manual VACUUM:

```sql
VACUUM (VERBOSE) high_churn_table;
```

If autovacuum is too aggressive, consider reducing the scale factor. In extreme cases, you might disable autovacuum on the table and manage vacuuming manually during off-peak hours.

### Notes
- Always test migrations in staging first
- Consider using a migration tool like Flyway or Liquibase
- Schedule heavy operations during maintenance windows when possible
