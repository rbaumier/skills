// Helper for the /paperclip skill: list what blocks the self-hosted Paperclip agent platform on a
// human (interactions, blocked issues, decisions, approvals, recovery actions), the agents stuck in
// error/paused and the backlogs that never progress, then write the human's answer back so the
// paused run resumes.
//
// HTTP API only (curl). Reading the database or exec-ing into the containers is forbidden (hook
// paperclip-api-guard). Access comes from the environment, exported before each call by the skill
// from `~/.config/paperclip/env` (written by install.sh):
//   PAPERCLIP_API_BASE, else BASE                origin of your Paperclip instance (public https)
//   PAPERCLIP_API_HOST_HEADER, else HOST_HEADER  Host the tunnelled instance expects ('' = none)
//   PAPERCLIP_API_TOKEN, else the KEY_FILE file  board API key (never printed)
//   CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET Cloudflare Access service token (remote mode)
//   PAPERCLIP_COMPANY_ID                         optional: one company instead of all (max 10)
//   PAPERCLIP_STALE_HOURS                        stalled_backlog age threshold, 1..720 (default 24)
// Each request reaches curl as a config file on stdin (`-K -`): neither the token nor the body
// shows up in the process list. Exit code: 0 ok, 1 the API refused a write, 2 usage/transport error.
//
//   paperclip-decisions whoami
//   paperclip-decisions list
//   paperclip-decisions int-accept  <issue_id> <interaction_id> [--option ID ...]
//   paperclip-decisions int-reject  <issue_id> <interaction_id> [--reason TEXT]
//   paperclip-decisions int-respond <issue_id> <interaction_id> [--answer qid=oid,oid ...] [--summary TEXT]
//   paperclip-decisions issue-status <issue_id> <status> [--comment TEXT] [--clear-unblock]
//   paperclip-decisions issue-comment <issue_id> --body TEXT
//   paperclip-decisions issue-assign <issue_id> <agent_id> [--status STATUS]
//   paperclip-decisions recovery-resolve <issue_id> <action_id> <outcome> <sourceIssueStatus> [--note TEXT]
//   paperclip-decisions decide       <decision_id> <option_id> [--input key=value ...]
//   paperclip-decisions appr-approve <approval_id> [--note TEXT]
//   paperclip-decisions appr-reject  <approval_id> [--note TEXT]
//   paperclip-decisions agent-clear-error <agent_id>
//   paperclip-decisions agent-wake <agent_id>
//   paperclip-decisions agent-pause <agent_id>
//   paperclip-decisions agent-resume <agent_id>
//   paperclip-decisions backlog-promote <agent_id> [--limit N] [--older-than-hours H]

use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::process::{Command, ExitCode, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_COMPANIES: usize = 10;
const MAX_ATTENTION_ITEMS: usize = 200;
const MAX_AGENTS_IN_ERROR: usize = 30;
const MAX_STALLED_ENTRIES: usize = 50;
const MAX_LISTED_ISSUE_IDS: usize = 200;
const EXAMPLES_PER_ENTRY: usize = 5;
// Some instances clamp the issue list at 500 rows per call: page with offset, never trust one call.
const ISSUE_PAGE_SIZE: usize = 500;
const MAX_ISSUE_PAGES: usize = 20;
const DEFAULT_STALE_HOURS: u64 = 24;
const STALE_HOURS_RANGE: (u64, u64) = (1, 720);
const DEFAULT_PROMOTE_LIMIT: u64 = 50;
const PROMOTE_LIMIT_RANGE: (u64, u64) = (1, 200);
const OLDER_THAN_HOURS_RANGE: (u64, u64) = (0, 8760);
const TEXT_MAX_CHARS: usize = 1200;
const SHORT_MAX_CHARS: usize = 300;
const TITLE_MAX_CHARS: usize = 80;
const RESPONSE_MAX_CHARS: usize = 4000;
const MAX_RESPONSE_BYTES: u64 = 16 * 1024 * 1024;
const ISSUE_STATUSES: [&str; 7] = [
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "done",
    "blocked",
    "cancelled",
];

struct Api {
    base: String,
    host_header: String,
    token: String,
    cf_access: Option<(String, String)>,
}

impl Api {
    fn from_env() -> Result<Self, String> {
        Self::resolve(
            |k| std::env::var(k).ok().filter(|v| !v.trim().is_empty()),
            |p| std::fs::read_to_string(p).map_err(|e| format!("cannot read KEY_FILE {p}: {e}")),
        )
    }

    fn resolve(
        var: impl Fn(&str) -> Option<String>,
        read_file: impl Fn(&str) -> Result<String, String>,
    ) -> Result<Self, String> {
        let base = var("PAPERCLIP_API_BASE")
            .or_else(|| var("BASE"))
            .ok_or("PAPERCLIP_API_BASE is required (see ~/.config/paperclip/env)")?;
        let host_header = var("PAPERCLIP_API_HOST_HEADER")
            .or_else(|| var("HOST_HEADER"))
            .unwrap_or_default();
        let token = match var("PAPERCLIP_API_TOKEN") {
            Some(t) => t,
            None => read_file(
                &var("KEY_FILE").ok_or("PAPERCLIP_API_TOKEN or KEY_FILE (board key file) is required")?,
            )?,
        };
        let token = token.trim().to_string();
        if token.len() < 16 {
            return Err("the board API key looks empty (fewer than 16 characters)".into());
        }
        let cf_access = match (var("CF_ACCESS_CLIENT_ID"), var("CF_ACCESS_CLIENT_SECRET")) {
            (Some(id), Some(secret)) => Some((id, secret)),
            _ => None,
        };
        Ok(Self {
            base: base.trim().trim_end_matches('/').to_string(),
            host_header: host_header.trim().to_string(),
            token,
            cf_access,
        })
    }

    fn curl_config(&self, method: &str, path: &str, body: Option<&str>) -> String {
        let mut lines = vec![
            "silent".to_string(),
            "show-error".to_string(),
            "connect-timeout = 10".to_string(),
            "max-time = 30".to_string(),
            format!("max-filesize = {MAX_RESPONSE_BYTES}"),
            format!("request = {}", curl_quote(method)),
            format!("url = {}", curl_quote(&format!("{}{path}", self.base))),
            format!("header = {}", curl_quote(&format!("Authorization: Bearer {}", self.token))),
            format!("header = {}", curl_quote("Accept: application/json")),
        ];
        if !self.host_header.is_empty() {
            lines.push(format!("header = {}", curl_quote(&format!("Host: {}", self.host_header))));
        }
        if let Some((id, secret)) = &self.cf_access {
            lines.push(format!("header = {}", curl_quote(&format!("CF-Access-Client-Id: {id}"))));
            lines.push(format!("header = {}", curl_quote(&format!("CF-Access-Client-Secret: {secret}"))));
        }
        if let Some(b) = body {
            lines.push(format!("header = {}", curl_quote("Content-Type: application/json")));
            lines.push(format!("data-binary = {}", curl_quote(b)));
        }
        lines.push(format!("write-out = {}", curl_quote("\n<<<HTTP:%{http_code}>>>")));
        lines.join("\n") + "\n"
    }

    /// (http_status, body). A transport failure (no HTTP status at all) is an error.
    fn request(&self, method: &str, path: &str, body: Option<&Value>) -> Result<(u32, String), String> {
        let body = body.map(Value::to_string);
        let config = self.curl_config(method, path, body.as_deref());
        let mut child = Command::new("curl")
            .args(["-K", "-"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("spawn curl: {e}"))?;
        child
            .stdin
            .take()
            .ok_or("no stdin for curl")?
            .write_all(config.as_bytes())
            .map_err(|e| format!("write curl config: {e}"))?;
        let out = child.wait_with_output().map_err(|e| format!("curl: {e}"))?;
        let (code, text) = parse_curl_output(&String::from_utf8_lossy(&out.stdout));
        if code == 0 {
            return Err(format!(
                "{method} {path}: no HTTP response ({})",
                truncate(String::from_utf8_lossy(&out.stderr).trim(), SHORT_MAX_CHARS)
            ));
        }
        Ok((code, text))
    }

    fn get_json(&self, path: &str) -> Result<Value, String> {
        let (code, body) = self.request("GET", path, None)?;
        if !(200..300).contains(&code) {
            return Err(format!("GET {path}: HTTP {code}: {}", truncate(&body, SHORT_MAX_CHARS)));
        }
        serde_json::from_str(&body).map_err(|e| format!("GET {path}: invalid JSON: {e}"))
    }

    fn get_list(&self, path: &str) -> Result<Vec<Value>, String> {
        let v = self.get_json(path)?;
        as_list(v).ok_or_else(|| format!("GET {path}: expected a JSON array"))
    }

    /// Every issue of the company matching `query`, paged; `true` when the page cap was hit.
    fn list_issues(&self, company_id: &str, query: &str) -> Result<(Vec<Value>, bool), String> {
        paginate(|offset, limit| {
            self.get_list(&format!(
                "/api/companies/{company_id}/issues?{query}&limit={limit}&offset={offset}"
            ))
        })
    }
}

/// Fetch pages until one comes back short (end of data) or MAX_ISSUE_PAGES is reached; rows are
/// de-duplicated by `id` since offset paging over live data can shift a row across two pages.
fn paginate(
    mut fetch_page: impl FnMut(usize, usize) -> Result<Vec<Value>, String>,
) -> Result<(Vec<Value>, bool), String> {
    let mut seen = HashSet::new();
    let mut rows = Vec::new();
    for page in 0..MAX_ISSUE_PAGES {
        let batch = fetch_page(page * ISSUE_PAGE_SIZE, ISSUE_PAGE_SIZE)?;
        let short = batch.len() < ISSUE_PAGE_SIZE;
        for row in batch {
            if seen.insert(s(&row, "/id").to_string()) {
                rows.push(row);
            }
        }
        if short {
            return Ok((rows, false));
        }
    }
    Ok((rows, true))
}

/// Double-quoted value for a curl config file (curl unescapes \\ \" \n \r \t inside quotes).
fn curl_quote(v: &str) -> String {
    let mut out = String::with_capacity(v.len() + 2);
    out.push('"');
    for c in v.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn parse_curl_output(raw: &str) -> (u32, String) {
    let marker = "\n<<<HTTP:";
    match raw.rfind(marker) {
        Some(idx) => {
            let status = raw[idx + marker.len()..].trim_end_matches(">>>").trim();
            (status.parse().unwrap_or(0), raw[..idx].to_string())
        }
        None => (0, raw.to_string()),
    }
}

fn as_list(v: Value) -> Option<Vec<Value>> {
    match v {
        Value::Array(a) => Some(a),
        Value::Object(mut o) => match o.remove("items") {
            Some(Value::Array(a)) => Some(a),
            _ => None,
        },
        _ => None,
    }
}

fn jstr<'a>(v: &'a Value, pointer: &str) -> Option<&'a str> {
    v.pointer(pointer).and_then(Value::as_str)
}

fn s<'a>(v: &'a Value, pointer: &str) -> &'a str {
    jstr(v, pointer).unwrap_or("")
}

