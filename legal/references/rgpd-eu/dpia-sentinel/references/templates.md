# DPIA Document Templates

For .docx generation. Always load the docx generation skill first (`/mnt/skills/public/docx/SKILL.md` in Claude.ai Projects, or the `docx-processing-anthropic` skill in Claude Code). If no docx skill is available, generate well-formatted Markdown as fallback.

Use `docx-js` (npm). Page size: A4 (11906 × 16838 DXA). Font: Arial. All table widths in DXA. Risk tables use color-coded cell shading (ShadingType.CLEAR): Low=#E8F5E9, Medium=#FFF8E1, High=#FFF3E0, Very High=#FFEBEE.

---

## 1. Full DPIA Report

### Structure

**Cover Page**
- "Data Protection Impact Assessment"
- Processing activity name, controller, version, date, classification, reference (DPIA-YYYY-NNN)

**Document Control** — Version table: Version | Date | Author | Changes | Approved By

**Table of Contents** — Auto-generated from headings (requires outlineLevel on heading styles)

**Disclaimer** — "Prepared with AI-assisted guidance (DPIA Sentinel). Not legal advice. Final decisions by individuals identified herein."

**Section 1: Executive Summary**
- 1.1 Processing overview (2-3 paragraphs, plain language)
- 1.2 Key findings (top risks, overall position)
- 1.3 Recommendation: PROCEED / PROCEED WITH CONDITIONS / DO NOT PROCEED / ART. 36 CONSULTATION
- 1.4 DPO opinion summary

**Section 2: Threshold Assessment**
- 2.1 Art. 35(3) mandatory triggers — analysis table
- 2.2 Nine-criteria analysis — table: Criterion | Met? | Reasoning (all 9 rows)
- 2.3 Jurisdictional scope (for multi-Member-State processing):
  - Jurisdictional scope table: Jurisdiction | Why Relevant (establishment / data subjects / processing location) | Blacklist Checked | Match? | Entry Reference
  - Per-jurisdiction blacklist analysis with specific entry citations
  - Whitelist exemption check where applicable
  - Conflict resolution where outcomes differ across jurisdictions
- 2.4 Consolidated threshold conclusion: why DPIA was conducted, which jurisdictional triggers apply

**Section 3: Systematic Description (Art. 35(7)(a))**
- 3.1 Controller information (name, DPO, EU rep)
- 3.2 Purposes
- 3.3 Legal basis (Art. 6 + Art. 9 if applicable)
- 3.4 Data categories
- 3.5 Data subjects (including vulnerable groups, approximate numbers)
- 3.6 Data sources
- 3.7 Data flow (collection → storage → processing → sharing → deletion)
- 3.8 Technology and systems
- 3.9 Recipients, processors, sub-processors
- 3.10 International transfers (mechanisms, supplementary measures)
- 3.11 Retention periods with justification
- 3.12 Data subject rights implementation

**Section 4: Necessity and Proportionality (Art. 35(7)(b))**
- 4.1 Necessity (each data element justified?)
- 4.2 Proportionality (benefit vs. intrusion, less invasive alternatives?)
- 4.3 Legal basis adequacy (LIA balancing test if applicable)
- 4.4 Data minimization
- 4.5 Conclusion

**Section 5: Risk Assessment (Art. 35(7)(c))**
- 5.1 Methodology statement (5×5 matrix, data subject perspective, EDPB-aligned)
- 5.2 Risk register — table: ID | Description | Rights Category | Likelihood | Severity | Score | Level
- 5.3 Risk heat map (5×5 table with risk IDs in cells, color-coded)

**Section 6: Mitigation Measures (Art. 35(7)(d))**
- 6.1 Measures by risk — table: Risk ID | Risk | Pre-Score | Measures | Type (Tech/Org/Legal) | Post-L | Post-S | Residual Score | Residual Level
- 6.2 Technical measures (detailed descriptions)
- 6.3 Organizational measures
- 6.4 Legal/contractual measures

