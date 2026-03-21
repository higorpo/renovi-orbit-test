-- Create storage bucket for service request photos (used by Edge Function create-request-quote-order).
-- Private bucket: only service role can insert; authenticated users read via RLS (own folder or admin/provider).

insert into storage.buckets (id, name, public)
values ('service-requests', 'service-requests', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

-- RLS on storage.objects: no INSERT for anon/authenticated (only service role via Edge Function).
-- SELECT for authenticated: own folder (path prefix = auth.uid()) or admin/provider can read any.
create policy "Authenticated read own folder or admin/provider read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'service-requests'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role in ('admin', 'provider')
      )
    )
  );
