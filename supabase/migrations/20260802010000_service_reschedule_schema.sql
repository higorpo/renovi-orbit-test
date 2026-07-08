-- Service reschedule: schema foundation (request FSM parallel to contracted_services).

create type public.service_reschedule_request_status as enum (
  'REQUESTED',
  'PROPOSED',
  'ADJUSTMENT_REQUESTED',
  'ACCEPTED',
  'CANCELLED',
  'EXPIRED'
);

comment on type public.service_reschedule_request_status is
  'FSM for formal service reschedule negotiation; official slot changes only on ACCEPTED.';

create type public.service_reschedule_requested_by_role as enum (
  'client',
  'provider'
);

comment on type public.service_reschedule_requested_by_role is
  'Who opened the reschedule request.';

create table public.service_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  contracted_service_id uuid not null references public.contracted_services (id) on delete restrict,
  chat_id uuid not null references public.chats (id) on delete restrict,
  status public.service_reschedule_request_status not null default 'REQUESTED',
  requested_by_role public.service_reschedule_requested_by_role not null,
  requested_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  request_note text,
  original_slot jsonb not null,
  original_service_execution_at timestamptz not null,
  proposed_slot jsonb,
  proposed_at timestamptz,
  accepted_at timestamptz,
  adjustment_count int not null default 0,
  is_last_minute boolean not null default false,
  last_reminder_at timestamptz,
  reminder_count int not null default 0,
  urgent_reminder_sent_at timestamptz,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_reschedule_requests_request_note_len
    check (request_note is null or char_length(btrim(request_note)) <= 500),
  constraint service_reschedule_requests_original_slot_object
    check (jsonb_typeof(original_slot) = 'object'),
  constraint service_reschedule_requests_proposed_slot_object
    check (proposed_slot is null or jsonb_typeof(proposed_slot) = 'object'),
  constraint service_reschedule_requests_adjustment_count_nonneg
    check (adjustment_count >= 0),
  constraint service_reschedule_requests_reminder_count_nonneg
    check (reminder_count >= 0),
  constraint service_reschedule_requests_proposed_invariant
    check (
      status <> 'PROPOSED'::public.service_reschedule_request_status
      or (proposed_slot is not null and proposed_at is not null)
    ),
  constraint service_reschedule_requests_accepted_invariant
    check (
      status <> 'ACCEPTED'::public.service_reschedule_request_status
      or (proposed_slot is not null and accepted_at is not null)
    ),
  constraint service_reschedule_requests_requested_clean
    check (
      status <> 'REQUESTED'::public.service_reschedule_request_status
      or (proposed_slot is null and proposed_at is null and accepted_at is null)
    )
);

comment on table public.service_reschedule_requests is
  'Formal reschedule negotiation; contracted_services slot updates only on ACCEPTED.';

create unique index service_reschedule_requests_one_active_per_service_idx
  on public.service_reschedule_requests (contracted_service_id)
  where status in (
    'REQUESTED'::public.service_reschedule_request_status,
    'PROPOSED'::public.service_reschedule_request_status,
    'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
  );

create index service_reschedule_requests_active_created_idx
  on public.service_reschedule_requests (created_at)
  where status in (
    'REQUESTED'::public.service_reschedule_request_status,
    'PROPOSED'::public.service_reschedule_request_status,
    'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
  );

create index service_reschedule_requests_contracted_service_created_idx
  on public.service_reschedule_requests (contracted_service_id, created_at desc);

create trigger service_reschedule_requests_updated_at
  before update on public.service_reschedule_requests
  for each row execute procedure public.set_updated_at();

create or replace function public.trg_service_reschedule_requests_chat_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.contracted_services cs
    join public.chats c on c.id = new.chat_id
    where cs.id = new.contracted_service_id
      and c.service_request_id = cs.service_request_id
      and c.provider_id = cs.provider_id
      and c.client_id = cs.client_id
  ) then
    raise exception 'CHAT_CONTRACTED_SERVICE_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger service_reschedule_requests_chat_consistency
  before insert or update of chat_id, contracted_service_id
  on public.service_reschedule_requests
  for each row execute procedure public.trg_service_reschedule_requests_chat_consistency();

