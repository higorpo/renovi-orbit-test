-- Payment Task 127: append-only enforcement for payment_audit_log and payment_attempts (Req 22.5).

drop trigger if exists payment_audit_log_deny_mutation on public.payment_audit_log;
drop trigger if exists payment_attempts_deny_mutation on public.payment_attempts;

create trigger payment_audit_log_deny_mutation
  before update or delete on public.payment_audit_log
  for each row
  execute function public.payment_deny_row_mutation();

create trigger payment_attempts_deny_mutation
  before update or delete on public.payment_attempts
  for each row
  execute function public.payment_deny_row_mutation();

comment on trigger payment_audit_log_deny_mutation on public.payment_audit_log is
  'Blocks UPDATE/DELETE; audit rows are immutable after INSERT.';

comment on trigger payment_attempts_deny_mutation on public.payment_attempts is
  'Blocks UPDATE/DELETE; attempt rows are immutable after INSERT.';

revoke truncate on table public.payment_audit_log from public;
revoke truncate on table public.payment_audit_log from anon;
revoke truncate on table public.payment_audit_log from authenticated;
revoke truncate on table public.payment_audit_log from service_role;

revoke update, delete on table public.payment_audit_log from public;
revoke update, delete on table public.payment_audit_log from anon;
revoke update, delete on table public.payment_audit_log from authenticated;
revoke update, delete on table public.payment_audit_log from service_role;

revoke truncate on table public.payment_attempts from public;
revoke truncate on table public.payment_attempts from anon;
revoke truncate on table public.payment_attempts from authenticated;
revoke truncate on table public.payment_attempts from service_role;

revoke update, delete on table public.payment_attempts from public;
revoke update, delete on table public.payment_attempts from anon;
revoke update, delete on table public.payment_attempts from authenticated;
revoke update, delete on table public.payment_attempts from service_role;
