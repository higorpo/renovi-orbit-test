-- CNS Wave A — task 17: RLS helper functions (design §11.2, Req. 35).
-- is_platform_admin / is_chat_participant: created in 20260701100100 (before read_receipts RLS).

create or replace function public.is_provider()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'provider'
  );
$$;

comment on function public.is_provider() is
  'True when JWT subject has profiles.role = provider (RLS and RPC guards).';

grant execute on function public.is_provider() to authenticated;
