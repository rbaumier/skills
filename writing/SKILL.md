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
- Commit messages, PR descriptions
- Error messages, UI copy, help text, comments
- Reports, summaries, any prose for humans

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
- Data stories follow Setup -> Conflict -> Resolution arc
- Three pillars: Data (evidence), Narrative (meaning), Visuals (clarity)
- Story arc: Hook, Context, Rising Action, Climax, Resolution, CTA
- Use problem-solution, trend, or comparison framework as appropriate
- Headlines: specific number + business impact + actionable context
- Lead with "so what," not methodology
- State confidence levels and sample sizes for uncertain data
- Use ranges/brackets for estimates
- Show don't tell; connect to audience goals
- Rule of three for key points
- End every piece with clear action/next steps
- Never data dump or bury insights
- Match jargon level to audience
- Exec slides: headline insight, key metrics, implication, the ask
- Dashboard: headline, 4 metrics, working/attention bullets, recommendation
- Progressive reveal in presentations: simple first, add layers
