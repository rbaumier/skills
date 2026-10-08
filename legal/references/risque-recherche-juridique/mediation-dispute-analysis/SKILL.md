---
name: mediation-dispute-analysis
description: "Use this skill whenever a lawyer or mediator needs help analyzing a dispute for mediation purposes. This includes: reviewing case materials (pleadings, contracts, correspondence, evidence) to identify issues in dispute, summarizing each party's position and interests, conducting legal analysis of the key issues, proposing mediation strategies or settlement directions, and preparing for mediation sessions. Trigger this skill when the user mentions 'mediation', 'dispute analysis', 'settlement', 'dispute resolution', 'identify issues in dispute', 'party positions', 'mediation brief', 'case analysis for mediation', 'ADR', 'mediation preparation', 'caucus strategy', 'settlement options', or any request to analyze a conflict between two or more parties with the goal of finding resolution. Also trigger when the user uploads case files and asks for a structured breakdown of who wants what, what the core disagreements are, or how the case might settle. Even if the user doesn't explicitly say 'mediation', trigger when the context involves analyzing opposing positions in a dispute with a resolution-oriented (rather than litigation-oriented) goal."
metadata:
  author: Jinzhe Tan
  license: AGPL-3.0
  version: 2026.02.27
---

# Mediation Dispute Analysis

## Overview

This skill helps lawyers and mediators rapidly analyze case materials to produce a structured dispute analysis — identifying the core issues, each party's position and underlying interests, relevant legal principles, and potential directions for mediation or settlement.

The skill is designed for civil and commercial disputes of all kinds: contract disputes, business disagreements, property conflicts, employment issues, consumer claims, and more. It takes a resolution-oriented approach, focusing not just on legal rights but on practical paths to agreement.

Mediation, at its core, is negotiation between disputing parties assisted by a neutral third party. Unlike arbitration or litigation, the mediator has no decision-making power — the parties themselves craft their resolution. This skill helps the lawyer or mediator prepare the analytical groundwork that makes that resolution possible.

## Resources

### Template
| File | Description |
|------|-------------|
| `assets/mediation_report_template.docx` | Professional Word template for formal mediation analysis reports. Use when the user requests a .docx output. The template includes a title page, all six analysis sections with placeholder text, formatted tables for issues and interests, BATNA/WATNA comparison table, and a readiness checklist with checkboxes. |

### Reference Files
| File | Description |
|------|-------------|
| `references/MEDIATION_PROCESS.md` | Comprehensive mediation process guide covering core principles, the 12 stages of mediation, mediator and counsel roles, power imbalance strategies, and mediation agreement checklist. Consult when you need deeper context on mediation procedures or best practices. |
| `references/NEGOTIATION_CONCEPTS.md` | Quick reference for analytical concepts: positions vs. interests, BATNA/WATNA analysis, ZOPA identification, interest-based negotiation framework, settlement option patterns, and impasse-breaking techniques. Consult when building the strategy and settlement sections of the analysis. |

Read the relevant reference file when you need more depth on a specific topic. You do not need to read both files for every case — use them as needed based on the complexity of the dispute.

## Why This Matters

A mediator or lawyer preparing for mediation faces a common challenge: they receive a stack of materials — pleadings, contracts, emails, invoices — and need to quickly distill the essence of the dispute. What exactly do the parties disagree about? What does each side really want? Where is there room for compromise? This skill automates the analytical heavy lifting so the lawyer can focus on strategy and human judgment.

Good mediation preparation means understanding not just the legal positions, but the underlying interests, the relationship dynamics, and the practical constraints each party faces. The goal is to move beyond legal concepts like fault and toward a shared understanding of each party's actual needs — which is what makes mediated outcomes more durable than imposed ones.

## Two Operating Modes

The skill supports two workflows depending on how the user approaches it:

### Mode A: Guided Information Gathering

Use this mode when the user hasn't provided case materials upfront, or when materials are incomplete. Walk the user through a structured intake process before generating the analysis.

### Mode B: Direct Analysis

Use this mode when the user has already provided all relevant case materials (uploaded files, pasted text, or detailed description). Skip the intake and go straight to analysis.

**How to decide:** If the user uploads files or provides a detailed case description in their first message, use Mode B. If they say something like "I have a mediation case" or "help me prepare for mediation" without providing materials, use Mode A.

---

## Mode A: Guided Information Gathering

### Step 1: Case Overview

