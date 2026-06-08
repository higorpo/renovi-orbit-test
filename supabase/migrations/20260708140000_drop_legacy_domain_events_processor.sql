-- Drop legacy domain_events replay processor; live notifications use table triggers.

drop function if exists public.cns_process_domain_events(int, text, boolean);
drop function if exists public.cns_enqueue_notifications(uuid);
drop function if exists public.cns_emit_analytics(uuid);

comment on table public.domain_events is
  'Platform transactional outbox for admin/replay and future matching consumers. Live notifications use table triggers.';
