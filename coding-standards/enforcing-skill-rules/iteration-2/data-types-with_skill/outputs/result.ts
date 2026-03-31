/**
 * Shipping cost calculator.
 *
 * Pure function — computes per-item and total shipping cost without mutating input.
 * Uses weight-based tiers + country multipliers. Supports coupon-based free shipping.
 */

// --- Weight tier configuration ---

interface WeightTier {
  readonly minWeight: number;
  readonly ratePerUnit: number;
  readonly baseFee: number;
}

/**
 * Ordered highest-first so the first match wins.
 * Each tier: if item weight > minWeight, cost = weight * ratePerUnit + baseFee.
 */
const WEIGHT_TIERS: readonly WeightTier[] = [
  { minWeight: 50, ratePerUnit: 0.5, baseFee: 15 },
  { minWeight: 20, ratePerUnit: 0.3, baseFee: 8 },
] as const;

const DEFAULT_SHIPPING_COST = 5;

// --- Country multipliers ---

type CountryCode = "US" | "CA";

const COUNTRY_MULTIPLIER: Readonly<Record<CountryCode, number>> = {
  US: 1.0,
  CA: 1.3,
};

const DEFAULT_COUNTRY_MULTIPLIER = 2.5;

const FREE_SHIPPING_COUPON = "FREESHIP";

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
  readonly totalShipping: number;
}

// --- Pure helpers ---

/** Compute shipping cost for a single item based on weight tiers. */
function calculateItemShippingCost(weight: number): number {
  const tier = WEIGHT_TIERS.find((t) => weight > t.minWeight);
  if (tier) {
    return weight * tier.ratePerUnit + tier.baseFee;
  }
  return DEFAULT_SHIPPING_COST;
}

function getCountryMultiplier(country: string): number {
  return COUNTRY_MULTIPLIER[country as CountryCode] ?? DEFAULT_COUNTRY_MULTIPLIER;
}

// --- Main entry point ---

/** Calculate shipping for all items in a cart. Returns costs without mutating the cart. */
function calculateShipping(cart: Cart): ShippingResult {
  const itemCosts = cart.items.map((item) => calculateItemShippingCost(item.weight));

  const subtotal = itemCosts.reduce((sum, cost) => sum + cost, 0);

  const hasFreeShipping = cart.couponCode === FREE_SHIPPING_COUPON;
  const totalShipping = hasFreeShipping ? 0 : subtotal * getCountryMultiplier(cart.country);

  return { itemCosts, totalShipping };
}

export {
  calculateShipping,
  calculateItemShippingCost,
  getCountryMultiplier,
  type Cart,
  type CartItem,
  type ShippingResult,
};
