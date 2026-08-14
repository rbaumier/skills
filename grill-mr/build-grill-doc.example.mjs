// build-grill-doc.example.mjs — modèle complet et fonctionnel.
// Copier au scratchpad de session, `npm i shiki`, adapter le bloc CONFIG, exécuter :
//   node build-grill-doc.mjs
// Toute incohérence (fichier absent du miroir, ligne hors du fichier, placeholder
// non remplacé) = échec bruyant : le doc ne peut pas dériver des findings.

import { createHighlighter } from 'shiki';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ---------- CONFIG (seul bloc à adapter) ----------
const MIRROR = '/chemin/scratchpad/mirror'; // fichiers @ head_sha, arborescence du repo
const FINDINGS = '/chemin/scratchpad/findings-voicehandler-65.json';
const TEMPLATE = `${process.env.HOME}/.claude/skills/grill-mr/template.html`;
const OUT = '/chemin/parent-du-repo/mr-docs/voicehandler-mr65-grill.html';
const META = {
  repo: 'voicehandler',
  mrIid: 65,
  mrUrl: 'https://gitlab.com/…/-/merge_requests/65',
  projectWebUrl: 'https://gitlab.com/…/voicehandler',
  headSha: '0000000000000000000000000000000000000000',
  sourceBranch: 'chantier/…',
  targetBranch: 'main',
  commits: 10,
  fichiers: 44,
  titre: 'Traçabilité des erreurs — grill',
  // HTML autorisé dans lede/explainerHtml (écrits par l'agent principal, étape 4).
  lede: 'Review adversariale de la MR !65. <strong>N findings</strong> à trancher.',
  explainerHtml: `
  <aside class="context">
    <span class="tag">Pour situer</span>
    <p>…domaine métier + problème que la MR résout…</p>
  </aside>
  <table>
    <thead><tr><th>Call site</th><th>Ce qui change</th></tr></thead>
    <tbody><tr><td><code>handler_x</code></td><td>…</td></tr></tbody>
  </table>`,
};
const CTX = 7; // lignes de contexte autour de la ligne incriminée

// ---------- helpers ----------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
// texte des findings : échappé, puis `identifiants` rendus en <code>
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code class="inline">$1</code>');

const LANGS = {
  rs: 'rust', ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  vue: 'vue', swift: 'swift', sql: 'sql', toml: 'toml', yml: 'yaml',
  yaml: 'yaml', json: 'json', sh: 'bash', html: 'html', css: 'css', md: 'markdown',
};
const langFor = (p) => LANGS[p.split('.').pop()] ?? 'txt'; // 'txt' = plaintext, toujours dispo

const data = JSON.parse(readFileSync(FINDINGS, 'utf8'));
const findings = data.findings;
if (!findings?.length) throw new Error('findings.json vide ou sans findings');

const hi = await createHighlighter({
  themes: ['github-light'],
  langs: [...new Set(findings.map((f) => langFor(f.fichier)).filter((l) => l !== 'txt'))],
});

