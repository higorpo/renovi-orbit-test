-- Payment Task 84: payment_audit_log append-only enforcement (design.md §3.9, §11.2, Req 22.5).

drop trigger if exists payment_audit_log_deny_mutation on public.payment_audit_log;

create trigger payment_audit_log_deny_mutation
  before update or delete on public.payment_audit_log
  for each row
  execute function public.payment_deny_row_mutation();

comment on trigger payment_audit_log_deny_mutation on public.payment_audit_log is
  'Blocks UPDATE/DELETE; audit rows are immutable after INSERT.';

revoke truncate on table public.payment_audit_log from public;
revoke truncate on table public.payment_audit_log from anon;
revoke truncate on table public.payment_audit_log from authenticated;
revoke truncate on table public.payment_audit_log from service_role;

revoke update, delete on table public.payment_audit_log from public;
revoke update, delete on table public.payment_audit_log from anon;
revoke update, delete on table public.payment_audit_log from authenticated;
revoke update, delete on table public.payment_audit_log from service_role;
