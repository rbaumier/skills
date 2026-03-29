# Real Backend Testing

## When NOT to Mock

- True end-to-end tests validating the full stack (UI + API + DB)
- Critical user flows: registration, payment, email verification
- Testing API contract changes with real server behavior
- Smoke tests against staging/production environments

## Test User Creation Pattern

Use unique timestamp-based emails to isolate test data:

```typescript
const timestamp = Date.now();
const testEmail = `test+${timestamp}@example.com`;
const testPassword = 'SecurePass123!';

// Register via API
await page.goto('/register');
await page.getByTestId('register-email-input').fill(testEmail);
await page.getByTestId('register-password-input').fill(testPassword);
await page.getByTestId('register-submit-button').click();
```

## Email Verification via Mailpit API

Poll Mailpit for the verification email:

```typescript
async function getVerificationLink(email: string, timeout = 30000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(`http://localhost:8025/api/v1/search?query=to:${email}`);
    const data = await res.json();
    if (data.messages?.length > 0) {
      const message = data.messages[0];
      const body = await fetch(`http://localhost:8025/api/v1/message/${message.ID}`);
      const detail = await body.json();
      const match = detail.Text?.match(/https?:\/\/[^\s]+verify[^\s]*/);
      if (match) return match[0];
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No verification email for ${email} within ${timeout}ms`);
}
```

## Database-Level Verification (CI Fallback)

When email infrastructure is unavailable, verify directly via SQL:

```typescript
import { Client } from 'pg';

async function verifyEmailDirectly(email: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`UPDATE users SET email_verified = true WHERE email = $1`, [email]);
  await client.end();
}
```

## Test Data Isolation

- Unique timestamps in emails prevent collisions across parallel runs
- Each test creates its own user/resources — no shared fixtures
- Clean up is optional when using unique identifiers (data naturally scoped)

## Dual Infrastructure

- **Local**: `docker-compose` with postgres, mailpit, API server
- **CI**: GitLab/GitHub services blocks for postgres, mailpit; built app as artifact

## localStorage Token Extraction

For direct API calls after UI login:

```typescript
const authData = await page.evaluate(() => {
  const data = window.localStorage.getItem("auth");
  return data ? JSON.parse(data) : null;
});

// Use token for direct API requests
const response = await fetch('http://localhost:3000/api/v1/resource', {
  headers: { Authorization: `Bearer ${authData.token}` },
});
```
