# Post-Modification Checklist: `as` to `satisfies` Refactor

Compilation passing is necessary but not sufficient. Before committing:

## 1. Run the test suite

```bash
npm test        # or bun test / vitest / jest
```

`satisfies` validates the type at the expression level without widening or narrowing -- meaning runtime values that previously relied on `as` assertions (which silence the compiler) may now behave differently if the inferred type changed. Tests catch this.

## 2. Verify runtime behavior

The key semantic difference:
- `as` **overrides** the inferred type (can hide bugs).
- `satisfies` **checks** the value conforms but **preserves the narrower inferred type**.

This means downstream code that consumed the widened type from `as` might now receive a narrower type. Check call sites for:
- Property access that relied on the wider type
- Discriminated unions where the narrower literal type changes control flow
- Serialization / API boundaries where the shape matters at runtime

## 3. Search for downstream type errors

```bash
tsc --noEmit    # full project type-check, not just auth.ts
```

A file can compile in isolation but break consumers that import from it, since the exported type signature may have changed.

## 4. Review the diff

```bash
git diff auth.ts
```

Confirm each replacement is 1:1 and no `as` casts were left behind that should also be `satisfies`. Look for accidental changes (removed lines, reordering).

## 5. Lint

```bash
npm run lint    # eslint / biome
```

Ensure no new lint warnings were introduced.

## Summary

| Step | Why |
|---|---|
| `tsc --noEmit` (full project) | Catch type breakage in consumers |
| Run tests | Catch runtime behavioral changes |
| Review diff | Confirm mechanical correctness |
| Lint | No new warnings |
