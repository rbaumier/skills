# Bundle Size & Loading Performance Review

## Issues Found

### 1. Full lodash import (Critical)
```typescript
import { format } from 'lodash';
```
Imports the entire lodash bundle (~72KB min+gzip) for a single function. Lodash `format` doesn't even exist as a standard export -- likely meant `lodash/format` or a date formatting lib. Either way, tree-shaking does not work on the lodash CommonJS barrel.

**Fix**: Import from `lodash-es/format` or use a dedicated utility. If date formatting, use `date-fns/format` (~3KB).

### 2. framer-motion in a Server Component context (Critical)
```typescript
import { motion } from 'framer-motion';
```
`framer-motion` is ~32KB min+gzip. This page uses it for a single fade-in (`animate={{ opacity: 1 }}`). This is a CSS one-liner. The library also requires `"use client"`, which would force the entire page to be client-rendered, losing SSR/RSC benefits.

**Fix**: Replace with a CSS animation or a tiny `"use client"` wrapper.

### 3. Barrel file UI imports (High)
```typescript
import { Button, Card, Input, Modal, Tooltip, Badge, Avatar, Dropdown } from '@/components/ui';
```
Barrel re-exports (`index.ts`) defeat tree-shaking in many bundler configurations. All 8 components and their transitive dependencies are pulled into the bundle even if some aren't used on this page. `Modal` alone often pulls in portal/focus-trap/animation code.

**Fix**: Use direct path imports (`@/components/ui/Button`).

### 4. PDFExporter loaded eagerly (High)
```typescript
import { PDFExporter } from '@/components/PDFExporter';
```
PDF libraries (pdfmake, jsPDF, react-pdf) are typically 200-500KB. This component is only used on explicit user action ("Export" click), yet it's included in the initial bundle.

**Fix**: `React.lazy()` + `Suspense`, loaded on demand.

### 5. AIAssistant loaded eagerly behind a feature flag (High)
```typescript
import { AIAssistant } from '@/components/AIAssistant';
```
If the feature flag is off, 100% of users download this code for 0% benefit. Even when enabled, an AI assistant is secondary UI that should not block initial paint.

**Fix**: Conditionally `import()` only when the feature flag is active.

### 6. Render-blocking third-party scripts (Medium)
```typescript
<Script src="https://analytics.example.com/tracker.js" />
<Script src="https://chat.example.com/widget.js" />
```
Default `<Script>` strategy is `afterInteractive`, which still loads eagerly. Analytics and chat widgets are not critical for first paint.

**Fix**: Use `strategy="lazyOnload"` for both.

### 7. No loading states (Medium)
Heavy components (`Chart`, `DataTable`) render synchronously with no skeleton/fallback, causing layout shift and a blank page while JS parses.

---

## Impact Summary

| Issue | Est. Savings | Metric Affected |
|---|---|---|
| lodash -> lodash-es or removal | ~70KB | TTI, TBT |
| framer-motion -> CSS | ~32KB | FCP, TTI |
| Barrel -> direct imports | 10-50KB (varies) | Parse time |
| Lazy PDFExporter | 200-500KB | Initial bundle |
| Lazy AIAssistant | 50-200KB (varies) | Initial bundle |
| Script strategy | Network contention | LCP, FCP |

**Estimated total reduction: 360-850KB from initial bundle.**

---

## Refactored Code

```typescript
// app/dashboard/page.tsx
// This is a Server Component -- no "use client" needed for the page itself.

import { Suspense } from 'react';
import Script from 'next/script';

import { Chart } from '@/components/Chart';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';

import { FadeIn } from './FadeIn';
import { LazyPDFExporter } from './LazyPDFExporter';
import { LazyAIAssistant } from './LazyAIAssistant';

// Only import UI components actually used on this page.
// Removed: Input, Modal, Tooltip, Dropdown (not referenced in JSX)

export default function DashboardPage() {
  return (
    <>
      <Script
        src="https://analytics.example.com/tracker.js"
        strategy="lazyOnload"
      />
      <Script
        src="https://chat.example.com/widget.js"
        strategy="lazyOnload"
      />

      <FadeIn>
        <Card>
          <Chart data={chartData} />
        </Card>

        <DataTable rows={rows} />

        <Suspense fallback={null}>
          <LazyPDFExporter data={exportData} />
        </Suspense>

        <Suspense fallback={null}>
          <LazyAIAssistant />
        </Suspense>
      </FadeIn>
    </>
  );
}
```

```typescript
// app/dashboard/FadeIn.tsx
'use client';

import type { ReactNode } from 'react';

export function FadeIn({ children }: { children: ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}

// In your tailwind config or global CSS:
// @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
// .animate-fade-in { animation: fade-in 0.3s ease-in }
```

```typescript
// app/dashboard/LazyPDFExporter.tsx
'use client';

import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/Button';

const PDFExporter = lazy(() =>
  import('@/components/PDFExporter').then((m) => ({ default: m.PDFExporter }))
);

export function LazyPDFExporter({ data }: { data: unknown }) {
  const [showExporter, setShowExporter] = useState(false);

  if (!showExporter) {
    return (
      <Button onClick={() => setShowExporter(true)}>
        Export PDF
      </Button>
    );
  }

  return (
    <Suspense fallback={<span>Loading exporter...</span>}>
      <PDFExporter data={data} />
    </Suspense>
  );
}
```

```typescript
// app/dashboard/LazyAIAssistant.tsx
'use client';

import { lazy, Suspense } from 'react';
import { useFeatureFlag } from '@/lib/features'; // your feature flag hook

const AIAssistant = lazy(() =>
  import('@/components/AIAssistant').then((m) => ({ default: m.AIAssistant }))
);

export function LazyAIAssistant() {
  const isEnabled = useFeatureFlag('ai-assistant');

  if (!isEnabled) return null;

  return (
    <Suspense fallback={null}>
      <AIAssistant />
    </Suspense>
  );
}
```

---

## Key Principles Applied

1. **Code-split on interaction** -- PDFExporter only loads when the user clicks Export.
2. **Code-split on condition** -- AIAssistant only loads when its feature flag is active.
3. **Eliminate heavyweight dependencies** -- framer-motion replaced with a CSS animation; lodash removed entirely.
4. **Direct imports over barrels** -- each UI component imported from its own module path.
5. **Defer non-critical scripts** -- `strategy="lazyOnload"` for analytics and chat widgets.
6. **Maximize Server Components** -- the page itself stays a Server Component; only interactive leaves are `"use client"`.
