-- pgTAP: service-completion Task 4 — enrichment_events insert-only posture smoke.
-- Full RLS deny matrix lands in Task 10; this asserts grant-level append-only now.

begin;

select plan(3);

select ok(
  to_regclass('public.service_request_enrichment_events') is not null,
  'service_request_enrichment_events table exists'
);

select ok(
  not has_table_privilege('authenticated', 'public.service_request_enrichment_events', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.service_request_enrichment_events', 'DELETE'),
  'authenticated lacks UPDATE/DELETE on enrichment_events'
);

select ok(
  not has_table_privilege('service_role', 'public.service_request_enrichment_events', 'UPDATE')
    and not has_table_privilege('service_role', 'public.service_request_enrichment_events', 'DELETE'),
  'service_role lacks UPDATE/DELETE on enrichment_events (insert via DEFINER RPC)'
);

select finish();

rollback;
