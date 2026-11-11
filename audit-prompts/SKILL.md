---
name: audit-prompts
description: Code-quality audit prompts (single source of truth audit, state machines, invariants, over-engineering, review). Use when the user asks for a code audit.
---

## Report only

- Report findings with file:line evidence. Don't change any code.

## Single source of truth

- Single source of truth audit
- Find every piece of state or data that has more than one source of truth and could drift out of sync. For each, show where it's written, where it's read, and how they could disagree.
- Find business rules, validation, and domain concepts implemented in more than one place. Flag where copies have drifted, and name the single source of truth each should come from.
- Find every place my app can disagree with itself.
- Find every business decision implemented in more than one place.
- Find every business rule implemented differently across entry points.
- Find every derived value that can outlive its source of truth.
- Find every place a value is stored twice and can drift apart.
- Find every database rule the code assumes but Postgres doesn't enforce.
- Find every rule the screens follow that no component actually enforces.
- Find every object in this codebase that's referenced without a stable, canonical ID.
- Find every magic number and hard-coded copy that should be a token or live in config.

## Single source of truth: prove

- Demonstrate a reachable contradiction between representations of the same information.
- Demonstrate divergent outcomes for identical inputs across entry points.
- Demonstrate a derived value becoming stale after its source changes.
- Demonstrate behavioral divergence or duplicated policy that can independently change.

## Unicorn hunts

- Find all the implicit transactions in my app.
- Find every impossible state my data model permits.
- Find all the implicit protocols between components.
- Find everything whose correctness depends on timing or execution order.
- Find every operation that is unsafe to retry.
- Find every contract my code assumes but never verifies.
- Find every trust boundary crossed without revalidating authority.
- Find every workflow that can become permanently stuck.
- Find every successful operation that can leave the system inconsistent.
- Find every change that requires modifying unrelated parts of the app.
- Find every important behavior that lacks an executable specification.
- Find every invariant my application relies on but does not enforce.
- Find all the implicit obligations in this contract.
- Find all tautologies.
- Find the dumb requirements.

## Follow-ups

- Find every place where the screen can show something false.
- Find every bit of business logic sitting in UI components that belongs in the domain layer.
- Find every async action that can run twice or race.
- Find every error that gets swallowed silently.
- Find every place where a type is looser than the data.
- Find every effect that could be an event handler or derived value.
- Find useEffect calls and evaluate their place by following the 'You Might Not Need an Effect' article.
- List every path where two components could get into an inconsistent state.
- List the failure modes of each component.
- What happens if a response arrives late?
- Check request IDs and cancellation logic together with the state.

## Whole-codebase sweeps

- Reverse-engineer my codebase: uncover hidden state machines, broken invariants, implicit contracts and bottlenecks. Stress-test failures, retries and concurrency. Prove what's broken, then find the smallest changes that eliminate entire classes of bugs and complexity.
- Find the recurring problems, duplicated logic and hidden complexity across my codebase. Then identify the smallest, most powerful higher-level abstraction that would make entire classes of these problems disappear by design, not just hide them behind another layer.
- Map this codebase for the next owner: an architecture doc, an onboarding guide, and a top-10 risk list. Every arrow and every risk cites file:line. Read-only: change nothing.
- Study commit history and sessions for this repo. Why are there so many regressions?
- What pattern in the codebase allowed this bug to exist? Bugs are consequences of design decisions that made the mistake easy.
- Show me (A) if we're doing things wrong, and (B) if we're doing the wrong things.
- If you were my worst enemy, how would you take me down?
- Red Team Engineer my code adversarially.
- Think about future scale: how does this hold up when the system is 10x bigger?

## State machines

