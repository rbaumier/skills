# Module Organization

## Avoid Barrel Files

Barrel files (`index.ts` re-exports) defeat tree-shaking. Cost: **200-800ms dev server startup, 30-50% larger bundles**.

```typescript
// BAD: loads ALL utils including heavy crypto module
import { formatDate } from '@/utils'

// GOOD: direct import, loads only date module
import { formatDate } from '@/utils/date'
```

For icon libraries (common offender):

```typescript
// BAD: loads all 1500+ icons
import { Check, X } from 'lucide-react'

// GOOD: loads only 2 icons
import { Check } from 'lucide-react'
import { X } from 'lucide-react'  // With bundler optimizePackageImports, tree-shakes correctly
```

When barrels are acceptable: internal modules with <10 exports, or when bundler is configured with `optimizePackageImports`.

## Use `import type` for Type-Only Imports

Type-only imports are erased at compile time -- no runtime module loading.

```typescript
// BAD: loads database module at runtime just for a type
import { DatabaseConfig } from './database'

interface AppConfig {
  db: DatabaseConfig
}

// GOOD: erased at compile time
import type { DatabaseConfig } from './database'

// Mixed imports (TS 4.5+)
import { createUser, type User, type UserRole } from './user'
```

Enforce with `verbatimModuleSyntax` in tsconfig (see tsconfig.md for flag details).

## Detect and Break Circular Dependencies

Circular imports cause `undefined` at runtime and slow compilation.

```typescript
// BAD: user.ts imports from order.ts, order.ts imports from user.ts
// user.ts
import { Order } from './order'
export interface User { orders: Order[] }

// order.ts
import { User } from './user'  // Circular!
export interface Order { user: User }

// GOOD: extract shared types into a dependency-free file
// types.ts
export interface User { orders: Order[] }
export interface Order { user: User }
```

Detect with: `npx madge --circular --extensions ts ./src` or ESLint `import/no-cycle`.

## Dynamic Imports for Code Splitting

Load heavy dependencies on demand. Reduces initial bundle **30-70%**.

```typescript
// BAD: 1.6MB loaded upfront
import { PDFGenerator } from 'pdfkit'
import { ExcelExporter } from 'exceljs'

// GOOD: loaded only when needed
export async function exportReport(format: 'pdf' | 'excel') {
  if (format === 'pdf') {
    const { PDFGenerator } = await import('pdfkit')
    return new PDFGenerator().generate()
  }
  const { ExcelExporter } = await import('exceljs')
  return new ExcelExporter().export()
}
```

Framework helpers: `React.lazy()`, Next.js `dynamic()` with `ssr: false`.

## Control `@types` Inclusion

By default TypeScript loads ALL `@types/*` packages -- causes conflicts and wastes memory.

```json
// BAD: loads everything, @types/jest and @types/mocha conflict
{
  "compilerOptions": { "target": "ES2022" }
}

// GOOD: explicit inclusion
{
  "compilerOptions": {
    "types": ["node", "react", "jest"]
  }
}
```

Use separate tsconfig files per environment (`tsconfig.test.json` extends base with `"types": ["node", "jest"]`).
