-- Enable Realtime on service_reschedule_requests for chat card hydration (mirrors provider_proposals).

alter table public.service_reschedule_requests replica identity default;

grant select on table public.service_reschedule_requests to authenticated;

drop policy if exists service_reschedule_requests_admin_select on public.service_reschedule_requests;
drop policy if exists service_reschedule_requests_select on public.service_reschedule_requests;

create policy service_reschedule_requests_select
  on public.service_reschedule_requests
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or exists (
      select 1
      from public.contracted_services cs
      where cs.id = service_reschedule_requests.contracted_service_id
        and (
          cs.client_id = (select auth.uid())
          or cs.provider_id = (select auth.uid())
        )
    )
  );

comment on policy service_reschedule_requests_select on public.service_reschedule_requests is
  'Platform admin or participant read for Realtime card hydration; mutations remain RPC-only.';

do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'service_reschedule_requests'
  ) then
    alter publication supabase_realtime add table public.service_reschedule_requests;
  end if;
end;
$pub$;
