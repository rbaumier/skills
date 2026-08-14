import { codeToHtml } from 'shiki';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REPO = '/Users/rbaumier/www/natalia/natalia-voicehandler';
const OUT = '/Users/rbaumier/www/natalia/mr-docs/voicehandler-mr52-chain-v5.html';
// Overlay diff des popups : base de la MR (branche cible ou merge-base). Le code affiché
// vient du working tree (readFileSync), donc `git diff DIFF_BASE -- <path>` mappe pile
// dessus (côté « nouveau » = working tree). Mettre la branche cible réelle de la MR.
const DIFF_BASE = 'main';

// ---------- extraction du vrai code depuis le repo ----------
// `src` mémorise le chemin par texte source et `extract` la plage de chaque bloc extrait :
// de quoi reposer le diff sur les bons numéros de ligne sans table de provenance à tenir.
const _srcPath = new Map();
const _blockMeta = new Map(); // texte extrait -> { path, startLine, indent }
const src = (p) => {
  const t = readFileSync(`${REPO}/${p}`, 'utf8');
  _srcPath.set(t, p);
  return t;
};

function extract(source, marker, { withDocs = true } = {}) {
  const lines = source.split('\n');
  const i = lines.findIndex((l) => l.includes(marker));
  if (i < 0) throw new Error(`marker not found: ${marker}`);
  const indent = lines[i].match(/^\s*/)[0];
  let start = i;
  if (withDocs) {
    while (start > 0 && /^\s*(\/\/\/|#\[)/.test(lines[start - 1])) start--;
  }
  let end = i;
  while (end < lines.length && lines[end] !== `${indent}}`) end++;
  if (end >= lines.length) throw new Error(`end not found for: ${marker}`);
  const snippet = lines
    .slice(start, end + 1)
    .map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l))
    .join('\n');
  _blockMeta.set(snippet, { path: _srcPath.get(source), startLine: start + 1, indent });
  return snippet;
}

