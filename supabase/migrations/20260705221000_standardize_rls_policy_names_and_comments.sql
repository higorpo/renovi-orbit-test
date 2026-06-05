-- Standardize RLS policy names ({table}_{operation}) and document every policy with COMMENT ON.
-- Skips message_dispatcher schema (MMD keeps its own naming).
-- storage.objects is owned by supabase_storage_admin: migration role can recreate policies but
-- cannot attach COMMENT ON POLICY; descriptions for storage policies are in SQL comments above each block.

-- chat_audit_admin_select: Chat audit log readable by platform admin only; timeline for clients uses SECURITY DEFINER RPC.
comment on policy chat_audit_admin_select on public.chat_audit is 'Chat audit log readable by platform admin only; timeline for clients uses SECURITY DEFINER RPC.';

-- chat_messages_delete_denied: Direct PostgREST deletes denied; messages are append-only for clients.
comment on policy chat_messages_delete_denied on public.chat_messages is 'Direct PostgREST deletes denied; messages are append-only for clients.';

-- chat_messages_insert_denied: Direct PostgREST inserts denied; messages are sent via send_message RPC.
comment on policy chat_messages_insert_denied on public.chat_messages is 'Direct PostgREST inserts denied; messages are sent via send_message RPC.';

-- chat_messages_select: Platform admin or chat participant may read messages; Realtime uses the same policy.
comment on policy chat_messages_select on public.chat_messages is 'Platform admin or chat participant may read messages; Realtime uses the same policy.';

-- chat_messages_update_denied: Direct PostgREST updates denied; message edits are not client-writable.
comment on policy chat_messages_update_denied on public.chat_messages is 'Direct PostgREST updates denied; message edits are not client-writable.';

-- chat_read_receipts_delete_denied: Direct PostgREST deletes denied; receipts are not client-deletable.
comment on policy chat_read_receipts_delete_denied on public.chat_read_receipts is 'Direct PostgREST deletes denied; receipts are not client-deletable.';

-- chat_read_receipts_insert_denied: Direct PostgREST inserts denied; receipts are written via mark_read RPC.
comment on policy chat_read_receipts_insert_denied on public.chat_read_receipts is 'Direct PostgREST inserts denied; receipts are written via mark_read RPC.';

-- chat_read_receipts_select: Platform admin or chat participant may read read receipts for that chat.
comment on policy chat_read_receipts_select on public.chat_read_receipts is 'Platform admin or chat participant may read read receipts for that chat.';

-- chat_read_receipts_update_denied: Direct PostgREST updates denied; receipts are immutable for clients.
comment on policy chat_read_receipts_update_denied on public.chat_read_receipts is 'Direct PostgREST updates denied; receipts are immutable for clients.';

-- chats_delete_denied: Direct PostgREST deletes denied; conversations are not client-deletable.
comment on policy chats_delete_denied on public.chats is 'Direct PostgREST deletes denied; conversations are not client-deletable.';

-- chats_insert_denied: Direct PostgREST inserts denied; conversations are created via cns_initiate_conversation RPC.
comment on policy chats_insert_denied on public.chats is 'Direct PostgREST inserts denied; conversations are created via cns_initiate_conversation RPC.';

-- chats_select: Platform admin reads all conversations; client and provider read rows where they participate.
comment on policy chats_select on public.chats is 'Platform admin reads all conversations; client and provider read rows where they participate.';

-- chats_update_denied: Direct PostgREST updates denied; conversation state changes via RPC only.
comment on policy chats_update_denied on public.chats is 'Direct PostgREST updates denied; conversation state changes via RPC only.';

-- client_addresses_insert: Client may insert addresses scoped to their client_id.
drop policy if exists "Clients can insert own addresses" on public.client_addresses;
create policy client_addresses_insert
  on public.client_addresses
  for insert
  with check ((( SELECT auth.uid() AS uid) = client_id))
;
comment on policy client_addresses_insert on public.client_addresses is 'Client may insert addresses scoped to their client_id.';

-- client_addresses_select: Client may read addresses they own.
drop policy if exists "Clients can read own addresses" on public.client_addresses;
create policy client_addresses_select
  on public.client_addresses
  for select
  using ((( SELECT auth.uid() AS uid) = client_id))
;
comment on policy client_addresses_select on public.client_addresses is 'Client may read addresses they own.';

