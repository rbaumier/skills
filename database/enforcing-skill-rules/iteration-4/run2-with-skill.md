```sql
-- Lookup table replaces enum (can't remove enum values in PostgreSQL)
CREATE TABLE order_status (
  status TEXT PRIMARY KEY
    CONSTRAINT order_status_status_chk CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled'))
);
COMMENT ON COLUMN order_status.status IS 'Order lifecycle state — lookup table instead of enum so values can be added or retired';

INSERT INTO order_status (status) VALUES ('pending'), ('shipped'), ('delivered'), ('cancelled');

CREATE TABLE "order" (
  order_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' REFERENCES order_status(status) ON DELETE RESTRICT ON UPDATE CASCADE,
  description TEXT NOT NULL,
  email TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN "order".order_id IS 'Unique identifier for the order — UUIDv7 recommended for index locality';
COMMENT ON COLUMN "order".user_id IS 'References the user who placed this order';
COMMENT ON COLUMN "order".status IS 'Current lifecycle state — references order_status lookup table';
COMMENT ON COLUMN "order".description IS 'Free-text description of the order provided by the user';
COMMENT ON COLUMN "order".email IS 'Contact email for order notifications';
COMMENT ON COLUMN "order".total IS 'Order total in base currency — must be positive';
COMMENT ON COLUMN "order".is_verified IS 'Whether the order details have been verified';
COMMENT ON COLUMN "order".is_paid IS 'Whether payment has been received';
COMMENT ON COLUMN "order".metadata IS 'Semi-structured data for extensibility — default empty object';
COMMENT ON COLUMN "order".created_at IS 'Timestamp when the order was created';
COMMENT ON COLUMN "order".updated_at IS 'Timestamp of last modification — updated by application or trigger';

-- FK index on user_id — prevents cascade lock issues
CREATE INDEX order_user_id_idx ON "order" (user_id);

-- FK index on status
CREATE INDEX order_status_idx ON "order" (status);

-- Check constraint with proper naming
ALTER TABLE "order" ADD CONSTRAINT order_total_chk CHECK (total > 0);

CREATE TABLE order_item (
  item_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  product_id UUID NOT NULL REFERENCES product(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL
);

COMMENT ON COLUMN order_item.item_id IS 'Unique identifier for the line item';
COMMENT ON COLUMN order_item.order_id IS 'Parent order this item belongs to';
COMMENT ON COLUMN order_item.product_id IS 'Product being ordered';
COMMENT ON COLUMN order_item.quantity IS 'Number of units — must be at least 1';
COMMENT ON COLUMN order_item.price IS 'Unit price at time of order — must be positive';

-- FK indexes on order_item
CREATE INDEX order_item_order_id_idx ON order_item (order_id);
CREATE INDEX order_item_product_id_idx ON order_item (product_id);

-- Unique constraint with proper naming
ALTER TABLE order_item ADD CONSTRAINT order_item_order_id_product_id_key UNIQUE (order_id, product_id);

-- Check constraints for order_item
ALTER TABLE order_item ADD CONSTRAINT order_item_quantity_chk CHECK (quantity > 0);
ALTER TABLE order_item ADD CONSTRAINT order_item_price_chk CHECK (price > 0);

-- Function: parameter suffixed with $ to avoid ambiguity, explicit columns, EXISTS over IN, >= / < over BETWEEN, = over LIKE
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
        AND quantity > 0
    )
  ORDER BY created_at DESC;
$_$ LANGUAGE sql;

-- Notification function: parameterized approach, no string concatenation with user input
CREATE FUNCTION notify_order_created(order_id$ UUID)
RETURNS void AS $_$
BEGIN
  PERFORM pg_notify('order_channel', json_build_object(
    'order_id', order_id$,
    'event', 'created',
    'timestamp', now()
  )::text);
END;
$_$ LANGUAGE plpgsql;

-- Query: explicit columns, USING for matching column name
SELECT
  o.order_id,
  o.total,
  i.quantity
FROM "order" o
INNER JOIN order_item i USING (order_id)
WHERE o.status = 'pending';
```
