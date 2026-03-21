-- Private storage bucket for provider portfolio images.
-- Path convention: providers/{provider_id}/portfolio/{item_id}/{filename}
-- Only the provider can insert/update/delete in their folder; authenticated can read (signed URLs in app).

insert into storage.buckets (id, name, public)
values ('provider-portfolio-images', 'provider-portfolio-images', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

create policy "Providers can insert own portfolio images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'provider-portfolio-images'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Providers can update own portfolio images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'provider-portfolio-images'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'provider-portfolio-images'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Providers can delete own portfolio images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'provider-portfolio-images'
    and (storage.foldername(name))[1] = 'providers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Anyone can read portfolio images when provider profile is visible"
  on storage.objects for select
  using (
    bucket_id = 'provider-portfolio-images'
    and exists (
      select 1 from public.provider_profiles_public p
      where p.provider_id = ((storage.foldername(name))[2])::uuid
      and (p.profile_visibility = 'public' or (p.profile_visibility = 'restricted' and (select auth.role()) = 'authenticated'))
    )
  );
