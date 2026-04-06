---
name: writing
description: Internal comms, data storytelling, prose quality, concision. Applies Strunk's rules for clearer, stronger writing.
---

## When to use
- Internal comms (3P updates, newsletters, FAQs, status/incident reports)
- Data storytelling (exec presentations, QBRs, investor decks, dashboards)
- Prose editing or quality improvement
- Slide deck narrative structure
- Documentation, READMEs, technical explanations
- Architecture Decision Records (ADRs): Title, Date, Status, Context (what forced this decision), Decision (what we chose), Consequences (trade-offs accepted). Write when: hard to reverse, multiple reasonable options, affects others, significant trade-off
- Commit messages, PR descriptions
- Error messages, UI copy, help text, comments
- Reports, summaries, any prose for humans

**ADR writing as a writing discipline** -- Architecture Decision Records follow: Title, Date, Status, Context (what forced this decision), Decision (what we chose), Consequences (trade-offs accepted). Write an ADR when the decision is hard to reverse, has multiple reasonable options, affects others, or involves a significant trade-off. Do NOT write for trivially reversible choices.

## When not to use
- External marketing copy
- Legal or compliance documents
- Code documentation
- Pure code generation with no prose
- Structured data output (JSON, YAML, etc.)

## Rules
- Cut filler, hedging, corporate fluff, gratuitous enthusiasm
- Active voice default; passive only when actor irrelevant
- Concrete over abstract: specific numbers, names, dates
- Short sentences for impact, longer for nuance
- Ban: "delve," "leverage," "utilize," "in order to," "worth noting," "multifaceted," "foster," "realm," "tapestry"
- No AI warmth, no sycophancy
- Cognitive fluency: easy-to-process text feels more true and trustworthy. Use common words over rare synonyms, short sentences for key claims, pronounceable terms over acronyms
- Lead with the concrete thing: example, output, anecdote, number, or code block FIRST. Explain after. Not "Authentication is important. Here's an example:" but show the example, then explain
- AI artifact detection and removal: hollow openers ("In recent years, X has garnered..."), over-connectors ("Furthermore", "Moreover", "It is worth noting"), false precision ("a myriad of", "a plethora of"), meta-narration ("This section discusses...", "As mentioned above..."), suspiciously symmetric paragraph lengths
- Ban em-dash overuse: LLMs use em-dashes 10-50x more than humans. Max 1 per paragraph. Replace most with commas, parentheses, or periods
- Omit needless words ruthlessly
- Put statements in positive form ("ignored" not "did not consider")
- Place emphatic words at end of sentence
- Keep related words together
- Express co-ordinate ideas in similar form
- Avoid succession of loose sentences
- Keep to one tense in summaries
- One paragraph per topic; begin each with topic sentence
- Opening participial phrase must refer to grammatical subject
- Never join independent clauses with comma alone
- Never break sentences in two unnecessarily
- Comma before conjunction introducing co-ordinate clause
- Enclose parenthetic expressions between commas
- Comma after each term in series except last
- Form possessive singular by adding 's
- Avoid puffery: pivotal, crucial, vital, testament, enduring legacy
- Avoid empty -ing phrases: ensuring reliability, showcasing features
- Avoid promotional adjectives: groundbreaking, seamless, robust, cutting-edge
- No excessive bullets, emoji decorations, or bold overuse
- For comms: identify type, load matching `examples/` template, follow it
- 3P updates use `examples/3p-updates.md`
- Newsletters use `examples/company-newsletter.md`
- FAQs use `examples/faq-answers.md`
- General comms use `examples/general-comms.md`
- If no template match, ask user to clarify before proceeding
- Voice capture workflow: when writing in someone's voice, (1) collect samples, (2) extract sentence length/rhythm, formality, rhetorical devices, vocabulary tier, humor style, (3) document as voice profile, (4) write draft, (5) compare draft sentence patterns against samples. Never invent biographical facts
- Data stories follow Setup -> Conflict -> Resolution arc
- Also use SCQA (Situation, Complication, Question, Answer) for exec-level comms and Pyramid Principle (answer first, then supporting evidence in groups of 3) for busy readers
- Three pillars: Data (evidence), Narrative (meaning), Visuals (clarity)
- Story arc: Hook, Context, Rising Action, Climax, Resolution, CTA
- Use problem-solution, trend, or comparison framework as appropriate
- Headlines: specific number + business impact + actionable context
- Lead with "so what," not methodology
- State confidence levels and sample sizes for uncertain data
- Causal language discipline: use "is associated with" / "correlates with" for observational data. Reserve "causes", "leads to", "results in" for experimentally validated claims
- Use ranges/brackets for estimates
- Show don't tell; connect to audience goals
- Rule of three for key points
- End every piece with clear action/next steps
- Never data dump or bury insights
- Match jargon level to audience
- Exec slides: headline insight, key metrics, implication, the ask
- Dashboard: headline, 4 metrics, working/attention bullets, recommendation
- Progressive reveal in presentations: simple first, add layers


**Narrative frameworks beyond Setup-Conflict-Resolution** -- add SCQA (Situation, Complication, Question, Answer) for exec-level communication and Pyramid Principle (answer first, then supporting evidence in groups of 3) for busy readers. SCQA forces you to name the complication explicitly. Pyramid forces you to lead with the 'so what'.

**Causal language discipline** -- distinguish correlation from causation in all data-related writing. Use 'is associated with' or 'correlates with' for observational data. Reserve 'causes', 'leads to', 'results in' for experimentally validated claims. State confidence levels: 'We're 90% confident that X' not 'X is true'. Include sample sizes for any statistical claim.

**Cognitive fluency principle** -- easy-to-process text feels more true, trustworthy, and valuable. Practical rules: use common words over rare synonyms, short sentences for key claims, consistent formatting across touchpoints, pronounceable terms over acronyms. The brain's shortcut: 'if it's easy to read, it must be right.' Apply this to UI copy, error messages, and any text where trust matters.

**AI writing artifact detection and removal** -- common AI patterns to eliminate: hollow openers ('In recent years, X has garnered significant attention'), over-connectors ('Furthermore', 'Moreover', 'It is worth noting that'), false precision ('a myriad of', 'a plethora of'), meta-narration ('This section discusses...', 'As mentioned above...'), suspiciously symmetric paragraph lengths, and excessive hedging. These patterns appear 1000x more in LLM output than human writing.

**Voice capture workflow for brand/person matching** -- when writing in someone's voice: 1) Collect samples (articles, posts, memos), 2) Extract: sentence length/rhythm, formality level, rhetorical devices (parentheses, fragments, questions), vocabulary tier, humor style, 3) Document as a voice profile, 4) Write draft, 5) Compare draft sentence patterns against samples. Never invent biographical facts or company metrics.

**Lead with the concrete thing** -- example, output, anecdote, number, screenshot, or code block FIRST. Explain after. Not 'Authentication is an important consideration. Here is an example:' but show the example, then explain what it demonstrates. This applies to blog posts, tutorials, technical docs, and any long-form content.

**Ban em-dash overuse** -- LLMs use em-dashes (--) 10-50x more than human writers. Limit to max 1 per paragraph. Replace most with commas, parentheses, or periods. Em-dash is for dramatic interruption, not a universal connector.