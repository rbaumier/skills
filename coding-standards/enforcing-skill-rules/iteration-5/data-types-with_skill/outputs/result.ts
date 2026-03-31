/**
 * Shipping cost calculator.
 *
 * Design: Weight-based tiered pricing with country multipliers.
 * Pure function — returns new data, never mutates inputs.
 * All inputs are validated and rejected if invalid (parse, don't validate).
 */

// --- Weight tier thresholds and rates ---

const HEAVY_WEIGHT_THRESHOLD_KG = 50;
const MEDIUM_WEIGHT_THRESHOLD_KG = 20;
const MAX_WEIGHT_KG = 500;

const HEAVY_RATE_PER_KG = 0.5;
const HEAVY_SURCHARGE = 15;
const MEDIUM_RATE_PER_KG = 0.3;
const MEDIUM_SURCHARGE = 8;
const LIGHT_FLAT_COST = 5;

// --- Country multipliers (exhaustive allowlist) ---

const COUNTRY_SHIPPING_MULTIPLIER: Record<SupportedCountry, number> = {
  US: 1.0,
  CA: 1.3,
  GB: 2.5,
  DE: 2.5,
  FR: 2.5,
  AU: 2.5,
} as const;

type SupportedCountry = keyof typeof COUNTRY_SHIPPING_MULTIPLIER;

// --- Valid coupon codes ---

const VALID_COUPON_CODES = new Set(["FREESHIP"]);

// --- Domain types ---

interface CartItem {
  readonly weight: number;
}

interface Cart {
  readonly items: readonly CartItem[];
  readonly country: string;
  readonly couponCode?: string;
}

interface ShippingResult {
  readonly itemCosts: readonly number[];
  readonly subtotal: number;
  readonly countryMultiplier: number;
  readonly totalShipping: number;
  readonly couponApplied: boolean;
}

// --- Guards (reject invalid input, never fallback) ---

function assertValidWeight(weight: number, index: number): void {
  if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_WEIGHT_KG) {
    throw new Error(`Item ${index}: weight must be > 0 and <= ${MAX_WEIGHT_KG}, got ${weight}`);
  }
}

function assertSupportedCountry(country: string): asserts country is SupportedCountry {
  if (!(country in COUNTRY_SHIPPING_MULTIPLIER)) {
    const allowed = Object.keys(COUNTRY_SHIPPING_MULTIPLIER).join(", ");
    throw new Error(`Unsupported country "${country}". Allowed: ${allowed}`);
  }
}

function assertValidCoupon(couponCode: string): void {
  if (!VALID_COUPON_CODES.has(couponCode)) {
    throw new Error(`Invalid coupon code: "${couponCode}"`);
  }
}

// --- Pure business logic ---

/** Cost for a single item based on weight tier. */
function itemShippingCost(weight: number): number {
  if (weight > HEAVY_WEIGHT_THRESHOLD_KG) {
    return weight * HEAVY_RATE_PER_KG + HEAVY_SURCHARGE;
  }
  if (weight > MEDIUM_WEIGHT_THRESHOLD_KG) {
    return weight * MEDIUM_RATE_PER_KG + MEDIUM_SURCHARGE;
  }
  return LIGHT_FLAT_COST;
}

/**
 * Calculate shipping for an entire cart.
 *
 * @returns A new ShippingResult — the input cart is never mutated.
 * @throws On invalid weight, unsupported country, or unknown coupon.
 */
export function calculateShipping(cart: Cart): ShippingResult {
  if (cart.items.length === 0) {
    throw new Error("Cart must contain at least one item");
  }

  // Validate every input at the boundary
  cart.items.forEach((item, index) => assertValidWeight(item.weight, index));
  assertSupportedCountry(cart.country);
  if (cart.couponCode !== undefined) {
    assertValidCoupon(cart.couponCode);
  }

  const itemCosts = cart.items.map((item) => itemShippingCost(item.weight));
  const subtotal = itemCosts.reduce((sum, cost) => sum + cost, 0);
  const countryMultiplier = COUNTRY_SHIPPING_MULTIPLIER[cart.country];
  const couponApplied = cart.couponCode === "FREESHIP";
  const totalShipping = couponApplied ? 0 : subtotal * countryMultiplier;

  return {
    itemCosts,
    subtotal,
    countryMultiplier,
    totalShipping,
    couponApplied,
  };
}
