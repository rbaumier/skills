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

### RTL Support
- RTL layout support with CSS logical properties: replace directional CSS (margin-left, padding-right, text-align: left, border-left) with logical equivalents (margin-inline-start, padding-inline-end, text-align: start, border-inline-start). These auto-flip in RTL contexts. Set `dir='rtl'` on <html> alongside `lang`. Test with Arabic/Hebrew content.

### Locale Detection
- Locale detection priority chain: (1) User preference (DB/localStorage), (2) URL parameter (?lang=de or /de/path), (3) Subdomain (de.example.com), (4) Accept-Language header, (5) navigator.language, (6) Default fallback (en). Apply sources in order, highest wins.

### Translation File Structure
- Single TypeScript file per locale, exported `as const` — enables type inference, no JSON parsing, bundled statically
- Flat keys with domain prefix: `domain.key` — e.g. `diffs.title`, `auth.login`, `errors.not_found`
- Standard domains: `common.*` (shared UI), `validation.*` (form errors), `errors.*` (API error codes), `seo.*` (page titles/descriptions)
- Each feature owns its domain: `diffs.*`, `auth.*`, `repositories.*`, `settings.*`
- Never nest more than 2 levels: `diffs.files` is fine, `diffs.header.actions.delete.confirm` is not
- Translation key naming: keys describe the element, not the content. CORRECT: 'auth:submit_button' = 'Sign in'. WRONG: 'Sign in' = 'Anmelden' (using English string as key). Keys must survive renaming of the English string. Use snake_case or camelCase consistently. Include context (namespace + location).

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
- Fallback locale chain: configure i18next with a fallback chain, not just a single fallback. Example: pt-BR -> pt -> en. Partially translated locales should gracefully show the closest language match, not jump straight to English.

### Pluralization
- i18next suffix convention: base key + `_other` suffix for plural
- French: `files: "{{count}} fichier"`, `files_other: "{{count}} fichiers"`
- Call with: `t("diffs.files", { count: files.length })`
- Test both singular (count=1) and plural (count>1) paths
- ICU MessageFormat for complex pluralization: `{count, plural, one {# item} other {# items}}`. Supports CLDR plural categories beyond one/other: zero, two, few, many. Russian needs one/few/many/other. Arabic needs all six. Never assume two forms (singular/plural) — use the framework's CLDR-aware system, never `if count === 1`.
- ICU select for gender-aware messages: `{gender, select, male {He liked} female {She liked} other {They liked}}`. ICU selectordinal for ordinals: `{rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}`. Essential for languages with grammatical gender (French, German, Spanish).

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
- Intl.ListFormat for locale-aware lists: `new Intl.ListFormat('en', { type: 'conjunction' })` produces 'Alice, Bob, and Charlie'. `{ type: 'disjunction' }` produces 'Alice, Bob, or Charlie'. Never manually join strings with commas — conjunction rules differ by language.

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
- SEO hreflang tags for multi-language pages: add `<link rel='alternate' hreflang='de' href='https://example.com/de/page' />` for each language version. Include `hreflang='x-default'` for the fallback. Place in <head>. Missing hreflang causes search engines to show wrong language version to users.

### Testing
- Pseudo-localization for development: replace characters with accented equivalents (a->a) and add padding to strings to simulate longer translations. Catches: (1) hardcoded strings missed by i18n extraction, (2) layout breaks from string expansion (German/Finnish strings are 30-40% longer than English), (3) truncation issues.
- Hardening for extreme inputs: test with very long text (German compounds), very short text (Chinese single characters), special characters (emoji, RTL text, accents), and empty strings. Test with 1000+ list items. Never assume English string lengths.

### SSR Considerations
- Initialize i18n synchronously (static imports, no async loading) — must be available during SSR
- Set `<html lang={i18n.language}>` in root route
- Use `suppressHydrationWarning` on elements with client-dependent values (dates, relative times)
- ProblemError serialization: TanStack Start only serializes `Error.message` across SSR boundary — encode structured data in message string

## Other Frameworks

> Our main stack uses i18next/react-i18next (see above). This section covers essential patterns
> for other frameworks you may encounter. The i18n *principles* are the same everywhere —
> only the API surface changes.

### Django (Python) — gettext
```python
# Mark strings for translation with gettext_lazy (models, forms) or gettext (views)
from django.utils.translation import gettext_lazy as _

class Product(models.Model):
    name = models.CharField(_("product name"), max_length=100)

# In templates: {% trans "Welcome" %} or {% blocktrans %}Hello {{ name }}{% endblocktrans %}
# Pluralization: {% blocktrans count counter=items|length %}1 item{% plural %}{{ counter }} items{% endblocktrans %}

# Generate/update .po files, then compile:
# python manage.py makemessages -l de
# python manage.py compilemessages
```

### Rails (Ruby) — I18n YAML
```yaml
# config/locales/de.yml — flat YAML, same namespace logic as our TS files
de:
  activerecord:
    models:
      user: Benutzer
  views:
    shared:
      submit: Absenden
  errors:
    not_found: "Nicht gefunden"
```
```ruby
# In views: t('.submit')  (relative to view path) or t('views.shared.submit') (absolute)
# Pluralization uses count key: t('items', count: 3) with one:/other: in YAML
```

### SwiftUI — String Catalogs (.xcstrings)
```swift
// Xcode 15+ auto-extracts LocalizedStringKey from Text(), Label(), etc.
Text("welcome_message")  // Xcode finds this, adds to Localizable.xcstrings catalog

// Pluralization via automatic grammar agreement:
Text("^[\(count) \("item")](inflect: true)")  // "1 item" / "3 items" — handles all CLDR categories

// Manual string tables for programmatic use:
String(localized: "error.not_found", table: "Errors")
```

### Android Kotlin — XML Resources
```xml
<!-- res/values-de/strings.xml -->
<resources>
    <string name="submit_button">Absenden</string>
    <!-- Pluralization: Android uses quantity strings (CLDR categories) -->
    <plurals name="items_selected">
        <item quantity="one">%d Element ausgewählt</item>
        <item quantity="other">%d Elemente ausgewählt</item>
    </plurals>
</resources>
```
```kotlin
// Usage in Kotlin:
getString(R.string.submit_button)
resources.getQuantityString(R.plurals.items_selected, count, count)

// Jetpack Compose:
Text(stringResource(R.string.submit_button))
Text(pluralStringResource(R.plurals.items_selected, count, count))
```

### Library Selection
- Paraglide JS as alternative to i18next: compile-time, tree-shakable functions with full type safety. Only ships used messages. Consider for new projects prioritizing bundle size and type safety. i18next remains better for existing projects needing broad ecosystem support.

### Cross-Framework Principles
- **Key naming**: same `domain.element` convention works everywhere — Django uses dots in gettext IDs, Rails uses nested YAML, Android uses flat `snake_case` resource names
- **Pluralization**: always use the framework's CLDR-aware system, never `if count == 1`
- **Formatting**: every framework has locale-aware date/number formatters — use them, never roll your own
- **Extraction**: prefer auto-extraction tools (`makemessages`, Xcode catalogs, `i18next-parser`) over manual key tracking

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
