# Comment Before/After Analysis — MR Review db521251..fa7ad2d8

## Prompt for LLM

Analyze these before/after code comment pairs from a real code review. The BEFORE comments were written by an AI agent with coding standards loaded. The AFTER comments are what the human reviewer wanted instead.

Your goal: extract every pattern that distinguishes good comments from bad ones. For each pattern, give it a name, explain what the BEFORE does wrong, what the AFTER does right, and write a concise rule (one sentence) that would prevent the BEFORE and produce the AFTER.

Focus on what makes the AFTER comments feel like a senior developer explaining the code to a newcomer sitting next to them.

---

## evaluation.rs

### 1. Module-level documentation

**BEFORE:**
```rust
/// Implements the bucketed health evaluation flow.
///
/// Returns `(subscriptions, max_completed_at)` where max_completed_at is used
/// by the caller to advance the watermark after committing.
```

**AFTER:**
```rust
//! Health monitor evaluation pipeline.
//!
//! **What it does**: monitors webhook delivery success/failure rates to
//! auto-warn and auto-disable unhealthy subscription endpoints.
//!
//! **How it works at a high level** (one "tick"):
//!   1. Read the cursor — a bookmark saying "I've already processed all
//!      deliveries up to this timestamp."
//!   2. Scan `request_attempt` for deliveries newer than the cursor.
//!   3. Group those deliveries into time buckets per subscription
//!      (a bucket = a time window like "10:00–10:05, 50 successes, 3 failures").
//!   4. Close buckets that are full (exceeded duration or message count).
//!   5. Identify "suspects" — subscriptions with enough recent failures to
//!      potentially need a warning or to be disabled.
//!   6. Compute each suspect's failure rate over the sliding window.
//!
//! The caller (mod.rs) then feeds each suspect into the state machine, which
//! decides whether to warn, disable, or resolve, and finally advances the
//! cursor so the next tick only looks at newer deliveries.
```

### 2. Function doc

**BEFORE:**
```rust
/// Implements the bucketed health evaluation flow.
```

**AFTER:**
```rust
/// Runs the full evaluation pipeline for one tick: read cursor, ingest new
/// deliveries, bucket them, close full buckets, find suspects, compute failure rates.
///
/// Returns `(suspects, max_completed_at)` where `max_completed_at` is the
/// timestamp the caller should pass to `advance_cursor` after committing the
/// transaction.
```

### 3. Step comments (all 6)

**BEFORE:**
```rust
// 1. Read watermark
// 2. Ingest deltas
// 3. Upsert into buckets
// 4. Close full buckets
// 5. Find suspects
// 6. Compute failure rates
```

**AFTER:**
```rust
// 1. Read the cursor — "where did I stop last time?"
// 2. Scan for new deliveries since the cursor (capped to avoid long queries)
// 3. Pour those delivery counts into open buckets (one bucket per subscription)
// 4. Close any bucket that exceeded its time or message limit
// 5. Find subscriptions that might be unhealthy (or were previously warned)
// 6. Compute failure rates for each suspect
```

### 4. advance function doc

**BEFORE:**
```rust
/// Advances the watermark to the given timestamp.
/// Asserts that exactly one row was updated (singleton table invariant).
```

**AFTER:**
```rust
/// Advances the cursor to the given timestamp.
///
/// The cursor is a singleton row (exactly one row in the table). The WHERE clause
/// ensures we never move the cursor backwards — if two ticks overlap, the later
/// timestamp wins.
```

### 5. reset function doc

**BEFORE:**
```rust
/// Resets failure_percent to NULL for subscriptions that are NOT in the suspect list
/// but currently have a non-null failure_percent.
```

**AFTER:**
```rust
/// Resets failure_percent to NULL for subscriptions that are NOT suspects.
///
/// Why? The frontend displays failure_percent as a badge. If a subscription
/// was briefly unhealthy but recovered, we clear its stale failure data so
/// the UI doesn't show an outdated red badge on a now-healthy endpoint.
```