-- client_addresses_update: Client may update addresses they own.
drop policy if exists "Clients can update own addresses" on public.client_addresses;
create policy client_addresses_update
  on public.client_addresses
  for update
  using ((( SELECT auth.uid() AS uid) = client_id))
  with check ((( SELECT auth.uid() AS uid) = client_id))
;
comment on policy client_addresses_update on public.client_addresses is 'Client may update addresses they own.';

-- client_profiles_private_insert: Client may insert their own private profile extension row.
drop policy if exists "Clients can insert own client_profiles_private" on public.client_profiles_private;
create policy client_profiles_private_insert
  on public.client_profiles_private
  for insert
  with check (((( SELECT auth.uid() AS uid) = client_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = client_profiles_private.client_id) AND (profiles.role = 'client'::text))))))
;
comment on policy client_profiles_private_insert on public.client_profiles_private is 'Client may insert their own private profile extension row.';

-- client_profiles_private_update: Client may update their own private profile extension row.
drop policy if exists "Clients can update own client_profiles_private" on public.client_profiles_private;
create policy client_profiles_private_update
  on public.client_profiles_private
  for update
  using ((( SELECT auth.uid() AS uid) = client_id))
  with check ((( SELECT auth.uid() AS uid) = client_id))
;
comment on policy client_profiles_private_update on public.client_profiles_private is 'Client may update their own private profile extension row.';

