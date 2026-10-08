# INDEX — Routage juridique `/legal`

Table de dispatch du routeur `SKILL.md` : **type de document / besoin → spécialiste(s) → dossier de
références → fondements clés**. Un document peut activer **plusieurs** spécialistes (dispatch parallèle,
pattern `/del`), puis le routeur consolide en un rapport unique.

Chaque spécialiste est un prompt dans `agents/<nom>.md`. Le routeur lance un sous-agent
`general-purpose` en lui passant le contenu de ce prompt + le contenu à analyser + la consigne de lire
les modules `references/<dossier>/*`.

## Table de dispatch

| Type de document / besoin | Spécialiste(s) | `agents/…` | `references/…` | Fondements clés |
|---|---|---|---|---|
| Convention de formation, contrat individuel, programme, attestation, CGV d'OF | formation-france | `formation-france.md` | `formation-france/` | D6353-1, L6353-4, L6353-5/6, ind. Qualiopi 1 & 5 |
| Contrat de sous-traitance / prestation freelance, facture freelance, CRA, annexe client | formation-france | `formation-france.md` | `formation-france/droit-social-freelance.md` | 12 points requalification, prêt de main-d'œuvre (AVOXA) |
| Usage du logo Qualiopi, conformité RNQ | formation-france | `formation-france.md` | `formation-france/qualiopi.md` | 7 critères / 32 indicateurs |
| Lettre de licenciement (faute grave/lourde, motif personnel) | droit-social-contentieux-fr | `droit-social-contentieux-fr.md` | `droit-social-contentieux-fr/notification-licenciement/` | motivation = limites du litige, LRAR, entretien préalable |
| Requête au Conseil de Prud'hommes (contestation licenciement) | droit-social-contentieux-fr | `droit-social-contentieux-fr.md` | `droit-social-contentieux-fr/requete-cph-licenciement-faute-grave/` | barème L1235-3, calcul indemnités |
| Assignation en référé (communication de docs à un associé) | droit-social-contentieux-fr | `droit-social-contentieux-fr.md` | `droit-social-contentieux-fr/assignation-refere-communication-associe/` | L.238-1 c. com., 145 CPC |
| Assignation en référé (recouvrement de créance) | droit-social-contentieux-fr | `droit-social-contentieux-fr.md` | `droit-social-contentieux-fr/assignation-refere-recouvrement-creance/` | 873 al.2 CPC, L.441-6, indemnité 40 € |
| Notification de violation de données (breach) | rgpd-eu | `rgpd-eu.md` | `rgpd-eu/gdpr-breach-sentinel/` | art. 33/34, ENISA, EDPB 9/2022 & 01/2021, AI Act art. 62 |
| Analyse d'impact (AIPD / DPIA) | rgpd-eu | `rgpd-eu.md` | `rgpd-eu/dpia-sentinel/` | art. 35/36, 9 critères EDPB WP248, blacklists |
| Mentions/notice d'information (art. 13/14), multi-juridiction | rgpd-eu | `rgpd-eu.md` | `rgpd-eu/gdpr-privacy-notice-eu/`, `rgpd-eu/compliance/` | art. 13/14, 6, 9, 22 ; CCPA/LGPD/PIPEDA/PDPA/PIPL/UK ; DPA art. 28 |
| Politique de confidentialité (FR/CNIL grand public) | privacy-fr-cnil | `privacy-fr-cnil.md` | `privacy-fr-cnil/politique-confidentialite/` | CNIL 2020, art. 13/14 RGPD |
| Politique de cookies / traceurs | privacy-fr-cnil | `privacy-fr-cnil.md` | `privacy-fr-cnil/politique-cookies/` | ePrivacy, CNIL 2020, 13 mois, dark patterns |
| Politique lanceur d'alerte / dispositif de signalement | privacy-fr-cnil | `privacy-fr-cnil.md` | `privacy-fr-cnil/politique-lanceur-alerte/` | Sapin II, Waserman 2022, Décret 2022-1284, devoir de vigilance |
| Contrat commercial (SaaS, prestation, partenariat, licence) | contrats-commerciaux | `contrats-commerciaux.md` | `contrats-commerciaux/contract-review/`, `…/tech-contract-negotiation/` | GREEN/YELLOW/RED, liability/IP/data/governing law |
| NDA / accord de confidentialité | contrats-commerciaux | `contrats-commerciaux.md` | `contrats-commerciaux/nda-triage/`, `…/nda-review/` | carveouts standards, red flags |
| Due diligence fournisseur, contre-revue adversariale | contrats-commerciaux | `contrats-commerciaux.md` | `contrats-commerciaux/vendor-due-diligence/`, `…/red-team-verifier/` | scoring de risque, angles morts |
| Évaluation de risque juridique d'une décision/situation | risque-recherche-juridique | `risque-recherche-juridique.md` | `risque-recherche-juridique/legal-risk-assessment-anthropic/` | matrice sévérité × probabilité |
| Recherche juridique FR/EU (jurisprudence, doctrine, textes) | risque-recherche-juridique | `risque-recherche-juridique.md` | `risque-recherche-juridique/legal-risk-assessment-laik/`, `…/statute-analysis/` | méthodo adversariale, vérification temporelle |
| Analyse de litige / médiation, simulation pédagogique | risque-recherche-juridique | `risque-recherche-juridique.md` | `risque-recherche-juridique/mediation-dispute-analysis/`, `…/legal-simulation/` | BATNA/WATNA/ZOPA, personas |
| Contrat NIL (Name, Image, Likeness) NCAA — droit US | nil-sports | `nil-sports.md` | `nil-sports/nil-contract-analysis/` | 9 exigences, 9 red flags, Floride 1006.74 |

