-- Matching M3 — extend user_device_beacons with location columns (design §3.7, requirements Req 12).

alter table public.user_device_beacons
  add column if not exists location_permission_granted boolean not null default false,
  add column if not exists location extensions.geography(point, 4326),
  add column if not exists location_accuracy_meters numeric,
  add column if not exists location_recorded_at timestamptz;

comment on column public.user_device_beacons.location_permission_granted is
  'Whether the provider granted OS location permission on this device installation.';
comment on column public.user_device_beacons.location is
  'Last known WGS84 point when permission is granted; null when permission denied or unavailable.';
comment on column public.user_device_beacons.location_accuracy_meters is
  'GPS accuracy in meters for the stored location sample; null when location is absent.';
comment on column public.user_device_beacons.location_recorded_at is
  'Client timestamp when the location sample was captured; null when location is absent.';
