#!/usr/bin/env node
// process-run.js — scan recent Claude Code transcripts for <crl:run_start>/<crl:run_end>
// markers emitted by the code-review-loop skill, join with the harness-level Agent hook
// log (~/.claude/data/code-review-loop/agent-invocations.jsonl), and write one raw-data
// report per matched pair to ~/.claude/data/code-review-loop/runs/<id>.json.
//
// Idempotent: existing report files are never overwritten.
// Robust: orphan start markers (no end yet) still produce a partial report — once the
// end marker shows up on a later invocation, the file already exists and is skipped.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const PROJECTS_DIR = path.join(HOME, '.claude', 'projects');
const DATA_DIR = path.join(HOME, '.claude', 'data', 'code-review-loop');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const HOOK_LOG = path.join(DATA_DIR, 'agent-invocations.jsonl');
const TRANSCRIPT_AGE_HOURS = 24;

fs.mkdirSync(RUNS_DIR, { recursive: true });

function readJsonlSafe(fpath) {
  if (!fs.existsSync(fpath)) return [];
  const out = [];
  for (let line of fs.readFileSync(fpath, 'utf8').split('\n')) {
    line = line.trim();
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out;
}

function parseAttrs(s) {
  const out = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(s || '')) !== null) out[m[1]] = m[2];
  return out;
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(c => c && c.type === 'text')
    .map(c => c.text || '')
    .join('\n');
}

function listRecentTranscripts() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const cutoff = Date.now() - TRANSCRIPT_AGE_HOURS * 3600 * 1000;
  const out = [];
  for (const proj of fs.readdirSync(PROJECTS_DIR)) {
    const projPath = path.join(PROJECTS_DIR, proj);
    let stat;
    try { stat = fs.statSync(projPath); } catch { continue; }
    if (!stat.isDirectory()) continue;
    for (const fn of fs.readdirSync(projPath)) {
      if (!fn.endsWith('.jsonl')) continue;
      const fpath = path.join(projPath, fn);
      let mtime;
      try { mtime = fs.statSync(fpath).mtimeMs; } catch { continue; }
      if (mtime < cutoff) continue;
      out.push(fpath);
    }
  }
  return out;
}

function extractMarkers(transcriptLines) {
  const starts = [];
  const ends = [];
  for (const d of transcriptLines) {
    const msg = (d && d.message) ? d.message : {};
    const text = extractText(msg.content);
    if (!text) continue;
    const startRe = /<crl:run_start\s+([^>]*?)\/?>/g;
    const endRe = /<crl:run_end\s+([^>]*?)\/?>/g;
    let m;
    while ((m = startRe.exec(text)) !== null) {
      starts.push({ ts: d.timestamp || null, sessionId: d.sessionId, attrs: parseAttrs(m[1]) });
    }
    while ((m = endRe.exec(text)) !== null) {
      ends.push({ ts: d.timestamp || null, sessionId: d.sessionId, attrs: parseAttrs(m[1]) });
    }
  }
  return { starts, ends };
}

function pairMarkers(starts, ends) {
  // FIFO pairing within the same session. A start consumes the first unconsumed end
  // that comes after it. Unpaired starts (orphans) still produce a partial report.
  const pairs = [];
  const consumed = new Set();
  for (const s of starts) {
    let matchedIdx = -1;
    for (let i = 0; i < ends.length; i++) {
      if (consumed.has(i)) continue;
      const e = ends[i];
      if (e.sessionId !== s.sessionId) continue;
      if (e.ts && s.ts && e.ts < s.ts) continue;
      matchedIdx = i;
      break;
    }
    if (matchedIdx >= 0) {
      consumed.add(matchedIdx);
      pairs.push({ start: s, end: ends[matchedIdx] });
    } else {
      pairs.push({ start: s, end: null });
    }
  }
  return pairs;
}

function reportFilename(sessionId, startTs) {
  // Stable, predictable, sortable: <session8>-<YYYYMMDDTHHMMSS>.json
  const sid = (sessionId || 'unknown').slice(0, 8);
  const tsCompact = (startTs || new Date().toISOString())
    .replace(/[-:]/g, '')
    .replace(/\.\d+/, '')
    .replace(/Z$/, '');
  return `${sid}-${tsCompact}.json`;
}

function countFindingsNaive(responseText) {
  // Raw-only v1: just count plausible finding occurrences, no parsing of content.
  // - JSON line-anchored agents (Correctness, Tests, Skill, Subsystem, Occam Razor):
  //   each finding has a "signature" key — count those.
  // - Prose-tagged agents (Funnel L1/L2, Materiality, matt-review): each finding
  //   line starts with [must] or [suggestion].
  // - "No findings." literal as the ENTIRE response => 0. Must be whole-response,
  //   not line-anywhere — else a prose preamble "Here is my review:\nNo findings."
  //   followed by real [must] tags would silently zero the count.
  if (!responseText) return 0;
  if (/^\s*No findings\.?\s*$/.test(responseText)) return 0;
  const sigCount = (responseText.match(/"signature"\s*:/g) || []).length;
  if (sigCount > 0) return sigCount;
  const tagCount = (responseText.match(/\[(must|suggestion)\]/gi) || []).length;
  return tagCount;
}

