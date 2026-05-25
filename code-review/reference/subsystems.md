# Subsystem detection reference

Diff touches a high-stakes subsystem → spawn the **subsystem-framed agent** alongside generic Correctness. Framing primes for domain failure modes a generic lens misses (double-charges, refund races, signature replay, cross-tenant leaks).

**File-set for subsystem detection** = unified Dogfood set (`"$DEFAULT_BRANCH"...HEAD` ∪ unstaged ∪ staged ∪ untracked). Else uncommitted auth/billing/schema edits silently bypass lenses.

**Pass the unified file-set to the agent**, not just the `"$DEFAULT_BRANCH"...HEAD` slice. Uncommitted files → the agent reads them directly. Replace `rtk proxy git diff "$DEFAULT_BRANCH"...HEAD -- {files}` in the subsystem prompt with `read current contents of {files} directly, and run \`git diff -- {files}\` for unstaged delta`.

Triggers are specific enough to avoid UI tokens / ARIA roles / job listings / generic "workspace" UI. A row fires only when ≥1 concrete signal is present. Path globs are recursive — `**/billing/**` matches `apps/api/src/billing/prices.ts` AND `billing/index.ts`.

A subsystem agent **adds to** (doesn't replace) Correctness. Use the **Subsystem Agent** template — not Skill Agent (which would try to load a non-existent skill).

| Trigger (recursive path globs, imports, or code patterns) | Subsystem agent | Failure modes it should hunt |
|---|---|---|
| files under `**/billing/**`, `**/payments/**`, `**/invoices/**`, `**/subscriptions/**`; OR imports of `stripe`, `@paddle/`, `@lemonsqueezy/`; OR code with `chargeAmount`, `refundAmount`, `idempotencyKey`, `invoice.*total` | **billing-subsystem** | double-charge, refund races, currency rounding, dispute flows, idempotency keys |
| files under `**/auth/**`, `**/session/**`; OR imports of `better-auth`, `next-auth`, `lucia`, `@clerk/`, `@auth/`; OR code with `signIn(`, `signUp(`, `getSession(`, `verifyJwt`, `bcrypt`, `argon2` | **auth-subsystem** | session fixation, token leak, replay, MFA bypass, account takeover |
| files under `**/migrations/**`, `**/drizzle/migrations/**`, `**/prisma/migrations/**`; OR `**/*.sql` schema files; OR Drizzle/Prisma `**/schema.ts` edits that alter columns | **schema-migration-subsystem** | forward + rollback safety, column-nullability flips, data loss, downtime |
| files with `webhook` anywhere in the path (`**/webhook*/**`, `**/*webhook*.ts`); OR code with `verifySignature`, `crypto.createHmac`, `crypto.timingSafeEqual` | **webhook-subsystem** | signature verification, replay protection, timing-attack-safe compare |
| files under `**/policies/**`, `**/permissions/**`, `**/rbac/**`; OR imports of `casl`, `@casl/`; OR code with `hasPermission(`, `canAccess(`, `authorize(`, `Policy.` | **rbac-subsystem** | privilege escalation, cross-role data leaks, policy drift |
| code that filters DB queries by `tenantId`, `organizationId`, or `workspaceId`; OR middleware that resolves a current tenant/org/workspace | **multi-tenant-subsystem** | cross-tenant leaks, missing tenant filters on shared tables |
| files under `**/cron/**`, `**/jobs/**`, `**/workers/**`; OR imports of `bullmq`, `bull`, `agenda`, `node-cron`, `@trigger.dev/`, `inngest`; OR code with `defineJob(`, `enqueue(`, `.cron(` | **cron-subsystem** | duplicate execution, missed runs, ordering, dead-letter handling |
