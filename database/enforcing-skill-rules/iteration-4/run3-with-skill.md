```sql
-- Lookup table replaces PostgreSQL ENUM (can't remove values from enums)
CREATE TABLE order_status (
  status TEXT NOT NULL PRIMARY KEY
    CONSTRAINT order_status_status_chk CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled'))
);

-- Seed valid statuses
INSERT INTO order_status (status) VALUES
  ('pending'),
  ('shipped'),
  ('delivered'),
  ('cancelled');

CREATE TABLE "order" (
  -- UUIDv7 for index locality and time-sortability; never random UUIDv4
  order_id UUID NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  -- FK to user placing this order
  user_id UUID NOT NULL
    CONSTRAINT order_user_id_user_user_id_fk REFERENCES "user"(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Current fulfillment status, references lookup table
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT order_status_order_status_status_fk REFERENCES order_status(status)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Free-text description of the order
  description TEXT,
  -- Contact email for order notifications
  email TEXT NOT NULL,
  -- Order total in currency units; must be positive
  total NUMERIC(10,2) NOT NULL,
  -- Whether the order details have been verified by staff
  is_verified BOOLEAN NOT NULL DEFAULT false,
  -- Whether payment has been received
  is_paid BOOLEAN NOT NULL DEFAULT false,
  -- Arbitrary semi-structured data attached to the order
  metadata JSONB,
  -- When the order was created
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the order was last modified
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Total must be strictly positive
  CONSTRAINT order_total_chk CHECK (total > 0)
);

-- Index FK columns to prevent cascade lock issues
CREATE INDEX order_user_id_idx ON "order" (user_id);
-- Index status for filtered queries
CREATE INDEX order_status_idx ON "order" (status);

CREATE TABLE order_item (
  -- UUIDv7 for index locality and time-sortability
  item_id UUID NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  -- FK to the parent order
  order_id UUID NOT NULL
    CONSTRAINT order_item_order_id_order_order_id_fk REFERENCES "order"(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- FK to the product being ordered
  product_id UUID NOT NULL
    CONSTRAINT order_item_product_id_product_product_id_fk REFERENCES product(product_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Number of units ordered; must be at least 1
  quantity INTEGER NOT NULL
    CONSTRAINT order_item_quantity_chk CHECK (quantity > 0),
  -- Unit price at time of order; must be positive
  price NUMERIC(10,2) NOT NULL
    CONSTRAINT order_item_price_chk CHECK (price > 0)
);

-- Index FK columns to prevent cascade lock issues
CREATE INDEX order_item_order_id_idx ON order_item (order_id);
CREATE INDEX order_item_product_id_idx ON order_item (product_id);

-- One product per order line
ALTER TABLE order_item
  ADD CONSTRAINT order_item_order_id_product_id_key UNIQUE (order_id, product_id);

-- Retrieve recent pending orders for a user within a date range
-- Uses >= / < instead of BETWEEN to avoid inclusive-end off-by-one bugs
-- Uses EXISTS instead of IN for early exit on first match
-- Uses = instead of LIKE when no wildcard is needed
CREATE FUNCTION get_recent_orders(user_id$ UUID, start_date$ TIMESTAMPTZ, end_date$ TIMESTAMPTZ)
RETURNS SETOF "order" AS $_$
  SELECT
    order_id,
    user_id,
    status,
    description,
    email,
    total,
    is_verified,
    is_paid,
    metadata,
    created_at,
    updated_at
  FROM "order"
  WHERE user_id = user_id$
    AND created_at >= start_date$
    AND created_at < end_date$
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM order_item
      WHERE order_item.order_id = "order".order_id
        AND order_item.quantity > 0
    )
  ORDER BY created_at DESC;
$_$ LANGUAGE sql;

-- Send a pg_notify event when an order is created
-- Uses format() with %L for safe string interpolation (no concatenation)
CREATE FUNCTION notify_public_order_created(order_id$ UUID)
RETURNS void AS $_$
BEGIN
  PERFORM pg_notify(
    'order_channel',
    format('Order %s created at %s with status pending', order_id$::text, now()::text)
  );
END;
$_$ LANGUAGE plpgsql;

-- Pending orders with their item quantities
-- Uses USING instead of ON when column names match
-- Lists columns explicitly instead of SELECT *
SELECT
  o.order_id,
  o.total,
  i.quantity
FROM "order" o
INNER JOIN order_item i USING (order_id)
WHERE o.status = 'pending';
```
