# Breach Documentation Templates

---

## 1. Art. 33 Notification to Supervisory Authority

```
PERSONAL DATA BREACH NOTIFICATION
Pursuant to Article 33 GDPR

1. CONTROLLER INFORMATION
   Organization: [Name]
   Address: [Address]
   Contact: [DPO Name, Email, Phone]

2. BREACH DETAILS
   Date/Time of Breach: [If known, or "Under investigation"]
   Date/Time of Awareness (T0): [Timestamp]
   Nature of Breach: [Confidentiality/Integrity/Availability - explain]

3. DATA AFFECTED
   Categories of Data: [Specific list]
   Approximate Number of Records: [Number or estimate with basis]
   Approximate Number of Individuals: [Number or estimate with basis]

4. LIKELY CONSEQUENCES
   [Description of potential impacts on data subjects]
   [Based on severity assessment: specific risks identified]

5. MEASURES TAKEN/PROPOSED
   Containment: [Actions taken to stop breach]
   Mitigation: [Steps to reduce impact on subjects]
   Prevention: [Future safeguards planned]

6. NOTIFICATION TO DATA SUBJECTS
   [Will communicate / Have communicated on [date] /
    Not required because: (detailed justification)]

7. CROSS-BORDER ELEMENTS (if applicable)
   Member States affected: [List]
   Establishments involved: [List]

8. ADDITIONAL INFORMATION
   [If phased notification: Information to follow includes...]
   [If delayed beyond 72h: REASONS FOR DELAY - detailed explanation]

---
Assessment generated with GDPR Breach Response Sentinel
Guidance version: EDPB Guidelines 9/2022 v2.0, ENISA Methodology v1.0
This output does not constitute legal advice.
```

---

## 2. Art. 34 Communication to Data Subjects

```
IMPORTANT: Security Incident Affecting Your Personal Data

Dear [Name/Customer],

WHAT HAPPENED
On [date], we discovered [brief, clear description of the incident -
one or two sentences maximum].

WHAT DATA WAS INVOLVED
The affected information includes:
• [Specific item 1]
• [Specific item 2]
• [Specific item 3]

[If applicable: The following was NOT affected:
(e.g., passwords, payment card numbers)]

WHAT WE ARE DOING
We immediately [containment actions - specific, not vague].

We have also:
• [Mitigation step 1]
• [Mitigation step 2]

We have notified the [relevant supervisory authority] as required by law.

WHAT YOU SHOULD DO
We recommend you take these steps to protect yourself:

1. [Specific action - e.g., "Change your password for this account
   and any other accounts where you used the same password"]
2. [Specific action - e.g., "Monitor your bank statements for
   any unauthorized transactions"]
3. [Specific action - e.g., "Be alert for suspicious emails or calls
   claiming to be from us"]

FOR MORE INFORMATION
If you have questions or concerns, please contact our Data Protection Officer:
Name: [DPO Name]
Email: [DPO Email]
Phone: [DPO Phone]

We sincerely apologize for this incident and any concern it may cause.

[Signature Block]
[Date]
```

---

## 3. Processor Client Notification (Track B)

```
NOTICE OF SECURITY INCIDENT
[Processor Name] → [Controller Name]
Issued pursuant to GDPR Article 33(2) and [DPA Reference]

Date of Notice: [Date]
Incident Reference: [Internal ID]

SUMMARY
We are writing to inform you of a security incident that may have
affected personal data we process on your behalf.

TIMELINE
• [Date/Time]: [Event - first indication]
• [Date/Time]: [Event - confirmation]
• [Date/Time]: [Event - containment]
• [Date/Time]: This notification

INCIDENT DESCRIPTION
[Factual description of what occurred - no speculation]

DATA POTENTIALLY AFFECTED
Based on our investigation, the following categories of data
may have been affected:
• [Category 1]
• [Category 2]

Estimated volume: [Number] records relating to [Number] individuals

ACTIONS TAKEN
We have implemented the following measures:
• [Action 1]
• [Action 2]
• [Action 3]

ASSISTANCE OFFERED
We are prepared to assist your assessment by providing:
• Technical logs and forensic data
• Detailed incident timeline
• Support for your regulatory notification

IMPORTANT DISCLAIMER
As Processor, we provide this information to assist your assessment
under GDPR Article 33. Final risk determination and notification
decisions rest with you as Controller. We have not assessed the
severity of this incident for your notification purposes.

CONTACT
[Processor DPO/Security Contact]
[Email]
[Phone]

Available for calls: [Hours/Timezone]
```

---

## 4. Internal Compliance Log (Art. 33(5))

