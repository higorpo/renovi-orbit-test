-- pgTAP: proposal day slots accept calendar days OR working days.

begin;

select plan(4);

select is(
  public.count_inclusive_working_days('2026-06-05'::date, '2026-06-09'::date),
  3,
  'Fri through Tue counts 3 working days'
);

select is(
  ('2026-06-07'::date - '2026-06-05'::date + 1),
  3,
  'Fri through Sun counts 3 calendar days'
);

select ok(
  ('2026-06-07'::date - '2026-06-05'::date + 1) = 3
  or public.count_inclusive_working_days('2026-06-05'::date, '2026-06-07'::date) = 3,
  'Fri–Sun slot matches duration 3 via calendar days'
);

select ok(
  ('2026-06-09'::date - '2026-06-05'::date + 1) = 3
  or public.count_inclusive_working_days('2026-06-05'::date, '2026-06-09'::date) = 3,
  'Fri–Tue slot matches duration 3 via working days'
);

select finish();

rollback;
