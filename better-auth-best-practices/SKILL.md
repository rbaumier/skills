---
name: better-auth-best-practices
description: Skill for integrating Better Auth - the comprehensive TypeScript authentication framework.
---

# Better Auth Integration Guide

**Always consult [better-auth.com/docs](https://better-auth.com/docs) for code examples and latest API.**

Better Auth is a TypeScript-first, framework-agnostic auth framework supporting email/password, OAuth, magic links, passkeys, and more via plugins.

---

## Quick Reference

### Environment Variables
- `BETTER_AUTH_SECRET` - Encryption secret (min 32 chars). Generate: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - Base URL (e.g., `https://example.com`)

Only define `baseURL`/`secret` in config if env vars are NOT set.

### File Location
CLI looks for `auth.ts` in: `./`, `./lib`, `./utils`, or under `./src`. Use `--config` for custom path.

### CLI Commands
- `npx @better-auth/cli@latest migrate` - Apply schema (built-in adapter)
- `npx @better-auth/cli@latest generate` - Generate schema for Prisma/Drizzle
- `npx @better-auth/cli mcp --cursor` - Add MCP to AI tools

**Re-run after adding/changing plugins.**

---

## Core Config Options

| Option | Notes |
|--------|-------|
| `appName` | Optional display name |
| `baseURL` | Only if `BETTER_AUTH_URL` not set |
| `basePath` | Default `/api/auth`. Set `/` for root. |
| `secret` | Only if `BETTER_AUTH_SECRET` not set |
| `database` | Required for most features. See adapters docs. |
| `secondaryStorage` | Redis/KV for sessions & rate limits |
| `emailAndPassword` | `{ enabled: true }` to activate |
| `socialProviders` | `{ google: { clientId, clientSecret }, ... }` |
| `plugins` | Array of plugins |
| `trustedOrigins` | CSRF whitelist |

---

## Database

**Direct connections:** Pass `pg.Pool`, `mysql2` pool, `better-sqlite3`, or `bun:sqlite` instance.

**ORM adapters:** Import from `better-auth/adapters/drizzle`, `better-auth/adapters/prisma`, `better-auth/adapters/mongodb`.

**Critical:** Better Auth uses adapter model names, NOT underlying table names. If Prisma model is `User` mapping to table `users`, use `modelName: "user"` (Prisma reference), not `"users"`.

**Drizzle adapter column mapping gotcha**: When using Drizzle adapter with custom column names (snake_case), you MUST provide `usePlural` and field mappings: `drizzleAdapter(db, { usePlural: true })` if your table is `users` not `user`. Map additional fields: `user: { fields: { emailVerified: 'email_verified' } }`. Mismatch = silent auth failures.

---

## Session Management

**Storage priority:**
1. If `secondaryStorage` defined → sessions go there (not DB)
2. Set `session.storeSessionInDatabase: true` to also persist to DB
3. No database + `cookieCache` → fully stateless mode

**Cookie cache strategies:**
- `compact` (default) - Base64url + HMAC. Smallest.
- `jwt` - Standard JWT. Readable but signed.
- `jwe` - Encrypted. Maximum security.

**Key options:** `session.expiresIn` (default 7 days), `session.updateAge` (refresh interval), `session.cookieCache.maxAge`, `session.cookieCache.version` (change to invalidate all sessions).

---

## User & Account Config

**User:** `user.modelName`, `user.fields` (column mapping), `user.additionalFields`, `user.changeEmail.enabled` (disabled by default), `user.deleteUser.enabled` (disabled by default).

**`additionalFields` for custom user data**: Define custom fields on the user model via `user.additionalFields: { role: { type: 'string', defaultValue: 'user', required: false } }`. These fields are added to the user table and available in `session.user`. Do NOT create a separate profile table for simple fields — use additionalFields first.

**Account:** `account.modelName`, `account.accountLinking.enabled`, `account.storeAccountCookie` (for stateless OAuth).

**Required for registration:** `email` and `name` fields.

---

## Email Flows

- `emailVerification.sendVerificationEmail` - Must be defined for verification to work
- `emailVerification.sendOnSignUp` / `sendOnSignIn` - Auto-send triggers
- `emailAndPassword.sendResetPassword` - Password reset email handler

---

## Security

**In `advanced`:**
- `useSecureCookies` - Force HTTPS cookies
- `disableCSRFCheck` - ⚠️ Security risk
- `disableOriginCheck` - ⚠️ Security risk  
- `crossSubDomainCookies.enabled` - Share cookies across subdomains
- `ipAddress.ipAddressHeaders` - Custom IP headers for proxies
- `database.generateId` - Custom ID generation or `"serial"`/`"uuid"`/`false`

**Account linking — silent vs explicit**: `account.accountLinking.enabled: true` auto-links accounts with the same verified email. Set `account.accountLinking.trustedProviders: ['google', 'github']` to control which providers can auto-link. Unverified email providers should NOT be trusted — a malicious OAuth app could hijack accounts by claiming any email.

**Rate limiting:** `rateLimit.enabled`, `rateLimit.window`, `rateLimit.max`, `rateLimit.storage` ("memory" | "database" | "secondary-storage").

---

## Hooks

**Endpoint hooks:** `hooks.before` / `hooks.after` - Array of `{ matcher, handler }`. Use `createAuthMiddleware`. Access `ctx.path`, `ctx.context.returned` (after), `ctx.context.session`.

**Next.js middleware for route protection**: Use `getSession` in `middleware.ts` with `headers: nextHeaders()` to check auth. Return `NextResponse.redirect('/login')` for unauthenticated users. Set `matcher` to exclude public routes and static assets. NEVER call `getSession` without forwarding the request headers — it returns null in middleware without them.

**Database hooks:** `databaseHooks.user.create.before/after`, same for `session`, `account`. Useful for adding default values or post-creation actions.

**Hook context (`ctx.context`):** `session`, `secret`, `authCookies`, `password.hash()`/`verify()`, `adapter`, `internalAdapter`, `generateId()`, `tables`, `baseURL`.

---

## Plugins

**Import from dedicated paths for tree-shaking:**
```
import { twoFactor } from "better-auth/plugins/two-factor"
```
NOT `from "better-auth/plugins"`.

**Popular plugins:** `twoFactor`, `organization`, `passkey`, `magicLink`, `emailOtp`, `username`, `phoneNumber`, `admin`, `apiKey`, `bearer`, `jwt`, `multiSession`, `sso`, `oauthProvider`, `oidcProvider`, `openAPI`, `genericOAuth`.

**Organization plugin roles and permissions**: When using `organization()` plugin, define custom roles: `organization({ roles: { admin: ['invite', 'remove', 'update'], member: ['read'] } })`. Access control via `organization.checkPermission({ permission: 'invite' })`. Default roles: 'owner', 'admin', 'member'. Invitation flow: `organization.inviteMember({ email, role, organizationId })`.

**Two-factor setup flow**: 1) Enable plugin: `twoFactor()`. 2) Generate TOTP secret: `auth.twoFactor.enable({ password })`. 3) Show QR code from returned `totpURI`. 4) Verify with code: `auth.twoFactor.verifyTotp({ code })`. 5) Store backup codes returned from enable. On login: `signIn.email()` returns `twoFactorRedirect: true` — app must then show 2FA input and call `twoFactor.verifyTotp()`.

