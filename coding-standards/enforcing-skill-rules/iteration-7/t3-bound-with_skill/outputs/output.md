```typescript
type SupportedCountry = "US" | "CA" | "UK";

const TAX_RATES: Record<SupportedCountry, number> = { US: 0.08, CA: 0.13, UK: 0.20 };

function isSupportedCountry(country: string): country is SupportedCountry {
  return country in TAX_RATES;
}

function calculateTax(amount: number, country: string): number {
  if (amount < 0) {
    throw new Error(`Invalid amount: ${amount}. Must be non-negative.`);
  }
  if (!isSupportedCountry(country)) {
    throw new Error(`Unsupported country: "${country}". Supported: ${Object.keys(TAX_RATES).join(", ")}`);
  }
  return amount * TAX_RATES[country];
}
```
