# Fixed i18n Code

## Issues Found and Fixed

1. **Hardcoded user-visible text** — "Welcome to the app", "Sign in", "Settings", "Last saved", "Save changes" must go through `t()`
2. **JSON translation file** — must be TypeScript `as const` with flat key structure, not JSON
3. **Fallback chain misconfigured** — `fallbackLng: 'en'` is a single string, not an object map
4. **Zod resolver not wired** — `zodResolver(settingsSchema)` missing `{ errorMap: formErrorMap }`
5. **Zod validation messages hardcoded** — "Too short", "Required", "Invalid email" are English strings, must map through error codes
6. **Refine message using English string** — "Passwords do not match" is hardcoded, should be a bare fragment
7. **getErrorMessage anti-pattern** — catches generic `Error` and returns `error.message` directly, violates ProblemDetail → detail → `common.error` order
8. **Mutation error handler using alert()** — must route through global error channel or explicit toast
9. **Hardcoded dates without locale** — `toLocaleDateString()` missing `i18n.language`
10. **Hardcoded pluralization logic** — `fileCount === 1 ? '1 file' : ...` must use `t("domain.files", { count })`
11. **Hardcoded list joining** — `collaborators.join(', ')` must use `Intl.ListFormat`
12. **Directional CSS not using logical properties** — `marginLeft`, `paddingRight`, `textAlign: 'left'`, `borderLeft` must use logical equivalents
13. **Trans component with JSX children** — not needed here; use `t()` instead
14. **Lang attribute on html inside component** — should be on root layout, not inside component
15. **Route head() not using singleton** — should use `i18n.t()` not hardcoded title
16. **No suppressHydrationWarning** — date rendering needs this flag

---

## Corrected Code

```typescript
// src/i18n/en.ts
export const en = {
  "common.error": "An unexpected error occurred",
  "settings.title": "Settings",
  "settings.lastSaved": "Last saved: {{date}}",
  "settings.files": "{{count}} file",
  "settings.files_other": "{{count}} files",
  "settings.collaborators": "Collaborators",
  "settings.displayNameLabel": "Display Name",
  "settings.emailLabel": "Email",
  "settings.bioLabel": "Bio",
  "settings.passwordLabel": "Password",
  "settings.confirmPasswordLabel": "Confirm Password",
  "settings.saveButton": "Save changes",
  "settings.welcome": "Welcome to the app",
  "validation.required": "Required",
  "validation.tooShort": "Too short (min {{min}})",
  "validation.tooLong": "Too long (max {{max}})",
  "validation.invalidEmail": "Invalid email",
  "validation.passwordsMismatch": "Passwords do not match",
  "seo.settingsPage": "Settings",
} as const;
```

```typescript
// src/i18n/pt-BR.ts
export const pt_BR = {
  "common.error": "Ocorreu um erro inesperado",
  "settings.title": "Configurações",
  "settings.lastSaved": "Último salvamento: {{date}}",
  "settings.files": "{{count}} arquivo",
  "settings.files_other": "{{count}} arquivos",
  "settings.collaborators": "Colaboradores",
  "settings.displayNameLabel": "Nome de Exibição",
  "settings.emailLabel": "E-mail",
  "settings.bioLabel": "Bio",
  "settings.passwordLabel": "Senha",
  "settings.confirmPasswordLabel": "Confirmar Senha",
  "settings.saveButton": "Salvar alterações",
  "settings.welcome": "Bem-vindo ao aplicativo",
  "validation.required": "Obrigatório",
  "validation.tooShort": "Muito curto (mín {{min}})",
  "validation.tooLong": "Muito longo (máx {{max}})",
  "validation.invalidEmail": "E-mail inválido",
  "validation.passwordsMismatch": "As senhas não correspondem",
  "seo.settingsPage": "Configurações",
} as const;
```

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { pt_BR } from './pt-BR';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: pt_BR },
  },
  lng: navigator.language,
  fallbackLng: {
    'pt-BR': ['pt', 'en'],
    default: ['en'],
  },
  interpolation: { escapeValue: false },
});

export { i18n };
```

```typescript
// src/schemas/settingsSchema.ts
import { z } from 'zod';
import { i18n } from '~/app/i18n/config';

export const settingsSchema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  bio: z.string().max(500),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'passwordsMismatch',
  path: ['confirmPassword'],
});

// Zod error map for form validation translation
export const formErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case 'too_small':
      if (issue.type === 'string') {
        return { message: i18n.t('validation.required') };
      }
      return { message: i18n.t('validation.tooShort', { min: issue.minimum }) };
    case 'too_big':
      return { message: i18n.t('validation.tooLong', { max: issue.maximum }) };
    case 'invalid_format':
      if (issue.format === 'email') {
        return { message: i18n.t('validation.invalidEmail') };
      }
      break;
    case 'custom':
      if (issue.params?.['i18nKey']) {
        return { message: i18n.t(issue.params['i18nKey']) };
      }
      break;
  }
  return { message: ctx.defaultError };
};
```

```typescript
// src/utils/errors.ts
import { i18n } from '~/app/i18n/config';
import { ProblemDetail, isProblemDetail } from '../types';