## Exemples multi-domaines (dispatch parallèle)

- **Contrat de sous-traitance freelance avec annexe RGPD** → `formation-france` (droit social) + `contrats-commerciaux` + `rgpd-eu`.
- **CGV d'un OF avec politique de cookies sur le site** → `formation-france` + `privacy-fr-cnil`.
- **Contrat SaaS d'un sous-traitant traitant des données perso** → `contrats-commerciaux` + `rgpd-eu` (DPA art. 28).
- **Notification de licenciement + évaluation du risque prud'homal** → `droit-social-contentieux-fr` + `risque-recherche-juridique`.

## Spécialistes (7)

| Spécialiste | Prompt | Domaine |
|---|---|---|
| formation-france | `agents/formation-france.md` | Formation pro, Qualiopi, RGPD/CNIL base OF, droit social freelance (appelable aussi via `subagent_type: legal-reviewer`) |
| droit-social-contentieux-fr | `agents/droit-social-contentieux-fr.md` | Licenciement, requête CPH, assignations en référé (rédaction d'actes) |
| rgpd-eu | `agents/rgpd-eu.md` | Breach, DPIA, notices art. 13/14, multi-juridiction, DPA art. 28 |
| privacy-fr-cnil | `agents/privacy-fr-cnil.md` | Politiques confidentialité / cookies / lanceur d'alerte (CNIL) |
| contrats-commerciaux | `agents/contrats-commerciaux.md` | Contract review, NDA, tech/SaaS, vendor DD, red-team |
| risque-recherche-juridique | `agents/risque-recherche-juridique.md` | Risk matrix, recherche FR/EU, statute, médiation, simulation |
| nil-sports | `agents/nil-sports.md` | Contrats NIL NCAA (droit US, niche) |

## Modules de support transverses (non-spécialistes)

Utilisés par les spécialistes, pas lancés seuls :

- `references/_production-documents/` — savoir-faire de génération `.docx` / `.pdf` / `.pptx` / `.xlsx`.
  À charger quand un spécialiste doit **produire un livrable de document** (assignation, politique, mémo).
- `references/_communications/` — réponses-types (`canned-responses`), briefing de réunion, Outlook.
- `references/_outillage/` — méta-outillage (skill-creator, skill-optimizer, vscode-extension-builder,
  tabular-review, security-review). Annexe, hors revue juridique.
