-- CNS Wave A — task 15: chat media upload sessions + chat-media bucket (design §3.13).
-- Two-phase upload binds Edge Storage write to cns_send_message RPC insert.

create table public.chat_media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

comment on table public.chat_media_upload_sessions is
  'Binds chat-media Storage uploads to cns_send_message; orphan janitor marks expired (Req. 26).';

comment on column public.chat_media_upload_sessions.status is
  'pending until message attach; completed on RPC commit; expired after janitor or TTL.';

comment on column public.chat_media_upload_sessions.expires_at is
  'Session TTL (default 24h); expired sessions block attach in cns_send_message.';

create index chat_media_upload_sessions_chat_id_idx
  on public.chat_media_upload_sessions (chat_id);

create index chat_media_upload_sessions_orphan_janitor_idx
  on public.chat_media_upload_sessions (expires_at)
  where status = 'pending';

comment on index public.chat_media_upload_sessions_orphan_janitor_idx is
  'Supports cns_janitor_orphan_media: pending sessions past retention window.';

-- Private bucket: path {chat_id}/{upload_session_id}/{filename}
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

-- Participant read; admin read (write via Edge service role — task 77).
create policy "Chat participants and admins read chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      exists (
        select 1
        from public.chats c
        where c.id::text = (storage.foldername(name))[1]
          and (
            c.client_id = (select auth.uid())
            or c.provider_id = (select auth.uid())
          )
      )
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'admin'
      )
    )
  );

-- Observability: baseline orphan-session count (pending past expires_at).
do $obs$
declare
  v_orphan bigint;
begin
  select count(*) into v_orphan
  from public.chat_media_upload_sessions s
  where s.status = 'pending'
    and s.expires_at < now();

  raise notice 'chat_media_upload_sessions: % pending sessions past expires_at (orphan candidates)',
    v_orphan;
end;
$obs$;
