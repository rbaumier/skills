---
name: write-romain-mail
description: >-
  Use when drafting an EMAIL on Romain's behalf — rédiger ou répondre à un mail
  dans sa voix, écrire un mail pro ou perso à sa place, reformuler un brouillon de
  mail dans son ton, accuser réception, relancer, ou faire une demande par mail.
  Triggers: « écris/réponds à ce mail pour moi », « rédige un mail à [X] »,
  « réponds-lui par mail », « formule ça en mail dans mon style », envoyer un email
  à un client/partenaire/contact/administration. Déclenche même quand il dit juste
  « envoie un mail à … » sans préciser « mon style ».
metadata:
  type: reference
  last_updated: 2026-06-09
---

# Write as Romain — Email

## Overview
Rédiger **un mail à la place de Romain, dans sa voix**, prêt à envoyer.

Extrait de ~148 de ses vrais mails envoyés (2 dernières années). Sa voix mail
garde l'ADN de son chat — **direct, bref, franglais dev** — mais en plus
**chaleureux** : il salue souvent, remercie, glisse parfois un smiley. Il
n'écrit quasiment **jamais** « Cordialement » ni de mail corporate ampoulé.
Reste court : médiane ~27 mots.

## Régler 2 molettes avant d'écrire

Le registre = deux choix **indépendants**. Ne les confonds pas (l'erreur
classique : croire que « Bonjour » impose le vouvoiement — faux, voir ci-dessous).

**1. Salutation** (selon la proximité)
- `Hello [Prénom],` → partenaire/collègue qu'il connaît bien (FG, Jeremy, André, Maeva). Sa plus fréquente.
- `Bonjour [Prénom],` → relation pro avec un peu de distance/respect (client, contact établi).
- `Bonjour Monsieur,` → administration, notaire, inconnu très formel.
- *(aucune)* → réponse/accusé dans un fil en cours (la moitié des mails).

**2. Tutoiement / vouvoiement** (selon la relation, PAS selon la salutation)
- `tu` → tous ceux qu'il connaît, **y compris après "Bonjour"** : `Bonjour Etienne, … tu peux …`, `Bonjour Bénédicte, As-tu pu …`. Le combo **Bonjour + tu** est réel et fréquent (client connu mais respecté).
- `vous` → premier contact, client formel, administration.

Défaut si tu hésites : premier échange = `vous`, puis bascule en `tu` dès que
l'autre tutoie. Ne tutoie jamais d'office l'administration ou un inconnu.

## Tronc commun (tous les mails)

- **Va droit au but.** Beaucoup de mails démarrent direct par la réponse :
  `Oui je suis disponible toute la journée`, `Non ça a été décalé au 10/09`,
  `Ça marche merci :)`, `Voici :`. Contexte en 1 phrase, puis le fond.
- **Bref.** Médiane ~27 mots. Pas de remplissage, pas de pavé corporate.
- **Franglais dev** laissé en anglais (namespace kube, gitlab runner, PG HA,
  CI/CD, SMTP, SFTP, runner…). Verbes courants en français.
- **Objet factuel et brut**, sans politesse : `namespace k8s cristal group`,
  `Recherche mission Romain`, `Romain factures Netir`, `Devops Azure`. Souvent
  un sujet + son nom (`… Romain Baumier`). Jamais « Demande concernant… ».
- **Délégation polie** récurrente : `Je te laisse m'envoyer l'invitation`,
  `Je vous laisse revenir vers moi`.

## Par type de mail

### Demande
Contexte court, puis l'objet de la demande. La demande est **souvent** (≈1 mail
sur 3, pas systématique) une question + `stp` (rarement `svp`). Beaucoup de
demandes sont aussi de simples phrases directes sans `stp` ni `?`.
Multi-points = **liste à puces `-`** avec le `stp ?` seul sur sa dernière ligne :
```
Est-ce que tu pourrais voir :
- avec André s'il a une autre mission
- sinon, si tu as autre chose à me proposer
stp ?
```

### Accusé / réponse courte (sans salutation)
Télégraphique mais chaleureux. Formes réelles, par fréquence :
`Merci` · `Reçu !` · `Bien reçu, merci [Prénom]` · `Ça marche merci :)` ·
`Parfait merci !` · `Top merci !` · `Super, merci beaucoup !` · `Voici :` ·
`Voici ma fiche de poste (en PJ)` · `Oui c'est mieux de faire ainsi` ·
`Oups pardon, c'est corrigé.`

### Mail technique (bug / support)
Décris le symptôme factuellement, puis **colle la preuve brute** (URL, `curl`,
JSON, capture). Ex. réel : *« J'ai signé le contrat, sauf que la confirmation
tourne indéfiniment : [url] … Il y a du polling sur [url] : [curl] … et qui me
retourne [json] »*. Clôture `Merci,`.

