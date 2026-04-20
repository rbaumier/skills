---
name: setup-pre-commit
description: Use when the user wants to add pre-commit hooks, set up Husky, configure lint-staged, add commit-time formatting/typechecking/testing, or mentions "pre-commit", "husky", "lint-staged". Sets up Husky + lint-staged + Prettier + typecheck + tests in the current repo with package-manager auto-detection.
---

# Setup Pre-Commit Hooks

## What This Sets Up

- **Husky** pre-commit hook
- **lint-staged** running Prettier on all staged files
- **Prettier** config (if missing)
- **typecheck** and **test** scripts in the pre-commit hook (if the repo has those scripts)

## Steps

### 1. Detect package manager

Check lockfiles in order: `bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm. Default to npm if unclear.

### 2. Install dependencies

Install as devDependencies:

```
husky lint-staged prettier
```

Use the detected package manager: `bun add -d`, `pnpm add -D`, `yarn add -D`, or `npm install -D`.

### 3. Initialize Husky

```bash
npx husky init
```

This creates `.husky/` and adds `"prepare": "husky"` to package.json.

### 4. Create `.husky/pre-commit`

No shebang needed for Husky v9+:

```
npx lint-staged
npm run typecheck
npm run test
```

**Adapt**:
- Replace `npm` with the detected package manager (`pnpm run`, `bun run`, `yarn`)
- If the repo has **no `typecheck` script** in package.json, omit that line and tell the user
- If the repo has **no `test` script**, omit that line and tell the user
- If both are absent, the hook just runs lint-staged

### 5. Create `.lintstagedrc`

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

`--ignore-unknown` skips files Prettier can't parse (images, lockfiles, etc.).

### 6. Create `.prettierrc` (only if missing)

If any Prettier config already exists (`.prettierrc`, `.prettierrc.json`, `.prettierrc.js`, `prettier` key in package.json), **skip this step**.

Defaults:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

### 7. Verify

- [ ] `.husky/pre-commit` exists and is executable
- [ ] `.lintstagedrc` exists
- [ ] `prepare` script in package.json is `"husky"`
- [ ] A Prettier config exists
- [ ] `npx lint-staged` runs without error

### 8. Commit

Stage all changed/created files and commit with message: `Add pre-commit hooks (husky + lint-staged + prettier)`. This also smoke-tests the new hook.

## Why this design

- **lint-staged first** (fast, staged-only) — fails early on formatting issues before running the slower gates
- **typecheck + test after** — catches breakage the format pass can't see
- **`--ignore-unknown`** — prevents Prettier from refusing to process binary/unsupported files

## Notes

- Husky v9+ doesn't need shebangs in hook files
- If the repo already has a pre-commit tool (lefthook, pre-commit.com, simple-git-hooks), ask the user whether to replace or skip — don't blindly overwrite
