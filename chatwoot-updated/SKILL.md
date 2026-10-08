---
name: chatwoot-updated
description: Report a Chatwoot exchange to the client's Odoo record, then tell the team on Signal when it matters. Use when the user invokes /chatwoot-updated with a conversation id or a client name.
---

# Chatwoot updated

Every new message in a Chatwoot conversation goes to Odoo. Only what the team needs to know about the client goes to Signal.

## 1. Pick the conversations

- A number: that conversation only.
- A name, email or company: find the contact (`mcp__chatwoot__contacts_search`), then take its conversations updated in the last 24 hours, or its latest one if none (`mcp__chatwoot__contacts_conversations`). Several contacts match: ask which one. None: say so and stop.
- No argument: ask which client or conversation to update, and wait. Never fall back to recent conversations. If the session has just worked on one client's conversation, propose it in the question.

## 2. For each conversation, update Odoo

1. Read the conversation and its messages (`mcp__chatwoot__conversations_get`, `mcp__chatwoot__messages_list`), private notes included.
2. Find the contact's `res.partner` by email (`mcp__odoo__search_records`); create it if absent (name, email, phone, company when known).
3. Find what is already logged: the latest note on that partner whose body contains the conversation link `https://support.getnatalia.com/app/accounts/1/conversations/<id>`. Keep only messages posted after it. None left: skip the conversation.
4. Post one internal note (`mcp__odoo__post_message`, `subtype: note`) in French:
   - what the client said;
   - what was answered or done;
   - the next step, if any;
   - the conversation link, last line.

## 3. Decide on Signal

Share with the « Natalia board C-Level » group only what changes how the team sees this client: a decision, a commitment, an incident, a new request or information, a status change. Never an acknowledgement, a reminder, or a correction of form.

When it matters, draft a short message in French (client, what was said or done, next step, Odoo link `https://managed-nobullshit-conseil-odoo-prod.apps.france-nuage.fr/web#model=res.partner&id=<id>`), written like the client recap of `/recap-chatwoot-from-transcript` Phase 4: connected prose, one idea per paragraph of 1 to 3 sentences, specific facts, never a string of clipped fragments. Run `/humanizer pro` on it, then `humanizer-lint --strict` until clean, as that skill's Phase 5 does.

Show the exact final text to the user and send it only after they approve **that text**. An edit or an addition from the user means a new draft (humanizer + lint again) shown again for approval: a « c'est bien » given on an earlier draft never covers the edited one.

```bash
~/.claude/skills/chatwoot-updated/notify-signal.sh <<'MSG'
<recap>
MSG
```

## 4. Report

One line per conversation: Odoo note posted or skipped, Signal sent, awaiting approval, or not sent and why.
