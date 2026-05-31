---
name: dogfood
description: "Exploratory QA of web apps: find bugs, evidence, reports."
version: 1.2.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [qa, testing, browser, web, dogfood]
    related_skills: []
---

# Dogfood: Systematic Web Application QA Testing

## Overview

This skill guides systematic exploratory QA testing of web applications using
the Chrome DevTools MCP toolset. You navigate the application, interact with
elements, capture evidence of issues, and produce a structured bug report.

**Core principle: you only conclude on what you personally observed in the
running app** — not on inference, not on "the page loaded, so it works." Every
finding (and every "this works") traces to an artifact you actually captured: a
screenshot, a console read, or a network response.

## Prerequisites

- The Chrome DevTools MCP server must be configured. Available tools are
  prefixed `mcp__chrome-devtools__*` — see the tool reference below.
- **A running app and a target URL.** This skill does NOT boot the app.
  The caller is responsible for starting the dev server and handing in the
  URL. If you do not have a URL, stop and report that — do not improvise
  with `curl`, `psql`, or `lsof` to bootstrap the runtime yourself.
- Optional but recommended: a time budget. Without one, you will keep
  exploring until killed. Default to 10 minutes wall-clock unless told
  otherwise.

## Inputs

The caller provides:
1. **Target URL** — the entry point for testing.
2. **Scope** — what areas/features to focus on (or "full site" for
   comprehensive testing).
3. **Time budget** — wall-clock max. Default 10 min.
4. **Output directory** (optional) — where to save screenshots and the
   report (default: `./dogfood-output`).
5. **Acceptance criteria** (optional) — the specific behaviors a change must
   satisfy. When provided, trace each one explicitly (Phase 2) *before*
   open-ended exploration.

## Workflow

Follow this 5-phase systematic workflow:

### Phase 1: Plan

1. Create the output directory structure:
   ```
   {output_dir}/
   ├── screenshots/       # Evidence screenshots
   └── report.md          # Final report (generated in Phase 5)
   ```
2. Identify the testing scope based on caller input.
3. Build a rough sitemap of pages and features to test:
   - Landing/home page
   - Navigation links (header, footer, sidebar)
   - Key user flows (sign up, login, search, checkout, etc.)
   - Forms and interactive elements
   - Edge cases (empty states, error pages, 404s)

### Phase 2: Explore

**0. Trace the acceptance criteria first (when handed any).** Before open-ended
exploration, walk each acceptance criterion end-to-end through the running app
and confirm the *promised* user-facing behavior actually happens — the row
appears, the inline error renders, the toast shows, the disabled state toggles.
Criteria are confirmed by observation, not assumed from a green build. Explore
around them afterward; don't skip them for free-roaming.

For each page or feature in your plan:

1. **Open / navigate** to the page:
   ```
   mcp__chrome-devtools__new_page(url="<base>/page")           # first time
   mcp__chrome-devtools__navigate_page(url="<base>/other")     # subsequent
   ```

2. **Take a DOM snapshot** to understand structure and get element refs:
   ```
   mcp__chrome-devtools__take_snapshot()
   ```
   The snapshot is the accessibility tree with element refs you'll use in
   subsequent `click` / `fill` / `hover` calls.

3. **Check the console** for JavaScript errors:
   ```
   mcp__chrome-devtools__list_console_messages()
   ```
   Do this after every navigation and after every significant interaction.
   Silent JS errors are high-value findings.

4. **Take a screenshot** for visual evidence:
   ```
   mcp__chrome-devtools__take_screenshot()
   ```

5. **Test interactive elements** using the refs from the snapshot:
   - Click: `mcp__chrome-devtools__click(uid="<ref from snapshot>")`
   - Fill a field: `mcp__chrome-devtools__fill(uid="<ref>", value="...")`
   - Fill a form: `mcp__chrome-devtools__fill_form(elements=[{uid, value}, ...])`
   - Hover: `mcp__chrome-devtools__hover(uid="<ref>")`
   - Keyboard: `mcp__chrome-devtools__press_key(key="Tab")`
   - Type into focused element: `mcp__chrome-devtools__type_text(text="...")`
   - Wait for a condition: `mcp__chrome-devtools__wait_for(text="Welcome")`
   - **Hit the cheap unhappy paths** (where dogfooding beats automated tests):
     confirm the app shows the *promised* behavior — inline error, toast,
     disabled state — not a 500, a blank screen, or a silent no-op:
     - Bad input: empty submission, missing required fields, invalid format,
       over-long / special-character / unicode values.
     - Auth / permission: not-logged-in and wrong-role access (expect a clean
       redirect or 401/403 surface, never a crash).
     - Bad navigation: a 404 route, a deleted or non-existent resource id.

6. **After each interaction**, check for:
   - Console errors: `mcp__chrome-devtools__list_console_messages()`
   - Network failures: `mcp__chrome-devtools__list_network_requests()`
   - Visual changes: another `take_screenshot()` and compare
   - Expected vs actual behavior

