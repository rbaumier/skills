# National Whitelists — Art. 35(5) DPIA Exemptions

Processing operations that do NOT require a DPIA. These provide safe harbors for low-risk, routine processing.

**Critical rules:**
- Whitelists are **narrow**. Exemptions apply ONLY if processing matches the description precisely.
- Adding profiling, automated decisions, biometrics, or special category data to otherwise exempt processing **removes the exemption**.
- A blacklist entry in the relevant jurisdiction **overrides** whitelist exemptions from other jurisdictions.
- The EDPB has taken a restrictive view during consistency review (see Opinion 7/2020 on CNIL whitelist) to prevent whitelists from undermining the general DPIA obligation.

---

## 🇫🇷 France — CNIL Whitelist

**EDPB Opinion:** 7/2020 on the draft list of processing operations not subject to DPIA (Art. 35(5)).

| # | Exempt Processing | Strict Conditions |
|---|-------------------|-------------------|
| 1 | **HR: payroll and personnel administration** | Limited to legal obligations (social security, tax withholding, statutory record-keeping). NO profiling, biometrics, automated decision-making, or performance scoring. |
| 2 | **Physical access control via badge/keycard** | No biometrics. No special category data. Limited to access logging for premises security. |
| 3 | **Individual health professional patient care** | Individual doctors or small practices. Direct patient care only. NOT multi-practitioner clinics, hospital systems, or research. |
| 4 | **Condominium/co-ownership management** | Standard property management. No profiling or automated decisions about residents. |
| 5 | **Supplier and customer administration** | Basic CRM, invoicing, contract management. No profiling, no automated credit decisions, no data enrichment. |
| 6 | **Association/club member management** | Membership registers, dues, event communication. No profiling or behavioral analysis. |

---

## 🇨🇿 Czech Republic — UOOU Whitelist

**EDPB Opinion:** 11/2019.

| # | Exempt Processing | Strict Conditions |
|---|-------------------|-------------------|
| 1 | **Commercial communications to existing customers** | Existing relationship required. No extensive profiling. No third-party data purchasing. Opt-out provided. |
| 2 | **Single website visit processing** | Session logs, basic analytics for one visit. No cross-site tracking, no persistent identifiers, no behavioral profiles. |
| 3 | **HR and payroll for legal compliance** | Social security, tax, statutory record-keeping. No profiling, no automated decisions. |
| 4 | **Small-scale CCTV for property protection** | Short retention. Own non-public premises only. No public streets. No audio. No facial recognition. |
| 5 | **Legal compliance processing** | AML record-keeping, tax records — minimum required by law. No additional profiling or risk scoring. |

---

## 🇪🇸 Spain — AEPD Whitelist

**EDPB Opinion:** 12/2019.

| # | Exempt Processing | Strict Conditions |
|---|-------------------|-------------------|
| 1 | **Internal administration** | Accounting, invoicing, HR administration. No sensitive data (Art. 9/10). No automated decision-making. No profiling. |
| 2 | **Professional contact data** | Name, email, phone, job title of natural persons in their professional capacity. Purpose limited to B2B relations. No marketing beyond B2B. |
| 3 | **Self-employed professionals: client management** | Small-scale, direct service provision. Equivalent to CNIL's individual health professional exemption but broader (lawyers, consultants, etc.). |

---

## 🇦🇹 Austria — DSB DPIA-EO (Datenschutz-Folgenabschätzung-Ausnahmenverordnung)

Detailed ordinance with specific exemptions for standard business operations.

| # | Exempt Processing | Strict Conditions |
|---|-------------------|-------------------|
| 1 | **Standard customer administration** | CRM, orders, logistics, delivery. No profiling, no automated credit decisions, no behavioral analysis. |
| 2 | **Inventory and logistics management** | Product tracking, warehousing, supply chain. Personal data limited to business contacts and delivery addresses. |
| 3 | **Association (Verein) member administration** | Membership, dues, events. Recognizes importance of Vereinsrecht (Austrian association law). No profiling. |
| 4 | **Real-time monitoring without recording** | Live video (no storage) of non-public areas for security. Limited duration. No audio. No facial recognition. |
| 5 | **Recording in non-public areas** | Video recording with defined short retention. Non-public only. No systematic behavioral analysis. No audio. |
| 6 | **Employee administration for legal compliance** | Payroll, social security, tax, leave management. No profiling, no performance scoring, no automated decisions. |
| 7 | **Accounting and financial administration** | Invoicing, bookkeeping, tax returns, auditing. Standard financial processing for legal compliance. |

---

## Practical Application

**When checking whitelists:**
1. Identify the user's jurisdiction(s)
2. Check if the processing matches a whitelist entry **precisely**
3. Verify all strict conditions are met — a single deviation removes the exemption
4. If the processing also matches a blacklist entry in any relevant jurisdiction, the blacklist takes precedence
5. Document the whitelist analysis for accountability even if the exemption applies
