-- Revoke client EXECUTE on internal helpers; bind viewer/user ids to auth.uid() when present.
-- Callers remain SECURITY DEFINER wrappers (owner postgres) or service_role.

-- ---------------------------------------------------------------------------
-- 1) cns_service_reschedule_snapshot_for_request — bind viewer + revoke client
-- ---------------------------------------------------------------------------

create or replace function public.cns_service_reschedule_snapshot_for_request(
  p_reschedule_request_id uuid,
  p_viewer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_viewer uuid;
  v_req public.service_reschedule_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_role text;
  v_active_id uuid;
begin
  -- Bind viewer for authenticated clients; service_role / owner keep p_viewer_id.
  if coalesce(auth.role(), '') = 'authenticated' then
    v_viewer := auth.uid();
  else
    v_viewer := p_viewer_id;
  end if;

  select pr.role
  into v_role
  from public.profiles pr
  where pr.id = v_viewer;

  select srr.*
  into v_req
  from public.service_reschedule_requests srr
  where srr.id = p_reschedule_request_id;

  if not found or v_role is null then
    return null;
  end if;

  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = v_req.contracted_service_id;

  if not found
    or (v_viewer <> v_cs.client_id and v_viewer <> v_cs.provider_id)
  then
    return null;
  end if;

  v_active_id := public.cns_service_reschedule_active_request_id(v_req.contracted_service_id);

  return public._cns_service_reschedule_snapshot_core(
    v_req.contracted_service_id,
    v_req,
    v_cs,
    v_role,
    v_active_id,
    true
  );
end;
$function$;

comment on function public.cns_service_reschedule_snapshot_for_request(uuid, uuid) is
  'Internal reschedule request snapshot; viewer bound to auth.uid() when auth.role()=authenticated. Not client-callable.';

revoke all on function public.cns_service_reschedule_snapshot_for_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cns_service_reschedule_snapshot_for_request(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) cns_chat_is_unread_for_user — bind user + revoke client
-- ---------------------------------------------------------------------------

create or replace function public.cns_chat_is_unread_for_user(
  p_chat_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  with bound as (
    -- Bind user for authenticated clients; service_role / owner keep p_user_id.
    select case
      when coalesce(auth.role(), '') = 'authenticated' then auth.uid()
      else p_user_id
    end as user_id
  )
  select coalesce(
    exists (
      select 1
      from public.chat_messages inbound
      cross join bound b
      left join public.chat_read_receipts rr
        on rr.chat_id = p_chat_id
        and rr.user_id = b.user_id
      left join public.chat_messages read_anchor
        on read_anchor.id = rr.last_read_message_id
      where inbound.chat_id = p_chat_id
        and inbound.sender_user_id is distinct from b.user_id
        and (
          rr.chat_id is null
          or (
            rr.last_read_message_id is not null
            and read_anchor.id is not null
            and (inbound.created_at, inbound.id) > (read_anchor.created_at, read_anchor.id)
          )
          or (
            rr.last_read_message_id is null
            and (rr.last_read_at is null or inbound.created_at > rr.last_read_at)
          )
        )
    ),
    false
  );
$function$;

comment on function public.cns_chat_is_unread_for_user(uuid, uuid) is
  'Internal unread helper; user bound to auth.uid() when auth.role()=authenticated. Not client-callable.';

revoke all on function public.cns_chat_is_unread_for_user(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cns_chat_is_unread_for_user(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) resolve_proposal_chat_id — SQL-internal only
-- ---------------------------------------------------------------------------

revoke all on function public.resolve_proposal_chat_id(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_proposal_chat_id(uuid, uuid)
  to service_role;

comment on function public.resolve_proposal_chat_id(uuid, uuid) is
  'Internal chat lookup by service_request + provider. Not client-callable.';

-- ---------------------------------------------------------------------------
-- 4–5) payment KYC storage helpers
-- ---------------------------------------------------------------------------

revoke all on function public.payment_provider_kyc_storage_path_valid(uuid, text)
  from public, anon, authenticated;
grant execute on function public.payment_provider_kyc_storage_path_valid(uuid, text)
  to service_role;

comment on function public.payment_provider_kyc_storage_path_valid(uuid, text) is
  'Internal KYC storage path validator. Not client-callable.';

revoke all on function public.payment_assert_provider_kyc_storage_path(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.payment_assert_provider_kyc_storage_path(uuid, text, text)
  to service_role;

comment on function public.payment_assert_provider_kyc_storage_path(uuid, text, text) is
  'Internal KYC storage path assert. Not client-callable.';

-- ---------------------------------------------------------------------------
-- 6) payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])
-- ---------------------------------------------------------------------------

revoke all on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[])
  to service_role;

comment on function public.payment_link_provider_kyc_upload_sessions_by_paths(uuid, text[]) is
  'Internal KYC upload session linker for payment_submit_provider_kyc. Not client-callable.';

-- ---------------------------------------------------------------------------
-- 7) cns_service_reschedule_active_request_id — no client authz
-- ---------------------------------------------------------------------------

revoke all on function public.cns_service_reschedule_active_request_id(uuid)
  from public, anon, authenticated;
grant execute on function public.cns_service_reschedule_active_request_id(uuid)
  to service_role;

comment on function public.cns_service_reschedule_active_request_id(uuid) is
  'Internal active reschedule request id lookup. Not client-callable.';

-- ---------------------------------------------------------------------------
-- 8) payment_calculate_charge_amount — body already requires service_role
-- ---------------------------------------------------------------------------

revoke all on function public.payment_calculate_charge_amount(uuid, numeric, smallint)
  from public, anon, authenticated;
grant execute on function public.payment_calculate_charge_amount(uuid, numeric, smallint)
  to service_role;

comment on function public.payment_calculate_charge_amount(uuid, numeric, smallint) is
  'Service-role charge amount calculator (card fees). Not client-callable.';
