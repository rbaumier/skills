# CLI harness — Bash

Run the real binary and inspect exit code, stdout, stderr. The matrix rows say
*what* to test; this file is *how* to drive and capture on a CLI.

## Core loop per matrix row

```bash
<command> <args> >"<run-dir>/evidence/<row>.out" 2>"<run-dir>/evidence/<row>.err"
echo "exit=$?"
```

- Assert on the **exit code AND the output** — exit 0 with a wrong or empty
  result is a FAIL; a non-zero exit on the happy path is a FAIL.

## Surface-specific levers

- **Args** — unknown flags, conflicting flags, `--help`/`--version` sanity,
  missing required args.
- **Input / paths** — no stdin when expected, huge stdin, binary/garbage on
  stdin, a nonexistent path, a directory where a file is expected, no
  permissions.
- **Error surface** — every failure should exit non-zero with a clear stderr
  message, never a stack trace or a silent exit 0.
- **Interruption** — interrupt mid-run and confirm clean shutdown, no
  half-written files. Ctrl-C isn't available in a foreground Bash call; send the
  signal yourself with a portable one-liner (macOS has no default `timeout` —
  it's `gtimeout` via coreutils):
  `<command> & pid=$!; sleep 2; kill -INT $pid; wait $pid; echo "exit=$?"`.
- **Env** — missing required env var, malformed config file.

## Rule

Silent failure (exit 0 but nothing happened) is a high-value finding.
