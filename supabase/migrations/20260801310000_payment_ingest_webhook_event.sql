-- Payment Task 33: payment_ingest_webhook_event RPC (design.md §4.7.1, Req 16 AC1).
-- HMAC-validated events persist as RECEIVED; unsigned quarantine as DEAD_LETTER (non-retryable).

create or replace function public.payment_sanitize_webhook_headers(p_headers jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_object_agg(allowed.key, p_headers -> allowed.key)
      from (
        select key
        from jsonb_object_keys(p_headers) as key
        where lower(btrim(key)) in (
          'content-type',
          'x-netcred-signature',
          'x-netcred-event'
        )
      ) as allowed
    ),
    '{}'::jsonb
  );
$$;

comment on function public.payment_sanitize_webhook_headers(jsonb) is
  'Allowlists webhook header keys persisted at ingest; strips Authorization and other sensitive headers.';

create or replace function public.payment_webhook_events_preserve_raw_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.raw_payload is distinct from old.raw_payload then
    raise exception 'WEBHOOK_RAW_PAYLOAD_IMMUTABLE'
      using errcode = 'P0001';
  end if;

  if new.raw_headers is distinct from old.raw_headers then
    raise exception 'WEBHOOK_RAW_HEADERS_IMMUTABLE'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.payment_webhook_events_preserve_raw_immutable() is
  'Blocks mutation of raw_payload/raw_headers after webhook ingestion.';

drop trigger if exists payment_webhook_events_preserve_raw_immutable
  on public.payment_webhook_events;

create trigger payment_webhook_events_preserve_raw_immutable
  before update of raw_payload, raw_headers on public.payment_webhook_events
  for each row
  execute procedure public.payment_webhook_events_preserve_raw_immutable();

comment on column public.payment_webhook_events.raw_payload is
  'Immutable after INSERT — audit integrity; never modified post-commit.';

comment on column public.payment_webhook_events.raw_headers is
  'Immutable after INSERT — allowlisted keys only; never modified post-commit.';

drop function if exists public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb
);

create or replace function public.payment_ingest_webhook_event(
  p_gateway_slug public.payment_gateway_slug,
  p_event_type text,
  p_gateway_event_id text,
  p_raw_payload jsonb,
  p_raw_headers jsonb,
  p_signature_validated boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type text;
  v_gateway_event_id text;
  v_event_id uuid;
  v_state public.payment_webhook_event_state;
  v_is_duplicate boolean;
  v_sanitized_headers jsonb;
  v_signature_validated boolean := coalesce(p_signature_validated, false);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_ingest_webhook_event'
      using errcode = '42501';
  end if;

  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'p_event_type is required'
      using errcode = '22023';
  end if;

  if p_gateway_event_id is null or btrim(p_gateway_event_id) = '' then
    raise exception 'p_gateway_event_id is required'
      using errcode = '22023';
  end if;

  if p_raw_payload is null or jsonb_typeof(p_raw_payload) <> 'object' then
    raise exception 'p_raw_payload must be a JSON object'
      using errcode = '22023';
  end if;

  if p_raw_headers is null or jsonb_typeof(p_raw_headers) <> 'object' then
    raise exception 'p_raw_headers must be a JSON object'
      using errcode = '22023';
  end if;

  v_event_type := btrim(p_event_type);
  v_gateway_event_id := btrim(p_gateway_event_id);
  v_sanitized_headers := public.payment_sanitize_webhook_headers(p_raw_headers);

  -- Unsigned quarantine: audit only; does not occupy validated dedup UNIQUE.
  if not v_signature_validated then
    insert into public.payment_webhook_events (
      gateway_slug,
      event_type,
      gateway_event_id,
      raw_payload,
      raw_headers,
      state,
      failure_reason,
      signature_validated
    )
    values (
      p_gateway_slug,
      v_event_type,
      v_gateway_event_id,
      p_raw_payload,
      v_sanitized_headers,
      'DEAD_LETTER'::public.payment_webhook_event_state,
      'INVALID_SIGNATURE',
      false
    )
    returning id, state, is_duplicate
    into v_event_id, v_state, v_is_duplicate;

    return jsonb_build_object(
      'status', 'quarantined',
      'event_id', v_event_id,
      'gateway_slug', p_gateway_slug,
      'event_type', v_event_type,
      'gateway_event_id', v_gateway_event_id,
      'state', v_state,
      'is_duplicate', false,
      'signature_validated', false
    );
  end if;

  insert into public.payment_webhook_events (
    gateway_slug,
    event_type,
    gateway_event_id,
    raw_payload,
    raw_headers,
    state,
    signature_validated
  )
  values (
    p_gateway_slug,
    v_event_type,
    v_gateway_event_id,
    p_raw_payload,
    v_sanitized_headers,
    'RECEIVED'::public.payment_webhook_event_state,
    true
  )
  on conflict (gateway_slug, event_type, gateway_event_id) where (signature_validated) do update
  set
    is_duplicate = true,
    state = case
      when payment_webhook_events.state in (
        'PROCESSED'::public.payment_webhook_event_state,
        'DEAD_LETTER'::public.payment_webhook_event_state
      ) then payment_webhook_events.state
      else 'DUPLICATE'::public.payment_webhook_event_state
    end,
    updated_at = now()
  returning id, state, is_duplicate
  into v_event_id, v_state, v_is_duplicate;

  if v_is_duplicate then
    return jsonb_build_object(
      'status', 'duplicate',
      'event_id', v_event_id,
      'gateway_slug', p_gateway_slug,
      'event_type', v_event_type,
      'gateway_event_id', v_gateway_event_id,
      'state', v_state,
      'is_duplicate', true,
      'signature_validated', true
    );
  end if;

  return jsonb_build_object(
    'status', 'inserted',
    'event_id', v_event_id,
    'gateway_slug', p_gateway_slug,
    'event_type', v_event_type,
    'gateway_event_id', v_gateway_event_id,
    'state', v_state,
    'is_duplicate', false,
    'signature_validated', true
  );
end;
$$;

comment on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) is
  'Persists NetCred webhooks: validated→RECEIVED (dedup UNIQUE); unsigned→DEAD_LETTER quarantine (service_role only).';

revoke all on function public.payment_sanitize_webhook_headers(jsonb) from public;
revoke all on function public.payment_sanitize_webhook_headers(jsonb) from anon;
revoke all on function public.payment_sanitize_webhook_headers(jsonb) from authenticated;

revoke all on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) from public;
revoke all on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) from anon;
revoke all on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) from authenticated;

grant execute on function public.payment_ingest_webhook_event(
  public.payment_gateway_slug, text, text, jsonb, jsonb, boolean
) to service_role;
