# Service completion cutover checklist

**Normative:** [CONTEXT decision 22](./CONTEXT.md) · [design §13.2](./design.md) · [tasks Execution Strategy](./tasks.md) · [ADR-0004](./adr/0004-completion-rpcs-outside-payments.md)  
**Policy:** Database **reset** in the current development phase. **SHALL NOT** grandfather or backfill legacy `OPEN` service requests without enrichment. Every post-cutover SR is gated by enrichment `READY` before matching bootstrap.

Abort cutover (block production traffic) if any **hard gate** fails.

---

## 0. Ops sign-off (owners)

| Role | Name / date | Sign-off |
|------|-------------|----------|
| Backend / migrations | | ☐ |
| Edge / cron / secrets | | ☐ |
| App / env & dispute URL | | ☐ |
| Matching / product | | ☐ |

Cutover log (environment, started, finished, blockers):

```
env:
started_at:
finished_at:
blocker:
notes:
```

---

## 1. Pre-flight (hard gates)

### 1.1 Database reset (decision 22)

- [ ] Confirm environment policy: **reset** (local: `yarn db:reset`; staging/prod per ops runbook).
- [ ] Confirm **no** script or migration backfills enrichment for pre-cutover `OPEN` rows.
- [ ] Confirm product acceptance that pre-reset open requests are discarded with the reset.

### 1.2 Migrations Phases 1–6 (dark → writers)

Deploy / verify migrations covering design §13.2 steps 1–7 (foundation → `service_completion_*` + DROP `payment_*`):

- [ ] Enums + tables (`service_request_enrichments`, events, templates, evidence, upload sessions) + RLS + `platform_constants` seeds.
- [ ] Enrichment RPCs + `matching_bootstrap_dispatch_for_service_request`.
- [ ] **DROP** `trg_service_request_dispatch_bootstrap` (and associated OPEN-insert bootstrap function).
- [ ] Create + republish enqueue via `service_request_enqueue_enrichment` (+ wake).
- [ ] Edge `generate-completion-checklist` + enrichment cron sweeper + `job_runs`.
- [ ] `service_completion_*` RPCs live; app callers migrated.
- [ ] **DROP/REVOKE** `payment_mark_service_executed`, `payment_confirm_service_completed`, `payment_cron_auto_complete_*`.

### 1.3 Global template seeded (abort if missing)

**Hard gate — do not open traffic without an active global template.**

```sql
select id, is_active, schema_version
from public.completion_checklist_templates
where is_global and is_active;
-- expect exactly 1 row
```

```sql
select public.enrichment_validate_checklist_schema(checklist_schema)
from public.completion_checklist_templates
where is_global and is_active
limit 1;
-- expect true
```

- [ ] Active global template present.
- [ ] Schema passes `enrichment_validate_checklist_schema`.
- [ ] Optional: service/category templates seeded where product requires them (cascade still falls back to global).

If missing → **abort**, seed template, re-check. Do not rely on AI alone for first traffic.

### 1.4 OPEN trigger gone

```sql
select tgname
from pg_trigger
where not tgisinternal
  and tgrelid = 'public.service_requests'::regclass
  and tgname = 'trg_service_request_dispatch_bootstrap';
-- expect 0 rows
```

- [ ] Trigger absent.
- [ ] Inserting an `OPEN` SR alone does **not** insert `service_request_dispatches`.

### 1.5 `payment_*` product writers revoked

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'payment_mark_service_executed',
    'payment_confirm_service_completed'
  )
   or p.proname like 'payment_cron_auto_complete%';
