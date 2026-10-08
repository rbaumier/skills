# DPIA Risk Scoring Methodology

5×5 semi-quantitative risk assessment matrix. Risks are assessed from the **data subject's perspective** per Recital 75 GDPR and EDPB Guidelines WP 248 rev.01.

---

## Likelihood Scale

| Score | Level | Anchor Description |
|-------|-------|--------------------|
| 1 | **Negligible** | Theoretically possible but no realistic scenario under current conditions. Extensive, proven safeguards in place. No known precedent in similar contexts. Would require extraordinary and unlikely combination of failures. |
| 2 | **Limited** | Unlikely under normal operating conditions. Would require an unusual combination of failures or deliberate, sophisticated attack. Safeguards exist but are not foolproof. Rare precedent in the sector. |
| 3 | **Moderate** | Could occur in foreseeable circumstances. Some precedent exists in similar processing contexts. Safeguards reduce but do not eliminate the possibility. Requires attention but not an immediate concern. |
| 4 | **Significant** | Likely to occur without additional safeguards. Has occurred in comparable contexts or organizations. Current controls are insufficient. Active threat vectors exist. |
| 5 | **Maximum** | Almost certain to occur or is inherent in the processing design. Would require affirmative countermeasures to prevent. Known, active exploitation in the sector. |

### Factors increasing likelihood
- Processing at scale (larger attack surface)
- Internet-connected systems vs. air-gapped
- Multiple data recipients, complex processor chains
- Novel technology with unproven security posture
- Weak or absent access controls / encryption
- Inadequate staff training or awareness
- History of incidents in the sector or organization
- High attractiveness of data to malicious actors
- Regulatory enforcement trend in this area

### Factors reducing likelihood (through mitigations)
- Strong encryption at rest and in transit with sound key management
- Effective pseudonymization with technically separated keys (EDPB 2025 Guidelines)
- Edge/local processing instead of cloud transmission (EDPB 1/2020)
- Robust access controls (RBAC/ABAC, MFA, privileged access management)
- Regular security testing, penetration testing, red teaming
- Staff training and security awareness programs
- Incident detection and response capabilities (SIEM, SOC)
- Data minimization practiced in reality, not just in policy

---

## Severity Scale (Impact on Data Subject)

| Score | Level | Anchor Description |
|-------|-------|--------------------|
| 1 | **Negligible** | Minor inconvenience the data subject can easily overcome. No lasting effect. Example: receiving unwanted marketing email, minor administrative annoyance. |
| 2 | **Limited** | Temporary difficulties the data subject can overcome with some effort. No permanent damage. Example: need to re-register for a service, minor financial cost (< €100), temporary anxiety. |
| 3 | **Significant** | Serious difficulties that can be overcome but with real effort, time, or cost. Example: blacklisting requiring dispute, financial cost (€100–€10,000), health concern requiring medical attention, employment difficulty. |
| 4 | **High** | Serious consequences that may be irreversible or very difficult to overcome. Example: long-term financial damage, job loss, health deterioration, relationship breakdown, significant psychological harm. |
| 5 | **Maximum** | Devastating, potentially irreversible consequences. Example: endangerment of life or physical safety, permanent financial ruin, severe discrimination with lasting social exclusion, loss of liberty. |

### Factors increasing severity
- Sensitivity of data (Art. 9 > financial > behavioral > basic contact)
- Vulnerability of data subjects (children, employees, patients)
- Irreversibility of harm (genetic disclosure, reputational damage)
- Power imbalance between controller and data subject
- Essential nature of affected service (banking, healthcare, housing, employment)
- Number of individuals affected (wider impact = higher aggregate severity)
- Difficulty of remediation for the individual
- Cascading effects (one harm enabling further harms)

### Factors reducing severity (through mitigations)
- Data minimization limits scope of potential harm
- Pseudonymization reduces identifiability
- Transparency enables informed decisions and protective action
- Effective rights mechanisms enable remediation
- Rapid breach notification enables protective measures
- Human oversight of automated decisions reduces error persistence
- Compensation or insurance mechanisms for financial harm

---

## Risk Level Matrix

Risk Score = Likelihood × Severity

|  | **Sev. 1** | **Sev. 2** | **Sev. 3** | **Sev. 4** | **Sev. 5** |
|---|:---:|:---:|:---:|:---:|:---:|
| **Lik. 5** | 5 Med | 10 High | 15 VHigh | 20 VHigh | 25 VHigh |
| **Lik. 4** | 4 Med | 8 High | 12 High | 16 VHigh | 20 VHigh |
| **Lik. 3** | 3 Low | 6 Med | 9 High | 12 High | 15 VHigh |
| **Lik. 2** | 2 Low | 4 Med | 6 Med | 8 High | 10 High |
| **Lik. 1** | 1 Low | 2 Low | 3 Low | 4 Med | 5 Med |

### Risk Level Thresholds

| Score Range | Level | Implication |
|-------------|-------|-------------|
| **1–3** | **Low** | Acceptable. Document and monitor. No specific action required beyond existing safeguards. |
| **4–6** | **Medium** | Action recommended. Implement additional safeguards. Monitor effectiveness. |
| **7–12** | **High** | Action required. Significant mitigation needed before processing can proceed. Document justification if residual risk remains at this level. |
| **13–25** | **Very High** | Processing may not be permissible without fundamental redesign. Art. 36 prior consultation with the SA is likely required if residual risk remains at this level after all feasible mitigations. |

---

## Scoring Discipline

1. **Always justify scores with reference to the anchor descriptions.** "Likelihood 3 because precedent exists in the sector (X incident at comparable organization) and current access controls are standard but not hardened."

2. **Score pre-mitigation first, then re-score after mitigations.** This shows the effect of safeguards and makes the DPIA defensible.

3. **Mitigations primarily reduce likelihood.** Encryption, access controls, and pseudonymization reduce the probability of the risk materializing. They rarely reduce severity — if the risk does materialize despite safeguards, the impact on the data subject is often unchanged.

4. **Severity is largely inherent to the data and context.** The sensitivity of data, vulnerability of subjects, and nature of the service determine severity. Mitigations can sometimes reduce severity (e.g., data minimization means less data exposed if breached), but the effect is smaller than on likelihood.

5. **Be honest about uncertainty.** If scoring is genuinely difficult, give a range and explain: "Likelihood is between 2 and 3 depending on whether the cloud provider's supplementary measures are effective against government access requests."

6. **Avoid the "medium-medium" trap.** Untrained assessors default to the center of the matrix. Use the anchor descriptions to force honest calibration. A 3×3 should be justified, not a default.
