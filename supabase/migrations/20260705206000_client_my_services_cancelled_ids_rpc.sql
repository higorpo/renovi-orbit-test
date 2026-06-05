-- PostgREST or() cannot reference embedded columns (services.status); use RPC for cancelled tab ids.

create or replace function public.client_my_services_cancelled_ids(p_client_id uuid)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select sr.id
  from public.service_requests sr
  left join public.services s on s.id = sr.contracted_service_id
  where sr.client_id = p_client_id
    and (
      sr.status = 'CANCELLED'::public.service_request_status
      or (
        sr.status = 'COMPLETED'::public.service_request_status
        and s.status = 'CANCELLED'::public.contracted_service_status
      )
    );
$$;

comment on function public.client_my_services_cancelled_ids(uuid) is
  'Ids for client Meus serviços cancelled tab: SR CANCELLED or SR COMPLETED with contracted service CANCELLED.';

revoke all on function public.client_my_services_cancelled_ids(uuid) from public;
grant execute on function public.client_my_services_cancelled_ids(uuid) to authenticated;