Ask the user for the following in a natural, conversational way:

**Essential Information:**
- Nature of the dispute (contract, employment, property, commercial, etc.)
- Parties involved (names/roles, relationship between them)
- Brief factual background — what happened?
- Timeline of key events
- Current status (pre-litigation, pending lawsuit, court-referred mediation, voluntary mediation, etc.)

**Prompt example:**
> "To prepare a thorough dispute analysis, I'll need to understand the case. Could you tell me:
> 1. What type of dispute is this (e.g., contract, employment, commercial)?
> 2. Who are the parties and what's their relationship?
> 3. What happened — the key facts and timeline?
> 4. What's the current status — has litigation started, or is this pre-suit?
>
> Feel free to share as much detail as you have. You can also upload any case documents (pleadings, contracts, correspondence) and I'll extract the relevant information."

### Step 2: Deeper Dive

Based on the initial information, ask targeted follow-up questions:

- What does each party claim? What outcome are they seeking?
- Are there any previous settlement attempts or negotiations?
- What are the key documents (contracts, emails, invoices)?
- Are there emotional or relationship factors at play (ongoing business relationship, family ties, reputational concerns)?
- Any time pressures or external constraints (deadlines, cash flow issues, regulatory requirements)?
- Has the user identified any potential areas of compromise?
- Is there a perceived power imbalance between the parties? (e.g., large corporation vs. individual, employer vs. employee, senior vs. junior party)
- What is the authority situation — do the people at the table have authority to agree to a final resolution?

Adapt these questions to the specific case — not all will be relevant every time.

### Step 3: Proceed to Analysis

Once sufficient information is gathered, proceed to the Analysis Framework below.

---

## Mode B: Direct Analysis

When the user provides case materials upfront, read and analyze them thoroughly before generating output. Materials may include:

| Material Type | What to Extract |
|---|---|
| Pleadings / Written statements | Each party's factual claims, legal arguments, and requested remedies |
| Contracts / Agreements | Relevant clauses, obligations, breach allegations, ambiguous terms |
| Correspondence (emails, letters) | Timeline of events, admissions, tone/relationship dynamics, negotiation history |
| Evidence (invoices, photos, reports) | Supporting facts, quantum of damages, credibility indicators |
| Prior settlement communications | Previous offers, rejected proposals, areas of near-agreement |

After reviewing materials, proceed directly to the Analysis Framework.

---

## Analysis Framework

This is the core of the skill. Whether information was gathered through Mode A or Mode B, the output follows this structure:

### 1. Case Summary

Write a concise, neutral factual summary (typically 1-2 paragraphs). This should:
- Identify the parties and their relationship
- Describe the key events in chronological order
- State the current procedural posture
- Note any prior negotiation or settlement attempts
- Be written in neutral language — do not favor either party's narrative

### 2. Issues in Dispute

Identify and list each discrete issue the parties disagree about. For each issue:

**Issue [Number]: [Descriptive Title]**
- **Party A's Position:** What Party A claims on this issue, and why
- **Party B's Position:** What Party B claims on this issue, and why
- **Key Evidence:** The most important documents or facts relevant to this issue
- **Strength Assessment:** A candid, balanced assessment of each side's position (strong / moderate / weak) with brief reasoning

Organize issues by significance — the most important or valuable issues first.

Typically there are 2-6 core issues in a dispute. If you identify more than 6, consider whether some can be grouped. If there appears to be only 1, look more carefully — there are usually sub-issues worth separating out (e.g., liability vs. quantum, or different breach allegations).

After listing individual issues, suggest a sequence for addressing them in mediation. Consider starting with issues where agreement seems most achievable to build momentum, or starting with the most critical issue if the parties need to see progress on the core problem before engaging on peripheral matters. Note the reasoning behind the recommended sequence.

### 3. Underlying Interests Analysis

This section goes beyond legal positions to identify what each party actually needs or wants. Understanding interests rather than just positions is what makes mediated outcomes possible — and more durable than imposed ones.

**Party A's Interests:**
- Legal interests (rights, entitlements, precedent)
- Commercial interests (money, business continuity, market position)
- Relational interests (reputation, ongoing relationship, trust)
- Emotional interests (recognition, apology, sense of justice, saving face)
- Procedural interests (desire for a fair process, being heard, having a voice)

**Party B's Interests:**
- Same framework as above

