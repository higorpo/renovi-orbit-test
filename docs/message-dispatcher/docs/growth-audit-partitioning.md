# Growth — audit table monthly partitioning (task 110)

MVP keeps `message_dispatcher.message_dispatcher_audit` as a **single heap table** with composite indexes (`dispatch_id`, `created_at` and `profile_id`, `created_at`). Growth phase converts to **RANGE partitions on `created_at`** (one partition per month) per `design.md` §3.6 and Req. 6 AC3.

## MVP state

| Item | Value |
|------|--------|
| `platform_constants.message_dispatcher.audit_partitioning_phase` | `mvp_unpartitioned` |
| Table `relkind` | `r` (ordinary table), not `p` (partitioned) |
| Stub SQL | `supabase/scripts/growth/message_dispatcher_audit_monthly_partitions.sql` |
| In-DB stub | `select message_dispatcher.message_dispatcher_audit_partitioning_growth_stub_sql();` |

## Cutover checklist (operators)

1. Confirm `audit_partitioning_phase = mvp_unpartitioned`.
2. Take backup; verify support timeline RPC latency on largest dispatches.
3. Review and extend monthly partition DDL in the growth script (bounds per month).
4. Create `message_dispatcher_audit_partitioned` + partitions; backfill historical rows.
5. Swap table names; re-attach `trg_message_dispatcher_audit` (trigger unchanged).
6. Schedule job to `CREATE TABLE ... PARTITION OF` for upcoming months.
7. Set `audit_partitioning_phase` to `growth_partitioned`.

## Index strategy per partition

Each child partition MUST have:

- `(dispatch_id, created_at desc)` — `message_dispatcher_audit_timeline`
- `(profile_id, created_at desc)` — profile-scoped support queries

## Related

- `design.md` §3.6, §9.1 (Growth throughput)
- `operator-runbook-immutable-fields.md` — audit remains append-only
