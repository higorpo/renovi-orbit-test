-- pgTAP: payment Task 19 — payment_get_checkout_step_requirements RPC.

begin;

select plan(3);

create or replace function pg_temp.payment_set_client_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

select throws_ok(
  $$ select public.payment_get_checkout_step_requirements() $$,
  '42501',
  'Authentication required for payment_get_checkout_step_requirements',
  'rejects unauthenticated callers'
);

select pg_temp.payment_set_client_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select ok(
  public.payment_get_checkout_step_requirements() ?& array['needs_cpf', 'needs_phone', 'needs_card'],
  'returns needs_cpf, needs_phone, and needs_card keys'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'payment_get_checkout_step_requirements'
  ),
  'payment_get_checkout_step_requirements is SECURITY DEFINER'
);

select finish();

rollback;
