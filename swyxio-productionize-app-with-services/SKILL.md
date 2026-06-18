---
name: productionize-app-with-services
description: Transform a working demo/prototype codebase into a production-shaped product that is observable, auditable, secure, API-drivable, product-manageable, and easy for AI agents/bots to maintain. Use when the user asks to harden or productize a repo, add audit trails, role permissions, API keys, REST/OpenAPI/agent docs, feature flags, PostHog observability, security/rate limits, admin management UI, migration/readiness audits, concurrent subagent execution, or a final migration audit microsite.
---

# Productionize App With Services

Use this skill when a codebase already "works" but needs to become a durable product. The job is not just cleanup; it is to make the system understandable, operable, inspectable, secure by default, API-first where useful, and friendly to future human and AI maintainers.

This skill is broader than maintainability refactoring. If the task is only structural cleanup, use `antislop-codebase`; if the task includes product readiness, observability, audit, security, API surfaces, admin UX, and deploy validation, use this skill.

## Default Stack

Prefer the repo's existing stack. When the repo is greenfield or choices are open, recommend:

- App database: Postgres first, then MySQL or SQLite when the product footprint calls for it.
- Auth: hand-rolled product auth state inside the app database for product-specific API keys, roles, audit logs, idempotency keys, sessions/tokens, and admin actions, even if human login uses a library.
- Observability: PostHog for product analytics, feature flag exposure, admin action events, AI/LLM traces, evaluation events, funnels, and session replay where appropriate.
- Validation: runtime schemas at external/provider/API boundaries, commonly Zod in TypeScript projects or the native equivalent in other stacks.
- API docs: OpenAPI generated from shared schemas/contracts whenever possible.
- Audit review: a static migration audit microsite served locally at the end.

Adopt different tools when the codebase already has a strong convention. Do not force this stack over Rails/Django/Laravel/Phoenix/etc.; translate the principles into local patterns.

## Operating Principles

- Ground everything in repo facts before planning: current scripts, deployment topology, database schema, auth model, API routes, frontend state model, tests, recent commits, and dirty worktree.
- Preserve working product behavior unless the user explicitly asks for breaking changes.
- Separate UI sync/local-state concerns from programmatic APIs. Browser local-first sync can coexist with stateless REST/API handlers that hit the server database directly.
- Make every meaningful product action available through one shared action layer where practical, then expose it through UI, command palette, tRPC/internal RPC, REST/API, jobs, and webhooks without duplicating business logic.
- Treat observability as product surface, not afterthought: users/admins should see health, delivery status, retries, AI confidence, feature state, and permission outcomes where useful.
- Make the system friendly to agents: documented APIs, idempotent mutations, bulk operations, deterministic tests, stable schemas, public `skill.md`/agent guide, and reviewable audit output.

## Workflow

### 1. Discover The Product Boundary

Run a non-mutating discovery pass:

- Current git status, branch, recent commits, deployment config, package scripts, env examples, migrations, test harnesses, and docs.
- Entrypoints, route/API surfaces, background jobs, webhooks, provider integrations, data sync layers, command palette/action surfaces, and admin pages.
- Database tables for users, teams/orgs, roles, API keys, audit logs, webhooks, feature flags, idempotency, jobs, notifications, and provider tokens.
- Security posture: env validation, secret storage/encryption, auth/session model, API key model, rate limits, CORS, CSRF, headers, input validation, and logging of sensitive data.
- Observability posture: product events, server logs, request IDs, error capture, traces, AI/LLM telemetry, dashboards, health/readiness routes, and user/admin visibility.
- Product workflows that must remain intact and workflows that are visibly placeholder/demo-only.

Read [product-principles.md](references/product-principles.md) before writing the plan.

### 2. Write A Decision-Complete Execution Plan

Write a plan the user can modify before or during execution. Include:

- Product goal, explicit non-goals, assumptions, and risk posture.
- Current-state findings with file/schema references.
- Workstreams: product UX, API/action layer, auth/permissions, audit/compliance, security, observability/PostHog, feature flags, admin UX, tests, docs, deploy, migration audit.
- Concurrency map for subagents: which surfaces can be analyzed or edited independently, which files must stay single-owner, and merge order.
- API-first plan: REST or equivalent stateless programmatic API, API key auth, scopes, bulk/filter endpoints, idempotency, OpenAPI, public agent guide, and command palette reuse.
- Validation gates: lint/typecheck/unit/build/e2e/visual/deploy smoke, production health/readiness, temp record cleanup, logs, and dashboard/event checks.
- Rollback and compatibility plan for migrations, env changes, provider changes, and user-visible workflow changes.

