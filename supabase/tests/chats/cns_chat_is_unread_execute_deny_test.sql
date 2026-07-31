-- pgTAP: authenticated cannot EXECUTE cns_chat_is_unread_for_user (helpers inlined; no \ir).

begin;

select plan(5);

create or replace function pg_temp.unread_deny_set_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', p_user_id::text)::text,
    true
  );
end;
$$;

create or replace function pg_temp.cns_seed_chat(
  p_service_request_id uuid,
  p_client_id uuid,
  p_provider_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_chat_id uuid;
begin
  insert into public.chats (
    service_request_id,
    client_id,
    provider_id,
    status,
    last_interaction_at
  )
  values (
    p_service_request_id,
    p_client_id,
    p_provider_id,
    'ACTIVE'::public.cns_conversation_status,
    now()
  )
  on conflict (service_request_id, provider_id) do update
    set updated_at = now()
  returning id into v_chat_id;
  return v_chat_id;
end;
$$;

select set_config(
  'test.unread_deny.chat_id',
  pg_temp.cns_seed_chat(
    '7017e457-5a32-44e7-b8da-1727a14f4d33'::uuid,
    '28e30f1d-3c47-441f-94c6-76b6ea0db470'::uuid,
    '5d09e025-20a2-4842-aeef-324d42a431e1'::uuid
  )::text,
  true
);
select set_config(
  'test.unread_deny.client_id',
  '28e30f1d-3c47-441f-94c6-76b6ea0db470',
  true
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.cns_chat_is_unread_for_user(uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot EXECUTE cns_chat_is_unread_for_user'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.cns_chat_is_unread_for_user(uuid, uuid)',
    'EXECUTE'
  ),
  'anon cannot EXECUTE cns_chat_is_unread_for_user'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.cns_chat_is_unread_for_user(uuid, uuid)',
    'EXECUTE'
  ),
  'service_role can EXECUTE cns_chat_is_unread_for_user'
);

select pg_temp.unread_deny_set_auth(current_setting('test.unread_deny.client_id')::uuid);

select throws_ok(
  format(
    $sql$
      select public.cns_chat_is_unread_for_user(
        %L::uuid,
        %L::uuid
      )
    $sql$,
    current_setting('test.unread_deny.chat_id'),
    current_setting('test.unread_deny.client_id')
  ),
  '42501',
  null,
  'direct call as authenticated raises privilege denied'
);

-- Wrapper still works (DEFINER list_conversations uses unread helper internally).
select lives_ok(
  $sql$
    select public.list_conversations(
      p_page_size := 5,
      p_cursor_last_interaction_at := null,
      p_cursor_id := null,
      p_service_request_id := null
    )
  $sql$,
  'list_conversations still works for authenticated client'
);

select * from finish();

rollback;
