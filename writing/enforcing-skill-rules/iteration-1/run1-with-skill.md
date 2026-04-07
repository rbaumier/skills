# With Skill - Run 1

## Output

Now I have the skill rules internalized and the prompt. This text is riddled with every anti-pattern the writing skill calls out. Let me fix it.

---

**Subject: Q3 Infrastructure Migration — 60% Complete, Budget Approval Needed**

The platform team has migrated 60% of legacy workloads to the new cloud environment. Two problems slowed us down:

1. **Networking misconfigurations** discovered mid-migration.
2. **Missed critical dependencies** in the initial plan, which added three weeks of unplanned work.

The team also skipped two steps before cutover: updating runbooks and reviewing dashboards. Both gaps need to be closed before the next migration wave.

Three high-risk components remain for the final 40%:

- **Database layer** — tightly coupled to legacy auth; requires coordinated cutover.
- **Authentication service** — downstream of every client-facing API.
- **API gateway** — routing changes affect all connected services.

Early production data shows lower latency on migrated workloads, though we need controlled benchmarks to confirm the trend holds under full load.

**Next steps:**

1. Update runbooks and review dashboards this sprint.
2. Allocate additional engineers to the remaining workloads (budget approval required from stakeholders).
3. Map dependencies for the database, auth, and gateway migrations before scheduling cutovers.
4. Run latency benchmarks on migrated services under production traffic.

Stakeholders: please approve the requested budget increase by end of week so the team can staff up for the final push. Reach out to me directly with questions.