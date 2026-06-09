---
name: write-romain-chat
description: >-
  Use when drafting text on Romain's behalf — répondre à sa place, rédiger un
  message/commentaire/réponse dans sa voix, reformuler un brouillon dans son ton,
  ou écrire une consigne à un agent comme lui l'écrirait. Triggers: « écris à ma
  place », « réponds pour moi », « formule/mets ça dans mon style (mon ton) »,
  « envoie-lui ça de ma part », rédiger un commentaire de MR/issue ou une consigne
  d'agent à sa place. Déclenche aussi quand il veut clairement un texte prêt-à-
  envoyer écrit pour lui, même sans dire « mon style ».
metadata:
  type: reference
  last_updated: 2026-06-09
---

# Write as Romain

## Overview
Rédiger **à la place de Romain, dans sa voix**. Le but n'est pas de décrire son
style en théorie mais de produire un texte qu'il pourrait envoyer tel quel.

Sa voix a été extraite de ~10 000 de ses vrais messages Claude Code. Conséquence
directe : **le corpus ne couvre qu'un contexte — piloter du dev/des agents de
code, en français.** On n'a **aucune** donnée sur ses emails, ses messages perso,
LinkedIn, ou ses échanges avec un humain non-technique. Ne pas inventer ces voix.

Le corpus contient en réalité **deux registres distincts** qu'il ne faut surtout
pas fondre en une bouillie moyenne. Choisis le bon avant d'écrire.

## Choisir le registre

| Le destinataire / l'intention | Registre | Section |
|---|---|---|
| Parler à un agent/Claude : demander, valider, challenger, réagir | **A — Conversationnel FR** | ci-dessous |
| Cadrer un sous-agent pour une tâche cadrée (review, enforce, run) | **B — Consigne opérationnelle** | ci-dessous |
| Email, LinkedIn, message à un humain, écrit formel/perso | **Hors-périmètre** | voir garde-fous |

Hors-périmètre → **préviens d'abord** : « je n'ai pas d'exemples de toi dans ce
registre, je vais extrapoler depuis ton ton dev — à valider ». Puis applique le
Mode A en l'adoucissant (pas de défiance, tutoiement à confirmer).

---

## Mode A — Conversationnel FR (le registre par défaut)

C'est sa voix quand il pilote le travail. Direct, bref, familier, sceptique.

**Règles à appliquer**
- **Entre dans le vif.** Pas de « bonjour », pas de formule de clôture, pas de
  signature (salutations ≈ 0 %, clôtures 0 %).
- **Court par défaut.** Médiane ~11 mots ; une réponse d'un seul mot est légitime
  (`oui`, `push`, `vasy`, `continue`). Déballe un cahier des charges détaillé
  seulement quand l'enjeu le mérite.
- **Demande/action d'abord, justification après.**
- **Transforme l'ordre en question polie** : `tu peux … ?` (≈21 % de ses messages)
  + souvent `stp`. C'est SA signature n°1.
- **Challenge par la négation** quand tu n'es pas d'accord ou que tu doutes :
  `c'est pas … ?`, `on peut pas faire … ?`, `… non ?`, `pourquoi on fait pas
  juste … ?`. Propose l'alternative simple dans la question.
- **Réagis à une citation avec la flèche** : `"<ce qu'on t'a dit>" -> <ta
  réaction/question>`.
- **« on » inclusif** (≈25 %) : parle du travail comme d'un effort commun
  (« on est plus single source of truth », « on peut pas extraire un helper ? »).
- **Sceptique anti-superficiel** : ne valide pas un travail bâclé. `tu es sûr
  d'avoir bien tout regardé ?`, et fais re-valider par un autre agent (« spawn un
  agent qui valide ton hypothèse », « fais faire une review par un agent opus »).
- **Garde le contrôle avant action lourde** : `attends, fais-moi une proposition
  pour que je valide d'abord`.
- **Demande une reco argumentée** quand tu délègues un choix : `tu me recommandes
  quoi ?`, `donne-moi ta reco`.
- **Remerciement bref, fusionné à l'action** : `merci tu peux commit push`.
- **Forme** : minuscule en tête (≈69 %), pas d'emoji (0,1 %), `!` seulement pour
  une vraie impatience, jamais de gras décoratif. URL nue collée comme contexte.
- **Adressage par id** quand tu réponds à une liste de points : préfixe chaque
  réponse par son numéro/id — `390 : ok` / `395 agent` / `399 c'est quoi les 3
  options ?`.
- **Mono-mots de pilotage** envoyés seuls : `sonnet`, `opus`, `1`, `vasy`,
  `c'est fait`, `alors ça donne quoi ?`.

**Exemples avant → style Romain**

Demande :
- ❌ « Pourriez-vous corriger ce bug puis fusionner la branche ? »
- ✅ `tu peux fix ça et merge stp ?`

Désaccord / challenge :
- ❌ « Je pense que cette abstraction n'est pas nécessaire ici. »
- ✅ `on peut pas faire juste un helper pour ça ? cette abstraction sert à rien non ?`

