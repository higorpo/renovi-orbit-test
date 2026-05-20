-- Per-profile, per-installation device and push registration (FCM target).
-- Rows are refreshed on client sync; stale rows are removed after 30 days without update.

create table if not exists public.user_device_beacons (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  fcm_token text,
  push_enabled boolean not null default false,
  platform text not null,
  operating_system text,
  os_version text,
  manufacturer text,
  model text,
  web_view_version text,
  device_name text,
  is_virtual boolean not null default false,
  android_sdk_version integer,
  ios_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_device_beacons_pkey primary key (profile_id, device_id),
  constraint user_device_beacons_platform_check check (
    platform in ('web', 'android', 'ios')
  )
);

comment on table public.user_device_beacons is
  'Device and FCM push endpoint per user installation; composite key profile_id + device_id.';
comment on column public.user_device_beacons.device_id is
  'Stable installation id from Capacitor Device.getId() (per app install).';
comment on column public.user_device_beacons.fcm_token is
  'FCM registration token when push_enabled is true; null otherwise.';
comment on column public.user_device_beacons.push_enabled is
  'Whether the app may receive push notifications on this device.';
comment on column public.user_device_beacons.updated_at is
  'Last successful sync; rows older than 30 days are purged by scheduled job.';

create index if not exists user_device_beacons_updated_at_idx
  on public.user_device_beacons (updated_at);

alter table public.user_device_beacons enable row level security;

create policy "Users manage own user_device_beacons"
  on public.user_device_beacons
  for all
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create trigger user_device_beacons_updated_at
  before update on public.user_device_beacons
  for each row
  execute procedure public.set_updated_at();

-- Purge installations not synced within 30 days (TTL).
create or replace function public.purge_stale_user_device_beacons()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.user_device_beacons
  where updated_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_stale_user_device_beacons() is
  'Deletes device beacon rows not updated in the last 30 days.';

revoke all on function public.purge_stale_user_device_beacons() from public;
grant execute on function public.purge_stale_user_device_beacons() to postgres;

do $cron$
declare
  v_jobid integer;
begin
  select j.jobid
  into v_jobid
  from cron.job j
  where j.jobname = 'purge_stale_user_device_beacons';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cron$;

select cron.schedule(
  'purge_stale_user_device_beacons',
  '0 3 * * *',
  $$select public.purge_stale_user_device_beacons();$$
);
