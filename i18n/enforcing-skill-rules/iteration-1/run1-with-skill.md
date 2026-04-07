# With Skill - Run 1

## Output

Now I have the full prompt. Let me analyze all the issues against the skill rules and produce the fixed code.

Here is the complete fixed code:

```typescript
// src/i18n/en.ts
// Single TypeScript file per locale, exported as const for type inference.
// Flat keys with domain prefix, max 2 levels deep.
// Keys describe the element, not the content.
export default {
  "common.welcome": "Welcome to the app",
  "common.error": "An unexpected error occurred",
  "auth.submit_button": "Sign in",
  "settings.title": "Settings",
  "settings.display_name_label": "Display Name",
  "settings.email_label": "Email",
  "settings.bio_label": "Bio",
  "settings.password_label": "Password",
  "settings.confirm_password_label": "Confirm Password",
  "settings.save_button": "Save changes",
  "settings.last_saved": "Last saved: {{date}}",
  "diffs.delete_confirm": "Are you sure you want to delete?",
  "diffs.files": "{{count}} file",
  "diffs.files_other": "{{count}} files",
  "settings.collaborators": "Collaborators: {{list}}",
  "validation.required": "Required",
  "validation.too_short": "Too short (min {{min}})",
  "validation.too_long": "Too long (max {{max}})",
  "validation.invalid_email": "Invalid email",
  "validation.passwords_mismatch": "Passwords do not match",
  "errors.repo_not_found": "Repository not found",
  "errors.unauthorized": "Unauthorized",
  "seo.settings_page": "Settings - MyApp",
} as const;

// src/i18n/config.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import ptBR from "./pt-BR";
import pt from "./pt";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
    "pt-BR": { translation: ptBR },
  },
  // Locale detection priority: user preference > navigator > fallback
  lng: localStorage.getItem("userLanguage") ?? navigator.language,
  // Fallback chain: pt-BR -> pt -> en (not just a single fallback)
  fallbackLng: {
    "pt-BR": ["pt", "en"],
    default: ["en"],
  },
  interpolation: { escapeValue: false },
});

export { i18n };
export default i18n;

// src/i18n/formErrorMap.ts
// Custom Zod error map that routes issue codes to i18n keys
import { z } from "zod";
import { i18n } from "./config";

export const formErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.too_small:
      if (issue.minimum === 1 && issue.type === "string") {
        return { message: i18n.t("validation.required") };
      }
      return {
        message: i18n.t("validation.too_short", { min: issue.minimum }),
      };
    case z.ZodIssueCode.too_big:
      return {
        message: i18n.t("validation.too_long", { max: issue.maximum }),
      };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") {
        return { message: i18n.t("validation.invalid_email") };
      }
      return { message: ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};

// src/schemas/settingsSchema.ts
import { z } from "zod";

// Bare key fragment for .refine() — translated via translateSettingsError()
export const settingsSchema = z
  .object({
    displayName: z.string().min(2),
    email: z.string().email(),
    bio: z.string().max(500),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords_mismatch",
    path: ["confirmPassword"],
  });

// src/utils/translateError.ts
import { i18n } from "../i18n/config";

export function translateSettingsError(keyFragment: string): string {
  return i18n.t(`validation.${keyFragment}`);
}

// src/utils/errors.ts
// Resolves any error to a translated user-visible message
import { i18n } from "../i18n/config";
import { ProblemDetail } from "../types";

function isProblemDetail(error: unknown): error is ProblemDetail {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as ProblemDetail).code === "string"
  );
}

export function getErrorMessage(error: unknown): string {
  if (isProblemDetail(error)) {
    return i18n.t(`errors.${error.code}`);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return i18n.t("common.error");
}

// src/routes/settings.tsx
import { createFileRoute } from "@tanstack/react-router";
import { i18n } from "../i18n/config";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  // SEO title via i18n singleton (head() runs outside React)
  head: () => ({
    meta: [{ title: i18n.t("seo.settings_page") }],
  }),
  // Route metadata for breadcrumbs/layout
  staticData: { titleKey: "settings.title" },
});

// src/components/SettingsPage.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { settingsSchema } from "../schemas/settingsSchema";
import { formErrorMap } from "../i18n/formErrorMap";
import { getErrorMessage } from "../utils/errors";
import { translateSettingsError } from "../utils/translateError";
import { useMutation } from "@tanstack/react-query";

function SettingsPage() {
  const { t, i18n } = useTranslation();
  const form = useForm({
    resolver: zodResolver(settingsSchema, { errorMap: formErrorMap }),
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onError: (error) => {
      // Set translated error on form root instead of alert()
      form.setError("root", { message: getErrorMessage(error) });
    },
    meta: { skipGlobalToast: true },
  });

  const lastSaved = new Date(form.getValues("lastSaved"));
  const fileCount = 3;
  const collaborators = ["Alice", "Bob", "Charlie"];

  // Intl.DateTimeFormat with explicit locale — never without locale
  const formattedDate = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
  }).format(lastSaved);

  // Intl.ListFormat for locale-aware list joining — never manual join
  const formattedCollaborators = new Intl.ListFormat(i18n.language, {
    type: "conjunction",
  }).format(collaborators);

  return (
    <div>
      <h1>{t("settings.title")}</h1>
      {/* CSS logical properties for RTL support */}
      <p
        style={{
          marginInlineStart: "16px",
          paddingInlineEnd: "8px",
          textAlign: "start" as const,
          borderInlineStart: "2px solid gray",
        }}
      >
        {t("settings.last_saved", { date: formattedDate })}
      </p>
      {/* Pluralization via i18next count — never manual if/else */}
      <p>{t("diffs.files", { count: fileCount })}</p>
      <p>{t("settings.collaborators", { list: formattedCollaborators })}</p>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        {form.formState.errors.root && (
          <div role="alert">{form.formState.errors.root.message}</div>
        )}
        <label>
          {t("settings.display_name_label")}
          <input {...form.register("displayName")} />
          {form.formState.errors.displayName && (
            <span>{form.formState.errors.displayName.message}</span>
          )}
        </label>
        <label>
          {t("settings.email_label")}
          <input {...form.register("email")} />
          {form.formState.errors.email && (
            <span>{form.formState.errors.email.message}</span>
          )}
        </label>
        <label>
          {t("settings.bio_label")}
          <input {...form.register("bio")} />
          {form.formState.errors.bio && (
            <span>{form.formState.errors.bio.message}</span>
          )}
        </label>
        <label>
          {t("settings.password_label")}
          <input type="password" {...form.register("password")} />
        </label>
        <label>
          {t("settings.confirm_password_label")}
          <input type="password" {...form.register("confirmPassword")} />
          {form.formState.errors.confirmPassword && (
            <span>
              {translateSettingsError(
                form.formState.errors.confirmPassword.message ?? ""
              )}
            </span>
          )}
        </label>
        <button type="submit">{t("settings.save_button")}</button>
        {/* t() is simpler and sufficient — <Trans> removed (no JSX interpolation needed) */}
        <p>{t("common.welcome")}</p>
      </form>
    </div>
  );
}

export default SettingsPage;
```

