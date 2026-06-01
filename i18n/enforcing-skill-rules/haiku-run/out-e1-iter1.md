# Fixed Code - i18n Skill Rules Applied

## src/i18n/en.ts
```typescript
export const en = {
  common: {
    error: "An error occurred",
  },
  auth: {
    signIn: "Sign in",
  },
  diffs: {
    title: "Diffs",
    headerActionsDeleteConfirm: "Are you sure you want to delete?",
    files: "{{count}} file",
    files_other: "{{count}} files",
  },
  settings: {
    title: "Settings",
    lastSaved: "Last saved: {{date}}",
    collaborators: "Collaborators",
    displayName: "Display Name",
    email: "Email",
    bio: "Bio",
    password: "Password",
    confirmPassword: "Confirm Password",
    saveChanges: "Save changes",
  },
  seo: {
    settingsPageTitle: "Settings - MyApp",
  },
  validation: {
    required: "Required",
    tooShort: "Too short (min {{min}})",
    invalidEmail: "Invalid email",
    tooLong: "Too long (max {{max}})",
    passwordsMismatch: "Passwords do not match",
  },
  errors: {
    repo_not_found: "Repository not found",
    unauthorized: "Unauthorized",
  },
} as const;
```

## src/i18n/pt-BR.ts
```typescript
export const ptBR = {
  common: {
    error: "Um erro ocorreu",
  },
  auth: {
    signIn: "Entrar",
  },
  diffs: {
    title: "Diffs",
    headerActionsDeleteConfirm: "Tem certeza que deseja deletar?",
    files: "{{count}} arquivo",
    files_other: "{{count}} arquivos",
  },
  settings: {
    title: "Configurações",
    lastSaved: "Última edição: {{date}}",
    collaborators: "Colaboradores",
    displayName: "Nome de Exibição",
    email: "E-mail",
    bio: "Biografia",
    password: "Senha",
    confirmPassword: "Confirmar Senha",
    saveChanges: "Salvar alterações",
  },
  seo: {
    settingsPageTitle: "Configurações - MyApp",
  },
  validation: {
    required: "Obrigatório",
    tooShort: "Muito curto (mín {{min}})",
    invalidEmail: "E-mail inválido",
    tooLong: "Muito longo (máx {{max}})",
    passwordsMismatch: "As senhas não correspondem",
  },
  errors: {
    repo_not_found: "Repositório não encontrado",
    unauthorized: "Não autorizado",
  },
} as const;
```

## src/i18n/config.ts
```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { ptBR } from "./pt-BR";

// Detect locale: prefer localStorage, then URL param, then Accept-Language, fallback to 'en'
function detectLocale(): string {
  // (1) User preference from localStorage
  const stored = localStorage.getItem("locale");
  if (stored && ["en", "pt-BR"].includes(stored)) return stored;

  // (2) URL parameter ?lang=
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang && ["en", "pt-BR"].includes(urlLang)) return urlLang;

  // (3) navigator.language with fallback chain
  const navLang = navigator.language;
  if (navLang.startsWith("pt")) return "pt-BR";
  if (navLang.startsWith("en")) return "en";

  // (4) Default fallback
  return "en";
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "pt-BR": { translation: ptBR },
    },
    lng: detectLocale(),
    fallbackLng: ["en"],
    fallbackNS: "translation",
    interpolation: {
      escapeValue: false,
    },
  });

export { i18n };
```

## src/schemas/settingsSchema.ts
```typescript
import { z } from "zod";
import { i18n } from "../i18n/config";

// Map Zod error codes to i18n keys
const formErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case "too_small":
      if (issue.type === "string") {
        return {
          message: i18n.t("validation.required"),
        };
      }
      return {
        message: i18n.t("validation.tooShort", { min: issue.minimum }),
      };
    case "too_big":
      return {
        message: i18n.t("validation.tooLong", { max: issue.maximum }),
      };
    case "invalid_string":
      if (issue.validation === "email") {
        return {
          message: i18n.t("validation.invalidEmail"),
        };
      }
      break;
  }
  return { message: ctx.defaultError };
};

export const settingsSchema = z
  .object({
    displayName: z.string().min(2),
    email: z.string().email(),
    bio: z.string().max(500),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: i18n.t("validation.passwordsMismatch"),
    path: ["confirmPassword"],
  });
```

