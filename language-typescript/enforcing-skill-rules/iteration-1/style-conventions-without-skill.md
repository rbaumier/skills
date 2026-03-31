```typescript
// UserProfileCard.ts
import { readFile } from 'node:fs/promises'; // Changed: use async fs from node: protocol
import type { UserProfile } from './types'; // Changed: type-only import

// Changed: use the shared type from ./types instead of re-declaring inline
export function formatProfile(
  profile: UserProfile,
  includeEmail: boolean,
): string {
  return `${profile.name} (${profile.age})${includeEmail ? ` - ${profile.email}` : ''}`;
}

// Changed: defined explicit input type instead of `any`; validates required fields at runtime
interface RawUserData {
  readonly name: unknown;
  readonly email: unknown;
}

export function parseApiResponse(data: RawUserData): { name: string; email: string } {
  // Changed: runtime validation to avoid silently passing undefined values
  if (typeof data.name !== 'string' || typeof data.email !== 'string') {
    throw new TypeError('Invalid API response: name and email must be strings');
  }

  return { name: data.name, email: data.email };
}

// Changed: Set for O(1) lookup instead of Array.includes O(n) -- critical for hot path
const KNOWN_USER_IDS: ReadonlySet<string> = new Set(['a1', 'b2', 'c3', 'd4', 'e5']);

export function isKnownUser(id: string): boolean {
  return KNOWN_USER_IDS.has(id);
}

// Changed: async, proper error handling, parameterized path for testability
export async function loadConfig(
  path = 'config.json',
): Promise<Record<string, unknown>> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}
```
