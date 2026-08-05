-- Service completion Task 30: BRT date-only helpers for executed_late (design §5.4.1).
-- MUST NOT use payment_service_execution_at — that remains the payment shift clock.

create or replace function public.service_completion_brt_today()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

comment on function public.service_completion_brt_today() is
  'Current calendar date in America/Sao_Paulo for service-completion temporal gates (design §5.4.1). Distinct from payment_service_execution_at.';

revoke all on function public.service_completion_brt_today() from public;
revoke all on function public.service_completion_brt_today() from anon;
revoke all on function public.service_completion_brt_today() from authenticated;
grant execute on function public.service_completion_brt_today() to service_role;
grant execute on function public.service_completion_brt_today() to postgres;

create or replace function public.service_completion_compute_executed_late(
  p_cs public.contracted_services
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.service_completion_brt_today()
    > (coalesce(p_cs.scheduled_end_date, p_cs.scheduled_start_date) + 1);
$$;

comment on function public.service_completion_compute_executed_late(public.contracted_services) is
  'True when BRT today > coalesce(scheduled_end_date, scheduled_start_date) + 1. On-time window is date-only; payment clocks MUST NOT be used (design §5.4.1 / Req 11).';

revoke all on function public.service_completion_compute_executed_late(public.contracted_services)
  from public;
revoke all on function public.service_completion_compute_executed_late(public.contracted_services)
  from anon;
revoke all on function public.service_completion_compute_executed_late(public.contracted_services)
  from authenticated;
grant execute on function public.service_completion_compute_executed_late(public.contracted_services)
  to service_role;
grant execute on function public.service_completion_compute_executed_late(public.contracted_services)
  to postgres;

-- Scalar overload for callers that already hold dates (mark-executed / tests).
create or replace function public.service_completion_compute_executed_late(
  p_scheduled_start_date date,
  p_scheduled_end_date date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.service_completion_brt_today()
    > (coalesce(p_scheduled_end_date, p_scheduled_start_date) + 1);
$$;

comment on function public.service_completion_compute_executed_late(date, date) is
  'Scalar form of executed_late: BRT today > coalesce(end, start) + 1 (design §5.4.1).';

revoke all on function public.service_completion_compute_executed_late(date, date)
  from public;
revoke all on function public.service_completion_compute_executed_late(date, date)
  from anon;
revoke all on function public.service_completion_compute_executed_late(date, date)
  from authenticated;
grant execute on function public.service_completion_compute_executed_late(date, date)
  to service_role;
grant execute on function public.service_completion_compute_executed_late(date, date)
  to postgres;
