-- CNS Wave C — task 60: conversation header + masked SR detail RPC (design §4.15; Req. 5, 18).
-- Depends on chats (task 2), service_requests CNS enum (task 13).

create or replace function public.get_conversation_detail(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_detail jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required for get_conversation_detail'
      using errcode = '42501';
  end if;

  if p_chat_id is null then
    raise exception 'p_chat_id is required'
      using errcode = '22023';
  end if;

  select jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', c.id,
      'service_request_id', c.service_request_id,
      'client_id', c.client_id,
      'provider_id', c.provider_id,
      'status', c.status,
      'last_interaction_at', c.last_interaction_at,
      'activated_at', c.activated_at,
      'inactivated_at', c.inactivated_at,
      'inactivation_reason', c.inactivation_reason,
      'closed_at', c.closed_at,
      'closure_type', c.closure_type,
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ),
    'counterparty', jsonb_build_object(
      'id', cp.id,
      'full_name', cp.full_name,
      'profile_image_path', cp.profile_image_path,
      'role', cp.role
    ),
    'service_request', jsonb_build_object(
      'id', sr.id,
      'title', sr.title,
      'description', sr.description,
      'photos', coalesce(to_jsonb(sr.photos), '[]'::jsonb),
      'urgency', sr.urgency,
      'status', sr.status,
      'scope_complexity', sr.scope_complexity,
      'estimated_duration_hint', sr.estimated_duration_hint,
      'created_at', sr.created_at
    ),
    'service', jsonb_build_object(
      'id', ps.id,
      'title', ps.title,
      'slug', ps.slug,
      'icon_key', ps.icon_key,
      'color_key', ps.color_key,
      'image_url', ps.image_url
    ),
    'category', case
      when parent_ps.id is null then null
      else jsonb_build_object(
        'id', parent_ps.id,
        'title', parent_ps.title,
        'slug', parent_ps.slug,
        'icon_key', parent_ps.icon_key,
        'color_key', parent_ps.color_key
      )
    end,
    'address', jsonb_build_object(
      'neighborhood', ca.neighborhood,
      'city', pc.name,
      'state', pst.abbreviation
    ),
    'counterparty_read_receipt', case
      when crr.chat_id is not null then jsonb_build_object(
        'last_read_at', crr.last_read_at,
        'last_read_message_id', crr.last_read_message_id
      )
      else null
    end
  )
  into v_detail
  from public.chats c
  inner join public.service_requests sr on sr.id = c.service_request_id
  inner join public.platform_services ps on ps.id = sr.service_id
  left join public.platform_services parent_ps on parent_ps.id = ps.parent_id
  left join public.client_addresses ca on ca.id = sr.address_id
  left join public.platform_cities pc on pc.id = ca.city_id
  left join public.platform_states pst on pst.id = ca.state_id
  inner join public.profiles cp on cp.id = case
    when v_actor = c.client_id then c.provider_id
    else c.client_id
  end
  left join public.chat_read_receipts crr
    on crr.chat_id = c.id
    and crr.user_id = cp.id
  where c.id = p_chat_id
    and v_actor in (c.client_id, c.provider_id);

  if v_detail is null then
    raise exception 'CONVERSATION_NOT_FOUND'
      using
        errcode = 'P0001',
        detail = jsonb_build_object('code', 'CONVERSATION_NOT_FOUND')::text;
  end if;

  return v_detail;
end;
$$;

comment on function public.get_conversation_detail(uuid) is
  'Participant header snapshot: counterparty, masked address (city/neighborhood), service/category, SR photos (R5-AC02).';

revoke all on function public.get_conversation_detail(uuid) from public;
revoke all on function public.get_conversation_detail(uuid) from anon;
grant execute on function public.get_conversation_detail(uuid) to authenticated;
