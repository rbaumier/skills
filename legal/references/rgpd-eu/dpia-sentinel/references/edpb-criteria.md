# EDPB Nine Criteria for "High Risk" — WP 248 rev.01

Central EU-level guidance. EDPB Endorsement 1/2018 confirms WP29 documents remain valid as EDPB Guidelines.

Source: Guidelines on Data Protection Impact Assessment (DPIA) and determining whether processing is "likely to result in a high risk" for the purposes of Regulation 2016/679, WP 248 rev.01 (adopted 4 April 2017, revised 4 October 2017).

Official references: EC Newsroom doc_id=47711, mirrored by UOOU, Datatilsynet, and multiple SAs.

---

## Art. 35(3) — Mandatory DPIA Triggers (check first)

These three cases always require a DPIA. No criteria analysis needed.

**(a) Systematic and extensive evaluation of personal aspects** based on automated processing, including profiling, on which decisions are based that produce legal effects or similarly significantly affect the natural person.
- Credit scoring, e-recruiting, algorithmic insurance pricing, automated loan decisions, AML risk profiling, recidivism prediction.
- "Systematic and extensive" sets a higher bar than simple automated processing. One-off automated checks may not qualify.
- "Legal effects" = denial of citizenship, benefits, border entry, contract termination by algorithm.
- "Similarly significant effects" = credit denial, insurance refusal, algorithmic service access.

**(b) Large-scale processing of special categories of data** (Art. 9(1)) or data relating to criminal convictions and offences (Art. 10).
- Hospital/regional health databases, genetic research repositories, biometric employee identification systems, criminal intelligence databases.
- "Large scale" distinguishes a single doctor's practice (not large scale) from a hospital system (large scale).
- The four factors for "large scale": number of data subjects, volume of data, duration, geographic extent.

**(c) Systematic monitoring of a publicly accessible area on a large scale.**
- City-wide CCTV, drone surveillance, public Wi-Fi/Bluetooth tracking, smart city sensor networks.
- "Publicly accessible" includes privately owned spaces open to the public (shopping malls, train stations).
- "Systematic" = pre-arranged, organized, methodical, continuous or at regular intervals.

---

## The Nine Criteria

### 1. Evaluation or Scoring
Profiling and predicting aspects concerning data subjects: work performance, economic situation, health, personal preferences, interests, reliability, behavior, location, movements.

Indicators: credit scoring agencies, behavioral marketing profiles, employee performance scoring, insurance risk profiling, tenant screening, customer churn prediction, fraud propensity scoring, AI personality/sentiment assessment (e.g., voice analysis in call centers).

### 2. Automated Decision-Making with Legal or Similarly Significant Effect
Aligns with Art. 22 GDPR. Decisions made purely or predominantly by machines that impact legal status or have comparable effects.

Indicators: automatic refusal of online credit applications, algorithmic denial of insurance, content moderation bans with significant consequences, automated border control decisions, dynamic pricing excluding individuals from essential goods.

Key nuance: A system that "recommends" but requires human approval may not meet this criterion — but only if the human genuinely exercises independent judgment. Rubber-stamping counts as automated.

### 3. Systematic Monitoring
Processing used to observe, monitor, or control data subjects. "Systematic" means pre-arranged, organized, methodical, as part of a plan.

Indicators: CCTV (public or workplace), employee email/internet monitoring, DLP systems, fleet management/GPS tracking, smart metering, online behavioral tracking (cookies, fingerprinting, cross-site), location tracking via mobile/IoT, drone surveillance, connected vehicle telemetry.

Data subjects may not be aware of the collection or its extent — this amplifies risk.

### 4. Sensitive Data or Data of a Highly Personal Nature
Art. 9 special categories: racial/ethnic origin, political opinions, religious/philosophical beliefs, trade union membership, genetic data, biometric data for unique identification, health data, sex life/sexual orientation.

Art. 10: criminal convictions and offences.

Beyond Art. 9/10 — "highly personal" data: financial data (accounts, salary, debts, spending), location data (especially continuous or high-precision), private communications (emails, messages, calls), browsing/search history, data subject to professional secrecy (legal, medical, tax), household activity data (smart home), data from which special categories can be inferred (pharmacy purchases → health; app usage → orientation).

### 5. Data Processed on a Large Scale
No fixed numerical threshold. Four assessment factors:

