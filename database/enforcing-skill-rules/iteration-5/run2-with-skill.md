```sql
CREATE TABLE product (
  product_id UUID NOT NULL DEFAULT uuidv7() PRIMARY KEY,

  name TEXT NOT NULL
    CONSTRAINT product_name_chk CHECK (length(name) > 0),

  description TEXT NOT NULL DEFAULT '',

  category TEXT NOT NULL
    CONSTRAINT product_category_chk CHECK (length(category) > 0),

  price NUMERIC(10,2) NOT NULL
    CONSTRAINT product_price_chk CHECK (price > 0),

  weight NUMERIC(10,3) NOT NULL DEFAULT 0
    CONSTRAINT product_weight_chk CHECK (weight >= 0),

  metadata JSONB NOT NULL DEFAULT '{}',

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN product.product_id IS 'UUIDv7 primary key — time-sortable, index-friendly locality';
COMMENT ON COLUMN product.name IS 'Human-readable product name, must be non-empty';
COMMENT ON COLUMN product.description IS 'Optional long-form product description, empty string when not provided';
COMMENT ON COLUMN product.category IS 'Product category for classification and filtering';
COMMENT ON COLUMN product.price IS 'Unit price in base currency, must be positive, NUMERIC to avoid floating-point rounding';
COMMENT ON COLUMN product.weight IS 'Product weight in kilograms, NUMERIC for precision — defaults to 0 when unknown';
COMMENT ON COLUMN product.metadata IS 'Semi-structured product attributes as JSONB — extensible without schema migration';
COMMENT ON COLUMN product.is_active IS 'Whether the product is available for sale — prefixed is_ per boolean naming convention';
COMMENT ON COLUMN product.created_at IS 'Row creation timestamp with timezone — immutable after insert';
```
