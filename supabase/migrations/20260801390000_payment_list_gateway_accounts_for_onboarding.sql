-- Payment Task 41: payment_list_gateway_accounts_for_onboarding RPC (design.md §4.1.2, Req 4).

create or replace function public.payment_list_gateway_accounts_for_onboarding(
  p_batch_size int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_list_gateway_accounts_for_onboarding'
      using errcode = '42501';
  end if;

  v_batch_size := greatest(
    coalesce(
      p_batch_size,
      public.platform_constant_int('provider_onboarding_batch_size', 50)
    ),
    1
  );

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', pga.id,
          'provider_id', pga.provider_id,
          'gateway_slug', pga.gateway_slug,
          'document', pga.document,
          'onboarding_status', pga.onboarding_status,
          'onboarding_submitted_at', pga.onboarding_submitted_at,
          'alias_key', format('provider_%s', regexp_replace(pga.document, '\D', '', 'g'))
        )
        order by coalesce(pga.onboarding_submitted_at, pga.created_at), pga.id
      )
      from (
        select pga.*
        from public.provider_gateway_accounts pga
        where pga.onboarding_status in (
          'DOCUMENTS_SUBMITTED'::public.payment_provider_onboarding_status,
          'UNDER_NETCRED_REVIEW'::public.payment_provider_onboarding_status
        )
          and btrim(pga.document) <> ''
        order by coalesce(pga.onboarding_submitted_at, pga.created_at), pga.id
        limit v_batch_size
        for update of pga skip locked
      ) pga
    ),
    '[]'::jsonb
  );
end;
$$;

comment on function public.payment_list_gateway_accounts_for_onboarding(int) is
  'Lists pending provider gateway accounts for detect-netcred-onboarding batch polling (service_role only).';

revoke all on function public.payment_list_gateway_accounts_for_onboarding(int) from public;
revoke all on function public.payment_list_gateway_accounts_for_onboarding(int) from anon;
revoke all on function public.payment_list_gateway_accounts_for_onboarding(int) from authenticated;

grant execute on function public.payment_list_gateway_accounts_for_onboarding(int) to service_role;