| Factor | Indicators of Large Scale |
|--------|--------------------------|
| Number of data subjects | Percentage of relevant population, absolute numbers in thousands+ |
| Volume of data | Comprehensive profiles vs. single data points; range of data items |
| Duration | Continuous/permanent vs. one-time; months or years of retention |
| Geographic extent | Regional, national, multi-country vs. single office/location |

EDPB examples: hospital patient data = large scale. Individual physician = not large scale. Search engine queries = large scale. Small law firm clients = not large scale.

### 6. Matching or Combining Datasets
Data from two or more processing operations performed for different purposes and/or by different controllers.

Indicators: data enrichment from third-party sources, cross-service data combination within platform ecosystems, post-merger data integration, open data + personal data for profiling, AI training data from multiple sources, smart city platforms combining CCTV + transport + mobile data.

Core risk: function creep — data collected for one purpose repurposed when combined, undermining purpose limitation (Art. 5(1)(b)).

### 7. Data Concerning Vulnerable Data Subjects
Vulnerability from power imbalance making it difficult to consent freely or oppose processing.

Categories: children (under 18, limited capacity), employees (economic dependence), elderly (reduced digital literacy/cognitive capacity), patients/disabled persons (health dependency), asylum seekers/refugees (legal vulnerability), persons with mental health conditions.

Where vulnerability exists, "consent" as legal basis is generally unreliable. Consider alternative bases and stronger safeguards.

### 8. Innovative Use or Application of New Technological or Organizational Solutions
Novel technology or existing technology in novel application where personal/social consequences are not yet fully understood.

Current examples: generative AI/LLMs (EDPB Opinion 28/2024), facial recognition (especially real-time public), brain-computer interfaces, IoT ecosystems (EDPB Guidelines 1/2020), blockchain for personal data (immutability vs. erasure), emotion/sentiment AI, digital twins, synthetic data from personal data, biometric payment systems.

The risk lies in unknown consequences, not novelty per se. A new technology with well-understood privacy implications may score lower than familiar technology in genuinely novel context.

### 9. Processing that Prevents Exercising a Right or Using a Service or Contract
Processing aimed at allowing, modifying, or refusing data subject's access to a service or entry into a contract.

Indicators: bank screening against blacklists to deny accounts, algorithmic service access determination, credit bureau checks blocking loans, insurance refusals on automated assessment, platform bans from content moderation, shared industry blacklists (non-paying tenants, fraudulent customers), insolvency registers for exclusionary purposes.

This is about the **effect** on the data subject's ability to act, not mere data collection.

---

## Two-Criteria Rule — Application

**2+ criteria met:** Strong presumption DPIA is required. Controller should conduct one unless they provide exceptionally well-documented justification that processing does NOT result in high risk despite multiple criteria. Justification must be retained (accountability, Art. 5(2)).

**Exactly 1 criterion:** DPIA recommended but not presumptively required. Assess: how strongly does it apply? Severity of potential impact? National blacklist match? Would a reasonable SA expect a DPIA?

**0 criteria:** DPIA likely not required. Still check national blacklists and document the analysis.

**Best practice:** When in doubt, conduct the DPIA. Cost of an unnecessary DPIA is low. Cost of a missing one: up to €10M or 2% global turnover (Art. 83(4)(a)).

---

## Annex 2 of WP 248 — Criteria for an Acceptable DPIA

The EDPB established minimum requirements that any DPIA methodology must meet:

1. Systematic description of processing (purposes, legal basis, necessity, proportionality)
2. Assessment of necessity and proportionality in relation to the purposes
3. Assessment of risks to rights and freedoms of data subjects
4. Measures to address risks (safeguards, security measures, mechanisms for compliance)
5. Documentation of the above
6. Monitoring and review

These map directly to Art. 35(7)(a)–(d) plus accountability requirements.

---

## Multi-Jurisdictional DPIA Analysis

When a controller operates across multiple EU/EEA Member States, the DPIA threshold assessment and the substantive risk analysis must account for all relevant jurisdictions. This is one of the most complex practical aspects of DPIA compliance.

### Which national blacklists apply?

The DPIA obligation under Art. 35(1) is triggered by the nature of the processing, not by the controller's location. National Art. 35(4) blacklists further specify this obligation for their territory. The key question is: **which territories are relevant?**

