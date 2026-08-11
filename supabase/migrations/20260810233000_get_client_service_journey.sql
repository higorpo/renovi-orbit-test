-- Client-only service journey timeline: derived milestones for "Acompanhe seu pedido".

create or replace function public.get_client_service_journey(
  p_service_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer_id uuid := (select auth.uid());
  v_sr public.service_requests%rowtype;
  v_cs public.contracted_services%rowtype;
  v_has_cs boolean := false;
  v_chat_at timestamptz;
  v_proposal_at timestamptz;
  v_paid_at timestamptz;
  v_rating_at timestamptz;
  v_has_rating boolean := false;
  v_keys text[] := array[
    'request_created',
    'professionals_interested',
    'quote_received',
    'quote_approved',
    'payment',
    'service_scheduled',
    'service_executed',
    'rating'
  ];
  v_n int := 8;
  v_real boolean[];
  v_completed boolean[];
  v_at timestamptz[];
  v_i int;
  v_j int;
  v_current_idx int;
  v_is_cancelled boolean := false;
  v_is_dispute boolean := false;
  v_cancel_at timestamptz;
  v_dispute_at timestamptz;
  v_milestones jsonb := '[]'::jsonb;
  v_status text;
  v_confirmed_plus boolean := false;
  v_executed_plus boolean := false;
begin
  if v_viewer_id is null then
    raise exception 'Authentication required for get_client_service_journey'
      using errcode = '42501';
  end if;

  if p_service_request_id is null then
    raise exception 'p_service_request_id is required'
      using errcode = '22023';
  end if;

  select sr.*
  into v_sr
  from public.service_requests sr
  where sr.id = p_service_request_id;

  if not found or v_sr.client_id is distinct from v_viewer_id then
    raise exception 'Service not found or access denied'
      using errcode = '42501';
  end if;

  if v_sr.contracted_service_id is not null then
    select cs.*
    into v_cs
    from public.contracted_services cs
    where cs.id = v_sr.contracted_service_id;
    v_has_cs := found;
  end if;

  if not v_has_cs then
    select cs.*
    into v_cs
    from public.contracted_services cs
    where cs.service_request_id = p_service_request_id
    order by cs.created_at desc
    limit 1;
    v_has_cs := found;
  end if;

  select min(c.created_at)
  into v_chat_at
  from public.chats c
  where c.service_request_id = p_service_request_id;

  select min(coalesce(pp.submitted_at, pp.created_at))
  into v_proposal_at
  from public.provider_proposals pp
  where pp.service_request_id = p_service_request_id;

  if v_has_cs then
    select ps.paid_at
    into v_paid_at
    from public.payment_schedules ps
    where ps.contracted_service_id = v_cs.id
      and not public.payment_schedule_state_is_terminal(ps.state)
    order by ps.created_at desc
    limit 1;

    select r.submitted_at
    into v_rating_at
    from public.service_ratings r
    where r.contracted_service_id = v_cs.id
    limit 1;
    v_has_rating := found;

    v_confirmed_plus := v_cs.status in (
      'CONFIRMED'::public.contracted_service_status,
      'EXECUTED'::public.contracted_service_status,
      'COMPLETED'::public.contracted_service_status,
      'IN_DISPUTE'::public.contracted_service_status
    );
    v_executed_plus := v_cs.status in (
      'EXECUTED'::public.contracted_service_status,
      'COMPLETED'::public.contracted_service_status,
      'IN_DISPUTE'::public.contracted_service_status
    );
  end if;

  v_is_dispute := v_has_cs
    and v_cs.status = 'IN_DISPUTE'::public.contracted_service_status;
  v_is_cancelled := (
    v_sr.status = 'CANCELLED'::public.service_request_status
    or (
      v_has_cs
      and v_cs.status = 'CANCELLED'::public.contracted_service_status
    )
  ) and not v_is_dispute;

  if v_is_cancelled then
    v_cancel_at := coalesce(
      v_sr.cancelled_at,
      case when v_has_cs then v_cs.updated_at else null end,
      v_sr.updated_at
    );
  end if;

  if v_is_dispute then
    -- V1: CS.updated_at (disputed_at exists but journey contract uses updated_at).
    v_dispute_at := v_cs.updated_at;
  end if;

  v_real := array_fill(false, array[v_n]);
  v_completed := array_fill(false, array[v_n]);
  v_at := array_fill(null::timestamptz, array[v_n]);

  -- 1 request_created — always present when SR exists
  v_real[1] := true;
  v_at[1] := v_sr.created_at;

  -- Clamp domain timestamps so no milestone can precede request creation
  -- (stale rows / clock skew / legacy data must not break chronological order).
  if v_chat_at is not null then
    v_chat_at := greatest(v_chat_at, v_sr.created_at);
  end if;
  if v_proposal_at is not null then
    v_proposal_at := greatest(v_proposal_at, v_sr.created_at);
  end if;

  -- 2 professionals_interested
  if v_chat_at is not null then
    v_real[2] := true;
    v_at[2] := v_chat_at;
  end if;

  -- 3 quote_received
  if v_proposal_at is not null then
    v_real[3] := true;
    v_at[3] := v_proposal_at;
  end if;

  -- 4 quote_approved
  if v_has_cs then
    v_real[4] := true;
    v_at[4] := greatest(v_cs.created_at, v_sr.created_at);
  end if;

  -- 5 payment — completed past pending (paid / confirmed+); current while PENDING_PAYMENT
  if v_confirmed_plus or v_paid_at is not null then
    v_real[5] := true;
    v_at[5] := case
      when v_paid_at is not null then greatest(v_paid_at, v_sr.created_at)
      else null
    end;
  end if;

  -- 6 service_scheduled — CONFIRMED+ only
  if v_confirmed_plus then
    v_real[6] := true;
    v_at[6] := greatest(
      coalesce(v_paid_at, v_cs.updated_at),
      v_sr.created_at
    );
  end if;

  -- 7 service_executed
  if v_executed_plus then
    v_real[7] := true;
    v_at[7] := case
      when v_cs.executed_at is not null then greatest(v_cs.executed_at, v_sr.created_at)
      else null
    end;
  end if;

  -- 8 rating
  if v_has_rating then
    v_real[8] := true;
    v_at[8] := case
      when v_rating_at is not null then greatest(v_rating_at, v_sr.created_at)
      else null
    end;
  end if;

  for v_i in 1..v_n loop
    v_completed[v_i] := v_real[v_i];
  end loop;

  -- Gap-fill: implicit milestone inherits the next real event's timestamp
  for v_i in 1..v_n loop
    if not v_completed[v_i] then
      for v_j in (v_i + 1)..v_n loop
        if v_real[v_j] then
          v_completed[v_i] := true;
          v_at[v_i] := v_at[v_j];
          exit;
        end if;
      end loop;
    end if;
  end loop;

  -- Enforce non-decreasing occurred_at along completed milestones
  for v_i in 2..v_n loop
    if v_completed[v_i] then
      if v_at[v_i] is null and v_at[v_i - 1] is not null then
        v_at[v_i] := v_at[v_i - 1];
      elsif
        v_at[v_i] is not null
        and v_at[v_i - 1] is not null
        and v_at[v_i] < v_at[v_i - 1]
      then
        v_at[v_i] := v_at[v_i - 1];
      end if;
    end if;
  end loop;

  if v_is_cancelled or v_is_dispute then
    for v_i in 1..v_n loop
      if v_completed[v_i] then
        v_milestones := v_milestones || jsonb_build_array(
          jsonb_build_object(
            'key', v_keys[v_i],
            'status', 'completed',
            'occurred_at', v_at[v_i]
          )
        );
      end if;
    end loop;

    if v_is_dispute then
      v_milestones := v_milestones || jsonb_build_array(
        jsonb_build_object(
          'key', 'in_dispute',
          'status', 'current',
          'occurred_at', v_dispute_at
        )
      );
    else
      v_milestones := v_milestones || jsonb_build_array(
        jsonb_build_object(
          'key', 'cancelled',
          'status', 'current',
          'occurred_at', v_cancel_at
        )
      );
    end if;
  else
    v_current_idx := null;
    for v_i in 1..v_n loop
      if not v_completed[v_i] then
        v_current_idx := v_i;
        exit;
      end if;
    end loop;

    for v_i in 1..v_n loop
      if v_completed[v_i] then
        v_status := 'completed';
      elsif v_current_idx is not null and v_i = v_current_idx then
        v_status := 'current';
      else
        v_status := 'upcoming';
      end if;

      v_milestones := v_milestones || jsonb_build_array(
        jsonb_build_object(
          'key', v_keys[v_i],
          'status', v_status,
          'occurred_at', case
            when v_status = 'completed' then v_at[v_i]
            else null
          end
        )
      );
    end loop;
  end if;

  return jsonb_build_object('milestones', v_milestones);
end;
$$;

comment on function public.get_client_service_journey(uuid) is
  'Client-owned service journey milestones (completed|current|upcoming) derived from SR/CS domain events; gap-fill inherits next real timestamp; cancel/dispute truncate futures.';

revoke all on function public.get_client_service_journey(uuid) from public;
revoke all on function public.get_client_service_journey(uuid) from anon;
revoke all on function public.get_client_service_journey(uuid) from service_role;

grant execute on function public.get_client_service_journey(uuid) to authenticated;
grant execute on function public.get_client_service_journey(uuid) to postgres;
