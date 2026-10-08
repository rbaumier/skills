# 🇮🇹 Italy — Garante Blacklist (Art. 35(4))

**Authority:** Garante per la protezione dei dati personali.
**Document:** "Elenco delle tipologie di trattamenti soggetti al requisito di una valutazione d'impatto sulla protezione dei dati ai sensi dell'art. 35, comma 4, del Regolamento (UE) n. 2016/679."
**Publication:** Gazzetta Ufficiale n. 269 del 19 novembre 2018. Deliberazione n. 467 dell'11 ottobre 2018 (Doc. web n. 9058979).
**Official source:** garanteprivacy.it/home/docweb/-/docweb-display/docweb/9058979.
**EDPB consistency:** Revised following EDPB Opinion 12/2018 (25 September 2018) under Art. 64(1)(a).
**Character:** 12 entries. Broad scope with emphasis on profiling, automated decision-making, employee monitoring via technology, and inter-controller data exchange. Several entries include a "plus one criterion" condition — requiring at least one additional WP 248 criterion to trigger the DPIA.

---

## Blacklist Entries

### 1. Large-scale evaluation, scoring, and profiling
Evaluative or scoring processing on a large scale, including profiling and predictive activities (also online or via apps). Covers: professional performance, economic situation, health, personal preferences, reliability, behavior, location, movements.

**EDPB criteria:** 1 (scoring) + 5 (large scale).

### 2. Automated decision-making with legal or significant effects
Automated processing producing "legal effects" or similarly significantly affecting the data subject. Includes decisions that refuse services, terminate contracts, or block rights. Example: bank customer screening via credit risk databases.

**EDPB criteria:** 2 (automated decisions) + 9 (blocking rights).

### 3. Systematic monitoring and observation
Systematic use of data for observation, monitoring, or control of data subjects, including data collected via networks (also online or via apps). Explicitly includes metadata processing in telecoms and banking — not only for profiling but also for organizational, budgetary, anti-fraud, anti-spam, or security purposes.

**Why it matters:** Italy takes a notably broad view of "systematic monitoring" — even metadata processing for legitimate operational purposes (network optimization, anti-fraud) is captured if it involves systematic observation of individuals.

**EDPB criteria:** 3 (monitoring).

### 4. Highly personal data at large scale
Large-scale processing of data of an "extremely personal character" (per WP 248): data connected to family or private life (including electronic communications), data affecting exercise of a fundamental right, or data whose breach would seriously impact daily life. Example: financial data usable for payment fraud.

**EDPB criteria:** 4 (highly personal) + 5 (large scale).

### 5. Employee monitoring via technology
Processing in the employment context through technological systems (video surveillance, geolocation) enabling remote monitoring of employee activities. Governed by Art. 4 of Law No. 300/1970 (Statuto dei Lavoratori) and Art. 23 of Legislative Decree No. 151/2015.

**Why it matters:** Italian labor law imposes strict limits on remote worker surveillance (Art. 4 Statuto dei Lavoratori). The DPIA obligation reinforces these protections. Any technological monitoring of employees — GPS, video, keystroke logging, productivity software — requires both a DPIA and compliance with the Statuto dei Lavoratori (typically requiring a trade union agreement or labor inspectorate authorization).

**EDPB criteria:** 3 (monitoring) + 7 (vulnerable — employees).

### 6. Non-occasional processing of vulnerable persons' data
Non-occasional processing of data relating to vulnerable subjects: minors, disabled persons, elderly persons, mentally ill persons, patients, asylum seekers.

**Note:** The threshold is "non-occasional" — lower than "large scale." Even routine, regular processing of vulnerable persons' data triggers a DPIA if it is not merely incidental.

**EDPB criteria:** 7 (vulnerable).

### 7. Innovative technology (+ one criterion)
Processing using innovative technologies or particular organizational solutions: IoT, AI systems, online voice assistants (voice/text scanning), wearable monitoring, proximity tracking (wi-fi tracking). **DPIA required only when at least one other WP 248 criterion also applies.**

**EDPB criteria:** 8 (innovative tech) + at least one other criterion.

### 8. Large-scale inter-controller data exchange
Exchange of personal data between different data controllers on a large scale via electronic/telematic means.

**Why it matters:** Explicitly targets large-scale data-sharing ecosystems — common in Italy's health service (SSN), financial sector, and public administration networks. The trigger is the exchange itself, regardless of whether the individual controllers process at large scale.

**EDPB criteria:** 5 (large scale) + 6 (matching datasets).

### 9. Data interconnection, combination, or cross-referencing
Processing involving interconnection, combination, or comparison of data, including cross-referencing of digital goods consumption data with payment data (e.g., mobile payment technology).

**EDPB criteria:** 6 (matching datasets).

### 10. Special category / criminal data when interconnected
Processing of Art. 9 special category data or Art. 10 criminal conviction data **when interconnected with other personal data collected for different purposes.**

**Why it matters:** This entry does not require large scale — any interconnection of special category or criminal data with data collected for a different purpose triggers a DPIA. This is significant for multi-purpose databases that combine, e.g., health records with employment data.

**EDPB criteria:** 4 (sensitive data) + 6 (matching datasets).

### 11. Systematic biometric data processing (+ one criterion)
Systematic processing of biometric data, considering volume, duration, and persistence. **DPIA required only when at least one other WP 248 criterion also applies.**

**EDPB criteria:** 4 (Art. 9 sensitive) + at least one other criterion.

### 12. Systematic genetic data processing (+ one criterion)
Systematic processing of genetic data, considering volume, duration, and persistence. **DPIA required only when at least one other WP 248 criterion also applies.**

**EDPB criteria:** 4 (Art. 9 sensitive) + at least one other criterion.

---

## Key Italian Considerations

**Statuto dei Lavoratori (Workers' Statute):** Entry 5 intersects with Art. 4 of Law 300/1970, which requires either a trade union agreement or authorization from the Ispettorato Nazionale del Lavoro (labor inspectorate) before installing technological monitoring systems. The DPIA and Art. 4 authorization are separate obligations — both must be satisfied. Always ask about trade union agreements when assessing employee monitoring in Italy.

**"Plus one criterion" entries:** Entries 7 (innovative tech), 11 (biometric), and 12 (genetic) were modified following EDPB Opinion 12/2018 to require at least one additional WP 248 criterion. This prevents a DPIA obligation from being triggered by a single criterion alone in these categories.

**Low threshold for vulnerable persons:** Entry 6 uses "non-occasional" rather than "large scale" — a materially lower bar. Regular processing of patients, minors, or elderly persons' data triggers a DPIA even at modest scale.

**Inter-controller exchange (Entry 8):** Particularly relevant for Italy's Servizio Sanitario Nazionale (SSN), where health data flows between ASL (local health authorities), hospitals, GPs, pharmacies, and regional health information systems. Also relevant for Italy's extensive public administration data-sharing frameworks.

**The Garante list is explicitly non-exhaustive:** The Garante states that inclusion on the list does not automatically require a DPIA, and absence from the list does not exempt controllers from conducting one. The accountability principle applies.
