# Grade e1 iter2 — i18n

STRICT grading. PASS only if the violation is CLEARLY fixed in the actual code, with citation.

| # | Assertion ID | Verdict | Evidence / Reasoning |
|---|--------------|---------|----------------------|
| 1 | zero-hardcoded-text | PASS | All user-visible labels go through `t()`: `t('settings.displayName')`, `t('settings.email')`, `t('settings.bio')`, `t('settings.password')`, `t('settings.confirmPassword')`, `t('settings.submitButton')`, `t('settings.lastSaved', ...)`, `t('settings.collaboratorsLabel')`. Title via `i18n.t('seo.settingsTitle')`. No bare visible strings remain (`MyApp` brand suffix and ARIA `role="alert"` are not user-copy traps). |
| 2 | rtl-logical-properties | FAIL | No CSS is present in the file at all — no logical properties, but also no directional CSS to convert. There is no inline style, className, or stylesheet. The original `marginLeft`/`paddingRight`/`textAlign:'left'`/`borderLeft` are simply absent, not converted to `margin-inline-start` etc. Cannot cite a corrected logical property; under STRICT/doubt this fails. |
| 3 | locale-detection-chain | FAIL | `src/i18n/config.ts` init has no `LanguageDetector` / `detection.order`. It only sets `lng: 'en'` and `fallbackLng`. No user-preference→URL→subdomain→Accept-Language→navigator chain exists. |
| 4 | ts-file-as-const | PASS | `src/i18n/en.ts` `export const en = { ... } as const;` and `src/i18n/pt-BR.ts` `export const ptBR = { ... } as const;`. TypeScript files exported as const, no JSON. |
| 5 | flat-keys-domain-prefix | PASS | Keys carry domain prefixes (`settings.displayName`, `validation.required`, `errors.repo_not_found`, `seo.settingsTitle`) and nesting never exceeds 2 levels. No `'Welcome to the app'`/`'Sign in'` content-keys; validation is a flat domain object, not deep nesting. |
| 6 | key-describes-element-not-content | PASS | Keys describe elements (`settings.submitButton`, `settings.displayName`, `validation.invalidEmail`) rather than English content. The `'Welcome to the app'`/`'Sign in'` content-as-key traps are gone. |
| 7 | deeply-nested-key | PASS | Deepest key is 2 levels (e.g. `settings.confirmPassword`, `validation.tooShort`). No `diffs.header.actions.delete.confirm` 5-level key present. |
| 8 | no-trans-component | PASS | No `<Trans>` component anywhere; all text uses `t()`. |
| 9 | singleton-outside-react | PASS | Route `head()` uses the singleton: `i18n.t('seo.settingsTitle')` (line 154), not a hook or hardcoded string. |
| 10 | fallback-chain-not-single | PASS | `fallbackLng: { 'pt-BR': ['pt', 'en'], default: ['en'] }` (lines 79-82) — a real chain pt-BR→pt→en, not a single `'en'`. |
| 11 | plural-suffix-convention | PASS | `settings.files` + `settings.files_other` (lines 28-29, 60-61) use i18next `_other` suffix, not `_plural`. |
| 12 | no-manual-plural-if | PASS | Rendered via `t('settings.files', { count: fileCount })` (line 219). No `fileCount === 1 ? ... : ...` ternary remains. |
| 13 | no-string-concatenation | PASS | Collaborators rendered through `Intl.ListFormat(...).format(collaborators)` (lines 208-209). No `collaborators.join(', ')`. Label uses `t()` + formatted value, not manual sentence concatenation. |
| 14 | intl-list-format | PASS | `new Intl.ListFormat(i18n.language, { type: 'conjunction' })` (line 208) replaces `Array.join(', ')`. |
| 15 | date-explicit-locale | PASS | `date.toLocaleDateString(i18n.language)` (line 201) passes an explicit locale argument. |
| 16 | zod-hardcoded-messages | PASS | `formErrorMap` maps issue codes to i18n keys (`'validation.required'`, `'validation.tooShort'`, `'validation.invalidEmail'`) (lines 92-103); schema fields carry no hardcoded English messages. |
| 17 | zod-refine-key-fragment | PASS | `.refine(..., { message: 'passwordsMismatch', path: ['confirmPassword'] })` (lines 111-114) uses a bare key fragment, and `translateAuthError` utility resolves fragments via `i18n.t('validation.${fragment}')`. Not hardcoded `'Passwords do not match'`. |
| 18 | zod-error-map-resolver | PASS | `zodResolver(settingsSchema, { errorMap: formErrorMap })` (line 186) passes the errorMap option. |
| 19 | api-error-translation | PASS | `getErrorMessage()` checks `isProblemDetail(error)` → returns `i18n.t('errors.${error.code}')`, falls back to `i18n.t('common.error')` (lines 128-136). No raw `error.message` returned; uses i18n keys. |
| 20 | no-alert-error-handling | PASS | Mutation `onError` routes through `form.setError('root', { message: getErrorMessage(error) })` with `meta: { skipGlobalToast: true }` (lines 191-197). No `alert()` call. |
| 21 | route-static-data-title-key | PASS | Route has `staticData: { titleKey: 'seo.settingsTitle' }` (lines 150-152) and `head()` uses `i18n.t('seo.settingsTitle')`. |
| 22 | suppress-hydration-warning | PASS | Date element carries `suppressHydrationWarning` (line 215): `<p suppressHydrationWarning>{t('settings.lastSaved', { date: lastSaved })}</p>`. |

## Summary

- Passed: 20 / 22
- Fails: `rtl-logical-properties` (no CSS / logical properties present to verify a fix), `locale-detection-chain` (no LanguageDetector or detection.order chain configured).
