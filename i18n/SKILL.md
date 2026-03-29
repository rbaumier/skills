---
name: i18n
description: Internationalization patterns — i18next, react-i18next, Zod error translation, API error mapping, route metadata, SSR.
---

## When to use
- Adding any user-visible text in the frontend
- Creating forms with validation messages
- Handling API errors displayed to the user
- Adding route metadata (page titles, breadcrumbs)
- Formatting dates, numbers, relative time
- Adding pluralization

## When not to use
- Server-side logs (use English, structured logging)
- Developer-facing error messages (console, stack traces)
- Code comments

## Golden Rule
**ZERO hardcoded user-visible text.** Every string the user sees goes through `t()`. No exceptions.

## Critical Rules

### Translation File Structure
- Single TypeScript file per locale, exported `as const` — enables type inference, no JSON parsing, bundled statically
- Flat keys with domain prefix: `domain.key` — e.g. `diffs.title`, `auth.login`, `errors.not_found`
- Standard domains: `common.*` (shared UI), `validation.*` (form errors), `errors.*` (API error codes), `seo.*` (page titles/descriptions)
- Each feature owns its domain: `diffs.*`, `auth.*`, `repositories.*`, `settings.*`
- Never nest more than 2 levels: `diffs.files` is fine, `diffs.header.actions.delete.confirm` is not

### Using Translations

**In React components — `useTranslation()` hook:**
```tsx
const { t } = useTranslation();
return <h1>{t("diffs.title")}</h1>;
```

**Outside React render — `i18n.t()` singleton:**
```ts
import { i18n } from "~/app/i18n/config";
i18n.t("seo.appTitle");
```
Use the singleton for: route `head()` functions (SEO), Zod error maps, error translation utilities, QueryClient error handlers, `Intl` formatters needing `i18n.language`.

**Never use `<Trans>` component** unless interpolation requires JSX elements. `t()` is simpler and sufficient for 99% of cases.

### Pluralization
- i18next suffix convention: base key + `_other` suffix for plural
- French: `files: "{{count}} fichier"`, `files_other: "{{count}} fichiers"`
- Call with: `t("diffs.files", { count: files.length })`
- Test both singular (count=1) and plural (count>1) paths

### Interpolation
- Standard `{{variable}}` syntax: `t("validation.tooShort", { min: 3 })`
- Supported variables: `{{count}}` (pluralization), `{{min}}`, `{{max}}` (validation), `{{name}}` (entities)
- Never concatenate strings — use interpolation: `t("repo.deleteConfirm", { name })` not `t("repo.delete") + name`

### Date & Number Formatting
- Use native `Intl` APIs with `i18n.language` as locale — not i18next formatters
- `Intl.RelativeTimeFormat`: wrap in a utility with cached formatters per language
- `Intl.DateTimeFormat`: `toLocaleDateString(i18n.language, options)` for dates
- `Intl.NumberFormat`: for numbers, currencies, percentages
- Never `new Date().toLocaleDateString()` without explicit locale

### Zod Form Validation Translation
- Custom `formErrorMap: z.ZodErrorMap` maps Zod issue codes to i18n keys
- Map each code specifically: `too_small` (min=1, string) → `validation.required`, `too_small` (other) → `validation.tooShort`, `too_big` → `validation.tooLong`, `invalid_format` (email) → `validation.invalidEmail`
- Pass to resolver: `zodResolver(Schema, { errorMap: formErrorMap })`
- For `.refine()` messages: use bare key fragments (`message: "passwordsMismatch"`) and a `translateAuthError()` utility that prepends the domain and looks up via `i18n.t()`
- Return `null` from the error map to fall through to Zod's default — don't try to translate everything

### API Error Translation
- Problem codes (`ProblemDetail.code`) map 1:1 to `errors.*` keys: `errors.repo_not_found`, `errors.unauthorized`
- `getErrorMessage(error)` resolves any error: check `isProblemDetail(error)` → `i18n.t("errors.${error.code}")` → fallback to `error.detail` → fallback to `i18n.t("common.error")`
- Global toast handler in `QueryCache.onError` / `MutationCache.onError`: auto-translate and toast every error. Opt-out via `meta: { skipGlobalToast: true }` on mutations that handle errors locally (e.g. auth forms using `form.setError("root", ...)`)
- Always add a new `errors.*` key when defining a new `ProblemDefinition` — the two must stay in sync

### Route Metadata (Page Titles, Breadcrumbs)
- Static titles: use `staticData: { titleKey: "diffs.title" }` on route definitions
- Augment TanStack Router types: `interface StaticDataRouteOption { titleKey?: string }`
- Read in layout: `useRouterState()` to find the deepest matching route's `staticData.titleKey`, then `t(titleKey)`
- SEO titles: in route `head()` function, use `i18n.t("seo.pageName")` (singleton, not hook — `head()` runs outside React)

### SSR Considerations
- Initialize i18n synchronously (static imports, no async loading) — must be available during SSR
- Set `<html lang={i18n.language}>` in root route
- Use `suppressHydrationWarning` on elements with client-dependent values (dates, relative times)
- ProblemError serialization: TanStack Start only serializes `Error.message` across SSR boundary — encode structured data in message string

### Build Optimization
- Split i18n library into dedicated vendor chunk: `vendor-i18n` for `i18next` + `react-i18next`
- Translation files are statically imported and tree-shaken — no runtime loading overhead
- For multi-language support: use `i18next-resources-to-backend` for lazy loading per locale

### Adding a New Translatable String — Checklist
1. Add key to locale file(s) with domain prefix
2. Use `t("domain.key")` in component or `i18n.t("domain.key")` outside React
3. If form validation: add to `formErrorMap` or use `.refine({ message: "keyFragment" })`
4. If API error: add `errors.*` key matching `ProblemDefinition.code`
5. If page title: add `seo.*` key for `head()` and/or `staticData.titleKey`
6. Never skip — "it's just one string" is how hardcoded text accumulates