The plan should be complete, but not frozen. Update it as facts change.

### 3. Build The Safety Net

Before broad edits:

- Run existing checks or record why they cannot run.
- Add characterization tests for fragile behavior before refactoring it.
- Add runtime schemas for external/provider/AI/API outputs before wiring UI decisions to them.
- Add or verify health/readiness checks before relying on deploy smokes.
- Capture screenshots for core user/admin surfaces when frontend changes matter.

### 4. Execute In Product Slices

Prefer this order unless repo facts suggest otherwise:

1. **Production boot and env**: startup env validation, documented required env, health/readiness routes, deploy healthcheck, logs that distinguish boot/db/provider failures.
2. **Shared action layer**: extract product actions behind typed functions that can be called by UI RPC, REST, jobs, webhooks, and command palette.
3. **API and agent surface**: API key auth, scopes, rate limits, REST routes, filtering, bulk ops, idempotency, OpenAPI, public `/api/v1/skill.md` or equivalent agent guide.
4. **Permissions and admin UX**: role-aware settings/admin pages, read-only member states, admin-only mutations, visible capability status.
5. **Audit trail**: append-only audit entries for user/system/rule/api actors, IP/user-agent where appropriate, admin-only audit viewer, audit events for every important mutation.
6. **Security hardening**: token encryption, secret handling, security headers, input validation, CORS/CSRF, safe logging, SSRF/file/upload/provider limits, rate limit persistence if multi-instance.
7. **Observability and PostHog**: server/client event capture, feature flag exposure, dashboards, AI generation traces/evals, error classes, latency/cost guardrails, visible webhook/job delivery state.
8. **Product UX polish**: replace placeholders with working flows, long-running progress, retry/empty/error states, mobile/narrow/wide screenshot pass.
9. **Tests and deploy**: focused tests per new contract, e2e smoke for critical flows, deploy, production smoke with nonpermanent records, cleanup, final log review.

For detailed execution rules and worker prompts, read [execution-playbook.md](references/execution-playbook.md).

### 5. Use Concurrent Subagents Carefully

Use subagents when available for independent discovery, test-writing, UI review, API inventory, migration audit, docs/OpenAPI review, and security/observability gap analysis.

Do not let multiple workers edit the same hot files. Keep one integration owner responsible for merging changes, running the full suite, deploy, and final cleanup.

### 6. Validate Like Production

At the end of each slice:

- Run narrow tests for touched code.
- Add missing tests before relying on manual QA.
- Run full lint/typecheck/unit/build before deploy.
- Run e2e/browser/screenshot checks for changed user/admin flows.
- Deploy only when local gates pass or when the user explicitly accepts a known-risk deploy.
- Smoke production with `codex-smoke-*` or equivalent temporary records, then clean them up and verify zero leftovers.
- Check logs and observability dashboards for startup errors, auth/API status codes, webhook retries, AI/provider failures, and unexpected 4xx/5xx spikes.

### 7. Finish With A Migration Audit Microsite

Create a static review microsite at the end. It should include:

- Executive summary and scope.
- Before/after architecture map.
- Workstream checklist and evidence.
- Migration ledger and schema changes.
- Security, permissions, audit, API, observability, and admin UX review.
- Test/deploy evidence and smoke records cleaned.
- Residual risks, deferred work, and next recommended slices.

Serve it locally and give the user a URL. Read [audit-microsite.md](references/audit-microsite.md) before generating it.

## Quality Bar

A successful run leaves the product:

- Observable: health/readiness, structured logs, product analytics, admin-visible delivery/job/AI state.
- Auditable: append-only audit trail with actor type, resource, action, metadata, and restricted viewer.
- Secure: role gates, API key scopes, rate limits, encrypted tokens/secrets, env validation, secure headers, safe logging.
- Product-manageable: admin settings, feature flags, docs, public API/agent guide, dashboards.
- API-drivable: stateless programmatic API, bulk/filter/idempotency, OpenAPI, command palette/action reuse.
- Maintainable by bots: small typed modules, shared action layer, focused tests, migration docs, stable contracts, audit microsite.
