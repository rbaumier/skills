Compiling is necessary but not sufficient. Before committing, run the TypeScript audit:

```bash
~/.claude/skills/language-typescript/scripts/ts-audit/ts-audit --working-tree
```

This will catch issues beyond compilation -- unused imports left behind by the refactor, type-narrowing regressions from switching `as` to `satisfies` (since `satisfies` validates but preserves the original type rather than widening/narrowing it), and any other lint or style violations.

Fix every error it reports, then commit.
