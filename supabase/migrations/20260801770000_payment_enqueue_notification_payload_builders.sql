-- Payment Task 126: structured MMD payload builders for payment_enqueue_notifications (design.md §1.7.9).

create or replace function public.payment_notification_deep_link_path(
  p_service_request_id uuid default null
)
returns text
language sql
immutable
as $$
  select case
    when p_service_request_id is not null
      then format('/dashboard/services/%s', p_service_request_id)
    else '/dashboard/services'
  end;
$$;

comment on function public.payment_notification_deep_link_path(uuid) is
  'Canonical deep_link_path for payment MMD templates; service detail route (manual payment inline).';

create or replace function public.payment_format_service_execution_summary(
  p_scheduled_start_date date,
  p_scheduled_shift text,
  p_service_execution_at timestamptz default null
)
returns text
language sql
immutable
as $$
  select coalesce(
    case
      when p_scheduled_start_date is not null then trim(both from concat(
        to_char(p_scheduled_start_date, 'DD/MM/YYYY'),
        case lower(coalesce(p_scheduled_shift, ''))
          when 'morning' then ', turno da manhã'
          when 'afternoon' then ', turno da tarde'
          when 'full_day' then ', dia inteiro'
          else ''
        end
      ))
      else null
    end,
    case
      when p_service_execution_at is not null then to_char(
        p_service_execution_at at time zone 'America/Sao_Paulo',
        'DD/MM/YYYY "às" HH24:MI'
      )
      else null
    end,
    'data a confirmar'
  );
$$;

comment on function public.payment_format_service_execution_summary(date, text, timestamptz) is
  'Human-readable service schedule summary for payment MMD templates (PT-BR).';

create or replace function public.payment_build_notification_bypass_flags(
  p_notification_event text,
  p_recipient text,
  p_urgent_provider boolean default false
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'bypass_priority', case upper(btrim(p_notification_event))
      when 'CHARGE_FAILED_PERMANENT' then true
      when 'SERVICE_AUTO_CANCELLED' then true
      when 'CHARGE_SUCCEEDED' then
        case lower(coalesce(p_recipient, 'client'))
          when 'client' then true
          when 'provider' then coalesce(p_urgent_provider, false)
          else false
        end
      when 'CHARGE_IN_ANALYSIS' then true
      when 'UPCOMING_CHARGE' then true
      else false
    end,
    'urgent_provider', coalesce(p_urgent_provider, false)
      and upper(btrim(p_notification_event)) = 'CHARGE_SUCCEEDED'
      and lower(coalesce(p_recipient, 'client')) = 'provider'
  );
$$;

comment on function public.payment_build_notification_bypass_flags(text, text, boolean) is
  'Bypass priority flags for payment notifications; urgent provider path when PAID within 24h of service execution.';

drop function if exists public.payment_build_notification_variables(
  public.payment_schedules,
  text,
  text,
  uuid,
  timestamptz,
  jsonb,
  text
);

create or replace function public.payment_build_notification_variables(
  p_schedule public.payment_schedules,
  p_notification_event text,
  p_recipient text,
  p_service_request_id uuid default null,
  p_service_execution_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb,
  p_service_request_title text default null,
  p_scheduled_start_date date default null,
  p_scheduled_shift text default null
)
returns jsonb
language sql
immutable
as $$
  with charge as (
    select case upper(btrim(p_notification_event))
      when 'UPCOMING_CHARGE' then coalesce(
        nullif(btrim(p_metadata->>'charge_amount'), '')::numeric,
        p_schedule.base_amount
      )
      else coalesce(
        nullif(btrim(p_metadata->>'charge_amount'), '')::numeric,
        nullif(btrim(p_metadata->>'chargedAmount'), '')::numeric,
        p_schedule.paid_amount,
        p_schedule.base_amount
      )
    end as amount
  )
  select jsonb_strip_nulls(
    jsonb_build_object(
      'schedule_id', p_schedule.id,
      'contracted_service_id', p_schedule.contracted_service_id,
      'client_id', p_schedule.client_id,
      'provider_id', p_schedule.provider_id,
      'service_request_title', coalesce(nullif(btrim(p_service_request_title), ''), 'Serviço'),
      'charge_scheduled_at', p_schedule.charge_scheduled_at,
      'service_execution_at', p_service_execution_at,
      'service_execution_formatted', public.payment_format_service_execution_summary(
        p_scheduled_start_date,
        p_scheduled_shift,
        p_service_execution_at
      ),
      'paid_amount', p_schedule.paid_amount,
      'charge_amount', charge.amount,
      'charge_amount_formatted', 'R$ ' || replace(
        to_char(charge.amount, 'FM999999990.00'),
        '.',
        ','
      ),
      'installment_number', p_schedule.installment_number,
      'remaining_retries', greatest(
        0,
        p_schedule.max_attempts - p_schedule.automatic_attempt_count
      ),
      'failure_code', p_schedule.failure_code,
      'failure_reason', p_schedule.failure_reason,
      'state', p_schedule.state,
      'deep_link_path', public.payment_notification_deep_link_path(p_service_request_id)
    ) || coalesce(p_metadata, '{}'::jsonb)
  )
  from charge;
$$;

comment on function public.payment_build_notification_variables(
  public.payment_schedules,
  text,
  text,
  uuid,
  timestamptz,
  jsonb,
  text,
  date,
  text
) is
  'Structured MMD template variables per payment notification event and recipient audience.';

