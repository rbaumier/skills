# Grade — coding-standards eval 13 (iter1)

Grader STRICT. Code judged vs assertions only.

| id | verdict | citation / why |
|----|---------|----------------|
| loc-inline-single-use | PASS | All three single-use helpers inlined into `signupUser()`: email validation (lines 28-34: `const emailPattern = /^[^@]+@[^@]+\.[^@]+$/;` + throw), password hash (lines 36-42: `crypto.pbkdf2Sync(...)` + `hashedWithSalt`), welcome message (line 45: `const welcome = ...`). Original utils files explicitly deleted per "Rules Applied" lines 63-65 (`Deleted src/utils/email-validator.ts`, `welcome-formatter.ts`, `password-hasher.ts`). File structure (lines 5-6) lists only `signup-handler.ts`. |
| loc-workflow-first | PASS | The signup feature lives in exactly one file: `src/features/signup/signup-handler.ts` (file structure lines 5-6; sole contents at lines 11-56). Not scattered across 4+ files. |
| loc-no-new-shared-primitives | PASS | No new `shared/*.ts`, `utils/*.ts`, or `helpers/*.ts` files created — only the single feature file exists (lines 5-6). No extracted Result type or `withTimeout` primitive; all logic inlined into the caller (lines 28-45). |

**Total: 3/3 PASS**