**Shared or Compatible Interests:**
- Identify any interests both parties have in common (e.g., both want to preserve a business relationship, both want to avoid publicity, both are under time pressure, both want to minimize legal costs)
- These shared interests are the foundation for building agreement

**Potential Barriers:**
- Strong emotions that may block rational negotiation
- Stereotypes or misperceptions between the parties
- Communication difficulties (language, cultural differences, hostility)
- External pressures (stakeholders, public scrutiny, regulatory constraints)

### 4. Legal Analysis

For each key issue, provide a brief legal analysis. This should:
- Identify the applicable general legal principles (contract law, tort, equity, etc.)
- Note the likely legal outcome if the case went to trial (to help calibrate settlement expectations)
- Flag any significant legal uncertainties or risks for either side
- Reference relevant legal doctrines by name (e.g., "duty to mitigate," "frustration of contract," "unjust enrichment") without citing specific statutory provisions unless the user has specified a jurisdiction

The legal analysis should be practical and outcome-oriented — focused on helping the user understand the litigation risk landscape, not providing an academic treatise. The point is to inform the mediation strategy: parties who understand their litigation risk are better positioned to make rational settlement decisions.

**Important:** If the user specifies a jurisdiction, tailor the legal analysis accordingly. If no jurisdiction is specified, apply widely recognized common law and civil law principles and note that jurisdiction-specific advice should be sought.

### 5. Mediation Strategy & Settlement Directions

This is the most valuable section for the user. Provide:

**BATNA/WATNA Analysis:**
- **Party A's BATNA** (Best Alternative to Negotiated Agreement): What happens for Party A if mediation fails? Consider litigation costs, time, likelihood of success, and non-monetary consequences.
- **Party A's WATNA** (Worst Alternative): The worst realistic outcome for Party A
- **Party B's BATNA and WATNA:** Same analysis

**Zone of Possible Agreement (ZOPA):**
- Based on the legal analysis and interest mapping, where might the parties' acceptable outcomes overlap?
- If the dispute involves monetary claims, suggest a realistic settlement range with reasoning

**Proposed Settlement Directions:**
Present 2-3 concrete settlement scenarios, ranging from conservative to creative:

1. **Straightforward Compromise:** A split-the-difference or risk-adjusted monetary settlement
2. **Interest-Based Solution:** A creative option that addresses underlying interests beyond pure legal entitlements (e.g., restructured business terms, phased payments, future cooperation, a formal apology, modified working arrangements)
3. **Package Deal** (if applicable): Combining resolution of multiple issues into a single agreement, allowing trade-offs across issues

For each scenario, briefly note:
- Why it might work (which interests it satisfies)
- Potential obstacles
- Suggested framing for the mediator

**Process Recommendations:**

Recommend a mediation format and approach based on the case characteristics:

- **Session format:** Joint sessions, caucus-heavy (separate meetings with each party), or a combination. Caucus-heavy formats work well when emotions are high, there is a power imbalance, or parties have difficulty communicating directly. Joint sessions are valuable when relationship repair is a goal or when parties need to hear each other's perspectives directly.
- **Co-mediation:** Recommend if there are significant power imbalance concerns (e.g., gender dynamics in harassment cases, large corporation vs. individual). Two mediators can help the weaker party feel more comfortable and ensure balanced process management.
- **Session planning:** Single session vs. multiple sessions, estimated duration, whether pre-mediation meetings with each party would be beneficial.
- **Pre-mediation steps:** Document exchange, obtaining expert valuations, cooling-off periods, preliminary meetings to build rapport and explain the process.
- **Issue sequencing:** Recommend the order in which issues should be addressed (referencing the sequence suggested in Section 2).
- **Impasse strategies:** If negotiation stalls on a particular issue, suggest approaches — taking a break, moving to a different issue, introducing a compromise proposal, shifting from past-focused blame to future-focused problem-solving.

### 6. Mediation Readiness Checklist

Provide a tailored checklist based on the specific case. Draw from these items as relevant:

**Parties & Authority:**
- [ ] All directly interested parties identified and willing to participate
- [ ] Representatives at the table have authority to agree to a final resolution
- [ ] Decision on whether counsel will be present and their role (advisor, active participant, representative)
- [ ] Power imbalance considerations addressed (co-mediation, counsel presence, caucus format)

