-- pgTAP: shared SR cancel proposal rejection (20260706040000_align_sr_cancel_proposal_rejection).

begin;

select plan(9);

create or replace function pg_temp.sr_cancel_insert_proposal(
  p_provider_id uuid,
  p_service_request_id uuid,
  p_status public.proposal_status,
  p_description text,
  p_client_rejection_response text default null
)
returns void
language plpgsql
as $$
begin
  insert into public.provider_proposals (
    id,
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
    status,
    client_rejection_response,
    version,
    revision_count,
    submitted_at
  )
  values (
    gen_random_uuid(),
    p_provider_id,
    p_service_request_id,
    100,
    p_description,
    1,
    'hours',
    jsonb_build_array(jsonb_build_object('start_date', current_date::text, 'shift', 'morning')),
    0.1,
    10,
    90,
    'test-pricing-signature',
    p_status,
    p_client_rejection_response,
    1,
    case when p_status = 'REVISION_REQUESTED'::public.proposal_status then 1 else 0 end,
    now()
  );
end;
$$;

create or replace function pg_temp.sr_cancel_seed_open_request()
returns uuid
language plpgsql
as $$
declare
  v_sr_id uuid;
begin
  insert into public.service_requests (
    id,
    client_id,
    service_id,
    address_id,
    title,
    description,
    form_data,
    form_version,
    status,
    urgency
  )
  select
    gen_random_uuid(),
    sr.client_id,
    sr.service_id,
    sr.address_id,
    'SR cancel rejection pgTAP fixture',
    sr.description,
    sr.form_data,
    sr.form_version,
    'OPEN'::public.service_request_status,
    sr.urgency
  from public.service_requests sr
  where sr.id = '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid
  returning id into v_sr_id;

  return v_sr_id;
end;
$$;

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reject_non_terminal_proposals_on_sr_cancel'
  ),
  'reject_non_terminal_proposals_on_sr_cancel is SECURITY DEFINER'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.reject_non_terminal_proposals_on_sr_cancel(uuid, text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated cannot execute reject_non_terminal_proposals_on_sr_cancel directly'
);

alter table public.provider_proposals disable trigger provider_proposals_validate_pricing;

-- Helper rejects PENDING and REVISION_REQUESTED --------------------------------

do $setup$
declare
  v_sr_id uuid := pg_temp.sr_cancel_seed_open_request();
  v_revision_sr_id uuid := pg_temp.sr_cancel_seed_open_request();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
begin
  perform set_config('test.sr_cancel.sr_id', v_sr_id::text, true);
  perform set_config('test.sr_cancel.revision_sr_id', v_revision_sr_id::text, true);

  perform pg_temp.sr_cancel_insert_proposal(
    v_provider_id,
    v_sr_id,
    'PENDING'::public.proposal_status,
    'pending proposal'
  );

  perform pg_temp.sr_cancel_insert_proposal(
    v_provider_id,
    v_revision_sr_id,
    'REVISION_REQUESTED'::public.proposal_status,
    'revision requested proposal'
  );
end;
$setup$;

select is(
  public.reject_non_terminal_proposals_on_sr_cancel(
    current_setting('test.sr_cancel.sr_id')::uuid
  ),
  1::bigint,
  'helper rejects PENDING proposals'
);

select is(
  public.reject_non_terminal_proposals_on_sr_cancel(
    current_setting('test.sr_cancel.revision_sr_id')::uuid
  ),
  1::bigint,
  'helper rejects REVISION_REQUESTED proposals'
);

select is(
  (
    select pp.status::text
    from public.provider_proposals pp
    where pp.service_request_id = current_setting('test.sr_cancel.sr_id')::uuid
    limit 1
  ),
  'REJECTED_AUTOMATICALLY',
  'helper sets REJECTED_AUTOMATICALLY on PENDING proposals'
);

-- Preserves existing client_rejection_response ---------------------------------

do $preserve$
declare
  v_sr_id uuid := pg_temp.sr_cancel_seed_open_request();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
  v_custom text := 'Custom rejection note kept';
begin
  perform set_config('test.sr_cancel.preserve_sr_id', v_sr_id::text, true);

  perform pg_temp.sr_cancel_insert_proposal(
    v_provider_id,
    v_sr_id,
    'PENDING'::public.proposal_status,
    'pending with custom response',
    v_custom
  );

  perform public.reject_non_terminal_proposals_on_sr_cancel(v_sr_id);
end;
$preserve$;

select is(
  (
    select pp.client_rejection_response
    from public.provider_proposals pp
    where pp.service_request_id = current_setting('test.sr_cancel.preserve_sr_id')::uuid
    limit 1
  ),
  'Custom rejection note kept',
  'helper preserves existing client_rejection_response'
);

-- Does not touch ACCEPTED ------------------------------------------------------

do $accepted$
declare
  v_sr_id uuid := pg_temp.sr_cancel_seed_open_request();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
begin
  perform set_config('test.sr_cancel.accepted_sr_id', v_sr_id::text, true);

  perform pg_temp.sr_cancel_insert_proposal(
    v_provider_id,
    v_sr_id,
    'ACCEPTED'::public.proposal_status,
    'accepted proposal'
  );

  perform public.reject_non_terminal_proposals_on_sr_cancel(v_sr_id);
end;
$accepted$;

select is(
  (
    select pp.status::text
    from public.provider_proposals pp
    where pp.service_request_id = current_setting('test.sr_cancel.accepted_sr_id')::uuid
    limit 1
  ),
  'ACCEPTED',
  'helper leaves ACCEPTED proposals unchanged'
);

-- Trigger safety net on direct SR cancel ---------------------------------------

do $trigger$
declare
  v_sr_id uuid := pg_temp.sr_cancel_seed_open_request();
  v_provider_id uuid := '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid;
begin
  perform set_config('test.sr_cancel.trigger_sr_id', v_sr_id::text, true);

  perform pg_temp.sr_cancel_insert_proposal(
    v_provider_id,
    v_sr_id,
    'PENDING'::public.proposal_status,
    'pending via trigger path'
  );

  update public.service_requests
  set status = 'CANCELLED'::public.service_request_status
  where id = v_sr_id;
end;
$trigger$;

alter table public.provider_proposals enable trigger provider_proposals_validate_pricing;

select is(
  (
    select pp.status::text
    from public.provider_proposals pp
    where pp.service_request_id = current_setting('test.sr_cancel.trigger_sr_id')::uuid
    limit 1
  ),
  'REJECTED_AUTOMATICALLY',
  'SR cancel trigger rejects pending proposals with REJECTED_AUTOMATICALLY'
);

-- Idempotent second call -------------------------------------------------------

select is(
  public.reject_non_terminal_proposals_on_sr_cancel(
    current_setting('test.sr_cancel.sr_id')::uuid
  ),
  0::bigint,
  'helper is idempotent when no non-terminal proposals remain'
);

select finish();

rollback;
