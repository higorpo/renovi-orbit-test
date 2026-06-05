-- Allow any authenticated provider to read a service request via get_service.

create or replace function public.service_viewer_has_access(
  p_service_request_id uuid,
  p_viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.service_requests sr
      where sr.id = p_service_request_id
        and sr.client_id = p_viewer_id
    )
    or exists (
      select 1
      from public.provider_proposals pp
      where pp.service_request_id = p_service_request_id
        and pp.provider_id = p_viewer_id
    )
    or exists (
      select 1
      from public.contracted_services cs
      where cs.service_request_id = p_service_request_id
        and cs.provider_id = p_viewer_id
    )
    or (
      exists (
        select 1
        from public.profiles pr
        where pr.id = p_viewer_id
          and pr.role = 'provider'
      )
      and exists (
        select 1
        from public.service_requests sr
        where sr.id = p_service_request_id
      )
    );
$$;

comment on function public.service_viewer_has_access(uuid, uuid) is
  'Access gate for get_service: client owner, involved provider, any provider (read-only detail), or platform admin.';

comment on function public.get_service(uuid) is
  'Returns unified service payload. Any authenticated provider may fetch an existing service_request by id.';
