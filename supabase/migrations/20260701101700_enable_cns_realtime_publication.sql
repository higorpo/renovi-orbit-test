-- CNS Wave A — task 18: Realtime publication for chat_messages and provider_proposals (design §5.4).
-- RLS on chat_messages (task 73) and provider_proposals (existing) filters Realtime delivery.

alter table public.provider_proposals replica identity full;

do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'provider_proposals'
  ) then
    alter publication supabase_realtime add table public.provider_proposals;
  end if;
end;
$pub$;
