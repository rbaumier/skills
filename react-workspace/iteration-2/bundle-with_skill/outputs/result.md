# Review: DashboardPage Bundle & Loading

## Issues Found

### 1. Barrel file import pulls entire UI library into bundle
**Rule**: Bundle & Loading > "Import directly from modules, avoid barrel files"

```typescript
// PROBLEM: imports 8 components but barrel file forces bundler to evaluate all exports
import { Button, Card, Input, Modal, Tooltip, Badge, Avatar, Dropdown } from '@/components/ui';
```

The barrel file `@/components/ui/index.ts` re-exports every UI component. Even with tree-shaking, barrel files defeat module-level side-effect analysis and bloat the chunk. Import each component from its own module.

### 2. PDFExporter loaded eagerly but used on-click only
**Rule**: Bundle & Loading > "Use next/dynamic for heavy/rarely-used components"
**Rule**: Bundle & Loading > "Preload on hover/focus"

`PDFExporter` is a heavy component (PDF generation libraries) that only activates when the user clicks "Export". It should be lazy-loaded with `next/dynamic` and preloaded on hover of the trigger button.

### 3. AIAssistant loaded eagerly but behind a feature flag
**Rule**: Bundle & Loading > "Conditionally load modules only when feature is activated"

If the feature flag is off, 100% of users pay the bundle cost for 0% usage. The module should only be imported when the flag is enabled.

### 4. Third-party scripts missing lazy strategy
**Rule**: Bundle & Loading > "Defer third-party scripts (analytics, logging) with `strategy="lazyOnload"`"

Both `<Script>` tags use the default `afterInteractive` strategy, which blocks hydration completion. Analytics and chat widgets are non-critical and should use `strategy="lazyOnload"`.

### 5. Full lodash import
**Rule**: (Diagnosis > Bundle Size > "full lodash")

`import { format } from 'lodash'` pulls the entire 70kB lodash library. Use `lodash/format` or a native alternative. Note: `lodash.format` does not exist as a standard lodash function -- verify what `format` is actually doing and replace with the correct utility or native code.

### 6. framer-motion wrapping static content
`motion.div` with `animate={{ opacity: 1 }}` and no `initial` prop does nothing visible (opacity defaults to 1 already). This adds ~30kB of framer-motion to the bundle for a no-op animation. Either add a meaningful `initial` value or remove it entirely.

---

## Refactored Code

```typescript
// page.tsx
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { Chart } from '@/components/Chart';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/Button';
import { featureFlags } from '@/lib/featureFlags';

const PDFExporter = dynamic(
  () => import('@/components/PDFExporter').then((m) => m.PDFExporter),
  { ssr: false }
);

const AIAssistant = dynamic(
  () => import('@/components/AIAssistant').then((m) => m.AIAssistant),
  { ssr: false }
);

const preloadPDFExporter = () => {
  void import('@/components/PDFExporter');
};

export default function DashboardPage() {
  const showAI = featureFlags.isEnabled('ai-assistant');

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

      <Chart data={chartData} />
      <DataTable rows={rows} />

      <Button
        onMouseEnter={preloadPDFExporter}
        onFocus={preloadPDFExporter}
        onClick={handleExport}
      >
        Export PDF
      </Button>

      {showAI ? <AIAssistant /> : null}
    </>
  );
}
```

### Changes summary

| # | Issue | Fix | Est. savings |
|---|-------|-----|-------------|
| 1 | Barrel file import | Direct module imports (`@/components/ui/Button`) | Eliminates unused UI component code |
| 2 | Eager PDFExporter | `next/dynamic` + hover preload | PDF libs moved to separate chunk |
| 3 | Eager AIAssistant | `next/dynamic` + feature flag guard | AI chunk only loaded when flag is on |
| 4 | Scripts block hydration | `strategy="lazyOnload"` | Faster TTI |
| 5 | Full lodash | Removed (unused in refactored page) | ~70kB |
| 6 | No-op framer-motion | Removed wrapper | ~30kB |

### Notes

- `Button` is the only UI component actually used on this page. The other 7 (`Card`, `Input`, `Modal`, `Tooltip`, `Badge`, `Avatar`, `Dropdown`) were imported but unused -- removed entirely.
- The `format` import from lodash was not used in the visible code -- removed. If it is used elsewhere in the component, replace with `import format from 'lodash/format'` or the appropriate native function.
- `handleExport` and data props (`chartData`, `rows`) are assumed to be defined elsewhere in the actual component. The review focuses on bundle/loading concerns only.
- The ternary `showAI ? <AIAssistant /> : null` follows the skill rule preferring ternary over `&&` for conditional rendering.