export function getErrorMessage(error: unknown): string {
  // Step 1: Check for ProblemDetail structure
  if (isProblemDetail(error)) {
    return i18n.t(`errors.${error.code}`);
  }
  
  // Step 2: Fall back to error detail field
  if (error instanceof Error && 'detail' in error) {
    const detail = (error as any).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  
  // Step 3: Fall back to generic error message
  return i18n.t('common.error');
}

// Utility to translate refine() message fragments at display time
export function translateAuthError(fragment: string): string {
  return i18n.t(`validation.${fragment}`);
}
```

```typescript
// src/routes/settings.tsx
import { createFileRoute } from '@tanstack/react-router';
import { i18n } from '~/app/i18n/config';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  staticData: { titleKey: 'seo.settingsPage' },
  head: () => ({
    meta: [{ title: i18n.t('seo.settingsPage') }],
  }),
});

import SettingsPage from '../components/SettingsPage';
```

```typescript
// src/components/SettingsPage.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { settingsSchema, formErrorMap } from '../schemas/settingsSchema';
import { getErrorMessage, translateAuthError } from '../utils/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { i18n } from '~/app/i18n/config';

function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Zod resolver WIRED with error map
  const form = useForm({
    resolver: zodResolver(settingsSchema, { errorMap: formErrorMap }),
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onError: (error) => {
      form.setError('root', { message: getErrorMessage(error) });
    },
  });

  const lastSaved = new Date(form.getValues('lastSaved'));
  const fileCount = 3;
  const collaborators = ['Alice', 'Bob', 'Charlie'];

  // Intl formatters with locale
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const listFormatter = new Intl.ListFormat(i18n.language, {
    type: 'conjunction',
  });

  return (
    <div>
      <h1>{t('settings.title')}</h1>

      {/* Hydration-safe: suppressHydrationWarning on locale-dependent content */}
      <p suppressHydrationWarning style={{
        marginInlineStart: '16px',
        paddingInlineEnd: '8px',
        textAlign: 'start',
        borderInlineStart: '2px solid gray',
      }}>
        {t('settings.lastSaved', { date: dateFormatter.format(lastSaved) })}
      </p>

      {/* Pluralization: use t() with count */}
      <p>
        {t('settings.files', { count: fileCount })}
      </p>

      {/* List formatting: Intl.ListFormat, not join() */}
      <p>
        {t('settings.collaborators')}: {listFormatter.format(collaborators)}
      </p>

      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        {/* Root error from mutation */}
        {form.formState.errors.root && (
          <div style={{ color: 'red', marginBottom: '1rem' }}>
            {form.formState.errors.root.message}
          </div>
        )}

        {/* Translatable label */}
        <label>
          {t('settings.displayNameLabel')}
          <input {...form.register('displayName')} />
          {form.formState.errors.displayName && (
            <span style={{ color: 'red' }}>
              {form.formState.errors.displayName.message}
            </span>
          )}
        </label>

        {/* Translatable label */}
        <label>
          {t('settings.emailLabel')}
          <input {...form.register('email')} />
          {form.formState.errors.email && (
            <span style={{ color: 'red' }}>
              {form.formState.errors.email.message}
            </span>
          )}
        </label>

        {/* Translatable label */}
        <label>
          {t('settings.bioLabel')}
          <input {...form.register('bio')} />
          {form.formState.errors.bio && (
            <span style={{ color: 'red' }}>
              {form.formState.errors.bio.message}
            </span>
          )}
        </label>

        {/* Translatable label */}
        <label>
          {t('settings.passwordLabel')}
          <input type="password" {...form.register('password')} />
          {form.formState.errors.password && (
            <span style={{ color: 'red' }}>
              {form.formState.errors.password.message}
            </span>
          )}
        </label>

        {/* Translatable label */}
        <label>
          {t('settings.confirmPasswordLabel')}
          <input type="password" {...form.register('confirmPassword')} />
          {form.formState.errors.confirmPassword && (
            <span style={{ color: 'red' }}>
              {form.formState.errors.confirmPassword.message}
            </span>
          )}
        </label>

        {/* Translatable button */}
        <button type="submit">
          {t('settings.saveButton')}
        </button>

        {/* Use t() for simple text, not Trans component */}
        <p>{t('settings.welcome')}</p>
      </form>
    </div>
  );
}

export default SettingsPage;
```

---

## Checklist (Pre-output Verification)

- [x] **Fallback chain**: Object map form `{ 'pt-BR': ['pt', 'en'], default: ['en'] }` ✓
- [x] **Zod resolver wired**: `zodResolver(settingsSchema, { errorMap: formErrorMap })` ✓
- [x] **Refine message is bare fragment**: `.refine(..., { message: 'passwordsMismatch' })` ✓
- [x] **getErrorMessage order**: ProblemDetail → error.detail → `common.error` ✓
- [x] **Error UX not alert()**: mutation error routes through `form.setError('root', ...)` ✓
- [x] **Hydration-safe elements**: `suppressHydrationWarning` on date rendering ✓
- [x] **No hardcoded user text**: All user-visible strings use `t()` ✓
- [x] **Logical CSS properties**: `marginInlineStart`, `paddingInlineEnd`, `textAlign: 'start'`, `borderInlineStart` ✓
- [x] **Pluralization via i18n**: `t('settings.files', { count: fileCount })` ✓
- [x] **Intl.ListFormat**: `listFormatter.format(collaborators)` ✓
- [x] **Date locale-aware**: `dateFormatter.format(lastSaved)` with `i18n.language` ✓
- [x] **No Trans component**: Simple text uses `t()` ✓
- [x] **Route head() uses singleton**: `i18n.t('seo.settingsPage')` ✓
- [x] **TypeScript translation files**: `as const` exports, flat key structure ✓
