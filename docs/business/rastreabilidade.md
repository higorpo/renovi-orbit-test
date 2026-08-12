# Rastreabilidade (código ↔ documentação)

Mapeamento dos principais artefatos analisados para gerar `/docs/business`. Linhas podem referir-se a múltiplos documentos derivados.

**Última auditoria transversal:** 2026-08-10 (lembretes de credenciamento incompleto NetCred + spot-checks anteriores).

## Núcleo de aplicação e roteamento

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/router.tsx` | Rotas, lazy loading, guards, placeholders |
| `src/App.tsx` | Rota index `/` (ver [app-home](./modulos/app-home/README.md)) |
| `docs/business/modulos/README.md` | Índice de módulos, cobertura, lacunas |
| `src/main.tsx` | Bootstrap assíncrono: `initCapacitorPlugins` → `hydratePersistSessionPreference` → `RouterProvider` |
| `src/layouts/DashboardLayout/dashboardMenu.ts` | Menus por papel |
| `src/layouts/DashboardLayout/DashboardLayout.tsx` | Layout autenticado; `ProviderKycGate` + `useProviderKycBlocksNav` + `getDashboardMenu(role)` |
| `src/layouts/DashboardLayout/DashboardFakePage.tsx` | Placeholders de seção |
| `src/features/provider-kyc/` | Gate KYC, wizard de credenciamento, status, API/upload/submit |

## Autenticação e perfil

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/features/auth/components/routeGuards.tsx` | `ProtectedRoute`, `GuestOnlyRoute` |
| `src/features/auth/AuthProvider.tsx`, `hooks/useAuth.ts` | Sessão, redirect por papel |
| `src/features/auth/types/auth.types.ts` | `ProfileRole`, tipos de perfil |
| `src/features/auth/api/auth.api.ts` | Operações Supabase Auth |
| `src/features/auth/api/profile.api.ts` | Perfil, bloqueio de promoção admin |
| `src/features/auth/hooks/useSignupForm.ts` | reCAPTCHA no cadastro: pré-carga no mount (`preloadRecaptcha`); token no submit |
| Componentes `Login`, `ClientSignup`, `ProviderSignup`, `ForgotPassword`, `ResetPassword` | Jornadas de auth |

## Features por pasta (`src/features/*`)

