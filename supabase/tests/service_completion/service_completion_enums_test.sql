-- pgTAP: Task 2 — service-completion enum label inventory (design §3).

begin;

select plan(4);

select is(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'enrichment_status'
  ),
  array['PENDING', 'RUNNING', 'READY', 'ABORTED']::text[],
  'enrichment_status labels: PENDING, RUNNING, READY, ABORTED'
);

select is(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'checklist_source'
  ),
  array['ai', 'fallback_template']::text[],
  'checklist_source labels: ai, fallback_template'
);

select is(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'completion_evidence_phase'
  ),
  array['draft', 'frozen']::text[],
  'completion_evidence_phase labels: draft, frozen'
);

select is(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'completion_upload_session_status'
  ),
  array['open', 'committed', 'expired', 'aborted']::text[],
  'completion_upload_session_status labels: open, committed, expired, aborted'
);

select * from finish();

rollback;
