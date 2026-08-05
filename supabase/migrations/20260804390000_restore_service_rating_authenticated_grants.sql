-- Service completion Task 39: restore authenticated EXECUTE on rating RPCs (Req 16).
-- Grant hygiene (20260802320000) left these service_role-only; post-auto-complete
-- optional rating path needs authenticated clients.

grant execute on function public.submit_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) to authenticated;

grant execute on function public.update_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) to authenticated;

comment on function public.submit_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) is
  'Client submits optional rating after COMPLETED (incl. auto-complete). Manual confirm uses service_completion_confirm_with_rating instead (Task 39 / Req 16).';

comment on function public.update_service_rating(
  uuid, smallint, smallint, smallint, smallint, text
) is
  'Client updates own rating within 48h edit window; stats refresh via trigger (Task 39 / Req 16).';