Client plugins go in `createAuthClient({ plugins: [...] })`.

---

## Client

Import from: `better-auth/client` (vanilla), `better-auth/react`, `better-auth/vue`, `better-auth/svelte`, `better-auth/solid`.

Key methods: `signUp.email()`, `signIn.email()`, `signIn.social()`, `signOut()`, `useSession()`, `getSession()`, `revokeSession()`, `revokeSessions()`.

**Nuxt integration pattern**: Use `defineNuxtPlugin` to provide the auth client. Server-side: `useRuntimeConfig()` for secrets, `getCookie(event)` to forward cookies in SSR. Client: `useBetterAuth()` composable. Configure `fetchOptions` with credentials: 'include' for cross-origin.

**Expo/React Native integration**: Import from `@better-auth/expo`. Use `expoClient()` plugin which uses `expo-secure-store` instead of cookies. Configure `storage` option. API calls need explicit `baseURL` pointing to your backend. NEVER use cookie-based auth on mobile — use the Expo client plugin.

**`onAPIError` client callback**: Configure `createAuthClient({ onAPIError: (error) => { ... } })` to handle auth errors globally (expired sessions, rate limits, network errors). Without it, each component must handle auth errors independently, leading to inconsistent UX.

---

## Type Safety

Infer types: `typeof auth.$Infer.Session`, `typeof auth.$Infer.Session.user`.