```
INTERNAL BREACH RECORD
Required under GDPR Article 33(5)

═══════════════════════════════════════════════════════════════
INCIDENT IDENTIFICATION
═══════════════════════════════════════════════════════════════
Incident ID: [Unique identifier]
Date of Record: [Today's date]
Prepared by: [Name, Role]
Approved by: [DPO/Responsible person]

═══════════════════════════════════════════════════════════════
SECTION 1: FACTS OF THE BREACH
═══════════════════════════════════════════════════════════════
Discovery Date/Time: [When first suspected]
Awareness Date/Time (T0): [When reasonable certainty achieved]
T0 Triggering Event: [Specific event that established certainty]
Gap Justification: [If gap > 24h, detailed explanation]

Breach Type(s): [Confidentiality / Integrity / Availability]
Description: [Detailed factual description of what occurred]

═══════════════════════════════════════════════════════════════
SECTION 2: DATA AFFECTED
═══════════════════════════════════════════════════════════════
Categories of Personal Data:
• [Category 1]
• [Category 2]

Volume:
• Approximate Records: [Number]
• Approximate Individuals: [Number]
• Estimation Methodology: [How these numbers were determined]

Special Categories (Art. 9): [Yes/No - if yes, specify]
Vulnerable Subjects: [Yes/No - if yes, specify]

═══════════════════════════════════════════════════════════════
SECTION 3: RISK ASSESSMENT (ENISA METHODOLOGY)
═══════════════════════════════════════════════════════════════
DPC (Data Processing Context):
• Base Category: [Simple/Behavioral/Financial/Sensitive]
• Base Score: [1-4]
• Adjustments Applied: [List with reasoning]
• Final DPC: [Score]

EI (Ease of Identification):
• Identifier Types Present: [List]
• Assessment: [Negligible/Limited/Significant/Maximum]
• Final EI: [0.25/0.50/0.75/1.00]

CB (Circumstances of Breach):
• Confidentiality: [0/+0.25/+0.50] - [Reasoning]
• Integrity: [0/+0.25/+0.50] - [Reasoning]
• Availability: [0/+0.25/+0.50] - [Reasoning]
• Malicious Intent: [0/+0.50] - [Reasoning]
• Total CB: [Sum]

SEVERITY CALCULATION:
SE = (DPC × EI) + CB
SE = ([DPC] × [EI]) + [CB]
SE = [Final Score]

Severity Level: [LOW / MEDIUM / HIGH / VERY HIGH]

EDPB Case Comparison:
• Most Similar Case: [Case XX - Description]
• EDPB Recommendation: [SA: Y/N, Subjects: Y/N]
• Differences from Our Situation: [List]
• Impact on Assessment: [Supports/Requires reconsideration]

═══════════════════════════════════════════════════════════════
SECTION 4: OVERRIDE DOCUMENTATION (IF APPLICABLE)
═══════════════════════════════════════════════════════════════
System-Calculated Verdict: [LEVEL] (SE = [score])
Final Classification Selected: [LEVEL]
Override Applied: [YES/NO]

[If YES:]
• Reason for Override: [Detailed justification]
• Authorized By: [Name, Role]
• Legal Counsel Consulted: [Yes/No - if yes, name]
• Override Timestamp: [Date/Time]

═══════════════════════════════════════════════════════════════
SECTION 5: EFFECTS OF THE BREACH
═══════════════════════════════════════════════════════════════
Actual Impact (Known):
[What has demonstrably occurred]

Potential Impact (Assessed):
[What could reasonably occur based on data exposed]

═══════════════════════════════════════════════════════════════
SECTION 6: REMEDIAL ACTION
═══════════════════════════════════════════════════════════════
Containment Measures:
• [Action 1 - Date/Time]
• [Action 2 - Date/Time]

Mitigation Measures:
• [Action 1 - Date/Time]
• [Action 2 - Date/Time]

Preventive Measures (Future):
• [Planned improvement 1 - Target Date]
• [Planned improvement 2 - Target Date]

═══════════════════════════════════════════════════════════════
SECTION 7: NOTIFICATION DECISIONS
═══════════════════════════════════════════════════════════════
SA Notification:
• Decision: [YES - notified / YES - pending / NO - not required]
• SA(s): [Name(s)]
• Deadline: [Timestamp]
• Submitted: [Date/Time or "Pending"]
• Reference Number: [If received]

Subject Notification:
• Decision: [YES - required / NO - not required]
• Method: [Direct communication / Public announcement / N/A]
• Timing: [Date or "Planned for X"]

═══════════════════════════════════════════════════════════════
SECTION 8: JUSTIFICATION FOR DECISIONS
═══════════════════════════════════════════════════════════════
[If SA notification NOT made:]
This breach is unlikely to result in a risk to the rights and
freedoms of natural persons because:
[Detailed reasoning - multiple paragraphs if needed]

[If Subject notification NOT made:]
This breach is unlikely to result in a HIGH risk to the rights
and freedoms of natural persons because:
[Detailed reasoning]

Encryption Exemption Claimed: [Yes/No]
[If Yes: Algorithm, key status, backup status, confidence level]

═══════════════════════════════════════════════════════════════
SECTION 9: RECORD AUTHENTICATION
═══════════════════════════════════════════════════════════════
Prepared by: [Name] | Role: [Title] | Date: [Date]
Reviewed by: [Name] | Role: [Title] | Date: [Date]
Approved by: [Name] | Role: [Title] | Date: [Date]

Assessment Tool: GDPR Breach Response Sentinel
Guidance Version: EDPB Guidelines 9/2022 v2.0
Methodology: ENISA Severity Assessment v1.0

DISCLAIMER: This assessment was generated with AI assistance and
does not constitute legal advice. Final decisions were made by
the individuals named above.
═══════════════════════════════════════════════════════════════
```

