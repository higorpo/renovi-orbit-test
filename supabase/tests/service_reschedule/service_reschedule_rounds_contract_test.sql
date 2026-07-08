-- pgTAP: migration contract for service reschedule rounds, Realtime, and snapshot helpers.

begin;

\ir fixtures/seed_service_reschedule.inc

select plan(41);

do $seed$
declare
  v_active_service_id uuid := gen_random_uuid();
  v_no_active_service_id uuid := gen_random_uuid();
  v_proposed_service_id uuid := gen_random_uuid();
  v_fixture record;
  v_no_active_fixture record;
  v_proposed_fixture record;
  v_active_req_id uuid;
  v_proposed_req_id uuid;
begin
  select * into v_fixture
  from pg_temp.service_reschedule_seed_service(v_active_service_id);

  v_active_req_id := pg_temp.service_reschedule_insert_request(
    v_active_service_id,
    v_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_fixture.client_id
  );

  select * into v_no_active_fixture
  from pg_temp.service_reschedule_seed_service(v_no_active_service_id);

  select * into v_proposed_fixture
  from pg_temp.service_reschedule_seed_service(v_proposed_service_id);

  v_proposed_req_id := pg_temp.service_reschedule_insert_request(
    v_proposed_service_id,
    v_proposed_fixture.chat_id,
    'client'::public.service_reschedule_requested_by_role,
    v_proposed_fixture.client_id,
    'PROPOSED'::public.service_reschedule_request_status,
    now(),
    jsonb_build_object(
      'start_date', to_char(public.cns_business_today() + 3, 'YYYY-MM-DD'),
      'shift', 'afternoon'
    )
  );

  perform set_config('test.rounds_contract.active_service_id', v_active_service_id::text, true);
  perform set_config('test.rounds_contract.active_req_id', v_active_req_id::text, true);
  perform set_config('test.rounds_contract.client_id', v_fixture.client_id::text, true);
  perform set_config('test.rounds_contract.provider_id', v_fixture.provider_id::text, true);
  perform set_config('test.rounds_contract.no_active_service_id', v_no_active_service_id::text, true);
  perform set_config('test.rounds_contract.no_active_client_id', v_no_active_fixture.client_id::text, true);
  perform set_config('test.rounds_contract.no_active_provider_id', v_no_active_fixture.provider_id::text, true);
  perform set_config('test.rounds_contract.proposed_service_id', v_proposed_service_id::text, true);
  perform set_config('test.rounds_contract.proposed_req_id', v_proposed_req_id::text, true);
  perform set_config('test.rounds_contract.proposed_client_id', v_proposed_fixture.client_id::text, true);
  perform set_config('test.rounds_contract.proposed_provider_id', v_proposed_fixture.provider_id::text, true);
end;
$seed$;

select is(
  (
    select c.relreplident::text
    from pg_class c
    where c.oid = 'public.service_reschedule_requests'::regclass
  ),
  'd',
  'service_reschedule_requests uses default replica identity'
);

select ok(
  has_table_privilege('authenticated', 'public.service_reschedule_requests', 'SELECT'),
  'authenticated has SELECT on service_reschedule_requests for Realtime hydration'
);

select is(
  (
    select count(*)::int
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'service_reschedule_requests'
      and p.cmd = 'SELECT'
      and 'authenticated' = any(p.roles)
  ),
  1,
  'service_reschedule_requests has one authenticated SELECT policy'
);

select ok(
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'service_reschedule_requests'
      and p.policyname = 'service_reschedule_requests_select'
      and p.qual like '%is_platform_admin%'
      and p.qual like '%contracted_services%'
      and p.qual like '%auth.uid%'
  ),
  'service_reschedule_requests SELECT policy covers admin and participants'
);

select ok(
  exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'service_reschedule_requests'
  ),
  'service_reschedule_requests is published to supabase_realtime'
);

select ok(
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'service_reschedule_requests'
      and c.column_name = 'parent_request_id'
      and c.data_type = 'uuid'
      and c.is_nullable = 'YES'
  ),
  'parent_request_id nullable uuid column exists'
);

select ok(
  exists (
    select 1
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
      and att.attnum = any(con.conkey)
    where con.conrelid = 'public.service_reschedule_requests'::regclass
      and con.contype = 'f'
      and att.attname = 'parent_request_id'
      and con.confrelid = 'public.service_reschedule_requests'::regclass
      and pg_get_constraintdef(con.oid) like '%ON DELETE RESTRICT%'
  ),
  'parent_request_id self-FK uses ON DELETE RESTRICT'
);

