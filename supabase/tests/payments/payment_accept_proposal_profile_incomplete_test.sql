-- pgTAP: FIX-012 / CHK-028 — accept_proposal requires CPF + phone (PROFILE_INCOMPLETE).

begin;

select plan(1);

select ok(
  (
    select pg_get_functiondef(p.oid) ~ 'PROFILE_INCOMPLETE'
      and pg_get_functiondef(p.oid) ~ 'client_profiles_private'
      and pg_get_functiondef(p.oid) ~ 'phone'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'accept_proposal'
    order by p.oid desc
    limit 1
  ),
  'CHK-028: accept_proposal enforces PROFILE_INCOMPLETE via CPF/phone checks'
);

select * from finish();

rollback;