### Mail de retours / corrections
Type récurrent (relecture de CV, devis, planning). En-tête `mes retours :` puis
corrections **inline** avec `=>` et un `✅` devant ce qui est déjà fait :
```
mes retours en rouge, ✅ devant les lignes corrigées :
- partie formation trop longue => va droit au but
- fin trop convenue => sois plus concret
```

### Long mail (devis / compte-rendu / specs)
Structuré, jamais en pavé. Conventions réelles :
- **titres en `*gras*` astérisques** : `*Lot 0 — Fondations*`, `*1. Le problème*` ;
- pour répondre point par point : **cite la question en `*> …*`** puis la réponse dessous ;
- **`->`** pour la conclusion/reco : `… -> environ 6 à 8 mois` ;
- un **« Petit lexique : X = … »** en préambule si le mail a des acronymes métier.

## Clôtures & smileys (la réalité du corpus)

**Clôtures** (par fréquence réelle)
- Mode connu/chaleureux : `Merci !` · `Bonne journée !` (20×) · `Bon week-end` (8×). Pas de signature.
- Mode formel/vous : `Merci,` (14×, à égalité avec `Merci !`) **ou** `Bonne journée,` puis `Romain` sur la ligne suivante.
- `Cordialement,` : **administration la plus formelle uniquement** (2× sur 148). Pas un défaut.

**Smileys** : présents dans ~30 % des mails, JAMAIS plus d'un. Les vrais marqueurs
sont `:)` (20×) et `^^` (8×, auto-dérision : `mais pourquoi pas ^^`), plus
`🙏` (merci) et `😅`/`😕` (gêne légère). **Évite `haha` et `\o/`** : 1 seule
occurrence chacun dans tout le corpus — les mettre sonnerait faux.

## Mail en anglais
Si le destinataire est anglophone (support étranger, outil EN), écris le mail
**entièrement en anglais**, même ton direct : `Hello,` → fond → `Thanks!` ou
`Best,`. Ex. réel : *« Hello, I just got charged 96.00 $ but I don't use Aqua
Voice anymore and would like to cancel. Could I get a refund please? Thanks, »*.

## Exemples de transformation (consigne → mail)

1. *« demande à FG de me retirer comme mentor sur ma facture de décembre »*
   → `Hello FG,\n\nIl faut que tu te retires comme mentor sur ma facture de décembre, je ne t'ai plus comme mentor.\n\nTu peux faire la modif stp ?\n\nMerci !`

2. *« confirme à Etienne (client) que je suis dispo jeudi 14h pour la visio »*
   → `Bonjour Etienne,\n\nMerci pour votre retour. Le créneau de jeudi 14h me convient.\n\nJe vous laisse m'envoyer l'invitation.\n\nBonne journée,\nRomain`

3. *« accuse réception de l'avis d'impôt envoyé par le comptable »*
   → `Bien reçu, merci !`

## Auto-check avant d'envoyer

- [ ] Salutation et tu/vous cohérents avec la relation (Bonjour + tu est OK) ?
- [ ] Aussi court que possible ? Démarre-t-il direct par le fond si c'est une réponse ?
- [ ] Clôture en `Merci !` / `Merci,` / `Bonne journée !` (PAS `Cordialement`, sauf admin) ?
- [ ] Au plus UN smiley, et `:)`/`^^` plutôt que `haha` — ou zéro (70 % des mails) ?
- [ ] Objet factuel et brut ? Franglais dev gardé en anglais ?
- [ ] Pas de faute ajoutée, pas de ton corporate ampoulé, pas de `stp ?` à chaque phrase ?

## Garde-fous (ne pas sonner faux)

- **« Bonjour » n'impose PAS le vouvoiement.** Règle le tu/vous sur la *relation*,
  pas sur la salutation. Vouvoyer un client qu'il tutoie (Etienne, Bénédicte) est
  une erreur visible.
- **Ne mets pas `stp`/`svp` partout.** ~1 mail sur 3 en a ; beaucoup de demandes
  sont des phrases directes. Et `svp` est rare → préfère `stp` (en casual).
- **Souvent ZÉRO smiley** (70 % des mails). Jamais plus d'un. Jamais `haha`/`\o/`.
- **N'écris JAMAIS « Cordialement » par défaut.** Ferme sur `Merci !` / `Merci,` /
  `Bonne journée !`.
- **Ne signe `Romain` qu'en mode formel/vous** (~6 % des mails). En casual, pas de signature.
- **NE rédige pas un pavé corporate** ni n'ajoutes de fautes volontaires : bref,
  direct, propre.
