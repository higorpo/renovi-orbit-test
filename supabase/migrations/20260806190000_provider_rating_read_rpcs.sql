-- Provider rating read RPCs (SECURITY DEFINER).
-- Exposes aggregates and public review lists without granting SELECT on provider_rating_stats.
-- Also ensures keyset index for list_public_provider_ratings (original schema migration updated for resets).

-- ---------------------------------------------------------------------------
-- Index for keyset pagination (provider_id, submitted_at DESC, id DESC)
-- ---------------------------------------------------------------------------

create index if not exists service_ratings_provider_submitted_at_id_idx
  on public.service_ratings (provider_id, submitted_at desc, id desc);

comment on index public.service_ratings_provider_submitted_at_id_idx is
  'Keyset pagination for list_public_provider_ratings; covers provider_id lookups.';

-- Drop legacy single-column index when present (superseded by composite above).
drop index if exists public.service_ratings_provider_id_idx;

-- ---------------------------------------------------------------------------
-- Batch reputation summaries (budget compare)
-- ---------------------------------------------------------------------------

create or replace function public.get_provider_rating_summaries(p_provider_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_provider_ids is null or cardinality(p_provider_ids) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'provider_id', pid,
        'rating_avg', case
          when coalesce(prs.rating_count, 0) > 0 then prs.overall_avg
          else null
        end,
        'rating_count', coalesce(prs.rating_count, 0),
        'completed_services_count', coalesce(completed.cnt, 0)
      )
      order by pid
    ),
    '[]'::jsonb
  )
  into v_result
  from unnest(p_provider_ids) as pid
  left join public.provider_rating_stats prs on prs.provider_id = pid
  left join lateral (
    select count(*)::int as cnt
    from public.contracted_services cs
    where cs.provider_id = pid
      and cs.status = 'COMPLETED'::public.contracted_service_status
  ) completed on true;

  return v_result;
end;
$$;

comment on function public.get_provider_rating_summaries(uuid[]) is
  'Batch provider rating_avg/rating_count/completed_services_count for authenticated budget compare.';

revoke all on function public.get_provider_rating_summaries(uuid[]) from public;
revoke all on function public.get_provider_rating_summaries(uuid[]) from anon;
grant execute on function public.get_provider_rating_summaries(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Public reviews list — cursor-based (submitted_at DESC, id DESC)
-- ---------------------------------------------------------------------------

create or replace function public.list_public_provider_ratings(
  p_provider_id uuid,
  p_page_size integer default 20,
  p_cursor_submitted_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visible boolean;
  v_limit integer;
  v_items jsonb;
  v_has_more boolean := false;
  v_next_cursor jsonb := null;
begin
  if p_provider_id is null then
    return jsonb_build_object(
      'items', '[]'::jsonb,
      'next_cursor', null,
      'has_more', false
    );
  end if;

  select
    ppp.profile_visibility = 'public'
    or (
      ppp.profile_visibility = 'restricted'
      and (select auth.role()) = 'authenticated'
    )
  into v_visible
  from public.provider_profiles_public ppp
  where ppp.provider_id = p_provider_id;

  if not coalesce(v_visible, false) then
    return null;
  end if;

  v_limit := least(greatest(coalesce(p_page_size, 20), 1), 50);

  if p_cursor_submitted_at is not null and p_cursor_id is null then
    raise exception 'p_cursor_id is required when p_cursor_submitted_at is set'
      using errcode = '22023';
  end if;

  if p_cursor_id is not null and p_cursor_submitted_at is null then
    raise exception 'p_cursor_submitted_at is required when p_cursor_id is set'
      using errcode = '22023';
  end if;

  with filtered as (
    select
      sr.id,
      sr.overall_score,
      nullif(btrim(sr.comment), '') as comment,
      sr.submitted_at
    from public.service_ratings sr
    where sr.provider_id = p_provider_id
      and (
        p_cursor_submitted_at is null
        or (sr.submitted_at, sr.id) < (p_cursor_submitted_at, p_cursor_id)
      )
    order by sr.submitted_at desc, sr.id desc
    limit v_limit + 1
  ),
  page_rows as (
    select *
    from filtered
    limit v_limit
  ),
  page_count as (
    select count(*)::integer as cnt from filtered
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'overall_score', r.overall_score,
            'comment', r.comment,
            'submitted_at', r.submitted_at
          )
          order by r.submitted_at desc, r.id desc
        )
        from page_rows r
      ),
      '[]'::jsonb
    ),
    (select cnt > v_limit from page_count),
    case
      when (select cnt > v_limit from page_count) then (
        select jsonb_build_object(
          'submitted_at', pr.submitted_at,
          'id', pr.id
        )
        from page_rows pr
        order by pr.submitted_at asc, pr.id asc
        limit 1
      )
      else null
    end
  into v_items, v_has_more, v_next_cursor;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor,
    'has_more', coalesce(v_has_more, false)
  );
end;
$$;

comment on function public.list_public_provider_ratings(uuid, integer, timestamptz, uuid) is
  'Cursor-paginated public provider ratings (no client PII); null when profile not visible to caller.';

revoke all on function public.list_public_provider_ratings(uuid, integer, timestamptz, uuid) from public;
grant execute on function public.list_public_provider_ratings(uuid, integer, timestamptz, uuid)
  to anon, authenticated;
