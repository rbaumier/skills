/** Weight threshold above which heavy surcharge applies */
const HEAVY_WEIGHT_KG = 50;
/** Weight threshold above which medium surcharge applies */
const MEDIUM_WEIGHT_KG = 20;

const HEAVY_RATE_PER_KG = 0.5;
const HEAVY_SURCHARGE = 15;
const MEDIUM_RATE_PER_KG = 0.3;
const MEDIUM_SURCHARGE = 8;
const LIGHT_FLAT_COST = 5;

type CountryCode = "US" | "CA";

const COUNTRY_MULTIPLIER: Record<CountryCode, number> = {
  US: 1.0,
  CA: 1.3,
};
const INTERNATIONAL_MULTIPLIER = 2.5;

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
  readonly itemCosts: readonly number[];
  readonly totalShipping: number;
}

function calculateItemShippingCost(weightKg: number): number {
  if (weightKg > HEAVY_WEIGHT_KG) {
    return weightKg * HEAVY_RATE_PER_KG + HEAVY_SURCHARGE;
  }
  if (weightKg > MEDIUM_WEIGHT_KG) {
    return weightKg * MEDIUM_RATE_PER_KG + MEDIUM_SURCHARGE;
  }
  return LIGHT_FLAT_COST;
}

function getCountryMultiplier(country: string): number {
  return COUNTRY_MULTIPLIER[country as CountryCode] ?? INTERNATIONAL_MULTIPLIER;
}

function hasFreeShippingCoupon(couponCode?: string): boolean {
  return couponCode === FREE_SHIPPING_COUPON;
}

/** Calculates shipping for a cart without mutating input */
function calculateShipping(cart: Cart): ShippingResult {
  if (hasFreeShippingCoupon(cart.couponCode)) {
    return {
      itemCosts: cart.items.map(() => 0),
      totalShipping: 0,
    };
  }

  const itemCosts = cart.items.map((item) => calculateItemShippingCost(item.weight));
  const baseCost = itemCosts.reduce((sum, cost) => sum + cost, 0);
  const totalShipping = baseCost * getCountryMultiplier(cart.country);

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
