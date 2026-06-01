# Fix report — tanstack-start-best-practices — eval 1 (Haiku, weak executor)

Baseline: 4/7 PASS. Fails: scroll-restoration, server-form-validation, createAPIFileRoute.

Classification: R = reinforce skill, V = clarify vague rule, A = fix assertion, F = retarget/retire.

## 1. scroll-restoration → R (+ latent A on the rule text)

- **Why it failed:** The rule lived only as a buried one-liner in SKILL.md (line 97). The weak model ignored it entirely (no `scrollRestoration`, no key override anywhere in the output).
- **Extra finding:** the one-liner was also factually wrong. It used a non-existent nested option `scrollRestoration: { getKey }`. The current TanStack Router API is top-level `getScrollRestorationKey: (location) => ...` on `createRouter`, with the default key being `location.state.__TSR_key` (older `state.key` deprecated pre-v1.121.34). Source: https://tanstack.com/router/latest/docs/guide/scroll-restoration
- **Fix:** Rewrote line 97 — enable with `scrollRestoration: true`, explain per-history-entry keying, give the concrete `getScrollRestorationKey: (location) => location.pathname` override for search-param routes, and explicitly flag the bogus nested `getKey` as non-existent. Added the anchor names `scrollRestoration` + `getScrollRestorationKey` so a weak model has identifiers to copy.

## 2. server-form-validation → R (+ latent A on the rule text)

- **Why it failed:** The rule was a one-liner with no body and no embodied example, so the weak model hand-rolled `createPostSchema.parseAsync(data)` instead of the required `createServerValidate()`.
- **Extra finding:** the one-liner was wrong on two counts: (a) import path said `@tanstack/start` — the real path is `@tanstack/react-form-start` (and `@tanstack/start` is being retired in favor of framework-specific packages); (b) wiring said `useForm({ serverValidate })`, which is not the real API — the client folds server results back via `transform: useTransform((b) => mergeForm(b, state))`. Sources: https://tanstack.com/form/latest/docs/framework/react/guides/ssr , https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- **Fix:** Rewrote line 61 to forbid the `parseAsync` anti-pattern by name, give the correct import, and embody the full pattern: `createServerValidate({ ...formOpts, onServerValidate })` in the server file, run inside the server fn with `try/catch (ServerValidateError) → return e.response`, and `useTransform`/`mergeForm` on the client. Corrected the false `useForm({ serverValidate })` claim.

## 3. createAPIFileRoute → A (obsolete API in the assertion)

- **Why it "failed":** The assertion (and SKILL.md line 86) demanded `createAPIFileRoute` with one export per HTTP method. The weak model instead produced `createFileRoute('/api/health')({ server: { handlers: { GET } } })` — which is the CURRENT, correct API and matches the skill's own `rules/api-routes.md`. The grade FAILed it only because it didn't use the deprecated symbol.
- **Verification:** `createAPIFileRoute` from `@tanstack/react-start/api` is deprecated; server routes are now `createFileRoute(...).server.handlers`. Source: https://tanstack.com/start/latest/docs/framework/react/guide/server-routes
- **Fix (2 files):** Rewrote the assertion `description`/`trap` in both `evals/evals.json` and `haiku-run/assertions-e1.json` to target the real signal — a server route via `createFileRoute` + `server.handlers` returning a Response, vs. raw `Response.json` in a loader. Also corrected SKILL.md line 86 to drop `createAPIFileRoute`, show the `server.handlers` form, and note the deprecation. Under the corrected assertion, the existing Haiku output (lines 130-138) already passes.

## Safety: 4 passing assertions untouched

Edited only SKILL.md lines 61, 86, 97 — none of which back the passing rules (validateSearch-typed @95, link-preload-strategies @96, staleTime-loader-coordination @90, pendingComponent-not-suspense @92). Changes stay general (no overfitting to the eval's specific strings). Both JSON files re-validated as parseable.

## Expected next iteration

7/7: scroll-restoration + server-form-validation now have embodied, correct patterns to copy; createAPIFileRoute assertion now matches the current API the model already emits correctly.
