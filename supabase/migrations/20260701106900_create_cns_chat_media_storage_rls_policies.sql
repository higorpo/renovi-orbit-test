-- CNS Phase 11 — task 77: harden chat-media Storage RLS (design §3.13, Req. 31/35).
-- Replaces placeholder SELECT from task 15. Writes: Edge/service_role only.

drop policy if exists "Chat participants and admins read chat media" on storage.objects;

create policy chat_media_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      (select public.is_platform_admin())
      or (
        coalesce(array_length(storage.foldername(name), 1), 0) = 3
        and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and (select public.is_chat_participant(((storage.foldername(name))[1])::uuid))
      )
    )
  );

-- Direct client upload/update/delete denied; chat-upload-media Edge uses service_role.
create policy chat_media_insert_denied
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id is distinct from 'chat-media');

create policy chat_media_update_denied
  on storage.objects
  for update
  to authenticated
  using (bucket_id is distinct from 'chat-media')
  with check (bucket_id is distinct from 'chat-media');

create policy chat_media_delete_denied
  on storage.objects
  for delete
  to authenticated
  using (bucket_id is distinct from 'chat-media');

comment on policy chat_media_select on storage.objects is
  'Participant or admin read on paths {chat_id}/{upload_session_id}/{filename} (task 77).';
