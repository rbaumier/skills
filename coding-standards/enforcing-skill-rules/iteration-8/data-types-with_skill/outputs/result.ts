/** Shipping rate tiers keyed by weight threshold (checked high-to-low). */
const SHIPPING_TIERS = [
  { minWeight: 50, ratePerUnit: 0.5, baseFee: 15 },
  { minWeight: 20, ratePerUnit: 0.3, baseFee: 8 },
] as const;

const DEFAULT_SHIPPING_FEE = 5;

/** Country multipliers for international shipping adjustment. */
const COUNTRY_MULTIPLIERS: Record<string, number> = {
  US: 1.0,
  CA: 1.3,
};

const DEFAULT_COUNTRY_MULTIPLIER = 2.5;

const FREE_SHIPPING_COUPON = "FREESHIP";

interface CartItem {
  readonly weight: number;
}

interface Cart {
  readonly items: readonly CartItem[];
  readonly country: string;
  readonly couponCode?: string;
}

interface ShippingResult {
  readonly perItem: readonly number[];
  readonly total: number;
}

function computeItemShippingCost(weight: number): number {
  if (weight <= 0) {
    throw new Error(`Invalid item weight: ${weight}. Must be positive.`);
  }

  const tier = SHIPPING_TIERS.find((t) => weight > t.minWeight);
  if (tier) {
    return weight * tier.ratePerUnit + tier.baseFee;
  }

  return DEFAULT_SHIPPING_FEE;
}

function getCountryMultiplier(country: string): number {
  const multiplier = COUNTRY_MULTIPLIERS[country];
  if (multiplier === undefined) {
    return DEFAULT_COUNTRY_MULTIPLIER;
  }
  return multiplier;
}

/** Calculates shipping costs without mutating the input cart. */
function calculateShipping(cart: Cart): ShippingResult {
  if (cart.items.length === 0) {
    return { perItem: [], total: 0 };
  }

  const perItem = cart.items.map((item) => computeItemShippingCost(item.weight));
  const subtotal = perItem.reduce((sum, cost) => sum + cost, 0);

  if (cart.couponCode === FREE_SHIPPING_COUPON) {
    return { perItem, total: 0 };
  }

  const multiplier = getCountryMultiplier(cart.country);
  const total = subtotal * multiplier;

  return { perItem, total };
}

export {
  calculateShipping,
  computeItemShippingCost,
  getCountryMultiplier,
  SHIPPING_TIERS,
  COUNTRY_MULTIPLIERS,
  FREE_SHIPPING_COUPON,
};
export type { Cart, CartItem, ShippingResult };
