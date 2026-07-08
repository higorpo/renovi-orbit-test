-- Add SUPERSEDED status for historical reschedule rounds.
-- Must commit before functions reference the new enum label.

alter type public.service_reschedule_request_status add value if not exists 'SUPERSEDED';

alter table public.service_reschedule_requests
  add column if not exists parent_request_id uuid
    references public.service_reschedule_requests (id) on delete restrict;

alter table public.service_reschedule_requests
  drop constraint if exists service_reschedule_requests_parent_only_when_proposed;

alter table public.service_reschedule_requests
  add constraint service_reschedule_requests_parent_only_when_proposed
    check (parent_request_id is null or status = 'PROPOSED'::public.service_reschedule_request_status);

create index if not exists service_reschedule_requests_parent_request_id_idx
  on public.service_reschedule_requests (parent_request_id)
  where parent_request_id is not null;

create unique index if not exists service_reschedule_requests_one_child_per_parent_idx
  on public.service_reschedule_requests (parent_request_id)
  where parent_request_id is not null;

create index if not exists service_reschedule_requests_chat_id_idx
  on public.service_reschedule_requests (chat_id);

comment on column public.service_reschedule_requests.parent_request_id is
  'Previous round superseded when the provider re-proposes after an adjustment request.';

create or replace function public.trg_service_reschedule_requests_parent_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.service_reschedule_requests%rowtype;
  v_cursor uuid;
  v_depth int := 0;
begin
  if new.parent_request_id is null then
    return new;
  end if;

  select srr.*
  into v_parent
  from public.service_reschedule_requests srr
  where srr.id = new.parent_request_id;

  if not found then
    raise exception 'PARENT_RESCHEDULE_REQUEST_NOT_FOUND'
      using errcode = '23503';
  end if;

  if v_parent.contracted_service_id <> new.contracted_service_id then
    raise exception 'PARENT_RESCHEDULE_SERVICE_MISMATCH'
      using errcode = '23514';
  end if;

  if v_parent.status <> 'SUPERSEDED'::public.service_reschedule_request_status then
    raise exception 'PARENT_RESCHEDULE_NOT_SUPERSEDED'
      using errcode = '23514';
  end if;

  v_cursor := v_parent.parent_request_id;
  while v_cursor is not null loop
    v_depth := v_depth + 1;

    if v_depth > 100 then
      raise exception 'PARENT_RESCHEDULE_CHAIN_TOO_DEEP'
        using errcode = '23514';
    end if;

    if v_cursor = new.id then
      raise exception 'PARENT_RESCHEDULE_CYCLE'
        using errcode = '23514';
    end if;

    select srr.parent_request_id
    into v_cursor
    from public.service_reschedule_requests srr
    where srr.id = v_cursor;
  end loop;

  return new;
end;
$$;

drop trigger if exists service_reschedule_requests_parent_consistency
  on public.service_reschedule_requests;

create trigger service_reschedule_requests_parent_consistency
  before insert or update of parent_request_id
  on public.service_reschedule_requests
  for each row execute procedure public.trg_service_reschedule_requests_parent_consistency();
