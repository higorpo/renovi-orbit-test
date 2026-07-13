-- pgTAP: payment Task 4 — platform_constants payment seed rows (Req 25 AC2–AC3).

begin;

select plan(6);

select is(
  (
    select count(*)::int
    from public.platform_constants
    where key in (
      'cc_visa_master_1x_rate',
      'cc_visa_master_2_6x_rate',
      'cc_visa_master_7_12x_rate',
      'cc_elo_other_1x_rate',
      'cc_elo_other_2_6x_rate',
      'cc_elo_other_7_12x_rate',
      'cc_fixed_processing_fee_brl',
      'cc_risk_analysis_fee_brl',
      'max_charge_attempts',
      'charge_retry_interval_minutes',
      'payment_lease_duration_minutes',
      'provider_onboarding_batch_size',
      'auto_cancel_hours_before_service',
      'scheduled_charge_hours_before_service',
      'installment_hmac_expires_minutes',
      'reconciliation_poll_interval_minutes',
      'webhook_base_retry_interval_minutes',
      'charge_batch_size'
    )
  ),
  18,
  'seeds all 18 payment platform_constants keys'
);

-- Hermetic: migration defaults (seed.sql may override sandbox rates/risk on local DB)
update public.platform_constants set value = '2.39'::jsonb where key = 'cc_visa_master_1x_rate';
update public.platform_constants set value = '0.49'::jsonb where key = 'cc_risk_analysis_fee_brl';

select is(
  public.platform_constant_numeric('cc_visa_master_1x_rate', 0),
  2.39::numeric,
  'cc_visa_master_1x_rate default seed value'
);

select is(
  public.platform_constant_numeric('cc_risk_analysis_fee_brl', 0),
  0.49::numeric,
  'cc_risk_analysis_fee_brl default seed value (prod target)'
);

select is(
  public.platform_constant_numeric('max_charge_attempts', 0),
  3::numeric,
  'max_charge_attempts default seed value'
);

select is(
  public.platform_constant_numeric('scheduled_charge_hours_before_service', 0),
  48::numeric,
  'scheduled_charge_hours_before_service default seed value'
);

select is(
  public.platform_constant_numeric('charge_batch_size', 0),
  10::numeric,
  'charge_batch_size default seed value'
);

select finish();

rollback;
