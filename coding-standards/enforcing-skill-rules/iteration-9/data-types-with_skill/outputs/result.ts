// --- Shipping Configuration ---

const WEIGHT_TIERS = [
  { maxWeight: 20, rate: 0, base: 5 },
  { maxWeight: 50, rate: 0.3, base: 8 },
  { maxWeight: Infinity, rate: 0.5, base: 15 },
] as const;

const COUNTRY_MULTIPLIERS: Record<string, number> = {
  US: 1.0,
  CA: 1.3,
};

const FREE_SHIPPING_COUPONS = new Set(["FREESHIP"]);

const MAX_ITEM_WEIGHT_KG = 500;

// --- Types ---

interface CartItem {
  readonly weight: number;
  readonly [key: string]: unknown;
}

interface Cart {
  readonly items: readonly CartItem[];
  readonly country: string;
  readonly couponCode?: string;
}

interface ShippedItem {
  readonly item: CartItem;
  readonly shippingCost: number;
}

interface ShippingResult {
  readonly itemCosts: readonly ShippedItem[];
  readonly totalShipping: number;
}

// --- Domain Logic ---

function getItemShippingCost(weightKg: number): number {
  const tier = WEIGHT_TIERS.find((t) => weightKg <= t.maxWeight);
  if (!tier) {
    throw new Error(`No shipping tier found for weight: ${weightKg}`);
  }
  return weightKg * tier.rate + tier.base;
}

function getCountryMultiplier(country: string): number {
  const multiplier = COUNTRY_MULTIPLIERS[country];
  if (multiplier === undefined) {
    throw new Error(`Unsupported shipping country: ${country}`);
  }
  return multiplier;
}

function isFreeShippingCoupon(couponCode: string | undefined): boolean {
  return couponCode !== undefined && FREE_SHIPPING_COUPONS.has(couponCode);
}

/** Calculates shipping for a cart. Returns a new result — never mutates the input. */
function calculateShipping(cart: Cart): ShippingResult {
  if (cart.items.length === 0) {
    throw new Error("Cart must contain at least one item");
  }

  for (const item of cart.items) {
    if (item.weight <= 0 || item.weight > MAX_ITEM_WEIGHT_KG) {
      throw new Error(
        `Item weight must be between 0 and ${MAX_ITEM_WEIGHT_KG}, got: ${item.weight}`,
      );
    }
  }

  const countryMultiplier = getCountryMultiplier(cart.country);

  const itemCosts: ShippedItem[] = cart.items.map((item) => ({
    item,
    shippingCost: getItemShippingCost(item.weight),
  }));

  const subtotal = itemCosts.reduce((sum, entry) => sum + entry.shippingCost, 0);

  const totalShipping = isFreeShippingCoupon(cart.couponCode) ? 0 : subtotal * countryMultiplier;

  return { itemCosts, totalShipping };
}

export {
  calculateShipping,
  getItemShippingCost,
  getCountryMultiplier,
  isFreeShippingCoupon,
  WEIGHT_TIERS,
  COUNTRY_MULTIPLIERS,
  FREE_SHIPPING_COUPONS,
  MAX_ITEM_WEIGHT_KG,
};
export type { Cart, CartItem, ShippedItem, ShippingResult };
