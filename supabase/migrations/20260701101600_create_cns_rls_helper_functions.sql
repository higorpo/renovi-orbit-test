-- CNS Wave A — task 17: RLS helper functions (design §11.2, Req. 35).
-- Initplan-safe (select auth.uid()) for use in policies without per-row auth re-eval.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

comment on function public.is_platform_admin() is
  'True when JWT subject is a platform admin profile (RLS helper, R35-AC12).';

create or replace function public.is_chat_participant(p_chat_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.chats c
    where c.id = p_chat_id
      and (select auth.uid()) in (c.client_id, c.provider_id)
  );
$$;

comment on function public.is_chat_participant(uuid) is
  'True when JWT subject is client or provider on the conversation (RLS helper, R35-AC13).';

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_chat_participant(uuid) to authenticated;
