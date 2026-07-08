-- Allow parent_request_id on terminal round rows (ACCEPTED, CANCELLED, etc.).
-- Child rows created after re-propose keep parent_request_id when leaving PROPOSED.

alter table public.service_reschedule_requests
  drop constraint if exists service_reschedule_requests_parent_only_when_proposed;

alter table public.service_reschedule_requests
  add constraint service_reschedule_requests_parent_only_when_proposed
    check (
      parent_request_id is null
      or status not in (
        'REQUESTED'::public.service_reschedule_request_status,
        'ADJUSTMENT_REQUESTED'::public.service_reschedule_request_status
      )
    );

comment on constraint service_reschedule_requests_parent_only_when_proposed
  on public.service_reschedule_requests is
  'parent_request_id is only allowed on negotiation-round rows, not on REQUESTED or ADJUSTMENT_REQUESTED.';
