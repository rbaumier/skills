# Rendezvous — loop-issues

How a parent waits on a child and how a child reports. One protocol
for the orchestrator and the implementer; a leaf (planner, reviewer,
QA executor) needs only § Report.

## Harness facts

- A child spawned with `Agent` keeps its parent **resumable**: the
  parent ends its turn, the child's completion notification resumes
  it. Nothing else does. A parent that ends its turn with no live
  `Agent` child is **finished**: its Monitor events and
  background-command completions are **parked** — undelivered until a
  SendMessage resumes it — and its children's later notifications fall
  through to the root session.
- A child resumed by SendMessage is not a live child; only a fresh
  `Agent` spawn is.
- The root session is the catch-all: it receives whatever no live
  parent can. A subagent receives only what its live children send.
- Foreground `sleep` is blocked by the harness; Bash wait loops
  (`until`/`while`/`for` + `sleep`) are BANNED everywhere.

## Waiting — the only way

Spawn with `Agent`, finish the foreground work you already have, then
end your turn. Nothing to "keep busy": no polling, no `echo ok`, no
Monitor on a `.done`. Two children in flight → the first completion
resumes you; the other still running → end your turn again.

Work that must finish before you continue (trio, comply, gates, a
readiness probe) runs in the FOREGROUND: one `curl`, never a loop; a
command that cannot finish inside the 10-min Bash cap is split
(check / test / build apart, tests by package), never backgrounded.
A long-lived process (dev server) is backgrounded and never awaited.

Needing a child again (re-check, QA re-run) = a NEW spawn handed
the previous report path — never a SendMessage to the old one.

## Report — every agent

Write the report in the scratchpad (outside any worktree), then
`<report>.done` — ONE line, verdict + report path — as your LAST
write; end your final text with that same line. Never SendMessage.
The notification wakes the parent; the `.done` carries the verdict.

## Fall-through — orchestrator only

- A grandchild's notification (reviewer, QA executor) lands on you ⇒
  the implementer finished without its report. SendMessage it that
  notification's one line + `resume`, once per notification.
- The implementer's own notification without its `.done` ⇒ stalled.
  SendMessage `resume: finish #<n> — <what its last line promised>`.
  Third stall on one issue ⇒ step 6.

## Watchdog — orchestrator only

Armed once at Step 0 — `CronCreate` (load it via ToolSearch),
recurring `9,29,49 * * * *`, session-only, auto-expires after 7 days —
with this prompt:

> loop-issues watchdog. A user message since the loop's last spawn
> that does not ask to continue (an interruption, a stop) → CronDelete
> this job, reply ⏹. Else ListAgents: a planner or implementer of
> this loop running → reply ⏳. Else an implementer finished without
> its `.done` → resume it (RENDEZVOUS.md § Fall-through). Else run the
> loop from step 1 — step 5 first when a report awaits verification.
> No recap.

It fires only while you are idle — exactly the dead state it exists
for — and it IS the empty-queue re-poll.
