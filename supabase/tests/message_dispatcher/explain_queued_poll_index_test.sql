-- pgTAP: checkout poll query uses message_dispatches_queued_poll_idx (design §9.2, task 106).

begin;

select plan(3);

select has_index(
  'message_dispatcher',
  'message_dispatches',
  'message_dispatches_queued_poll_idx',
  array['scheduled_for', 'created_at']
);

select ok(
  (
    select i.indisvalid
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_index i on i.indrelid = t.oid
    join pg_class ix on ix.oid = i.indexrelid
    where n.nspname = 'message_dispatcher'
      and t.relname = 'message_dispatches'
      and ix.relname = 'message_dispatches_queued_poll_idx'
  ),
  'queued_poll_idx is valid'
);

insert into message_dispatcher.message_dispatches (
  idempotency_key,
  profile_id,
  channel,
  template_key,
  status,
  scheduled_for
)
select
  gen_random_uuid(),
  p.id,
  'email'::message_dispatcher.message_channel,
  'welcome_template',
  'QUEUED'::message_dispatcher.message_dispatch_status,
  now() - (g * interval '1 second')
from public.profiles p,
  generate_series(1, 5) g
limit 5;

create or replace function _mmd_test_explain_uses_queued_poll_idx()
returns boolean
language plpgsql
set search_path = message_dispatcher, public
as $$
declare
  r record;
  found boolean := false;
begin
  set local enable_seqscan = off;

  for r in
    explain (analyze false, format text)
    select d.id
    from message_dispatcher.message_dispatches d
    where d.status = 'QUEUED'
      and d.scheduled_for <= now()
    order by d.scheduled_for, d.created_at
    limit 25
  loop
    if position('message_dispatches_queued_poll_idx' in r."QUERY PLAN") > 0 then
      found := true;
      exit;
    end if;
  end loop;

  return found;
end;
$$;

select ok(
  _mmd_test_explain_uses_queued_poll_idx(),
  'EXPLAIN shows Index Scan (or Bitmap Index Scan) on message_dispatches_queued_poll_idx'
);

drop function _mmd_test_explain_uses_queued_poll_idx();

select finish();

rollback;
