-- pgTAP fixture: isolated MMD test profile (no prior dispatches in seed).
-- Prerequisite: \ir ../rls/fixtures/seed_rls_actors.inc

create or replace function pg_temp.mmd_isolated_profile(
  p_profile_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.rls_seed_user(p_profile_id, 'client', 'MMD isolated profile');
  return p_profile_id;
end;
$$;
