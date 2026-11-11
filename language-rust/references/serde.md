# Serde at boundaries

Load when writing or reviewing serde attributes. Companion to api-6.

- `rename_all = "camelCase"` at API edges; an enum with struct variants also needs `rename_all_fields`.
- An enum with data variants on the wire picks its tagging explicitly: `tag = "type"` (internal) or `tag` + `content` (adjacent); unit-only enums stay plain strings. Internal tagging rejects tuple variants and non-self-describing formats (bincode).
- `deny_unknown_fields` on configs we own, never on a third-party payload or response (a new provider field breaks prod), and never on a struct using `flatten`, outer or inner (unsupported by serde).
- `#[serde(default)]` only where the zero value is safe; a timeout or retry count uses `default = "fn"`.
- `skip_serializing_if` on a non-`Option` field also gets `#[serde(default)]`, or our own output no longer reads back.
