# UI harness — Chrome DevTools MCP

Drive the running web app through `mcp__chrome-devtools__*`. The matrix rows say
*what* to test; this file is *how* to drive and capture on a UI.

## Core loop per matrix row

1. **Navigate** — `new_page(url=...)` first time, `navigate_page(url=...)` after.
2. **Snapshot** — `take_snapshot()` returns the accessibility tree with element
   refs (`uid`) for `click`/`fill`/`hover`. Re-snapshot after the DOM changes.
3. **Act** — `click(uid=...)`, `fill(uid=..., value=...)`,
   `fill_form(elements=[{uid, value}, ...])`, `hover`, `press_key`, `type_text`,
   `upload_file`, `drag`, `handle_dialog`.
4. **Observe** after every interaction:
   - `list_console_messages()` — silent JS errors are the highest-value finding.
   - `list_network_requests()` then `get_network_request(url=...)` for failures.
   - `take_screenshot()` — save the returned path into the evidence dir.
   - `wait_for(text=...)` to sync on async UI before asserting.

## Surface-specific levers

- Hit routes logged out and as the wrong role — expect a clean redirect/401/403
  surface rendered in the UI, never a crash or blank screen.
- Double-click submit, back/refresh mid-flow, resubmit rapidly.
- Scroll long pages:
  `evaluate_script(function="() => window.scrollTo(0, document.body.scrollHeight)")`.
- `emulate` slow network/CPU to observe flickers and disabled states "too fast
  to see".

## Rule

Never conclude "works" from a page that merely rendered. The console must be
clean AND the promised behavior (row appears, inline error shows, toast fires,
button disables) observed and screenshotted.
