```typescript
// 1. Discriminated union instead of numeric enum
type Shape =
  | { type: 'circle'; radius: number }
  | { type: 'square'; side: number }
  | { type: 'triangle'; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.type) {
    case 'circle':
      return Math.PI * shape.radius * shape.radius;
    case 'square':
      return shape.side * shape.side;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    default:
      assertNever(shape);
  }
}

function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}

// 2. Strict tsconfig flags for safety
// tsconfig.json: {
//   "strict": true,
//   "noUncheckedIndexedAccess": true,
//   "exactOptionalPropertyTypes": true,
//   "verbatimModuleSyntax": true
// }

// With noUncheckedIndexedAccess, this becomes an error:
const items: string[] = ["a", "b", "c"];
// const char = items[5].toUpperCase(); // ← Error: items[5] is string | undefined
const char = items[5]?.toUpperCase() ?? 'DEFAULT';

// With exactOptionalPropertyTypes, distinguish undefined from missing:
interface Config {
  port?: number;
  host?: string;
}
// This is now an error — port is optional but cannot be explicitly undefined:
// const cfg: Config = { port: undefined, host: "localhost" }; // ← Error
const cfg: Config = { host: "localhost" }; // ✓ Correct: omit the optional field

// 3. Immutable parameters — use readonly
function processIds(ids: readonly number[]): number[] {
  // Cannot mutate directly; create sorted copy instead
  const sorted = [...ids].sort();
  return sorted.map(id => id * 2);
}

// 4. Type guard function instead of type assertion
function getUser(data: unknown): { name: string; age: number } | null {
  // Use custom type guard with type narrowing
  if (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'age' in data &&
    typeof (data as Record<string, unknown>).name === 'string' &&
    typeof (data as Record<string, unknown>).age === 'number'
  ) {
    return data as { name: string; age: number };
  }
  return null;
}

// Alternative: assertion function for internal boundaries
function assertUser(data: unknown): asserts data is { name: string; age: number } {
  if (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'age' in data &&
    typeof (data as Record<string, unknown>).name === 'string' &&
    typeof (data as Record<string, unknown>).age === 'number'
  ) {
    return;
  }
  throw new Error('Invalid user data');
}

// 5. Union params + generics instead of function overloads
function createDate(input: number | { year: number; month: number; day: number }): Date {
  if (typeof input === 'number') {
    return new Date(input);
  }
  return new Date(input.year, input.month, input.day);
}

// 6. Template literal type for compile-time path validation
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ApiPath = `/api/${string}`;

function route(method: HttpMethod, path: ApiPath): void {
  // Type error: "DELTE" is not in HttpMethod union
  // route("DELTE", "/users"); // ← Compile error caught
}

// Correct usage:
route('GET', '/api/users');

// 7. Use oxlint + oxfmt (Rust-based, 100x faster than ESLint+Prettier)
// .oxlintrc.json or oxlint.json for configuration
// Run: oxlint --fix . && oxfmt .

// 8. Exhaustive switch with assertNever
function format(val: string | number | null): string {
  // Null narrowed first, then use typeof for remaining union
  if (val === null) {
    return 'N/A';
  }
  if (typeof val === 'string') {
    return val.trim();
  }
  if (typeof val === 'number') {
    return val.toFixed(2);
  }
  return assertNever(val);
}

// Exhaustive switch requires assertNever
type Status = 'active' | 'inactive' | 'pending';

function label(s: Status): string {
  switch (s) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'pending':
      return 'Pending';
    default:
      assertNever(s); // Compile error if Status variant added but not handled
  }
}

// 9. as const satisfies for immutable objects with type validation
const ROUTES = {
  home: '/',
  about: '/about',
  contact: '/contact',
} as const satisfies Record<string, string>;

// ROUTES is now { home: '/' } (literal type), not { [key: string]: string }
// Type-safe property access: ROUTES.home, ROUTES.about, ROUTES.contact
// Exhaustiveness check available if needed
```
