# Semver, releases and MSRV

Load when cutting a library release or changing anything `pub`. Companion to ci-4.

## Breaking vs non-breaking — the non-obvious rows

| Change | Verdict |
|---|---|
| Remove/rename/privatize any `pub` item | breaking |
| Add a field to a `pub` struct whose fields are all `pub` (externally constructible) | breaking |
| Add a variant to an enum without `#[non_exhaustive]` | breaking |
| Add a trait method without a default body | breaking |
| Tighten a generic bound or lifetime | breaking |
| Type stops being `Send`/`Sync`/`Unpin` (e.g. a new `Rc` field) | breaking — silent, invisible in the API diff; the api-9 const-assert catches it |
| Add a variant to a `#[non_exhaustive]` enum; add a defaulted trait method | minor |
| Add an inherent method or new `pub` item | minor (rare name-ambiguity breakage is tolerated) |
| Anything `#[doc(hidden)]` | outside the semver contract |
| Bump MSRV | minor by convention — state the policy in the README |

Pre-1.0: the `0.MINOR` position is the breaking axis; cargo's caret treats `0.4.x` as one compatible family.

## Enforcement

- `cargo semver-checks check-release` in CI catches most of the table mechanically.
- MSRV: set `rust-version` in `Cargo.toml` AND add a CI job pinned to exactly that toolchain. A `rust-version` you don't test is a lie.
- Features stay additive (ci-5): `--all-features` must always compile.
