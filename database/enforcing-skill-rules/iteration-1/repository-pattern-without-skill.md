# Repository Pattern & Typed Errors — Without Skill

## Prompt
Build a repository layer for `diffs` and `comments` in a code review tool. Handle: diff not found, authorization for commenting, atomic thread+comment creation.

## Response

### Repository Layer

```typescript
// repositories/DiffRepository.ts

export class DiffRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Diff> {
    const diff = await this.db.query('SELECT * FROM diffs WHERE id = $1', [id]);
    if (!diff) {
      throw new Error(`Diff not found: ${id}`);
    }
    return diff;
  }

  async createComment(diffId: string, userId: string, content: string): Promise<Comment> {
    // Check diff exists
    const diff = await this.findById(diffId);

    // Check authorization
    if (!diff.allowedUsers.includes(userId)) {
      throw new Error('Unauthorized to comment on this diff');
    }

    return this.db.query(
      'INSERT INTO comments (diff_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
      [diffId, userId, content]
    );
  }

  async createThreadWithComment(
    diffId: string,
    userId: string,
    threadTitle: string,
    commentContent: string
  ): Promise<{ thread: Thread; comment: Comment }> {
    // Use a transaction for atomicity
    return this.db.transaction(async (tx) => {
      const thread = await tx.query(
        'INSERT INTO threads (diff_id, title) VALUES ($1, $2) RETURNING *',
        [diffId, threadTitle]
      );

      const comment = await tx.query(
        'INSERT INTO comments (thread_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
        [thread.id, userId, commentContent]
      );

      return { thread, comment };
    });
  }
}
```

### Error Handling in Routes

```typescript
// routes/diffs.ts
app.post('/diffs/:id/threads', async (req, res) => {
  try {
    const result = await diffRepo.createThreadWithComment(
      req.params.id,
      req.user.id,
      req.body.title,
      req.body.content
    );
    res.json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

### Notes
- Use class-based repository pattern for encapsulation
- Transactions ensure atomicity for multi-step operations
- Error handling via try/catch in route handlers
- Consider adding a base Repository class for common CRUD operations