---

**Summary of all issues fixed:**

1. **Translation file format**: Changed from `.json` to `.ts` exported `as const` -- enables type inference, no JSON parsing, bundled statically.

2. **Key naming**: English strings as keys (`"Welcome to the app"`, `"Sign in"`) replaced with domain-prefixed descriptive keys (`common.welcome`, `auth.submit_button`). Keys must survive renaming of the English string.

3. **Nesting depth**: `diffs.header.actions.delete.confirm` exceeded the 2-level max -- flattened to `diffs.delete_confirm`. Nested `validation.*` and `errors.*` objects flattened to flat dot-prefixed keys.

4. **Pluralization**: `items`/`items_plural` is wrong -- i18next uses `_other` suffix convention. Fixed to `diffs.files` / `diffs.files_other` with `{{count}}` interpolation. Removed the manual `fileCount === 1 ? ...` ternary -- never use `if count === 1`, always use the framework's CLDR-aware system.

5. **Fallback locale chain**: Changed from single `fallbackLng: 'en'` to a chain: `pt-BR -> pt -> en`. Partially translated locales gracefully show the closest match.

6. **Locale detection**: Added `localStorage.getItem("userLanguage")` as highest priority before `navigator.language`, following the priority chain.

7. **Zod form validation**: Removed hardcoded English strings from schema (`'Name must be at least 2 characters'`, etc.). Created `formErrorMap` that maps Zod issue codes to i18n keys. Passed it via `zodResolver(settingsSchema, { errorMap: formErrorMap })`.

8. **Refine message**: Changed hardcoded `'Passwords do not match'` to bare key fragment `"passwords_mismatch"` with a `translateSettingsError()` utility that prepends the domain.

9. **API error translation**: `getErrorMessage()` now checks `isProblemDetail(error)` first, maps to `errors.${error.code}`, falls back to `error.message`, then to `i18n.t("common.error")` -- not a hardcoded English string.

10. **`<Trans>` removal**: Replaced `<Trans>` with `t()` -- the `<Trans>` component was wrapping a `<strong>` but the skill says never use `<Trans>` unless interpolation truly requires JSX elements. Here a simple `t()` call suffices.

11. **Hardcoded text**: All user-visible strings extracted -- `"Settings"` heading, `"Display Name"`, `"Email"`, `"Bio"`, `"Password"`, `"Confirm Password"`, `"Save changes"`, `"Last saved:"`, `"Collaborators:"`, the `<title>` tag.

12. **RTL support**: Replaced directional CSS (`marginLeft`, `paddingRight`, `textAlign: 'left'`, `borderLeft`) with logical properties (`marginInlineStart`, `paddingInlineEnd`, `textAlign: 'start'`, `borderInlineStart`).

13. **Date formatting**: Replaced bare `toLocaleDateString()` (no locale) with `new Intl.DateTimeFormat(i18n.language, ...)` -- never format without an explicit locale.

14. **List formatting**: Replaced `collaborators.join(', ')` with `Intl.ListFormat` -- conjunction rules differ by language.

15. **Route metadata**: `head()` now uses `i18n.t("seo.settings_page")` singleton instead of a hardcoded title string. Added `staticData: { titleKey: "settings.title" }` for breadcrumbs/layout.

16. **Error handling in mutation**: Replaced `alert(getErrorMessage(error))` with `form.setError("root", ...)` and added `meta: { skipGlobalToast: true }` since this form handles errors locally.

17. **Removed `<html>` tag from component**: The `<html lang="en">` inside the component body is wrong -- `lang` should be set on the root route's `<html>` element using `i18n.language`, not hardcoded inside a page component.

18. **Named export of i18n**: Added `export { i18n }` for singleton usage outside React (route `head()`, error maps, utilities).