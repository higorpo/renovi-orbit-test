-- Remove shadow/dry-run artifacts (direct production launch; Task 101 superseded).

drop function if exists public.payment_revert_dry_run_lease(uuid, int);

drop function if exists public.payment_claim_charge_batch(int, boolean);
