# Repository Pattern & Typed Errors — With Skill

## Prompt
Build a repository layer for `diffs` and `comments` in a code review tool. Handle: diff not found, authorization for commenting, atomic thread+comment creation.

## Response

### Error Types — `features/diffs/errors.ts`

Each feature defines its own error types, colocated with the repository:

```typescript
// features/diffs/errors.ts

export class DiffNotFoundError {
  readonly _tag = 'DiffNotFoundError' as const;
  constructor(readonly diffId: string) {}
}

export class CommentForbiddenError {
  readonly _tag = 'CommentForbiddenError' as const;
  constructor(readonly userId: string, readonly diffId: string) {}
}

export class ThreadCreateError {
  readonly _tag = 'ThreadCreateError' as const;
  constructor(readonly message: string) {}
}

export class CommentCreateError {
  readonly _tag = 'CommentCreateError' as const;
  constructor(readonly message: string) {}
}

export class DatabaseError {
  readonly _tag = 'DatabaseError' as const;
  constructor(
    readonly message: string,
    readonly cause: unknown  // Wraps original error for debugging
  ) {}
}
```

### Repository — `features/diffs/repository.ts`

**Return errors as values, never throw:**

```typescript
// features/diffs/repository.ts
import { eq } from 'drizzle-orm';
import type { DB } from '../../db';
import { diffs, threads, comments } from '../../schema';
import {
  DiffNotFoundError,
  CommentForbiddenError,
  ThreadCreateError,
  CommentCreateError,
  DatabaseError,
} from './errors';

export function createDiffRepository(db: DB) {
  return {
    async findById(
      diffId: string
    ): Promise<Diff | DiffNotFoundError | DatabaseError> {
      try {
        const result = await db
          .select()
          .from(diffs)
          .where(eq(diffs.id, diffId))
          .limit(1);

        if (result.length === 0) {
          return new DiffNotFoundError(diffId);
        }
        return result[0];
      } catch (error) {
        return new DatabaseError('Failed to fetch diff', error);
      }
    },

    async createThreadWithComment(
      diffId: string,
      userId: string,
      threadData: NewThread,
      commentData: NewComment
    ): Promise<
      | { thread: Thread; comment: Comment }
      | DiffNotFoundError
      | CommentForbiddenError
      | ThreadCreateError
      | CommentCreateError
      | DatabaseError
    > {
      try {
        // Verify diff exists
        const diff = await this.findById(diffId);
        if (diff instanceof DiffNotFoundError) return diff;
        if (diff instanceof DatabaseError) return diff;

        // Check authorization
        if (!diff.allowedUserIds.includes(userId)) {
          return new CommentForbiddenError(userId, diffId);
        }

        // Atomic transaction — return type is union of all possible errors
        return await db.transaction(async (tx) => {
          const [thread] = await tx
            .insert(threads)
            .values({ ...threadData, diffId })
            .returning();

          if (!thread) {
            return new ThreadCreateError('Failed to create thread');
          }

          const [comment] = await tx
            .insert(comments)
            .values({ ...commentData, threadId: thread.id, authorId: userId })
            .returning();

          if (!comment) {
            return new CommentCreateError('Failed to create comment');
          }

          return { thread, comment };
        });
      } catch (error) {
        return new DatabaseError('Transaction failed', error);
      }
    },
  };
}

// Derive repository type from factory
export type DiffRepository = ReturnType<typeof createDiffRepository>;
```

### Route Handler — Exhaustive Error Mapping

```typescript
// features/diffs/routes.ts
import {
  DiffNotFoundError,
  CommentForbiddenError,
  ThreadCreateError,
  CommentCreateError,
  DatabaseError,
} from './errors';

function matchError(
  error:
    | DiffNotFoundError
    | CommentForbiddenError
    | ThreadCreateError
    | CommentCreateError
    | DatabaseError
): { status: number; code: string; message: string } {
  switch (error._tag) {
    case 'DiffNotFoundError':
      return { status: 404, code: 'DIFF_NOT_FOUND', message: `Diff ${error.diffId} not found` };
    case 'CommentForbiddenError':
      return { status: 403, code: 'COMMENT_FORBIDDEN', message: 'Not allowed to comment on this diff' };
    case 'ThreadCreateError':
      return { status: 500, code: 'THREAD_CREATE_FAILED', message: error.message };
    case 'CommentCreateError':
      return { status: 500, code: 'COMMENT_CREATE_FAILED', message: error.message };
    case 'DatabaseError':
      return { status: 500, code: 'DATABASE_ERROR', message: 'Internal server error' };
  }
}
```

### Key Principles
- **Errors as values** — functions return union types, never throw
- **Domain-specific error classes** — one per business failure (`DiffNotFoundError`, `CommentForbiddenError`), not a generic catch-all
- **DatabaseError wraps `cause`** — preserves the original error for debugging
- **Errors colocated** in `errors.ts` alongside the repository
- **Exhaustive `matchError()`** — every error maps to a specific HTTP status + code
- **Transaction return type** — union of all possible errors from each step
- **`ReturnType<typeof createDiffRepository>`** — derive the repo type from the factory function
