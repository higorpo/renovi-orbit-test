-- Fix: drop overly permissive chat-media "denied" storage policies.
--
-- Those policies used `bucket_id IS DISTINCT FROM 'chat-media'` with PERMISSIVE OR
-- semantics, which unintentionally ALLOWED INSERT/UPDATE/DELETE on every other bucket
-- for authenticated clients (e.g. service-requests), bypassing least privilege.
--
-- After drop: chat-media has no positive INSERT/UPDATE/DELETE for authenticated →
-- default deny (uploads stay on chat-upload-media Edge with service_role).
-- service-requests remains service_role-only for writes (Edge). Other buckets keep
-- their existing owner-scoped write policies (profile-images, portfolio, KYC, etc.).

drop policy if exists storage_objects_chat_media_insert_denied on storage.objects;
drop policy if exists storage_objects_chat_media_update_denied on storage.objects;
drop policy if exists storage_objects_chat_media_delete_denied on storage.objects;