| Pasta | APIs / hooks representativos | UI principal |
|-------|------------------------------|--------------|
| `addresses/` | `api/addresses.api.ts`, `api/statesAndCities.api.ts` | `AddressSelectionStep`, `AddressesSection`, `AddressFormDialog` |
| `my-services/` | hooks page/list/filters/cancel (delegam a `view-services`); `clientServiceCardPresentation.ts` / `providerServiceCardPresentation.ts` consomem ranking compartilhado `resolveClient/ProviderCardActions` + `getPendingPaymentHighlightContent` via Public API de `view-services` (follow-up de conclusão **vence** unread em `EXECUTED` / prestador `CONFIRMED`+past; nota real `clientRatingOverallScore` no card `completed`), `clientServiceCardTheme.ts` | `ClientMyServicesPage` / `ProviderMyServicesPage`, cards com highlight `PENDING_PAYMENT`, follow-up de conclusão pós-data-fim/`EXECUTED`, prestador `CONFIRMED`+past → “Concluir serviço” (`CompletionFlowSheetDialog` no card), `ReceivedBudgetDetailsSheet` via `negotiation-proposals` |
| `view-services/` | `api/services.api.ts` (RPC `get_service`, `list_services`, `cancel_service_request`, `republish_cancelled_service_request`, `get_client_service_journey`); `api/providerRatingSummary.api.ts` (`get_provider_rating_summaries`); hooks list/detail/cancel/republish/`useClientServiceJourney`/`useProviderRatingSummary`/`useContainerMinWidth`; `resolveClient/ProviderCardActions`, `serviceNextStep` (`getClient/ProviderServiceNextStep`), `pendingPaymentHighlight`, `presentServiceJourneyMilestones`; UI compõe **service-completion** + **Próximo passo** + **Jornada do pedido** (cliente) | `ServiceDetailShell` (rota `/dashboard/services/:id` — **não** placeholder), `ServiceDetailPage` + **Detail–Action Split** (`ServiceDetailNarrowStack` / `ServiceDetailWideLayout`; `useContainerMinWidth` ≥720px **do container**, não viewport; wide ~65/35 só se aside `:not(:empty)` — senão 1 coluna; aside sticky só na row; suporte irmão abaixo) + `ServiceDetailHeader` (`ServiceDetailAttributeCards` + `ServiceDetailActionsBar`) + `ServiceNextStepCard` + `ServiceJourneyCard` / skeleton, `ServiceContractedSection` (cliente: card rico + rating/CTA perfil; prestador: resumo agenda/status/valor; **sem** settlement), `ServiceDetailSection` (ex.: **Conversas** com `ServiceRequestConversationList` de `chats`; **Informações do pedido** via `FormResponsesSummary` — grid de cards por `block.type`; **Equipamentos/Materiais que podem ser úteis** só prestador via `suggested_equipment`/`suggested_materials` + `SuggestedItemsInfo`), `ServiceSupportHelpCard`, `ServiceDetailSkeleton` (`isWideLayout`), `FormResponsesSummary`, `ServiceListCard`, `ServiceSections` |
| `service-completion/` | `api/lifecycle.api.ts`, `context.api.ts`, `draft.api.ts`, `upload.api.ts`, `evidencePhotoStorage.api.ts`, `ratings.api.ts`, `declaration.api.ts`, `pendingEvaluationPrompt.api.ts`; hooks draft/mark/confirm/declaration/dispute/enrichment/evidence URLs / pending eval | **`ProviderMarkExecutedAction`**, **`ProviderMarkExecutedSheet`** (fases `checklist`/`success`; `chrome` standard/immersive), `CompletionSuccessStep` (corpo genérico de sucesso), `ProviderExecutedSuccessStep` (copy prestador pós mark-executed), **`ClientEvaluateServiceAction`** / **`ClientEvaluateServiceSheet`** (fases `intro`/`wizard`/`success`; mantém montada enquanto `open`), `ClientEvaluateSuccessStep` (copy cliente pós avaliação; modes `confirm` \| `optional`), **`PendingEvaluationPromptHost`**, `CompletionFlowSheetDialog`, `CompletionEvidenceGallery`, wizards embutidos (checkbox Declaração de execução no path manual), entrada de **Disputa de serviço** no wizard Avaliar (Public API → `view-services` / `RootLayout`) |
| `provider-calendar/` | `api/providerCalendar.api.ts` (RPC `list_provider_scheduled_services`); hooks de intervalo/vista | `ProviderCalendarPage` (`/dashboard/services/calendar`); banner de entrada em `my-services` |
| `device-beacon/` | `api/deviceBeacon.api.ts`, `deviceBeaconHttp.api.ts`; `useProviderLocationTracking`; `syncSchedule.ts` / `locationSync.ts` | `DeviceBeaconProvider` (RootLayout); dialog de permissão de localização (prestador) |
| `push-permission/` | `utils/pushPermissionPrompt.storage.ts`; hooks/host do soft prompt; marca conclusão na fila `appOpenOverlaySequence` | `PushPermissionPromptHost` (RootLayout); cooldown Preferences; precede o prompt de avaliação |
| `notifications/` | `api/engagementTracking.api.ts` (`recordPushClick`) | Sem UI — consumido por `src/lib/push.ts` (listeners nativos) |
| `dynamic-form/` | `utils/summaryDisplay.ts` (`SummaryEntry` com `type`; `buildSummaryEntries`) | `DynamicForm`, `FormDemoPage`; resumo flat consumido por `FormResponsesSummary` (view-services) |
| `my-account/` | `api/*Profile*.api.ts`, `portfolio.api.ts`, `offeredServices.api.ts`; `constants/routes.ts`, `accountNav.ts` | Hub `MyAccountLayout` / `MyAccountIndexPage` / `sections/*`; `AccountSummaryCard`, `ServiceAreaField` |
| `provider-jobs/` | `api/providerJobs.api.ts`, `dismissOpportunity.api.ts`; propostas via `negotiation-proposals` | `ProviderJobsPage`, `JobCard`; detalhe via `view-services` |
| `provider-profile/` | `api/providerProfilePublic.api.ts`, `api/providerProfileRatings.api.ts`; hooks `useProviderPublicProfile`, `usePublicProviderRatings`, SEO/share | `ProviderProfilePage`, `ProviderProfileHeader` (média/contagem), `ProviderProfileReviews` (cursor), `ProviderRatingStars` |
| `request-quote/` | `api/createRequestQuoteOrder.api.ts`, `smartDescription.api.ts`, `services.api.ts`, `forms.api.ts`; hooks submit (`preloadRecaptcha` no mount)/navigation/draft/IA | `RequestQuote.tsx`, passos 1–5, `ConfirmEmailScreen`, `TrustSidebar`; rascunho `requestQuoteDraft.persistence.ts` |
| `chats/` | `api/chats.api.ts`, `chats.rpc.ts`; hooks lista, thread, mensagens, Realtime | `ChatListPage`, `ChatScreen`, `ChatsLayout`; `ServiceRequestConversationList` + `ServiceRequestConversationRow` (content-only no detalhe do serviço via Public API) |
| `negotiation-proposals/` | `api/proposals.api.ts`, `api/serviceRequestBudgetCompare.api.ts` (+ `get_provider_rating_summaries`); `proposals.rpc.ts`; RPCs `create_provider_proposal`, `get_proposal_detail_for_provider`, `get_proposal_detail_for_participant`; countdown `useProposalCountdown`, `ProposalCountdownBanner` | `ProposalComposerDialog`, `AcceptProposalDialog`, `ReceivedBudgetDetailsSheet`, `BudgetCompareProviderHeader` (rating real), composer em jobs |
| `service-reschedule/` | `api/serviceReschedule.api.ts`; hooks mutações/detalhe; `deriveRescheduleDateMode`, `mapRescheduleSnapshot`; FSM em docs `ciclo-estados-reagendamento.md` | `ProposeRescheduleDialog` (inclui lembrete dispensável `ProposeRescheduleFlowReminder`), `RequestRescheduleDialog`, cards/ações no chat e no serviço contratado |
| `payments/` | APIs checkout/cartões/histórico/cobrança; RPCs `payment_*` | Checkout stepper, `ManualPaymentDialog`, histórico em Minha conta |
| `provider-earnings/` | `api/settlements.api.ts`; `useProviderSettlements`; disclosure D+30 / `settling_at`; `ROUTE_PROVIDER_EARNINGS` | `EarningsPage` (host em `my-account` `/dashboard/account/earnings`), filtros Previsto/Liquidado/Estorno, `ProviderSettlementDisclosure` |
| `provider-kyc/` | `api/kyc.api.ts`, `providerKyc.rpc.ts`, `brazilianBanks.api.ts`; hooks `useProviderPaymentAccount`, `useProviderKycBlocksNav`, `useProviderKycWizard`, `useDispatchKyc`, `useBrazilianBanks` | `ProviderKycGate`, `ProviderKycForm`, `BankPicker`, `ProviderKycWizardStepContent`, telas `components/status/*` |
| `auth/` | (já listado) | — |

