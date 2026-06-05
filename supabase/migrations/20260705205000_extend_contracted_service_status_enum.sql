-- Extend contracted_service_status for fulfillment and cancellation tabs/filters.

alter type public.contracted_service_status add value if not exists 'COMPLETED';
alter type public.contracted_service_status add value if not exists 'CANCELLED';

comment on type public.contracted_service_status is
  'Contracted service lifecycle: PENDING_PAYMENT after accept; COMPLETED when fulfilled; CANCELLED when terminated.';
