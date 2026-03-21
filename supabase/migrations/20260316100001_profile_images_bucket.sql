-- Create private storage bucket for profile photos.
-- Only the authenticated owner can insert/update/delete their own object.
-- Any authenticated user can read (for display in platform).

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

-- Path convention: users/{user_id}/profile/{filename}
-- Insert: only authenticated user can upload to their own folder
create policy "Users can insert own profile image"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Users can update own profile image"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Authenticated can read profile images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-images');

create policy "Users can delete own profile image"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
