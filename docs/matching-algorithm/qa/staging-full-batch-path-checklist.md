# Staging checklist — full batch → MMD → provider feed path

End-to-end integration verification on **staging** after matching M10–M12 deploy. Confirms the progressive matching pipeline from an OPEN service request through cron batch open, MMD ingest, worker delivery, and provider feed visibility.

**Related:** notification-only details in [`staging-mmd-new-opportunity-checklist.md`](./staging-mmd-new-opportunity-checklist.md); geo → beacon → discovery path in [`staging-geo-batch-checklist.md`](./staging-geo-batch-checklist.md); ops triage in [`../operations.md`](../operations.md).

---

## Prerequisites

- Staging Supabase with matching migrations applied (M10–M15).
- `matching_process_service_request_dispatches` pg_cron job active (`*/2 * * * *`).
- `message-dispatcher-worker` enabled (`mmd_invoke_worker` + checkout cron per [message-dispatcher edge-secrets](../../message-dispatcher/docs/edge-secrets.md)).
- Resend + FCM credentials configured for staging.
- **Test client** — can create an OPEN service request in a known service area.
- **Test provider** — profile complete, offered services + service area overlapping the SR, recent location/beacon data, verified email, optional FCM device token.
- Record IDs before starting: `service_request_id`, `provider_id`, `dispatch_id` (after bootstrap).

**Timing:** cron runs every **2 minutes**. Allow **≤2 min per tick** when waiting for batch open (Req 5.1–5.4).

---

## 1. OPEN service request → dispatch bootstrap

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1.1 | Client submits a new service request (app or API) in the provider’s coverage area | `service_requests.status = 'OPEN'` |
| 1.2 | Query dispatch bootstrap | Row in `service_request_dispatches` for the SR; status in `{DISPATCH_ACTIVE, DISPATCH_PAUSED, …}` per gates; `next_batch_at` set |
| 1.3 | Optional: dispatch events | `service_request_dispatch_events` includes bootstrap / schedule events |

```sql
-- Replace :sr_id
select id, status, next_batch_at, batch_number, lease_owner, updated_at
from public.service_request_dispatches
where service_request_id = :sr_id;
```

---

## 2. Wait for cron batch open

| Step | Action | Pass criteria |
|------|--------|---------------|
| 2.1 | Wait until `now() >= next_batch_at` + **one cron tick** (≤2 min after due) | `job_runs` shows finished run with `error_count = 0` |
| 2.2 | Dispatch progressed | `batch_number` incremented OR `batch_opened` event present |
| 2.3 | No stuck lease | `lease_owner` null after run completes |

```sql
select started_at, finished_at, processed_count, error_count, duration_ms, metadata
from public.job_runs
where job_name = 'matching_process_service_request_dispatches'
order by started_at desc
limit 5;
```

---

## 3. Batch providers + feed visibility

| Step | Action | Pass criteria |
|------|--------|---------------|
| 3.1 | Batch row exists | `service_request_dispatch_batches` for current `batch_number` |
| 3.2 | Provider in batch | Row in `service_request_dispatch_batch_providers` for test provider |
| 3.3 | Visibility granted | Row in `service_request_provider_visibility` with `source = 'batch'`, `dismissed_at` null |
| 3.4 | Provider feed (app) | Provider opens **Trabalhos** (`/dashboard/jobs`); SR appears in list |

```sql
-- Replace :sr_id and :provider_id
select b.batch_number, bp.provider_id, bp.ranking_score
from public.service_request_dispatch_batches b
join public.service_request_dispatch_batch_providers bp on bp.batch_id = b.id
join public.service_request_dispatches d on d.id = b.dispatch_id
where d.service_request_id = :sr_id;

select source, granted_at, dismissed_at
from public.service_request_provider_visibility
where service_request_id = :sr_id and provider_id = :provider_id;
```

---

## 4. MMD ingest (same transaction as batch)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 4.1 | MMD rows created | **Two** rows in `message_dispatcher.message_dispatches` per batch provider: `push` + `email` |
| 4.2 | Template + keys | `template_key = 'matching.new_opportunity'`; idempotency `dispatch:{sr}:batch:{n}:provider:{id}:{channel}` |
| 4.3 | Variables | JSON includes `service_request_id`, `title`, `service_name`, `neighborhood`, `urgency`, `deep_link_path` |

See **§1 Ingest contract** in [`staging-mmd-new-opportunity-checklist.md`](./staging-mmd-new-opportunity-checklist.md).

---

## 5. Worker delivery (push / email)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 5.1 | Worker checkout | Dispatches move from pending → sent or terminal within worker SLA |
| 5.2 | Push (if token present) | FCM notification; body `{title} — {neighborhood}`; deep link to jobs |
| 5.3 | Email | Resend delivery; subject `Nova oportunidade: {title}` |

See **§2–4** in [`staging-mmd-new-opportunity-checklist.md`](./staging-mmd-new-opportunity-checklist.md).

**Important (Req 6.4):** push/email failure or quota skip **must not** revoke feed visibility — provider still sees the opportunity in-app.

---

## 6. End-to-end trace (observability)

| Signal | What to verify |
|--------|----------------|
| `job_runs.metadata` | `phase2b_processed` > 0 for the tick that opened the batch |
| `service_request_dispatch_events` | `batch_opened` with batch number + provider count |
| `message_dispatcher.message_dispatches` | Terminal status + audit trail per channel |
| Edge `list-provider-opportunities` | Provider JWT returns SR in `items` after visibility grant |

---

## 7. Sign-off

- [ ] Bootstrap → cron → batch → visibility → feed: **pass**
- [ ] MMD ingest keys + template: **pass**
- [ ] Worker delivery (or acceptable terminal state per MMD checklist): **pass**
- [ ] Visibility persists when push fails: **pass** (spot-check one quota/no-target scenario if feasible)

**Tester / date / SR id / provider id / notes:**

---

## Automated helpers

- **SQL verification (staging):** [`supabase/scripts/matching-staging-batch-path-verify.sql`](../../../supabase/scripts/matching-staging-batch-path-verify.sql) — paste SR + provider UUIDs, run read-only checks.
- **Local CI (components):** pgTAP `mmd_batch_provider_notify_test.sql`, `cron_process_dispatches_test.sql`; Deno MMD integration tests under `message-dispatcher-worker/__tests__/`.
