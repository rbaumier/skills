```sql
CREATE TABLE product (
  product_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Unique identifier for the product. UUIDv7 recommended for index locality; replace gen_random_uuid() with a UUIDv7 generator in production.

  name TEXT NOT NULL,
    -- Human-readable product name displayed to customers.

  description TEXT NOT NULL DEFAULT '',
    -- Detailed product description. NOT NULL — empty string when no description provided.

  category TEXT NOT NULL,
    -- Product category for filtering and grouping. Consider a lookup table if categories are enumerated.

  price NUMERIC(10,2) NOT NULL
    CONSTRAINT product_price_chk CHECK (price > 0),
    -- Unit price in the store's base currency. NUMERIC for precision — never FLOAT for money.

  weight NUMERIC(8,3),
    -- Shipping weight in kilograms. NULL allowed: digital products have no weight.

  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    -- Semi-structured attributes (vendor info, tags, specs). NOT NULL — empty object when unused.

  is_active BOOLEAN NOT NULL DEFAULT true,
    -- Whether the product is currently available for purchase. Boolean columns must use is_/has_ prefix.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- Timestamp when the product record was created. TIMESTAMPTZ — never bare TIMESTAMP.
);

COMMENT ON COLUMN product.product_id IS 'Unique identifier. Use UUIDv7 generator for index locality in production.';
COMMENT ON COLUMN product.name IS 'Human-readable product name displayed to customers.';
COMMENT ON COLUMN product.description IS 'Detailed product description. Empty string when none provided.';
COMMENT ON COLUMN product.category IS 'Product category for filtering and grouping.';
COMMENT ON COLUMN product.price IS 'Unit price in base currency. Must be positive.';
COMMENT ON COLUMN product.weight IS 'Shipping weight in kg. NULL for digital/weightless products.';
COMMENT ON COLUMN product.metadata IS 'Semi-structured attributes — vendor info, tags, specs.';
COMMENT ON COLUMN product.is_active IS 'Whether the product is currently available for purchase.';
COMMENT ON COLUMN product.created_at IS 'Timestamp when the product record was created.';
```
