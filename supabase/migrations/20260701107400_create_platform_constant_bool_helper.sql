-- CNS task 112: platform_constant_bool helper (discovery welcome is UI-only in ChatTimeline).

create or replace function public.platform_constant_bool(p_key text, p_default boolean)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw jsonb;
  v_text text;
begin
  select pc.value
  into v_raw
  from public.platform_constants pc
  where pc.key = p_key;

  if v_raw is null then
    raise warning 'INVALID_PLATFORM_CONSTANT_BOOL_FALLBACK key=% using_default=%', p_key, p_default;
    return p_default;
  end if;

  if jsonb_typeof(v_raw) = 'boolean' then
    return (v_raw #>> '{}')::boolean;
  end if;

  v_text := lower(trim(both '"' from v_raw #>> '{}'));

  if v_text in ('true', 't', '1', 'yes', 'on') then
    return true;
  end if;

  if v_text in ('false', 'f', '0', 'no', 'off') then
    return false;
  end if;

  raise warning 'INVALID_PLATFORM_CONSTANT_BOOL_FALLBACK key=% reason=not_boolean using_default=%', p_key, p_default;
  return p_default;
end;
$$;

comment on function public.platform_constant_bool(text, boolean) is
  'Reads platform_constants as boolean with string/boolean jsonb support and WARNING fallback.';

grant execute on function public.platform_constant_bool(text, boolean) to service_role, authenticated;