---

## queries.rs

### 6. DeltaRow struct doc

**BEFORE:**
```rust
/// Delta row returned by the watermark-based scan of request_attempt.
```

**AFTER:**
```rust
/// One row per subscription from the delta scan: how many deliveries completed
/// since the cursor, split into total vs failed.
```

### 7. DeltaRow field doc

**BEFORE:**
(no doc on max_completed_at field)

**AFTER:**
```rust
/// The latest completion timestamp in this batch — used to advance the cursor
/// after the transaction commits so the next tick skips these rows.
```

### 8. SubscriptionHealth struct doc

**BEFORE:**
```rust
/// Subscription health data fetched from the database, including failure rate,
/// latest health event status, and retry schedule configuration.
```

**AFTER:**
```rust
/// All the data the state machine needs to decide whether to warn, disable,
/// or resolve a subscription: its failure rate, its latest health event,
/// and its retry schedule (included so notification emails can reference it).
```

### 9. read_cursor doc

**BEFORE:**
```rust
/// Reads the current watermark timestamp from the singleton table.
```

**AFTER:**
```rust
/// Reads the cursor — the timestamp of the last delivery we've already processed.
/// Everything newer than this value is "new work" for the current tick.
///
/// The cursor lives in a singleton table (exactly one row, enforced by a CHECK
/// constraint on the primary key). It starts at '-infinity' so the first tick
/// picks up all historical deliveries.
```

### 10. ingest_deltas doc

**BEFORE:**
```rust
/// Ingests deltas from request_attempt since the given watermark (capped at 50 000 rows).
```

**AFTER:**
```rust
/// Scans request_attempt for deliveries completed after the cursor.
///
/// Groups results by subscription so we get one row per subscription with
/// (total_count, failed_count, max_completed_at). The LIMIT caps the batch
/// size to avoid long-running queries on high-traffic instances — any
/// remaining rows will be picked up on the next tick.
```

### 11. upsert_buckets doc

**BEFORE:**
```rust
/// Upserts delta counts into open health buckets (bulk via unnest).
```

**AFTER:**
```rust
/// Adds new delivery results to each subscription's current open bucket.
///
/// Two-step approach:
/// 1. Fetch each subscription's currently open bucket (if any) in one query
/// 2. Bulk upsert all delivery counts using QueryBuilder::push_values
///
/// For subscriptions without an open bucket, a new one is created starting now.
/// The ON CONFLICT clause adds counts to existing buckets rather than replacing.
```

### 12. close_full_buckets doc

**BEFORE:**
```rust
/// Closes buckets that have exceeded their duration or message cap.
```

**AFTER:**
```rust
/// Closes buckets that are "full" — either they've been open too long (exceeded
/// the configured duration) or they contain too many deliveries (exceeded the
/// configured max message count).
///
/// A closed bucket (bucket_end IS NOT NULL) is frozen: no more delivery results
/// will be added to it. New deliveries for that subscription will go into a
/// fresh bucket on the next tick.
///
/// Why close buckets? Without closing, a single bucket would grow indefinitely.
/// Closing creates discrete time windows that let us compute failure rates
/// over a sliding window (e.g., "failure rate in the last hour" = sum of
/// the last 12 five-minute buckets).
```

---

## state_machine.rs

### 13. Module-level doc

**BEFORE:**
(no module doc)

**AFTER:**
```rust
//! Subscription health state machine.
//!
//! Evaluates a subscription's current failure rate against its previous health
//! status and decides what action to take. The health monitor calls this once
//! per suspect subscription on each tick.
//!
//! State transitions:
//!   No previous state + high failure       -> emit Warning
//!   No previous state + very high failure   -> emit Warning then Disable
//!   Warning + still failing (same level)    -> do nothing (already warned)
//!   Warning + even higher failure           -> Disable
//!   Warning + recovered (failure dropped)   -> Resolved
//!   Disabled                                -> do nothing (user must re-enable manually)
//!   Resolved + within cooldown              -> do nothing (avoid email spam)
```

