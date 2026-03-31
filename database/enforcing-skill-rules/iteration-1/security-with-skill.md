# Security & Access Control — With Skill

## Prompt
Multi-tenant SaaS with Supabase: set up DB access, tenant isolation, password/API key storage, and user-input search queries.

## Response

### 1. Database Access

**App users should never be superuser.** Create a dedicated role with least privilege — grant only the specific operations needed on specific tables:

```sql
CREATE ROLE app_service LOGIN PASSWORD 'secure_password';

-- Grant only what the app needs
GRANT SELECT, INSERT, UPDATE, DELETE ON users, projects, tasks TO app_service;
GRANT USAGE ON SCHEMA public TO app_service;

-- Never grant superuser, CREATEDB, or CREATEROLE
```

### 2. Tenant Isolation — Row Level Security

**Enforce RLS on every table.** With Supabase, RLS is the primary isolation mechanism:

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their organization's data
CREATE POLICY tenant_isolation ON projects
  FOR ALL
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY tenant_isolation ON tasks
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
  );
```

**Keep policies performant** — avoid expensive joins in policies. Use `auth.uid()` and direct lookups rather than multi-table joins. Index the columns used in policy expressions.

### 3. Password and API Key Storage

- **Passwords**: Use **bcrypt** or **argon2** for hashing. Never store passwords in plain text.

```sql
-- Store hashed password using pgcrypto
UPDATE users SET password_hash = crypt($1, gen_salt('bf', 12)) WHERE id = $2;

-- Verify
SELECT id FROM users WHERE email = $1 AND password_hash = crypt($2, password_hash);
```

- **API Keys**: **Never store API keys or secrets in plain text** in the database. Use application-level encryption or a secrets manager (Vault, AWS Secrets Manager). If you must store in DB, encrypt with pgcrypto:

```sql
-- Encrypt
UPDATE api_keys SET key_encrypted = pgp_sym_encrypt($1, $encryption_key) WHERE id = $2;
```

- **PII Protection**: Identify all PII columns. Encrypt sensitive columns at rest using pgcrypto if compliance requires (GDPR, HIPAA, SOC2).

### 4. Search with User Input — Parameterized Queries Only

**Never concatenate user input into SQL strings.** This is the #1 vector for SQL injection.

Always use **parameterized queries**:

```typescript
// CORRECT — parameterized
const result = await db.query(
  'SELECT id, name FROM projects WHERE name ILIKE $1 AND organization_id = $2',
  [`%${searchTerm}%`, orgId]
);

// WRONG — string concatenation (SQL injection vulnerability)
// const result = await db.query(`SELECT * FROM projects WHERE name LIKE '%${searchTerm}%'`);
```

With Drizzle ORM, the query builder automatically parameterizes:

```typescript
const results = await db
  .select({ id: projects.id, name: projects.name })
  .from(projects)
  .where(and(
    ilike(projects.name, `%${searchTerm}%`),
    eq(projects.organizationId, orgId)
  ));
```
