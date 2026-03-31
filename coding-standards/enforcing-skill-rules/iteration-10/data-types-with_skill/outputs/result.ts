// --- Types ---

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

// --- Config (externalized business parameters) ---

const MAX_WEIGHT = 500;
const VALID_COUNTRIES = ["US", "CA"] as const;
type Country = (typeof VALID_COUNTRIES)[number];

const WEIGHT_TIERS = [
  { minWeight: 50, ratePerUnit: 0.5, baseFee: 15 },
  { minWeight: 20, ratePerUnit: 0.3, baseFee: 8 },
] as const;

const DEFAULT_SHIPPING_FEE = 5;

const COUNTRY_MULTIPLIERS: Record<Country, number> = {
  US: 1.0,
  CA: 1.3,
};

const INTERNATIONAL_MULTIPLIER = 2.5;

const FREE_SHIPPING_COUPON = "FREESHIP";

// --- Pure functions ---

function isValidCountry(country: string): country is Country {
  return (VALID_COUNTRIES as readonly string[]).includes(country);
}

/** Compute shipping cost for a single item based on weight tiers. */
function computeItemShippingCost(weight: number): number {
  const tier = WEIGHT_TIERS.find((t) => weight > t.minWeight);
  if (tier) {
    return weight * tier.ratePerUnit + tier.baseFee;
  }
  return DEFAULT_SHIPPING_FEE;
}

/** Apply country-based multiplier to a base cost. */
function applyCountryMultiplier(baseCost: number, country: string): number {
  if (isValidCountry(country)) {
    return baseCost * COUNTRY_MULTIPLIERS[country];
  }
  return baseCost * INTERNATIONAL_MULTIPLIER;
}

/**
 * Calculate shipping for a cart.
 * Returns a new ShippingResult — never mutates the input.
 *
 * @throws {Error} on empty cart or invalid item weights
 */
function calculateShipping(cart: Cart): ShippingResult {
  if (cart.items.length === 0) {
    throw new Error("Cart must contain at least one item");
  }

  const invalidItem = cart.items.find((item) => item.weight <= 0 || item.weight > MAX_WEIGHT);
  if (invalidItem) {
    throw new Error(`Item weight must be between 0 and ${MAX_WEIGHT}, got ${invalidItem.weight}`);
  }

  const itemCosts = cart.items.map((item) => computeItemShippingCost(item.weight));
  const baseCost = itemCosts.reduce((sum, cost) => sum + cost, 0);
  const withCountry = applyCountryMultiplier(baseCost, cart.country);
  const totalShipping = cart.couponCode === FREE_SHIPPING_COUPON ? 0 : withCountry;

  return { itemCosts, totalShipping };
}

export {
  calculateShipping,
  computeItemShippingCost,
  applyCountryMultiplier,
  type Cart,
  type CartItem,
  type ShippingResult,
};
