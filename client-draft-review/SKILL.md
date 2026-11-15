---
name: client-draft-review
description: >-
  Applique les retours de Romain à un brouillon de message client rédigé par une IA
  (réponse Chatwoot, mail, relance, récap, devis ou document joint) : vérifie les
  faits, fait les actions au lieu de les promettre, retire ce qu'il retire toujours,
  passe /humanizer, puis rend le texte entier prêt à valider. Use when the user
  invokes /client-draft-review on a draft or a Chatwoot conversation id, or asks to
  « relire », « corriger », « appliquer mes règles » sur un message destiné à un client.
---

# Relecture d'un brouillon client

Entrée : un brouillon (texte collé, fichier) et, si possible, la conversation Chatwoot visée (id ou nom du client). Sans brouillon, rédiger la réponse avec ces règles (`/humanizer` en mode rédaction), puis la relire comme un brouillon. Sortie : le texte entier corrigé, prêt à valider. Rien ne part sans un « envoie » explicite de Romain sur ce texte exact ; « fais la proposition » n'autorise pas l'envoi.

## 1. Contexte avant de toucher au texte

1. Lire le fil Chatwoot entier (`mcp__chatwoot__messages_list`, notes privées comprises) et les autres fils du même client : registre tu/vous, cc, ce qu'on a déjà demandé, promis ou reçu.
2. Chercher aussi dans Gmail (`gws`), Drive, les enregistrements (`~/Documents/Brain/recordings`) et le récap du dernier appel. Redemander un document déjà reçu est la faute la plus coûteuse.
3. Identifier le destinataire (l'opérationnel, pas le contact commercial), l'objet du message et ce que le client attend de nous maintenant.

## 2. Faire au lieu de promettre

- Toute action annoncée (« je vérifie », « je m'en occupe », « je vous l'envoie », « je les mets en place cette semaine ») : la faire maintenant, puis écrire qu'elle est faite, au passé, avec ce que le client peut constater (« tes tarifs de septembre affichent bien 01/09/2026 »), jamais notre méthode.
- Exception : une action qui est elle-même un envoi sortant (relance d'un tiers) ou qui modifie la configuration du client attend le go de Romain. La lister en tête du rendu ; « je les ai relancés aujourd'hui » ne s'écrit qu'une fois la relance partie.
- Un défaut remonté par le client : le corriger et le prouver nous-mêmes avant de répondre. Jamais « pouvez-vous tester ? ».
- Les défauts connus de ce qu'on invite le client à essayer sont corrigés avant l'envoi.
- Aucun [crochet] ni trou laissé à Romain : aller chercher la réponse.
- On attend un tiers : donner notre action datée (« nous les relançons aujourd'hui »), pas « j'attends ». Ce que le tiers enverra lui-même au client : « nous revenons vers vous dès sa réponse », pas « nous vous présenterons ».
- Une évolution produit qu'on ne peut pas livrer tout de suite : « Je reviens vers toi dès que c'est en place », sans délai ni date. C'est la seule promesse admise.

Une action impossible dans la session se signale à Romain en tête du rendu, jamais comme promesse dans le texte.

## 3. Ce qu'on retire

- Tout ce qui sort du sujet du message : autres dossiers en cours, remarques annexes (sécurité, debug), conseils non demandés sur la façon de corriger chez eux, sujets absents de la dernière demande du client, étapes ou cas hypothétiques qui ne le concernent pas.
- Les blocages et défauts du client qu'il n'a pas soulevés, ses incohérences de données, nos points internes à trancher.
- Nos opérations internes et preuves de travail (« je l'ai vérifié par un appel de test », « on recharge la doc de notre côté »), et toute validation de notre part dont le client n'a pas besoin (« je te donnerai le feu vert »).
- Toute action mise à la charge du client que le produit fait déjà ou que nous pouvons faire.
- Les réserves, précisions et chiffres accessoires qui peuvent vite devenir faux (« sept voix » → « plusieurs »), les rappels de ce qui existe déjà, les redites entre intro et puces.
- L'énumération spontanée des limites du produit. Une fonctionnalité manque et le client la demande : « pas encore, mais nous pouvons l'ajouter ».
- Ce que Natalia supporte ou non techniquement face à un tiers : énoncer seulement le besoin (« un accès API en lecture seule aux enregistrements »).
- Le jargon (trunk, libellés internes comme « navigation 3 / 42 ») : décrire en mots du client.
- Un tarif négocié ou discuté avec Jérémy (formule, remise, conditions de paiement, rythme de facturation) : « Jérémy revient vers vous », sans chiffre. Dans un devis, rien qui contredise l'offre retenue.
- Un service ou une personne du client qu'il n'a pas cités (« votre DSI »), les numéros et coordonnées d'autres clients.
- Toute reconnaissance qu'une fonctionnalité existante était imparfaite, et toute comparaison qui dévalorise le client (« des configurations bien plus complexes que la vôtre »).
- Toute phrase qui laisse croire que le client pourrait arrêter le projet.
- Toute réunion, échéance, délai technique ou promesse non actés (« toutes les 10 minutes », « lors de notre point de cette semaine »), et toute échéance attendue du client (« on attend votre retour mercredi »).
- En fin de message : visio ou appel que le client n'a pas demandés, « dites-moi si on a oublié quelque chose », question superflue (« tu peux me dire qui c'est ? »). Quand le client propose un échange, on y répond.
- Une question que le client a déjà tranchée (en call, par mail) : écrire la décision comme acquise (« Comme convenu, on met ce dispositif en pause »).
- Ce que le client gère lui-même (sa phrase d'accueil, ses actions) : on n'y touche pas. Une erreur repérée (coquille, action inutile) lui est signalée en une phrase, et il corrige lui-même.

## 4. Ce qu'on ajoute ou garde

- Une réponse explicite à chaque question du client, dans son ordre, point par point avec un intitulé court quand il y en a plusieurs.
- Après un silence ou une erreur de notre part : une excuse d'une phrase en tête (« Désolé pour le délai de réponse. »), franche, sans s'accabler (« je suis passé à côté ») ni blâmer le client, sans cause technique détaillée.
- Un remerciement pour le travail fourni par le client (maquette, documents), une seule fois : pas pour un envoi déjà reçu.
- Quand on retire une demande faite plus tôt : pourquoi on n'en a plus besoin. Quand on demande quelque chose : à quoi ça servira pour lui.
- Le contexte en une phrase avant le résultat (pourquoi ce travail, ce qui a été fait).
- Un changement proposé : pourquoi on change, ce qu'on propose, ce qu'on veut savoir de lui.
- Un malentendu repéré dans son message : décrire le fonctionnement, puis « Est-ce que ce fonctionnement vous convient ? ».
- La conséquence concrète d'une option, même peu flatteuse ; le chiffre qui parle au client (combien de messages pour lui, pas « 10 % du forfait ») ; l'exemple nommé plutôt que « un seul cas ».
- Un forfait annoncé : la grille publique complète en HT et le levier pour payer moins.
- Les vrais points forts du produit, dits avec des mots exacts ; le périmètre exact (« les appels répondus par Natalia »).
- Une nouvelle fonctionnalité ouverte au client : ce qu'il peut en faire, et « version alpha, quelques ratés sont possibles » si c'est le cas.
- Un numéro de démo : à quoi il sert et comment l'agent est paramétré.
- Pour guider dans la console : le lien direct vers la page, posé sur le texte, et les libellés exacts que le client voit à l'écran.
- Ce qu'on a relevé sur son site : un lien par élément, et ce qu'on n'a pas trouvé.
- Un point d'étape : tout ce qu'on a fait pour répondre à ses demandes, sans oubli.
- Un point venu d'un associé : « comme FG me l'avait indiqué ».
- Un choix qui revient au client : lui présenter le choix, ou proposer (« si c'est OK pour vous, je vous propose… »), jamais décider à sa place.
- Dans une réponse (pas une relance) à un client qui utilise l'outil : prendre des nouvelles de la prise en main et proposer de l'aide (« N'hésite pas si tu as des questions ou besoin d'aide »).

## 5. Ton et registre

- Reprendre le tu ou le vous des échanges précédents. Sans échange antérieur : vous. Plusieurs destinataires : vous pour le groupe, tu quand on s'adresse nommément à quelqu'un qu'on tutoie.
- Écrire comme Romain parle : phrases simples, « Du coup », « C'est noté », pas de tournure emphatique (« on peut tout à fait » → « oui on peut »).
- Lisible par un non-technicien à la première lecture ; un dirigeant ne lit pas un paragraphe long. Avec un interlocuteur technique : le fait précis (champ, message d'erreur exact) sans expliquer le mécanisme.
- Rien de condescendant : pas d'évidence expliquée sur son propre usage, pas de « il n'a qu'à », pas d'offre qui sous-entend que l'équipe ne sait pas faire, ne pas viser une personne nommée comme si elle n'y arrivait pas seule.
- Dans une réponse, pas de question frontale (« Où en êtes-vous ? ») : l'intégrer dans une offre d'aide. Un message qui n'aligne que des questions s'ouvre par un remerciement et la reprise du constat.
- Un refus ne sonne ni rigide ni personnel (« je préfère ne pas » fait passer Romain pour « chiant ») : une raison objective, puis l'alternative utile.
- Pas de suppositions ni de diagnostic hypothétique : le fait, puis la limite de ce qu'on peut vérifier.
- Un changement se présente comme une possibilité nouvelle et reste vendeur, jamais comme une contrainte subie ; un produit co-construit est « une ébauche, tes retours décideront de la suite ».
- Un état tiers se décrit tel qu'il est (« en attente de validation de Microsoft »). Un livrable à venir s'écrit au futur.
- Vocabulaire : « l'outil » pour un client signé (pas « la démo ») ; « conversation » quand le sujet couvre aussi le texte.

## 6. Longueur et forme

- Court et incisif : le résultat, le chiffre qui compte, l'action attendue. Pas de récit de la méthode. Une confirmation tient en une ligne.
- Un mail à plusieurs sujets : intertitres courts en gras, une idée par bloc ; quelques mots en gras sur l'essentiel.
- Prose liée, pas de fragments hachés.
- Ouverture : « Bonjour Prénom, ». Premier contact : se présenter (« Je suis Romain Baumier, de Natalia. FG m'a transmis votre contact. »), sans titre (« CTO »).
- Fin : la demande de retours (« N'hésitez pas à me faire vos retours. »), ou « C'est OK pour vous ? » après une proposition, puis « Bonne journée, » et « Romain » ; « Romain Baumier / Natalia » pour un tiers externe vouvoyé. Jamais « L'équipe Natalia ».
- Typographie : « 11h » collé, numéro au format national (06 99 98 19 26), prix marqués HT, items de liste sans « ; » ni point final.

## 7. Cas particuliers

- **Relance** : deux ou trois lignes. Renvoyer au message précédent (« Je me permets de vous relancer sur mon message du 14/10. ») et poser une seule question qui suppose qu'on avance. Jamais « toujours d'actualité ? » ni aucune porte de sortie, rien qui donne du travail à Romain (visio, aide, « envoyez-moi vos cas »), pas de pression par un tiers (« le DSI attend »), pas de redite du contexte.
- **Texte écrit par Romain** : partir de sa version, n'y intégrer que ses retours, corriger les fautes et poser les liens, sans la remanier. « Envoie tel quel » veut dire sans aucune retouche.
- **Paragraphe sensible** (excuses, refus) : proposer deux ou trois variantes de ce seul paragraphe, puis le texte entier une fois la variante choisie.
- **Message délicat** : d'abord la liste courte des idées à inclure, validée, avant de rédiger.
- **Document joint** (audit, devis) : autonome, soigné, sans référence locale ni bloc nom/fonction ; une remarque de Romain s'applique à tout le document. Un devis porte son argumentaire. Un document de consignes (RGPD) s'ouvre sur ce que le client doit faire et nous transmettre.
- **Destinataires différents** (tiers et client) : un message par fil.

## 8. Vérification par un agent neuf (obligatoire)

Sur le texte réécrit, spawn un agent neuf qui vérifie, sources à l'appui (fil, Gmail, code, prod, console) :

- toute information demandée au client n'est pas déjà en notre possession, et ne peut pas être vérifiée par nous ;
- chaque fait est vrai et à jour : comportement du produit, configuration réelle du client (opérateur, lignes), dernière réponse d'un tiers, ce qui est imposé ou configurable, et chaque fait ajouté par la réécriture (preuves d'action, liens, libellés, chiffres) ;
- aucune formule ni caractérisation sans source (« usine à gaz », un avant/après qui dénigre l'existant) ;
- les pièces jointes sont à jour et cohérentes avec le message.

Corriger d'après son rapport. Pour des consignes données au client, boucler avec un relecteur Fable jusqu'à accord. Toute retouche ultérieure qui ajoute un fait repasse par un agent.

## 9. Humanizer

Écrire le texte dans un fichier du scratchpad, le passer dans `/humanizer pro` en mode silencieux, puis `humanizer-lint --strict` jusqu'à zéro finding, comme `/recap-chatwoot-from-transcript` Phase 5. Relire ensuite que le passage n'a ajouté ni retiré aucun fait. Seuls les passages rédigés par l'agent y passent : un texte collé par Romain n'est corrigé que pour les fautes.

## 10. Rendu

1. Les actions faites pendant la relecture, et celles qui attendent le go de Romain ou restent à faire avant l'envoi.
2. Le texte entier, prêt à copier (jamais un extrait ni un diff).
3. Les destinataires : à, cc (ceux du dernier message entrant, ajustés par Romain), pièces jointes.
4. Les changements notables en quelques puces, et les points où une décision de Romain manque.

Après chaque retouche demandée, redonner le texte entier. Un go donné sur une version ne couvre pas la version retouchée.

## 11. Après le go

- Envoyer dans la conversation Chatwoot du client, jamais par Gmail ; un nouveau sujet ouvre une nouvelle conversation. Avec des cc : interface Chatwoot ou API directe avec `cc_emails` (le MCP `messages_create` les perd), puis vérifier `content_attributes.cc_emails` du message créé. Un cc oublié : répondre au fil avec la personne en copie et un mot d'excuse court. Joindre la pièce annoncée et vérifier qu'elle est partie.
- Les accès liés (partage d'un Sheet) se donnent après l'envoi.
- Puis `/chatwoot-updated` sur cette conversation seulement.
