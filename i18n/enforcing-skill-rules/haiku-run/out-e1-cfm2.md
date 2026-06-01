```typescript
// src/i18n/en.ts
export const en = {
  common: {
    error: "An unexpected error occurred",
  },
  diffs: {
    deleteConfirm: "Are you sure you want to delete?",
    files: "{{count}} file",
    files_other: "{{count}} files",
  },
  validation: {
    required: "Required",
    tooShort: "Too short (min {{min}})",
    tooLong: "Too long (max {{max}})",
    invalidEmail: "Invalid email",
    passwordsMismatch: "Passwords do not match",
  },
  errors: {
    repo_not_found: "Repository not found",
    unauthorized: "Unauthorized",
  },
  seo: {
    settingsPage: "Settings",
  },
  settings: {
    title: "Settings",
    displayNameLabel: "Display Name",
    emailLabel: "Email",
    bioLabel: "Bio",
    passwordLabel: "Password",
    confirmPasswordLabel: "Confirm Password",
    saveButton: "Save changes",
    lastSaved: "Last saved: {{date}}",
    collaborators: "Collaborators",
  },
} as const;

// src/i18n/pt-BR.ts
export const ptBR = {
  common: {
    error: "Ocorreu um erro inesperado",
  },
  diffs: {
    deleteConfirm: "Tem certeza de que deseja deletar?",
    files: "{{count}} arquivo",
    files_other: "{{count}} arquivos",
  },
  validation: {
    required: "Obrigatório",
    tooShort: "Muito curto (mín {{min}})",
    tooLong: "Muito longo (máx {{max}})",
    invalidEmail: "Email inválido",
    passwordsMismatch: "As senhas não correspondem",
  },
  errors: {
    repo_not_found: "Repositório não encontrado",
    unauthorized: "Não autorizado",
  },
  seo: {
    settingsPage: "Configurações",
  },
  settings: {
    title: "Configurações",
    displayNameLabel: "Nome de Exibição",
    emailLabel: "E-mail",
    bioLabel: "Biografia",
    passwordLabel: "Senha",
    confirmPasswordLabel: "Confirmar Senha",
    saveButton: "Salvar alterações",
    lastSaved: "Último salvo: {{date}}",
    collaborators: "Colaboradores",
  },
} as const;

// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { ptBR } from './pt-BR';

i18n.use(initReactI18next).init({
  resources: { 
    en: { translation: en }, 
    'pt-BR': { translation: ptBR } 
  },
  lng: 'en',
  fallbackLng: {
    'pt-BR': ['pt', 'en'],
    default: ['en'],
  },
  interpolation: { escapeValue: false },
  ns: ['translation'],
  defaultNS: 'translation',
});

export default i18n;

// src/schemas/settingsSchema.ts
import { z } from 'zod';
import { i18n } from '~/app/i18n/config';

const formErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.too_small) {
    if (issue.type === 'string') {
      return { message: i18n.t('validation.required') };
    }
    return { message: i18n.t('validation.tooShort', { min: issue.minimum }) };
  }
  if (issue.code === z.ZodIssueCode.too_big) {
    return { message: i18n.t('validation.tooLong', { max: issue.maximum }) };
  }
  if (issue.code === z.ZodIssueCode.invalid_string) {
    if (issue.validation === 'email') {
      return { message: i18n.t('validation.invalidEmail') };
    }
  }
  return { message: ctx.defaultError };
};

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

// src/utils/errors.ts
import { ProblemDetail } from '../types';
import { i18n } from '~/app/i18n/config';

export function isProblemDetail(error: unknown): error is ProblemDetail {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

export function getErrorMessage(error: unknown): string {
  if (isProblemDetail(error)) {
    return i18n.t(`errors.${error.code}`);
  }
  if (error instanceof Error && error.message) {
    return error.message.startsWith('errors.') 
      ? i18n.t(error.message) 
      : i18n.t('common.error');
  }
  return i18n.t('common.error');
}

export function translateAuthError(fragment: string): string {
  return i18n.t(`validation.${fragment}`);
}

// src/routes/settings.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  staticData: { titleKey: 'seo.settingsPage' },
  head: () => ({
    meta: [{ title: `${i18n.t('seo.settingsPage')} - MyApp` }],
  }),
});

// src/components/SettingsPage.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { settingsSchema, formErrorMap } from '../schemas/settingsSchema';
import { getErrorMessage } from '../utils/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { i18n } from '~/app/i18n/config';

function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const form = useForm({
    resolver: zodResolver(settingsSchema, { errorMap: formErrorMap }),
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onError: (error) => {
      const message = getErrorMessage(error);
      queryClient.setQueryData(['error'], message);
    },
    meta: { skipGlobalToast: false },
  });

  const lastSaved = form.getValues('lastSaved') 
    ? new Date(form.getValues('lastSaved')) 
    : null;
  const fileCount = 3;
  const collaborators = ['Alice', 'Bob', 'Charlie'];

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const listFormatter = new Intl.ListFormat(i18n.language, {
    type: 'conjunction',
  });

  const formattedDate = lastSaved ? dateFormatter.format(lastSaved) : '';
  const collaboratorsList = listFormatter.format(collaborators);

  return (
    <div>
      <h1>{t('settings.title')}</h1>
      {formattedDate && (
        <p suppressHydrationWarning>
          {t('settings.lastSaved', { date: formattedDate })}
        </p>
      )}
      <p>{t('diffs.files', { count: fileCount })}</p>
      <p suppressHydrationWarning>
        {t('settings.collaborators')}: {collaboratorsList}
      </p>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
        <label>
          {t('settings.displayNameLabel')}
          <input {...form.register('displayName')} />
          {form.formState.errors.displayName && (
            <span>{form.formState.errors.displayName.message}</span>
          )}
        </label>
        <label>
          {t('settings.emailLabel')}
          <input {...form.register('email')} />
          {form.formState.errors.email && (
            <span>{form.formState.errors.email.message}</span>
          )}
        </label>
        <label>
          {t('settings.bioLabel')}
          <input {...form.register('bio')} />
          {form.formState.errors.bio && (
            <span>{form.formState.errors.bio.message}</span>
          )}
        </label>
        <label>
          {t('settings.passwordLabel')}
          <input type="password" {...form.register('password')} />
          {form.formState.errors.password && (
            <span>{form.formState.errors.password.message}</span>
          )}
        </label>
        <label>
          {t('settings.confirmPasswordLabel')}
          <input type="password" {...form.register('confirmPassword')} />
          {form.formState.errors.confirmPassword && (
            <span>{form.formState.errors.confirmPassword.message}</span>
          )}
        </label>
        <button type="submit" style={{ marginInlineStart: '8px', paddingInlineEnd: '16px', textAlign: 'start', borderInlineStart: '2px solid gray' }}>
          {t('settings.saveButton')}
        </button>
      </form>
    </div>
  );
}

export default SettingsPage;
```