**Process Design:**
- [ ] Issues to be mediated have been identified and agreed upon
- [ ] Mediator selection process determined
- [ ] Mediation agreement drafted (covering mandate, confidentiality, cost-sharing, procedures)
- [ ] Date, time, and neutral venue arranged
- [ ] Special requirements addressed (translation, accessibility, remote participation)
- [ ] Confidentiality terms agreed upon and signed

**Preparation:**
- [ ] Key documents organized and shared as agreed
- [ ] Disclosure process established (advance exchange or as-needed)
- [ ] Each party has prepared their opening statement
- [ ] Fallback process identified if mediation is unsuccessful (arbitration, litigation, etc.)
- [ ] Draft framework for memorandum of understanding prepared
- [ ] Cost-sharing arrangement confirmed

Not all items will apply to every case — include only what is relevant.

---

## Output Format

### Default: Structured Text in Chat

Present the analysis directly in the conversation using clear headings and the structure above. This is appropriate for most cases and allows for easy follow-up discussion.

### Word Document (.docx)

If the user requests a formal document (or if the analysis is lengthy/complex), generate a professional Word document using the template at `assets/mediation_report_template.docx` as a structural reference. Use the docx skill for document creation.

Start from the template's structure and replace all placeholder text with the actual analysis content. The template provides:
- A title page with confidentiality marking
- Headers and footers with page numbers
- Pre-formatted tables for issues, interests, and BATNA/WATNA
- A readiness checklist with checkboxes
- Professional styling with consistent headings and color scheme

Adapt the template to the specific case:
- Add or remove issue tables based on the number of disputes identified
- Add party interest tables for additional parties in multi-party disputes
- Include or omit checklist items based on the case's needs
- Add a table of contents for analyses with 4+ issues

---

## Tone and Style Guidelines

- **Neutral and balanced:** Never advocate for one party. Present both sides fairly. The mediator's role is to be impartial — the analysis should reflect that.
- **Practical over academic:** Focus on actionable insights, not theoretical discussions. Lawyers need to know what to do, not just what the law says.
- **Candid about uncertainty:** When the legal position is unclear, say so. Mediators and counsel need honest assessments, not false confidence. Honest uncertainty helps parties make realistic settlement decisions.
- **Resolution-oriented language:** Frame issues in terms of "interests" and "options" rather than "claims" and "defenses" where possible. Shift focus from past blame to future solutions.
- **Concise but thorough:** Each section should be as long as it needs to be, but no longer. Lawyers' time is valuable.
- **Sensitive to dynamics:** Be attentive to power imbalances, emotional factors, and relationship dynamics. Note these where relevant rather than treating the dispute as purely legal.

## Disclaimers

Always include a brief disclaimer at the end of the analysis:

> *This analysis is prepared to assist in mediation preparation and does not constitute legal advice. It is based solely on the materials and information provided. A qualified legal professional in the relevant jurisdiction should be consulted for jurisdiction-specific legal advice. This document is confidential and prepared for mediation purposes only.*

## Handling Edge Cases

- **Insufficient information:** If the user provides very limited information, generate what you can but clearly flag which parts of the analysis are speculative and what additional information would improve accuracy.
- **Multi-party disputes:** Adapt the framework to accommodate more than two parties. Each party gets its own position/interest analysis. Consider whether sub-groups of parties share interests and might negotiate as a bloc.
- **Power imbalances:** If the materials suggest a significant power imbalance (e.g., large corporation vs. individual, employer vs. employee), note this prominently in the process recommendations. Suggest caucus-heavy formats, co-mediation, or ensuring the weaker party has independent legal counsel. The mediator has a responsibility to ensure power imbalances do not compromise the process.
- **Emotional/high-conflict cases:** If the dispute appears highly emotional (family business breakups, employment discrimination, harassment, etc.), emphasize the interest-based analysis, recommend caucus-heavy mediation formats, and suggest pre-mediation meetings to build rapport and manage expectations. Strong emotions need to be acknowledged and validated before substantive negotiation can begin.
- **Cross-border disputes:** Flag potential jurisdictional complexities and note that applicable law determination may itself be a disputed issue. Consider whether cultural differences between parties may affect mediation dynamics.
- **Prior failed negotiations:** If previous settlement attempts have failed, analyze why and recommend adjustments to the approach (different mediator style, changed circumstances that create new openings, reframing the issues).
- **Government or institutional parties:** Note that institutional parties may face constraints on settlement authority (multiple approval levels, policy requirements, public accountability). Recommend confirming authority to settle at the outset.