fn truncate(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

fn truncated_field(v: &Value, pointer: &str, max_chars: usize) -> Value {
    match jstr(v, pointer) {
        Some(t) => Value::String(truncate(t, max_chars)),
        None => Value::Null,
    }
}

/// Same item with `company` as its first key, so a multi-company list says where each item lives.
fn tag(company: &str, entry: Value) -> Value {
    let mut out = Map::new();
    out.insert("company".into(), Value::String(company.to_string()));
    if let Value::Object(fields) = entry {
        out.extend(fields);
    }
    Value::Object(out)
}

fn parse_bounded(raw: Option<&str>, default: u64, (min, max): (u64, u64), name: &str) -> Result<u64, String> {
    let Some(raw) = raw.map(str::trim).filter(|r| !r.is_empty()) else {
        return Ok(default);
    };
    let n: u64 = raw
        .parse()
        .map_err(|_| format!("{name} must be an integer in {min}..={max}, got '{raw}'"))?;
    if n < min || n > max {
        return Err(format!("{name} must be in {min}..={max}, got {n}"));
    }
    Ok(n)
}

fn check_status(status: &str) -> Result<(), String> {
    if ISSUE_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(format!("invalid status '{status}' (expected one of {})", ISSUE_STATUSES.join("|")))
    }
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * ((m + 9) % 12) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Seconds since the epoch for an ISO-8601 timestamp as the API serializes it
/// (`2026-09-30T10:11:12.345Z`, or a `±HH:MM` offset).
fn parse_iso_epoch(ts: &str) -> Option<i64> {
    let b = ts.as_bytes();
    if b.len() < 19 || b[4] != b'-' || b[7] != b'-' || !matches!(b[10], b'T' | b' ') || b[13] != b':' || b[16] != b':' {
        return None;
    }
    let num = |r: std::ops::Range<usize>| ts.get(r)?.parse::<i64>().ok();
    let (y, mo, d) = (num(0..4)?, num(5..7)?, num(8..10)?);
    let (h, mi, sec) = (num(11..13)?, num(14..16)?, num(17..19)?);
    if !(1..=12).contains(&mo) || !(1..=31).contains(&d) || h > 23 || mi > 59 || sec > 60 {
        return None;
    }
    let mut rest = &ts[19..];
    if let Some(frac) = rest.strip_prefix('.') {
        let digits = frac.bytes().take_while(u8::is_ascii_digit).count();
        rest = &frac[digits..];
    }
    let offset = match rest {
        "" | "Z" | "z" => 0,
        _ => {
            let sign = match rest.as_bytes()[0] {
                b'+' => 1,
                b'-' => -1,
                _ => return None,
            };
            let hhmm = rest[1..].replace(':', "");
            if hhmm.len() != 4 {
                return None;
            }
            sign * (hhmm[..2].parse::<i64>().ok()? * 3600 + hhmm[2..].parse::<i64>().ok()? * 60)
        }
    };
    Some(days_from_civil(y, mo, d) * 86_400 + h * 3600 + mi * 60 + sec - offset)
}

/// Same lenient boolean parsing as the server (true/false, "true"/"1"/"yes"/"on", 1/0).
fn bool_like(v: &Value) -> Option<bool> {
    match v {
        Value::Bool(b) => Some(*b),
        Value::Number(n) => n.as_i64().map(|n| n != 0),
        Value::String(t) => match t.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => Some(true),
            "false" | "0" | "no" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

/// Mirrors server isHeartbeatWakeOnDemandEnabled: first key present wins, default true.
fn wake_on_demand(agent: &Value) -> bool {
    ["wakeOnDemand", "wakeOnAssignment", "wakeOnOnDemand", "wakeOnAutomation"]
        .iter()
        .find_map(|k| agent.pointer(&format!("/runtimeConfig/heartbeat/{k}")).filter(|v| !v.is_null()))
        .and_then(bool_like)
        .unwrap_or(true)
}

/// Mirrors the server's scheduler policy: heartbeat.enabled, default false.
fn heartbeat_enabled(agent: &Value) -> bool {
    agent
        .pointer("/runtimeConfig/heartbeat/enabled")
        .and_then(bool_like)
        .unwrap_or(false)
}

/// Why an agent's backlog/todo issues do not move. First matching cause wins.
fn classify(agent: Option<&Value>, todo: usize) -> &'static str {
    let Some(agent) = agent else {
        return "assignee_deleted";
    };
    match s(agent, "/status") {
        "terminated" => "assignee_deleted",
        "error" => "agent_error",
        "paused" => "agent_paused",
        _ if !wake_on_demand(agent) => "wake_on_demand_off",
        _ if todo == 0 => "backlog_never_wakes",
        _ => "todo_not_picked",
    }
}

#[derive(Default)]
struct Stalled<'a> {
    backlog: usize,
    todo: usize,
    issues: Vec<(i64, &'a Value)>,
}

fn issue_example(issue: &Value, created: i64, now: i64) -> Value {
    json!({
        "issue_id": s(issue, "/id"),
        "issue": s(issue, "/identifier"),
        "title": truncate(s(issue, "/title"), TITLE_MAX_CHARS),
        "status": s(issue, "/status"),
        "age_days": (now - created).max(0) / 86_400,
    })
}

/// Per-agent aggregate of backlog/todo issues created more than `stale_secs` ago. Issues held by
/// a human (assigneeUserId) are not an agent backlog and are skipped; issues held by nobody form
/// the trailing `unassigned` entry.
fn aggregate_stalled(agents: &[Value], issues: &[Value], now: i64, stale_secs: i64) -> Vec<Value> {
    let by_id: HashMap<&str, &Value> = agents.iter().map(|a| (s(a, "/id"), a)).collect();
    let mut groups: HashMap<Option<&str>, Stalled> = HashMap::new();
    for issue in issues {
        let status = s(issue, "/status");
        if status != "backlog" && status != "todo" {
            continue;
        }
        let Some(created) = parse_iso_epoch(s(issue, "/createdAt")) else {
            continue;
        };
        if now - created < stale_secs {
            continue;
        }
        let agent_id = jstr(issue, "/assigneeAgentId");
        if agent_id.is_none() && jstr(issue, "/assigneeUserId").is_some() {
            continue;
        }
        let g = groups.entry(agent_id).or_default();
        if status == "backlog" {
            g.backlog += 1;
        } else {
            g.todo += 1;
        }
        g.issues.push((created, issue));
    }

    let mut entries: Vec<(usize, String, Value)> = Vec::new();
    let mut unassigned = None;
    for (agent_id, mut g) in groups {
        g.issues.sort_by_key(|(created, issue)| (*created, s(issue, "/id")));
        let oldest = g.issues.first().map(|(c, _)| *c).unwrap_or(now);
        let examples: Vec<Value> = g
            .issues
            .iter()
            .take(EXAMPLES_PER_ENTRY)
            .map(|(c, i)| issue_example(i, *c, now))
            .collect();
        let agent = agent_id.and_then(|id| by_id.get(id).copied());
        let why = match agent_id {
            None => "unassigned",
            Some(_) => classify(agent, g.todo),
        };
        let mut entry = json!({
            "agent_id": agent_id,
            "agent": agent.map(|a| s(a, "/name")),
            "agent_status": agent.map(|a| s(a, "/status")),
            "wake_on_demand": agent.map(wake_on_demand),
            "why": why,
            "backlog": g.backlog,
            "todo": g.todo,
            "max_age_days": (now - oldest).max(0) / 86_400,
            "examples": examples,
        });
        if why == "assignee_deleted" || why == "unassigned" {
            let ids: Vec<&str> = g.issues.iter().take(MAX_LISTED_ISSUE_IDS).map(|(_, i)| s(i, "/id")).collect();
            entry["issue_ids"] = json!(ids);
        }
        let total = g.backlog + g.todo;
        match agent_id {
            None => unassigned = Some(entry),
            Some(_) => entries.push((total, agent.map(|a| s(a, "/name")).unwrap_or("").to_string(), entry)),
        }
    }
    entries.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    let mut out: Vec<Value> = entries.into_iter().take(MAX_STALLED_ENTRIES).map(|(_, _, e)| e).collect();
    out.extend(unassigned);
    out
}

fn agent_error_entry(agent: &Value, last_run: Option<&Value>) -> Value {
    json!({
        "agent_id": s(agent, "/id"),
        "name": s(agent, "/name"),
        "status": s(agent, "/status"),
        "error_reason": truncated_field(agent, "/errorReason", SHORT_MAX_CHARS),
        "pause_reason": truncated_field(agent, "/pauseReason", SHORT_MAX_CHARS),
        "adapter_type": s(agent, "/adapterType"),
        "since": s(agent, "/updatedAt"),
        "heartbeat": {"enabled": heartbeat_enabled(agent), "wake_on_demand": wake_on_demand(agent)},
        "last_run": last_run.map(|r| json!({
            "status": s(r, "/status"),
            "at": (["/finishedAt", "/startedAt", "/createdAt"].iter().find_map(|p| jstr(r, p))),
            "error": truncated_field(r, "/error", SHORT_MAX_CHARS),
            "error_code": r.get("errorCode").cloned().unwrap_or(Value::Null),
        })),
    })
}

/// Oldest-first backlog issues of `agent_id` at least `min_age_secs` old, at most `limit`.
fn select_promotable<'a>(issues: &'a [Value], agent_id: &str, now: i64, min_age_secs: i64, limit: usize) -> Vec<&'a Value> {
    let mut picked: Vec<(i64, &Value)> = issues
        .iter()
        .filter(|i| s(i, "/status") == "backlog" && s(i, "/assigneeAgentId") == agent_id)
        .filter_map(|i| parse_iso_epoch(s(i, "/createdAt")).map(|c| (c, i)))
        .filter(|(c, _)| now - c >= min_age_secs)
        .collect();
    picked.sort_by_key(|(c, i)| (*c, s(i, "/id")));
    picked.into_iter().take(limit).map(|(_, i)| i).collect()
}

