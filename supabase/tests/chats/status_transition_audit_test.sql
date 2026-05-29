-- pgTAP: status transition audit triggers on chats and provider_proposals (CNS task 19).

begin;

\ir fixtures/seed_chat.inc

select plan(7);

select set_config(
  'request.jwt.claim.sub',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '28e30f1d-3c47-441f-94c6-76b6ea0db470'
  )::text,
  true
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'audit_chat_status_change'
  ),
  'audit_chat_status_change is SECURITY DEFINER'
);

select ok(
  not has_table_privilege('authenticated', 'public.chat_audit', 'INSERT'),
  'authenticated cannot INSERT into chat_audit'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'audit_proposal_status_change'
  ),
  'audit_proposal_status_change is SECURITY DEFINER'
);

create temp table _inactive_fixture as
select pg_temp.cns_seed_chat(
  p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

update public.chats c
set
  status = 'INACTIVE',
  inactivated_at = now(),
  inactivation_reason = 'NO_RECIPROCITY'
from _inactive_fixture f
where c.id = f.chat_id;

select ok(
  (
    select exists (
      select 1
      from public.chat_audit ca
      join _inactive_fixture f on f.chat_id = ca.chat_id
      where ca.from_status = 'ACTIVE'
        and ca.to_status = 'INACTIVE'
        and ca.actor_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
        and ca.metadata ->> 'inactivation_reason' = 'NO_RECIPROCITY'
    )
  ),
  'chat ACTIVE → INACTIVE appends chat_audit with actor and metadata'
);

update public.chats c
set
  status = 'CLOSED',
  closed_at = now(),
  closure_type = 'MANUAL',
  closed_by_user_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  closure_reason = 'Test closure'
from _inactive_fixture f
where c.id = f.chat_id;

select ok(
  (
    select exists (
      select 1
      from public.chat_audit ca
      join _inactive_fixture f on f.chat_id = ca.chat_id
      where ca.from_status = 'INACTIVE'
        and ca.to_status = 'CLOSED'
        and ca.metadata ->> 'closure_type' = 'MANUAL'
        and ca.metadata ->> 'closure_reason' = 'Test closure'
    )
  ),
  'chat INACTIVE → CLOSED appends chat_audit with closure metadata'
);

select set_config(
  'request.jwt.claim.sub',
  '5d09e025-20a2-4842-aeef-324d42a431e1',
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '5d09e025-20a2-4842-aeef-324d42a431e1'
  )::text,
  true
);

create temp table _proposal_row (id uuid primary key);

with pricing as (
  select *
  from public.calculate_provider_service_pricing(100.00::numeric)
),
ins as (
  insert into public.provider_proposals (
    provider_id,
    service_request_id,
    proposed_amount,
    proposal_description,
    proposal_duration_value,
    proposal_duration_unit,
    proposal_suggested_slots,
    tax_rate,
    tax_amount,
    final_amount,
    pricing_signature,
    status
  )
  select
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid,
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    pricing.original_amount,
    'Audit trigger test proposal',
    2,
    'hours',
    jsonb_build_array(
      jsonb_build_object(
        'start_date', (current_date + 1)::text,
        'shift', 'morning'
      )
    ),
    pricing.tax_rate,
    pricing.tax_amount,
    pricing.final_amount,
    pricing.pricing_signature,
    'PENDING'::public.proposal_status
  from pricing
  returning id
)
insert into _proposal_row (id)
select id from ins;

select set_config(
  'request.jwt.claim.sub',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '28e30f1d-3c47-441f-94c6-76b6ea0db470'
  )::text,
  true
);

update public.provider_proposals pp
set
  status = 'REJECTED'::public.proposal_status,
  client_rejection_response = 'Not a fit'
from _proposal_row pr
where pp.id = pr.id;

select ok(
  (
    select exists (
      select 1
      from public.proposal_audit pa
      join _proposal_row pr on pr.id = pa.proposal_id
      where pa.from_status = 'PENDING'
        and pa.to_status = 'REJECTED'
        and pa.actor_id = '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid
    )
  ),
  'proposal PENDING → REJECTED appends proposal_audit with actor'
);

create temp table _noop_fixture as
select pg_temp.cns_seed_chat(
  p_service_request_id := '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
  p_client_id := '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
  p_provider_id := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
) as chat_id;

create temp table _noop_before as
select count(*)::int as audit_count
from public.chat_audit ca
join _noop_fixture f on f.chat_id = ca.chat_id;

update public.chats c
set last_interaction_at = now()
from _noop_fixture f
where c.id = f.chat_id;

select is(
  (
    select count(*)::int
    from public.chat_audit ca
    join _noop_fixture f on f.chat_id = ca.chat_id
  ),
  (select audit_count from _noop_before),
  'non-status chat update does not append chat_audit'
);

select finish();

rollback;