// signatures des fns d'un module (top-level) ou d'un bloc `impl X`, sans les corps
function fnSignatures(source, { impl: implName = null } = {}) {
  let text = source;
  const t = text.indexOf('#[cfg(test)]');
  if (t >= 0) text = text.slice(0, t);
  let lines = text.split('\n');
  if (implName) {
    const i = lines.findIndex((l) => l.startsWith(`impl ${implName}`));
    if (i < 0) throw new Error(`impl not found: ${implName}`);
    let end = i + 1;
    while (end < lines.length && lines[end] !== '}') end++;
    if (end >= lines.length) throw new Error(`impl end not found: ${implName}`);
    lines = lines.slice(i + 1, end).map((l) => (l.startsWith('  ') ? l.slice(2) : l));
  }
  const sigs = [];
  for (let k = 0; k < lines.length; k++) {
    if (!/^(pub(\([a-z]+\))?\s+)?(async\s+)?fn\s/.test(lines[k])) continue;
    const sig = [];
    let j = k;
    while (j < lines.length && !/\{\s*$/.test(lines[j])) { sig.push(lines[j]); j++; }
    if (j >= lines.length) throw new Error(`body opener not found for: ${lines[k]}`);
    sig.push(lines[j].replace(/\s*\{\s*$/, ';'));
    sigs.push(sig.join('\n'));
    while (j < lines.length && lines[j] !== '}') j++;
    k = j;
  }
  if (!sigs.length) throw new Error(`no fn signatures found${implName ? ` in impl ${implName}` : ''}`);
  return sigs;
}

const indent2 = (s) => s.split('\n').map((l) => (l ? `  ${l}` : l)).join('\n');

const modSkeleton = (name, source) =>
  `mod ${name} {\n${fnSignatures(source).map(indent2).join('\n\n')}\n}`;

const structSkeleton = (name, source) =>
  `${extract(source, `pub struct ${name}`)}\n\nimpl ${name} {\n${fnSignatures(source, { impl: name }).map(indent2).join('\n\n')}\n}`;

const onClose = src('crates/core/src/utils/toolcall/on_close.rs');
const executor = src('crates/core/src/utils/toolcall/executor.rs');
const customEntities = src('crates/core/src/database/custom_entities/mod.rs');
const connectorEntity = src('crates/core/src/database/entities/connector.rs');
const messenger = src('crates/voice/src/domain/entities/messenger.rs');
const apiConnector = src('crates/core/src/services/connectors/api_connector.rs');
const historySupervisor = src('crates/voice/src/domain/entities/history/history_supervisor.rs');

const code = {
  run_closing_turn: extract(historySupervisor, 'async fn run_closing_turn(', { withDocs: false }),
  on_close: extract(onClose, 'pub async fn on_close(request', { withDocs: false }),
  close_one_connector: extract(onClose, 'async fn close_one_connector(', { withDocs: false }),
  request_forced_toolcall: extract(onClose, 'async fn request_forced_toolcall(', { withDocs: false }),
  execute_custom_connectors: extract(executor, 'pub async fn execute_custom_connectors(', { withDocs: false }),
  execute: extract(apiConnector, 'pub async fn execute(&self)', { withDocs: false }),
  OnCloseRequest: extract(onClose, "pub struct OnCloseRequest<'a>"),
  ClosingTurn: extract(onClose, 'pub struct ClosingTurn'),
  ConnectorOutcome: extract(onClose, 'enum ConnectorOutcome'),
  ExecuteConnectorsRequest: extract(executor, 'pub struct ExecuteConnectorsRequest'),
  ToolCallResult: extract(customEntities, 'pub struct ToolCallResult'),
  ToolCallingInfo: extract(customEntities, 'pub struct ToolCallingInfo'),
  Connector: extract(connectorEntity, 'pub struct Connector {'),
  EndBundle: extract(messenger, 'pub struct EndBundle'),
  ApiConnector: extract(apiConnector, 'pub struct ApiConnector'),
};

// ---------- étapes numérotées : ancres → plages de lignes ----------
function stepRanges(snippet, defs) {
  const lines = snippet.split('\n');
  const findFrom = (substr) => {
    const i = lines.findIndex((l) => l.includes(substr));
    if (i < 0) throw new Error(`from anchor not found: ${substr}`);
    return i;
  };
  return defs.map((d, k) => {
    const fi = findFrom(d.from);
    let ti;
    if (d.to === undefined) ti = fi;
    else if (d.to === 'END') ti = lines.length - 2;
    else if (typeof d.to === 'object' && d.to.exact) {
      ti = lines.findIndex((l, idx) => idx > fi && l === d.to.exact);
      if (ti < 0) throw new Error(`exact anchor not found: "${d.to.exact}" after "${d.from}"`);
    } else {
      ti = lines.findIndex((l, idx) => idx >= fi && l.includes(d.to));
      if (ti < 0) throw new Error(`to anchor not found: ${d.to}`);
    }
    return { n: k + 1, from: fi + 1, to: ti + 1 + (d.plus || 0) };
  });
}

// ---------- highlight ----------
// lignes shiki collées (une `.line` = un bloc en CSS) : plus de double interligne
const stripLineBreaks = (h) => h.replace(/<\/span>\n(<span class="line")/g, '</span>$1');
const hl = async (c) => stripLineBreaks(await codeToHtml(c, { lang: 'rust', theme: 'github-light' }));
const hlInline = (c) => codeToHtml(c, { lang: 'rust', theme: 'github-light', structure: 'inline' });

const boldCallees = (html, names) => {
  let out = html;
  for (const n of names) {
    out = out.replace(new RegExp(`([ >(])(${n})(</span>)`, 'g'), '$1<b class="callee">$2</b>$3');
  }
  return out;
};

async function hlFn(codeStr, stepDefs, callees, phrases) {
  const steps = stepRanges(codeStr, stepDefs);
  let html = await codeToHtml(codeStr, {
    lang: 'rust',
    theme: 'github-light',
    transformers: [{
      line(node, line) {
        const s = steps.find((st) => line === st.from);
        if (!s) return;
        node.properties ??= {};
        node.properties['data-s'] = String(s.n);
      },
    }],
  });
  // phrase d'étape insérée en tête de chaque bloc, sur la ligne du badge
  for (const s of steps) {
    const marker = `<span class="line" data-s="${s.n}">`;
    const idx = html.indexOf(marker);
    if (idx < 0) throw new Error(`line marker not found for step ${s.n}`);
    const header = `<span class="stepline"><span class="sn">${s.n}</span><span class="stept">${phrases[s.n - 1]}</span></span>\n`;
    html = html.slice(0, idx) + header + html.slice(idx);
  }
  return stripLineBreaks(boldCallees(html, callees));
}

// ---------- overlay diff : lignes ajoutées (vert) / supprimées (rouge) dans le code des popups ----------
// La provenance vient de `_blockMeta` (remplie par extract) : aucune table à maintenir. No-op
// pour les squelettes composés (modSkeleton/structSkeleton, absents de _blockMeta) et pour les
// fichiers que la MR ne touche pas.
const _diffCache = {};
function fileDiff(path) {
  if (!path) return null;
  if (_diffCache[path]) return _diffCache[path];
  let out = '';
  try {
    out = execFileSync('git', ['-C', REPO, 'diff', '--unified=0', '--no-color', DIFF_BASE, '--', path], { encoding: 'utf8' });
  } catch {
    out = '';
  }
  const added = new Set(); // n° de ligne (côté nouveau) ajoutés
  const removedBefore = new Map(); // n° de ligne -> [lignes supprimées à insérer avant]
  let newLn = 0;
  for (const ln of out.split('\n')) {
    const m = ln.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const s = +m[1];
      const c = m[2] === undefined ? 1 : +m[2];
      newLn = c === 0 ? s + 1 : s; // suppression pure → ancrer après la ligne s
      continue;
    }
    if (ln.startsWith('+++') || ln.startsWith('---')) continue;
    if (ln[0] === '+') {
      added.add(newLn);
      newLn++;
    } else if (ln[0] === '-') {
      if (!removedBefore.has(newLn)) removedBefore.set(newLn, []);
      removedBefore.get(newLn).push(ln.slice(1));
    }
  }
  return (_diffCache[path] = { added, removedBefore });
}

async function applyDiff(html, codeKey) {
  const meta = _blockMeta.get(code[codeKey]);
  if (!meta) return html;
  const diff = fileDiff(meta.path);
  if (!diff || (diff.added.size === 0 && diff.removedBefore.size === 0)) return html;
  const { added, removedBefore } = diff;
  const dedent = (l) => (l.startsWith(meta.indent) ? l.slice(meta.indent.length) : l);
  const re = /<span class="line"( data-s="\d+")?>/g;
  let m;
  let lineNo = 0;
  let last = 0;
  let out = '';
  while ((m = re.exec(html)) !== null) {
    lineNo++;
    const L = meta.startLine + lineNo - 1;
    out += html.slice(last, m.index);
    if (removedBefore.has(L)) {
      for (const raw of removedBefore.get(L)) out += `<span class="line dfd">${await hlInline(dedent(raw))}</span>`;
    }
    out += added.has(L) ? `<span class="line dfa"${m[1] || ''}>` : m[0];
    last = re.lastIndex;
  }
  return out + html.slice(last);
}

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// ---------- briques HTML ----------
const kw = (t) => `<span class="kw">${esc(t)}</span>`;
const ty0 = (t) => `<span class="ty0">${esc(t)}</span>`;

const tok = (cls, text, pop, pr = false) =>
  `<span class="tok ${cls}${pr ? ' pr' : ''}">${esc(text)}<span class="pop">${pop}</span></span>`;

const intro = (what, steps) =>
  `<span class="intro"><span class="what">${what}</span><ul>${steps
    .map((s, i) => `<li data-s="${i + 1}"><span class="sn">${i + 1}</span><span>${s}</span></li>`)
    .join('')}</ul></span>`;

const fnPop = async (what, steps, codeKey, stepDefs, callees = []) =>
  `<span class="card">${intro(what, steps)}${await applyDiff(await hlFn(code[codeKey], stepDefs, callees, steps), codeKey)}</span>`;

const defPop = async (decl, defKey) => {
  const declHtml = `<pre class="decl">${await hlInline(decl)}</pre>`;
  const defHtml = defKey ? await applyDiff(await hl(code[defKey]), defKey) : '';
  return `<span class="card">${declHtml}${defHtml}</span>`;
};

// ---------- popups ----------
const pops = {
  run_closing_turn: await fnPop(
    "Joue le tour de clôture au raccrochage. Best-effort : aucun échec ici ne bloque la fermeture.",
    [
      "saute si l'appel n'a pas eu lieu (non décroché) ou a planté",
      "prépare l'historique, les variables connecteurs et le contexte de traçage",
      "délègue à <b>on_close</b> — <code>None</code> : rien à enregistrer",
      "plie le résultat en un turn et l'écrit dans l'historique de la conversation",
    ],
    'run_closing_turn',
    [
      { from: 'if !should_run_closing_turn', to: { exact: '  }' } },
      { from: 'let connector_var_bundle', to: { exact: '  };' } },
      { from: 'let Some(closing_turn) = on_close(', to: { exact: '  };' } },
      { from: 'let mut turn = Turn::new();', to: '.inspect_err' },
    ],
    ['on_close'],
  ),
  on_close: await fnPop(
    "Décide quels connecteurs CLOSE doivent tourner, et les exécute un par un. Doctrine : <b>un doublon est pire qu'un manque</b>.",
    [
      "rien sans connecteur <code>CLOSE</code>",
      "rien si l'utilisateur n'a jamais parlé",
      "registre des exécutions illisible → rien (dans le doute, ne pas exécuter)",
      "écarte les connecteurs déjà exécutés",
      "boucle séquentielle, 60 s max chacun — un échec ne stoppe pas les suivants",
      "rien n'a tourné → <code>None</code>",
    ],
    'on_close',
    [
      { from: 'let eligible_connectors', to: { exact: '  }' } },
      { from: '// Nothing to extract', to: { exact: '  }' } },
      { from: 'let already_executed_connector_ids', to: { exact: '  };' } },
      { from: 'let connectors_to_run', to: { exact: '  }' } },
      { from: 'let mut executions', to: { exact: '  }' } },
      { from: '// Every pending connector was skipped', to: '.then_some' },
    ],
    ['close_one_connector'],
  ),
  close_one_connector: await fnPop(
    "Traite un connecteur, du LLM à l'appel HTTP.",
    [
      "demande au LLM de remplir les arguments (à droite)",
      "re-vérifie en base qu'il n'a pas déjà été exécuté — sinon <code>Skipped</code>",
      "exécute l'appel HTTP",
      "le tout borné à 60 s — dépassé → <code>Failed</code>",
    ],
    'close_one_connector',
    [
      { from: 'let toolcall = match request_forced_toolcall', to: { exact: '    };' } },
      { from: '// Dedup re-check', to: { exact: '    }' } },
      { from: 'let pairs = execute_custom_connectors(', to: 'ConnectorOutcome::Executed(pairs)' },
      { from: 'match tokio::time::timeout(', to: { exact: '  }' } },
    ],
    ['request_forced_toolcall', 'execute_custom_connectors'],
  ),
  request_forced_toolcall: await fnPop(
    "Obtient du LLM un appel d'outil pour ce connecteur — c'est lui qui rédige les arguments (le summary…).",
    [
      "le connecteur devient le seul outil proposé",
      "1ᵉʳ essai : appel forcé (<code>tool_choice: Required</code>)",
      "refus → 2ᵉ essai insistant (<code>Auto</code>), sinon abandon",
    ],
    'request_forced_toolcall',
    [
      { from: 'let tool = connector_tool(connector)?;' },
      { from: 'match completion_attempt(', to: 'Ok(call) => Ok(call),' },
      { from: 'Err(required_failure) => {', to: { exact: '    }' } },
    ],
    [],
  ),
  execute_custom_connectors: await fnPop(
    "Exécute les appels HTTP des connecteurs et trace chaque exécution en base (livré par la MR A, inchangé ici).",
    [
      "une tâche par connecteur Custom",
      "ligne <code>pending</code> écrite <b>avant</b> l'envoi — c'est l'anti-doublon",
      "l'appel HTTP, borné par le timeout reçu",
      "2xx → <code>succeeded</code>, tout le reste → <code>failed</code> — l'issue est enregistrée",
      "résultats remis en ordre ; une tâche qui panique → 500",
    ],
    'execute_custom_connectors',
    [
      { from: 'for (idx, tci) in tool_calling_infos', to: 'let handle = spawn(' },
      { from: 'BEFORE the HTTP request', to: 'None => None,', plus: 1 },
      { from: 'let connector = ApiConnector::new(', to: 'let result = connector.execute().await;' },
      { from: 'let tool_call_result = match result {', to: 'record_execution_outcome(ctx, execution_id, &tool_call_result).await;', plus: 1 },
      { from: 'let now = Utc::now();', to: 'END' },
    ],
    ['execute'],
  ),
  execute: await fnPop(
    "Envoie la requête HTTP au système du client.",
    [
      "borné par le timeout de l'exécuteur (30 s au close)",
      "sans timeout : appel direct (voice en cours d'appel, analysis)",
    ],
    'execute',
    [
      { from: 'Some(limit) =>', to: { exact: '      }),' } },
      { from: 'None => self.send_request().await,' },
    ],
    [],
  ),
  conversation_id: await defPop('conversation_id: Uuid', null),
  end_bundle: await defPop('end_bundle: &EndBundle', 'EndBundle'),
  request_onclose: await defPop("request: OnCloseRequest<'_>", 'OnCloseRequest'),
  request_onclose_ref: await defPop("request: &OnCloseRequest<'_>", 'OnCloseRequest'),
  connector: await defPop('connector: &Connector', 'Connector'),
  request_exec: await defPop('request: ExecuteConnectorsRequest', 'ExecuteConnectorsRequest'),
  self_api: await defPop('self: &ApiConnector', 'ApiConnector'),
  ClosingTurn: await defPop("-> Option<ClosingTurn>", 'ClosingTurn'),
  ConnectorOutcome: await defPop('-> ConnectorOutcome', 'ConnectorOutcome'),
  ToolCallResult: await defPop('-> Vec<(ToolCallResult, ToolCallingInfo)>', 'ToolCallResult'),
  ToolCallingInfo: await defPop('-> Vec<(ToolCallResult, ToolCallingInfo)>', 'ToolCallingInfo'),
  mod_on_close: `<span class="card">${await hl(modSkeleton('on_close', onClose))}</span>`,
  mod_executor: `<span class="card">${await hl(modSkeleton('executor', executor))}</span>`,
  owner_history: `<span class="card">${await hl(structSkeleton('HistorySupervisor', historySupervisor))}</span>`,
  owner_api: `<span class="card">${await hl(structSkeleton('ApiConnector', apiConnector))}</span>`,
};

// ---------- signatures ----------
const sigs = {
  n1: `${kw('async')} ${kw('fn')} ${tok('ty0', 'HistorySupervisor', pops.owner_history)}.${tok('fname', 'run_closing_turn', pops.run_closing_turn)}(<span class="slf">&amp;self</span>, ${tok('par', 'conversation_id', pops.conversation_id)}, ${tok('par', 'end_bundle', pops.end_bundle, true)})`,
  n2: `${kw('pub')} ${kw('async')} ${kw('fn')} ${tok('mod', 'on_close', pops.mod_on_close)}::${tok('fname', 'on_close', pops.on_close)}(${tok('par', 'request', pops.request_onclose)}) ${kw('->')} ${ty0('Option')}&lt;${tok('ty', 'ClosingTurn', pops.ClosingTurn, true)}&gt;`,
  n3: `${kw('async')} ${kw('fn')} ${tok('mod', 'on_close', pops.mod_on_close)}::${tok('fname', 'close_one_connector', pops.close_one_connector)}(${tok('par', 'request', pops.request_onclose_ref)}, ${tok('par', 'connector', pops.connector)}) ${kw('->')} ${tok('ty', 'ConnectorOutcome', pops.ConnectorOutcome)}`,
  n3b: `${kw('async')} ${kw('fn')} ${tok('mod', 'on_close', pops.mod_on_close, true)}::${tok('fname', 'request_forced_toolcall', pops.request_forced_toolcall, true)}(${tok('par', 'request', pops.request_onclose_ref, true)}, ${tok('par', 'connector', pops.connector, true)}) ${kw('->')} ${ty0('Result')}&lt;<span class="ty0">ToolCall</span>, <span class="ty0">Error</span>&gt;`,
  n4: `${kw('pub')} ${kw('async')} ${kw('fn')} ${tok('mod', 'executor', pops.mod_executor)}::${tok('fname', 'execute_custom_connectors', pops.execute_custom_connectors)}(${tok('par', 'request', pops.request_exec, true)}) ${kw('->')} ${ty0('Vec')}&lt;(${tok('ty', 'ToolCallResult', pops.ToolCallResult, true)}, ${tok('ty', 'ToolCallingInfo', pops.ToolCallingInfo)})&gt;`,
  n5: `${kw('pub')} ${kw('async')} ${kw('fn')} ${tok('ty0', 'ApiConnector', pops.owner_api)}.${tok('fname', 'execute', pops.execute)}(${tok('slf', '&self', pops.self_api)}) ${kw('->')} ${ty0('Result')}&lt;(<span class="ty0">StatusCode</span>, <span class="ty0">String</span>), <span class="ty0">Error</span>&gt;`,
};

// ---------- fragments partagés (standalone + injection section 06) ----------
const graphCss = `  .g6 { position: relative; left: 50%; transform: translateX(-50%); width: min(960px, calc(100vw - 48px)); padding: 26px 0 10px; }
  .g6 .node {
    background: #fff; border: 1px solid var(--code-border); border-radius: 7px;
    padding: 7px 13px; box-shadow: 0 1px 2px rgba(30, 40, 35, 0.05);
    width: max-content; max-width: min(820px, 100%); margin: 0 auto;
    position: relative;
  }
  /* z-index : au survol, élever le conteneur .g6 (chaque graphe est un contexte d'empilement
     via transform — sinon un graphe suivant recouvre la popup) ET le nœud survolé (sinon un
     nœud voisin du même graphe la recouvre). Vérifier avec elementFromPoint dans Chrome. */
  .g6:has(.tok:hover) { z-index: 60; }
  .g6 .node:has(.tok:hover) { z-index: 60; }
  .g6 .nsig {
    display: block; font: 600 13px/1.75 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #24292E; white-space: pre-wrap;
  }
  .g6 .kw { color: #D73A49; }
  .g6 .mod { color: var(--muted); }
  .g6 .ty0 { color: #6F42C1; }
  .g6 .slf { color: #005CC5; }
  .g6 .fname { color: #6F42C1; }
  .g6 .par { color: #24292E; }
  .g6 .tok.slf { color: #005CC5; }

  .g6 .tok { position: relative; cursor: help; border-bottom: 1px dotted #B4BBB3; }
  .g6 .tok:hover { background: var(--accent-wash); border-bottom: 1px dotted var(--accent); border-radius: 2px; }
  .g6 .tok > .pop { display: none; position: absolute; left: -8px; top: 100%; padding-top: 8px; z-index: 50; white-space: normal; cursor: auto; }
  .g6 .tok.pr > .pop { left: auto; right: -8px; }
  .g6 .tok:hover > .pop { display: block; }

  .g6 .card {
    display: block; background: #fff; border: 1px solid var(--code-border); border-radius: 8px;
    box-shadow: 0 14px 38px rgba(30, 40, 35, 0.18);
    width: max-content; max-width: min(760px, 86vw); text-align: left; overflow: hidden;
  }
  .g6 .card .intro {
    display: block; padding: 11px 14px 10px; border-bottom: 1px solid var(--rule);
    font: 400 14px/1.6 -apple-system, "Segoe UI", sans-serif; color: var(--ink);
  }
  .g6 .card .intro .what { display: block; font-weight: 600; margin-bottom: 6px; }
  .g6 .card .intro ul { margin: 0; padding: 0; list-style: none; color: var(--muted); }
  .g6 .card .intro li { display: flex; gap: 8px; align-items: baseline; margin: 0; padding: 2px 5px; border-radius: 4px; }
  .g6 .card .intro b { color: var(--ink); }
  .g6 .card .intro code { font: 12px ui-monospace, Menlo, monospace; color: var(--accent-ink); }
  .g6 .card pre {
    margin: 0; padding: 10px 13px; max-height: 56vh; overflow: auto;
    font: 400 11.5px/1.62 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    text-align: left;
  }
  .g6 .card pre code { font: inherit; }
  /* display:block seulement sur le wrapper shiki (enfant direct), jamais sur les <code> inline
     des steplines (sinon un <code> casse la phrase sur sa propre ligne). */
  .g6 .card pre > code { display: block; }
  /* chaque ligne en bloc pour un fond diff pleine largeur + gouttière +/- ; min-width pour que
     le fond couvre aussi les lignes qui débordent (le pre scrolle). */
  .g6 .card pre .line { display: block; min-width: max-content; }
  .g6 .card pre .line::before { content: ""; display: inline-block; width: 1.4ch; margin-right: 4px; color: #B4BBB3; }
  .g6 .card pre .line.dfa { background: #E6FFEC; }
  .g6 .card pre .line.dfd { background: #FFEBE9; }
  .g6 .card pre .line.dfa::before { content: "+"; color: #1A7F37; font-weight: 700; }
  .g6 .card pre .line.dfd::before { content: "-"; color: #CF222E; font-weight: 700; }
  .g6 .card pre.decl { background: var(--code-bg); border-bottom: 1px solid var(--rule); padding: 8px 13px; }

  .g6 .sn {
    display: inline-flex; align-items: center; justify-content: center; flex: none;
    min-width: 15px; height: 15px; padding: 0 3px; border-radius: 8px;
    background: var(--accent-wash); border: 1px solid #CBDDD5; color: var(--accent-ink);
    font: 600 9.5px/1 ui-monospace, Menlo, monospace;
  }
  .g6 .card pre .stepline {
    display: inline-block; margin: 9px 0 3px; white-space: normal;
    font: 700 13px/1.5 -apple-system, "Segoe UI", sans-serif; color: var(--ink);
  }
  .g6 .card pre .stepline .sn { margin-right: 7px; vertical-align: 1px; }
  .g6 .card pre .stepline b { color: var(--ink); }
  .g6 .card pre .stepline code { font: 10.5px ui-monospace, Menlo, monospace; color: var(--accent-ink); }
  .g6 .callee { font-weight: 700; background: #FBEBB5; border-radius: 3px; padding: 0 3px; }

  .g6 .edge { display: flex; flex-direction: column; align-items: center; gap: 0; padding: 5px 0; }
  .g6 .edge .bar { width: 2px; height: 16px; background: var(--accent); opacity: 0.55; }
  .g6 .edge .head { color: var(--accent); font-weight: 700; line-height: 0.7; }

  .g6 .row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0; }
  .g6 .row .node { margin: 0; max-width: 100%; }
  .g6 .row .node:first-child { justify-self: end; }
  .g6 .row .node.side { justify-self: start; }
  .g6 .hedge { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 0 8px; }
  .g6 .hedge .hbar { width: 100%; min-width: 64px; height: 2px; background: var(--accent); opacity: 0.55; position: relative; }
  .g6 .hedge .hbar::after { content: "▶"; position: absolute; right: -4px; top: -7px; color: var(--accent); font-size: 11px; }
  .g6 .hedge .hbar.back::after { content: ""; }
  .g6 .hedge .hbar.back::before { content: "◀"; position: absolute; left: -4px; top: -7px; color: var(--accent); font-size: 11px; }

  @media (max-width: 860px) {
    .g6 .row { grid-template-columns: 1fr; }
    .g6 .hedge { padding: 10px 0; }
    .g6 .hedge .hbar { width: 2px; min-width: 0; height: 22px; }
    .g6 .hedge .hbar::after, .g6 .hedge .hbar.back::before { display: none; }
  }`;

const graphHtml = `<div class="g6">
<div class="node"><code class="nsig">${sigs.n1}</code></div>

<div class="edge"><div class="bar"></div><div class="head">▼</div></div>

<div class="node"><code class="nsig">${sigs.n2}</code></div>

<div class="edge"><div class="bar"></div><div class="head">▼</div></div>

<div class="row">
  <div class="node"><code class="nsig">${sigs.n3}</code></div>
  <div class="hedge">
    <div class="hbar"></div>
    <div class="hbar back"></div>
  </div>
  <div class="node side"><code class="nsig">${sigs.n3b}</code></div>
</div>

<div class="edge"><div class="bar"></div><div class="head">▼</div></div>

<div class="node"><code class="nsig">${sigs.n4}</code></div>

<div class="edge"><div class="bar"></div><div class="head">▼</div></div>

<div class="node"><code class="nsig">${sigs.n5}</code></div>
</div>`;

// ---------- page standalone ----------
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MR !52 — Chaîne d'appel v5 (graphe + hover)</title>
<style>
  :root {
    --paper: #FBFAF7;
    --ink: #23272B;
    --muted: #6E756F;
    --accent: #14614F;
    --accent-ink: #0E4A3C;
    --accent-wash: #EDF3F0;
    --code-bg: #F4F4EE;
    --code-border: #E3E4DA;
    --rule: #E8E7DF;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 980px; margin: 0 auto; padding: 0 24px 160px; }
  h1 { font-family: Charter, "Iowan Old Style", Palatino, Georgia, serif; font-size: 32px; line-height: 1.15; margin: 0 0 10px; }
  header { padding: 52px 0 24px; border-bottom: 1px solid var(--rule); margin-bottom: 36px; }
  .eyebrow { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); font-weight: 600; margin-bottom: 12px; }
  .lede { font-size: 16px; color: var(--muted); max-width: 72ch; margin: 0; }

${graphCss}
</style>
</head>
<body>
<div class="wrap">

<header>
  <div class="eyebrow">MR !52 · section 06 · v5 — graphe + hover</div>
  <h1>La chaîne d'appel, de bout en bout</h1>
  <p class="lede">Qui appelle qui. Survoler le nom d'une fonction pour sa description et son code (les étapes numérotées se retrouvent dans le code, en gras l'appel au nœud suivant), un paramètre ou un type de retour pour sa définition, un module ou un type porteur pour son squelette.</p>
