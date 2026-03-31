# Gotchas — Without Skill

## Prompt
Review the provided PostgreSQL code for issues (TRUNCATE, SELECT *, NOW(), schema with VARCHAR/FLOAT/TIMESTAMP, missing FK indexes, 5 instances x 20 pool).

## Response

### Issues Found

#### 1. Schema issues

- `gen_random_uuid()` is fine for UUIDs but consider using `uuid-ossp` extension for UUIDv4
- The `FLOAT` type for price could cause precision issues — consider using `DECIMAL(10,2)` instead
- `VARCHAR(255)` is fine but you could use `TEXT` if you don't need length validation

#### 2. `SELECT *` usage

Using `SELECT *` is generally discouraged in production as it fetches unnecessary columns. Better to list specific columns.

#### 3. TRUNCATE for cleanup

`TRUNCATE` is fast for deleting all rows but be aware it's a DDL operation and will auto-commit in some contexts. Consider adding a WHERE clause with `DELETE` if you only need to remove a subset.

#### 4. Timestamps

The `TIMESTAMP` type stores timestamps without timezone info. Consider whether you need `TIMESTAMP WITH TIME ZONE` depending on your requirements.

#### 5. Connection pooling

With 5 instances and 20 connections each, you're using 100 connections total. Make sure your PostgreSQL `max_connections` is set high enough, perhaps 200 to leave headroom.

### Notes
- Consider adding indexes on frequently queried columns
- Monitor query performance with `EXPLAIN ANALYZE`
- The foreign key references look correct
