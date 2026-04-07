# With Skill - Run 1

## Output

Now I have the skill rules internalized and the prompt. Let me analyze and fix all issues.

Here is the fixed code:

```typescript
// auth.ts - Server config
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";
import { organization } from "better-auth/plugins/organization";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

export const auth = betterAuth({
  database: drizzleAdapter(db, { usePlural: true }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  secondaryStorage: redis,
  session: {
    storeSessionInDatabase: true,
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: {
      maxAge: 60 * 5,
    },
  },
  user: {
    modelName: "user",
    additionalFields: {
      role: { type: "string", defaultValue: "user", required: false },
      department: { type: "string", required: false },
    },
  },
  plugins: [
    twoFactor(),
    organization(),
  ],
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Must implement: send verification email to user.email with url
    },
  },
  advanced: {
    useSecureCookies: true,
  },
});

// Session type - use inferred types from auth instance
type Session = typeof auth.$Infer.Session;

// client.ts
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/plugins/two-factor";
import { organizationClient } from "better-auth/plugins/organization";

export const authClient = createAuthClient<typeof auth>({
  baseURL: "https://myapp.com",
  plugins: [
    twoFactorClient(),
    organizationClient(),
  ],
  onAPIError: (error) => {
    // Handle auth errors globally (expired sessions, rate limits, etc.)
  },
});

// middleware.ts (Next.js)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { headers } from "next/headers";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};

// mobile.ts (React Native / Expo)
import { createAuthClient } from "@better-auth/expo";
import { expoClient } from "@better-auth/expo";

export const mobileAuth = createAuthClient<typeof auth>({
  baseURL: "https://api.myapp.com",
  plugins: [
    expoClient(),
  ],
});
```

**Issues fixed (12):**

1. **Hardcoded secret** -- Removed `secret: "my-super-secret-key"`. Must use `BETTER_AUTH_SECRET` env var (min 32 chars). The original was both insecure and too short.

2. **Hardcoded baseURL** -- Removed `baseURL: "https://myapp.com"` from server config. Must use `BETTER_AUTH_URL` env var instead.

3. **Plugin imports from barrel** -- Changed `from "better-auth/plugins"` to dedicated paths `"better-auth/plugins/two-factor"` and `"better-auth/plugins/organization"` for proper tree-shaking.

4. **Drizzle adapter missing `usePlural`** -- Added `usePlural: true` to `drizzleAdapter(db, { usePlural: true })` since table is likely `users` not `user`. Without this, silent auth failures occur.

5. **Model name vs table name** -- Changed `user.modelName: "users"` to `"user"`. Config uses ORM model name, not the DB table name.

6. **Account linking without trusted providers** -- Added `trustedProviders: ["google"]` to prevent malicious OAuth apps from hijacking accounts via unverified email claims.

7. **Secondary storage without DB persistence** -- Added `session.storeSessionInDatabase: true`. When `secondaryStorage` is defined, sessions only go to Redis by default; without this flag, sessions are lost if Redis is flushed.

8. **Rate limit using memory with secondary storage available** -- Changed `rateLimit.storage` from `"memory"` to `"secondary-storage"`. Memory storage is lost on restart and not shared across instances; Redis is already configured.

9. **CSRF check disabled** -- Removed `disableCSRFCheck: true` (security risk). Added `useSecureCookies: true` instead for HTTPS cookie enforcement.

10. **Separate profiles table for simple fields** -- Eliminated the `profiles` table entirely. Used `user.additionalFields` for `role` and `department` instead, which adds them directly to the user table. The skill explicitly says: "Do NOT create a separate profile table for simple fields -- use additionalFields first."

11. **Empty emailVerification config** -- Added `sendOnSignUp: true` and a `sendVerificationEmail` handler stub. Without `sendVerificationEmail` defined, verification does not work.

12. **Manually typed Session** -- Replaced hand-written `Session` type with `typeof auth.$Infer.Session` which includes plugin fields (organization, 2FA) automatically.

13. **Client missing type parameter and plugins** -- Added `<typeof auth>` generic, client-side plugins for twoFactor and organization, and `onAPIError` handler for global error handling.

14. **Client baseURL pointing to full auth path** -- Changed from `"https://myapp.com/api/auth"` to `"https://myapp.com"`. The client appends the basePath automatically.

15. **Middleware missing request headers** -- Added `headers: request.headers` to `getSession()` call. Without forwarding headers, `getSession` returns null in Next.js middleware.

16. **Middleware matcher too broad** -- Changed from `"/(.*)"`  (catches everything including login page and static assets) to a negative lookahead pattern excluding public routes and static assets.

17. **Mobile client using cookie-based auth** -- Replaced `better-auth/react` import with `@better-auth/expo` and added `expoClient()` plugin which uses `expo-secure-store` instead of cookies. Cookie-based auth must never be used on mobile.