# tsconfig Best Practices

Baseline: `"strict": true` is non-negotiable. Everything below is **on top of** strict.

---

## Strict Flags Beyond `strict: true`

### `noUncheckedIndexedAccess`

Forces `T | undefined` on index signatures and arrays. Catches real bugs at bracket access.

```typescript
// BAD: assumes key exists
const env: Record<string, string> = process.env
const port = env["PORT"].trim() // runtime crash if PORT missing

// GOOD: forces undefined check
const port = env["PORT"]?.trim() ?? "3000"
```

Enable: always. No reason to skip.

### `exactOptionalPropertyTypes`

Distinguishes `{ x?: string }` (missing) from `{ x: string | undefined }` (present but undefined).

```typescript
interface Config {
  theme?: "light" | "dark"
}

// BAD: sets key to undefined instead of omitting
const cfg: Config = { theme: undefined } // Error with this flag

// GOOD: omit the key or use delete
const cfg: Config = {}
```

Enable: new projects. Migration cost on existing codebases can be high.

### `noImplicitOverride`

Requires `override` keyword when overriding base class methods. Prevents silent breakage when base class renames a method.

```typescript
class Base {
  greet() { return "hi" }
}

// BAD: silently overrides without annotation
class Sub extends Base {
  greet() { return "hello" } // Error: must use 'override'
}

// GOOD
class Sub extends Base {
  override greet() { return "hello" }
}
```

Enable: always. Zero cost, catches real refactoring bugs.

### `noPropertyAccessFromIndexSignature`

Forces bracket notation for index-signature access. Makes it obvious when you're accessing a known vs unknown key.

```typescript
interface Env {
  NODE_ENV: string
  [key: string]: string
}

// BAD: looks like a known property
const x = env.SOME_RANDOM_KEY // Error with this flag

// GOOD: bracket notation signals dynamic access
const x = env["SOME_RANDOM_KEY"]
```

Enable: always. Improves readability at call sites.

---

## Performance Flags

### `incremental`

Caches project graph in `.tsbuildinfo`. Subsequent builds only recheck changed files. 50-90% faster rebuilds.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  }
}
```

Enable: always for local dev. Disable in CI if cache is not preserved between runs.

### `skipLibCheck`

Skips type-checking `.d.ts` files. They are pre-verified by library authors. 20-40% faster compilation.

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

Enable: always. Disable temporarily when debugging type conflicts between declaration files.

### `isolatedModules`

Ensures each file can be transpiled independently. Required for esbuild/swc/Babel parallel transpilation.

Blocks: `const enum`, `export =` / `import =`, re-exporting types without `type` keyword.

```typescript
// BAD: const enum requires cross-file analysis
export const enum Status { Active = "active" }

// GOOD: union type, single-file transpilable
export type Status = "active" | "inactive"
```

Enable: always when using a bundler for transpilation (Vite, esbuild, swc).

### `isolatedDeclarations`

TS 5.5+. Ensures exported functions have explicit return types so `.d.ts` files can be generated per-file without the type-checker. Enables parallel declaration emit.

```typescript
// BAD: return type inferred, requires full type-check for .d.ts
export function total(items: Item[]) {
  return items.reduce((s, i) => s + i.price, 0)
}

// GOOD: explicit return type, parallel .d.ts emit
export function total(items: Item[]): number {
  return items.reduce((s, i) => s + i.price, 0)
}
```

What needs annotation: exported function return types, exported variables without literal initializers, exported class method return types. Internal/private code does not.

Enable: libraries, monorepos with `composite`, large codebases where build speed matters.

---

## Modern Flags

### `verbatimModuleSyntax`

TS 5.0+. Requires `import type` for type-only imports. Emits imports exactly as written. Prevents accidental runtime imports of type-only modules and improves tree-shaking.

```typescript
// BAD: type import looks like value import, may survive in bundle
import { User, createUser } from "./user"
function greet(user: User) { return `Hello, ${user.name}` }

// GOOD: explicit intent
import type { User } from "./user"
import { createUser } from "./user"
```

Enable: all new projects. Supersedes `importsNotUsedAsValues` and `preserveValueImports`.

### `erasableSyntaxOnly`

TS 5.8+. Ensures code only uses syntax removable by type-stripping (no codegen). **Mandatory** for Node.js `--experimental-strip-types`.

Blocks: `enum`, `namespace`, constructor parameter properties (`private readonly x`).

```typescript
// BAD: enum requires codegen
export enum Status { Pending = "pending", Done = "done" }

// GOOD: erasable alternatives
export type Status = "pending" | "done"
export const Status = { Pending: "pending", Done: "done" } as const satisfies Record<string, Status>

// BAD: parameter property requires codegen
class Svc { constructor(private readonly repo: Repo) {} }

// GOOD: explicit assignment
class Svc {
  readonly repo: Repo
  constructor(repo: Repo) { this.repo = repo }
}
```

Enable: projects running `.ts` directly via Node.js native type-stripping. Skip if using a bundler that handles enum transformation.

Recommended combo for Node.js native TS:

```json
{ "compilerOptions": { "erasableSyntaxOnly": true, "verbatimModuleSyntax": true, "isolatedModules": true } }
```

---

## Project References (Monorepos)

Split a monorepo into independent compilation units. Each project compiles separately with `tsc --build`, enabling parallel builds and caching. Only changed projects recompile.

```
repo/
  tsconfig.json              # root: references only, no source
  packages/
    shared/tsconfig.json     # leaf: composite, no references
    api/tsconfig.json        # references shared
    web/tsconfig.json        # references shared
```

**Leaf project** (`packages/shared/tsconfig.json`):

```json
{
  "compilerOptions": { "composite": true, "declaration": true, "declarationMap": true, "outDir": "dist" },
  "include": ["src/**/*"]
}
```

**Dependent project** (`packages/api/tsconfig.json`):

```json
{
  "compilerOptions": { "composite": true, "declaration": true, "outDir": "dist" },
  "references": [{ "path": "../shared" }],
  "include": ["src/**/*"]
}
```

**Root** (`tsconfig.json`):

```json
{
  "files": [],
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/api" },
    { "path": "packages/web" }
  ]
}
```

Notes:
- `composite` implies `incremental: true` and requires `declaration: true`
- `declarationMap` enables IDE go-to-definition across project boundaries
- Build: `tsc --build` (not `tsc`). Clean: `tsc --build --clean`

---

## Exclusion Patterns

Overly broad `include` forces the compiler to scan irrelevant directories. Be precise.

```json
{
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"]
}
```

Separate test config to avoid polluting production builds:

```json
// tsconfig.test.json
{ "extends": "./tsconfig.json", "include": ["src/**/*", "tests/**/*"] }
```

Diagnostic commands:
- `tsc --listFiles` -- list all files TS will compile
- `tsc --explainFiles` -- explain why each file was included

Always exclude: `node_modules`, build output (`dist`, `build`, `out`), `coverage`, generated files.