// shiki émet un \n entre chaque <span class="line …"> ; avec .line en display:block
// ça double l'interligne — on colle les lignes (pas de guillemet fermant dans le
// motif : la classe peut être "line hl", "line dfd", …).
const stripLineBreaks = (h) => h.replace(/<\/span>\n(<span class="line)/g, '</span>$1');
const innerCode = (h) => h.match(/<code[^>]*>([\s\S]*)<\/code>/)[1];

const fileLines = (path) => readFileSync(`${MIRROR}/${path}`, 'utf8').split('\n');

// extrait ± CTX lignes autour de f.ligne, numéroté, ligne incriminée surlignée
function snippetHtml(f) {
  const lines = fileLines(f.fichier);
  if (f.ligne < 1 || f.ligne > lines.length) {
    throw new Error(`finding #${f.id} : ${f.fichier}:${f.ligne} hors du fichier (${lines.length} lignes)`);
  }
  const start = Math.max(1, f.ligne - CTX);
  const end = Math.min(lines.length, f.ligne + CTX);
  const html = hi.codeToHtml(lines.slice(start - 1, end).join('\n'), {
    lang: langFor(f.fichier),
    theme: 'github-light',
    transformers: [{
      line(node, ln) {
        node.properties['data-ln'] = String(start + ln - 1);
        if (start + ln - 1 === f.ligne) this.addClassToHast(node, 'hl');
      },
    }],
  });
  return `<figure class="snippet"><figcaption>${esc(f.fichier)}:${f.ligne}</figcaption>${stripLineBreaks(html)}</figure>`;
}

// diff de suggestion : lignes actuelles (−, rouge) puis remplacement (+, vert)
function suggestionHtml(f) {
  const s = f.suggestion;
  const lines = fileLines(f.fichier);
  if (s.ligne_fin > lines.length || s.ligne_debut < 1 || s.ligne_debut > s.ligne_fin) {
    throw new Error(`finding #${f.id} : suggestion ${s.ligne_debut}-${s.ligne_fin} invalide pour ${f.fichier}`);
  }
  const lang = langFor(f.fichier);
  const mark = (cls) => [{ line(node) { this.addClassToHast(node, cls); } }];
  const old = hi.codeToHtml(lines.slice(s.ligne_debut - 1, s.ligne_fin).join('\n'),
    { lang, theme: 'github-light', transformers: mark('dfd') });
  const neu = hi.codeToHtml(s.remplacement,
    { lang, theme: 'github-light', transformers: mark('dfa') });
  const range = s.ligne_fin > s.ligne_debut ? `${s.ligne_debut}-${s.ligne_fin}` : `${s.ligne_debut}`;
  return `<figure class="snippet sugg"><figcaption>Suggestion — remplace ${esc(f.fichier)}:${range}</figcaption>` +
    `<pre class="shiki"><code>${stripLineBreaks(innerCode(old))}${stripLineBreaks(innerCode(neu))}</code></pre></figure>`;
}

function cardHtml(f) {
  const sev = f.severite.toLowerCase();
  const loc = `${META.projectWebUrl}/-/blob/${META.headSha}/${f.fichier}#L${f.ligne}`;
  const conf = f.confiance === 'a_confirmer' ? '<span class="f-conf">à confirmer</span>' : '';
  return `
<article class="finding" data-id="${f.id}" data-sev="${sev}" id="f${f.id}">
  <div class="f-head">
    <span class="f-num">#${f.id}</span>
    <span class="f-sev sev-${sev}">${esc(f.severite)}</span>
    <span class="f-cat">${esc(f.categorie)}</span>
    ${conf}
    <a class="f-loc" href="${loc}">${esc(f.fichier)}:${f.ligne}</a>
  </div>
  <div class="f-body">
    <p class="f-title">${md(f.titre)}</p>
    <p class="f-desc">${md(f.description)}</p>
    ${f.exemple ? `<pre class="f-ex">${esc(f.exemple)}</pre>` : ''}
    ${f.sans_extrait ? '' : snippetHtml(f)}
    ${f.suggestion ? suggestionHtml(f) : ''}
    ${f.recommandation ? `<p class="f-fix"><b>Correctif</b> — ${md(f.recommandation)}</p>` : ''}
    <div class="f-comment"><span class="tag">Commentaire à poster — modifiable</span><textarea class="f-edit" rows="3" spellcheck="false">${esc(f.recommandation ? `${f.description}\n\n${f.recommandation}` : f.description)}</textarea></div>
  </div>
  <div class="f-actions">
    <button class="act btn-acc" type="button" aria-pressed="false">Accepter</button>
    <button class="act btn-rej" type="button" aria-pressed="false">Refuser</button>
  </div>
</article>`;
}

// ---------- assemblage ----------
const counts = {};
for (const f of findings) counts[f.severite] = (counts[f.severite] || 0) + 1;
const synthese = ['Critical', 'Major', 'Minor', 'Nit']
  .filter((s) => counts[s])
  .map((s) => `<span class="chip"><b>${counts[s]}</b> ${s}</span>`)
  .join('\n    ');

const chips = [
  `<span class="chip"><a href="${esc(META.mrUrl)}">MR&nbsp;!${META.mrIid}</a></span>`,
  `<span class="chip"><b>${esc(META.sourceBranch)}</b> → ${esc(META.targetBranch)}</span>`,
  `<span class="chip"><b>${META.commits}</b> commits</span>`,
  `<span class="chip"><b>${META.fichiers}</b> fichiers</span>`,
  `<span class="chip"><b>${findings.length}</b> findings</span>`,
  `<span class="chip">couverture&nbsp;: ${esc(data.couverture)}</span>`,
].join('\n    ');

const doc = readFileSync(TEMPLATE, 'utf8')
  .replaceAll('{{TITLE}}', esc(`Grill !${META.mrIid} — ${META.titre}`))
  .replaceAll('{{EYEBROW}}', esc(`Grill · ${META.repo} · MR !${META.mrIid}`))
  .replaceAll('{{H1}}', esc(META.titre))
  .replaceAll('{{LEDE}}', META.lede)
  .replaceAll('{{CHIPS}}', chips)
  .replaceAll('{{EXPLAINER}}', META.explainerHtml)
  .replaceAll('{{SYNTHESE}}', synthese)
  .replaceAll('{{FINDINGS}}', findings.map(cardHtml).join('\n'))
  .replaceAll('{{TOTAL}}', String(findings.length))
  .replaceAll('{{FOOTNOTE}}', esc(`MR !${META.mrIid} · ${META.sourceBranch} → ${META.targetBranch} · doc généré au head ${META.headSha.slice(0, 8)}`))
  .replaceAll('{{DOC_KEY_JSON}}', JSON.stringify(`grill:${META.repo}!${META.mrIid}`))
  .replaceAll('{{DECISION_PREFIX_JSON}}', JSON.stringify(`grill ${META.repo}!${META.mrIid}`));

const leftover = doc.match(/\{\{[A-Z_]+\}\}/);
if (leftover) throw new Error(`placeholder non remplacé : ${leftover[0]}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, doc);
console.log(`OK — ${findings.length} findings → ${OUT}`);