function buildAgentEntry(hookEntry) {
  const raw = hookEntry.raw || {};
  const input = raw.tool_input || {};
  const resp = raw.tool_response || {};
  const usage = (resp.usage && typeof resp.usage === 'object') ? resp.usage : {};
  const responseText = extractText(resp.content);
  return {
    tool_use_id: raw.tool_use_id || null,
    ts: hookEntry.ts || null,
    description: input.description || '',
    subagent_type: input.subagent_type || null,
    model: input.model || resp.model || null,
    duration_ms: raw.duration_ms || resp.totalDurationMs || null,
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? null,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? null,
    response_text: responseText,
    findings_count: countFindingsNaive(responseText),
  };
}

function buildReport(pair, sessionId, hookEntries) {
  const { start, end } = pair;
  const startTs = start.ts;
  const endTs = end ? end.ts : null;

  const windowed = hookEntries.filter(h => {
    if (!h || !h.raw) return false;
    if (h.raw.session_id !== sessionId) return false;
    if (startTs && h.ts < startTs) return false;
    if (endTs && h.ts > endTs) return false;
    return true;
  });

  const agents = windowed.map(buildAgentEntry);

  const totalUsage = agents.reduce((acc, a) => ({
    input_tokens: (acc.input_tokens || 0) + (a.input_tokens || 0),
    output_tokens: (acc.output_tokens || 0) + (a.output_tokens || 0),
    cache_read_input_tokens: (acc.cache_read_input_tokens || 0) + (a.cache_read_input_tokens || 0),
    cache_creation_input_tokens: (acc.cache_creation_input_tokens || 0) + (a.cache_creation_input_tokens || 0),
  }), {});

  const trustBoundaries = (start.attrs.trust_boundaries || '')
    .split(',').map(s => s.trim()).filter(s => s && s !== 'none');

  return {
    schema_version: 1,
    session_id: sessionId,
    started_at: startTs,
    completed_at: endTs,
    end_marker_present: !!end,
    tier: start.attrs.tier || null,
    trust_boundaries: trustBoundaries,
    outcome: end ? (end.attrs.outcome || null) : null,
    iters: end && end.attrs.iters ? parseInt(end.attrs.iters, 10) : null,
    agents_count: agents.length,
    total_findings_naive: agents.reduce((s, a) => s + (a.findings_count || 0), 0),
    total_usage: totalUsage,
    agents,
  };
}

function main() {
  const hookEntries = readJsonlSafe(HOOK_LOG);
  const transcripts = listRecentTranscripts();
  if (transcripts.length === 0) {
    console.log(`[process-run] No transcripts in ${PROJECTS_DIR} modified in last ${TRANSCRIPT_AGE_HOURS}h.`);
    return;
  }

  let processed = 0;
  let skipped = 0;
  let orphans = 0;

  for (const fpath of transcripts) {
    const sessionId = path.basename(fpath, '.jsonl');
    const lines = readJsonlSafe(fpath);
    const { starts, ends } = extractMarkers(lines);
    if (starts.length === 0) continue;

    const pairs = pairMarkers(starts, ends);
    for (const pair of pairs) {
      const name = reportFilename(sessionId, pair.start.ts);
      const out = path.join(RUNS_DIR, name);

      const report = buildReport(pair, sessionId, hookEntries);
      // Skip false positives: prose that quotes the marker syntax in code fences
      // produces "markers" with zero matching Agent invocations in the time window.
      // Real runs have ≥ 5 agents (panel baseline). agents_count == 0 ⇒ skip.
      // (Also avoids racing the first invocation when no agent has hit the hook log yet.)
      if (report.agents_count === 0) {
        skipped++;
        continue;
      }

      // Idempotency-with-upgrade: existing complete report (end marker present) ⇒ skip.
      // Existing partial report (orphan from earlier invocation that ran before the
      // end marker was flushed) ⇒ rewrite, since this invocation may have the end
      // marker. Without this, an orphan written first wins forever.
      if (fs.existsSync(out)) {
        let existingComplete = false;
        try {
          existingComplete = !!JSON.parse(fs.readFileSync(out, 'utf8')).end_marker_present;
        } catch { /* malformed existing → fall through and rewrite */ }
        if (existingComplete || !pair.end) {
          skipped++;
          continue;
        }
      }

      if (!pair.end) orphans++;
      fs.writeFileSync(out, JSON.stringify(report, null, 2));
      console.log(
        `[process-run] Wrote ${name} — agents=${report.agents_count} findings_naive=${report.total_findings_naive}${pair.end ? '' : ' (orphan: no end marker yet)'}`
      );
      processed++;
    }
  }

  console.log(`[process-run] processed=${processed} skipped=${skipped} orphan_starts=${orphans}`);
}

main();