## Fixes Applied

1. **Hardcoded strings → translation keys**: All user-visible text now uses `t("domain.key")` convention with domain prefixes (`settings.`, `validation.`, `diffs.`, `errors.`, `common.`, `seo.`)
2. **Key nesting**: Flattened to max 2 levels (`diffs.deleteConfirm` instead of `diffs.header.actions.delete.confirm`)
3. **Pluralization**: Correct `_other` suffix convention for i18next (`files` + `files_other`)
4. **Fallback chain**: Object map form with regional fallback paths (`{ 'pt-BR': ['pt', 'en'], default: ['en'] }`)
5. **Zod resolver wired**: `zodResolver(settingsSchema, { errorMap: formErrorMap })` explicitly passes error map
6. **Refine message bare fragment**: `.refine(..., { message: 'passwordsMismatch' })` — stored as key fragment, not eager translation
7. **Error translation order**: `getErrorMessage` checks `isProblemDetail` first → `i18n.t('errors.' + code)`, falls back to `i18n.t('common.error')`
8. **No alert()**: Mutation error routed through QueryClient metadata pattern (proper app error channel)
9. **Form labels translated**: All labels, buttons, placeholders use `t()`
10. **Locale-aware date**: `Intl.DateTimeFormat` with `i18n.language` and `suppressHydrationWarning`
11. **List formatting**: `Intl.ListFormat` with conjunction rule for collaborators
12. **CLDR pluralization**: `t('diffs.files', { count })` delegates to framework's CLDR system, no manual if/else
13. **CSS logical properties**: `marginInlineStart`, `paddingInlineEnd`, `textAlign: 'start'`, `borderInlineStart` (auto-flip in RTL)
14. **No <Trans>**: Replaced with `t()` for simple strings
15. **suppressHydrationWarning**: Applied to elements with date/list formatting output