- Find all of the implicit state machines in my app.
- Then ask it to write the transition table for each one and mark the transitions that are impossible but still reachable in the code.
- Ask where two of those machines touch the same data. That's almost always where the race lives.
- Which of these explain the bugs I've been calling flaky?
- Produce a concrete event sequence for each state it finds — distinguish states the code permits from states a user can actually reach.
- Cite the handlers and conditions behind each transition, and mark proposed changes separately.
- Label inferred transitions separately from observed ones, then propose tests for missing or invalid transitions.
- For each one, list: the states, how it moves between them, any impossible or conflicting combinations, and the risk level. Rank by risk. Don't change any code yet.
- What moves it on if nothing happens: a timeout, a sweeper, a retry?
- Find all non-terminal states in my state machine as a service.
- Find the hidden machines disagreeing about what 'done' means.
- Hand the state file to a model checker. Try every order of transitions and give the shortest path to each invalid state.
- A single loading flag, or framework-managed state with nothing layered on top, is not a finding.

## State machines: full prompts

- Find the app's explicit and implicit state machines and document their states, invariants, and transition tables in one file. Identify invalid states or transitions the code can actually reach, with evidence, including through retries and concurrency. Prioritize confirmed bugs by impact. Don't change any code.
- You are analyzing this codebase to find all **implicit state machines** — behavior controlled by distinct modes/states that are NOT declared as an explicit state machine, statechart, reducer, or similar, instead emerging from booleans, enums, nullable values, flags, and conditional logic. 1. Thoroughly search the entire codebase (use parallel subagents). 2. Identify every meaningful implicit state machine. 3. For each: the real states, how transitions happen, which state combinations are possible but shouldn't be, where the state lives, ranked by risk/complexity/likelihood of bugs. Output: Part 1 — summary list (title, one-sentence description, risk High/Med/Low, 2–5 key files). Part 2 — detailed report for the high-risk ones (effective states, transition logic, illegal combinations, code snippets, whether it's worth making explicit). Be precise; don't flag trivial booleans.

## Over-engineering

- Hunt over-engineering, unnecessary text, unnecessary abstractions, implicit state machines, duplication, and tests with no useful coverage.
- Are you in a rabbithole duct-taping custom fixes together? Is there a native way of doing this that would be cleaner?

## Structure

- Survey this codebase for deepening opportunities and hand me the candidates.
- What higher-level abstraction would make this entire problem disappear?
- Design the single test that breaks this design on day one.

## Security sweep

- Audit every input path for injection, XSS, path traversal.
- Locate race conditions and missing locks.
- Identify unhandled errors and silent failures.
- Flag hardcoded secrets and weak crypto.
- Check dependency vulns and dead code.
- Verify resource cleanup and timeout handling.

## Performance

- Establish baseline metrics (p50/p95/p99 latency, throughput) and profile before proposing anything.

## Prove

- Demonstrate a reachable counterexample for each unenforced invariant.
- Demonstrate how each multi-step operation can partially complete.
- Construct each invalid state through a reachable execution path.
- Demonstrate an execution sequence that violates each assumed protocol.
- Reproduce a harmful interleaving, race condition, or execution order.
- Demonstrate duplicate or conflicting side effects under replay.
- Construct a reachable caller or input that violates each assumed contract.
- Demonstrate a reachable unauthorized action or data exposure.
- Demonstrate a reachable state with no viable path to completion or recovery.
- Reproduce an operation that reports success while leaving inconsistent state.
- Demonstrate the coupling through a concrete, representative change.
- Prove findings against actual code paths and reject unverified assumptions.

## Review

- Read-only review: check intent, callers, data, security, and tests. Rank findings by severity.
- Review this diff on two axes: does it follow the repo's standards, and does it faithfully implement the spec?
- Inspect the full PR diff, not individual commits.
- Give the reviewer the original acceptance criteria before the author's summary.
- For every number or claim, quote the file and line. If you can't, delete it.
- Rate each bug from 1 to 10 on how often it would happen and how bad it would be. If the two scores multiplied are below 5, just file it as an issue and leave the code alone.
- Check every acceptance criterion: PASS / FAIL / UNTESTED, with evidence.
- Report the scan as: how many found, how many need a decision, how many have specific bugs, how many are sound.
- Explain why the tests didn't catch it.
- Look over everything again for any obvious oversights, omissions, mistakes, or conceptual errors.
- Assume that 99% of automated comments are defensive slop, and tell me the one or two actually worth handling.
- Ship decision: Ready, or Needs fixes with an ordered fix list.