---

## 5. Non-Notification Justification Document

```
BREACH NON-NOTIFICATION JUSTIFICATION
Article 33(1) Assessment Documentation

Date: [Date]
Incident Reference: [ID]
Prepared by: [Name, Role]

═══════════════════════════════════════════════════════════════
DECISION SUMMARY
═══════════════════════════════════════════════════════════════
Decision: NO NOTIFICATION to Supervisory Authority required
Basis: Breach is "unlikely to result in a risk to the rights
and freedoms of natural persons" per Article 33(1)

═══════════════════════════════════════════════════════════════
BREACH SUMMARY
═══════════════════════════════════════════════════════════════
Nature: [Brief description]
Data Categories: [List]
Individuals Affected: [Number]
Breach Type: [C/I/A]

═══════════════════════════════════════════════════════════════
RISK ASSESSMENT
═══════════════════════════════════════════════════════════════
ENISA Severity Score: [Score] (LOW - below threshold of 2)

DPC: [Score] - [Reasoning]
EI: [Score] - [Reasoning]
CB: [Score] - [Reasoning]

═══════════════════════════════════════════════════════════════
JUSTIFICATION FOR NON-NOTIFICATION
═══════════════════════════════════════════════════════════════
This breach does not require notification because:

1. [Primary reason - e.g., data was encrypted with state-of-the-art
   measures and key was not compromised]

2. [Secondary reason - e.g., data exposed was limited in sensitivity
   and could not be used to identify individuals]

3. [Supporting factor - e.g., no evidence of actual access or
   exfiltration; data was only potentially exposed]

EDPB Case Comparison:
This situation is analogous to EDPB Case [XX], where the
Guidelines concluded notification was not required because [reason].

═══════════════════════════════════════════════════════════════
ATTESTATION
═══════════════════════════════════════════════════════════════
This decision has been reviewed and approved. The internal breach
record required by Article 33(5) has been completed and retained.

Approved by: [DPO Name]
Date: [Date]

This document retained for regulatory audit purposes.
═══════════════════════════════════════════════════════════════
```

---

## 6. Emergency Follow-Up Checklist

```
⚡ EMERGENCY ASSESSMENT - FOLLOW-UP REQUIRED

The following must be completed within 48 hours:

□ Complete full ENISA calculation with proper adjustments
□ Validate T0 establishment with documentation
□ Review Art. 34 subject notification requirement
□ Complete Internal Compliance Log
□ Submit phased notification to SA if new information material
□ Engage legal counsel for review
□ Document any changes to preliminary assessment

Emergency assessment timestamp: [Time]
Follow-up deadline: [Time + 48h]
```

---

## 7. Mitigation Playbook

```
BREACH MITIGATION PLAYBOOK
Incident Reference: [ID]
Generated: [Date/Time]
Breach Summary: [Brief description tailored to this case]

═══════════════════════════════════════════════════════════════
PRIORITIZED ACTION PLAN
═══════════════════════════════════════════════════════════════

Structure this section based on what best fits the incident.
Options: by workstream, by timeline, by system, by stakeholder,
or any combination. Choose the structure that makes the playbook
most actionable for the specific situation.

| # | Action | Rationale | Priority | Owner | Deadline | Dependencies | Status |
|---|--------|-----------|----------|-------|----------|--------------|--------|
| 1 | [Specific action] | [Why this matters for this case] | Critical | [Role] | T0+[X] | [None / Action #X] | ☐ |
| 2 | [Specific action] | [Why this matters for this case] | Critical | [Role] | T0+[X] | [None / Action #X] | ☐ |
| ... | ... | ... | ... | ... | ... | ... | ☐ |

═══════════════════════════════════════════════════════════════
LESSONS LEARNED (TO BE COMPLETED POST-INCIDENT)
═══════════════════════════════════════════════════════════════

What went well:
[To be completed]

What could be improved:
[To be completed]

Systemic changes implemented:
[To be completed]

Sign-off:
Prepared by: [Name] | Date: [Date]
Reviewed by: [Name] | Date: [Date]

---
Assessment generated with GDPR Breach Response Sentinel
This output does not constitute legal advice.
```

