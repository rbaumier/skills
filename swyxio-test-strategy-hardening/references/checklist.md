# Test Strategy Hardening Checklist

## Inventory

- Commands: unit, typecheck, build, e2e, visual, smoke, coverage.
- Runtime: cold and warm time for each suite.
- Flake/skips: skipped tests, retries, sleeps, network dependencies, date/randomness.
- Fixtures: size, ownership, determinism, hidden coupling.
- Mocks: where they replace real contracts and where they hide risk.

## High-Value Coverage

- API request/response contracts.
- Provider parsing and retry behavior.
- State/schema migrations and compatibility normalizers.
- Auth/permissions and role boundaries.
- Critical create/edit/delete flows.
- Error, empty, loading, cancel, timeout, and retry states.
- Browser viewport journeys for mobile/desktop/tablet/wide when UI matters.

## Dedupe/Removal Signals

- Multiple tests assert the same text or button presence without proving different behavior.
- Snapshot churn dominates failures.
- Tests duplicate framework behavior.
- Tests only assert implementation shape and would pass during user-visible breakage.
- Test setup is longer than the behavior under test without a good reason.

## Output

- Keep / rewrite / delete / quarantine list.
- New suite map and commands.
- Before/after runtime.
- Remaining blind spots.