## Supabase — dados e regras

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/lib/supabase/database.types.ts` | Tipos de tabelas, enums lógicos, RPCs expostas |
| `supabase/migrations/*.sql` | Schema, CHECKs, RLS, triggers, RPCs |
| `supabase/config.toml` | JWT das functions, auth email, realtime |
| `supabase/seed.sql` | Dados iniciais de referência (quando aplicável) |

## Edge Functions

| Artefato | Uso na documentação |
|----------|---------------------|
| `supabase/functions/generate-completion-checklist/*` | Enrichment / checklist de conclusão (`service-completion`) |
| `supabase/functions/record-service-completion-declaration/*` | Declaração de execução (`service-completion`): IP + device Capacitor + geo por IP (`ipwho.is`); chama RPC `service_completion_upsert_execution_declaration` |
| `supabase/functions/create-request-quote-order/index.ts` (+ módulos) | Criação atômica de pedido, fotos, rate limit |
| `supabase/functions/generate-smart-description/*` | IA, prompts, uso |
| `supabase/functions/match-provider-jobs/` | *(Legado — código removido; pasta vazia residual)* Feed aberto; RPC SQL `match_provider_jobs` ainda no schema (P-MD-04) |
| `supabase/functions/list-provider-opportunities/*` | Feed progressivo do prestador (visibilidade + cursor) |
| `supabase/functions/verify-recaptcha/index.ts` | Validação Google |
| `supabase/functions/_shared/*` | CORS, rate limit, tipos, payment shared |
| `supabase/functions/message-dispatcher-ingest/*` | Ingest HTTP autenticado → `message_dispatcher_ingest` (JWT = profileId) |
| `supabase/functions/message-dispatcher-worker/*` | Worker de entrega multicanal (Resend/FCM) |
| `supabase/functions/message-dispatcher-webhook-resend/*` | Webhook Resend (delivered, bounce, opened) |
| `supabase/functions/chat-upload-media/*` | Upload de mídia em conversa CNS |
| `supabase/functions/tokenize-payment-card/` | Tokenização NetCred (merchant plataforma) |
| `supabase/functions/manual-charge-payment/` | Cobrança manual + reconcile anti double-charge |
| `supabase/functions/schedule-netcred-charges/` | Cron T-2 |
| `supabase/functions/reconcile-netcred-payments/` | Reconcile gateway / crash recovery reembolso |
| `supabase/functions/reconcile-inanalysis-auto-cancel-voids/` | Void pós auto-cancel de `IN_ANALYSIS`; outcome `deferred_captured` (PAY-DC) |
| `supabase/functions/process-refund/` | Prepare → NetCred refund → commit |
| `supabase/functions/process-far-reschedule-recapture/` | Recaptura longe pós-`PAID` (reagendamento) |
| `supabase/functions/netcred-webhook/` | Webhook NetCred (pagamento + payout; enrich settlements pós-CAPTURE/REFUND) |
| `supabase/functions/sync-netcred-settlements/` | Reconcile GraphQL de settlements |
| `supabase/functions/detect-netcred-onboarding/` | Detecção onboarding KYC NetCred |
| `supabase/functions/dispatch-kyc-email/` | E-mail ops credenciamento |
| `supabase/functions/orbit-emit-sentry-alerts/` | Ponte cron/SQL → Sentry (ops; ver § abaixo) |

## Ops/observabilidade — `orbit-emit-sentry-alerts`

**Evidência parcial** (sem regra de negócio de produto; não é módulo de feature).

- **Papel:** Edge interna (`POST`, auth `ORBIT_CRON_SECRET` via `validateOrbitCronAuth`) que recebe `{ alerts: [...] }` e despacha para Sentry (`dispatchOrbitSentryAlerts` / matrix de pagamento + alertas genéricos `level`+`message`).
- **Produtores (SQL):** `orbit_post_sentry_alerts` → `orbit_invoke_edge_function('orbit-emit-sentry-alerts')`; crons de pagamento emitem kinds como `auto_cancel`, `webhook_dead_letter`, spikes `webhook_auth_fail_spike` / `failed_permanent_spike`, e payloads genéricos (ex. far-reschedule stale).
- **Resposta:** `{ received, dispatched }`; sem efeito em FSM de pedidos, MMD ou UX.
- **Artefatos:** `supabase/functions/orbit-emit-sentry-alerts/`, `_shared/observability/generic-sentry-alerts.ts`, migrations `20260801620000_*` / `20260801690000_*`; detalhe operacional em `docs/payment-system/payment-job-runs-monitoring.md`.

## CNS — conversas e negociação

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/chats/design.md`, `requirements.md` | Especificação normativa; slots §3.3.1 |
| `docs/business/modulos/chats/` | README + [conversas-e-negociacao](./modulos/chats/features/conversas-e-negociacao.md) |
| `supabase/migrations/20260701100000`–`20260701103900` (e correlatas) | Schema CNS, RPCs, RLS, crons, templates MMD |
| `supabase/tests/chats/*.sql` | pgTAP FSM, mensagem livre, concorrência |
| `supabase/migrations/20260705207000`–`20260705209000` | Rename `contracted_services`; RPCs `get_service`, `list_services` |
| `supabase/migrations/20260810233000_get_client_service_journey.sql` | RPC `get_client_service_journey` (timeline cliente-only; ownership; gap-fill; cancel/dispute) |
| `supabase/migrations/20260804460000_project_service_row_enrichment_fields.sql` | `project_service_row` / `get_service`: `contracted.service_amount` (`proposed_amount`), `provider.profile_image_path` + `slug` |
| `supabase/tests/view-services/view_services_rpcs_test.sql` | pgTAP acesso cliente/prestador, filtros e paginação |
| `supabase/tests/view_services/republish_cancelled_service_request_test.sql` | pgTAP republicação de pedido cancelado (ownership, elegibilidade, idempotência) |
| `supabase/tests/view_services/get_client_service_journey_test.sql` | pgTAP jornada do pedido (owner/non-owner, happy path, gap-fill, payment, cancel, dispute, rating opcional) |
| `src/router.tsx` | Rotas `/chats`, `/chats/:chatId` |
| `e2e/tests/chats.spec.ts` | E2E com mocks (`e2e/mocks/chats.mock.ts`) |
| `docs/chats/wave-a-rollout-checklist.md`, `wave-bf-rollout-runbook.md` | Cutover operacional |

## Message Dispatcher (backend)

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/message-dispatcher/` | README + features pipeline/FSM, quotas, quiet hours, engagement |
| `supabase/migrations/20260621100100_create_message_dispatcher_fsm_functions.sql` | FSM, RPCs core (ingest, cancel, checkout, report, reconcile), quiet hours, quotas |
| `supabase/functions/message-dispatcher-ingest/` | Ingest autenticado |
| `supabase/functions/message-dispatcher-worker/` | Worker checkout → send → report |
| `supabase/functions/message-dispatcher-webhook-resend/` | Webhook Resend |
| `supabase/tests/message_dispatcher/quiet_hours_helpers_test.sql` | Testes pgTAP dos helpers de horário silencioso |
| `supabase/tests/message_dispatcher/quiet_hours_ingest_reschedule_test.sql` | Testes pgTAP do reagendamento no ingest |
| `supabase/tests/message_dispatcher/quiet_hours_evaluate_pending_test.sql` | Testes pgTAP da rede de segurança no evaluate_pending |
| `src/features/notifications/api/engagementTracking.api.ts` | API client-side para registro de push click |
| `docs/business/modulos/notifications/` | Engagement push (cliente); N-01 web |

## Calendário, beacon e permissão de push

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/provider-calendar/` | README + [calendario-do-prestador](./modulos/provider-calendar/features/calendario-do-prestador.md) |
| `src/features/provider-calendar/` | Página, API RPC, hooks de vista lista/grade |
| `docs/business/modulos/device-beacon/` | README + [rastreamento-dispositivo](./modulos/device-beacon/features/rastreamento-dispositivo.md) |
| `src/features/device-beacon/` | Provider, geo, Preferences `orbit_device_beacon_last_sync_v1` |
| `docs/business/modulos/push-permission/` | README + [prompt-e-cooldown](./modulos/push-permission/features/prompt-e-cooldown.md) |
| `src/features/push-permission/` | Soft prompt + cooldown `orbit_push_permission_prompt_dismissed_at` |
| `src/lib/push.ts` | Setup FCM / listeners nativos → `recordPushClick` |

## Bibliotecas transversais

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/lib/recaptcha.ts` | Cliente reCAPTCHA v3: `preloadRecaptcha` (carga antecipada) e `executeRecaptcha` (token no submit); promise compartilhada para loads concorrentes |
| `src/lib/logger.ts` / `src/lib/sentry.ts` | Observabilidade (mencionado onde impacta fluxo) |
| `src/lib/cache.ts` | Cache em memória + `cachePersist*` em Preferences (`orbit.cache.persist.v1:`) |
| `src/lib/persistSession.ts` | Reexport de preferência **Manter conectado** |
| `src/lib/supabase/client.ts` | Cliente Supabase com `createSupabaseAuthStorage` |

## App nativo (Capacitor)

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/lib/capacitor/initCapacitorPlugins.ts` | Bootstrap: SystemBars (`@capacitor/core`), splash manual, teclado (`--keyboard-height`), ciclo de vida (`data-app-active`), botão voltar Android |
| `src/lib/capacitor/preferencesStorage.ts` | Capacitor Preferences: auth storage (`createSupabaseAuthStorage`), helpers `preferencesGet/Set/Remove`, prefixo web `CapacitorStorage.` para E2E |
| `src/lib/persistSession.ts` | Chave `orbit_persist_session`; hydrate no boot |
| `src/lib/capacitor/constants.ts` | Cor de marca / theme `#000000` (primary) |
| `capacitor.config.ts` | `appId` `com.prestway.orbit`, plugins `SystemBars`, `SplashScreen`, `Keyboard`; `server.url` aponta para dev local (evidência de ambiente de desenvolvimento) |
| `src/features/device-beacon/hooks/useProviderLocationTracking.ts` | Beacon + background geo (Android) → `user_device_beacons` — ver [device-beacon](./modulos/device-beacon/README.md) |
| `src/features/device-beacon/utils/locationSync.ts` | Debounce sync de localização operacional |
| `src/features/device-beacon/utils/syncSchedule.ts` | Snapshots de sync em Preferences (`orbit_device_beacon_last_sync_v1`) |
| `src/features/push-permission/utils/pushPermissionPrompt.storage.ts` | Cooldown do prompt de push (`orbit_push_permission_prompt_dismissed_at`) — ver [push-permission](./modulos/push-permission/README.md) |
| `src/features/service-completion/utils/pendingEvaluationPrompt.storage.ts` | Snooze do prompt de avaliação (`orbit_pending_evaluation_prompt_snooze`, ~4h) — ver [service-completion](./modulos/service-completion/README.md) |
| `src/lib/appOpenOverlaySequence.ts` | Fila de overlays: localização → push → avaliação pendente |
| `e2e/fixtures/auth.fixture.ts`, `e2e/helpers/preferencesStorage.ts` | `seedSession` grava em `localStorage` com prefixo `CapacitorStorage.` (espelho do fallback web do plugin) |
| `src/index.css` | `padding-top` com `--safe-area-inset-top` injetado pelo SystemBars no Android WebView |
| `android/app/src/main/res/values/colors.xml`, `drawable/splash.xml` | Splash nativo Android alinhado à cor de marca |
| `package.json` | Dependências `@capacitor/app`, `keyboard`, `splash-screen`, `preferences`, `haptics` — **haptics** instalado, **sem import** em `src/` |

## Reagendamento de serviço contratado

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/service-reschedule/` | README + [propor-nova-data](./modulos/service-reschedule/features/propor-nova-data.md) + [ciclo-estados-reagendamento](./modulos/service-reschedule/features/ciclo-estados-reagendamento.md) + [integração pagamento pós-aceite](./modulos/service-reschedule/features/integracao-pagamento-pos-aceite.md) |
| `docs/cancelamento-reagendamento-servicos/CONTEXT.md` | Glossário de domínio (modo de data; prestador em `PENDING_PAYMENT`/`CONFIRMED`; aceite + ramificação pós-`PAID` perto/longe) |
| `docs/cancelamento-reagendamento-servicos/details.md` | Fluxo de produto; exemplos de mensagem automática no pedido (com/sem `Observação:`); regra do prestador sem janela de 48h |
| `src/features/service-reschedule/utils/deriveRescheduleDateMode.ts` | Data única vs período a partir de `duration_unit`/`duration_value` |
| `src/features/service-reschedule/types/serviceReschedule.forms.ts` | Validação Zod + `matchesProposalDayDurationISO` |
| `src/features/service-reschedule/components/ProposeRescheduleDialog.tsx` | Duração: “Medido em” → “Tempo estimado”; datas: “Data de execução” / “Data de início” + “Data de fim”; exibe lembrete do fluxo no topo do formulário |
| `src/features/service-reschedule/components/ProposeRescheduleFlowReminder.tsx` | Banner “Como funciona o reagendamento?” (dispensável; visibilidade local à abertura do dialog) |
| `src/features/service-reschedule/utils/mapRescheduleSnapshot.ts` | Lê `duration_unit`/`duration_value` do snapshot |
| `src/features/service-reschedule/utils/rescheduleCardCopy.ts`, `formatRescheduleSlot.ts` | “Data proposta” / “Período proposto”; oculta range se fim nulo ou = início |
| `src/features/view-services/components/ServiceContractedSection.tsx` | Card Serviço contratado: cliente rico (avatar, rating via `get_provider_rating_summaries`, valor `service_amount`/`proposed_amount`, CTA perfil); prestador resumo; `PaymentDisputeStatus`; aviso `farRecapturePending`; **sem** `ProviderSettlementStatus` / selo verificado |
| `src/features/view-services/components/FormResponsesSummary.tsx` | Seção **Informações do pedido** (`ServiceDetailSection`); grid de cards (ícone círculo neutro + label + valor); ícone/`sm:col-span-2` via `formResponsePresentation` por `SummaryEntry.type`; entradas de `buildSummaryEntries` |
| `src/features/view-services/utils/serviceMapper.ts` | Mapeia `far_recapture_pending` → `farRecapturePending` |
| `supabase/migrations/20260802020000_service_reschedule_helpers.sql` | `_cns_validate_reschedule_slot(slot, duration_unit, duration_value)` |
| `supabase/migrations/20260802030000_service_reschedule_rpcs_core.sql` | `cns_request_service_reschedule`: elegibilidade `PENDING_PAYMENT`/`CONFIRMED` (cliente com janela 48h; prestador sem); mensagem SYSTEM; observação opcional com `\n\nObservação: ` |
| `supabase/migrations/20260802130000_service_reschedule_supersede_rounds.sql` (e correlatas `20260802*`) | `_cns_reschedule_snapshot_action_flags` e `cns_propose_service_reschedule`: prestador solicita/propõe em `PENDING_PAYMENT` ou `CONFIRMED`; snapshot com `duration_unit`/`duration_value` |
| `supabase/migrations/20260801220000_payment_reschedule_charge_date.sql` / `20260802200000_payment_far_reschedule_recapture.sql` | `payment_reschedule_charge_date` (perto vs longe); prepare/commit/claim/cron de recaptura longe |
| `supabase/functions/process-far-reschedule-recapture/` | EF interna: reembolso integral + commit de nova parcela T-2 (acordada via pg_net; client não invoca) |
| `supabase/tests/payments/payment_far_reschedule_*.sql` | pgTAP: ramificação perto/longe e prepare/commit |

## Matching progressivo (backend + feed)

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/matching-dispatch/` | README + feature dispatch/visibilidade; lifecycle sem proposta (24h/48h); bootstrap READY-handoff (CONTEXT #135); repair READY-sem-dispatch ≤7 dias |
| `docs/business/modulos/service-completion/` | Enrichment, conclusão EXECUTED (manual ou auto-mark sem checklist) / confirm / auto-complete, **Declaração de execução** (gate path manual; ausente no auto-complete), **Disputa de serviço** (`IN_DISPUTE`; open + admin resolve); CTAs sheet/dialog + galeria evidências; **prompt de avaliação pendente** (RPC leve + host no RootLayout; fila após localização/push); endurecimento SQL (evidência registrada, contexto full vs marketplace, imutabilidade); lazy load de `get_service_completion_context` (detalhe via campos leves de `get_service`); SELECT storage `completion-evidence` também para cliente com evidência `frozen` (`createSignedUrl`) |
| `docs/service-completion/` | Design técnico / ADR (fonte normativa de engenharia); ADR-0005 declaração de execução; ADR-0006 disputa como status no CS; `storage-bucket.md` (políticas SELECT/INSERT); runbook admin resolve em `service-completion-monitoring.md` |
| `supabase/migrations/20260804010000_service_completion_platform_constants.sql` | Seeds checklist/enrichment/`auto_complete_batch_size`/`auto_mark_executed_*`/orphan TTL |
| `supabase/migrations/20260804060000_*`–`20260804100000_*` | Evidence + upload sessions/objects + storage INSERT gates; SELECT cliente via `service_completion_evidence_storage_path_client_readable` quando frozen; frozen imutável; FK RESTRICT; deferred EXECUTED/COMPLETED↔frozen |
| `supabase/migrations/20260804090000_service_completion_rls.sql` | REVOKE SELECT authenticated em `service_request_enrichments` |
| `supabase/migrations/20260804350000_service_completion_mark_executed.sql` | Paths registrados / `EVIDENCE_PATH_NOT_REGISTERED`; sessões → `committed` |
| `supabase/migrations/20260804450000_get_service_completion_context.sql` | Read-model full vs marketplace limited (incl. `auto_executed_without_checklist`) |
| `supabase/migrations/20260810170000_service_dispute_enum_audit_columns.sql` / `20260810171000_service_dispute_rpcs_gates_mmd.sql` | Enum `IN_DISPUTE` + auditoria; open/admin resolve RPCs; gates; `list_phase=dispute`; MMD dispute templates |
| `supabase/migrations/20260804240000_enrichment_repair_ready_without_dispatch.sql` | Sweeper READY-sem-dispatch (janela 7 dias) |
| `supabase/migrations/20260804490000_*` / `20260804500000_*` | Janitor SQL orphan uploads (`referenced_in_responses`); drop finalize RPC; cron `service_completion_cron_orphan_upload_janitor` + `job_runs` (sem Edge) |
| `supabase/functions/generate-completion-checklist/` | Worker enrichment |
| `service_completion_create_upload_session` / `service_completion_register_upload_object` | Upload evidência Option A (KYC): sessão → `storage.from('completion-evidence').upload()` autenticado (RLS) → register; **sem** Edge de URL assinada de upload |
| `service_completion_evidence_storage_path_owned` / `*_path_client_readable` / `*_upload_allowed` | Helpers RLS do bucket `completion-evidence` (prestador; cliente frozen; INSERT) |
| `service_completion_janitor_orphan_uploads` / `service_completion_cron_orphan_upload_janitor` | `DELETE FROM storage.objects` + limpeza do registry (padrão KYC); sem `completion-evidence-orphan-janitor` |
| `supabase/tests/service_completion/*.sql` | pgTAP: mark-executed, auto-mark EXECUTED, context matrix, storage (incl. SELECT cliente frozen), janitor, RLS |
| `supabase/migrations/20260802190000_service_request_no_proposal_lifecycle.sql` | Templates MMD + cron auto-cancel sem propostas |
| `supabase/tests/matching/no_proposal_lifecycle_test.sql` | pgTAP seeking notify + auto-cancel |
| `docs/matching-algorithm/` | Design técnico e tasks de implementação |
| `docs/matching-algorithm/qa/staging-*-checklist.md` | QA staging geo/batch/MMD |
| `supabase/migrations/202607110*`–`20260711230000_*` | Schema dispatch, discovery, cron, visibilidade, ratings |
| `supabase/functions/list-provider-opportunities/` | Edge feed prestador |
| `supabase/tests/matching/*.sql` | pgTAP matching |
| `supabase/tests/matching/provider_rating_read_rpcs_test.sql` | pgTAP leitura de ratings: summaries, lista pública cursor, slug, deny restringido |
| `e2e/matching/*.spec.ts` | E2E feed + lifecycle |

## Pagamentos (checkout, histórico, reembolso)

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/payments/` | README + checkout + [historico-e-reembolso](./modulos/payments/features/historico-e-reembolso.md) + [reconciliacao-e-voids](./modulos/payments/features/reconciliacao-e-voids.md) |
| `supabase/functions/reconcile-inanalysis-auto-cancel-voids/` | Void pós-`IN_ANALYSIS` / `deferred_captured` |
| `docs/business/modulos/provider-earnings/` | README + [ganhos-e-liquidacoes](./modulos/provider-earnings/features/ganhos-e-liquidacoes.md) |
| `docs/payment-system/design.md` | Design normativo (§3.13 views de histórico + `payment_settlement_movements`; §4.8 reembolso; §4.3.1 fórmula de taxas) |
| `docs/payment-system/payments-api.md` §10 | Catálogo `PAYOUT_*` + `PayoutPayload` + enums de movement |
| `docs/adr/0001-payment-split-commission-model.md` | Split: prestador `FIXED_AMOUNT` / plataforma `PERCENTAGE` 100% do restante |
| `supabase/migrations/20260801020000_payment_platform_constants_seeds.sql` | Seeds MDR + `cc_fixed_processing_fee_brl` + `cc_risk_analysis_fee_brl` (prod R$ 0,49) + **`min_installment_value` = 150.00** |
| `supabase/migrations/20260801150000_payment_calculate_charge_amount.sql` | `payment_total_with_card_fees` / `payment_calculate_charge_amount` (gross-up + `ROUND_HALF_EVEN`) |
| `supabase/migrations/20260801160000_payment_calculate_installment_options.sql` | Opções 1–12 + HMAC; **1x sempre**; `n > 1` só se `installment_amount >= min_installment_value`; HMAC assina só opções filtradas |
| `supabase/functions/_shared/payment/fee-calculator.ts` | Mesma fórmula no Edge compartilhado (cobrança / espelho) |
| `supabase/functions/_shared/payment/netcred-charge-mapping.ts` | `automaticAdvance: false` (antecipação fora da fórmula padrão) |
| `supabase/seed.sql` | Sandbox local: PROCESSING R$ 4,90 + RISK_ANALYSIS R$ 5,00 |
| `src/features/payments/components/CheckoutStepper/CardForm.tsx` + `AddCardSheetDialog.tsx` | Tokenização/cadastro de cartão: coleta CPF do titular (enviado à NetCred) e alerta não bloqueante quando o primeiro nome no cartão difere do perfil |
| `src/features/payments/components/CheckoutStepper/CardStep.tsx` + `api/clearsale.api.ts` | Sessão ClearSale emitida no servidor; fail-closed em produção se SDK falhar |
| `src/features/payments/utils/isClearSaleProductionFailClosed.ts` | Gate de fail-closed ClearSale em produção |
| `src/features/payments/components/PaymentTrustDisclosure.tsx` | Disclosure: taxas podem ser recalculadas na cobrança (drift checkout→T-2) |
| `src/features/payments/utils/cardholderIdentity.ts` | Conferência auxiliar do primeiro nome (soft check) |
| `src/features/payments/utils/mapPaymentUserMessage.ts` | Mapeamento código → mensagem amigável pt-BR (inclui `RISK_ANALYSIS_*`, `CARD_REJECTED`, `PROFILE_INCOMPLETE`, `PAYMENT_TOKEN_COMPANY_MISMATCH`); nunca texto bruto do backend |
| `src/features/payments/utils/manualPaymentErrors.ts` / `paymentApiErrors.ts` | Falhas de cobrança manual e RPC usam o mapper (por código / `failure_code`) |
| `src/features/payments/components/ManualPaymentFailureAlert.tsx` | Alerta “Pagamento falhou” no detalhe: mensagem via `failure_code`, não `failure_reason` |
| `src/features/payments/components/ManualPaymentDialog.tsx` + `hooks/useManualPaymentDialog.ts` | Dialog de recuperação (ShellDialog / `useMobileDialogViewport`); fluxo cartão → `InstallmentSelector` → confirmar; erro terminal por código |
| `supabase/functions/_shared/payment/map-rejected-reason.ts` | `rejectedReason` “Análise de Risco: …” → códigos estáveis `RISK_ANALYSIS_*` |
| `supabase/functions/_shared/payment/netcred-graphql.ts` | `chargeCreate` solicita `transactions.node.rejectedReason` |
| `supabase/functions/_shared/payment/netcred-adapter.ts` | Persiste código mapeado em falha terminal; motivo bruto para diagnóstico |
| `src/features/payments/api/cards.api.ts` (`updatePaymentMethod`) | Invoca RPC `payment_update_method` com token, HMAC e `p_installment_number` opcional |
| `supabase/migrations/20260801210000_payment_update_method.sql` | RPC: `p_installment_number` opcional; estados `SCHEDULED`/`FAILED`/`FAILED_PERMANENT`; HMAC ao mudar bandeira/parcelas |
| `supabase/functions/manual-charge-payment/` (+ `executeManualCharge.ts`) | Cobrança manual: reconcilia `gateway_reference_code` anterior antes de nova charge; exige sessão ClearSale fresca |
| `supabase/functions/schedule-netcred-charges/processSchedule.ts` | Cron T-2: fail-closed sem `clearsale_session_id` em produção; exige provider `ACTIVE` com company+bank |
| `supabase/functions/tokenize-payment-card/` | Tokenização sob merchant da **plataforma** Prestway (`NETCRED_PLATFORM_COMPANY_ID` / Vault); `CARD_REJECTED` opaco ao cliente; rate limit mais restrito no path de perfil |
| `src/features/payments/components/PaymentHistory/*` | UI histórico cliente/prestador em Minha conta |
| `src/features/payments/utils/clientPaymentHistoryAmounts.ts` | Breakdown: original riscado, líquido, “Reembolsado: …” |
| `src/features/payments/api/history.api.ts` | Leitura das views de histórico |
| `supabase/migrations/20260801140000_create_payment_history_views.sql` | `client_payment_transactions_v`; `provider_payment_receivables_v` (clawback só com `refunded_at`) |
| `payment_prepare_refund_request` / `payment_commit_refund_after_gateway` / `payment_mark_refund_gateway_acked` / `payment_complete_refund_domain_side_effects` (migration `20260802070000_*` e correlatas) | Opção A (gateway first): prepare (read-only) → NetCred → commit cancel+`REFUND_REQUESTED`+`SUBMITTED`; crash recovery PAID+SUBMITTED; side effects de domínio reutilizados por reconcile/webhook. P-12 resolvido — ver `docs/payment-system/critical-bug-refund-partial-commit.md` |
| `supabase/functions/process-refund/` | Edge: prepare → `refundTransaction` → commit |
| `supabase/functions/reconcile-netcred-payments/` | Claim PAID+SUBMITTED; completa cancel se gateway REFUNDED |
| `supabase/functions/netcred-webhook/` + `payment_process_webhook_event` | Assinatura inválida → terminal; `paid_amount` server-authoritative; confirma reembolso (`refunded_at`); `PAID`→`REFUNDED` via `TRANSACTION_REFUND`; `PAYOUT_CREATE`/`PAYOUT_SETTLE` → `payment_webhook_handle_payout`; após `TRANSACTION_CAPTURE`/`TRANSACTION_REFUND` bem-sucedidos → enrich GraphQL best-effort `movements(transactionId)` → `payment_upsert_settlement_movements` (falha não falha ACK); completa cancel de domínio se serviço ainda aberto |
| `supabase/migrations/20260802240000_create_payment_settlement_movements.sql` | Tabela `payment_settlement_movements`, view `provider_settlement_movements_v`, upsert/list RPCs, handler payout |
| `supabase/migrations/20260802250000_payment_sync_netcred_settlements_cron.sql` | Cron `payment_cron_sync_netcred_settlements` → EF `sync-netcred-settlements` |
| `supabase/functions/sync-netcred-settlements/` | Reconcile GraphQL de movements (backfill; mesmo pipeline do enrich pós-captura) |
| `supabase/tests/payments/payment_settlement_movements_test.sql` | pgTAP RLS/CLS/upsert/list settlements |
| `src/features/provider-earnings/` | UI Ganhos + Vitest (api/hooks/utils/disclosure) |
| `supabase/tests/payments/client_card_tokens_company_binding_test.sql` | Token ligado à company NetCred da **plataforma** (`payment_netcred_platform_company_id` / Vault); mismatch no aceite é vs platform (não vs company do prestador); prestador só no payout |
| `supabase/tests/payments/payment_accept_proposal_profile_incomplete_test.sql` | `accept_proposal` exige CPF+telefone (`PROFILE_INCOMPLETE`) |
| `supabase/migrations/20260802180000_payment_schedules_audit_trigger.sql` | Tabela `payment_schedules_audit` (row-history append-only), `row_version`/`audit_txid` só no audit, trigger statement único set-based, RLS admin-only, INSERT só via DEFINER |
| `supabase/tests/payments/payment_schedules_audit_trigger_test.sql` | pgTAP: snapshot INSERT/UPDATE/DELETE, versões contíguas, drift de colunas, bloqueio UPDATE/INSERT direto, privilégios |

## Credenciamento do prestador (gate + wizard + lembretes)

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/provider-kyc/` | README + [gate-e-acesso-operacional](./modulos/provider-kyc/features/gate-e-acesso-operacional.md) + [formulário-credenciamento-wizard](./modulos/provider-kyc/features/formulario-credenciamento-wizard.md) + [lembretes-credenciamento-incompleto](./modulos/provider-kyc/features/lembretes-credenciamento-incompleto.md) |
| `src/features/provider-kyc/components/ProviderKycGate.tsx` | Bloqueio do conteúdo; allowlist `/dashboard/account*`; UIs por status; host do `ProviderKycForm` |
| `src/features/provider-kyc/hooks/useProviderKycBlocksNav.ts` | Oculta chrome de nav no `DashboardLayout` (loading + bloqueio KYC) |
| `src/features/provider-kyc/hooks/useProviderPaymentAccount.ts` | Polling 5s (e-mail pendente) / 30s (documentos enviados ou análise) |
| `src/features/provider-kyc/hooks/__tests__/useProviderKycBlocksNav.test.tsx` | Loading / ACTIVE / bloqueio / não-provider |
| `src/layouts/DashboardLayout/MobileTabHeader.tsx` | Prop `hideMenu` (hamburger oculto com KYC bloqueado) |
| `src/layouts/DashboardLayout/DashboardLayout.tsx` | Integração gate + `hideNavForKyc` (DesktopNav / bottom nav / `pb-20`) |
| `src/features/provider-kyc/hooks/useProviderKycWizard.ts` | Wizard multi-etapas; prefill; uploads; analytics |
| `src/features/provider-kyc/hooks/useDispatchKyc.ts` | `payment_submit_provider_kyc` + `dispatch-kyc-email` |
| `src/features/provider-kyc/api/kyc.api.ts` | Critérios de status; upload Option A; submit com identidade; prefill `provider_profiles_private` |
| `src/features/provider-kyc/api/providerKyc.rpc.ts` | Nomes das RPCs/Edge KYC |
| `src/features/provider-kyc/api/brazilianBanks.api.ts` | `fetchBrazilianBanks` — BrasilAPI `/banks/v1` + fallback lazy |
| `src/features/provider-kyc/hooks/useBrazilianBanks.ts` | React Query da lista de bancos do `BankPicker` |
| `src/features/provider-kyc/constants/brazilianBanks.ts` | Overrides de nome, mapeamento FEBRABAN, `loadBrazilianBanksFallback` |
| `src/features/provider-kyc/constants/brazilianBanksDefault.json` | Snapshot local carregado sob demanda quando a BrasilAPI falha |
| `src/features/provider-kyc/types/providerKyc.validation.ts` | Schemas Zod por passo; mapeamento `pf`/`pj` |
| `src/features/provider-kyc/components/__tests__/ProviderKycGate.test.tsx` | Cobertura de status e allowlist |
| `src/features/provider-kyc/components/__tests__/ProviderKycForm.test.tsx` | Wizard PJ: `legal-rep-id`, endereço da empresa (`address-proof`), dual-map identity |
| `supabase/functions/dispatch-kyc-email/` | E-mail operacional (default `credenciamento@prestway.com`; env `NETCRED_CREDENCIAMENTO_EMAIL`; local Inbucket/Mailpit se `INBUCKET_SMTP_HOST`, senão Resend) |
| `supabase/migrations/20260802210000_provider_kyc_upload_sessions.sql` | Sessões Option A + janitor `payment_janitor_orphan_kyc_documents` |
| `supabase/migrations/20260801750000_payment_mmd_notification_catalog.sql` (+ `20260801900000_provider_activated_*`, `20260804420000_mmd_service_auto_completed.sql`) | Templates/rotas MMD KYC (submitted, under review, rejected, activated, suspended, **incomplete reminder**) |
| `supabase/migrations/20260801060000_create_provider_gateway_accounts.sql` | FSM `onboarding_status`; colunas/índice de lembrete; trigger bootstrap stub `PENDING_DOCUMENTS` |
| `supabase/migrations/20260801020000_payment_platform_constants_seeds.sql` | Constantes `provider_onboarding_reminder_*` (batch 100, initial 24h, interval 72h, max 8) |
| `supabase/migrations/20260810162641_provider_onboarding_incomplete_reminders.sql` | `enqueue_provider_onboarding_incomplete_reminders` + cron `0 11 * * *` |
| `supabase/tests/payments/payment_provider_onboarding_incomplete_reminders_test.sql` | pgTAP do cron/enqueue de lembretes |

## Documentação pré-existente (planos legados)

| Artefato | Nota |
|----------|------|
| `docs/payment-system-implementation-plan.md` | Plano legado; preferir `docs/payment-system/design.md` + código |
| `docs/payment-system-plan.md` | Idem |
