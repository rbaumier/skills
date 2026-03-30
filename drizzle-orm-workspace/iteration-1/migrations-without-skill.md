# Migrations & Config — Without Skill

## Prompt
I'm setting up Drizzle ORM for the first time in a new project. Show me the drizzle.config.ts file, explain how to generate and apply migrations, and show what a typical migration workflow looks like.

## Answer

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

const config: Config = {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};

export default config;
```

### Migration Workflow

```bash
# Generate a migration
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# You can also push schema directly (dev only)
npx drizzle-kit push
```

### Workflow

1. Update your schema file
2. Generate a migration
3. Apply it
4. Commit the migration file

That's it! Drizzle Kit handles comparing your schema to the database and generating the appropriate SQL.