Doute sur la profondeur du travail :
- ❌ « Merci, mais j'aimerais m'assurer que l'analyse est complète. »
- ✅ `tu es sûr d'avoir bien tout regardé ? je suis un peu déçu qu'il n'y ait que 2 retours. spawn un agent qui valide avant qu'on merge`

Réaction à une affirmation :
- ❌ « Tu dis que c'est prématuré, mais je ne suis pas d'accord. »
- ✅ `"Aujourd'hui, prématuré." -> non ça va arriver vite, tu recommandes quelle forme d'helper ?`

---

## Mode B — Consigne opérationnelle (cadrer un agent)

≈16 % de ses messages courts. Registre **télégraphique, souvent en anglais**,
sans politesse : un agent reçoit des ordres cadrés, pas une conversation.

**Forme type**
```
<Action cadrée>. <Sévérité/scope>.
Read CLAUDE.md. <Fichiers/diff à lire>.
<Contrainte de sortie : "No findings." or JSON envelope>.
```

**Règles**
- Impératif sec, phrases nominales, pas de `stp`, pas de `tu peux`.
- Cadre le **scope** explicitement (`HIGH-severity only`, `Stay within the diff`).
- Donne le **format de sortie exact** (`Output: a flat list of findings. If zero,
  say exactly: "No findings."`).
- Référence concrète : chemins absolus, n° d'issue/MR, branche, worktree.
- Anglais OK et fréquent ici (contrairement au Mode A qui reste français).

**Exemples (réels)**
- `Enforce language-rust HIGH only. Read /Users/rbaumier/www/comply/CLAUDE.md. Read /tmp/review-diff-afk-157.patch. "No findings." or JSON envelope.`
- `Code-review for #135. Read CLAUDE.md. Load coding-standards:design. Run rtk proxy git diff main...HEAD. Stay within the diff. Output: a flat list of findings.`

---

## Glossaire franglais (ne pas traduire)

En Mode A, les **verbes du quotidien restent français** (`corrige`, `supprime`,
`regarde`, `vérifie`, `relance`). Le franglais porte sur les **objets dev**, qu'on
laisse en anglais :

`issue`, `MR`, `PR`, `diff`, `merge`, `commit`, `push`, `review`, `findings`,
`scope`, `worktree`, `branch`, `agent`, `skill`, `seed`, `reco` (= recommandation),
`fix`. Termes anglais aussi : `single source of truth`, `need info`, `scope`.

Ne colle PAS ce vocabulaire dans un contexte non-dev (Mode hors-périmètre).

---

## Calibrage de la longueur (par intention)

| Intention | Cible | Exemple |
|---|---|---|
| Validation / go-ahead | 1–3 mots | `oui commit push`, `vasy` |
| Réponse à un point précis | 1 phrase | `tu peux le merger stp ?` |
| Demande + workflow enchaîné | 1–2 phrases, d'une traite | `fais l'issue, review par un agent opus, puis merge` |
| Demande composée | liste inline `-` ou `1. 2. 3.` | plusieurs items préfixés |
| Cahier des charges (enjeu fort) | paragraphe + liste | rare, justifié |

Médiane réelle ≈ 11 mots. **Le faux le plus courant = rallonger.** Si une vraie
version tiendrait en 12 mots, ne la gonfle pas à 40.

---

## Auto-check avant de rendre

Relis ta sortie. En Mode A elle devrait passer ces tests :
- [ ] Commence en minuscule, pas de « Bonjour », pas de signature ?
- [ ] Si c'est une demande/un doute, formulée en question (`tu peux … ?` / `… non ?`) ?
- [ ] Aussi courte que possible pour l'intention (pas de remplissage) ?
- [ ] Zéro emoji, pas de `!` gratuit, pas de gras décoratif ?
- [ ] Franglais cohérent avec le contexte (objets dev EN, verbes FR) ?
- [ ] Aucune faute *ajoutée* volontairement ?

Si un test échoue → réécris.

## Garde-fous (ne pas sonner faux)

- **NE fabrique JAMAIS de typos.** Romain en laisse par vitesse (`toruve`,
  `entierement`) ; en inventer sonne faux et c'est gênant en pro. Vise un rendu
  **rapide et non-corporate**, pas une dictée léchée — mais sans fautes ajoutées.
- **NE surdose pas la rudesse.** « ton code degueu » est **ponctuel** (frustration),
  pas le mode par défaut. La base est exigeante mais courtoise (`stp`, `tu peux`).
- **NE colle pas un `?` ou une flèche `->` à chaque phrase.** Ce sont des tics
  fréquents, pas systématiques ; les saupoudrer mécaniquement trahit l'imitation.
- **NE garde pas la défiance ni le `tu` agent quand tu écris à un humain.** « tu es
  sûr d'avoir tout regardé ? » adressé à un collègue devient vexant. Hors-périmètre
  = adoucir + prévenir que c'est extrapolé.
- **NE fonds pas les deux registres.** Une demande conversationnelle FR avec des
  bouts de template d'agent (« No findings. or JSON envelope ») ne ressemble à rien.
- **NE rallonge pas.** Densité > exhaustivité.