-- expect 0 rows (dropped) or no EXECUTE grants to authenticated/anon
```

- [ ] Product completion writers are `service_completion_*` only ([ADR-0004](./adr/0004-completion-rpcs-outside-payments.md)).

---

## 2. Smoke after reset

### 2.1 Create → enqueue (no matching yet)

- [ ] Create a service request (authenticated client path).
- [ ] Same TX / immediate aftermath: `service_request_enrichments` row `PENDING`, `ops_attention_at IS NULL`.
- [ ] **No** `service_request_dispatches` row yet.
- [ ] UI projects enrichment “em processamento” (not provider feed).

### 2.2 Republish → enqueue

- [ ] Republish path calls the **same** enqueue helper (no divergent OPEN bootstrap).
- [ ] Non-bootstrap republish does not invent a second divergent enrichment insert pattern.

### 2.3 Enrichment worker live

- [ ] Edge `generate-completion-checklist` deployed; cron/orbit secret configured.
- [ ] Cron sweeper `enrichment_cron_sweep` scheduled (wake failure recovery).
- [ ] Claim → LLM (or fallback) → `enrichment_finalize_ready` → status `READY` + schema + `source` in `{ai, fallback_template}`.
- [ ] Same TX: `matching_bootstrap_dispatch_for_service_request` creates dispatch; **5-minute matching delay starts at bootstrap**, not at OPEN insert.

### 2.4 Completion path smoke

- [ ] Provider draft + `service_completion_mark_executed` → `EXECUTED` + frozen evidence.
- [ ] Client `service_completion_confirm_with_rating` → `COMPLETED` + rating **or** auto-complete cron → `completed_by=system` without forced rating.
- [ ] Dispute stub: analytics fire; missing URL → “Em breve” toast (no crash).

---

## 3. App / env cutover

- [ ] App build includes `src/features/service-completion/`; `view-services` imports Public API only (no `payment_*` lifecycle writers).
- [ ] Set `VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL` in each environment (optional remote override `orbit.dispute_support_url`).
- [ ] Confirm Storage bucket **`completion-evidence`** exists (local/staging/prod) with policies matching Task 10 / Task 79 — see [storage-bucket.md](./storage-bucket.md).
- [ ] Edge secrets: `GEMINI_API_KEY` (same as smart-description), `ORBIT_CRON_SECRET`, Supabase service role for workers.

---

## 4. Observability go-live

See [service-completion-monitoring.md](./service-completion-monitoring.md).

- [ ] `select public.service_completion_ops_metrics(24);` returns healthy shape.
- [ ] `ops_attention_open_count = 0` (or known seeded holds only).
- [ ] Sentry alert emit cron scheduled; CRITICAL on open `ops_attention` / missing templates.
- [ ] Auto-complete + orphan janitor `job_runs` rows appear after first ticks.

---

## 5. Explicit non-goals (do not do)

- ❌ Backfill enrichment for legacy `OPEN` SRs that existed before reset.
- ❌ Restore `trg_service_request_dispatch_bootstrap` after reset “to unblock matching” — that reintroduces OPEN-insert bootstrap and violates decision 22/31.
- ❌ Open production traffic without an active global checklist template.
- ❌ Re-enable `payment_mark_service_executed` / `payment_confirm_service_completed` as product APIs.

---

## 6. Rollback boundaries

From [tasks.md Execution Strategy — Recovery & rollback](./tasks.md):

| Stage | Allowed rollback | Forbidden / prefer forward-fix |
|-------|------------------|----------------------------------|
| Pre OPEN-trigger DROP | Restore trigger from git (emergency only) | — |
| Post DB reset + READY-handoff | Keep READY-handoff; fix forward | Do not reintroduce OPEN bootstrap |
| Pre `payment_*` DROP | Redeploy prior app build calling `payment_*` | — |
| Post `payment_*` DROP | Forward-fix `service_completion_*` | Avoid reintroducing revoked `payment_*` writers |
| Missing template | Seed + `enrichment_clear_ops_attention`; hold traffic | Do not publish empty READY |

Lease crash / wake failure / READY-without-dispatch: use reclaim, cron sweeper, and `enrichment_repair_ready_without_dispatch` — not cutover rollback.

---

## 7. Done criteria

Cutover is **complete** when:

1. Reset applied; no OPEN grandfather.
2. Global template active and valid.
3. OPEN bootstrap trigger absent; create/republish enqueue smoke green.
4. Enrichment worker + sweeper produce `READY` + matching bootstrap.
5. `payment_*` completion product APIs gone; `service_completion_*` smoke green.
6. App env (dispute URL) + Storage + secrets validated.
7. Ops sign-off table above filled.
