# Without Skill - Run 1

## Output

Now let me analyze all the i18n and related issues in this code and produce the fixed version.

**Issues identified:**

1. **Translation keys inconsistent** — `en.json` uses natural language keys ("Welcome to the app", "Sign in") mixed with dot-notation keys. Should be consistent structured keys.
2. **Pluralization wrong** — `"items": "item"` / `"items_plural": "items"` uses legacy i18next plural format. Should use `_one`/`_other` suffixes (i18next v21+).
3. **Hardcoded strings in schema** — `settingsSchema.ts` has hardcoded English validation messages instead of using translation keys.
4. **Hardcoded strings in `getErrorMessage`** — `'An unexpected error occurred'` is not translatable.
5. **Hardcoded strings in component** — "Settings", "Display Name", "Email", "Bio", "Password", "Confirm Password", "Save changes", "Last saved:", "file/files", "Collaborators:" are all hardcoded.
6. **Hardcoded `<html lang="en">`** — should use current i18n language. Also, a `<html>` tag inside a component div is invalid — should be removed (the route `head` handles SEO).
7. **Hardcoded SEO title** — `'Settings - MyApp'` in both route head and `<title>` tag.
8. **`navigator.language` in SSR** — `navigator` doesn't exist on the server. Needs a guard.
9. **Date formatting** — `toLocaleDateString()` without a locale argument doesn't respect the user's i18n language.
10. **Pluralization of "file/files"** — manual ternary instead of `t()` with `count`.
11. **List formatting** — `collaborators.join(', ')` doesn't use `Intl.ListFormat` for locale-aware list formatting.
12. **Hardcoded LTR styles** — `marginLeft`, `paddingRight`, `textAlign: 'left'`, `borderLeft` should use logical CSS properties (`marginInlineStart`, etc.) for RTL support.
13. **`Trans` component** — the `i18nKey` "Welcome to the app" is a natural language key; fine functionally but inconsistent with structured keys.
14. **Missing `en.json` keys** — no keys for all the hardcoded strings in the component.

Here is the fixed code:

```typescript
// src/i18n/en.json
{
  "common": {
    "save": "Save changes"
  },
  "welcome": "Welcome to the <strong>app</strong>",
  "auth": {
    "signIn": "Sign in"
  },
  "diffs": {
    "header": {
      "actions": {
        "delete": {
          "confirm": "Are you sure you want to delete?"
        }
      }
    }
  },
  "items_one": "{{count}} item",
  "items_other": "{{count}} items",
  "files_one": "{{count}} file",
  "files_other": "{{count}} files",
  "validation": {
    "tooShort": "Too short (min {{min}})",
    "required": "Required",
    "invalidEmail": "Invalid email",
    "nameTooShort": "Name must be at least {{min}} characters",
    "bioTooLong": "Bio is too long",
    "passwordsMismatch": "Passwords do not match"
  },
  "errors": {
    "repoNotFound": "Repository not found",
    "unauthorized": "Unauthorized",
    "unexpected": "An unexpected error occurred"
  },
  "settings": {
    "title": "Settings",
    "seoTitle": "Settings - MyApp",
    "lastSaved": "Last saved: {{date}}",
    "collaborators": "Collaborators: {{list}}",
    "fields": {
      "displayName": "Display Name",
      "email": "Email",
      "bio": "Bio",
      "password": "Password",
      "confirmPassword": "Confirm Password"
    }
  }
}

// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import pt_BR from './pt-BR.json';

const defaultLng = 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, 'pt-BR': { translation: pt_BR } },
  lng: typeof navigator !== 'undefined' ? navigator.language : defaultLng,
  fallbackLng: defaultLng,
  interpolation: { escapeValue: false },
});

export default i18n;

// src/schemas/settingsSchema.ts
import { z } from 'zod';
import i18n from '../i18n/config';

export const settingsSchema = z.object({
  displayName: z.string().min(2, () => i18n.t('validation.nameTooShort', { min: 2 })),
  email: z.string().email(() => i18n.t('validation.invalidEmail')),
  bio: z.string().max(500, () => i18n.t('validation.bioTooLong')),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: i18n.t('validation.passwordsMismatch'),
  path: ['confirmPassword'],
});

// src/utils/errors.ts
import i18n from '../i18n/config';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return i18n.t('errors.unexpected');
}

// src/routes/settings.tsx
import { createFileRoute } from '@tanstack/react-router';
import i18n from '../i18n/config';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: i18n.t('settings.seoTitle') }],
  }),
});

// src/components/SettingsPage.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useTranslation } from 'react-i18next';
import { settingsSchema } from '../schemas/settingsSchema';
import { getErrorMessage } from '../utils/errors';
import { useMutation } from '@tanstack/react-query';

function SettingsPage() {
  const { t, i18n } = useTranslation();
  const form = useForm({
    resolver: zodResolver(settingsSchema),
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onError: (error) => {
      alert(getErrorMessage(error));
    },
  });

  const lastSaved = new Date(form.getValues('lastSaved'));
  const fileCount = 3;
  const collaborators = ['Alice', 'Bob', 'Charlie'];

  const formattedDate = lastSaved.toLocaleDateString(i18n.language);
  const formattedList = new Intl.ListFormat(i18n.language, {
    style: 'long',
    type: 'conjunction',
  }).format(collaborators);

  return (
    <div>
      <h1>{t('settings.title')}</h1>
      <p style={{
        marginInlineStart: '16px',
        paddingInlineEnd: '8px',
        textAlign: 'start',
        borderInlineStart: '2px solid gray',
      }}>
        {t('settings.lastSaved', { date: formattedDate })}
      </p>
      <p>{t('files', { count: fileCount })}</p>
      <p>{t('settings.collaborators', { list: formattedList })}</p>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <label>
          {t('settings.fields.displayName')}
          <input {...form.register('displayName')} />
          {form.formState.errors.displayName && (
            <span>{form.formState.errors.displayName.message}</span>
          )}
        </label>
        <label>
          {t('settings.fields.email')}
          <input {...form.register('email')} />
        </label>
        <label>
          {t('settings.fields.bio')}
          <input {...form.register('bio')} />
        </label>
        <label>
          {t('settings.fields.password')}
          <input type="password" {...form.register('password')} />
        </label>
        <label>
          {t('settings.fields.confirmPassword')}
          <input type="password" {...form.register('confirmPassword')} />
        </label>
        <button type="submit">{t('common.save')}</button>
        <Trans i18nKey="welcome">
          Welcome to the <strong>app</strong>
        </Trans>
      </form>
    </div>
  );
}

export default SettingsPage;
```