**Rule: Check the blacklist of every jurisdiction where:**
1. The controller has an establishment that is involved in the processing (not just the main establishment)
2. Data subjects are located
3. The processing takes place (e.g., servers, edge devices, surveillance cameras)

**The one-stop-shop does NOT limit the DPIA obligation.** Art. 56 GDPR's one-stop-shop mechanism determines which SA is the Lead SA for cross-border enforcement. It does NOT determine which Art. 35(4) lists apply. A controller with its main establishment in Ireland (Lead SA: DPC) that processes employee data in Germany must still check the DSK blacklist for the German processing — the DPC blacklist alone is insufficient.

### Decision framework for multi-jurisdictional threshold assessment

```
Step 1: Identify all relevant jurisdictions
  → Main establishment (Lead SA jurisdiction)
  → Other establishments involved in the processing
  → Locations of data subjects
  → Locations where processing physically occurs

Step 2: Run Art. 35(3) mandatory trigger check (universal — applies regardless of jurisdiction)

Step 3: Run EDPB 9-criteria analysis (universal)

Step 4: Check Art. 35(4) blacklist for EACH relevant jurisdiction
  → A blacklist match in ANY jurisdiction = DPIA required for that processing

Step 5: Check Art. 35(5) whitelists ONLY for jurisdictions where they exist
  → A whitelist exemption only applies within that jurisdiction
  → A blacklist match in another jurisdiction OVERRIDES the whitelist exemption
  → The processing must match the whitelist entry precisely in ALL conditions

Step 6: Consolidate result
  → If DPIA is triggered by ANY jurisdiction: one DPIA covering all jurisdictions
  → The DPIA should document which jurisdictional lists were checked and the outcome for each
```

### Conflicting outcomes across jurisdictions

It is common for the same processing activity to produce different results across jurisdictions:

| Scenario | Example | Resolution |
|----------|---------|------------|
| **Blacklisted in one, silent in another** | Biometric access control: blacklisted in Germany (DSK #7), not specifically listed in Ireland | DPIA required — the blacklist in any relevant jurisdiction triggers it |
| **Blacklisted in one, whitelisted in another** | Badge-based access control: blacklisted in Belgium (APD #1 — low biometric threshold), whitelisted in France (CNIL — non-biometric badge/keycard exempt) | Depends on whether the system uses biometrics. If yes: Belgian blacklist applies, French whitelist is irrelevant. If no biometrics: French whitelist may apply for France, but check Belgian list carefully (APD Entry 1 is biometrics-specific) |
| **Different risk emphasis across jurisdictions** | Employee email monitoring: DSK emphasizes DLP systems, UODO emphasizes working time monitoring, CNIL emphasizes systematic surveillance | DPIA should address ALL jurisdictional risk perspectives — the risk assessment section should note which jurisdiction's concerns are being addressed |
| **Processing exempt everywhere** | Standard payroll: whitelisted in France, Austria, Czech Republic, Spain | If whitelisted in all relevant jurisdictions AND no blacklist match anywhere AND fewer than 2 EDPB criteria met: DPIA not required. Document the multi-jurisdictional whitelist analysis |

### Documentation requirements for multi-jurisdictional DPIAs

The DPIA report (Section 2: Threshold Assessment) should include:

1. **Jurisdictional scope table**: List each relevant jurisdiction, why it's relevant, and the blacklist/whitelist check result
2. **Per-jurisdiction blacklist analysis**: For each applicable national list, state whether the processing matches an entry and cite the specific entry
3. **Conflict resolution**: Where outcomes differ across jurisdictions, explain the resolution and which jurisdiction's stricter standard is applied
4. **Consolidated conclusion**: One clear statement on whether a DPIA is required, incorporating all jurisdictional inputs

### Art. 36 prior consultation in multi-jurisdictional context

If the DPIA concludes that residual risk remains high and Art. 36 consultation is required:
- **Controller with EU establishment:** Consult the **Lead SA** under the one-stop-shop mechanism (Art. 56). The Lead SA coordinates with Concerned SAs.
- **Controller without EU establishment:** One-stop-shop does NOT apply. Must consult **each SA** in jurisdictions where data subjects are affected. Track submissions individually.
- The Art. 36 consultation package should reference the multi-jurisdictional threshold analysis and explain which jurisdictions' blacklist entries triggered the DPIA.
