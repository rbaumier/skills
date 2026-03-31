# Schema Design — With Skill

## Prompt
Design a PostgreSQL schema for a SaaS multi-tenant project management app with organizations, projects, tasks (with price estimates), soft-deletable users, and flexible user preferences.

## Response

```sql
-- Enable pgcrypto for UUIDv7 generation (or use application-level uuidv7)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY,  -- UUIDv7 generated at application layer for index locality
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
-- Soft delete via deleted_at + partial unique index pattern
CREATE TABLE users (
  id UUID PRIMARY KEY,  -- UUIDv7
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',  -- flexible key-value semi-structured data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ  -- NULL = active, set = soft-deleted
);

-- Partial unique index: email uniqueness only among active users
CREATE UNIQUE INDEX users_email_active_idx ON users (email) WHERE deleted_at IS NULL;

-- FK index for organization_id
CREATE INDEX users_organization_id_idx ON users (organization_id);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,  -- UUIDv7
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK index
CREATE INDEX projects_organization_id_idx ON projects (organization_id);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY,  -- UUIDv7
  project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  price_estimate NUMERIC NOT NULL DEFAULT 0,  -- NUMERIC for money, never FLOAT
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CHECK constraints: make invalid data unrepresentable
  CONSTRAINT tasks_price_positive CHECK (price_estimate >= 0),
  CONSTRAINT tasks_status_valid CHECK (status IN ('todo', 'in_progress', 'review', 'done'))
);

-- FK index
CREATE INDEX tasks_project_id_idx ON tasks (project_id);
```

### Key decisions

- **UUIDv7** for all primary keys — time-sortable, index-friendly for B-tree clustered inserts. Avoid random UUIDv4 which causes index page splits.
- **TEXT over VARCHAR** everywhere — no artificial length limits; PostgreSQL stores them identically internally.
- **TIMESTAMPTZ** (with time zone) on all temporal columns — never bare TIMESTAMP which loses timezone context.
- **NUMERIC for price_estimate** — never FLOAT/REAL which has floating-point precision issues for monetary values.
- **JSONB for preferences** — semi-structured key-value data stays flexible while core entities remain relational.
- **snake_case** naming throughout — consistent convention for tables and columns.
- **Soft delete via `deleted_at`** with a partial unique index on email for active users only — avoids cluttering the table with a boolean `is_deleted` flag and allows re-registration of deleted emails.
- **CHECK constraints** on status (enum-like validation) and price (non-negative) — enforce data validity at the DB level.
- **Explicit FK indexes** on every foreign key column — PostgreSQL does NOT auto-index foreign keys, and missing indexes cause cascade lock issues.
