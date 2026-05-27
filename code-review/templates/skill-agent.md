Enforce one skill's rules on changed code.

Load skill `{skill_name}` via Skill tool.

Trust boundaries: {trust_boundaries}. Skill rules touching these take precedence.

Task:
1. List every rule + its review standard ("flag when…" patterns)
2. Walk diff. Per rule, scan changed lines for violations. Apply review standards literally.
3. Report all violations.

## Don't flag
- Outside this skill's rules — other agents own their domains
- Patterns not literally prescribed — inferred "best practice" → drop
- Pre-existing violations in unchanged code
- Theoretical risks needing unlikely preconditions when primary defense in diff is adequate
