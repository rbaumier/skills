// --- Types ---

interface CartItem {
  readonly weight: number;
  readonly name?: string;
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

// --- Constants ---

const WEIGHT_TIERS = [
  { minWeight: 50, rate: 0.5, surcharge: 15 },
  { minWeight: 20, rate: 0.3, surcharge: 8 },
] as const;

const DEFAULT_SHIPPING = 5;

const COUNTRY_MULTIPLIERS: Record<string, number> = {
  US: 1.0,
  CA: 1.3,
};
const DEFAULT_COUNTRY_MULTIPLIER = 2.5;

const FREE_SHIPPING_COUPONS = new Set(["FREESHIP"]);

// --- Pure functions ---

function getItemShippingCost(weight: number): number {
  const tier = WEIGHT_TIERS.find((t) => weight > t.minWeight);
  if (tier) {
    return weight * tier.rate + tier.surcharge;
  }
  return DEFAULT_SHIPPING;
}

function getCountryMultiplier(country: string): number {
  return COUNTRY_MULTIPLIERS[country] ?? DEFAULT_COUNTRY_MULTIPLIER;
}

function isFreeShipping(couponCode: string | undefined): boolean {
  return couponCode !== undefined && FREE_SHIPPING_COUPONS.has(couponCode);
}

// --- Main ---

function calculateShipping(cart: Cart): ShippingResult {
  const itemCosts = cart.items.map((item) => getItemShippingCost(item.weight));
  const subtotal = itemCosts.reduce((sum, cost) => sum + cost, 0);

  const multiplier = getCountryMultiplier(cart.country);
  const totalShipping = isFreeShipping(cart.couponCode) ? 0 : subtotal * multiplier;

  return { itemCosts, totalShipping };
}

export { calculateShipping, getItemShippingCost, getCountryMultiplier, isFreeShipping };
export type { Cart, CartItem, ShippingResult };
