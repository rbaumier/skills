# Bundle Size & Loading Performance Review

## Issues Found

### 1. Full lodash import (Critical - Bundle Size)
**Rule violated**: *Bundle Size: full lodash*

`import { format } from 'lodash'` pulls the entire lodash library (~70kB minified) into the client bundle. Use the modular import `lodash/format` or switch to a native alternative.

Additionally, `lodash` has no named export called `format` -- this is likely `date-fns/format` or a custom util. Clarify intent.

### 2. Barrel file import for UI components (Critical - Bundle Size)
**Rule violated**: *Import directly from modules, avoid barrel files*

```typescript
import { Button, Card, Input, Modal, Tooltip, Badge, Avatar, Dropdown } from '@/components/ui';
```

Barrel files (`index.ts`) defeat tree-shaking. Every export in `@/components/ui/index.ts` gets bundled even if only 8 components are used. Import each component from its own module.

### 3. PDFExporter loaded eagerly (Critical - Bundle Size)
**Rule violated**: *Use next/dynamic for heavy/rarely-used components*

PDFExporter is only used on explicit user action ("Export" click). PDF libraries (pdfmake, jspdf, react-pdf) are 200-500kB+. This should be dynamically imported and rendered only when the user requests it.

### 4. AIAssistant loaded eagerly behind feature flag (Critical - Bundle Size)
**Rule violated**: *Conditionally load modules only when feature is activated*

AIAssistant is behind a feature flag but is statically imported -- the entire module (and its AI/LLM dependencies) ships to every user regardless of the flag. Dynamically import it and gate rendering on the flag.

### 5. framer-motion for a trivial animation (High - Bundle Size)
**Rule violated**: *Use next/dynamic for heavy/rarely-used components*

`framer-motion` adds ~30-50kB to the client bundle. Using it solely for `animate={{ opacity: 1 }}` is extreme overkill. A CSS animation or `@starting-style` rule achieves the same fade-in at zero bundle cost.

### 6. Third-party scripts not deferred (Medium - Loading Performance)
**Rule violated**: *Defer third-party scripts (analytics, logging) until after hydration*

Both `<Script>` tags use the default `strategy` which is `"afterInteractive"`. Analytics and chat widgets are non-essential -- they should use `strategy="lazyOnload"` to avoid competing with hydration for main-thread time.

### 7. No Suspense boundaries (Medium - Loading Performance)
**Rule violated**: *Use Suspense boundaries to stream content progressively*

Chart, DataTable, and other data-heavy components render in a single paint. Wrapping them in `<Suspense>` boundaries with fallbacks enables progressive streaming and faster perceived load.

---

## Refactored Code

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';

// Direct module imports -- no barrel file
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';

// Heavy components: lazy-loaded with code splitting
const Chart = dynamic(() =>
  import('@/components/Chart').then((m) => ({ default: m.Chart }))
);
const DataTable = dynamic(() =>
  import('@/components/DataTable').then((m) => ({ default: m.DataTable }))
);

// Only loaded on user action -- never in initial bundle
const PDFExporter = dynamic(
  () => import('@/components/PDFExporter').then((m) => ({ default: m.PDFExporter })),
  { ssr: false }
);

// Only loaded when feature flag is active
const AIAssistant = dynamic(
  () => import('@/components/AIAssistant').then((m) => ({ default: m.AIAssistant })),
  { ssr: false }
);

// Lazy-load Modal/Tooltip only when needed (interactive, not initial render)
const Modal = dynamic(() =>
  import('@/components/ui/Modal').then((m) => ({ default: m.Modal }))
);
const Tooltip = dynamic(() =>
  import('@/components/ui/Tooltip').then((m) => ({ default: m.Tooltip }))
);

export default function DashboardPage() {
  const [showExporter, setShowExporter] = useState(false);
  const aiEnabled = useFeatureFlag('ai-assistant'); // your feature flag hook

  return (
    <>
      {/* Defer non-essential third-party scripts */}
      <Script src="https://analytics.example.com/tracker.js" strategy="lazyOnload" />
      <Script src="https://chat.example.com/widget.js" strategy="lazyOnload" />

      {/* CSS fade-in instead of framer-motion (0kB vs ~40kB) */}
      <div className="animate-fade-in">
        <Suspense fallback={<ChartSkeleton />}>
          <Chart data={chartData} />
        </Suspense>

        <Suspense fallback={<TableSkeleton />}>
          <DataTable rows={rows} />
        </Suspense>

        {/* Loaded only on user action */}
        <Button onClick={() => setShowExporter(true)}>Export PDF</Button>
        {showExporter ? <PDFExporter data={exportData} /> : null}

        {/* Loaded only when feature flag is active */}
        {aiEnabled ? <AIAssistant /> : null}
      </div>
    </>
  );
}
```

```css
/* app/globals.css or equivalent */
.animate-fade-in {
  animation: fade-in 0.3s ease-in;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Summary of Changes

| Change | Bundle Impact |
|---|---|
| Remove `lodash` import | -70kB |
| Remove `framer-motion` | -40kB |
| Split barrel `@/components/ui` into direct imports | Tree-shaking enabled, removes dead components |
| `next/dynamic` for PDFExporter | -200-500kB from initial bundle |
| `next/dynamic` for AIAssistant | Feature-flag gated, 0kB when disabled |
| `next/dynamic` for Chart & DataTable | Chunked, loaded in parallel after initial paint |
| Script `strategy="lazyOnload"` | Faster TTI, scripts load after hydration |
| Suspense boundaries | Progressive streaming, faster FCP |

**Estimated initial bundle reduction**: 300-600kB+ depending on PDF/AI library sizes.
