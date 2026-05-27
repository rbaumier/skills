# Outer wrapper, line-anchored agents

Used by `code-review` Step 1 for Correctness, Skill, Tests, CLAUDE.md Compliance, Occam Razor, Subsystem. Read scaffold + role template in one parallel block, substitute `{role_specific}` with the role body, substitute other placeholders, pass as Agent's `prompt`. One pass. No verbatim retyping.

```
Read CLAUDE.md for conventions.

Read diff from {diff_file}, filtered to {file_list}. Read full files as needed.

## Read budget — hard cap

Max **8 file reads** for the whole review (incl. CLAUDE.md, diff, source files). Stop reading at 8 and report from what you have. Exploration past 8 = wasted tokens. Pick the files whose content you actually need to anchor a finding; skim the diff for the rest. Don't re-read the same file.

{role_specific}

## Context verification — drop the finding silently if any answer kills it

1. **Callers/callees** — validation/conversion/error-handling already done at call site or visible wrapper? Drop.
2. **Test context** — path segment exactly `tests`/`test`/`__tests__`/`spec`/`specs`/`fixtures`/`mocks`, OR filename `*_test.*`/`*.test.*`/`*.spec.*`/`test_*.py`/`*_spec.rb`, OR code inside `#[cfg(test)]`/`describe(`/`test(`/`it(`/`def test_`? Substring matches don't count (`src/prospecting/` is production). Test code: `.unwrap()`/`panic!`/missing validation normal — drop unless genuine logic bug.
3. **Intentional comments** — `// SAFETY:`/`// intentionally`/`// fallback`/`# noqa` *specifically* addresses the failure mode? Must be specific. `// SAFETY:` for unchecked-bounds does NOT silence a race on the same line.
4. **Diff is the fix** — added code resolves *this* failure mode, not just an adjacent one? `.unwrap()` → `?` resolves panic-on-None. `format!` → bind params resolves SQL injection, NOT missing tenant filter. Drop only if diff addresses your specific mode.
5. **Type tracing** — claimed type mismatch (`f64`/`i64`, `Option<T>`/`T`, `&str`/`String`): trace through diff. Conversion anywhere on path → types consistent → drop.

## Output

Zero findings → exactly `No findings.` (textual, not JSON).

Else: ONLY the JSON object. First char `{`, last char `}`. No preamble, no narration, no markdown fence. Reasoning lives in `analysis_chain`, nowhere else.

```json
{
  "findings": [
    {
      "file": "src/auth/session.rs",
      "line": 42,
      "severity": "bug",
      "confidence": "high",
      "signature": "src/auth/session.rs:42:unwrap-on-user-header",
      "title": "unwrap() on user-supplied header",
      "analysis_chain": [
        ".unwrap() on req.headers.get(\"X-Token\") — Option, missing header panics",
        "X-Token attacker-controlled",
        "no caller-site guard"
      ],
      "fix_prompt": "src/auth/session.rs:42 replace .unwrap() with .ok_or(AuthError::MissingToken)?. Add a test: POST /session without X-Token → 401, not 500."
    }
  ]
}
```

- `analysis_chain` — ≤3 bullets, ≤25 words each. Only reasoning channel. Doesn't survive re-read → hallucination, drop.
- `fix_prompt` — concrete line + concrete replacement. `bug`/`security`/`performance`/`error_handling` → append `Add a test: …`.
- `signature` — `<file>:<line>:<failure-mode-slug>`. Controlled-vocabulary slug when applicable (see `reference/output-format.md`).
- `confidence` — `high`/`medium`/`low`, independent of severity.
- `severity` — `bug`/`security`/`performance`/`error_handling`/`suggestion`.

## Silent checks (kept, fields dropped)

- Before emitting `bug`/`security`/`performance`/`error_handling`, grep tests. Already covered → drop.
- Only flag a file you've read in full this session. Inferred from diff slice → hallucination, don't emit.

{previous_findings_block}
```