-- client_profiles_private_select: Client reads own private profile row; platform admin reads all.
drop policy if exists "Clients read own or admins read all client_profiles_private" on public.client_profiles_private;
create policy client_profiles_private_select
  on public.client_profiles_private
  for select
  using (((( SELECT auth.uid() AS uid) = client_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy client_profiles_private_select on public.client_profiles_private is 'Client reads own private profile row; platform admin reads all.';

-- contracted_services_delete_denied: Direct PostgREST deletes denied; contracts are not client-deletable.
comment on policy contracted_services_delete_denied on public.contracted_services is 'Direct PostgREST deletes denied; contracts are not client-deletable.';

-- contracted_services_insert_denied: Direct PostgREST inserts denied; contracts are created via accept_proposal RPC.
comment on policy contracted_services_insert_denied on public.contracted_services is 'Direct PostgREST inserts denied; contracts are created via accept_proposal RPC.';

-- contracted_services_select: Contract row readable by client, provider, or platform admin after accept.
comment on policy contracted_services_select on public.contracted_services is 'Contract row readable by client, provider, or platform admin after accept.';

-- contracted_services_update_denied: Direct PostgREST updates denied; contract lifecycle changes via RPC only.
comment on policy contracted_services_update_denied on public.contracted_services is 'Direct PostgREST updates denied; contract lifecycle changes via RPC only.';

-- domain_events_admin_select: Domain event outbox readable by platform admin only; writes use service_role or triggers.
comment on policy domain_events_admin_select on public.domain_events is 'Domain event outbox readable by platform admin only; writes use service_role or triggers.';

-- job_runs_admin_select: Job run telemetry readable by platform admin only; writes use service_role or cron.
comment on policy job_runs_admin_select on public.job_runs is 'Job run telemetry readable by platform admin only; writes use service_role or cron.';

-- platform_ai_prompt_usage_select: Platform admin may read AI prompt usage metrics.
drop policy if exists "Allow admin select platform_ai_prompt_usage" on public.platform_ai_prompt_usage;
create policy platform_ai_prompt_usage_select
  on public.platform_ai_prompt_usage
  for select
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_ai_prompt_usage_select on public.platform_ai_prompt_usage is 'Platform admin may read AI prompt usage metrics.';

-- platform_ai_prompts_insert: Platform admin may insert AI prompt definitions.
drop policy if exists "Allow admin insert platform_ai_prompts" on public.platform_ai_prompts;
create policy platform_ai_prompts_insert
  on public.platform_ai_prompts
  for insert
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_ai_prompts_insert on public.platform_ai_prompts is 'Platform admin may insert AI prompt definitions.';

-- platform_ai_prompts_update: Platform admin may update AI prompt definitions.
drop policy if exists "Allow admin update platform_ai_prompts" on public.platform_ai_prompts;
create policy platform_ai_prompts_update
  on public.platform_ai_prompts
  for update
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_ai_prompts_update on public.platform_ai_prompts is 'Platform admin may update AI prompt definitions.';

-- platform_cities_delete: Platform admin may delete city catalog rows.
drop policy if exists "Admins can delete platform_cities" on public.platform_cities;
create policy platform_cities_delete
  on public.platform_cities
  for delete
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_cities_delete on public.platform_cities is 'Platform admin may delete city catalog rows.';

-- platform_cities_insert: Platform admin may insert city catalog rows.
drop policy if exists "Admins can insert platform_cities" on public.platform_cities;
create policy platform_cities_insert
  on public.platform_cities
  for insert
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_cities_insert on public.platform_cities is 'Platform admin may insert city catalog rows.';

-- platform_cities_update: Platform admin may update city catalog rows.
drop policy if exists "Admins can update platform_cities" on public.platform_cities;
create policy platform_cities_update
  on public.platform_cities
  for update
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_cities_update on public.platform_cities is 'Platform admin may update city catalog rows.';

-- platform_cities_select: Anyone reads active cities; platform admin reads all city rows.
drop policy if exists "Select active platform_cities or admin sees all" on public.platform_cities;
create policy platform_cities_select
  on public.platform_cities
  for select
  using (((is_active = true) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy platform_cities_select on public.platform_cities is 'Anyone reads active cities; platform admin reads all city rows.';

-- platform_constants_all: Platform admin may read and write platform_constants configuration rows.
drop policy if exists "Admins can manage platform constants" on public.platform_constants;
create policy platform_constants_all
  on public.platform_constants
  for all
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_constants_all on public.platform_constants is 'Platform admin may read and write platform_constants configuration rows.';

-- platform_forms_delete: Platform admin may delete form definitions.
drop policy if exists "Admins can delete platform_forms" on public.platform_forms;
create policy platform_forms_delete
  on public.platform_forms
  for delete
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_forms_delete on public.platform_forms is 'Platform admin may delete form definitions.';

-- platform_forms_insert: Platform admin may insert form definitions.
drop policy if exists "Admins can insert platform_forms" on public.platform_forms;
create policy platform_forms_insert
  on public.platform_forms
  for insert
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_forms_insert on public.platform_forms is 'Platform admin may insert form definitions.';

-- platform_forms_update: Platform admin may update form definitions.
drop policy if exists "Admins can update platform_forms" on public.platform_forms;
create policy platform_forms_update
  on public.platform_forms
  for update
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_forms_update on public.platform_forms is 'Platform admin may update form definitions.';

-- platform_forms_select: Anyone reads active forms; platform admin reads all form rows.
drop policy if exists "Anyone can read active platform_forms or admins read all" on public.platform_forms;
create policy platform_forms_select
  on public.platform_forms
  for select
  using (((form_status = 'active'::text) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy platform_forms_select on public.platform_forms is 'Anyone reads active forms; platform admin reads all form rows.';

-- platform_neighborhoods_delete: Platform admin may delete neighborhood catalog rows.
drop policy if exists "Admins can delete platform_neighborhoods" on public.platform_neighborhoods;
create policy platform_neighborhoods_delete
  on public.platform_neighborhoods
  for delete
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_neighborhoods_delete on public.platform_neighborhoods is 'Platform admin may delete neighborhood catalog rows.';

-- platform_neighborhoods_insert: Platform admin may insert neighborhood catalog rows.
drop policy if exists "Admins can insert platform_neighborhoods" on public.platform_neighborhoods;
create policy platform_neighborhoods_insert
  on public.platform_neighborhoods
  for insert
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_neighborhoods_insert on public.platform_neighborhoods is 'Platform admin may insert neighborhood catalog rows.';

-- platform_neighborhoods_update: Platform admin may update neighborhood catalog rows.
drop policy if exists "Admins can update platform_neighborhoods" on public.platform_neighborhoods;
create policy platform_neighborhoods_update
  on public.platform_neighborhoods
  for update
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_neighborhoods_update on public.platform_neighborhoods is 'Platform admin may update neighborhood catalog rows.';

-- platform_neighborhoods_select: Anyone reads active neighborhoods; platform admin reads all neighborhood rows.
drop policy if exists "Select active platform_neighborhoods or admin sees all" on public.platform_neighborhoods;
create policy platform_neighborhoods_select
  on public.platform_neighborhoods
  for select
  using (((is_active = true) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy platform_neighborhoods_select on public.platform_neighborhoods is 'Anyone reads active neighborhoods; platform admin reads all neighborhood rows.';

-- platform_services_delete: Platform admin may delete platform service catalog rows.
drop policy if exists "Admins can delete platform_services" on public.platform_services;
create policy platform_services_delete
  on public.platform_services
  for delete
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_services_delete on public.platform_services is 'Platform admin may delete platform service catalog rows.';

-- platform_services_insert: Platform admin may insert platform service catalog rows.
drop policy if exists "Admins can insert platform_services" on public.platform_services;
create policy platform_services_insert
  on public.platform_services
  for insert
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_services_insert on public.platform_services is 'Platform admin may insert platform service catalog rows.';

-- platform_services_update: Platform admin may update platform service catalog rows.
drop policy if exists "Admins can update platform_services" on public.platform_services;
create policy platform_services_update
  on public.platform_services
  for update
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_services_update on public.platform_services is 'Platform admin may update platform service catalog rows.';

-- platform_services_select: Anyone reads active platform services; platform admin reads all rows.
drop policy if exists "Public or admins can read platform_services" on public.platform_services;
create policy platform_services_select
  on public.platform_services
  for select
  using (((active = true) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy platform_services_select on public.platform_services is 'Anyone reads active platform services; platform admin reads all rows.';

-- platform_states_delete: Platform admin may delete state catalog rows.
drop policy if exists "Admins can delete platform_states" on public.platform_states;
create policy platform_states_delete
  on public.platform_states
  for delete
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_states_delete on public.platform_states is 'Platform admin may delete state catalog rows.';

-- platform_states_insert: Platform admin may insert state catalog rows.
drop policy if exists "Admins can insert platform_states" on public.platform_states;
create policy platform_states_insert
  on public.platform_states
  for insert
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_states_insert on public.platform_states is 'Platform admin may insert state catalog rows.';

-- platform_states_update: Platform admin may update state catalog rows.
drop policy if exists "Admins can update platform_states" on public.platform_states;
create policy platform_states_update
  on public.platform_states
  for update
  using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))))
;
comment on policy platform_states_update on public.platform_states is 'Platform admin may update state catalog rows.';

-- platform_states_select: Anyone reads active states; platform admin reads all state rows.
drop policy if exists "Select active platform_states or admin sees all" on public.platform_states;
create policy platform_states_select
  on public.platform_states
  for select
  using (((is_active = true) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy platform_states_select on public.platform_states is 'Anyone reads active states; platform admin reads all state rows.';

-- profiles_insert: Authenticated user may insert their own profile row on signup.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy profiles_insert
  on public.profiles
  for insert
  with check ((( SELECT auth.uid() AS uid) = id))
;
comment on policy profiles_insert on public.profiles is 'Authenticated user may insert their own profile row on signup.';

-- profiles_select: Authenticated user may read their own profile row.
drop policy if exists "Users can read own profile" on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  using ((( SELECT auth.uid() AS uid) = id))
;
comment on policy profiles_select on public.profiles is 'Authenticated user may read their own profile row.';

-- profiles_update: Authenticated user may update their own profile row.
drop policy if exists "Users can update own profile" on public.profiles;
create policy profiles_update
  on public.profiles
  for update
  using ((( SELECT auth.uid() AS uid) = id))
;
comment on policy profiles_update on public.profiles is 'Authenticated user may update their own profile row.';

-- proposal_audit_admin_select: Proposal audit log readable by platform admin only; timeline uses SECURITY DEFINER RPC.
comment on policy proposal_audit_admin_select on public.proposal_audit is 'Proposal audit log readable by platform admin only; timeline uses SECURITY DEFINER RPC.';

-- provider_offered_services_delete: Provider may delete their own offered services.
drop policy if exists "Providers can delete own offered services" on public.provider_offered_services;
create policy provider_offered_services_delete
  on public.provider_offered_services
  for delete
  using ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_offered_services_delete on public.provider_offered_services is 'Provider may delete their own offered services.';

-- provider_offered_services_insert: Provider may insert offered services for their provider_id.
drop policy if exists "Providers can insert own offered services" on public.provider_offered_services;
create policy provider_offered_services_insert
  on public.provider_offered_services
  for insert
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_offered_services_insert on public.provider_offered_services is 'Provider may insert offered services for their provider_id.';

-- provider_offered_services_update: Provider may update their own offered services.
drop policy if exists "Providers can update own offered services" on public.provider_offered_services;
create policy provider_offered_services_update
  on public.provider_offered_services
  for update
  using ((( SELECT auth.uid() AS uid) = provider_id))
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_offered_services_update on public.provider_offered_services is 'Provider may update their own offered services.';

-- provider_offered_services_select: Provider reads own offered services; public reads when provider profile is visible.
drop policy if exists "Providers or public can read offered services" on public.provider_offered_services;
create policy provider_offered_services_select
  on public.provider_offered_services
  for select
  using (((( SELECT auth.uid() AS uid) = provider_id) OR (EXISTS ( SELECT 1
   FROM provider_profiles_public p
  WHERE ((p.provider_id = provider_offered_services.provider_id) AND ((p.profile_visibility = 'public'::text) OR ((p.profile_visibility = 'restricted'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text))))))))
;
comment on policy provider_offered_services_select on public.provider_offered_services is 'Provider reads own offered services; public reads when provider profile is visible.';

-- provider_portfolio_items_delete: Provider may delete their own portfolio items.
drop policy if exists "Providers can delete own portfolio items" on public.provider_portfolio_items;
create policy provider_portfolio_items_delete
  on public.provider_portfolio_items
  for delete
  using ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_portfolio_items_delete on public.provider_portfolio_items is 'Provider may delete their own portfolio items.';

-- provider_portfolio_items_insert: Provider may insert portfolio items for their provider_id.
drop policy if exists "Providers can insert own portfolio items" on public.provider_portfolio_items;
create policy provider_portfolio_items_insert
  on public.provider_portfolio_items
  for insert
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_portfolio_items_insert on public.provider_portfolio_items is 'Provider may insert portfolio items for their provider_id.';

-- provider_portfolio_items_update: Provider may update their own portfolio items.
drop policy if exists "Providers can update own portfolio items" on public.provider_portfolio_items;
create policy provider_portfolio_items_update
  on public.provider_portfolio_items
  for update
  using ((( SELECT auth.uid() AS uid) = provider_id))
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_portfolio_items_update on public.provider_portfolio_items is 'Provider may update their own portfolio items.';

-- provider_portfolio_items_select: Provider reads own portfolio items; public reads items marked public on visible profiles.
drop policy if exists "Providers or public can read portfolio items" on public.provider_portfolio_items;
create policy provider_portfolio_items_select
  on public.provider_portfolio_items
  for select
  using (((( SELECT auth.uid() AS uid) = provider_id) OR ((visibility = 'public'::text) AND (EXISTS ( SELECT 1
   FROM provider_profiles_public p
  WHERE ((p.provider_id = provider_portfolio_items.provider_id) AND ((p.profile_visibility = 'public'::text) OR ((p.profile_visibility = 'restricted'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)))))))))
;
comment on policy provider_portfolio_items_select on public.provider_portfolio_items is 'Provider reads own portfolio items; public reads items marked public on visible profiles.';

-- provider_profiles_private_insert: Provider may insert their own private profile extension row.
drop policy if exists "Providers can insert own provider_profiles_private" on public.provider_profiles_private;
create policy provider_profiles_private_insert
  on public.provider_profiles_private
  for insert
  with check (((( SELECT auth.uid() AS uid) = provider_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = provider_profiles_private.provider_id) AND (profiles.role = 'provider'::text))))))
;
comment on policy provider_profiles_private_insert on public.provider_profiles_private is 'Provider may insert their own private profile extension row.';

-- provider_profiles_private_update: Provider may update their own private profile extension row.
drop policy if exists "Providers can update own provider_profiles_private" on public.provider_profiles_private;
create policy provider_profiles_private_update
  on public.provider_profiles_private
  for update
  using ((( SELECT auth.uid() AS uid) = provider_id))
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_profiles_private_update on public.provider_profiles_private is 'Provider may update their own private profile extension row.';

-- provider_profiles_private_select: Provider reads own private profile row; platform admin reads all.
drop policy if exists "Providers read own or admins read all provider_profiles_private" on public.provider_profiles_private;
create policy provider_profiles_private_select
  on public.provider_profiles_private
  for select
  using (((( SELECT auth.uid() AS uid) = provider_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy provider_profiles_private_select on public.provider_profiles_private is 'Provider reads own private profile row; platform admin reads all.';

-- provider_profiles_public_insert: Provider may insert their own public profile row.
drop policy if exists "Providers can insert own provider_profiles_public" on public.provider_profiles_public;
create policy provider_profiles_public_insert
  on public.provider_profiles_public
  for insert
  with check (((( SELECT auth.uid() AS uid) = provider_id) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = provider_profiles_public.provider_id) AND (profiles.role = 'provider'::text))))))
;
comment on policy provider_profiles_public_insert on public.provider_profiles_public is 'Provider may insert their own public profile row.';

-- provider_profiles_public_update: Provider may update their own public profile row.
drop policy if exists "Providers can update own provider_profiles_public" on public.provider_profiles_public;
create policy provider_profiles_public_update
  on public.provider_profiles_public
  for update
  using ((( SELECT auth.uid() AS uid) = provider_id))
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_profiles_public_update on public.provider_profiles_public is 'Provider may update their own public profile row.';

-- provider_profiles_public_select: Public profiles are world-readable; restricted profiles require authentication.
drop policy if exists "Public or authenticated can read provider_profiles_public by vi" on public.provider_profiles_public;
create policy provider_profiles_public_select
  on public.provider_profiles_public
  for select
  using (((profile_visibility = 'public'::text) OR ((profile_visibility = 'restricted'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text))))
;
comment on policy provider_profiles_public_select on public.provider_profiles_public is 'Public profiles are world-readable; restricted profiles require authentication.';

-- provider_proposals_delete_denied: Direct PostgREST deletes denied; proposals are not client-deletable.
comment on policy provider_proposals_delete_denied on public.provider_proposals is 'Direct PostgREST deletes denied; proposals are not client-deletable.';

-- provider_proposals_insert_denied: Direct PostgREST inserts denied; proposals are created via create_provider_proposal RPC.
comment on policy provider_proposals_insert_denied on public.provider_proposals is 'Direct PostgREST inserts denied; proposals are created via create_provider_proposal RPC.';

-- provider_proposals_select: Proposal readable by platform admin, owning provider, or service-request client.
comment on policy provider_proposals_select on public.provider_proposals is 'Proposal readable by platform admin, owning provider, or service-request client.';

-- provider_proposals_update_denied: Direct PostgREST updates denied; proposal mutations go through RPC only.
comment on policy provider_proposals_update_denied on public.provider_proposals is 'Direct PostgREST updates denied; proposal mutations go through RPC only.';

-- provider_service_area_neighborhoods_delete: Provider may delete their own service area neighborhoods.
drop policy if exists "Provider can delete own provider_service_area_neighborhoods" on public.provider_service_area_neighborhoods;
create policy provider_service_area_neighborhoods_delete
  on public.provider_service_area_neighborhoods
  for delete
  using ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_service_area_neighborhoods_delete on public.provider_service_area_neighborhoods is 'Provider may delete their own service area neighborhoods.';

-- provider_service_area_neighborhoods_insert: Provider may insert service area neighborhoods for their provider_id.
drop policy if exists "Provider can insert own provider_service_area_neighborhoods" on public.provider_service_area_neighborhoods;
create policy provider_service_area_neighborhoods_insert
  on public.provider_service_area_neighborhoods
  for insert
  with check ((( SELECT auth.uid() AS uid) = provider_id))
;
comment on policy provider_service_area_neighborhoods_insert on public.provider_service_area_neighborhoods is 'Provider may insert service area neighborhoods for their provider_id.';

-- provider_service_area_neighborhoods_select: Provider reads own service areas; public reads when provider profile is visible.
drop policy if exists "Provider or public profile can read provider_service_area_neigh" on public.provider_service_area_neighborhoods;
create policy provider_service_area_neighborhoods_select
  on public.provider_service_area_neighborhoods
  for select
  using (((( SELECT auth.uid() AS uid) = provider_id) OR (EXISTS ( SELECT 1
   FROM provider_profiles_public p
  WHERE ((p.provider_id = provider_service_area_neighborhoods.provider_id) AND ((p.profile_visibility = 'public'::text) OR ((p.profile_visibility = 'restricted'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text))))))))
;
comment on policy provider_service_area_neighborhoods_select on public.provider_service_area_neighborhoods is 'Provider reads own service areas; public reads when provider profile is visible.';

-- rpc_idempotency_records_admin_select: RPC idempotency cache readable by platform admin only; writes use SECURITY DEFINER RPCs.
comment on policy rpc_idempotency_records_admin_select on public.rpc_idempotency_records is 'RPC idempotency cache readable by platform admin only; writes use SECURITY DEFINER RPCs.';

-- service_requests_insert: Client may insert service requests scoped to their client_id.
drop policy if exists "Clients can insert own service requests" on public.service_requests;
create policy service_requests_insert
  on public.service_requests
  for insert
  with check ((( SELECT auth.uid() AS uid) = client_id))
;
comment on policy service_requests_insert on public.service_requests is 'Client may insert service requests scoped to their client_id.';

-- service_requests_update: Client may update own service requests; platform admin may update any.
drop policy if exists "Clients can update own service requests; admins can update any" on public.service_requests;
create policy service_requests_update
  on public.service_requests
  for update
  using (((( SELECT auth.uid() AS uid) = client_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
  with check (((( SELECT auth.uid() AS uid) = client_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))))
;
comment on policy service_requests_update on public.service_requests is 'Client may update own service requests; platform admin may update any.';

-- service_requests_select: Client reads own service requests; providers and platform admin read all open requests.
drop policy if exists "Clients read own; providers and admins read all" on public.service_requests;
create policy service_requests_select
  on public.service_requests
  for select
  using (((( SELECT auth.uid() AS uid) = client_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['admin'::text, 'provider'::text])))))))
;
comment on policy service_requests_select on public.service_requests is 'Client reads own service requests; providers and platform admin read all open requests.';

-- user_device_beacons_all: Authenticated user may manage device beacon rows for their profile_id.
drop policy if exists "Users manage own user_device_beacons" on public.user_device_beacons;
create policy user_device_beacons_all
  on public.user_device_beacons
  for all
  using ((( SELECT auth.uid() AS uid) = profile_id))
  with check ((( SELECT auth.uid() AS uid) = profile_id))
;
comment on policy user_device_beacons_all on public.user_device_beacons is 'Authenticated user may manage device beacon rows for their profile_id.';

-- ---------------------------------------------------------------------------
-- storage.objects
-- ---------------------------------------------------------------------------

-- storage_objects_portfolio_images_select: Anyone may read portfolio images when the provider public profile is visible.
drop policy if exists "Anyone can read portfolio images when provider profile is visib" on storage.objects;
create policy storage_objects_portfolio_images_select
  on storage.objects
  for select
  using (((bucket_id = 'provider-portfolio-images'::text) AND (EXISTS ( SELECT 1
   FROM provider_profiles_public p
  WHERE ((p.provider_id = ((storage.foldername(objects.name))[2])::uuid) AND ((p.profile_visibility = 'public'::text) OR ((p.profile_visibility = 'restricted'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text))))))))
;

-- storage_objects_profile_images_select_authenticated: Authenticated users may read objects in the profile-images bucket.
drop policy if exists "Authenticated can read profile images" on storage.objects;
create policy storage_objects_profile_images_select_authenticated
  on storage.objects
  for select
  to authenticated
  using ((bucket_id = 'profile-images'::text))
;

-- storage_objects_service_requests_select: Client reads own service-request folder; provider or admin reads service-requests bucket.
drop policy if exists "Authenticated read own folder or admin/provider read all" on storage.objects;
create policy storage_objects_service_requests_select
  on storage.objects
  for select
  to authenticated
  using (((bucket_id = 'service-requests'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['admin'::text, 'provider'::text]))))))))
