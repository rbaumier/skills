```sql
CREATE TABLE product (
  product_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Unique identifier for the product. UUIDv7 recommended for index locality; swap gen_random_uuid() for a UUIDv7 generator in production.

  name TEXT NOT NULL
    CONSTRAINT product_name_chk CHECK (length(name) > 0),
    -- Human-readable product name. Must not be empty.

  description TEXT NOT NULL DEFAULT '',
    -- Detailed product description. Empty string when not yet provided; NOT NULL avoids ambiguous absence semantics.

  category TEXT NOT NULL,
    -- Product classification (e.g. 'electronics', 'clothing'). Consider a dedicated lookup table if categories grow or need metadata.

  price NUMERIC(10,2) NOT NULL
    CONSTRAINT product_price_chk CHECK (price > 0),
    -- Selling price in base currency. NUMERIC for exact arithmetic; must be strictly positive.

  weight NUMERIC(10,3) NOT NULL
    CONSTRAINT product_weight_chk CHECK (weight > 0),
    -- Product weight in kilograms. NUMERIC instead of FLOAT to avoid floating-point rounding. Must be positive.

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Semi-structured attributes (specs, tags, vendor data). Empty object by default; NOT NULL so consumers never need null-checks.

  is_active BOOLEAN NOT NULL DEFAULT true,
    -- Whether the product is currently available for sale. Prefixed with is_ per naming convention.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- Timestamp of row creation. TIMESTAMPTZ ensures timezone awareness.
);

COMMENT ON TABLE product IS 'Canonical product catalog. One row per sellable product.';
COMMENT ON COLUMN product.product_id IS 'Unique identifier. Prefer UUIDv7 generator for index locality over random UUIDv4.';
COMMENT ON COLUMN product.name IS 'Human-readable product name. Enforced non-empty via CHECK.';
COMMENT ON COLUMN product.description IS 'Detailed product description. Defaults to empty string.';
COMMENT ON COLUMN product.category IS 'Product classification. Consider a lookup table for controlled vocabulary.';
COMMENT ON COLUMN product.price IS 'Selling price in base currency units. NUMERIC for exact math, CHECK > 0.';
COMMENT ON COLUMN product.weight IS 'Weight in kilograms. NUMERIC avoids floating-point drift, CHECK > 0.';
COMMENT ON COLUMN product.metadata IS 'Semi-structured attributes stored as JSONB. Defaults to empty object.';
COMMENT ON COLUMN product.is_active IS 'Whether this product is currently available for sale.';
COMMENT ON COLUMN product.created_at IS 'Row creation timestamp with timezone.';
```