7. **Inspect specific failed requests** when a flow misbehaves:
   ```
   mcp__chrome-devtools__get_network_request(url="...")
   ```

### Phase 3: Collect Evidence

> **Evidence, not assertion.** "It's broken" with no captured screenshot,
> console line, or network response is a guess, not a finding. Capture the
> artifact *before* you write the finding.

For every issue found:

1. **Take a screenshot** showing the issue, save its returned path.
2. **Record the details**:
   - URL where the issue occurs
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Console errors (if any)
   - Screenshot path
3. **Classify** the issue:
   - Severity: Critical / High / Medium / Low
   - Category: Functional / Visual / Accessibility / Console / UX / Content

### Phase 4: Categorize

1. Review all collected issues.
2. De-duplicate — merge issues that are the same bug manifesting in different
   places.
3. Assign final severity and category to each issue.
4. Sort by severity (Critical first, then High, Medium, Low).
5. Count issues by severity and category for the executive summary.

### Phase 5: Report

Generate the final report. It must include:
1. **Executive summary** with total issue count, breakdown by severity, and
   testing scope.
2. **Per-issue sections** with:
   - Issue number and title
   - Severity and category
   - URL where observed
   - Description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshot references (use `MEDIA:<screenshot_path>` for inline images)
   - Console errors if relevant
3. **Summary table** of all issues.
4. **Testing notes** — what was tested, what was not, any blockers, whether
   you hit your time budget before completing the plan.

Save the report to `{output_dir}/report.md` if a directory was provided,
otherwise return it inline.

## Tools Reference

All tools are namespaced `mcp__chrome-devtools__*`.

| Tool | Purpose |
|------|---------|
| `new_page` | Open a new tab at a URL |
| `navigate_page` | Navigate the current page to a URL |
| `select_page` | Switch to another open page/tab |
| `list_pages` | List all open pages |
| `close_page` | Close a page |
| `take_snapshot` | Accessibility-tree snapshot with element refs |
| `take_screenshot` | Image screenshot |
| `click` | Click an element by ref |
| `fill` | Set the value of an input by ref |
| `fill_form` | Fill multiple fields in one call |
| `hover` | Hover over an element |
| `press_key` | Press a keyboard key |
| `type_text` | Type into the focused element |
| `drag` | Drag from one element to another |
| `upload_file` | Upload a file to a file input |
| `handle_dialog` | Accept/dismiss a JS dialog |
| `wait_for` | Wait until text/element appears |
| `list_console_messages` | Read JS console output and errors |
| `get_console_message` | Read a specific console message |
| `list_network_requests` | List all network requests on the page |
| `get_network_request` | Detail of a specific network request |
| `evaluate_script` | Run arbitrary JS in the page context |
| `resize_page` | Resize the viewport |
| `emulate` | Emulate a device, network, or CPU profile |
| `take_heapsnapshot` | Capture a JS heap snapshot |
| `performance_start_trace` / `_stop_trace` / `_analyze_insight` | Performance tracing |

## Tips

- **Stay inside your time budget.** When the budget is nearly up, stop
  exploring and start writing the report with whatever you have. Partial
  findings beat no findings.
- **Always read `list_console_messages()` after navigating** — silent JS
  errors are among the highest-value findings.
- **Use `take_snapshot()` before any interaction** — it gives you the refs
  you'll feed to `click`, `fill`, etc. Refs are scoped to the current
  snapshot; re-snapshot after the DOM changes significantly.
- **Test with both valid and invalid inputs.** Form-validation bugs are
  common.
- **Scroll through long pages.** Content below the fold may have rendering
  issues. Use `evaluate_script(function="() => window.scrollTo(0, document.body.scrollHeight)")`.
- **Test navigation flows.** Click through multi-step processes end-to-end.
- **Edge cases**: empty states, very long text, special characters, rapid
  clicking, refresh mid-flow.
- **When reporting screenshots**, include `MEDIA:<screenshot_path>` so the
  reader can see the evidence inline.

## Common rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "The page loaded, so it works" | Loading isn't working. Drive the actual flow, read the console, hit an error path. |
| "Tests pass, so I don't need to click through" | Tests exercise the code, not the running system. Wiring, auth, and error paths fail outside them — that is what this skill is for. |
| "I tried the happy path, looks fine" | The happy path is the case you already knew worked. The unhappy paths are where the bugs are. |
| "It looked off but I'm not sure" | Capture a screenshot and file it as a finding. A screenshot lets the reader judge; "looks off, no evidence" helps no one. |
| "The flicker / disabled state is too fast to see" | Throttle with `emulate` and observe it. "Too fast to see" is not "verified." |

## Red flags — STOP

- Reporting a finding with **no captured evidence** (screenshot / console line / network response).
- Testing **only the happy path** — never hitting an error, empty input, or permission-denied case.
- Calling a handed acceptance criterion satisfied **without driving it through the running app**.
- Concluding "works" from a page that **merely loaded**, without exercising the flow or reading the console.
- Improvising `curl` / `psql` / `lsof` to **boot the app yourself** when you weren't handed a URL — stop and report instead (see Prerequisites).
