-- pgTAP: platform_check_rate_limit atomic RPC.

begin;

select plan(4);

select set_config('test.rate_key', 'pgtap:platform-check-rate-limit', true);

select is(
  public.platform_check_rate_limit(
    current_setting('test.rate_key'),
    2,
    60000
  )->>'allowed',
  'true',
  'first request is allowed'
);

select is(
  public.platform_check_rate_limit(
    current_setting('test.rate_key'),
    2,
    60000
  )->>'allowed',
  'true',
  'second request within limit is allowed'
);

select is(
  public.platform_check_rate_limit(
    current_setting('test.rate_key'),
    2,
    60000
  )->>'allowed',
  'false',
  'third request exceeds per-minute limit'
);

update public.platform_rate_limits
set reset_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint - 1
where key = current_setting('test.rate_key');

select is(
  public.platform_check_rate_limit(
    current_setting('test.rate_key'),
    2,
    60000
  )->>'allowed',
  'true',
  'expired window resets and allows again'
);

select finish();

rollback;
