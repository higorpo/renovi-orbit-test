-- Create storage bucket for service request photos (used by request-quote and Edge Function create-request-quote-order).
-- Public bucket so that getPublicUrl() returns URLs that can be displayed without auth.

insert into storage.buckets (id, name, public)
values ('service-requests', 'service-requests', true)
on conflict (id) do update set
  public = excluded.public;
