# TUI harness — tmux

Drive the running terminal UI in a tmux session: send keystrokes, capture the
rendered screen. The matrix rows say *what* to test; this file is *how* to drive
and capture on a TUI.

## Setup

Use `qa-<run-id>` as the session name — a **literal** you retype in every
command, NOT a shell variable: env vars don't survive between Bash calls, so
`SESSION=…` set here is gone by the next call. Derive `<run-id>` from the run
dir's basename (`…/qa-run-<id>/` → session `qa-<id>`) so it stays consistent.
`sleep` must be folded into the compound command — a standalone foreground
`sleep` is blocked by this harness.

```bash
tmux new-session -d -s qa-<run-id> -x 200 -y 50
tmux send-keys -t qa-<run-id> "<launch command>" Enter; sleep 1
tmux capture-pane -t qa-<run-id> -p > "<run-dir>/evidence/launch.txt"
```

## Core loop per matrix row

```bash
tmux send-keys -t qa-<run-id> <keys>; sleep 0.3
tmux capture-pane -t qa-<run-id> -p > "<run-dir>/evidence/<row>.txt"
```

- Assert on the **actual captured screen**, not on the assumption a key "should"
  work. Capture before and after each interaction.
- `-S -100` includes scrollback.

## Surface-specific levers

- Every keybinding, arrow keys, tab cycling, invalid keys (expect a no-op, not a
  crash or garbled screen).
- **Resize** — `tmux resize-window -t qa-<run-id> -x 40 -y 15`; confirm the
  layout reflows without corruption or overlap.
- **Interruption** — `send-keys C-c`, `C-z`, `C-d` mid-flow; confirm clean state
  or clean exit.
- **States** — empty list, single item, more items than the viewport (scrolling).

## Teardown

```bash
tmux kill-session -t qa-<run-id>
```

## Rule

A garbled screen, a frozen UI after a keypress, or an unhandled crash to the
shell is a finding. Capture the pane that shows it.
