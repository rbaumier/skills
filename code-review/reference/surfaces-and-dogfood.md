# Surface triggers + Dogfood categories

Two related lenses, same unified file-set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked, minus Step 0.5 APPROVED):

- **Spawn by surface touched** — UI/frontend/API skills that apply to *categories* of code without a unique import signal. Triggered by path globs.
- **Dogfood gate** — record `dogfood_required: true` and the matching `dogfood_surfaces[]` in the review object. The runtime 3-persona gate is run by the composing loop, not by `code-review` itself.

Detect broadly, *err toward triggering* — a spurious persona run is cheap (personas dedup), a missed runtime bug is expensive.

## Surface → skill agents

| Trigger (path globs) | Skill agents | What they review |
|---|---|---|
| `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `app/**/page.*`, `pages/**`, `src/routes/**`, server actions | **ui-ux**, **frontend**, **make-interfaces-feel-better**, **web-performance** | design quality, visual hierarchy, polish, perf budgets, layout discipline, component shape |
| `*.css`, `*.scss`, design-token files (`tokens.*`, `theme.*`), tailwind config when it changes design tokens (colors, spacing, typography) | **ui-ux**, **make-interfaces-feel-better** | spacing/color/typography rules, optical alignment, design-system drift |
| `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers (files importing `@trpc/server`), GraphQL resolvers / schema files (`*.graphql`, `*.gql`, files with `buildSchema(` or `createSchema(`), OpenAPI specs (`openapi.*`, `swagger.*`) | **api-design** | contract stability, error semantics, versioning, pagination, Hyrum's Law, response shape consistency |

Surface skills overlap with framework agents (`react`, `vue`) — different lenses (design vs. framework idioms), coexist. One agent per skill per matching row; dedup across rows.

## Dogfood categories

The first surface row maps directly to `web-ui`. Dogfood broadens to additional runtime surfaces:

- **web-ui** — `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.astro`, `*.mdx`, `*.html`, CSS / design-token files (`*.css`, `*.scss`, `tokens.*`, theme files), `app/**/page.*`, `pages/**`, `src/routes/**`, server actions, i18n copy files, public/static assets that change observable behaviour.
- **http-api** — `app/**/route.*`, `middleware.*`, `server/api/**`, `api/**`, `routes/**`, tRPC routers, GraphQL resolvers/schema, WebSocket handlers, route definitions imported from `next`/`express`/`fastify`/`hono`/`koa`.
- **cli** — `bin/**`, `cli/**`, `src/cli/**`, files importing `commander`, `yargs`, `oclif`, `clipanion`, `cac`, `meow`.
- **native** — Electron/Tauri main or renderer entrypoints, React Native / Expo screens, native iOS/Android files.

Unsure → set the flag.
