/**
 * Calculates shipping cost for a cart based on item weights,
 * destination country, and optional coupon codes.
 *
 * Pure function — does not mutate the input cart.
 * Returns a ShippingResult with per-item costs and total.
 */

// --- Constants: every magic number is a named decision ---

const MAX_ITEM_WEIGHT_KG = 200;
const MAX_ITEMS_PER_CART = 500;

const WEIGHT_TIER_HEAVY_KG = 50;
const WEIGHT_TIER_MEDIUM_KG = 20;

const HEAVY_RATE_PER_KG = 0.5;
const HEAVY_BASE_FEE = 15;

const MEDIUM_RATE_PER_KG = 0.3;
const MEDIUM_BASE_FEE = 8;

const LIGHT_FLAT_FEE = 5;

/** Country multipliers — add new countries here */
const COUNTRY_MULTIPLIER: Record<SupportedCountry, number> = {
  US: 1.0,
  CA: 1.3,
} as const;

const DEFAULT_COUNTRY_MULTIPLIER = 2.5;

const FREE_SHIPPING_COUPON = "FREESHIP" as const;

// --- Types ---

type SupportedCountry = "US" | "CA";

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
  readonly itemIndex: number;
  readonly cost: number;
}

interface ShippingResult {
  readonly itemCosts: readonly ItemShippingCost[];
  readonly subtotal: number;
  readonly countryMultiplier: number;
  readonly totalShipping: number;
}

// --- Logic ---

/** Compute shipping cost for a single item based on weight tier */
function calculateItemShippingCost(weight: number): number {
  if (weight > WEIGHT_TIER_HEAVY_KG) {
    return weight * HEAVY_RATE_PER_KG + HEAVY_BASE_FEE;
  }
  if (weight > WEIGHT_TIER_MEDIUM_KG) {
    return weight * MEDIUM_RATE_PER_KG + MEDIUM_BASE_FEE;
  }
  return LIGHT_FLAT_FEE;
}

/** Resolve country code to its shipping multiplier */
function getCountryMultiplier(country: string): number {
  return COUNTRY_MULTIPLIER[country as SupportedCountry] ?? DEFAULT_COUNTRY_MULTIPLIER;
}

/** Whether the coupon grants free shipping */
function isFreeShippingCoupon(couponCode: string | undefined): boolean {
  return couponCode === FREE_SHIPPING_COUPON;
}

/**
 * Calculate shipping for an entire cart.
 *
 * @param cart - Cart with items (each having a weight), country, and optional coupon
 * @returns ShippingResult with per-item costs and final total
 * @throws {Error} If cart data is invalid (missing items, invalid weights)
 */
function calculateShipping(cart: Cart): ShippingResult {
  // --- Input validation: bound every input ---
  if (!cart.items || cart.items.length === 0) {
    throw new Error("Cart must contain at least one item");
  }
  if (cart.items.length > MAX_ITEMS_PER_CART) {
    throw new Error(`Cart exceeds maximum of ${MAX_ITEMS_PER_CART} items`);
  }

  const itemCosts: ItemShippingCost[] = cart.items.map((item, index) => {
    if (typeof item.weight !== "number" || item.weight <= 0) {
      throw new Error(`Item at index ${index} has invalid weight: ${item.weight}`);
    }
    if (item.weight > MAX_ITEM_WEIGHT_KG) {
      throw new Error(
        `Item at index ${index} exceeds max weight of ${MAX_ITEM_WEIGHT_KG}kg: ${item.weight}`,
      );
    }
    return { itemIndex: index, cost: calculateItemShippingCost(item.weight) };
  });

  const subtotal = itemCosts.reduce((sum, ic) => sum + ic.cost, 0);
  const countryMultiplier = getCountryMultiplier(cart.country);
  const adjustedTotal = subtotal * countryMultiplier;
  const totalShipping = isFreeShippingCoupon(cart.couponCode) ? 0 : adjustedTotal;

  return { itemCosts, subtotal, countryMultiplier, totalShipping };
}

export { calculateShipping, calculateItemShippingCost, getCountryMultiplier, isFreeShippingCoupon };
export type { Cart, CartItem, ShippingResult, ItemShippingCost, SupportedCountry };
