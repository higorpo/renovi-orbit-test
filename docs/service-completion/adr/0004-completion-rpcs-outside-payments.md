# Completion RPCs leave the payments domain

Self-serve contracted-service lifecycle writers (`EXECUTED`, manual `COMPLETED` + rating, system auto-complete) move to `service_completion_*` RPCs/crons. `payment_mark_service_executed`, `payment_confirm_service_completed`, and `payment_cron_auto_complete_*` are removed from the product API.

**Why not extend `payment_*` in place?** Completion checklist, evidence, ratings, and publication readiness are not money-movement concerns. Keeping them under `payment_` couples feature ownership (`src/features/service-completion/`) to the payments module and confuses future readers.

**Trade-off:** migration churn and updates to payment-system docs/tests that previously owned Req 32 completion flow — accepted for domain clarity. NetCred charge/refund/settlement RPCs remain in payments.