select ok(
  exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.service_reschedule_requests'::regclass
      and con.conname = 'service_reschedule_requests_parent_only_when_proposed'
      and pg_get_constraintdef(con.oid) like '%parent_request_id IS NULL%'
      and pg_get_constraintdef(con.oid) like '%REQUESTED%'
      and pg_get_constraintdef(con.oid) like '%ADJUSTMENT_REQUESTED%'
  ),
  'parent_request_id check constraint blocks parent link on REQUESTED and ADJUSTMENT_REQUESTED'
);

select ok(
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'service_reschedule_requests'
      and i.indexname = 'service_reschedule_requests_parent_request_id_idx'
      and i.indexdef like '%WHERE (parent_request_id IS NOT NULL)%'
  ),
  'parent_request_id partial lookup index exists'
);

select ok(
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'service_reschedule_requests'
      and i.indexname = 'service_reschedule_requests_one_child_per_parent_idx'
      and i.indexdef like 'CREATE UNIQUE INDEX%'
      and i.indexdef like '%WHERE (parent_request_id IS NOT NULL)%'
  ),
  'parent_request_id unique successor index exists'
);

select ok(
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'service_reschedule_requests'
      and i.indexname = 'service_reschedule_requests_chat_id_idx'
      and i.indexdef like '%(chat_id)%'
  ),
  'chat_id index exists for reschedule Realtime filters'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.service_reschedule_requests'::regclass
      and t.tgname = 'service_reschedule_requests_parent_consistency'
      and not t.tgisinternal
  ),
  'parent consistency trigger is installed'
);

select is(
  public._cns_reschedule_display_status(
    'REQUESTED'::public.service_reschedule_request_status,
    'client'::public.service_reschedule_requested_by_role
  ),
  'Reagendamento solicitado pelo cliente',
  'display status maps client requested rows'
);

select is(
  public._cns_reschedule_display_status(
    'REQUESTED'::public.service_reschedule_request_status,
    'provider'::public.service_reschedule_requested_by_role
  ),
  'Reagendamento solicitado pelo prestador',
  'display status maps provider requested rows'
);

select is(
  public._cns_reschedule_display_status('PROPOSED'::public.service_reschedule_request_status, 'client'),
  'Nova data proposta',
  'display status maps PROPOSED'
);

select is(
  public._cns_reschedule_display_status('ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status, 'client'),
  'Ajuste solicitado',
  'display status maps ADJUSTMENT_REQUESTED'
);

select is(
  public._cns_reschedule_display_status('ACCEPTED'::public.service_reschedule_request_status, 'client'),
  'Reagendamento confirmado',
  'display status maps ACCEPTED'
);

select is(
  public._cns_reschedule_display_status('CANCELLED'::public.service_reschedule_request_status, 'client'),
  'Reagendamento cancelado',
  'display status maps CANCELLED'
);

select is(
  public._cns_reschedule_display_status('EXPIRED'::public.service_reschedule_request_status, 'client'),
  'Reagendamento expirado',
  'display status maps EXPIRED'
);

select is(
  public._cns_reschedule_display_status('SUPERSEDED'::public.service_reschedule_request_status, 'client'),
  'Proposta substituída',
  'display status maps SUPERSEDED'
);

select is(
  (
    select public._cns_reschedule_request_json(srr)->>'id'
    from public.service_reschedule_requests srr
    where srr.id = current_setting('test.rounds_contract.active_req_id')::uuid
  ),
  current_setting('test.rounds_contract.active_req_id'),
  'request JSON helper serializes request id'
);

select is(
  (
    select public._cns_reschedule_request_json(srr)->>'parent_request_id'
    from public.service_reschedule_requests srr
    where srr.id = current_setting('test.rounds_contract.active_req_id')::uuid
  ),
  null,
  'request JSON helper serializes null parent_request_id'
);

select is(
  public.cns_service_reschedule_active_request_id(
    current_setting('test.rounds_contract.active_service_id')::uuid
  )::text,
  current_setting('test.rounds_contract.active_req_id'),
  'active request id helper returns the active request'
);

select is(
  public.cns_service_reschedule_active_request_id(gen_random_uuid()),
  null,
  'active request id helper returns null when service has no requests'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_viewer(
      current_setting('test.rounds_contract.no_active_service_id')::uuid,
      current_setting('test.rounds_contract.no_active_client_id')::uuid
    )->>'can_client_request_reschedule'
  )::boolean,
  'viewer snapshot allows client request when no active request exists'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_viewer(
      current_setting('test.rounds_contract.no_active_service_id')::uuid,
      current_setting('test.rounds_contract.no_active_provider_id')::uuid
    )->>'can_provider_request_reschedule'
  )::boolean,
  'viewer snapshot allows provider request when no active request exists'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_request(
      current_setting('test.rounds_contract.proposed_req_id')::uuid,
      current_setting('test.rounds_contract.proposed_client_id')::uuid
    )->>'can_accept_reschedule'
  )::boolean,
  'request snapshot allows client to accept active proposed request'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_request(
      current_setting('test.rounds_contract.proposed_req_id')::uuid,
      current_setting('test.rounds_contract.proposed_client_id')::uuid
    )->>'can_request_adjustment'
  )::boolean,
  'request snapshot allows client to request adjustment on active proposed request'
);

