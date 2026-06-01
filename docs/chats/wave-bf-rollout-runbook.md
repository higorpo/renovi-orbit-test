# Wave B–F — Staged rollout runbook (CNS task 108)

Operational guide for progressive CNS enablement per design §13.10. **Prerequisite:** [Wave A sign-off](./wave-a-rollout-checklist.md) complete.

**Strategy:** internal dogfood → staging soak (**72h**) → canary (~5% providers) → full rollout. There is **no** feature flag for CNS RPCs; each wave sequences migrations + deploy artifacts. UI routes (`/chats`) ship with **Wave F** only.

---

## Wave sequence

| Wave | Scope | Deploy artifacts | Client exposure | Reversible? |
|------|--------|------------------|-----------------|-------------|
| **A** | Schema, RLS read-only, types | Migrations 1–22 | None | Yes (pre-data) |
| **B** | Mutation RPCs + helpers | SQL 23–39+, pgTAP | Staging/tests only | Yes (disable cron callers) |
| **C** | Proposal status `PENDING` / versioning | SQL migrations | Legacy composer still OK | Mostly yes |
| **D** | `submit_proposal` client cutover | `negotiation-proposals` feature | Provider composer → new RPC | Revert FE deploy |
| **E** | Accept cascade, `services`, SR enum | `accept_proposal`, cancel RPCs | Client accept flows | **No** if `services` rows exist |
| **F** | MMD + full chat UI | Edge workers, `/chats`, push suppression | All users per cohort | Revert routes / templates |

---

## Per-wave checklist

### Wave B — Transactional core

- [ ] Apply migrations through reciprocity, expiry, `cns_send_message`, proposal RPCs (tasks 26–39).
- [ ] `yarn ci` green; `supabase/tests/chats/fsm_transitions_test.sql`, `free_messaging_test.sql`, `concurrency_test.sql` on staging.
- [ ] Cron jobs registered but **paused** in prod until Wave F unless staging-only.
- [ ] Smoke: `cns_send_message` + `submit_proposal` via SQL/service_role in staging.
- [ ] **Rollback:** Stop cron invocations; revert migration only if no production writes (see Wave A rollback).

### Wave C — Proposal evolution

- [ ] `provider_proposals` status map applied; partial unique index one `PENDING` per chat.
- [ ] Legacy 48h expiry paths disabled (task 20).
- [ ] pgTAP submit/revision tests green.
- [ ] **Rollback:** Forward-fix preferred; do not reintroduce 48h cron alongside 24h batch.

### Wave D — Composer cutover

- [ ] Deploy `negotiation-proposals`; `create_provider_proposal` delegates to `submit_proposal`.
- [ ] Provider staging: submit proposal end-to-end on open SR.
- [ ] **Rollback:** Revert app deploy; keep DB `PENDING` rows (harmless).

### Wave E — Accept cascade

- [ ] SR status enum + `services` table live.
- [ ] `accept_proposal`, `cancel_service_request` deployed.
- [ ] `expire_pending_proposals` cron active (24h SLA constant).
- [ ] pgTAP accept/cancel race suites green.
- [ ] **Rollback:** **Forward-fix only** after first production `ACCEPTED` / `services` insert.

### Wave F — Notifications & UX

- [ ] `cns_process_domain_events` + MMD ingest worker processing outbox.
- [ ] MMD templates active (task 21).
- [ ] Deploy `/chats` routes, Realtime clients, push suppression hook.
- [ ] `CI_E2E_CHATS=1 yarn ci` or Playwright soak on staging.
- [ ] **Rollback:** Remove nav links to `/chats`; leave outbox rows (replay safe).

---

## 72h canary monitoring (staging soak & prod canary)

Run daily (or on-call dashboard) for **72 hours** before expanding cohort.

### `job_runs` (batch health)

```sql
select job_name, status, count(*), max(finished_at)
from public.job_runs
where started_at > now() - interval '72 hours'
  and job_name like 'cns_%'
group by 1, 2
order by 1, 2;
```

**Pass:** No sustained `failed` without owner ticket; `expire_pending_proposals` and `cns_evaluate_reciprocity_batch` complete within schedule.

### `domain_events` backlog

```sql
select status, count(*), min(created_at), max(created_at)
from public.domain_events
where created_at > now() - interval '24 hours'
group by 1;
```

**Pass:** Pending/processing queue drains within SLA (alert if oldest pending > 15 minutes in prod).

### RPC error rate (logs / Sentry)

- `chats.send_message_failed`, `chats.api_error` — spike > 2% of attempts → halt cohort expansion.
- `NO_ACTIVE_SLOT`, `RATE_LIMITED` — expected under abuse; watch p95 latency.

### Proposal SLA lag (R21-AC05)

```sql
select count(*)
from public.provider_proposals
where status = 'PENDING'
  and coalesce(submitted_at, created_at) < now() - interval '25 hours';
```

**Pass:** Count trends to zero after expiry cron; alert if monotonic growth over 6h.

---

## Cohort expansion gates

| Gate | Criteria |
|------|----------|
| G1 | Wave checklist for current letter 100% signed |
| G2 | 72h monitoring green (sections above) |
| G3 | `yarn ci` on release SHA green |
| G4 | Product sign-off for cohort size increase |
| G5 | Support briefed (slot limits, proposal-gated messaging) |

**Canary order:** internal QA → trusted providers (5%) → 25% → 100%.

---

## Monitoring dashboards (minimum panels)

| Panel | Source | Alert threshold |
|-------|--------|-----------------|
| Domain events backlog | `domain_events` by status | pending > 500 or age > 15m |
| Cron success rate | `job_runs` | failed > 2 consecutive |
| Chat RPC p95 | APM / Sentry metrics `chats.send_message_duration_ms` | p95 > 2s |
| Active slots per SR | `service_request_negotiation_stats` | investigate if max constant changed |
| MMD dispatch failures | message_dispatcher + CNS ingest logs | error rate > 1% |

---

## Rollback playbook (summary)

| Wave | Action |
|------|--------|
| B | Pause crons; revert FE if calling RPCs; DB revert only pre-prod traffic |
| C | Revert app; keep schema |
| D | Revert provider composer deploy |
| E | **Do not** delete `services`; disable accept UI; hotfix RPC if needed |
| F | Hide `/chats`; disable MMD templates; keep DB state |

---

## Sign-off log

| Wave | Staging date | Canary start | Full rollout | Owner |
|------|--------------|--------------|--------------|-------|
| B | | | | |
| C | | | | |
| D | | | | |
| E | | | | |
| F | | | | |

---

## References

- `docs/chats/design.md` §13.10, §13 (test strategy)
- `docs/chats/tasks.md` — Execution Strategy, tasks 26–106
- `docs/chats/wave-a-rollout-checklist.md`
- `AGENTS.md` — `yarn ci`, `CI_E2E_CHATS=1`