fn issue_assign_body(agent_id: &str, status: Option<&str>) -> Result<Value, String> {
    let mut body = json!({ "assigneeAgentId": agent_id });
    if let Some(st) = status {
        check_status(st)?;
        body["status"] = json!(st);
    }
    Ok(body)
}

// The attention feed item only carries an excerpt of a pending interaction; the full payload lives
// in the issue's interaction list (fetched once per issue).
fn interaction_entry(api: &Api, item: &Value, cache: &mut HashMap<String, Value>) -> Result<Option<Value>, String> {
    let interaction_id = jstr(item, "/subject/id").ok_or("attention item missing subject.id")?;
    let issue_id = jstr(item, "/subject/metadata/issueId")
        .or_else(|| jstr(item, "/relatedIssue/id"))
        .ok_or("interaction attention item missing issueId")?
        .to_string();
    if !cache.contains_key(&issue_id) {
        let list = api.get_json(&format!("/api/issues/{issue_id}/interactions"))?;
        cache.insert(issue_id.clone(), list);
    }
    let rows = cache
        .get(&issue_id)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("GET /api/issues/{issue_id}/interactions: expected a JSON array"))?;
    // Absent = resolved between the feed read and this call: the feed is a snapshot, not an error.
    let Some(row) = rows
        .iter()
        .find(|r| s(r, "/id") == interaction_id && s(r, "/status") == "pending")
    else {
        return Ok(None);
    };
    let payload = row.get("payload").cloned().unwrap_or_else(|| json!({}));
    Ok(Some(json!({
        "interaction_id": interaction_id,
        "issue_id": issue_id,
        "issue": s(item, "/relatedIssue/identifier"),
        "issue_title": s(item, "/relatedIssue/title"),
        "kind": s(row, "/kind"),
        "title": s(row, "/title"),
        "summary": s(row, "/summary"),
        "prompt": s(&payload, "/prompt"),
        "accept_label": s(&payload, "/acceptLabel"),
        "reject_label": s(&payload, "/rejectLabel"),
        "allow_decline_reason": payload.get("allowDeclineReason").cloned().unwrap_or(Value::Bool(false)),
        "questions": payload.get("questions").cloned().unwrap_or(Value::Null),
        "details": truncate(s(&payload, "/detailsMarkdown"), TEXT_MAX_CHARS),
        "created_at": s(row, "/createdAt"),
    })))
}

// The feed carries a body excerpt only; the option ids `decide` needs live in the full record.
fn decision_entry(api: &Api, item: &Value) -> Result<Value, String> {
    let id = jstr(item, "/subject/id").ok_or("decision attention item missing subject.id")?;
    let d = api.get_json(&format!("/api/decisions/{id}"))?;
    Ok(json!({
        "decision_id": id,
        "title": s(&d, "/title"),
        "body": truncate(s(&d, "/body"), TEXT_MAX_CHARS),
        "options": d.get("options").cloned().unwrap_or_else(|| json!([])),
        "inputs": d.get("inputs").cloned().unwrap_or(Value::Null),
        "expires": s(&d, "/expiresAt"),
        "created_at": s(&d, "/createdAt"),
    }))
}

fn approval_entry(api: &Api, item: &Value) -> Result<Value, String> {
    let id = jstr(item, "/subject/id").ok_or("approval attention item missing subject.id")?;
    let d = api.get_json(&format!("/api/approvals/{id}"))?;
    Ok(json!({
        "approval_id": id,
        "type": s(&d, "/type"),
        "payload": d.get("payload").cloned().unwrap_or_else(|| json!({})),
        "created_at": s(&d, "/createdAt"),
    }))
}

