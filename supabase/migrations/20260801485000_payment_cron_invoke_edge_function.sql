-- Payment Task 59: payment_cron_invoke_edge_function internal pg_net helper (design.md §6.4).
-- Canonical definition; must run before EF-invoke cron wrappers (task 51+).

create or replace function public.payment_cron_invoke_edge_function(
  p_function_name text
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_slug text;
  v_url text;
  v_key text;
  v_allowed constant text[] := array[
    'schedule-netcred-charges',
    'detect-netcred-onboarding',
    'reconcile-netcred-payments'
  ];
begin
  v_slug := nullif(btrim(p_function_name), '');

  if v_slug is null then
    raise exception 'p_function_name is required'
      using errcode = '22023';
  end if;

  if v_slug !~ '^[a-z0-9-]+$' or not (v_slug = any (v_allowed)) then
    raise exception 'INVALID_EDGE_FUNCTION_SLUG'
      using errcode = '22023';
  end if;

  select nullif(trim(decrypted_secret), '')
  into v_url
  from vault.decrypted_secrets
  where name = 'payment_supabase_url';

  select nullif(trim(decrypted_secret), '')
  into v_key
  from vault.decrypted_secrets
  where name = 'payment_service_role_key';

  if v_url is null then
    v_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
  end if;

  if v_key is null then
    v_key := nullif(btrim(current_setting('app.service_role_key', true)), '');
  end if;

  if v_url is null or v_key is null then
    raise exception
      'Payment cron requires payment_supabase_url and payment_service_role_key (vault or database GUCs)'
      using errcode = '22023';
  end if;

  return net.http_post(
    url := v_url || '/functions/v1/' || v_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

comment on function public.payment_cron_invoke_edge_function(text) is
  'Internal pg_net helper for payment cron EF-invoke wrappers; reads URL/key from vault with GUC fallback.';

revoke all on function public.payment_cron_invoke_edge_function(text) from public;
revoke all on function public.payment_cron_invoke_edge_function(text) from anon;
revoke all on function public.payment_cron_invoke_edge_function(text) from authenticated;

grant execute on function public.payment_cron_invoke_edge_function(text) to postgres;

-- No pg_cron schedule: helper is invoked by payment_cron_* EF wrappers only.
