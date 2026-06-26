-- Payment Task 19: payment_get_checkout_step_requirements RPC (design.md §4.2.1).

create or replace function public.payment_get_checkout_step_requirements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_needs_cpf boolean;
  v_needs_phone boolean;
  v_needs_card boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required for payment_get_checkout_step_requirements'
      using errcode = '42501';
  end if;

  select
    not exists (
      select 1
      from public.client_profiles_private cpp
      where cpp.client_id = v_user_id
        and nullif(trim(cpp.cpf), '') is not null
    ),
    not exists (
      select 1
      from public.profiles p
      where p.id = v_user_id
        and nullif(trim(p.phone), '') is not null
    ),
    not exists (
      select 1
      from public.client_card_tokens cct
      where cct.client_id = v_user_id
        and cct.state = 'ACTIVE'
    )
  into v_needs_cpf, v_needs_phone, v_needs_card;

  return jsonb_build_object(
    'needs_cpf', v_needs_cpf,
    'needs_phone', v_needs_phone,
    'needs_card', v_needs_card
  );
end;
$$;

comment on function public.payment_get_checkout_step_requirements() is
  'Returns conditional checkout stepper requirements for the authenticated client.';

revoke all on function public.payment_get_checkout_step_requirements() from public;
revoke all on function public.payment_get_checkout_step_requirements() from anon;
revoke all on function public.payment_get_checkout_step_requirements() from service_role;

grant execute on function public.payment_get_checkout_step_requirements() to authenticated;
