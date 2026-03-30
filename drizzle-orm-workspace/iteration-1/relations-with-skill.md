# Relations & Relational Queries — With Skill

## Prompt
Using Drizzle ORM with PostgreSQL, I have users, posts, and tags tables. Users have many posts (one-to-many). Posts and tags have a many-to-many relationship. Show me the complete schema with relations and a query that fetches all users with their posts and each post's tags.

## Answer

```typescript
// db/schema.ts
import { pgTable, serial, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Tables ---

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: integer('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

// Junction table for many-to-many
export const postsToTags = pgTable('posts_to_tags', {
  postId: integer('post_id').notNull().references(() => posts.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tagId] }),
}));

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  tags: many(postsToTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postsToTags),
}));

export const postsToTagsRelations = relations(postsToTags, ({ one }) => ({
  post: one(posts, { fields: [postsToTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postsToTags.tagId], references: [tags.id] }),
}));

// --- Query ---

// Fetch all users with their posts and each post's tags
const usersWithPostsAndTags = await db.query.users.findMany({
  with: {
    posts: {
      with: {
        tags: {
          with: {
            tag: true,
          },
        },
      },
    },
  },
});
```

Key points:
- The `relations()` helper from `drizzle-orm` defines the relationship graph separately from the table schema.
- Many-to-many uses an explicit junction table `postsToTags` with a composite `primaryKey({ columns: [table.postId, table.tagId] })`.
- `db.query.users.findMany({ with: { ... } })` loads nested relations in a single optimized query.