</header>

${graphHtml}

</div>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log('built', OUT);

// ---------- injection dans le doc de review complet (section 06) ----------
const DOC = '/Users/rbaumier/www/natalia/mr-docs/voicehandler-mr52.html';
const CSS_START = '  /* ===== s6-graph — généré par build-v5.mjs, ne pas éditer à la main ===== */';
const CSS_END = '  /* ===== fin s6-graph ===== */';
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let doc = readFileSync(DOC, 'utf8');
const cssBlock = `${CSS_START}\n${graphCss}\n${CSS_END}`;
if (doc.includes(CSS_START)) {
  doc = doc.replace(new RegExp(`${escRe(CSS_START)}[\\s\\S]*?${escRe(CSS_END)}`), () => cssBlock);
} else {
  doc = doc.replace('</style>', `${cssBlock}\n</style>`);
}

const section = `<section id="s1">
  <div class="sec-head"><span class="sec-num">01</span><h2 class="title">La chaîne d'appel, de bout en bout</h2></div>
  <div class="files"><span class="chip">history_supervisor.rs</span><span class="chip">on_close.rs</span><span class="chip">executor.rs</span><span class="chip">api_connector.rs</span></div>

  <p>La carte&nbsp;: qui appelle qui, chaque brique détaillée dans sa section (§02–05). Au survol&nbsp;:</p>
  <ul>
    <li>nom de fonction → description + code réel (étapes numérotées, appel au nœud suivant en gras)&nbsp;;</li>
    <li>paramètre, type de retour → sa définition&nbsp;;</li>
    <li>module, type porteur → son squelette.</li>
  </ul>

${graphHtml}
</section>`;

if (!/<section id="s1">[\s\S]*?<\/section>/.test(doc)) throw new Error('section s1 not found in doc');
doc = doc.replace(/<section id="s1">[\s\S]*?<\/section>/, () => section);
writeFileSync(DOC, doc);
console.log('injected section 01 (chaîne d\'appel) into', DOC);
