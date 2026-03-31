# PS1: How should I organize my React project's folder structure?

**Organize by feature:** `features/{name}/api/`, `components/`, `hooks/`, `types/`, `index.ts`.

```
src/
  features/
    auth/
      api/
        login.ts
        register.ts
      components/
        LoginForm.tsx
        AuthGuard.tsx
      hooks/
        useAuth.ts
      types/
        index.ts
      index.ts          # public API barrel
    dashboard/
      api/
      components/
      hooks/
      types/
      index.ts
  components/
    ui/                 # shared UI primitives (Button, Input, Modal)
    layout/             # shared layouts (AppShell, Sidebar)
```

Use import aliases: `@/` = `src/`. Shared UI primitives go in `components/ui/`, layouts in `components/layout/`. Types are colocated with their feature, not in a global `types/` dump.
