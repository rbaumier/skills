# Fix report — testing skill, weak executor (Haiku)

Failures addressed: eval1 (14/19) fails = [vi-hoisted, specific-matchers, factories-not-fixtures, role-selectors, page-object-model]; eval3 (8/9) fail = [test-pyramid-ratio]. eval2 = 4/4 (untouched).

Classification key: **R** reinforce rule in SKILL.md · **V** add value/why · **A** fix assertion description · **F** retarget/retire assertion.

| Eval | Assertion | Class | Why | Action |
|------|-----------|-------|-----|--------|
| e1 | vi-hoisted | R | Real trap; Haiku kept `const mockDb = vi.fn()` above `vi.mock()`. Rule existed only as a terse one-line gotcha, no worked fix. | Expanded the Gotchas bullet with bad/good `vi.hoisted()` before-after + review trigger. |
| e1 | specific-matchers | R | Real trap; Haiku kept `expect(updated).toBeTruthy()`. Rule was a 5-word one-liner with no example. | Expanded Strategy line with why `toBeTruthy` proves nothing + concrete matcher replacements + review trigger. |
| e1 | factories-not-fixtures | R | Real trap; Haiku kept inline literals. Rule was "Factories over fixtures." with no factory example to imitate. | Added a `makeUser(overrides)` factory example incarnating the fix + review trigger. |
| e1 | role-selectors | R | Real trap; Haiku "fixed" CSS by swapping to `[data-testid]` and even kept raw `#name`. Skill said getByRole/getByLabel but never ranked data-testid as last-resort, no before-after. | Rewrote Selectors section: data-testid is last resort, bad/good getByRole/getByLabel examples + review trigger. |
| e1 | page-object-model | F | Structural/multi-file: a full PO class is awkward to produce and grade strictly inside an "output fixed code only" single-block answer. The underlying rule (no duplicated inline selectors) is valuable and IS single-file-achievable. | Retargeted assertion `page-object-model` -> `no-repeated-inline-selectors` (extract repeated selectors/actions into helpers OR a Page Object; single-file helpers count) in both `evals/evals.json` and `haiku-run/assertions-e1.json`. Reinforced SKILL.md POM section to state single-file named-helper extraction is the minimum valid form, with example. |
| e3 | test-pyramid-ratio | F | Mistargeted: the assertion's own trap says "should mention test pyramid *if advising on test strategy*", but the e3 prompt is "Fix all issues. Output fixed code only" — there is no advisory/prose surface, so awareness can't be expressed without violating the task. Grader correctly FAILed an unanswerable assertion. The pyramid rule itself is already strong in SKILL.md (Strategy line 51, with a review trigger) and is fairly tested in a review-style eval, not a code-only sweep. | Retired `test-pyramid-ratio` from eval3 in both `evals/evals.json` and `haiku-run/assertions-e3.json`. Skill rule left intact. |

## Counts
R = 4, V = 0, A = 0, F = 2.

## Notes
- No passing rule was weakened. SKILL.md edits only *expanded* existing rules (added bad/good examples + review triggers); no rule text was removed or relaxed.
- General over special-cased: the new examples teach the principle (hoisting, specific matchers, factories, accessible selectors, dedup of inline selectors), not the eval's literal strings.
- Assertion counts after edits: e1 = 19 (renamed, not dropped), e3 = 8 (pyramid removed), e2 = 4 (untouched).
- Files edited: `testing/SKILL.md`; `enforcing-skill-rules/evals/evals.json`; `enforcing-skill-rules/haiku-run/assertions-e1.json`; `enforcing-skill-rules/haiku-run/assertions-e3.json`. All JSON re-validated.
