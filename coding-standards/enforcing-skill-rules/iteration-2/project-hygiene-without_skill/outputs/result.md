# Project Plan Review

## 1. "Write all features first, add tests later"

**Verdict: Wrong.** This is the single most common cause of projects that ship late, ship broken, or never ship.

- "Later" never comes. Once feature pressure builds, nobody prioritizes retroactive tests.
- Without tests you cannot refactor safely, so code quality degrades monotonically.
- Bugs found late cost 10-100x more to fix than bugs caught at write time.
- **Fix:** Write tests alongside features. At minimum, test the critical path of every endpoint before moving to the next feature. TDD is ideal; if not TDD, then "test same PR" is the floor.

## 2. "Permissive input validation, tighten later"

**Verdict: Wrong.** This is a security and data integrity time bomb.

- Malformed data enters your database. Cleaning it up later is exponentially harder than preventing it.
- You are exposing yourself to injection attacks, type coercion bugs, and denial-of-service from day one.
- Clients will build against the permissive contract. Tightening validation later becomes a breaking change.
- **Fix:** Validate strictly from the start. Use a schema validation library (Zod, TypeBox, or Fastify's built-in JSON Schema). Strict in, lenient out. This is not optional for a backend.

## 3. "Express and Fastify coexist during migration"

**Verdict: Acceptable, with caveats.** This is a pragmatic reality, not a problem per se.

- The risk is that it stays this way forever. Two frameworks means two middleware stacks, two error handling patterns, two plugin ecosystems, and doubled cognitive load.
- **Fix:** Define a hard deadline and a migration plan. Track which endpoints are on which framework. New endpoints go on Fastify only. Set a date by which Express is fully removed. Without a deadline, "migration" becomes permanent coexistence.

## 4. "No linter, we'll add one when the codebase is bigger"

**Verdict: Wrong.** The cost of adding a linter grows with codebase size. The cost of adding it on day one is near zero.

- Adding a linter to a large codebase produces hundreds or thousands of violations. You then face a painful choice: fix them all, disable rules, or add `eslint-disable` everywhere.
- Inconsistent style across the codebase makes onboarding slower and code review noisy.
- **Fix:** Add ESLint + Prettier (or Biome if you prefer speed) right now. It takes 10 minutes. Configure it once, enforce via pre-commit hook, never think about it again.

## 5. "Use `latest` for npm packages"

**Verdict: Wrong.** This is one of the most dangerous practices in the Node.js ecosystem.

- `latest` is not a version, it is a pointer that changes without your knowledge or consent. Your build can break tomorrow with zero code changes on your side.
- You lose reproducible builds. Two developers running `npm install` at different times get different dependencies.
- A single compromised or buggy upstream release breaks your production. This has happened many times (event-stream, colors, faker, etc.).
- **Fix:** Pin exact versions. Use a lockfile (`package-lock.json` or `bun.lock`). Run `npm outdated` or Renovate/Dependabot on a schedule to upgrade deliberately, with tests proving nothing broke.

## 6. "Add backward compatibility layers for old clients"

**Verdict: Correct instinct, wrong if unbounded.** Supporting old clients is good practice, but compatibility layers are code that must be maintained.

- Every compatibility shim is a liability: it must be tested, it can hide bugs, and it slows down development of the new API.
- Without a deprecation policy, you accumulate compatibility layers indefinitely. Eventually your codebase is more shim than product.
- **Fix:** Version your API from day one (`/v1/`, `/v2/`). Define a deprecation policy (e.g., "old versions supported for 6 months after successor ships"). Communicate timelines to clients. Remove dead versions on schedule.

---

## Summary

| # | Item | Verdict |
|---|------|---------|
| 1 | Tests later | Fix now. Write tests alongside features. |
| 2 | Permissive validation | Fix now. Validate strictly from day one. |
| 3 | Express + Fastify coexistence | Acceptable if you set a hard migration deadline. |
| 4 | No linter | Fix now. 10-minute setup, lifetime payoff. |
| 5 | `latest` versions | Fix now. Pin versions, use lockfile. |
| 6 | Backward compatibility layers | Good instinct, but version your API and set deprecation dates. |

Four of the six items need immediate correction. They share a common pattern: deferring hygiene to "later" when the cost of doing it now is low and the cost of doing it later is high. Technical debt has compound interest.
