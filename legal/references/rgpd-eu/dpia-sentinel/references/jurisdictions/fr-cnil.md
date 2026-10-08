# 🇫🇷 France — CNIL Blacklist (Art. 35(4)) and DPIA Methodology

**Authority:** Commission Nationale de l'Informatique et des Libertés (CNIL).
**Blacklist:** Published in the Journal Officiel de la République française; notified to EDPB.
**Official sources:** cnil.fr/fr/guidelines-dpia (guidelines), cnil.fr/en/privacy-impact-assessment-pia (PIA tools), EDPB file: list_of_processing_operations_for_which_dpia_is_required_fr.pdf
**Whitelist:** Subject to EDPB Opinion 7/2020 (Art. 35(5)). See `whitelists.md`.
**Character:** Comprehensive, one of the first approved. Strong sectoral focus on health, HR, and shared exclusion systems. CNIL also offers the most developed DPIA methodology toolkit in the EU.

---

## Blacklist Entries

### 1. Health data warehouses (entrepôts de données de santé)
Large-scale health data repositories for research, epidemiological studies, or public health monitoring. Particularly relevant due to France's centralized health data initiatives (Health Data Hub / Plateforme des données de santé).

**EDPB criteria:** 4 (Art. 9 sensitive) + 5 (large scale).

### 2. Profiling of individuals for HR management
Performance profiling, competency scoring, talent assessment algorithms, automated career pathing, promotion prediction systems.

**EDPB criteria:** 1 (scoring) + 7 (vulnerable — employees).

### 3. Shared databases on contractual breaches (mutualized blacklists)
Industry-wide shared exclusion lists: non-paying tenants, fraudulent customers, defaulting borrowers. Multiple controllers pooling negative data for exclusionary decisions.

**Why it matters:** Severe impact because exclusion propagates across an entire industry. A single entry can block access to housing, insurance, or financial services sector-wide.

**EDPB criteria:** 6 (matching datasets) + 9 (blocking rights).

### 4. Biometric data for identification at the workplace or for service access
Fingerprint or facial recognition for employee access control, biometric authentication for customer-facing services.

**EDPB criteria:** 4 (Art. 9 sensitive) + 7 (vulnerable — employees).

### 5. Systematic monitoring of employee activities
Email monitoring, internet usage surveillance, productivity measurement, screen recording, keystroke logging.

**EDPB criteria:** 3 (monitoring) + 7 (vulnerable — employees).

### 6. Genetic data for medical or research purposes
Biobanks, genetic research, clinical trials involving genetic analysis, pharmacogenomics studies.

**EDPB criteria:** 4 (Art. 9 sensitive).

### 7. Processing for managing social housing allocation
Profiling or scoring to determine allocation of social/public housing. Algorithms determining housing priority or eligibility.

**EDPB criteria:** 1 (scoring) + 7 (vulnerable).

### 8. Systematic monitoring of publicly accessible areas
Large-scale CCTV, video surveillance of public spaces, smart city monitoring.

**EDPB criteria:** 3 (monitoring) + 5 (large scale). Aligns with Art. 35(3)(c).

### 9. Anti-fraud processing through systematic profiling and scoring
Anti-fraud systems that systematically profile individuals and may result in service denial, account closure, or reporting to authorities.

**EDPB criteria:** 1 (scoring) + 3 (monitoring) + 9 (blocking rights).

### 10. Large-scale processing of data concerning vulnerable persons
Processing in social services platforms, care home management, elderly care systems, systems serving persons receiving social assistance.

**EDPB criteria:** 4 (sensitive/highly personal) + 5 (large scale) + 7 (vulnerable).

---

## CNIL PIA Methodology

CNIL has published the most detailed public DPIA methodology in the EU, available as a three-part toolkit:

- **PIA 1 — Methodology:** Step-by-step guide for conducting DPIAs (cnil.fr/sites/cnil/files/atoms/files/cnil-pia-1-en-methodology.pdf)
- **PIA 2 — Knowledge Bases:** Templates, risk catalogs, and measure libraries
- **PIA 3 — Case Studies:** Worked examples

The CNIL methodology uses a 4-level severity scale (negligible, limited, important, maximum) and maps risks to three "feared events": illegitimate access, unwanted modification, disappearance of data. This differs from the 5×5 matrix used in this skill but is equally valid. If working with French controllers who prefer the CNIL approach, the assessment can be mapped accordingly.

CNIL also provides a free open-source DPIA software tool (PIA tool) available at github.com/LINCnil/pia.
