-- provider_proposals RLS (chats task 74): chat-scoped read; mutations via RPC only (§11.2).
-- Depends on chat_id (task 14), RLS helpers (task 17), chats RLS (task 72). Revoke direct writes: task 78.

drop policy if exists "Providers clients or admins read proposals" on public.provider_proposals;
drop policy if exists "Providers insert own proposals" on public.provider_proposals;
drop policy if exists "Providers update own proposals" on public.provider_proposals;

create policy provider_proposals_select
  on public.provider_proposals
  for select
  to authenticated
  using (
    (select public.is_platform_admin())
    or (
      chat_id is not null
      and exists (
        select 1
        from public.chats c
        where c.id = provider_proposals.chat_id
          and provider_proposals.provider_id = c.provider_id
          and (
            c.client_id = (select auth.uid())
            or c.provider_id = (select auth.uid())
          )
      )
    )
    or (
      chat_id is null
      and (
        (
          provider_proposals.provider_id = (select auth.uid())
          and (select public.is_provider())
        )
        or exists (
          select 1
          from public.service_requests sr
          where sr.id = provider_proposals.service_request_id
            and sr.client_id = (select auth.uid())
        )
      )
    )
  );

-- Defense in depth (task 78 revokes INSERT): explicit deny for authenticated.
create policy provider_proposals_insert_denied
  on public.provider_proposals
  for insert
  to authenticated
  with check (false);

create policy provider_proposals_update_denied
  on public.provider_proposals
  for update
  to authenticated
  using (false)
  with check (false);

create policy provider_proposals_delete_denied
  on public.provider_proposals
  for delete
  to authenticated
  using (false);

comment on policy provider_proposals_select on public.provider_proposals is
  'Admin; chat client/provider (proposal.provider_id must match chat.provider_id); legacy SR-scoped rows without chat_id (R31-AC04, task 74).';