---

## 8. Post-Notification Tracker

```
POST-NOTIFICATION CASE TRACKER
Incident Reference: [ID]
Initial Assessment Date: [Date]
Last Updated: [Date]

═══════════════════════════════════════════════════════════════
SA NOTIFICATION STATUS
═══════════════════════════════════════════════════════════════

SA Name: [Name]
Portal Used: [URL]
Reference Number: [If received]

| Milestone | Due Date | Completed | Notes |
|-----------|----------|-----------|-------|
| Initial notification submitted | [Date] | ☐ | |
| SA acknowledgment received | — | ☐ | |
| Supplementary info (if phased) | [Date] | ☐ | |
| SA follow-up inquiry response | [Date] | ☐ | |
| Case closed by SA | — | ☐ | |

═══════════════════════════════════════════════════════════════
DATA SUBJECT NOTIFICATION STATUS
═══════════════════════════════════════════════════════════════

| Milestone | Due Date | Completed | Notes |
|-----------|----------|-----------|-------|
| Communication drafted | [Date] | ☐ | |
| DPO/Legal review | [Date] | ☐ | |
| Communication sent | [Date] | ☐ | |
| Method: [Direct/Public/Both] | — | — | |
| Total subjects notified | — | — | Count: [X] |
| Subject inquiries received | — | — | Count: [X] |
| All inquiries resolved | — | ☐ | |

═══════════════════════════════════════════════════════════════
MITIGATION EXECUTION STATUS
═══════════════════════════════════════════════════════════════

| Phase | Deadline | Status | Completion Date |
|-------|----------|--------|-----------------|
| Phase 1: Immediate Actions | T0 + 4h | ☐ | |
| Phase 2: Technical Measures | T0 + 72h | ☐ | |
| Phase 3: Organizational Measures | T0 + 30d | ☐ | |

═══════════════════════════════════════════════════════════════
DOCUMENTATION COMPLETENESS
═══════════════════════════════════════════════════════════════

| Document | Required | Completed | Location |
|----------|----------|-----------|----------|
| Internal Compliance Log (Art. 33(5)) | YES | ☐ | |
| Art. 33 SA Notification | [YES/NO] | ☐ | |
| Art. 34 Subject Communication | [YES/NO] | ☐ | |
| Non-Notification Justification | [YES/NO] | ☐ | |
| Root Cause Analysis | YES | ☐ | |
| Lessons Learned | YES | ☐ | |
| DPIA Update | [YES/NO] | ☐ | |
| Art. 30 Records Update | [YES/NO] | ☐ | |

═══════════════════════════════════════════════════════════════
CASE STATUS
═══════════════════════════════════════════════════════════════
Overall Status: [ACTIVE / PENDING SA RESPONSE / CLOSED]
Next Action Required: [Description]
Next Deadline: [Date]

Last updated by: [Name] | Date: [Date]

---
Assessment generated with GDPR Breach Response Sentinel
This output does not constitute legal advice.
```

---

## 9. Hybrid Scenario Dashboard (Track A + B)

```
╔═══════════════════════════════════════════════════════════════╗
║                    TRACK A: INTERNAL DATA                      ║
╠═══════════════════════════════════════════════════════════════╣
║ DPC: [score] - [category + adjustments]                        ║
║ EI:  [score] - [level]                                         ║
║ CB:  [score] - [breakdown]                                     ║
║ SE:  [calculation] = [final]                                   ║
║ Verdict: [LEVEL]                                               ║
║ Override: [None / Original: X, Selected: Y, Reason: Z]         ║
║ SA Deadline: [timestamp]                                       ║
║ Subject Notification: [Required/Not Required]                  ║
╚═══════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════╗
║                    TRACK B: CLIENT DATA                        ║
╠═══════════════════════════════════════════════════════════════╣
║ Clients Affected: [list/count]                                 ║
║ Notification Status: [Pending/Sent per client]                 ║
║ Contractual Deadlines: [per client DPA]                        ║
║ Risk Assessment: NOT PERFORMED (Controller responsibility)     ║
╚═══════════════════════════════════════════════════════════════╝
```

**Never conflate Track A and Track B documentation.**
