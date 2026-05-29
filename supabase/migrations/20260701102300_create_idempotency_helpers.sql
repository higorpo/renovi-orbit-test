-- CNS Wave B — task 24: rpc_idempotency_records helpers (design §3.10, Req. 14).
-- Migration order: runs AFTER tasks 14–21 and task 23 (20260701102200). See docs/chats/tasks.md §Migration file order.

create or replace function public.idempotency_begin(
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_record public.rpc_idempotency_records%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required for idempotency_begin'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_operation), '') is null then
    raise exception 'p_operation is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  select *
  into v_record
  from public.rpc_idempotency_records r
  where r.actor_user_id = v_actor
    and r.operation = btrim(p_operation)
    and r.idempotency_key = p_idempotency_key;

  if not found then
    return null;
  end if;

  if p_request_hash is not null
    and v_record.request_hash is not null
    and v_record.request_hash is distinct from p_request_hash then
    raise exception 'IDEMPOTENCY_CONFLICT'
      using
        errcode = 'P0001',
        detail = jsonb_build_object(
          'code', 'IDEMPOTENCY_CONFLICT',
          'operation', p_operation,
          'idempotency_key', p_idempotency_key
        )::text;
  end if;

  raise log 'cns_idempotency_hit operation=% idempotency_key=% actor_user_id=%',
    p_operation,
    p_idempotency_key,
    v_actor;

  return jsonb_build_object(
    'hit', true,
    'response_status', v_record.response_status,
    'response_body', v_record.response_body
  );
end;
$$;

create or replace function public.idempotency_commit(
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_response_status int,
  p_response_body jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required for idempotency_commit'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_operation), '') is null then
    raise exception 'p_operation is required'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'p_idempotency_key is required'
      using errcode = '22023';
  end if;

  if p_response_status is null then
    raise exception 'p_response_status is required'
      using errcode = '22023';
  end if;

  if p_response_body is null then
    raise exception 'p_response_body is required'
      using errcode = '22023';
  end if;

  insert into public.rpc_idempotency_records (
    actor_user_id,
    operation,
    idempotency_key,
    request_hash,
    response_status,
    response_body
  )
  values (
    v_actor,
    btrim(p_operation),
    p_idempotency_key,
    p_request_hash,
    p_response_status,
    p_response_body
  );
end;
$$;

comment on function public.idempotency_begin(text, uuid, text) is
  'Returns cached RPC response jsonb on replay (hit=true) or null to proceed. Rejects mismatched request_hash.';

comment on function public.idempotency_commit(text, uuid, text, int, jsonb) is
  'Persists successful mutation RPC response for PostgREST timeout replay (R27-AC03).';

revoke all on function public.idempotency_begin(text, uuid, text) from public;
revoke all on function public.idempotency_begin(text, uuid, text) from authenticated;
revoke all on function public.idempotency_begin(text, uuid, text) from anon;

revoke all on function public.idempotency_commit(text, uuid, text, int, jsonb) from public;
revoke all on function public.idempotency_commit(text, uuid, text, int, jsonb) from authenticated;
revoke all on function public.idempotency_commit(text, uuid, text, int, jsonb) from anon;

grant execute on function public.idempotency_begin(text, uuid, text) to service_role;
grant execute on function public.idempotency_commit(text, uuid, text, int, jsonb) to service_role;