select ok(
  (
    public.cns_service_reschedule_snapshot_for_request(
      current_setting('test.rounds_contract.active_req_id')::uuid,
      current_setting('test.rounds_contract.provider_id')::uuid
    )->>'can_propose_reschedule'
  )::boolean,
  'request snapshot allows provider to propose active requested reschedule'
);

select ok(
  (
    select (public._cns_reschedule_snapshot_action_flags(
      srr,
      cs,
      'provider',
      true,
      true
    )->>'can_cancel_reschedule')::boolean
    from public.service_reschedule_requests srr
    join public.contracted_services cs on cs.id = srr.contracted_service_id
    where srr.id = current_setting('test.rounds_contract.active_req_id')::uuid
  ),
  'action flags helper lets provider cancel requested active row'
);

select is(
  (
    public.cns_service_reschedule_snapshot_for_viewer(
      current_setting('test.rounds_contract.active_service_id')::uuid,
      current_setting('test.rounds_contract.client_id')::uuid
    )->'request'
  ),
  null,
  'viewer snapshot does not include historical request alias'
);

select ok(
  public.cns_service_reschedule_snapshot_for_request(
    current_setting('test.rounds_contract.active_req_id')::uuid,
    current_setting('test.rounds_contract.client_id')::uuid
  )->'request' is not null,
  'request snapshot includes request alias'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public._cns_reschedule_request_json(public.service_reschedule_requests)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public._cns_reschedule_request_json(public.service_reschedule_requests)',
    'EXECUTE'
  ),
  'request JSON helper is service_role only'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public._cns_reschedule_display_status(public.service_reschedule_request_status,public.service_reschedule_requested_by_role)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public._cns_reschedule_display_status(public.service_reschedule_request_status,public.service_reschedule_requested_by_role)',
    'EXECUTE'
  ),
  'display status helper is service_role only'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public._cns_reschedule_snapshot_action_flags(public.service_reschedule_requests,public.contracted_services,text,boolean,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public._cns_reschedule_snapshot_action_flags(public.service_reschedule_requests,public.contracted_services,text,boolean,boolean)',
    'EXECUTE'
  ),
  'action flags helper is service_role only'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public._cns_service_reschedule_snapshot_core(uuid,public.service_reschedule_requests,public.contracted_services,text,uuid,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public._cns_service_reschedule_snapshot_core(uuid,public.service_reschedule_requests,public.contracted_services,text,uuid,boolean)',
    'EXECUTE'
  ),
  'snapshot core helper is service_role only'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.cns_get_service_reschedule_request(uuid)',
    'EXECUTE'
  ),
  'authenticated can execute historical request snapshot RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.cns_get_active_service_reschedule_for_chat(uuid)',
    'EXECUTE'
  ),
  'authenticated can execute active chat reschedule RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.cns_propose_service_reschedule(uuid,jsonb,uuid)',
    'EXECUTE'
  ),
  'authenticated can execute propose reschedule RPC'
);

select is(
  (
    select p.provolatile::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = '_cns_reschedule_request_json'
  ),
  'i',
  'request JSON helper is immutable'
);

select is(
  (
    select p.provolatile::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = '_cns_service_reschedule_snapshot_core'
  ),
  'v',
  'snapshot core helper is volatile because CTA flags use now()'
);

select * from finish();

rollback;
