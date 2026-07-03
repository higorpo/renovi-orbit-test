# Payment operator runbook — dead letter and audit reconstruction (Task 105)

Operator procedures for webhook dead-letter recovery and service payment timeline reconstruction. RPCs: Task 49 (`payment_reset_dead_letter_event`), Task 50 (`payment_reconstruct_audit_lifecycle`). **service_role only** — never expose to client apps.

## Prerequisites

- Supabase `service_role` key (Dashboard → Settings → API) or SQL editor with postgres role
- Event UUID from `payment_webhook_events` or alert payload
- Contracted service UUID for audit timeline

## 1. Reset dead-letter webhook event

When a webhook event reaches `DEAD_LETTER` after exhausted retries, operators can reset it for reprocessing.

### Inspect dead letters

```sql
select id, event_type, state, retry_count, last_error, created_at, updated_at
from public.payment_webhook_events
where state = 'DEAD_LETTER'
order by updated_at desc
limit 20;
```

### Reset via RPC (service_role)

```bash
nvm use 24.13
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role>"

curl -s "${SUPABASE_URL}/rest/v1/rpc/payment_reset_dead_letter_event" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_event_id": "<uuid>"}' | jq .
```

Or SQL (service_role session):

```sql
select public.payment_reset_dead_letter_event('<event_uuid>'::uuid);
```

**Effect:** transitions `DEAD_LETTER` → `FAILED` with retry schedule reset; eligible for `payment_cron_process_webhook_retry`.

### Verify reprocessing

```sql
select id, state, retry_count, next_retry_at
from public.payment_webhook_events
where id = '<event_uuid>'::uuid;
```

Ensure `process-webhook-retry` cron is active before expecting automatic drain.

## 2. Reconstruct audit lifecycle for a service

Build chronological payment audit timeline for support / dispute investigation.

### Via RPC

```bash
curl -s "${SUPABASE_URL}/rest/v1/rpc/payment_reconstruct_audit_lifecycle" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_contracted_service_id": "<service_uuid>"}' | jq .
```

Or SQL:

```sql
select public.payment_reconstruct_audit_lifecycle('<contracted_service_uuid>'::uuid);
```

Returns ordered audit entries from `payment_audit_log` for the service (schedules, tokens, gateway accounts).

### Direct query (read-only alternative)

```sql
select created_at, event_type, entity_type, from_state, to_state, actor, metadata
from public.payment_audit_log
where service_id = '<contracted_service_uuid>'::uuid
order by created_at asc;
```

## 3. Admin tooling integration

No in-app admin UI at MVP. Operators use:

| Tool | RPC | Method |
|------|-----|--------|
| Dead letter reset | `payment_reset_dead_letter_event` | curl / SQL below |
| Audit timeline | `payment_reconstruct_audit_lifecycle` | curl / SQL below |

Future admin dashboard SHOULD call the same RPCs via service_role backend — not duplicate business logic.

## Safety rules

1. **Never reset dead letters** without confirming root cause (duplicate event, bad payload, NetCred outage).
2. **Log operator identity** in change ticket when resetting production events.
3. Audit reconstruction is **read-only** — safe for support workflows.
4. Dead letter reset **mutates** webhook state — requires service_role and operator authorization.

## Related tests

```bash
npx supabase test db --local supabase/tests/payments/payment_reset_dead_letter_event_test.sql
npx supabase test db --local supabase/tests/payments/payment_reconstruct_audit_lifecycle_test.sql
```

## Related docs

- Rollback: [`payment-rollback-runbook.md`](./payment-rollback-runbook.md)
- Design §8.3: `design.md`