### 14. evaluate function doc

**BEFORE:**
```rust
/// Evaluates a single subscription's health and determines state transitions.
///
/// State machine:
///   - `None` / `resolved` + high failure → insert `warning` event
///   - `warning` + even higher failure → disable subscription
///   - `warning` + low failure → insert `resolved` event
///   - `disabled` → no-op (manual re-enable required)
///   - `resolved` within cooldown → no-op (prevent email spam)
```

**AFTER:**
```rust
/// Evaluates a single subscription's health and determines what actions to take.
///
/// This is the core decision function. It looks at:
/// - The subscription's current failure_percent (from bucket aggregation)
/// - Its last health event (warning / disabled / resolved / none)
/// - The configured thresholds (warning_failure_percent, disable_failure_percent)
///
/// Side-effects (within the transaction):
/// - Persists failure_percent to the subscription table (for frontend display)
/// - Inserts health events (warning, disabled, resolved)
/// - Disables the subscription if failure is extreme
///
/// Returns a list of HealthActions that the caller dispatches as side-effects
/// (emails, Hook0 events) after the transaction commits.
```

### 15. State machine branch comments (all)

**BEFORE:**
```rust
Some(HealthStatus::Disabled) => {}
// (no comment)

Some(HealthStatus::Warning) if failure_percent < warning_percent => {
// (no comment)

_ if failure_percent >= disable_percent => {
// (no comment)
```

**AFTER:**
```rust
// Already disabled by the health monitor — user must re-enable manually.
// We don't touch it again to avoid overriding a deliberate user action.
Some(HealthStatus::Disabled) => {}

// Recently resolved (within cooldown period) — skip to avoid spamming
// the user with warning -> resolved -> warning -> resolved emails.

// Already warned and failure rate is in the same range (still bad but
// not bad enough to disable) — nothing new to tell the user.

// Was warned but failure rate dropped below the warning threshold — the
// endpoint recovered. Insert a "resolved" event and notify the user.

// Was warned and failure rate climbed above the disable threshold — shut it down.

// No previous health state (or resolved outside cooldown) and failure rate
// is extremely high — warn AND disable in a single tick.

// No previous health state and failure rate crossed the warning threshold —
// send a warning email so the user can investigate before we disable.

// Failure rate is below the warning threshold and no prior state — healthy, nothing to do.
```

### 16. disable_subscription doc

**BEFORE:**
```rust
/// Disables a subscription and inserts a 'disabled' health event atomically.
/// Returns `Some(disabled_at)` if it actually disabled, `None` if already disabled.
```

**AFTER:**
```rust
/// Disables a subscription and inserts a 'disabled' health event atomically.
///
/// Uses a single CTE so that if the subscription was already disabled (e.g. by
/// the user between ticks), we don't insert a duplicate event. Returns
/// `Some(disabled_at)` only if we actually flipped is_enabled from true to false.
```

---

## mod.rs

### 17. Reset comment

**BEFORE:**
```rust
// Reset failure_percent for non-suspect subscriptions
```

**AFTER:**
```rust
// Reset failure_percent for non-suspect subscriptions so the frontend
// doesn't show stale failure data on now-healthy endpoints.
```

### 18. Advance comment

**BEFORE:**
```rust
// Advance watermark if we processed any deltas
```

**AFTER:**
```rust
// Advance the cursor so the next tick only looks at newer deliveries
```

---

## retry_schedules.rs

### 19. validate function doc

**BEFORE:**
```rust
/// Cross-field validation for retry schedule strategy. Shared logic called by
/// `RetrySchedulePost::validate_strategy` and `RetrySchedulePut::validate_strategy`.
```

**AFTER:**
```rust
/// Cross-field validation for retry schedule strategy. Called by the validator
/// crate via `#[validate(schema(function = "..."))]` on Post and Put structs.
```
