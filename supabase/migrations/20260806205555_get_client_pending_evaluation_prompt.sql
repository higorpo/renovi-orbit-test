-- Client pending-evaluation prompt: partial index + lightweight read RPC.
-- Returns at most one EXECUTED contracted_service still inside auto_complete_grace_hours.

-- ---------------------------------------------------------------------------
-- Partial index: client lookup by executed_at (DESC) for EXECUTED rows only
-- ---------------------------------------------------------------------------

create index if not exists contracted_services_client_executed_at_pending_eval_idx
  on public.contracted_services (client_id, executed_at desc)
  where status = 'EXECUTED'::public.contracted_service_status;

comment on index public.contracted_services_client_executed_at_pending_eval_idx is
  'Partial index for get_client_pending_evaluation_prompt: EXECUTED rows by client_id, executed_at DESC.';

-- ---------------------------------------------------------------------------
-- RPC: most recent eligible EXECUTED service for the authenticated client
-- ---------------------------------------------------------------------------

create or replace function public.get_client_pending_evaluation_prompt()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client_id uuid := (select auth.uid());
  v_grace_hours int;
  v_cutoff timestamptz;
  v_result jsonb;
begin
  if v_client_id is null then
    raise exception 'Authentication required for get_client_pending_evaluation_prompt'
      using errcode = '42501';
  end if;

  v_grace_hours := public.platform_constant_int('auto_complete_grace_hours', 24);
  -- Sargable cutoff: same convention as service_completion_auto_complete_executed
  -- (rows with executed_at <= cutoff are past grace / eligible for auto-complete).
  v_cutoff := now() - make_interval(hours => v_grace_hours);

  select jsonb_build_object(
    'service_request_id', cs.service_request_id,
    'contracted_service_id', cs.id,
    'executed_at', cs.executed_at,
    'title', sr.title,
    'category_title', ps.title,
    'provider_full_name', prov.full_name,
    'scheduled_start_date', cs.scheduled_start_date,
    'scheduled_end_date', cs.scheduled_end_date,
    'icon_key', ps.icon_key,
    'color_key', ps.color_key
  )
  into v_result
  from public.contracted_services cs
  join public.service_requests sr on sr.id = cs.service_request_id
  left join public.platform_services ps on ps.id = sr.service_id
  join public.profiles prov on prov.id = cs.provider_id
  where cs.client_id = v_client_id
    and cs.status = 'EXECUTED'::public.contracted_service_status
    and cs.executed_at is not null
    and cs.executed_at > v_cutoff
  order by cs.executed_at desc
  limit 1;

  return v_result;
end;
$$;

comment on function public.get_client_pending_evaluation_prompt() is
  'Lightweight prompt payload: most recent client EXECUTED CS still inside auto_complete_grace_hours; null when none.';

revoke all on function public.get_client_pending_evaluation_prompt() from public;
revoke all on function public.get_client_pending_evaluation_prompt() from anon;
revoke all on function public.get_client_pending_evaluation_prompt() from service_role;

grant execute on function public.get_client_pending_evaluation_prompt() to authenticated;
grant execute on function public.get_client_pending_evaluation_prompt() to postgres;
