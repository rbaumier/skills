# Project Plan Review

Reviewed against the **coding-standards** skill. Each point maps to a specific rule violation.

---

## 1. "Write all features first, add tests later"

**Verdict: Wrong.**

**Violated rule:** *"Start projects with tests, linting, CI/CD, monitoring from day 1 — constraints upfront are cheaper than retrofitting."*

Tests written after the fact verify what code *does*, not what it *should do*. You lose the design pressure that TDD provides — smaller functions, clearer interfaces, fewer side effects. Retrofitting tests onto untested code is 3-10x more expensive because you must reverse-engineer intent and untangle coupled logic. "Later" almost always means "never" or "partially."

**Fix:** Write tests alongside features from day 1. Use TDD: failing test, minimal implementation, refactor.

---

## 2. "Permissive input validation — tighten later if abused"

**Verdict: Wrong.**

**Violated rule:** *"Constrain first, relax later — strict API schemas (whitelist > blacklist), least privilege, low quotas; relaxing is backward-compatible."* Also: *"Bound every input: minLength, maxLength, format, allowed characters on every parameter; rate-limit exposed operations."* And the core philosophy: *"Parse, Don't Validate — parse into trusted types at the boundary; never just 'check' data."*

Permissive-first is backward. Tightening validation later is a **breaking change** — existing clients that relied on loose rules will break. Strict-first is backward-compatible: you can always relax constraints without breaking anyone. Permissive input is also a security liability (injection, overflow, abuse) from the moment it ships.

**Fix:** Define strict schemas (Zod, etc.) for every endpoint input on day 1. Parse into branded/nominal types at the boundary. Whitelist allowed values, set max lengths, rate-limit.

---

## 3. "Express and Fastify coexist during migration"

**Verdict: Wrong.**

**Violated rule:** *"Prefer codebase homogeneity over partial migration — migrate all-at-once or not at all."*

Two frameworks means two sets of middleware, two error-handling patterns, two plugin ecosystems, two mental models. Every developer must know both. Bugs hide at the seams between them. Partial migrations tend to stall — the "old" framework never fully goes away, and you maintain double the complexity indefinitely.

**Fix:** Pick one framework and migrate all-at-once. If Fastify is the target, dedicate a sprint to a complete cutover. If the migration can't be done atomically, don't start it.

---

## 4. "No linter yet — add one when the codebase is bigger"

**Verdict: Wrong.**

**Violated rule:** *"Start projects with tests, linting, CI/CD, monitoring from day 1 — constraints upfront are cheaper than retrofitting."* Also: *"Enforce conventions via automation (linter, CI, hook) — unenforced = wishes."* And: *"Choose intentionally limited tools to prevent bad practices — structural guardrails over human discipline."*

A linter on day 1 costs 15 minutes to configure. A linter retrofitted onto a 50k-line codebase costs days of fixing violations and arguing about which rules to enable. Without a linter, every developer invents their own style. Code reviews devolve into style debates instead of logic reviews. Inconsistency compounds silently.

**Fix:** Configure ESLint + typescript-eslint + Prettier before writing the first feature. Add it to CI as a blocking check. Use `strict` and `stylistic` presets. This is a 15-minute task on day 1 vs. a multi-day task later.

---

## 5. "Use `latest` for npm packages"

**Verdict: Wrong.**

**Violated rule:** *"Pin all dependency/image/package versions — never use `latest`."*

`latest` means your build is non-deterministic. The same commit can produce different artifacts on different days. A patch release with a bug or breaking change silently enters your production build. You cannot reproduce a past build. You cannot bisect regressions. This is one of the most dangerous practices in software engineering.

**Fix:** Pin exact versions in `package.json` (no `^`, no `~`, no `latest`). Use a lockfile (`bun.lock`, `package-lock.json`). Run dependency updates deliberately via `npm outdated` or Renovate/Dependabot, with CI validating each upgrade.

---

## 6. "Add backward compatibility layers for old clients"

**Verdict: Wrong.**

**Violated rule:** *"Use a hard cutover approach and never implement backward compatibility."*

Backward compatibility layers are permanent baggage. They accumulate: v1 compat + v2 compat + v3 compat. Each layer increases the combinatorial testing surface, complicates every future change, and slows development. The "temporary" compat layer becomes the most permanent code in the system. You end up maintaining ghost APIs that nobody audits.

**Fix:** Version your API. When a breaking change ships, do a hard cutover: deprecation notice with a deadline, then remove. Coordinate with clients. The short-term pain of a hard cutover is vastly cheaper than the long-term drag of compat layers.

---

## Summary

| # | Plan Item | Verdict | Core Issue |
|---|-----------|---------|------------|
| 1 | Tests later | **Reject** | Constraints upfront are cheaper than retrofitting |
| 2 | Permissive validation | **Reject** | Constrain first, relax later; parse don't validate |
| 3 | Express + Fastify coexist | **Reject** | Homogeneity over partial migration |
| 4 | Linter later | **Reject** | Day-1 tooling; unenforced rules are wishes |
| 5 | `latest` versions | **Reject** | Pin all versions; deterministic builds |
| 6 | Backward compat layers | **Reject** | Hard cutover; no backward compatibility |

**All 6 points violate explicit rules from the coding standards.** Every item follows the same anti-pattern: *"we'll do the right thing later."* The skill's stance is clear — constraints, strictness, and tooling are cheaper on day 1 and more expensive every day you delay.
