-- Drop legacy direct-confirm reschedule RPC; product flow uses request → propose → accept.

drop function if exists public.cns_confirm_service_reschedule(uuid, jsonb);