create or replace function public.trg_service_reschedule_requests_requester_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cs public.contracted_services%rowtype;
begin
  select cs.*
  into v_cs
  from public.contracted_services cs
  where cs.id = new.contracted_service_id;

  if not found then
    raise exception 'CONTRACTED_SERVICE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if new.requested_by_role = 'client'::public.service_reschedule_requested_by_role
    and new.requested_by_profile_id <> v_cs.client_id
  then
    raise exception 'REQUESTER_PROFILE_MISMATCH'
      using errcode = '23514';
  end if;

  if new.requested_by_role = 'provider'::public.service_reschedule_requested_by_role
    and new.requested_by_profile_id <> v_cs.provider_id
  then
    raise exception 'REQUESTER_PROFILE_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger service_reschedule_requests_requester_consistency
  before insert or update of requested_by_role, requested_by_profile_id, contracted_service_id
  on public.service_reschedule_requests
  for each row execute procedure public.trg_service_reschedule_requests_requester_consistency();

create or replace function public.trg_service_reschedule_requests_fsm()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'REQUESTED'::public.service_reschedule_request_status then
      raise exception 'INVALID_INITIAL_STATUS'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if old.status in (
    'ACCEPTED'::public.service_reschedule_request_status,
    'CANCELLED'::public.service_reschedule_request_status,
    'EXPIRED'::public.service_reschedule_request_status
  ) then
    if new.status is distinct from old.status then
      raise exception 'TERMINAL_STATUS_IMMUTABLE'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'REQUESTED'::public.service_reschedule_request_status
      then new.status in (
        'PROPOSED'::public.service_reschedule_request_status,
        'CANCELLED'::public.service_reschedule_request_status,
        'EXPIRED'::public.service_reschedule_request_status
      )
    when 'PROPOSED'::public.service_reschedule_request_status
      then new.status in (
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status,
        'ACCEPTED'::public.service_reschedule_request_status,
        'CANCELLED'::public.service_reschedule_request_status,
        'EXPIRED'::public.service_reschedule_request_status
      )
    when 'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      then new.status in (
        'PROPOSED'::public.service_reschedule_request_status,
        'CANCELLED'::public.service_reschedule_request_status,
        'EXPIRED'::public.service_reschedule_request_status
      )
    else false
  end;

  if not v_allowed then
    raise exception 'INVALID_RESCHEDULE_STATUS_TRANSITION'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger service_reschedule_requests_fsm
  before insert or update of status
  on public.service_reschedule_requests
  for each row execute procedure public.trg_service_reschedule_requests_fsm();

create or replace function public.trg_service_reschedule_requests_terminal_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in (
    'ACCEPTED'::public.service_reschedule_request_status,
    'CANCELLED'::public.service_reschedule_request_status,
    'EXPIRED'::public.service_reschedule_request_status
  ) and new is distinct from old then
    raise exception 'TERMINAL_ROW_IMMUTABLE'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger service_reschedule_requests_terminal_immutable
  before update
  on public.service_reschedule_requests
  for each row execute procedure public.trg_service_reschedule_requests_terminal_immutable();

alter table public.service_reschedule_requests enable row level security;

revoke all on table public.service_reschedule_requests from anon, authenticated, public;

grant select, insert, update, delete on table public.service_reschedule_requests to service_role;

create policy service_reschedule_requests_admin_select
  on public.service_reschedule_requests
  for select
  to authenticated
  using ((select public.is_platform_admin()));

comment on policy service_reschedule_requests_admin_select on public.service_reschedule_requests is
  'Reschedule requests are RPC-only for product users; platform admin read for ops.';

insert into public.platform_constants (key, value, description)
values
  (
    'service_reschedule.client_request_window_hours',
    '48'::jsonb,
    'Hours before execution when the client may open a formal reschedule request.'
  ),
  (
    'service_reschedule.last_minute_hours',
    '24'::jsonb,
    'Hours before execution flagged as last-minute for provider-initiated requests.'
  ),
  (
    'service_reschedule.expiration_grace_hours',
    '24'::jsonb,
    'Hours after original execution to expire open CONFIRMED reschedule requests.'
  ),
  (
    'service_reschedule.reminder_initial_hours',
    '6'::jsonb,
    'Hours after open before the first provider reminder.'
  ),
  (
    'service_reschedule.reminder_interval_hours',
    '24'::jsonb,
    'Hours between subsequent provider reminders.'
  ),
  (
    'service_reschedule.reminder_max_count',
    '3'::jsonb,
    'Maximum regular provider reminders per open reschedule request.'
  ),
  (
    'service_reschedule.max_adjustments',
    '5'::jsonb,
    'Maximum adjustment rounds per reschedule request.'
  ),
  (
    'service_reschedule.batch_size',
    '50'::jsonb,
    'Default batch size for service reschedule cron jobs.'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();
