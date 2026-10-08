# 🇧🇪 Belgium — APD Blacklist (Art. 35(4))

**Authority:** Autorité de protection des données (APD) / Gegevensbeschermingsautoriteit (GBA).
**Document:** "List of the types of processing operations for which a DPIA shall be required."
**Official source:** EDPB file: be_list_of_the_types_of_processing_operations_for_which_a_dpia_shall_be_required.pdf; EDPB Register of Decisions entry for Belgium.
**EDPB consistency:** Subject to EDPB Opinion under Art. 64(1)(a).
**Character:** Heavy emphasis on biometric data (notably low threshold for public/accessible spaces) and exclusionary processing based on third-party data.

---

## Blacklist Entries

### 1. Biometric data for unique identification in public or publicly accessible private spaces
Facial recognition, iris scanning, or other biometric identification in any space accessible to the public — including privately owned spaces (retail stores, hotels, event venues, transport hubs).

**Why it matters:** Belgium sets one of the **lowest thresholds** in the EU for biometric identification. Unlike other jurisdictions that require "large scale," the Belgian list triggers a DPIA for **any** biometric identification deployment in public/accessible spaces regardless of scale. This effectively covers nearly all facial recognition deployments in retail, hospitality, security, and events.

**EDPB criteria:** 4 (Art. 9 sensitive) + 3 (monitoring).

### 2. Genetic data processing combined with vulnerable data subjects or employment
Genetic testing in employment contexts (pre-employment genetic screening, workplace health genetics), insurance genetic profiling, genetic data processing involving children, patients, or other vulnerable groups.

**EDPB criteria:** 4 (Art. 9 sensitive) + 7 (vulnerable).

### 3. Third-party data collection to decide on service refusal or contract termination
Consulting credit bureaus, industry blacklists, or other external data sources to decide whether to refuse, terminate, or modify a service contract. Covers insurance, telecoms, banking, and rental sectors.

**Why it matters:** Explicitly targets "blacklisting" practices and credit-check-driven exclusion. The risk is amplified because the data subject may not know what third-party data was used or have a meaningful opportunity to challenge it.

**EDPB criteria:** 6 (matching datasets) + 9 (blocking rights).

### 4. Systematic monitoring of employee activity
Electronic communications surveillance, internet usage monitoring, productivity tracking, time-and-attendance systems with behavioral analysis.

**EDPB criteria:** 3 (monitoring) + 7 (vulnerable — employees).

### 5. Large-scale processing of children's data for profiling or targeted marketing
Edtech platforms, gaming, social media, and advertising targeting minors.

**EDPB criteria:** 1 (scoring) + 5 (large scale) + 7 (vulnerable — children).

### 6. Health data via active implantable medical devices
Data collected from pacemakers with remote monitoring, insulin pumps with connectivity, cochlear implants, neurostimulators, or any implantable medical device transmitting health data.

**Why it matters:** Unique to Belgium. Recognizes the specific risks of health data collected via devices physically inside the patient's body — combining intimate health monitoring with IoT connectivity risks.

**EDPB criteria:** 4 (Art. 9 sensitive) + 8 (innovative tech).

### 7. Large-scale systematic evaluation of personal aspects with legal/significant effects
Comprehensive profiling systems in HR, insurance, and financial services producing decisions with legal or similarly significant consequences.

**EDPB criteria:** 1 (scoring) + 2 (automated decisions) + 5 (large scale).

### 8. Systematic monitoring of publicly accessible areas
Large-scale CCTV, public area surveillance. Aligns with Art. 35(3)(c).

**EDPB criteria:** 3 (monitoring) + 5 (large scale).

---

## Key Belgian Considerations

**Low biometric threshold:** When advising on processing involving any form of biometric identification in Belgium, assume a DPIA is required unless the processing occurs in a strictly non-public, access-restricted environment. The absence of a "large scale" qualifier for Entry 1 is deliberate and significantly more protective than most other Member States.

**The APD list is explicitly non-exhaustive:** The published list reminds controllers that a DPIA is always required when Art. 35(1) conditions are met, even if the specific processing is not listed.
