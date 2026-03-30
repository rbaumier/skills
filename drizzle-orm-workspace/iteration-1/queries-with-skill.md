# Queries & Filtering — With Skill

## Prompt
I need to build a search endpoint with Drizzle ORM (PostgreSQL). Requirements: 1) Filter users by name pattern AND role. 2) Get users created after a date who are in a list of IDs. 3) Paginate results for a table with 10 million rows. 4) Run a raw SQL query to get custom analytics. Show me the code.

## Answer

```typescript
import { eq, gt, like, and, inArray, asc, sql } from 'drizzle-orm';
import { users } from './db/schema';
import { db } from './db/client';

// 1) Filter by name pattern AND role
const filteredUsers = await db
  .select()
  .from(users)
  .where(
    and(
      like(users.name, '%John%'),
      eq(users.role, 'admin')
    )
  );

// 2) Users created after a date, in a list of IDs
const targetDate = new Date('2025-01-01');
const targetIds = [1, 5, 12, 34];

const recentSpecificUsers = await db
  .select()
  .from(users)
  .where(
    and(
      gt(users.createdAt, targetDate),
      inArray(users.id, targetIds)
    )
  );

// 3) Cursor-based pagination for 10M row table
//    OFFSET is slow on large datasets — use cursor instead
async function getNextPage(lastSeenId: number, pageSize: number = 20) {
  return db
    .select()
    .from(users)
    .where(gt(users.id, lastSeenId))
    .orderBy(asc(users.id))
    .limit(pageSize);
}

// Usage: first page
const page1 = await getNextPage(0);
// Next page: pass the last ID from previous page
const page2 = await getNextPage(page1[page1.length - 1].id);

// 4) Raw SQL analytics using the sql template tag
const analytics = await db.execute(
  sql`
    SELECT
      DATE_TRUNC('month', ${users.createdAt}) AS month,
      COUNT(*) AS signups,
      COUNT(*) FILTER (WHERE ${users.role} = 'admin') AS admin_signups
    FROM ${users}
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `
);
```

Key points:
- All filter operators (`eq`, `gt`, `like`, `and`, `inArray`) are imported from `'drizzle-orm'`.
- For 10M rows, cursor-based pagination (`where(gt(users.id, lastSeenId))`) is used instead of `.offset()` — OFFSET scans all skipped rows and gets progressively slower.
- Raw SQL uses the `sql` tagged template literal, which parameterizes values automatically to prevent SQL injection. Never build SQL strings with concatenation.
