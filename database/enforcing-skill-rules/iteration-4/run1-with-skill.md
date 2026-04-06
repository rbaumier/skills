```sql
-- ---------------------------------------------------------------------------
-- Lookup table replaces ENUM (no PostgreSQL enums — can't remove values)
-- ---------------------------------------------------------------------------
CREATE TABLE order_status (
  status TEXT PRIMARY KEY
    CONSTRAINT order_status_status_chk CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled'))
);
COMMENT ON COLUMN order_status.status IS 'Canonical order lifecycle state — used as FK by order table';

INSERT INTO order_status (status) VALUES ('pending'), ('shipped'), ('delivered'), ('cancelled');

-- ---------------------------------------------------------------------------
-- order table (singular naming per convention)
-- ---------------------------------------------------------------------------
CREATE TABLE "order" (
  order_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- FK to user table with explicit ON DELETE / ON UPDATE
  user_id UUID NOT NULL
    REFERENCES "user" (user_id) ON DELETE CASCADE ON UPDATE CASCADE,

  -- FK to lookup table instead of enum
  status TEXT NOT NULL DEFAULT 'pending'
    REFERENCES order_status (status) ON DELETE RESTRICT ON UPDATE CASCADE,

  -- "desc" is a reserved keyword — renamed to description; TEXT not VARCHAR
  description TEXT NOT NULL,

  -- PII — consider encrypting at rest with pgcrypto if compliance requires
  email TEXT NOT NULL,

  -- NUMERIC for money, never FLOAT
  total NUMERIC(10,2) NOT NULL,

  -- Boolean columns prefixed with is_ / has_
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_paid BOOLEAN NOT NULL DEFAULT false,

  -- Semi-structured data stored as JSONB
  metadata JSONB,

  -- TIMESTAMPTZ not TIMESTAMP
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CHECK constraint with proper naming
  CONSTRAINT order_total_chk CHECK (total > 0)
);

COMMENT ON COLUMN "order".order_id IS 'Primary key — ideally UUIDv7 for index locality';
COMMENT ON COLUMN "order".user_id IS 'References the owning user';
COMMENT ON COLUMN "order".status IS 'Current lifecycle state — FK to order_status lookup table';
COMMENT ON COLUMN "order".description IS 'Free-text description of the order';
COMMENT ON COLUMN "order".email IS 'Contact email for order notifications — PII, encrypt if compliance requires';
COMMENT ON COLUMN "order".total IS 'Order total in base currency units';
COMMENT ON COLUMN "order".is_verified IS 'Whether the order has been verified by staff';
COMMENT ON COLUMN "order".is_paid IS 'Whether payment has been received';
COMMENT ON COLUMN "order".metadata IS 'Semi-structured data — integration references, feature flags, etc.';
COMMENT ON COLUMN "order".created_at IS 'Row creation timestamp';
COMMENT ON COLUMN "order".updated_at IS 'Last modification timestamp — updated by application or trigger';

-- Index FK columns — prevents cascade lock issues
CREATE INDEX order_user_id_idx ON "order" (user_id);
CREATE INDEX order_status_idx ON "order" (status);

-- ---------------------------------------------------------------------------
-- order_item table (singular naming)
-- ---------------------------------------------------------------------------
CREATE TABLE order_item (
  item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  order_id UUID NOT NULL
    REFERENCES "order" (order_id) ON DELETE CASCADE ON UPDATE CASCADE,

  product_id UUID NOT NULL
    REFERENCES product (product_id) ON DELETE RESTRICT ON UPDATE CASCADE,

  -- NOT NULL — quantity must be positive
  quantity INTEGER NOT NULL,

  -- NUMERIC for money
  price NUMERIC(10,2) NOT NULL,

  -- Unique constraint with proper naming
  CONSTRAINT order_item_order_id_product_id_key UNIQUE (order_id, product_id),

  -- CHECK constraints — make invalid data unrepresentable
  CONSTRAINT order_item_quantity_chk CHECK (quantity > 0),
  CONSTRAINT order_item_price_chk CHECK (price > 0)
);

COMMENT ON COLUMN order_item.item_id IS 'Primary key — ideally UUIDv7 for index locality';
COMMENT ON COLUMN order_item.order_id IS 'References the parent order';
COMMENT ON COLUMN order_item.product_id IS 'References the purchased product';
COMMENT ON COLUMN order_item.quantity IS 'Number of units ordered — must be positive';
COMMENT ON COLUMN order_item.price IS 'Unit price at time of purchase — snapshot, not a live reference';

-- Index FK columns
CREATE INDEX order_item_order_id_idx ON order_item (order_id);
CREATE INDEX order_item_product_id_idx ON order_item (product_id);

-- ---------------------------------------------------------------------------
-- Function: get_recent_order
-- Fixes:
--   - Parameter names suffixed with $ to avoid column name ambiguity
--   - No SELECT * — explicit columns
--   - >= / < instead of BETWEEN for timestamps (off-by-one prevention)
--   - EXISTS instead of IN (exits on first match)
--   - = instead of LIKE when no wildcard needed
--   - Dollar-quoting with $_$
-- ---------------------------------------------------------------------------
CREATE FUNCTION get_recent_order(user_id$ UUID, start_date$ TIMESTAMPTZ, end_date$ TIMESTAMPTZ)
RETURNS TABLE (
  order_id UUID,
  user_id UUID,
  status TEXT,
  description TEXT,
  email TEXT,
  total NUMERIC(10,2),
  is_verified BOOLEAN,
  is_paid BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $_$
  SELECT
    o.order_id,
    o.user_id,
    o.status,
    o.description,
    o.email,
    o.total,
    o.is_verified,
    o.is_paid,
    o.metadata,
    o.created_at,
    o.updated_at
  FROM "order" o
  WHERE o.user_id = user_id$
    AND o.created_at >= start_date$
    AND o.created_at < end_date$
    AND o.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM order_item oi
      WHERE oi.order_id = o.order_id
        AND oi.quantity > 0
    )
  ORDER BY o.created_at DESC;
$_$ LANGUAGE sql;

-- ---------------------------------------------------------------------------
-- Function: notify_order_created
-- Fixes:
--   - Renamed to notify_schema_table_event() convention
--   - Parameter suffixed with $ to avoid ambiguity
--   - Parameterized — no string concatenation of user input into SQL
--   - Uses clock_timestamp() instead of now() (wall-clock, not txn time)
--   - Dollar-quoting with $_$
-- ---------------------------------------------------------------------------
CREATE FUNCTION notify_order_order_created(order_id$ UUID)
RETURNS void AS $_$
BEGIN
  PERFORM pg_notify(
    'order_channel',
    json_build_object(
      'order_id', order_id$,
      'created_at', clock_timestamp(),
      'status', 'pending'
    )::text
  );
END;
$_$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Query: pending orders with items
-- Fixes:
--   - No SELECT * — explicit columns
--   - USING (order_id) instead of ON when column names match
-- ---------------------------------------------------------------------------
SELECT
  o.order_id,
  o.total,
  i.quantity
FROM "order" o
INNER JOIN order_item i USING (order_id)
WHERE o.status = 'pending';
```
