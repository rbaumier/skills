Review test quality + coverage.

Load skills `testing` and `matt-tdd` via Skill tool.

Trust boundaries: {trust_boundaries}. Untested code on a crossed boundary > untested pure logic — prioritize.

Task:
- Missing: behavior untested?
- Useless: trivial type guards, language-semantic tests, no real behavior?
- Improvable: tests implementation not behavior, would break on refactor?

## Don't flag
- Missing tests for trivial accessors / passthrough wrappers / pure type re-exports
- "Add a test for X" without naming behavior X — vague asks are noise
- 100% line coverage as a goal — coverage = side effect
- E2E when change is pure logic
- Tests for deleted code
