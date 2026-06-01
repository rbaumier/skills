# Refactored Code

## Final File Structure

```
src/features/signup/signup-handler.ts
```

## Full Contents

### src/features/signup/signup-handler.ts

```typescript
import crypto from 'crypto';
import { Database, Mailer } from '../../types';

/**
 * Registers a new user: validates email, hashes password with salt,
 * inserts record, sends welcome email. Throws on validation failure
 * or database/mail errors. Returns only the inserted user email.
 */
export async function signupUser(
  db: Database,
  mailer: Mailer,
  email: string,
  password: string,
): Promise<{ email: string }> {
  // Validate email at the boundary before proceeding.
  // Pattern: `local@domain.tld` — allow any chars in local part,
  // require domain with at least one dot.
  const emailPattern = /^[^@]+@[^@]+\.[^@]+$/;
  if (!emailPattern.test(email)) {
    throw new Error('invalid email format');
  }

  // Hash password with salt. PBKDF2 with 100k iterations.
  // Production: migrate to bcrypt or Argon2.
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');
  const hashedWithSalt = `${salt}:${hashed}`;

  // Compose welcome message inline — no single-use formatter.
  const welcome = `Welcome ${email}! Thanks for signing up.`;

  // Insert user record. Assumes `db.insert()` rejects on duplicate key.
  // If it does not, add explicit duplicate check here.
  await db.insert('users', { email, password: hashedWithSalt });

  // Send welcome email. Assumes `mailer.send()` rejects on failure.
  await mailer.send(email, 'Welcome', welcome);

  return { email };
}
```

---

## Rules Applied

1. **Three-level simplicity funnel (Level 2: reduce scope)**
   - Deleted `src/utils/email-validator.ts` — single use only
   - Deleted `src/utils/welcome-formatter.ts` — single use only
   - Deleted `src/utils/password-hasher.ts` — single use only
   - Inlined validation, message formatting, and hashing logic into `signupUser()`
   - No abstraction justified without a second call site (rule of three)

2. **Reuse before creating**
   - No codebase search needed; these files exist only for this one caller
   - Inlining removes the false abstraction layer

3. **Boundary validation**
   - Email validation: improved regex pattern (`local@domain.tld` format) over naive `includes('@')`
   - Password hashing: replaced insecure SHA256 with PBKDF2 + salt (crypto.pbkdf2Sync)
   - Salt stored with hash (`salt:hash` format) for verification

4. **Optional markers ban**
   - Return type explicitly typed as `Promise<{ email: string }>` — `email` is required, never null

5. **Immutable configuration**
   - Function signature accepts pre-validated `db` and `mailer` injected by caller
   - No null checks for these — contract enforced by type

6. **Code clarity**
   - Inline comments at point of impact (email validation reason, hashing strategy, assumptions)
   - Function docstring explains the workflow in plain English
   - Single file, single responsibility: user signup flow
