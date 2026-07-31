-- Lock down message_dispatcher_disable_device_beacon to service_role only.
--
-- Previously SECURITY DEFINER with EXECUTE for PUBLIC, so any authenticated/anon
-- client could clear another user's FCM token. Restrict body + grants.
-- Nested caller message_dispatcher_report_delivery_outcome remains DEFINER and is
-- invoked on the service_role path (Edge worker); bare privileged sessions without
-- JWT (pgTAP/postgres) are allowed so that path keeps working in local tests.

create or replace function message_dispatcher.message_dispatcher_disable_device_beacon(
  p_profile_id uuid,
  p_device_id text
)
returns void
language plpgsql
security definer
set search_path = message_dispatcher, public, auth
as $$
declare
  v_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    )
  );
begin
  if p_profile_id is null or nullif(trim(p_device_id), '') is null then
    return;
  end if;

  -- Deny when a client JWT/role is present and is not service_role.
  -- Null role (no JWT) allows privileged DB sessions and nested DEFINER callers.
  if v_role is not null and v_role is distinct from 'service_role' then
    raise exception 'service_role required for message_dispatcher_disable_device_beacon'
      using errcode = '42501';
  end if;

  update public.user_device_beacons b
  set
    push_enabled = false,
    fcm_token = null,
    updated_at = now()
  where b.profile_id = p_profile_id
    and b.device_id = trim(p_device_id);
end;
$$;

comment on function message_dispatcher.message_dispatcher_disable_device_beacon(uuid, text) is
  'Clears invalid FCM registration for a device (design §11.7). service_role only.';

revoke all on function message_dispatcher.message_dispatcher_disable_device_beacon(uuid, text)
  from public, anon, authenticated;

grant execute on function message_dispatcher.message_dispatcher_disable_device_beacon(uuid, text)
  to service_role;