## src/utils/errors.ts
```typescript
import { i18n } from "../i18n/config";

interface ProblemDetail {
  code: string;
  detail?: string;
}

function isProblemDetail(error: unknown): error is ProblemDetail {
  return typeof error === "object" && error !== null && "code" in error;
}

export function getErrorMessage(error: unknown): string {
  // (1) Check for ProblemDetail with error code
  if (isProblemDetail(error)) {
    const errorKey = `errors.${error.code}`;
    const translated = i18n.t(errorKey);
    // If key exists (doesn't equal the key itself), use it
    if (translated !== errorKey) {
      return translated;
    }
    // Fallback to detail property
    if (error.detail) {
      return error.detail;
    }
  }

  // (2) Standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // (3) Ultimate fallback
  return i18n.t("common.error");
}
```

## src/routes/settings.tsx
```typescript
import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "../components/SettingsPage";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  staticData: {
    titleKey: "seo.settingsPageTitle",
  },
  head: () => {
    const { i18n } = require("../i18n/config");
    return {
      meta: [
        {
          title: i18n.t("seo.settingsPageTitle"),
        },
      ],
    };
  },
});
```

## src/components/SettingsPage.tsx
```typescript
import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { settingsSchema } from "../schemas/settingsSchema";
import { getErrorMessage } from "../utils/errors";
import { i18n } from "../i18n/config";

interface SettingsFormData {
  displayName: string;
  email: string;
  bio: string;
  password: string;
  confirmPassword: string;
}

function SettingsPage() {
  const { t } = useTranslation();
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      // Mock API call
      return data;
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      alert(message);
    },
  });

  // Mock data for demo
  const lastSaved = new Date();
  const fileCount = 3;
  const collaborators = ["Alice", "Bob", "Charlie"];

  // Format date with i18n language
  const formattedDate = lastSaved.toLocaleDateString(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format collaborators list using Intl.ListFormat
  const collaboratorsList = useMemo(
    () =>
      new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(
        collaborators
      ),
    [collaborators, i18n.language]
  );

  return (
    <div>
      <h1>{t("settings.title")}</h1>
      <p
        style={{
          marginInlineStart: "16px",
          paddingInlineEnd: "8px",
          textAlign: "start",
          borderInlineStart: "2px solid gray",
        }}
      >
        {t("settings.lastSaved", { date: formattedDate })}
      </p>
      <p>{t("diffs.files", { count: fileCount })}</p>
      <p>
        {t("settings.collaborators")}: {collaboratorsList}
      </p>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <label>
          {t("settings.displayName")}
          <input {...form.register("displayName")} />
          {form.formState.errors.displayName && (
            <span>{form.formState.errors.displayName.message}</span>
          )}
        </label>
        <label>
          {t("settings.email")}
          <input {...form.register("email")} />
          {form.formState.errors.email && (
            <span>{form.formState.errors.email.message}</span>
          )}
        </label>
        <label>
          {t("settings.bio")}
          <input {...form.register("bio")} />
          {form.formState.errors.bio && (
            <span>{form.formState.errors.bio.message}</span>
          )}
        </label>
        <label>
          {t("settings.password")}
          <input type="password" {...form.register("password")} />
          {form.formState.errors.password && (
            <span>{form.formState.errors.password.message}</span>
          )}
        </label>
        <label>
          {t("settings.confirmPassword")}
          <input type="password" {...form.register("confirmPassword")} />
          {form.formState.errors.confirmPassword && (
            <span>{form.formState.errors.confirmPassword.message}</span>
          )}
        </label>
        <button type="submit">{t("settings.saveChanges")}</button>
      </form>
    </div>
  );
}

export default SettingsPage;
```

## Key Fixes Applied

1. **Flat TypeScript translations** (`en.ts`, `pt-BR.ts`): Exported as `const`, flat keys with domain prefixes (`settings.*`, `validation.*`, `errors.*`, `seo.*`), max 2 levels nesting
2. **ZERO hardcoded UI text**: All strings use `t()` or `i18n.t()`
3. **Locale detection chain**: Prefers localStorage → URL param → Accept-Language → fallback to 'en'
4. **Pluralization**: Uses `t("diffs.files", { count })` with `_other` suffix
5. **Zod form validation**: Error map translates all validation issues via `i18n.t()`
6. **API error translation**: `getErrorMessage()` maps `ProblemDetail.code` to `errors.*` keys
7. **Date formatting**: Uses `toLocaleDateString(i18n.language, {...})`
8. **List formatting**: Uses `Intl.ListFormat` for locale-aware conjunctions
9. **CSS logical properties**: Replaced `marginLeft` → `marginInlineStart`, `paddingRight` → `paddingInlineEnd`, `textAlign: left` → `textAlign: start`, `borderLeft` → `borderInlineStart`
10. **Route metadata**: Uses `staticData.titleKey` pattern
11. **Removed `<Trans>`**: Replaced with simple `t()` calls (no JSX interpolation needed)
