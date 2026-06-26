-- pgTAP: payment Task 23 — payment_update_method RPC.

begin;

select plan(2);

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
  $$ select public.payment_update_method(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  '42501',
  'Authentication required for payment_update_method',
  'rejects unauthenticated callers'
);

select pg_temp.payment_set_client_auth('28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid);

select throws_ok(
  $$ select public.payment_update_method(
    gen_random_uuid(),
    gen_random_uuid()
  ) $$,
  'P0001',
  'INVALID_SCHEDULE_STATE',
  'rejects when no eligible schedule exists'
);

select finish();

rollback;
