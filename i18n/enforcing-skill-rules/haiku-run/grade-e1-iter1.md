# Grade: i18n e1 iter1 (STRICT)

| # | Assertion ID | Verdict | Evidence / Reason |
|---|--------------|---------|-------------------|
| 1 | zero-hardcoded-text | PASS | All listed strings go through `t()`/`i18n.t()`. en.ts keys: `settings.title/displayName/email/bio/password/confirmPassword/saveChanges/lastSaved`, `seo.settingsPageTitle`. JSX uses `t("settings.title")` (L300), `t("settings.displayName")` (L317), etc. Title via `i18n.t("seo.settingsPageTitle")` (L233). No literal user-visible strings in components/routes. |
| 2 | rtl-logical-properties | PASS | L303-306: `marginInlineStart`, `paddingInlineEnd`, `textAlign: "start"`, `borderInlineStart`. All directional props converted to logical equivalents. |
| 3 | locale-detection-chain | PASS | `detectLocale()` L97-114: (1) localStorage user pref, (2) URL `?lang=` param, (3) navigator.language, (4) default `en`. Multi-step priority chain present, not bare navigator.language. |
| 4 | ts-file-as-const | PASS | en.ts (L5-43) and pt-BR.ts (L48-86) are TS files `export const ... as const`. No JSON. |
| 5 | flat-keys-domain-prefix | PASS | Keys are domain-prefixed objects: `settings.*`, `validation.*`, `errors.*`, `auth.signIn`. Old offenders 'Welcome to the app'/'Sign in' replaced by `auth.signIn`. Nesting at most 2 levels. |
| 6 | key-describes-element-not-content | PASS | `auth.signIn` (key, not "Sign in" content as key). diffs delete-confirm flattened to `headerActionsDeleteConfirm`. Keys are element-descriptive and survive English text rename. |
| 7 | deeply-nested-key | PASS | 5-level `diffs.header.actions.delete.confirm` flattened to `diffs.headerActionsDeleteConfirm` (L13) — 2 levels. |
| 8 | no-trans-component | PASS | No `<Trans>` anywhere; all text uses `t()`. L372 confirms removal. |
| 9 | singleton-outside-react | PASS | Route `head()` uses `i18n.t("seo.settingsPageTitle")` singleton (L229-233), not hardcoded string and not the hook. |
| 10 | fallback-chain-not-single | FAIL | `fallbackLng: ["en"]` (L124) is an array but still a SINGLE fallback target. Assertion requires a real chain (e.g. pt-BR -> pt -> en). No regional->base->default mapping configured. Wrapping one value in an array is superficial, not a chain. |
| 11 | plural-suffix-convention | PASS | `files: "{{count}} file"` + `files_other: "{{count}} files"` (L15-16). Correct i18next `_other` suffix, not `_plural`. |
| 12 | no-manual-plural-if | PASS | Manual `fileCount === 1 ? ...` removed; uses `t("diffs.files", { count: fileCount })` (L311). |
| 13 | no-string-concatenation | PASS | `collaborators.join(', ')` removed; uses `Intl.ListFormat(...).format(collaborators)` (L292-294), rendered via t() label + value. |
| 14 | intl-list-format | PASS | `new Intl.ListFormat(i18n.language, { type: "conjunction" })` (L292). Locale-aware. |
| 15 | date-explicit-locale | PASS | `lastSaved.toLocaleDateString(i18n.language, {...})` (L283) — explicit locale arg passed. |
| 16 | zod-hardcoded-messages | PASS | `formErrorMap` (L140-164) maps issue codes to `i18n.t("validation.*")` keys. Schema fields (L167-173) carry no hardcoded messages. |
| 17 | zod-refine-key-fragment | FAIL | `.refine(... { message: i18n.t("validation.passwordsMismatch") })` (L175-176). Assertion requires a BARE key fragment (`message: 'passwordsMismatch'`) resolved by a translation utility, NOT an eager `i18n.t()` call inline. Calling `i18n.t()` at module load freezes the translation at the wrong locale and is not the bare-fragment pattern. Still effectively hardcoding the resolution moment. |
| 18 | zod-error-map-resolver | FAIL | `zodResolver(settingsSchema)` (L263) is called WITHOUT the `errorMap` option. Assertion requires `zodResolver(Schema, { errorMap: formErrorMap })`. `formErrorMap` is defined but never wired to the resolver — so form validation does not use it. Violation still present. |
| 19 | api-error-translation | FAIL | `getErrorMessage()` (L193-215) order is wrong. Required: isProblemDetail -> i18n.t(errors.code) -> error.detail -> i18n.t('common.error'). Code returns raw `error.message` for any `Error` instance (L209-210) BEFORE the common.error fallback, and for a ProblemDetail whose code lacks a key it returns `error.detail` (ok) but a generic Error short-circuits to raw message. Returning raw `error.message` is exactly the trap (raw error.message). |
| 20 | global-toast-handler | FAIL | Mutation `onError` uses `alert(message)` (L271-274). Assertion requires a global QueryCache/MutationCache.onError toast handler with skipGlobalToast opt-out. `alert()` is precisely the trap; no global handler exists. |
| 21 | route-static-data-title-key | PASS | `staticData: { titleKey: "seo.settingsPageTitle" }` (L225-227) and head() uses `i18n.t("seo.settingsPageTitle")` (L233). |
| 22 | seo-hreflang-tags | FAIL | head() (L228-237) emits only a `title` meta. No `<link rel="alternate" hreflang="xx">` nor `x-default`. Violation entirely unaddressed. |
| 23 | html-lang-dynamic | FAIL | No root route / `<html lang={i18n.language}>` anywhere in the output. The hardcoded `<html lang='en'>` was never converted; the file containing it is simply absent from the fix. Undelivered. |
| 24 | ssr-sync-init | FAIL | `i18n...init({...})` (L116-129) is still the async-returning init with no synchronous SSR guarantee; also `route head()` uses `require("../i18n/config")` (L229) which is a CJS dynamic require, not a sync static-import SSR pattern. No evidence init is awaited/sync-safe for SSR. Trap (async init, no sync SSR init) not clearly fixed. |
| 25 | suppress-hydration-warning | FAIL | The date `<p>` (L301-310) renders `t("settings.lastSaved", { date: formattedDate })` from `new Date()` but has NO `suppressHydrationWarning`. Client-dependent value still unguarded. Violation present. |
| 26 | html-dir-rtl | FAIL | No `dir` attribute / `<html dir="rtl">` anywhere in output. RTL support on html element entirely missing. Undelivered. |
