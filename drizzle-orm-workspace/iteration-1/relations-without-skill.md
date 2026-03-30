# Relations & Relational Queries — Without Skill

## Prompt
Using Drizzle ORM with PostgreSQL, I have users, posts, and tags tables. Users have many posts (one-to-many). Posts and tags have a many-to-many relationship. Show me the complete schema with relations and a query that fetches all users with their posts and each post's tags.

## Answer

```typescript
import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: integer('author_id').references(() => users.id),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

export const postTags = pgTable('post_tags', {
  postId: integer('post_id').references(() => posts.id),
  tagId: integer('tag_id').references(() => tags.id),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  tags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

// Query
const result = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId))
  .leftJoin(postTags, eq(posts.id, postTags.postId))
  .leftJoin(tags, eq(postTags.tagId, tags.id));
```

This joins all the tables together. You'll need to reshape the flat result into a nested structure in your application code.