For separate client/server projects: `createAuthClient<typeof auth>()`.

**Session data extension for plugins**: Plugins like `organization` and `twoFactor` add fields to the session. Type them correctly: `typeof auth.$Infer.Session` includes plugin fields. Access via `session.session.activeOrganizationId` (organization plugin) or `session.user.twoFactorEnabled` (2FA plugin). These fields are NOT in the base Session type — you need the inferred type.

---

## Feature Selection Decision Tree

> Use this to decide which features/plugins to enable. Start from your use case,
> follow the arrows. Don't enable what you don't need — each plugin adds schema tables.

```
START: What does your app need?
│
├─ Basic login (email/password)?
│  → emailAndPassword: { enabled: true }  (built-in, no plugin)
│  │
│  ├─ Need email verification? → emailVerification.sendOnSignUp: true
│  └─ Need password reset?     → emailAndPassword.sendResetPassword: (handler)
│
├─ Social login (Google, GitHub, etc.)?
│  → socialProviders: { google: {...} }  (built-in, no plugin)
│  └─ Need to link social + email accounts? → account.accountLinking.enabled: true
│
├─ Passwordless?
│  ├─ Modern browsers/devices → passkey() plugin (WebAuthn)
│  ├─ Email-first users       → magicLink() plugin
│  └─ Phone-first users       → phoneNumber() plugin + SMS provider
│
├─ Enhanced security?
│  ├─ 2FA/MFA                 → twoFactor() plugin (TOTP, SMS, backup codes)
│  └─ Rate limiting            → rateLimit: { enabled: true } (built-in)
│
├─ Multi-tenant / teams?
│  → organization() plugin (roles, invites, teams)
│
├─ API access (machine-to-machine)?
│  → apiKey() plugin or bearer() plugin
│
└─ SSO / Enterprise?
   → sso() plugin or oidcProvider() plugin
```

## Auth Method Selection Guide

| Use Case | Recommended Method | Why |
|----------|-------------------|-----|
| Standard web app | Email/password + OAuth | Covers most users, low friction |
| Consumer mobile app | OAuth + Passkeys | Minimal typing, biometric support |
| Internal/enterprise tool | SSO + Email/password fallback | Integrates with corporate IdP |
| Developer platform | API keys + OAuth | Machine + human access patterns |
| High-security (banking, health) | Email/password + 2FA + Passkeys | Defense in depth |
| Quick MVP | OAuth only (Google/GitHub) | Zero password management, ship fast |
| Email newsletter / low-friction | Magic Link | No password to remember |

**Combining methods:** Add methods progressively. Start with the simplest that covers your users,
add more as you grow. Each method = more schema tables + more UI surface to maintain.

## Migration Patterns

> When adding Better Auth to an existing project or adding/changing plugins.

```bash
# Step 1: Generate schema migrations (works with Prisma, Drizzle, or raw SQL)
npx @better-auth/cli generate

# Step 2: Review generated migration files before applying
# Step 3: Apply with your ORM's migration tool:
#   Prisma:  npx prisma migrate dev
#   Drizzle: npx drizzle-kit push
#   Kysely:  npx @better-auth/cli migrate  (built-in adapter only)
```

**Critical migration rules:**
- **Always re-run `generate` after adding/removing plugins** — each plugin adds tables (e.g., `twoFactor` adds `twoFactor` table, `organization` adds `organization`, `member`, `invitation`)
- **Review before applying** — generated migrations may conflict with existing tables
- **Back up your database** before applying in production
- **Test the full auth flow** after migration — broken schema = locked-out users

## Common Gotchas

1. **Model vs table name** - Config uses ORM model name, not DB table name
2. **Plugin schema** - Re-run CLI after adding plugins
3. **Secondary storage** - Sessions go there by default, not DB
4. **Cookie cache** - Custom session fields NOT cached, always re-fetched
5. **Stateless mode** - No DB = session in cookie only, logout on cache expiry
6. **Change email flow** - Sends to current email first, then new email

---

## Resources

- [Docs](https://better-auth.com/docs)
- [Options Reference](https://better-auth.com/docs/reference/options)
- [LLMs.txt](https://better-auth.com/llms.txt)
- [GitHub](https://github.com/better-auth/better-auth)
- [Init Options Source](https://github.com/better-auth/better-auth/blob/main/packages/core/src/types/init-options.ts)