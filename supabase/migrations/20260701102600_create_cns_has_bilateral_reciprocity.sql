-- CNS Wave B — task 27: bilateral reciprocity probe (design §4.6, Req. 4, 25).
-- Migration order: runs AFTER tasks 4 (chat_messages) and 10 (platform_constant_int).

create or replace function public.cns_has_bilateral_reciprocity(
  p_chat_id uuid,
  p_window_hours int default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with chat as (
    select c.id, c.client_id, c.provider_id
    from public.chats c
    where c.id = p_chat_id
  ),
  window_bounds as (
    select
      now() - (
        coalesce(
          p_window_hours,
          public.platform_constant_int('chats.reciprocity_window_hours', 24)
        ) || ' hours'
      )::interval as since
  )
  select
    exists (
      select 1
      from public.chat_messages m
      cross join chat c
      cross join window_bounds b
      where m.chat_id = c.id
        and m.sender_user_id = c.client_id
        and m.message_type in (
          'TEXT'::public.cns_message_type,
          'IMAGE'::public.cns_message_type,
          'PROPOSAL'::public.cns_message_type
        )
        and m.created_at >= b.since
    )
    and exists (
      select 1
      from public.chat_messages m
      cross join chat c
      cross join window_bounds b
      where m.chat_id = c.id
        and m.sender_user_id = c.provider_id
        and m.message_type in (
          'TEXT'::public.cns_message_type,
          'IMAGE'::public.cns_message_type,
          'PROPOSAL'::public.cns_message_type
        )
        and m.created_at >= b.since
    );
$$;

comment on function public.cns_has_bilateral_reciprocity(uuid, int) is
  'True when client and provider each sent TEXT, IMAGE, or PROPOSAL within the reciprocity window (R4-AC03).';

revoke all on function public.cns_has_bilateral_reciprocity(uuid, int) from public;
revoke all on function public.cns_has_bilateral_reciprocity(uuid, int) from authenticated;
revoke all on function public.cns_has_bilateral_reciprocity(uuid, int) from anon;

grant execute on function public.cns_has_bilateral_reciprocity(uuid, int) to service_role;
