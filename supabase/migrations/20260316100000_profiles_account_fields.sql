-- Trigger to keep profiles.updated_at in sync (set_updated_at is created in create_forms migration).
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
