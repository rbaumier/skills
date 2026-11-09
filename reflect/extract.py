#!/usr/bin/env python3
"""Turn a run's raw trail into flat tables for /reflect.

usage: extract.py <out-dir> <report-root> <session.jsonl>...
       extract.py sessions <report-root> <project-dir> <own-session-id>
"""
import collections
import json
import pathlib
import re
import sys
from datetime import datetime

if len(sys.argv) < 4:
    sys.exit(__doc__.strip())
if sys.argv[1] == "sessions":
    # The run's own record first: loop-issues writes `session: <id>` in state.md.
    state = pathlib.Path(sys.argv[2]) / "state.md"
    ids = re.findall(r"^session: (\S+)$", state.read_text(), re.M) if state.exists() else []
    if ids:
        for i in ids:
            print(pathlib.Path(sys.argv[3]) / f"{i}.jsonl")
        sys.exit(0)
    # Older runs: a session belongs when most of its report references name it.
    run = pathlib.Path(sys.argv[2]).name
    for f in sorted(pathlib.Path(sys.argv[3]).glob("*.jsonl")):
        if f.stem == sys.argv[4]:
            continue
        refs = collections.Counter(re.findall(r"loop-reports/([\w.-]+)/", f.read_text(errors="replace")))
        if refs and refs.most_common(1)[0][0] == run:
            print(f)
    sys.exit(0)
out, root = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
sessions = [pathlib.Path(p) for p in sys.argv[3:]]
out.mkdir(parents=True, exist_ok=True)


def tsv(name, header, rows):
    with open(out / name, "w") as f:
        f.write("\t".join(header) + "\n")
        for r in rows:
            f.write("\t".join(str(c).replace("\t", " ").replace("\n", " ⏎ ") for c in r) + "\n")


def lines(path):
    for n, raw in enumerate(open(path, errors="replace"), 1):
        try:
            yield n, json.loads(raw)
        except json.JSONDecodeError:
            continue


def blocks(o):
    c = o.get("message", {}).get("content")
    return c if isinstance(c, list) else [{"type": "text", "text": c or ""}]


def text_of(content):
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
    return str(content or "")


def norm(s):
    s = re.sub(r"/[\w./@-]+", "<path>", s)
    s = re.sub(r"\b[0-9a-f]{7,40}\b", "<sha>", s)
    return re.sub(r"\d+", "N", s)[:160]


def minutes(ts):
    if len(ts) < 2:
        return ""
    p = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
    return round((p(ts[-1]) - p(ts[0])).total_seconds() / 60, 1)


def program(cmd):
    for seg in re.split(r"&&|;|\|\|", cmd):
        words = [w for w in seg.split() if not re.match(r"\w+=", w)]
        if words and words[0] not in ("cd", "export", "set"):
            return words[0]
    return "?"


# --- One pass per transcript: orchestrator sessions and every subagent
spawns, errors, repeats, reports, sends, prompts, user_rows = [], [], [], [], [], [], []
noise = ("<task-notification", "<system-reminder", "<local-command", "Base directory for this skill")


def mine(tr, aid, kind, desc, finished, orchestrator):
    calls, ts, cmds, inputs, first, last, example = 0, [], collections.Counter(), {}, None, "", {}
    for n, o in lines(tr):
        if o.get("type") not in ("user", "assistant"):
            continue
        if o.get("timestamp"):
            ts.append(o["timestamp"])
        bs = blocks(o)
        if orchestrator and o["type"] == "user" and not o.get("isMeta"):
            t = text_of(o["message"].get("content")).strip()
            if t and not t.startswith(noise) and not any(b.get("type") == "tool_result" for b in bs):
                src = "command" if t.startswith("<command-") else "relay" if re.match(r"(?i)de la part de", t) else "romain"
                user_rows.append((tr.name, n, o.get("timestamp", ""), src, t))
        for b in bs:
            if first is None and o["type"] == "user" and b.get("type") == "text":
                first = b.get("text", "")
            if o["type"] == "assistant" and b.get("type") == "text" and b.get("text", "").strip():
                last = b["text"]
            if b.get("type") == "tool_use":
                calls += 1
                inp = b.get("input", {})
                inputs[b.get("id")] = (b.get("name"), inp.get("command", ""))
                if b.get("name") == "Bash" and inp.get("command"):
                    key = norm(inp["command"])  # same chore, different slot or path
                    cmds[key] += 1
                    example.setdefault(key, inp["command"][:300])
                if b.get("name") == "SendMessage":
                    sends.append((aid, o.get("timestamp", ""), inp.get("to", ""), text_of(inp.get("message", ""))))
            if b.get("type") == "tool_result" and b.get("is_error"):
                tool, cmd = inputs.get(b.get("tool_use_id"), ("?", ""))
                err = norm(text_of(b.get("content")))
                if err.startswith("Exit code"):  # group ordinary failures by the program that failed
                    err = f"Exit code · {program(cmd)}"
                errors.append((aid, kind, desc, tool, err))
    errs = sum(1 for e in errors if e[0] == aid)
    spawns.append((aid, kind, desc, ts[0] if ts else "", minutes(ts), calls, errs, finished))
    repeats.extend((aid, kind, desc, k, c, example[c]) for c, k in cmds.items() if k >= 3)
    reports.append((aid, kind, desc, last))
    if first and not orchestrator:
        prompts.append(first)


