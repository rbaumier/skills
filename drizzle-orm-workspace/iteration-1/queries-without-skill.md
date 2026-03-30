# Queries & Filtering — Without Skill

## Prompt
I need to build a search endpoint with Drizzle ORM (PostgreSQL). Requirements: 1) Filter users by name pattern AND role. 2) Get users created after a date who are in a list of IDs. 3) Paginate results for a table with 10 million rows. 4) Run a raw SQL query to get custom analytics. Show me the code.

## Answer

```typescript
import { eq, gt, like, and, inArray, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { users } from './schema';

// 1) Filter by name pattern AND role
const filtered = await db
  .select()
  .from(users)
  .where(
    and(
      like(users.name, '%John%'),
      eq(users.role, 'admin')
    )
  );

// 2) Created after date + in ID list
const results = await db
  .select()
  .from(users)
  .where(
    and(
      gt(users.createdAt, new Date('2025-01-01')),
      inArray(users.id, [1, 5, 12, 34])
    )
  );

// 3) Pagination for large table
const page = 5;
const pageSize = 20;

const paginated = await db
  .select()
  .from(users)
  .orderBy(desc(users.createdAt))
  .limit(pageSize)
  .offset(page * pageSize);

// 4) Raw SQL analytics
const analytics = await db.execute(
  sql`SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) as total FROM users GROUP BY month ORDER BY month DESC`
);
```

This handles all the requirements. The pagination uses limit/offset which is the standard approach. The raw query uses the sql tagged template for safety.
