# Security & Access Control — Without Skill

## Prompt
Multi-tenant SaaS with Supabase: set up DB access, tenant isolation, password/API key storage, and user-input search queries.

## Response

### 1. Database Access

Use the default Supabase connection with the service role key for server-side operations. For client-side, use the anon key with RLS.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### 2. Tenant Isolation

Add an `organization_id` column to all tables and filter by it in your queries:

```typescript
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('organization_id', user.orgId);
```

You can also set up RLS policies in Supabase for additional security:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own org" ON projects
  USING (organization_id = auth.jwt()->>'org_id');
```

### 3. Password and API Key Storage

Supabase Auth handles passwords automatically. For API keys, store them in a `secrets` table:

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Search with User Input

```typescript
const { data } = await supabase
  .from('projects')
  .select('*')
  .ilike('name', `%${searchTerm}%`);
```

Supabase client library handles parameterization internally so you don't need to worry about SQL injection.

### Notes
- Use Supabase Auth for user management
- Enable RLS on sensitive tables
- Use the service role key only on the server side