// Everything is on the feed item itself; the feed does not expose the recovery timeout.
fn recovery_entry(item: &Value) -> Option<Value> {
    Some(json!({
        "action_id": jstr(item, "/subject/id")?,
        "issue_id": s(item, "/subject/metadata/sourceIssueId"),
        "issue": s(item, "/relatedIssue/identifier"),
        "issue_title": s(item, "/relatedIssue/title"),
        "kind": s(item, "/subject/metadata/kind"),
        "cause": s(item, "/subject/metadata/cause"),
        "next_action": s(item, "/subject/title"),
        "timeout": null,
        "since": s(item, "/activityAt"),
    }))
}

// `blocker_attention` covers two server concepts told apart by the dedupKey prefix only:
// "blocked-owner:*" = issue blocked on a human decision (surfaced); "blocker:*" = blocker-chain
// diagnostic with reassign/nudge verbs that this helper does not implement (left to the web UI).
fn blocked_issue_entry(item: &Value) -> Option<Value> {
    if !s(item, "/dedupKey").starts_with("blocked-owner:") {
        return None;
    }
    Some(json!({
        "issue_id": jstr(item, "/subject/id")?,
        "issue": s(item, "/subject/identifier"),
        "title": s(item, "/subject/title"),
        "action": s(item, "/whyNow"),
        "description": "",
        "since": s(item, "/activityAt"),
    }))
}

/// Adds `age_days` (whole days since the timestamp in `field`, `null` when it is missing or
/// unreadable) to every entry and orders the section by age, oldest first, so the items that have
/// waited longest on the user are asked first. Entries without a readable age go last.
fn age_sorted(mut entries: Vec<Value>, field: &str, now: i64) -> Vec<Value> {
    let pointer = format!("/{field}");
    for e in entries.iter_mut() {
        let age = parse_iso_epoch(s(e, &pointer)).map(|t| (now - t).max(0) / 86_400);
        e["age_days"] = json!(age);
    }
    entries.sort_by_key(|e| std::cmp::Reverse(e["age_days"].as_i64()));
    entries
}

/// The backlog aggregate already carries `max_age_days` (its oldest issue): expose it as `age_days`
/// like the other sections and order by it, oldest first.
fn by_max_age(mut entries: Vec<Value>) -> Vec<Value> {
    for e in entries.iter_mut() {
        e["age_days"] = e.get("max_age_days").cloned().unwrap_or(Value::Null);
    }
    entries.sort_by_key(|e| std::cmp::Reverse(e["age_days"].as_i64()));
    entries
}

#[derive(Default)]
struct Sections {
    interactions: Vec<Value>,
    blocked_issues: Vec<Value>,
    decisions: Vec<Value>,
    approvals: Vec<Value>,
    recovery_actions: Vec<Value>,
    agents_in_error: Vec<Value>,
    stalled_backlog: Vec<Value>,
    errors: Vec<Value>,
}

impl Sections {
    fn fail(&mut self, company: &str, section: &str, error: String) {
        self.errors.push(json!({"company": company, "section": section, "error": error}));
    }
}

fn collect_attention(api: &Api, cid: &str, name: &str, out: &mut Sections) -> Result<(), String> {
    let feed = api.get_json(&format!("/api/companies/{cid}/attention?all=true"))?;
    let items = feed
        .get("items")
        .and_then(Value::as_array)
        .ok_or("attention feed response missing items[]")?;
    let mut cache = HashMap::new();
    for item in items.iter().take(MAX_ATTENTION_ITEMS) {
        match s(item, "/sourceKind") {
            "issue_thread_interaction" => match interaction_entry(api, item, &mut cache) {
                Ok(Some(e)) => out.interactions.push(tag(name, e)),
                Ok(None) => {}
                Err(e) => out.fail(name, "interactions", e),
            },
            "decision" => match decision_entry(api, item) {
                Ok(e) => out.decisions.push(tag(name, e)),
                Err(e) => out.fail(name, "decisions", e),
            },
            "approval" => match approval_entry(api, item) {
                Ok(e) => out.approvals.push(tag(name, e)),
                Err(e) => out.fail(name, "approvals", e),
            },
            "recovery_action" => out.recovery_actions.extend(recovery_entry(item).map(|e| tag(name, e))),
            "blocker_attention" => out.blocked_issues.extend(blocked_issue_entry(item).map(|e| tag(name, e))),
            _ => {}
        }
    }
    Ok(())
}

fn collect_agents_in_error(api: &Api, cid: &str, name: &str, agents: &[Value], out: &mut Sections) {
    let failing = agents
        .iter()
        .filter(|a| matches!(s(a, "/status"), "error" | "paused"))
        .take(MAX_AGENTS_IN_ERROR);
    for agent in failing {
        let id = s(agent, "/id");
        let last_run = match api.get_list(&format!(
            "/api/companies/{cid}/heartbeat-runs?agentId={id}&limit=1&summary=true"
        )) {
            Ok(runs) => runs.into_iter().next(),
            Err(e) => {
                out.fail(name, "agents_in_error", e);
                None
            }
        };
        out.agents_in_error.push(tag(name, agent_error_entry(agent, last_run.as_ref())));
    }
}

/// Companies to scan: all of them (max 10) or the one PAPERCLIP_COMPANY_ID names.
fn target_companies(api: &Api, only: Option<&str>) -> Result<(Vec<(String, String)>, bool), String> {
    let all = api.get_list("/api/companies")?;
    let mut picked: Vec<(String, String)> = all
        .iter()
        .filter(|c| only.is_none_or(|id| s(c, "/id") == id))
        .map(|c| (s(c, "/id").to_string(), s(c, "/name").to_string()))
        .collect();
    if let Some(id) = only {
        if picked.is_empty() {
            return Err(format!("PAPERCLIP_COMPANY_ID {id} is not a company of this instance"));
        }
    }
    let truncated = picked.len() > MAX_COMPANIES;
    picked.truncate(MAX_COMPANIES);
    Ok((picked, truncated))
}

fn cmd_list() -> Result<bool, String> {
    let api = Api::from_env()?;
    let stale_hours = parse_bounded(
        std::env::var("PAPERCLIP_STALE_HOURS").ok().as_deref(),
        DEFAULT_STALE_HOURS,
        STALE_HOURS_RANGE,
        "PAPERCLIP_STALE_HOURS",
    )?;
    let only = std::env::var("PAPERCLIP_COMPANY_ID").ok().filter(|v| !v.trim().is_empty());
    let (companies, companies_truncated) = target_companies(&api, only.as_deref())?;
    let now = now_epoch();
    let mut out = Sections::default();
    let mut scanned = Vec::new();
    for (cid, name) in &companies {
        if let Err(e) = collect_attention(&api, cid, name, &mut out) {
            out.fail(name, "attention", e);
        }
        let mut meta = json!({"id": cid, "name": name});
        match api.get_list(&format!("/api/companies/{cid}/agents")) {
            Err(e) => out.fail(name, "agents", e),
            Ok(agents) => {
                collect_agents_in_error(&api, cid, name, &agents, &mut out);
                match api.list_issues(cid, "status=backlog,todo") {
                    Err(e) => out.fail(name, "stalled_backlog", e),
                    Ok((issues, truncated)) => {
                        meta["issues_scanned"] = json!(issues.len());
                        meta["issues_truncated"] = json!(truncated);
                        let stalled = aggregate_stalled(&agents, &issues, now, stale_hours as i64 * 3600);
                        out.stalled_backlog.extend(stalled.into_iter().map(|e| tag(name, e)));
                    }
                }
            }
        }
        scanned.push(meta);
    }
    println!(
        "{}",
        json!({
            "companies": scanned,
            "companies_truncated": companies_truncated,
            "stale_hours": stale_hours,
            "interactions": age_sorted(out.interactions, "created_at", now),
            "blocked_issues": age_sorted(out.blocked_issues, "since", now),
            "decisions": age_sorted(out.decisions, "created_at", now),
            "approvals": age_sorted(out.approvals, "created_at", now),
            "recovery_actions": age_sorted(out.recovery_actions, "since", now),
            "agents_in_error": age_sorted(out.agents_in_error, "since", now),
            "stalled_backlog": by_max_age(out.stalled_backlog),
            "errors": out.errors,
        })
    );
    Ok(true)
}

