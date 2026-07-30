-- CNS Wave A — task 10: chats.* platform_constants seeds + platform_constant_int (design §3.12).

insert into public.platform_constants (key, value, description)
values
  (
    'chats.max_active_slots_per_service_request',
    '4'::jsonb,
    'Max ACTIVE conversations per service request (admission counter gate).'
  ),
  (
    'chats.reciprocity_window_hours',
    '24'::jsonb,
    'Bilateral message window before INACTIVE (reciprocity job).'
  ),
  (
    'chats.proposal_response_sla_hours',
    '24'::jsonb,
    'Client inaction SLA for PENDING proposals.'
  ),
  (
    'chats.max_active_slots_upper_bound',
    '50'::jsonb,
    'Clamp ceiling when reading numeric chats.* constants via platform_constant_int.'
  ),
  (
    'chats.message_rate_limit_per_minute',
    '30'::jsonb,
    'Anti-spam: max messages per user per conversation per minute.'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

create or replace function public.platform_constant_int(p_key text, p_default int)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw jsonb;
  v_parsed int;
  -- Generous ceiling for non-chats keys (matching/payment batches, TTLs, etc.).
  v_upper_bound int := 1000000;
  v_upper_raw jsonb;
begin
  -- chats.max_active_slots_upper_bound applies only to chats.* keys.
  if p_key like 'chats.%' then
    v_upper_bound := 50;
    select pc.value
    into v_upper_raw
    from public.platform_constants pc
    where pc.key = 'chats.max_active_slots_upper_bound';

    if v_upper_raw is not null then
      begin
        v_upper_bound := greatest((v_upper_raw #>> '{}')::int, 1);
      exception
        when others then
          v_upper_bound := 50;
      end;
    end if;
  end if;

  select pc.value
  into v_raw
  from public.platform_constants pc
  where pc.key = p_key;

  if v_raw is null then
    raise warning 'INVALID_PLATFORM_CONSTANT_FALLBACK key=% reason=missing using_default=%',
      p_key, p_default;
    return p_default;
  end if;

  begin
    v_parsed := (v_raw #>> '{}')::int;
  exception
    when others then
      raise warning 'INVALID_PLATFORM_CONSTANT_FALLBACK key=% reason=not_numeric using_default=%',
        p_key, p_default;
      return p_default;
  end;

  if v_parsed < 1 then
    raise warning 'INVALID_PLATFORM_CONSTANT_FALLBACK key=% reason=below_min value=% using_default=%',
      p_key, v_parsed, p_default;
    return p_default;
  end if;

  if v_parsed > v_upper_bound then
    raise warning 'INVALID_PLATFORM_CONSTANT_FALLBACK key=% reason=above_upper_bound value=% clamped_to=%',
      p_key, v_parsed, v_upper_bound;
    return v_upper_bound;
  end if;

  return v_parsed;
end;
$$;

comment on function public.platform_constant_int(text, int) is
  'Reads platform_constants as int: min 1; chats.* capped by chats.max_active_slots_upper_bound; other keys capped at 1e6; fallback p_default with WARNING.';

revoke all on function public.platform_constant_int(text, int) from public, anon, authenticated;
grant execute on function public.platform_constant_int(text, int) to service_role;