**Section 7: Residual Risk**
- 7.1 Summary table: Level | Count | Risk IDs
- 7.2 Residual heat map (color-coded)
- 7.3 Overall position: ACCEPTABLE / ACCEPTABLE WITH CONDITIONS / ART. 36 CONSULTATION
- 7.4 Justification

**Section 8: Art. 36 Prior Consultation** (if applicable)
- Decision + reasoning, residual risks requiring consultation, Art. 36(3) submission requirements

**Section 9: DPO Opinion (Art. 35(2))**
- DPO recommendation, concerns raised, controller response, divergence documentation

**Section 10: Data Subject Consultation (Art. 35(9))**
- Decision (appropriate/not + reasoning), methodology if conducted, findings

**Section 11: Review and Monitoring**
- Next review date, review cycle, mandatory triggers (material change, new tech, incident, new law, 12 months), review owner

**Section 12: Approval and Sign-Off**
- Table: Role | Name | Signature | Date — rows for DPIA Author, DPO, Processing Owner, IT Security, Senior Management

**Annexes**
- A: Data flow diagram placeholder
- B: ROPA extract (Art. 30)
- C: Legal basis documentation (LIA, consent records, etc.)
- D: Reference documents (Art. 35 GDPR, WP 248, applicable national lists, relevant EDPB opinions/guidelines)

**Footer (every page):** "[Organization] — DPIA-[Ref] — [Classification] — Page X of Y | Generated with DPIA Sentinel. Not legal advice."

---

## 2. Threshold Justification Memo

Short document (2-3 pages) documenting why a DPIA is NOT required. Essential for Art. 5(2) accountability.

**Structure:**
1. Processing activity description (brief)
2. Controller and jurisdiction(s) — list all relevant: main establishment, other establishments, data subject locations
3. Art. 35(3) mandatory trigger analysis (all three: not met because...)
4. Nine-criteria table (Criterion | Met? | Reasoning)
5. National blacklist check — for EACH relevant jurisdiction: SA | List Reference | Match? If multi-jurisdictional: jurisdictional scope table showing all checked
6. Whitelist exemption if applicable (SA, entry, conditions met — only valid if no blacklist match in any other relevant jurisdiction)
7. Conclusion: DPIA not required; documented per Art. 5(2)
8. Sign-off: Prepared by + DPO review

---

## 3. Executive Summary (One-Pager)

For board/leadership. 1-2 pages maximum.

**Structure:**
- Processing activity name and reference
- What is being assessed (2-3 sentences, plain language)
- Why DPIA was required
- Key findings: risk counts by level, top 2-3 risks described simply
- Mitigation: top 3 measures in plain language
- Residual risk position
- Recommendation (2-3 sentences)
- DPO opinion (1-2 sentences)
- Required actions: Action | Owner | Deadline (3-5 items)
- Next review date

---

## 4. Art. 36 Consultation Package

Required when residual risk remains high after all feasible mitigations. Must contain Art. 36(3) elements.

**Structure:**
1. Controller information (Art. 36(3)(a)) — name, address, DPO, EU rep
2. Purpose of consultation — explain why residual risk remains high
3. Processing description summary (Art. 36(3)(b))
4. Purposes and legal basis (Art. 36(3)(b))
5. Measures and safeguards (Art. 36(3)(c)) — summary of all mitigations
6. DPO contact details (Art. 36(3)(d))
7. DPIA summary (Art. 36(3)(e)) — condensed key findings
8. Residual risks requiring consultation — table: Risk ID | Description | Residual Score | Level | Why it cannot be further mitigated
9. Other information (Art. 36(3)(f)) — transfer assessment, processor arrangements, etc.
10. Attachments list — full DPIA report, data flow diagram, ROPA extract, contracts

**Note:** SA has 8 weeks to respond (extendable by 6 weeks for complex cases). Processing must not begin until SA response is received or the response period has elapsed.
