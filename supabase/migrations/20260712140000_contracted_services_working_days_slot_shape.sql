-- Align contracted_services day-slot CHECK with create_provider_proposal:
-- duration_value may match either inclusive calendar days or Mon–Fri working days.

alter table public.contracted_services
  drop constraint if exists contracted_services_days_slot_shape;

alter table public.contracted_services
  add constraint contracted_services_days_slot_shape check (
    duration_unit <> 'days'
    or (
      scheduled_end_date is not null
      and scheduled_end_date >= scheduled_start_date
      and (
        (scheduled_end_date - scheduled_start_date + 1) = duration_value
        or public.count_inclusive_working_days(
          scheduled_start_date,
          scheduled_end_date
        ) = duration_value
      )
    )
  );

comment on column public.contracted_services.duration_value is
  'Frozen estimated duration from accepted proposal (hours count or inclusive calendar/working days per agreed slot).';