**Summary of fixes (14 issues):**

1. **Structured translation keys** -- Replaced natural-language keys ("Welcome to the app") with nested structured keys (`welcome`, `auth.signIn`, `settings.*`).
2. **Plural suffixes** -- Changed `items`/`items_plural` to `items_one`/`items_other` (i18next v21+ ICU-compatible format). Added `files_one`/`files_other`.
3. **Schema validation messages** -- Replaced hardcoded English strings in `settingsSchema.ts` with `i18n.t()` calls via lazy functions so they resolve at validation time.
4. **Error utility** -- `getErrorMessage` fallback now uses `i18n.t('errors.unexpected')` instead of hardcoded English.
5. **SSR safety** -- Guarded `navigator.language` with `typeof navigator !== 'undefined'` check in `config.ts`.
6. **Removed invalid HTML** -- Removed the `<html>` / `<head>` / `<title>` tags from inside the component (the TanStack Router `head` config handles SEO).
7. **Route head i18n** -- SEO title in `settings.tsx` now uses `i18n.t('settings.seoTitle')`.
8. **All UI strings translated** -- "Settings", "Display Name", "Email", "Bio", "Password", "Confirm Password", "Save changes", "Last saved:", "Collaborators:" all use `t()`.
9. **Locale-aware date** -- `toLocaleDateString(i18n.language)` instead of bare `toLocaleDateString()`.
10. **Locale-aware plurals for files** -- Replaced manual ternary (`fileCount === 1 ? ...`) with `t('files', { count: fileCount })`.
11. **Locale-aware list formatting** -- Replaced `collaborators.join(', ')` with `Intl.ListFormat` using `i18n.language`.
12. **Logical CSS properties** -- Replaced `marginLeft`/`paddingRight`/`textAlign: 'left'`/`borderLeft` with `marginInlineStart`/`paddingInlineEnd`/`textAlign: 'start'`/`borderInlineStart` for RTL support.
13. **Consistent `en.json` key naming** -- `repo_not_found` changed to `repoNotFound` for consistent camelCase.
14. **`Trans` component** -- Updated `i18nKey` to `"welcome"` matching the new structured key.