fn cmd_whoami() -> Result<bool, String> {
    let api = Api::from_env()?;
    let token_source = if std::env::var("PAPERCLIP_API_TOKEN").is_ok_and(|t| !t.trim().is_empty()) {
        "PAPERCLIP_API_TOKEN"
    } else {
        "KEY_FILE"
    };
    println!(
        "{}",
        json!({
            "transport": "api",
            "api_base": api.base,
            "host_header": api.host_header,
            "company_id": std::env::var("PAPERCLIP_COMPANY_ID").unwrap_or_default(),
            "token_source": token_source,
            "cf_access": api.cf_access.is_some(),
        })
    );
    Ok(true)
}

/// Prints the write result; returns whether the API accepted it.
fn report(action: &str, id: &str, code: u32, body: &str) -> bool {
    let ok = (200..300).contains(&code);
    println!(
        "{}",
        json!({"action": action, "id": id, "ok": ok, "http": code, "response": truncate(body, RESPONSE_MAX_CHARS)})
    );
    ok
}

/// Values of every `--flag value` occurrence.
fn collect_flag(args: &[String], flag: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < args.len() {
        if args[i] == flag {
            if let Some(v) = args.get(i + 1) {
                out.push(v.clone());
            }
            i += 2;
        } else {
            i += 1;
        }
    }
    out
}

fn opt_flag(args: &[String], flag: &str) -> Option<String> {
    collect_flag(args, flag).into_iter().next()
}

fn has_flag(args: &[String], flag: &str) -> bool {
    args.iter().any(|a| a == flag)
}

fn tail(a: &[String], from: usize) -> &[String] {
    &a[from.min(a.len())..]
}

fn send(action: &str, id: &str, method: &str, path: &str, body: &Value) -> Result<bool, String> {
    let (code, resp) = Api::from_env()?.request(method, path, Some(body))?;
    Ok(report(action, id, code, &resp))
}

fn cmd_int_accept(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or("usage: int-accept <issue_id> <interaction_id> [--option ID ...]")?;
    let int = a.get(1).ok_or("missing <interaction_id>")?;
    let opts = collect_flag(tail(a, 2), "--option");
    let body = if opts.is_empty() { json!({}) } else { json!({ "selectedOptionIds": opts }) };
    send("int-accept", int, "POST", &format!("/api/issues/{iss}/interactions/{int}/accept"), &body)
}

fn cmd_int_reject(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or("usage: int-reject <issue_id> <interaction_id> [--reason TEXT]")?;
    let int = a.get(1).ok_or("missing <interaction_id>")?;
    let body = match opt_flag(tail(a, 2), "--reason") {
        Some(reason) => json!({ "reason": reason }),
        None => json!({}),
    };
    send("int-reject", int, "POST", &format!("/api/issues/{iss}/interactions/{int}/reject"), &body)
}

fn cmd_int_respond(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or("usage: int-respond <issue_id> <interaction_id> --answer qid=oid,oid ...")?;
    let int = a.get(1).ok_or("missing <interaction_id>")?;
    let mut answers = Vec::new();
    for spec in collect_flag(tail(a, 2), "--answer") {
        let (qid, oids) = spec.split_once('=').ok_or("--answer expects questionId=optId[,optId]")?;
        let ids: Vec<&str> = oids.split(',').filter(|o| !o.is_empty()).collect();
        answers.push(json!({ "questionId": qid, "optionIds": ids }));
    }
    if answers.is_empty() {
        return Err("int-respond needs at least one --answer".into());
    }
    let mut body = json!({ "answers": answers });
    if let Some(summary) = opt_flag(tail(a, 2), "--summary") {
        body["summaryMarkdown"] = json!(summary);
    }
    send("int-respond", int, "POST", &format!("/api/issues/{iss}/interactions/{int}/respond"), &body)
}

fn cmd_issue_status(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or("usage: issue-status <issue_id> <status> [--comment TEXT] [--clear-unblock]")?;
    let status = a.get(1).ok_or("missing <status>")?;
    check_status(status)?;
    let rest = tail(a, 2);
    let api = Api::from_env()?;
    // The decision comment goes first so it is on the thread before the transition wakes the agent.
    if let Some(comment) = opt_flag(rest, "--comment") {
        let (code, resp) = api.request(
            "POST",
            &format!("/api/issues/{iss}/comments"),
            Some(&json!({ "body": comment, "authorType": "user" })),
        )?;
        if !(200..300).contains(&code) {
            return Ok(report("issue-comment", iss, code, &resp));
        }
    }
    let mut body = json!({ "status": status });
    if has_flag(rest, "--clear-unblock") {
        body["unblockDescriptor"] = Value::Null;
    }
    let (code, resp) = api.request("PATCH", &format!("/api/issues/{iss}"), Some(&body))?;
    Ok(report("issue-status", iss, code, &resp))
}

fn cmd_issue_comment(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or("usage: issue-comment <issue_id> --body TEXT")?;
    let text = opt_flag(tail(a, 1), "--body").ok_or("issue-comment needs --body TEXT")?;
    send(
        "issue-comment",
        iss,
        "POST",
        &format!("/api/issues/{iss}/comments"),
        &json!({ "body": text, "authorType": "user" }),
    )
}

fn cmd_issue_assign(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or("usage: issue-assign <issue_id> <agent_id> [--status STATUS]")?;
    let agent = a.get(1).ok_or("missing <agent_id>")?;
    let body = issue_assign_body(agent, opt_flag(tail(a, 2), "--status").as_deref())?;
    send("issue-assign", iss, "PATCH", &format!("/api/issues/{iss}"), &body)
}

fn cmd_recovery_resolve(a: &[String]) -> Result<bool, String> {
    let iss = a.first().ok_or(
        "usage: recovery-resolve <issue_id> <action_id> <outcome:restored|false_positive|blocked|cancelled> <sourceIssueStatus:todo|done|in_review|blocked> [--note TEXT]",
    )?;
    let action = a.get(1).ok_or("missing <action_id>")?;
    let outcome = a.get(2).ok_or("missing <outcome>")?;
    let status = a.get(3).ok_or("missing <sourceIssueStatus>")?;
    let mut body = json!({ "actionId": action, "outcome": outcome, "sourceIssueStatus": status });
    if let Some(note) = opt_flag(tail(a, 4), "--note") {
        body["resolutionNote"] = json!(note);
    }
    send("recovery-resolve", action, "POST", &format!("/api/issues/{iss}/recovery-actions/resolve"), &body)
}

fn cmd_decide(a: &[String]) -> Result<bool, String> {
    let id = a.first().ok_or("usage: decide <decision_id> <option_id> [--input k=v ...]")?;
    let option = a.get(1).ok_or("missing <option_id>")?;
    let inputs: Map<String, Value> = collect_flag(tail(a, 2), "--input")
        .iter()
        .map(|kv| {
            let (k, v) = kv.split_once('=').unwrap_or((kv.as_str(), ""));
            (k.to_string(), json!(v))
        })
        .collect();
    let mut body = json!({ "optionId": option });
    if !inputs.is_empty() {
        body["inputValues"] = Value::Object(inputs);
    }
    send("decide", id, "POST", &format!("/api/decisions/{id}/decide"), &body)
}

fn cmd_approval(action: &str, a: &[String]) -> Result<bool, String> {
    let id = a.first().ok_or("usage: appr-approve|appr-reject <approval_id> [--note TEXT]")?;
    let verb = if action == "appr-approve" { "approve" } else { "reject" };
    let body = match opt_flag(tail(a, 1), "--note") {
        Some(note) => json!({ "decisionNote": note }),
        None => json!({}),
    };
    send(action, id, "POST", &format!("/api/approvals/{id}/{verb}"), &body)
}

fn cmd_agent_post(action: &str, verb: &str, a: &[String]) -> Result<bool, String> {
    let id = a.first().ok_or_else(|| format!("usage: {action} <agent_id>"))?;
    send(action, id, "POST", &format!("/api/agents/{id}/{verb}"), &json!({}))
}