for s in sessions:
    mine(s, f"orchestrator:{s.stem[:8]}", "orchestrator", s.name, "", True)
    for meta in sorted((s.with_suffix("") / "subagents").glob("*.meta.json")):
        m = json.loads(meta.read_text())
        tr = meta.with_name(meta.name.replace(".meta.json", ".jsonl"))
        if tr.exists():
            mine(tr, tr.stem, m.get("agentType", "?"), m.get("description", ""), m.get("finished", ""), False)

tsv("user.tsv", ("session", "line", "ts", "source", "message"), user_rows)
tsv("spawns.tsv", ("agent", "type", "description", "start", "minutes", "tool_calls", "tool_errors", "finished"), spawns)
tsv("errors.tsv", ("agent", "type", "description", "tool", "error"), errors)
kinds = collections.Counter((e[1], e[3], e[4]) for e in errors)
tsv("error_kinds.tsv", ("count", "type", "tool", "error"), sorted(((n, *k) for k, n in kinds.items()), reverse=True))
tsv("repeats.tsv", ("agent", "type", "description", "times", "pattern", "example"), sorted(repeats, key=lambda r: -r[3]))
tsv("reports.tsv", ("agent", "type", "description", "final_text"), reports)
tsv("sends.tsv", ("from", "ts", "to", "message"), sends)

# Instructions pasted into many briefs = a rule missing from the agent file.
seen = collections.Counter()
for p in prompts:
    seen.update({l.strip() for l in p.splitlines() if len(l.strip()) > 40})
tsv("boilerplate.tsv", ("briefs", "line"), sorted(((n, l) for l, n in seen.items() if n >= 5), reverse=True))

# --- Findings of every judging file, numbered so coding can be checked
SEV = {
    "review": r"\b(blocker|major|minor|nit|bloquant|majeur|mineur)\b",
    "qa": r"\b(critical|high|medium|low|critique|haute|moyenne|basse)\b",
}
item_re = re.compile(r"^(?:- |\d+\. |\|).*?(?=^- |^\d+\. |^\||^#|\Z)", re.M | re.S)
verdict_re = re.compile(
    r"^(MERGEABLE|REWORK|NEEDS-CLARIFICATION|BLOCKED|DONE|GO-PROVISIONAL|GO|NO-GO|ABORTED)\b", re.M
)
judging = [(f, "review") for g in ("review-*.md", "contract-review*.md") for f in root.rglob(g)]
judging += [(f, "qa") for f in root.rglob("verdict*.md")]
findings, verdict_of = [], collections.defaultdict(list)
for f, family in sorted(judging):
    if f.name.endswith(".done"):
        continue
    body = f.read_text(errors="replace")
    v = verdict_re.findall(body)
    rel = f.relative_to(root)
    verdict_of[rel.parts[0] if len(rel.parts) > 1 else "(root)"].append(v[-1] if v else "?")
    for item in item_re.findall(body):
        if re.search(SEV[family], item, re.I) and not re.fullmatch(r"\|[\s|:-]*", item.strip()):
            findings.append((str(rel), v[-1] if v else "?", item.strip()))
with open(out / "findings.md", "w") as fh:
    for i, (rel, v, item) in enumerate(findings, 1):
        fh.write(f"### F{i:04d} {rel} ({v})\n{item}\n\n")

# --- comply triage lines; a non-empty file that parses to nothing is named
comply, unparsed = [], []
for t in sorted(root.rglob("comply-triage*.md")):
    rows = 0
    text = t.read_text(errors="replace")
    for l in text.splitlines():
        parts = [x.strip() for x in l.strip("-| ").split(" — ")]
        if len(parts) >= 4 and re.fullmatch(r"[a-z0-9-]+", parts[0]):
            comply.append((str(t.relative_to(root)), *parts[:4], " — ".join(parts[4:])))
            rows += 1
    if not rows and text.strip() and not re.search(r"\b(0|no) findings?\b", text, re.I):
        unparsed.append((str(t.relative_to(root)), len(text.splitlines())))
tsv("comply.tsv", ("file", "rule", "path", "count", "scope", "disposition"), comply)
tsv("comply_unparsed.tsv", ("file", "lines"), unparsed)

# --- Per lot dir
lots = []
for d in sorted(p for p in root.iterdir() if p.is_dir()):
    count = lambda g: sum(1 for f in d.glob(g) if f.is_file() and not f.name.endswith(".done"))
    lots.append((d.name, sum(1 for f in d.rglob("*") if f.is_file()), count("contract-review*.md"),
                 count("review-*.md"), " ".join(verdict_of.get(d.name, [])), count("ship-*.md"),
                 count("merge-*.md"), count(".rework"), count("decision.md"), count("clarification-note.md")))
tsv("lots.tsv", ("lot", "files", "contract_reviews", "reviews", "verdicts", "ships", "merges", "reworks",
                 "decisions", "clarifications"), lots)

# --- Artifact inventory: the analyst fills `point` for every kind
kind, example = collections.Counter(), {}
for f in root.rglob("*"):
    if f.is_file() and not f.name.endswith(".done"):
        k = re.sub(r"\d+", "N", f.name)
        kind[k] += 1
        example.setdefault(k, str(f.relative_to(root)))
tsv("artifacts.tsv", ("count", "kind", "example", "point"),
    sorted(((n, k, example[k], "") for k, n in kind.items()), reverse=True))

print(f"{out}: {len(sessions)} sessions, {len(user_rows)} user turns, {len(spawns)} transcripts, "
      f"{len(errors)} tool errors, {len(sends)} sends, {len(findings)} findings, {len(comply)} comply lines "
      f"({len(unparsed)} triage files unparsed), {len(lots)} lot dirs, {len(kind)} artifact kinds")
