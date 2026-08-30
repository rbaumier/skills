# Skill catalog — loaded by judgment

Domain skills an agent loads on top of `coding-standards:quality-bar`
(author) or `coding-standards:quality-bar-review` (reviewer). Read the
files or the diff, pick every skill whose line matches, and name each
pick with its trigger (`database — migrations/0042.sql`). A skill
loaded for nothing costs context; a skill skipped costs findings —
the extension decides for a language, the import for a library, the
surface for UI/API, the wording for text a user reads.

| Skill | Load when the change touches… |
|---|---|
| `language-typescript` | any `.ts` / `.tsx` / `.mts` / `.cts`, `tsconfig*` |
| `language-rust` | any `.rs`, `Cargo.toml` |
| `language-swift` | any `.swift`, `Package.swift`, an Xcode project |
| `database` | SQL, migrations, Supabase / `database.types.ts`, `.sqlx/`, `.rpc(`, `sqlx::query*`, `CREATE FUNCTION`, a query whose plan matters |
| `drizzle-orm` | `drizzle/**`, `drizzle.config.*`, `drizzle-orm` imports |
| `zod` | `zod` imports, `z.object(`, `safeParse(` |
| `better-result-adopt` | `better-result` imports, Result types replacing try/catch |
| `better-auth-best-practices` | `better-auth` imports — sessions, OAuth, multi-tenant auth |
| `api-design` | routes / handlers, OpenAPI, `utoipa`, `axum::` routers — an endpoint's contract, pagination, error semantics |
| `security-defensive` | passwords, cookies, `Authorization`, JWT, hashing, RLS (`CREATE POLICY`, `SECURITY DEFINER`, `auth.uid()`), permissions, XSS / CSRF, secrets |
| `testing` | `*.test.*` / `*.spec.*`, `tests/`, `e2e/`, `__tests__/`, Vitest / Playwright config, `describe(`, `#[test]` / `#[tokio::test]` / `#[sqlx::test]` |
| `react` | `.tsx` / `.jsx` with `react` imports — hooks, components, rendering |
| `vue` | `.vue`, `vue` imports |
| `react-native` | `app.json`, `ios/`, `android/`, `*.native.tsx`, `react-native` / `expo` imports |
| `frontend` | `components/`, `pages/`, `.css` — UI components, pages, layouts, forms, dashboards |
| `ui-ux` | `.tsx` / `.jsx` / `.vue` / `.css` / `.scss`, `tokens.*`, `theme.*` — hierarchy, spacing, typography, accessibility |
| `make-interfaces-feel-better` | `components/`, `pages/` — interaction polish, loading / empty / error states, feedback |
| `ui` | exploring UI options, mockups, variants (v0.dev references) |
| `shadcn` | `components/ui/**`, `components.json`, `@/components/ui/` imports |
| `tailwind` | `.css`, `tailwind.config.*`, `@theme`, `@apply` |
| `ui-animations` | `framer-motion` / `motion/react`, `gsap`, `@keyframes`, transitions |
| `tanstack-query` | `@tanstack/react-query` / `react-table`, `useQuery(`, `useMutation(`, `queryOptions(` |
| `tanstack-start-best-practices` | `@tanstack/react-start`, `createServerFn`, `app.config.ts` |
| `i18n` | `locales/`, `i18n/`, `useTranslation(`, `i18next` — any string a user reads |
| `web-performance` | `vite.config.*`, `next.config.*`, `React.lazy(` / dynamic imports, `loading="lazy"`, bundle size, Core Web Vitals |
| `docker` | `Dockerfile*`, `docker-compose*`, `.dockerignore` |
| `kubernetes` | `Chart.yaml`, `values*.yaml`, `k8s/`, `templates/**/*.yaml`, `apiVersion:` manifests, Helm |
| `ci-cd` | `.gitlab-ci.yml`, `.gitlab/`, `.github/workflows/` |
| `documentation` | a README, ADR, changelog or OpenAPI doc the change edits for humans — not every `.md` |
