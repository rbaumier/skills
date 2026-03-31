/**
 * Calculates shipping cost for a cart based on item weights, destination country,
 * and optional coupon. Returns a new ShippingResult without mutating the input.
 *
 * Weight tiers: heavy (>50lb), medium (>20lb), light (<=20lb).
 * Country multipliers applied after item costs are summed.
 * FREESHIP coupon zeroes the total.
 */

// --- Constants: every magic number is a named decision ---

const WEIGHT_THRESHOLD_HEAVY_LB = 50;
const WEIGHT_THRESHOLD_MEDIUM_LB = 20;

const HEAVY_RATE_PER_LB = 0.5;
const HEAVY_SURCHARGE = 15;
const MEDIUM_RATE_PER_LB = 0.3;
const MEDIUM_SURCHARGE = 8;
const LIGHT_FLAT_RATE = 5;

const COUNTRY_MULTIPLIERS: Record<Country, number> = {
  US: 1.0,
  CA: 1.3,
} as const;

const DEFAULT_COUNTRY_MULTIPLIER = 2.5;

const FREE_SHIPPING_COUPON = "FREESHIP";

// --- Types: make invalid states unrepresentable ---

type Country = "US" | "CA";

interface CartItem {
  readonly weight: number;
  readonly [key: string]: unknown;
}

interface Cart {
  readonly items: readonly CartItem[];
  readonly country: string;
  readonly couponCode?: string;
}

interface ItemShippingCost {
  readonly item: CartItem;
  readonly shippingCost: number;
}

interface ShippingResult {
  readonly itemCosts: readonly ItemShippingCost[];
  readonly totalShipping: number;
}

// --- Pure functions ---

/** Compute shipping cost for a single item based on weight tier. */
function calculateItemShippingCost(item: CartItem): number {
  if (item.weight <= 0) {
    return 0;
  }

  if (item.weight > WEIGHT_THRESHOLD_HEAVY_LB) {
    return item.weight * HEAVY_RATE_PER_LB + HEAVY_SURCHARGE;
  }

  if (item.weight > WEIGHT_THRESHOLD_MEDIUM_LB) {
    return item.weight * MEDIUM_RATE_PER_LB + MEDIUM_SURCHARGE;
  }

  return LIGHT_FLAT_RATE;
}

/** Resolve country multiplier — known countries use the map, others get default. */
function getCountryMultiplier(country: string): number {
  return COUNTRY_MULTIPLIERS[country as Country] ?? DEFAULT_COUNTRY_MULTIPLIER;
}

/** Calculate shipping for the entire cart. Pure — returns new data, never mutates input. */
function calculateShipping(cart: Cart): ShippingResult {
  const itemCosts: ItemShippingCost[] = cart.items.map((item) => ({
    item,
    shippingCost: calculateItemShippingCost(item),
  }));

  const subtotal = itemCosts.reduce((sum, entry) => sum + entry.shippingCost, 0);

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
  type ItemShippingCost,
};