create or replace function public.payment_build_notification_dispatch_metadata(
  p_notification_event text,
  p_recipient text,
  p_urgent_provider boolean default false,
  p_extra_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'source', 'payment_enqueue_notifications',
    'recipient', lower(coalesce(p_recipient, 'client'))
  )
  || public.payment_build_notification_bypass_flags(
    p_notification_event,
    p_recipient,
    p_urgent_provider
  )
  || coalesce(p_extra_metadata, '{}'::jsonb);
$$;

comment on function public.payment_build_notification_dispatch_metadata(text, text, boolean, jsonb) is
  'MMD ingest metadata for payment notifications including bypass priority flags.';

create or replace function public.payment_enqueue_notifications(
  p_schedule_id uuid,
  p_notification_event text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, message_dispatcher
as $$
declare
  v_schedule public.payment_schedules%rowtype;
  v_service public.contracted_services%rowtype;
  v_service_request_title text;
  v_event text;
  v_dispatches jsonb := '[]'::jsonb;
  v_result jsonb;
  v_client_variables jsonb;
  v_provider_variables jsonb;
  v_urgent_provider boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required for payment_enqueue_notifications'
      using errcode = '42501';
  end if;

  if p_schedule_id is null or p_notification_event is null or trim(p_notification_event) = '' then
    raise exception 'p_schedule_id and p_notification_event are required'
      using errcode = '22023';
  end if;

  select ps.*
  into v_schedule
  from public.payment_schedules ps
  where ps.id = p_schedule_id;

  if not found then
    raise exception 'SCHEDULE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select cs.*
  into v_service
  from public.contracted_services cs
  where cs.id = v_schedule.contracted_service_id;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select coalesce(nullif(trim(sr.title), ''), 'Serviço')
  into v_service_request_title
  from public.service_requests sr
  where sr.id = v_service.service_request_id;

  v_event := upper(trim(p_notification_event));

  if v_event not in (
    'CHARGE_SUCCEEDED',
    'CHARGE_FAILED',
    'CHARGE_FAILED_PERMANENT',
    'CHARGE_IN_ANALYSIS',
    'UPCOMING_CHARGE',
    'SERVICE_AUTO_CANCELLED'
  ) then
    raise exception 'UNSUPPORTED_NOTIFICATION_EVENT'
      using errcode = '22023';
  end if;

  if v_event = 'CHARGE_SUCCEEDED' then
    v_urgent_provider := coalesce(v_service.service_execution_at, now()) - now()
      < interval '24 hours';
  end if;

  v_client_variables := public.payment_build_notification_variables(
    v_schedule,
    v_event,
    'client',
    v_service.service_request_id,
    v_service.service_execution_at,
    p_metadata,
    v_service_request_title,
    v_service.scheduled_start_date,
    v_service.scheduled_shift
  );

  v_result := public.mmd_ingest_event(
    v_event,
    v_schedule.client_id,
    format('payment:%s:%s:client', v_schedule.id, lower(v_event)),
    v_client_variables,
    public.payment_build_notification_dispatch_metadata(
      v_event,
      'client',
      false,
      p_metadata
    )
  );
  v_dispatches := v_dispatches || jsonb_build_array(v_result);

  if v_event in ('CHARGE_SUCCEEDED', 'CHARGE_FAILED_PERMANENT', 'SERVICE_AUTO_CANCELLED') then
    v_provider_variables := public.payment_build_notification_variables(
      v_schedule,
      v_event,
      'provider',
      v_service.service_request_id,
      v_service.service_execution_at,
      p_metadata,
      v_service_request_title,
      v_service.scheduled_start_date,
      v_service.scheduled_shift
    );

    v_result := public.mmd_ingest_event(
      v_event,
      v_schedule.provider_id,
      format('payment:%s:%s:provider', v_schedule.id, lower(v_event)),
      v_provider_variables,
      public.payment_build_notification_dispatch_metadata(
        v_event,
        'provider',
        v_urgent_provider,
        p_metadata
      )
    );
    v_dispatches := v_dispatches || jsonb_build_array(v_result);
  end if;

  return jsonb_build_object(
    'notification_event', v_event,
    'schedule_id', v_schedule.id,
    'urgent_provider', v_urgent_provider,
    'dispatches', v_dispatches
  );
end;
$$;

comment on function public.payment_enqueue_notifications(uuid, text, jsonb) is
  'Post-commit MMD enqueue for payment notification matrix; uses structured payload builders (Task 126).';

revoke all on function public.payment_format_service_execution_summary(date, text, timestamptz) from public;
revoke all on function public.payment_notification_deep_link_path(uuid) from public;
revoke all on function public.payment_build_notification_bypass_flags(text, text, boolean) from public;
revoke all on function public.payment_build_notification_variables(
  public.payment_schedules,
  text,
  text,
  uuid,
  timestamptz,
  jsonb,
  text,
  date,
  text
) from public;
revoke all on function public.payment_build_notification_dispatch_metadata(text, text, boolean, jsonb) from public;

revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from public;
revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from anon;
revoke all on function public.payment_enqueue_notifications(uuid, text, jsonb) from authenticated;

grant execute on function public.payment_enqueue_notifications(uuid, text, jsonb) to service_role;
