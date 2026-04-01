---
name: language-typescript
description: "Use when writing, reviewing, or refactoring TypeScript/JavaScript. Use when hitting type errors, configuring tsconfig, designing generics, choosing type vs interface, or structuring async flows. Node.js, Bun, Deno."
---

## When to use
- Any TypeScript/JavaScript work
- Not needed for shell scripts, Python, or non-TS languages

## Opinionated Choices

These override Claude's defaults — the reason this skill exists.

| Rule | Use instead | Why |
|------|-------------|-----|
| No `enum` | `as const` + `typeof` | Emits runtime code, numeric reverse-mapping surprises |
| No `default export` | Named exports only | Refactoring, tree-shaking, naming consistency |
| No `any`/`as` | `unknown`, type guards, `satisfies` | Exceptions: utility type constraints, branded factories, `as const` |
| Errors are values | `better-result` Result type | **Never `throw` for expected failures.** `throw` is NOT a fix — return `{ ok, error }`. Null = normal absence; typed error = problem |
| Types by default | `interface` only for extension/perf | See compiler-performance.md |
| `using`/`await using` | Over try/finally (TS 5.2+) | Deterministic resource cleanup |

### Errors as values — before/after

```typescript
// WRONG — throw for expected failure
async function getUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error('User not found'); // ← NO
  return res.json() as Promise<User>;
}

// RIGHT — return Result
async function getUser(id: string): Promise<Result<User, 'not-found' | 'parse-error'>> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) return err('not-found');
  const data: unknown = await res.json();
  const parsed = UserSchema.safeParse(data);
  if (!parsed.success) return err('parse-error');
  return ok(parsed.data);
}
```

## Tool Choices

| Tool | Purpose |
|------|---------|
| `@t3-oss/env-core` + Zod | Env validation at startup. Fail loud, not on first access |
| `tsgo --noEmit` | Fast typechecking (Go-based TS compiler) |
| `openapi-fetch` | Type-safe API clients from OpenAPI specs |
| Zod `.brand()` | Branded types — brand lost on serialization, `.parse()` restores it |

## Style

- Files: kebab-case.ts
- JSDoc: plain block description + `@example` (with function call AND expected return `// => value`) — no `@description` tag, no `@param`/`@returns` (types are the docs)
- File order: imports → types/interfaces → constants → functions. Exports at top, private helpers at bottom
- Parse at boundaries (`unknown` in, typed out), trust inside
- ESM only: `"type": "module"` in package.json. Never mix CJS imports (`require`) with ESM modules
- Declare param/prop types as named types above the function, not inline objects
- `Set.has()` over `Array.includes()` for repeated lookups in loops/hot paths
- Validate `JSON.parse` output with type guards — never cast with `as` (`JSON.parse` returns `unknown` in spirit)

## Post-Modification Audit

<EXTREMELY-IMPORTANT>
MANDATORY: After ANY modification to TypeScript/JavaScript files, you MUST run the audit before considering your work done. This is not optional. Do not skip this step. Do not rationalize why "this change is too small" or "I'll run it later."
</EXTREMELY-IMPORTANT>

```bash
~/.claude/skills/language-typescript/scripts/ts-audit/ts-audit --working-tree
```

Fix all errors before committing. Modes: `--working-tree`, `--last-commit`, `--commit <sha>`, `--staged`, or no flag for full scan.

## References

| Need | File |
|------|------|
| tsconfig strict/perf/modern flags | `references/tsconfig.md` |
| `using`, `const` type params, `NoInfer`, `satisfies`, template literals | `references/modern-features.md` |
| Generics, `infer`, mapped types, builder, narrowing, `declare module`, type testing, decorators | `references/generics.md` |
| Parallel promises, deferred await, AbortController, `Promise.withResolvers` | `references/async-patterns.md` |
| Barrel files, `import type`, circular deps | `references/module-organization.md` |
| Return types, interfaces vs intersections, variance annotations | `references/compiler-performance.md` |
