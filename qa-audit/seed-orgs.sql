-- QA audit seed: :n disjoint organizations, one per agent.
-- Composes on top of the launch pack's seed-qa.sql: same row shapes.
-- Organization k = 019a0000-0000-7000-8001-<k on 12 digits>.
-- Usage: psql -v ON_ERROR_STOP=1 -v n=12 -d <db> -f seed-orgs.sql

BEGIN;

CREATE TEMP TABLE audit_orgs ON COMMIT DROP AS
SELECT k,
       ('019a0000-0000-7000-8001-' || lpad(k::text, 12, '0'))::uuid AS org,
       ('019a0000-0000-7000-8002-' || lpad(k::text, 12, '0'))::uuid AS owner_role,
       ('019a0000-0000-7000-8003-' || lpad(k::text, 12, '0'))::uuid AS admin_role,
       ('019a0000-0000-7000-8004-' || lpad(k::text, 12, '0'))::uuid AS member_role,
       ('019a0000-0000-7000-8005-' || lpad(k::text, 12, '0'))::uuid AS membership,
       ('019a0000-0000-7000-8006-' || lpad(k::text, 12, '0'))::uuid AS membership_role,
       ('019a0000-0000-7000-8007-' || lpad(k::text, 12, '0'))::uuid AS agent,
       ('019a0000-0000-7000-8008-' || lpad(k::text, 12, '0'))::uuid AS channel
FROM generate_series(1, :n) AS k;

INSERT INTO organizations (id, name, owner_id)
SELECT org, 'QA Audit ' || k, users.id
FROM audit_orgs, users
WHERE users.username = 'romain'
ON CONFLICT DO NOTHING;

INSERT INTO roles (id, organization_id, name, permissions)
SELECT owner_role, org, 'owner', ARRAY['manage_organization', 'manage_members', 'manage_roles'] FROM audit_orgs
UNION ALL
SELECT admin_role, org, 'admin', ARRAY['manage_members'] FROM audit_orgs
UNION ALL
SELECT member_role, org, 'member', ARRAY[]::text[] FROM audit_orgs
ON CONFLICT DO NOTHING;

INSERT INTO organization_members (id, organization_id, user_id)
SELECT membership, org, users.id
FROM audit_orgs, users
WHERE users.username = 'romain'
ON CONFLICT DO NOTHING;

INSERT INTO member_roles (id, member_id, role_id, organization_id)
SELECT membership_role, membership, owner_role, org FROM audit_orgs
ON CONFLICT DO NOTHING;

INSERT INTO agents (id, organization_id, name, modality, first_sentence, voice, system_prompt_id)
SELECT agent, org, 'Agent QA Audit ' || k, 'voice',
       'Bonjour, cabinet de test, que puis-je faire pour vous ?',
       '{"kind": "cascade"}'::jsonb, prompt.id
FROM audit_orgs,
     (SELECT id FROM prompt_systems WHERE modality = 'voice'
       ORDER BY created_at DESC, id DESC LIMIT 1) AS prompt
ON CONFLICT DO NOTHING;

INSERT INTO channels (id, organization_id, agent_id, type, phone_number, config)
SELECT channel, org, agent, 'twilio_voice', '+3350100' || lpad(k::text, 4, '0'),
       '{"strategy": "forwarded"}'
FROM audit_orgs
ON CONFLICT DO NOTHING;

COMMIT;

\echo 'seed-orgs: QA Audit k = 019a0000-0000-7000-8001-<k on 12 digits>'