fn cmd_backlog_promote(a: &[String]) -> Result<bool, String> {
    let agent_id = a
        .first()
        .ok_or("usage: backlog-promote <agent_id> [--limit N] [--older-than-hours H]")?;
    let rest = tail(a, 1);
    let limit = parse_bounded(opt_flag(rest, "--limit").as_deref(), DEFAULT_PROMOTE_LIMIT, PROMOTE_LIMIT_RANGE, "--limit")?;
    let older = parse_bounded(opt_flag(rest, "--older-than-hours").as_deref(), 0, OLDER_THAN_HOURS_RANGE, "--older-than-hours")?;
    let api = Api::from_env()?;
    let agent = api.get_json(&format!("/api/agents/{agent_id}"))?;
    let cid = jstr(&agent, "/companyId").ok_or("agent record has no companyId")?;
    let (issues, _) = api.list_issues(cid, &format!("status=backlog&assigneeAgentId={agent_id}"))?;
    let picked = select_promotable(&issues, agent_id, now_epoch(), older as i64 * 3600, limit as usize);
    let mut processed = Vec::new();
    let mut first_failure = None;
    for issue in &picked {
        let id = s(issue, "/id");
        let (code, resp) = api.request("PATCH", &format!("/api/issues/{id}"), Some(&json!({ "status": "todo" })))?;
        let ok = (200..300).contains(&code);
        if !ok && first_failure.is_none() {
            first_failure = Some(code);
        }
        processed.push(json!({
            "issue_id": id,
            "issue": s(issue, "/identifier"),
            "title": truncate(s(issue, "/title"), TITLE_MAX_CHARS),
            "ok": ok,
            "http": code,
            "error": if ok { Value::Null } else { json!(truncate(&resp, SHORT_MAX_CHARS)) },
        }));
    }
    let promoted = processed.iter().filter(|p| p["ok"] == json!(true)).count();
    println!(
        "{}",
        json!({
            "action": "backlog-promote",
            "id": agent_id,
            "ok": first_failure.is_none(),
            "http": first_failure.unwrap_or(if picked.is_empty() { 0 } else { 200 }),
            "response": format!("{promoted}/{} backlog issue(s) moved to todo for {}", picked.len(), s(&agent, "/name")),
            "processed": processed,
        })
    );
    Ok(first_failure.is_none())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("");
    let rest = tail(&args, 1);
    let result = match cmd {
        "whoami" => cmd_whoami(),
        "list" => cmd_list(),
        "int-accept" => cmd_int_accept(rest),
        "int-reject" => cmd_int_reject(rest),
        "int-respond" => cmd_int_respond(rest),
        "issue-status" => cmd_issue_status(rest),
        "issue-comment" => cmd_issue_comment(rest),
        "issue-assign" => cmd_issue_assign(rest),
        "recovery-resolve" => cmd_recovery_resolve(rest),
        "decide" => cmd_decide(rest),
        "appr-approve" => cmd_approval("appr-approve", rest),
        "appr-reject" => cmd_approval("appr-reject", rest),
        "agent-clear-error" => cmd_agent_post("agent-clear-error", "clear-error", rest),
        "agent-wake" => cmd_agent_post("agent-wake", "heartbeat/invoke", rest),
        "agent-pause" => cmd_agent_post("agent-pause", "pause", rest),
        "agent-resume" => cmd_agent_post("agent-resume", "resume", rest),
        "backlog-promote" => cmd_backlog_promote(rest),
        other => Err(format!(
            "unknown command '{other}'. Use: whoami | list | int-accept | int-reject | int-respond | \
             issue-status | issue-comment | issue-assign | recovery-resolve | decide | appr-approve | \
             appr-reject | agent-clear-error | agent-wake | agent-pause | agent-resume | backlog-promote"
        )),
    };
    match result {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::from(1),
        Err(e) => {
            eprintln!("paperclip-decisions error: {e}");
            ExitCode::from(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let map: HashMap<String, String> = pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        move |k| map.get(k).cloned().filter(|v| !v.trim().is_empty())
    }

    fn no_file(p: &str) -> Result<String, String> {
        Err(format!("unexpected read of {p}"))
    }

    const TOKEN: &str = "pcp_board_0123456789abcdef";
    const NOW: i64 = 1_790_000_000;

    fn api(host: &str, cf: bool) -> Api {
        let mut pairs = vec![("PAPERCLIP_API_BASE", "http://127.0.0.1:4100/"), ("PAPERCLIP_API_TOKEN", TOKEN), ("HOST_HEADER", host)];
        if cf {
            pairs.push(("CF_ACCESS_CLIENT_ID", "id.access"));
            pairs.push(("CF_ACCESS_CLIENT_SECRET", "sec"));
        }
        Api::resolve(env(&pairs), no_file).expect("resolve")
    }

    fn iso(epoch: i64) -> String {
        let days = epoch.div_euclid(86_400);
        let secs = epoch.rem_euclid(86_400);
        let (mut y, mut d) = (1970, days);
        let leap = |y: i64| (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        while d >= if leap(y) { 366 } else { 365 } {
            d -= if leap(y) { 366 } else { 365 };
            y += 1;
        }
        let months = [31, if leap(y) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let mut m = 0;
        while d >= months[m] {
            d -= months[m];
            m += 1;
        }
        format!("{y:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z", m + 1, d + 1, secs / 3600, secs % 3600 / 60, secs % 60)
    }

    fn issue(id: &str, status: &str, agent: Option<&str>, age_hours: i64) -> Value {
        json!({"id": id, "identifier": id.to_uppercase(), "title": format!("title {id}"), "status": status,
               "assigneeAgentId": agent, "assigneeUserId": null, "createdAt": iso(NOW - age_hours * 3600)})
    }

    #[test]
    fn sections_carry_age_days_and_list_the_oldest_first() {
        let entries = vec![
            json!({"id": "fresh", "created_at": iso(NOW - 3600)}),
            json!({"id": "undated", "created_at": ""}),
            json!({"id": "old", "created_at": iso(NOW - 5 * 86_400 - 60)}),
            json!({"id": "mid", "created_at": iso(NOW - 3 * 86_400)}),
        ];
        let sorted = age_sorted(entries, "created_at", NOW);
        let order: Vec<&str> = sorted.iter().map(|e| s(e, "/id")).collect();
        assert_eq!(order, ["old", "mid", "fresh", "undated"]);
        assert_eq!(sorted[0]["age_days"], json!(5));
        assert_eq!(sorted[1]["age_days"], json!(3));
        assert_eq!(sorted[2]["age_days"], json!(0));
        assert_eq!(sorted[3]["age_days"], Value::Null);
        let backlog = by_max_age(vec![json!({"max_age_days": 2}), json!({"max_age_days": 9})]);
        assert_eq!(backlog[0]["age_days"], json!(9));
    }

    fn agent(id: &str, status: &str, heartbeat: Value) -> Value {
        json!({"id": id, "name": format!("Agent {id}"), "status": status, "adapterType": "claude_local",
               "runtimeConfig": {"heartbeat": heartbeat}})
    }

    #[test]
    fn resolve_prefers_explicit_vars_then_api_target_exports() {
        let a = Api::resolve(
            env(&[("PAPERCLIP_API_BASE", "https://x.example/"), ("BASE", "http://ignored"), ("PAPERCLIP_API_HOST_HEADER", "h.example"), ("HOST_HEADER", "ignored"), ("PAPERCLIP_API_TOKEN", TOKEN)]),
            no_file,
        )
        .expect("resolve");
        assert_eq!((a.base.as_str(), a.host_header.as_str()), ("https://x.example", "h.example"));
        let b = Api::resolve(env(&[("BASE", "http://127.0.0.1:1"), ("HOST_HEADER", "paperclip.hook0.com"), ("KEY_FILE", "/k")]), |p| {
            assert_eq!(p, "/k");
            Ok(format!("  {TOKEN}\n"))
        })
        .expect("resolve");
        assert_eq!((b.base.as_str(), b.host_header.as_str(), b.token.as_str()), ("http://127.0.0.1:1", "paperclip.hook0.com", TOKEN));
        assert!(b.cf_access.is_none());
    }

    #[test]
    fn resolve_fails_fast_without_base_or_token() {
        assert!(Api::resolve(env(&[("PAPERCLIP_API_TOKEN", TOKEN)]), no_file).is_err());
        assert!(Api::resolve(env(&[("BASE", "http://b")]), no_file).is_err());
        let short = Api::resolve(env(&[("BASE", "http://b"), ("PAPERCLIP_API_TOKEN", "short-key")]), no_file);
        assert!(short.is_err_and(|e| !e.contains("short-key")), "the error must never echo the key");
        assert!(Api::resolve(env(&[("BASE", "http://b"), ("KEY_FILE", "/missing")]), |_| Err("cannot read".into())).is_err());
    }

    #[test]
    fn cf_access_needs_both_halves() {
        let one = Api::resolve(env(&[("BASE", "http://b"), ("PAPERCLIP_API_TOKEN", TOKEN), ("CF_ACCESS_CLIENT_ID", "id")]), no_file).expect("resolve");
        assert!(one.cf_access.is_none());
        assert!(api("", true).cf_access.is_some());
    }

    #[test]
    fn curl_config_sends_host_header_only_when_set() {
        let tunnel = api("paperclip.hook0.com", false).curl_config("GET", "/api/companies", None);
        assert!(tunnel.contains("header = \"Host: paperclip.hook0.com\"\n"));
        assert!(tunnel.contains("url = \"http://127.0.0.1:4100/api/companies\"\n"));
        assert!(!tunnel.contains("data-binary") && !tunnel.contains("Content-Type") && !tunnel.contains("CF-Access"));
        let public = api("", true).curl_config("GET", "/api/companies", None);
        assert!(!public.contains("Host:"));
        assert!(public.contains("header = \"CF-Access-Client-Id: id.access\"\n") && public.contains("header = \"CF-Access-Client-Secret: sec\"\n"));
    }

    #[test]
    fn curl_config_carries_body_and_bounds() {
        let body = json!({"title": "a \"b\"\n"}).to_string();
        let cfg = api("", false).curl_config("PATCH", "/api/issues/1", Some(&body));
        assert!(cfg.contains("request = \"PATCH\"\n"));
        assert!(cfg.contains("header = \"Content-Type: application/json\"\n"));
        assert!(cfg.contains(&format!("data-binary = {}\n", curl_quote(&body))));
        assert!(cfg.contains("max-time = 30\n") && cfg.contains("connect-timeout = 10\n") && cfg.contains("max-filesize = 16777216\n"));
        assert_eq!(cfg.matches(TOKEN).count(), 1);
        assert!(cfg.contains("write-out = \"\\n<<<HTTP:%{http_code}>>>\"\n"));
    }

    #[test]
    fn curl_quote_escapes_config_specials() {
        assert_eq!(curl_quote("a\"b\\c\nd\te\rf"), "\"a\\\"b\\\\c\\nd\\te\\rf\"");
        assert_eq!(curl_quote("é ✓"), "\"é ✓\"");
    }

    #[test]
    fn parse_curl_output_splits_status() {
        assert_eq!(parse_curl_output("{\"a\":1}\n<<<HTTP:201>>>"), (201, "{\"a\":1}".to_string()));
        assert_eq!(parse_curl_output("x\n<<<HTTP:1>>>\n<<<HTTP:404>>>"), (404, "x\n<<<HTTP:1>>>".to_string()));
        assert_eq!(parse_curl_output("no marker"), (0, "no marker".to_string()));
    }

    #[test]
    fn as_list_accepts_array_or_items() {
        assert_eq!(as_list(json!([1, 2])).map(|l| l.len()), Some(2));
        assert_eq!(as_list(json!({"items": [1]})).map(|l| l.len()), Some(1));
        assert!(as_list(json!({"error": "x"})).is_none());
    }

    #[test]
    fn parse_iso_epoch_handles_api_formats() {
        assert_eq!(parse_iso_epoch("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(parse_iso_epoch("2000-03-01T00:00:00.000Z"), Some(951_868_800));
        assert_eq!(parse_iso_epoch("2026-10-01T12:30:15.123456Z"), Some(1_790_857_815));
        assert_eq!(parse_iso_epoch("2026-10-01T14:30:15+02:00"), Some(1_790_857_815));
        assert_eq!(parse_iso_epoch("2026-10-01 12:30:15"), Some(1_790_857_815));
        for bad in ["", "2026-10-01", "2026-13-01T00:00:00Z", "2026-10-01T00:00:00X", "garbage-in-T00:00:00"] {
            assert_eq!(parse_iso_epoch(bad), None, "{bad}");
        }
        assert_eq!(parse_iso_epoch(&iso(NOW)), Some(NOW));
    }

    #[test]
    fn wake_on_demand_follows_server_precedence_and_default() {
        assert!(wake_on_demand(&agent("a", "idle", json!({}))));
        assert!(!wake_on_demand(&agent("a", "idle", json!({"wakeOnDemand": false}))));
        assert!(!wake_on_demand(&agent("a", "idle", json!({"wakeOnAssignment": "false"}))));
        assert!(wake_on_demand(&agent("a", "idle", json!({"wakeOnDemand": true, "wakeOnAssignment": false}))));
        assert!(!wake_on_demand(&agent("a", "idle", json!({"wakeOnDemand": 0}))));
        assert!(!heartbeat_enabled(&agent("a", "idle", json!({}))));
        assert!(heartbeat_enabled(&agent("a", "idle", json!({"enabled": "on"}))));
    }

    #[test]
    fn classify_orders_causes_deterministically() {
        let healthy = agent("a", "idle", json!({}));
        let error_wod_off = agent("a", "error", json!({"wakeOnDemand": false}));
        assert_eq!(classify(None, 3), "assignee_deleted");
        assert_eq!(classify(Some(&agent("a", "terminated", json!({}))), 3), "assignee_deleted");
        assert_eq!(classify(Some(&error_wod_off), 3), "agent_error");
        assert_eq!(classify(Some(&agent("a", "paused", json!({}))), 0), "agent_paused");
        assert_eq!(classify(Some(&agent("a", "idle", json!({"wakeOnDemand": false}))), 1), "wake_on_demand_off");
        assert_eq!(classify(Some(&healthy), 0), "backlog_never_wakes");
        assert_eq!(classify(Some(&healthy), 1), "todo_not_picked");
        assert_eq!(classify(Some(&agent("a", "running", json!({}))), 2), "todo_not_picked");
    }

    #[test]
    fn aggregate_stalled_groups_per_agent() {
        let agents = vec![
            agent("ok", "idle", json!({})),
            agent("err", "error", json!({})),
            agent("off", "idle", json!({"wakeOnDemand": false})),
        ];
        let mut issues: Vec<Value> = (0..7).map(|n| issue(&format!("b{n}"), "backlog", Some("ok"), 30 + n)).collect();
        issues.push(issue("t1", "todo", Some("err"), 48));
        issues.push(issue("t2", "todo", Some("off"), 100));
        issues.push(issue("gone", "backlog", Some("deleted-agent"), 26));
        issues.push(issue("nobody", "todo", None, 72));
        issues.push(issue("fresh", "backlog", Some("ok"), 2));
        issues.push(issue("done", "done", Some("ok"), 500));
        let mut human = issue("human", "todo", None, 72);
        human["assigneeUserId"] = json!("user-1");
        issues.push(human);
        issues.push(json!({"id": "nodate", "status": "todo", "assigneeAgentId": "ok"}));

        let out = aggregate_stalled(&agents, &issues, NOW, 24 * 3600);
        let whys: Vec<(&str, &str)> = out.iter().map(|e| (e["agent_id"].as_str().unwrap_or("-"), s(e, "/why"))).collect();
        assert_eq!(
            whys,
            vec![("ok", "backlog_never_wakes"), ("deleted-agent", "assignee_deleted"), ("err", "agent_error"), ("off", "wake_on_demand_off"), ("-", "unassigned")]
        );
        let ok = &out[0];
        assert_eq!((ok["backlog"].as_u64(), ok["todo"].as_u64(), ok["max_age_days"].as_i64()), (Some(7), Some(0), Some(1)));
        let examples: Vec<&str> = ok["examples"].as_array().map(|a| a.iter().map(|e| s(e, "/issue_id")).collect()).unwrap_or_default();
        assert_eq!(examples, vec!["b6", "b5", "b4", "b3", "b2"], "five oldest first");
        assert_eq!(ok["examples"][0]["issue"], json!("B6"));
        assert!(ok.get("issue_ids").is_none());
        assert_eq!(ok["wake_on_demand"], json!(true));
        assert_eq!(out[1]["issue_ids"], json!(["gone"]));
        assert_eq!(out[1]["agent"], Value::Null);
        assert_eq!(out[4]["issue_ids"], json!(["nobody"]));
        assert_eq!(out[4]["todo"].as_u64(), Some(1));
    }

    #[test]
    fn aggregate_stalled_caps_titles_and_entries() {
        let agents: Vec<Value> = (0..60).map(|n| agent(&format!("a{n:02}"), "idle", json!({}))).collect();
        let mut issues: Vec<Value> = (0..60).map(|n| issue(&format!("i{n}"), "todo", Some(&format!("a{n:02}")), 30)).collect();
        issues[0]["title"] = json!("x".repeat(500));
        let out = aggregate_stalled(&agents, &issues, NOW, 3600);
        assert_eq!(out.len(), MAX_STALLED_ENTRIES);
        let title = out.iter().find(|e| e["agent_id"] == json!("a00")).map(|e| s(e, "/examples/0/title").chars().count());
        assert_eq!(title, Some(TITLE_MAX_CHARS));
    }

    #[test]
    fn paginate_stops_on_short_page_or_cap() {
        let page = |start: usize, n: usize| -> Vec<Value> { (start..start + n).map(|i| json!({"id": i.to_string()})).collect() };
        let mut calls = Vec::new();
        let (rows, truncated) = paginate(|offset, limit| {
            calls.push((offset, limit));
            Ok(match offset / ISSUE_PAGE_SIZE {
                0 | 1 => page(offset, ISSUE_PAGE_SIZE),
                _ => page(offset, 3),
            })
        })
        .expect("paginate");
        assert_eq!((rows.len(), truncated), (1003, false));
        assert_eq!(calls, vec![(0, 500), (500, 500), (1000, 500)]);

        let mut n = 0;
        let (rows, truncated) = paginate(|offset, limit| {
            n += 1;
            Ok(page(offset, limit))
        })
        .expect("paginate");
        assert_eq!((n, rows.len(), truncated), (MAX_ISSUE_PAGES, MAX_ISSUE_PAGES * ISSUE_PAGE_SIZE, true));

        let mut n = 0;
        let (rows, truncated) = paginate(|_, _| {
            n += 1;
            Ok(Vec::new())
        })
        .expect("paginate");
        assert_eq!((n, rows.len(), truncated), (1, 0, false));

        let (rows, _) = paginate(|offset, limit| Ok(if offset == 0 { page(0, limit) } else { page(limit - 1, 2) })).expect("paginate");
        assert_eq!(rows.len(), ISSUE_PAGE_SIZE + 1, "a row shifted across pages is kept once");

        assert!(paginate(|_, _| Err("boom".into())).is_err());
    }

    #[test]
    fn parse_bounded_enforces_range() {
        assert_eq!(parse_bounded(None, 24, STALE_HOURS_RANGE, "x"), Ok(24));
        assert_eq!(parse_bounded(Some(" "), 24, STALE_HOURS_RANGE, "x"), Ok(24));
        assert_eq!(parse_bounded(Some("720"), 24, STALE_HOURS_RANGE, "x"), Ok(720));
        assert_eq!(parse_bounded(Some("1"), 24, STALE_HOURS_RANGE, "x"), Ok(1));
        assert!(parse_bounded(Some("0"), 24, STALE_HOURS_RANGE, "x").is_err());
        assert!(parse_bounded(Some("721"), 24, STALE_HOURS_RANGE, "x").is_err());
        assert!(parse_bounded(Some("201"), 50, PROMOTE_LIMIT_RANGE, "--limit").is_err());
        assert!(parse_bounded(Some("-3"), 50, PROMOTE_LIMIT_RANGE, "--limit").is_err());
        assert!(parse_bounded(Some("ten"), 50, PROMOTE_LIMIT_RANGE, "--limit").is_err());
    }

    #[test]
    fn issue_assign_body_matches_update_schema() {
        assert_eq!(issue_assign_body("ag", None), Ok(json!({"assigneeAgentId": "ag"})));
        assert_eq!(issue_assign_body("ag", Some("todo")), Ok(json!({"assigneeAgentId": "ag", "status": "todo"})));
        assert!(issue_assign_body("ag", Some("open")).is_err());
        for st in ISSUE_STATUSES {
            assert!(check_status(st).is_ok());
        }
    }

    #[test]
    fn select_promotable_takes_oldest_backlog_of_the_agent() {
        let issues = vec![
            issue("new", "backlog", Some("a"), 1),
            issue("old", "backlog", Some("a"), 100),
            issue("mid", "backlog", Some("a"), 50),
            issue("todo", "todo", Some("a"), 200),
            issue("other", "backlog", Some("b"), 300),
        ];
        let ids = |v: Vec<&Value>| v.iter().map(|i| s(i, "/id").to_string()).collect::<Vec<_>>();
        assert_eq!(ids(select_promotable(&issues, "a", NOW, 0, 50)), vec!["old", "mid", "new"]);
        assert_eq!(ids(select_promotable(&issues, "a", NOW, 0, 2)), vec!["old", "mid"]);
        assert_eq!(ids(select_promotable(&issues, "a", NOW, 24 * 3600, 50)), vec!["old", "mid"]);
        assert!(select_promotable(&issues, "zzz", NOW, 0, 50).is_empty());
    }

    #[test]
    fn agent_error_entry_reports_reason_and_last_run() {
        let mut a = agent("x", "error", json!({"enabled": true, "wakeOnDemand": false}));
        a["errorReason"] = json!("e".repeat(1000));
        let run = json!({"status": "failed", "startedAt": "2026-09-30T10:00:00Z", "finishedAt": null, "createdAt": "2026-09-30T09:59:00Z", "error": "401 invalid key", "errorCode": "auth"});
        let e = agent_error_entry(&a, Some(&run));
        assert_eq!(e["error_reason"].as_str().map(|r| r.chars().count()), Some(SHORT_MAX_CHARS));
        assert_eq!(e["pause_reason"], Value::Null);
        assert_eq!(e["heartbeat"], json!({"enabled": true, "wake_on_demand": false}));
        assert_eq!(e["last_run"], json!({"status": "failed", "at": "2026-09-30T10:00:00Z", "error": "401 invalid key", "error_code": "auth"}));
        assert_eq!(agent_error_entry(&a, None)["last_run"], Value::Null);
    }

    #[test]
    fn tag_puts_company_first() {
        let t = tag("Hook0", json!({"issue": "HOO-1"}));
        let keys: Vec<&String> = t.as_object().map(|o| o.keys().collect()).unwrap_or_default();
        assert_eq!(keys, vec!["company", "issue"]);
        assert_eq!(t["company"], json!("Hook0"));
    }

    #[test]
    fn attention_items_map_to_contract() {
        let blocked = json!({"dedupKey": "blocked-owner:1", "subject": {"id": "i1", "identifier": "HOO-1", "title": "T"}, "whyNow": "needs FG", "activityAt": "2026-09-30T10:00:00Z"});
        assert_eq!(blocked_issue_entry(&blocked).map(|e| e["action"].clone()), Some(json!("needs FG")));
        assert!(blocked_issue_entry(&json!({"dedupKey": "blocker:1", "subject": {"id": "i1"}})).is_none());
        let rec = json!({"subject": {"id": "r1", "title": "restart", "metadata": {"sourceIssueId": "i9", "kind": "stalled", "cause": "no output"}}, "relatedIssue": {"identifier": "HOO-9", "title": "X"}});
        let e = recovery_entry(&rec).expect("entry");
        assert_eq!((s(&e, "/action_id"), s(&e, "/issue_id"), s(&e, "/next_action")), ("r1", "i9", "restart"));
        assert!(recovery_entry(&json!({})).is_none());
    }

    #[test]
    fn collect_flag_reads_repeated_values() {
        let a: Vec<String> = ["x", "--input", "k=v", "--input", "z=1", "--note"].iter().map(|s| s.to_string()).collect();
        assert_eq!(collect_flag(&a, "--input"), vec!["k=v", "z=1"]);
        assert_eq!(opt_flag(&a, "--note"), None);
        assert!(has_flag(&a, "--note"));
        assert!(tail(&a, 99).is_empty());
    }

    #[test]
    fn truncate_is_char_safe() {
        assert_eq!(truncate("éàü✓", 2), "éà");
        assert_eq!(truncated_field(&json!({"a": 1}), "/a", 5), Value::Null);
    }
}
