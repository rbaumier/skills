# QA Report — <feature / target>

**Target:** <URL / base API / command>
**Environment:** <local / test> — confirmed non-production: <how>
**Allowlist:** <hosts/paths the agents were permitted to touch>
**Surfaces tested:** <UI / API / CLI / TUI / other>
**Run dir:** <absolute path to qa-run-<id>/> (Evidence paths below are relative to its `evidence/`)
**Date:** <date>
**Status:** COMPLETE | PARTIAL (BLOCKED rows or expired time budget)

## Verdict

**GO / GO-PROVISIONAL / NO-GO** —
- NO-GO if any open Critical or High finding.
- GO only when status is COMPLETE with zero BLOCKED rows and no open Critical/High.
- GO-PROVISIONAL otherwise (PARTIAL / any BLOCKED row) — name what went unverified.

Reservations (Medium/Low findings, BLOCKED rows):
- <reservation, or "none">

## Coverage matrix

Every row has a verdict and an evidence path verified on disk. PARTIAL runs:
untested rows are marked BLOCKED with a reason, never left `UNTESTED`.

| # | Surface | Entry point | Use case | Verdict | Evidence |
|---|---------|-------------|----------|---------|----------|
| 1 | UI | /login | valid credentials | PASS | row-1-login-ok.png |
| 2 | UI | /login | empty password | FAIL | row-2-login-empty.png |
| 3 | API | POST /users | missing email → 400 | PASS | row-3-users-400.txt |
| 4 | API | POST /users | forged token | BLOCKED | could not obtain token |

Legend: **PASS** observed promised behavior · **FAIL** observed deviation ·
**BLOCKED** could not test (reason in Evidence).

## Findings

Sorted by severity. Each FAIL row above maps to a finding here; each has evidence
on disk.

### F1 — <title> — Critical | High | Medium | Low

- **Surface / location:** <URL / endpoint / command>
- **Steps to reproduce:** <1, 2, 3>
- **Expected:** <…>
- **Actual:** <…>
- **Evidence:** <path under evidence/>

## Test mutations

Every write made during testing (records created, files written, mutating
requests), merged from both agents:

- <mutation, or "none — read-only run">

## Testing notes

- What was covered, what was not, blockers, whether a time budget cut the run
  short.