;

-- storage_objects_portfolio_images_delete: Provider may delete portfolio images under providers/{uid}/ in provider-portfolio-images.
drop policy if exists "Providers can delete own portfolio images" on storage.objects;
create policy storage_objects_portfolio_images_delete
  on storage.objects
  for delete
  to authenticated
  using (((bucket_id = 'provider-portfolio-images'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_proposal_images_delete: Provider may delete proposal images under providers/{uid}/ in provider-proposals.
drop policy if exists "Providers can delete own proposal images" on storage.objects;
create policy storage_objects_proposal_images_delete
  on storage.objects
  for delete
  to authenticated
  using (((bucket_id = 'provider-proposals'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_portfolio_images_insert: Provider may upload portfolio images under providers/{uid}/ in provider-portfolio-images.
drop policy if exists "Providers can insert own portfolio images" on storage.objects;
create policy storage_objects_portfolio_images_insert
  on storage.objects
  for insert
  to authenticated
  with check (((bucket_id = 'provider-portfolio-images'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_proposal_images_insert: Provider may upload proposal images under providers/{uid}/ in provider-proposals.
drop policy if exists "Providers can insert own proposal images" on storage.objects;
create policy storage_objects_proposal_images_insert
  on storage.objects
  for insert
  to authenticated
  with check (((bucket_id = 'provider-proposals'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_portfolio_images_update: Provider may update portfolio images under providers/{uid}/ in provider-portfolio-images.
drop policy if exists "Providers can update own portfolio images" on storage.objects;
create policy storage_objects_portfolio_images_update
  on storage.objects
  for update
  to authenticated
  using (((bucket_id = 'provider-portfolio-images'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
  with check (((bucket_id = 'provider-portfolio-images'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_proposal_images_update: Provider may update proposal images under providers/{uid}/ in provider-proposals.
drop policy if exists "Providers can update own proposal images" on storage.objects;
create policy storage_objects_proposal_images_update
  on storage.objects
  for update
  to authenticated
  using (((bucket_id = 'provider-proposals'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
  with check (((bucket_id = 'provider-proposals'::text) AND ((storage.foldername(name))[1] = 'providers'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_proposal_images_select: Provider, service-request client, or admin may read proposal images for accessible proposals.
drop policy if exists "Providers clients and admins can read proposal images" on storage.objects;
create policy storage_objects_proposal_images_select
  on storage.objects
  for select
  using (((bucket_id = 'provider-proposals'::text) AND (((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM service_requests sr
  WHERE (((sr.id)::text = (storage.foldername(objects.name))[4]) AND (sr.client_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))))))
;

-- storage_objects_profile_images_delete: User may delete profile images under users/{uid}/ in profile-images.
drop policy if exists "Users can delete own profile image" on storage.objects;
create policy storage_objects_profile_images_delete
  on storage.objects
  for delete
  to authenticated
  using (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = 'users'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_profile_images_insert: User may upload profile images under users/{uid}/ in profile-images.
drop policy if exists "Users can insert own profile image" on storage.objects;
create policy storage_objects_profile_images_insert
  on storage.objects
  for insert
  to authenticated
  with check (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = 'users'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_profile_images_update: User may update profile images under users/{uid}/ in profile-images.
drop policy if exists "Users can update own profile image" on storage.objects;
create policy storage_objects_profile_images_update
  on storage.objects
  for update
  to authenticated
  using (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = 'users'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
  with check (((bucket_id = 'profile-images'::text) AND ((storage.foldername(name))[1] = 'users'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)))
;

-- storage_objects_chat_media_delete_denied: Direct client deletes from chat-media denied; media lifecycle uses Edge/service_role.
drop policy if exists chat_media_delete_denied on storage.objects;
create policy storage_objects_chat_media_delete_denied
  on storage.objects
  for delete
  to authenticated
  using ((bucket_id IS DISTINCT FROM 'chat-media'::text))
;

-- storage_objects_chat_media_insert_denied: Direct client uploads to chat-media denied; uploads use chat-upload-media Edge with service_role.
drop policy if exists chat_media_insert_denied on storage.objects;
create policy storage_objects_chat_media_insert_denied
  on storage.objects
  for insert
  to authenticated
  with check ((bucket_id IS DISTINCT FROM 'chat-media'::text))
;

-- storage_objects_chat_media_select: Platform admin or chat participant may read chat-media objects for accessible chats.
drop policy if exists chat_media_select on storage.objects;
create policy storage_objects_chat_media_select
  on storage.objects
  for select
  to authenticated
  using (((bucket_id = 'chat-media'::text) AND (( SELECT is_platform_admin() AS is_platform_admin) OR ((COALESCE(array_length(storage.foldername(name), 1), 0) = 2) AND (storage.filename(name) IS NOT NULL) AND (btrim(storage.filename(name)) <> ''::text) AND ((storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::text) AND ( SELECT is_chat_participant(((storage.foldername(objects.name))[1])::uuid) AS is_chat_participant)))))
;

-- storage_objects_chat_media_update_denied: Direct client updates to chat-media denied; media changes use Edge/service_role.
drop policy if exists chat_media_update_denied on storage.objects;
create policy storage_objects_chat_media_update_denied
  on storage.objects
  for update
  to authenticated
  using ((bucket_id IS DISTINCT FROM 'chat-media'::text))
  with check ((bucket_id IS DISTINCT FROM 'chat-media'::text))
;
