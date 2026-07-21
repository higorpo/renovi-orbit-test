-- Payment Task 4: seed payment-related platform_constants (design.md §3.12, Req 25).

insert into public.platform_constants (key, value, description)
values
  (
    'cc_visa_master_1x_rate',
    '2.39'::jsonb,
    'Visa/Master 1x fee rate %'
  ),
  (
    'cc_visa_master_2_6x_rate',
    '2.59'::jsonb,
    'Visa/Master 2-6x fee rate %'
  ),
  (
    'cc_visa_master_7_12x_rate',
    '2.79'::jsonb,
    'Visa/Master 7-12x fee rate %'
  ),
  (
    'cc_elo_other_1x_rate',
    '2.69'::jsonb,
    'Elo/Other 1x fee rate %'
  ),
  (
    'cc_elo_other_2_6x_rate',
    '2.89'::jsonb,
    'Elo/Other 2-6x fee rate %'
  ),
  (
    'cc_elo_other_7_12x_rate',
    '3.19'::jsonb,
    'Elo/Other 7-12x fee rate %'
  ),
  (
    'cc_fixed_processing_fee_brl',
    '0.39'::jsonb,
    'Fixed card processing fee BRL (NetCred PROCESSING)'
  ),
  (
    'cc_risk_analysis_fee_brl',
    '0.49'::jsonb,
    'Fixed risk analysis fee BRL (NetCred RISK_ANALYSIS); prod target R$0.49'
  ),
  (
    'max_charge_attempts',
    '3'::jsonb,
    'Max automatic cron retry attempts per payment schedule'
  ),
  (
    'charge_retry_interval_minutes',
    '30'::jsonb,
    'Minutes between retryable charge failures'
  ),
  (
    'payment_lease_duration_minutes',
    '10'::jsonb,
    'PROCESSING lock TTL minutes on payment_schedules'
  ),
  (
    'provider_onboarding_batch_size',
    '50'::jsonb,
    'Max providers per detect-netcred-onboarding batch'
  ),
  (
    'auto_cancel_hours_before_service',
    '12'::jsonb,
    'T-12h auto-cancellation threshold hours before service execution'
  ),
  (
    'scheduled_charge_hours_before_service',
    '48'::jsonb,
    'T-2 charge scheduling offset hours before service execution'
  ),
  (
    'installment_hmac_expires_minutes',
    '10'::jsonb,
    'HMAC installment payload TTL minutes'
  ),
  (
    'reconciliation_poll_interval_minutes',
    '30'::jsonb,
    'Stale payment schedule reconciliation poll interval minutes'
  ),
  (
    'webhook_base_retry_interval_minutes',
    '5'::jsonb,
    'Exponential backoff base interval minutes for webhook retry queue'
  ),
  (
    'charge_batch_size',
    '3'::jsonb,
    'Max payment schedules claimed per payment_claim_charge_batch cron tick (sized for pg_net invoke wall-clock)'
  ),
  (
    'webhook_processing_batch_size',
    '25'::jsonb,
    'Max webhook queue rows claimed per payment_claim_webhook_processing_batch tick'
  ),
  (
    'webhook_retry_batch_size',
    '25'::jsonb,
    'Max FAILED webhook events claimed per payment_claim_webhook_retry_batch tick'
  ),
  (
    'max_webhook_retries',
    '3'::jsonb,
    'Max retry attempts before webhook event moves to DEAD_LETTER'
  ),
  (
    'auto_cancel_batch_size',
    '100'::jsonb,
    'Max services processed per payment_auto_cancel_services cron tick'
  ),
  (
    'upcoming_charge_notification_batch_size',
    '100'::jsonb,
    'Max schedules claimed per upcoming-charge notification batch'
  ),
  (
    'auto_complete_grace_hours',
    '24'::jsonb,
    'Hours after executed_at before auto-complete promotes service to COMPLETED'
  ),
  (
    'webhook_stuck_processing_minutes',
    '15'::jsonb,
    'Minutes before stuck webhook PROCESSING rows are reclaimed by janitor'
  ),
  (
    'max_active_client_card_tokens',
    '8'::jsonb,
    'Max ACTIVE client_card_tokens per client (carding / token sprawl cap)'
  ),
  (
    'payment_webhook_auth_fail_spike_threshold_15m',
    '10'::jsonb,
    'Alert when INVALID_SIGNATURE webhook events in last 15m exceed this count'
  ),
  (
    'payment_failed_permanent_spike_threshold_15m',
    '5'::jsonb,
    'Alert when CHARGE_FAILED_PERMANENT audit events in last 15m exceed this count'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- Seed verification (run after migration apply):
-- select key, value, description
-- from public.platform_constants
-- where key in (
--   'cc_visa_master_1x_rate',
--   'cc_visa_master_2_6x_rate',
--   'cc_visa_master_7_12x_rate',
--   'cc_elo_other_1x_rate',
--   'cc_elo_other_2_6x_rate',
--   'cc_elo_other_7_12x_rate',
--   'cc_fixed_processing_fee_brl',
--   'cc_risk_analysis_fee_brl',
--   'max_charge_attempts',
--   'charge_retry_interval_minutes',
--   'payment_lease_duration_minutes',
--   'provider_onboarding_batch_size',
--   'auto_cancel_hours_before_service',
--   'scheduled_charge_hours_before_service',
--   'installment_hmac_expires_minutes',
--   'reconciliation_poll_interval_minutes',
--   'webhook_base_retry_interval_minutes',
--   'charge_batch_size'
-- )
-- order by key;
