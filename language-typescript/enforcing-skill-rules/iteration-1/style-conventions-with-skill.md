```typescript
// user-profile-card.ts

// Removed unused import — UserProfile was imported but never used.
// File renamed to kebab-case per convention.

import { readFileSync } from 'node:fs';

// Use `type` instead of `interface` (default choice; interface only for extension/perf).
// Inline object types extracted to a named type for reuse and readability.
type UserProfile = {
  name: string;
  email: string;
  age: number;
  role: 'admin' | 'user';
};

// Removed raw API response type alias — parse at boundaries with `unknown` instead.

/**
 * @description Formats a user profile for display.
 * @example
 * ```ts
 * formatProfile({ name: 'Ada', email: 'ada@ex.com', age: 36, role: 'admin' }, true)
 * // => 'Ada (36) - ada@ex.com'
 * ```
 */
// JSDoc: @description + @example only — no @param/@returns (types are the docs).
export function formatProfile(profile: UserProfile, includeEmail: boolean): string {
  return `${profile.name} (${profile.age})${includeEmail ? ` - ${profile.email}` : ''}`;
}

/**
 * @description Parses raw API data into a user profile subset.
 * @example
 * ```ts
 * parseApiResponse({ name: 'Ada', email: 'ada@ex.com', extra: true })
 * // => { ok: true, value: { name: 'Ada', email: 'ada@ex.com' } }
 * ```
 */
// `any` replaced with `unknown` — parse at boundaries, trust inside.
// Returns a Result instead of throwing on malformed data (errors are values).
export function parseApiResponse(
  data: unknown,
): { ok: true; value: Pick<UserProfile, 'name' | 'email'> } | { ok: false; error: string } {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('name' in data) ||
    !('email' in data) ||
    typeof (data as Record<string, unknown>).name !== 'string' ||
    typeof (data as Record<string, unknown>).email !== 'string'
  ) {
    return { ok: false, error: 'Invalid API response: missing or invalid name/email' };
  }

  const { name, email } = data as Record<string, unknown>;
  return { ok: true, value: { name: name as string, email: email as string } };
}

// Hot-path optimization: Set provides O(1) lookups instead of Array.includes O(n).
// `as const` + `satisfies` validates the literal values without `enum`.
const KNOWN_USER_IDS = new Set(['a1', 'b2', 'c3', 'd4', 'e5'] as const satisfies readonly string[]);

export function isKnownUser(id: string): boolean {
  return KNOWN_USER_IDS.has(id);
}

/**
 * @description Loads and parses the JSON config file.
 * @example
 * ```ts
 * const config = loadConfig('config.json');
 * // config.ok ? config.value : config.error
 * ```
 */
// Result return instead of letting JSON.parse/readFileSync throw (errors are values).
// `using` would apply if we had a disposable resource; here a Result suffices.
export function loadConfig(
  path: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Config must be a JSON object' };
    }

    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error reading config' };
  }
}
```

### Changes summary

| # | Change | Rationale |
|---|--------|-----------|
| 1 | File renamed to `kebab-case.ts` | Style convention: files use kebab-case |
| 2 | Removed unused `UserProfile` import | Dead import — defined the type locally instead |
| 3 | JSDoc stripped of `@param`/`@returns`, kept `@description` + `@example` | Types are the docs; JSDoc only for description and examples |
| 4 | `any` replaced with `unknown` + type guard in `parseApiResponse` | Parse at boundaries with `unknown` in, typed out |
| 5 | `parseApiResponse` and `loadConfig` return Result objects | Errors are values — never throw for expected failures |
| 6 | `userIds` array replaced with `Set` | O(1) `.has()` vs O(n) `.includes()` — critical for hot-path called thousands of times |
| 7 | `as const satisfies` on the Set initializer | Validates literals at compile time without `enum` |
| 8 | `loadConfig` takes `path` parameter | Removed hardcoded file path — configurable, no hidden side effects |
| 9 | Used `type` instead of `interface` | Default choice per convention; `interface` reserved for extension/perf needs |
| 10 | `import { readFileSync } from 'node:fs'` | Explicit import; original used bare `fs` global which would fail at runtime |
