# Rastreabilidade (código ↔ documentação)

Mapeamento dos principais artefatos analisados para gerar `/docs/business`. Linhas podem referir-se a múltiplos documentos derivados.

## Núcleo de aplicação e roteamento

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/router.tsx` | Rotas, lazy loading, guards, placeholders |
| `src/App.tsx` | Rota index `/` (ver [app-home](./modulos/app-home/README.md)) |
| `docs/business/modulos/README.md` | Índice de módulos, cobertura, lacunas |
| `src/main.tsx` | Bootstrap assíncrono: `initCapacitorPlugins` → `hydratePersistSessionPreference` → `RouterProvider` |
| `src/layouts/DashboardLayout/dashboardMenu.ts` | Menus por papel |
| `src/layouts/DashboardLayout/DashboardLayout.tsx` | Layout autenticado |
| `src/layouts/DashboardLayout/DashboardFakePage.tsx` | Placeholders de seção |

## Autenticação e perfil

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/features/auth/components/routeGuards.tsx` | `ProtectedRoute`, `GuestOnlyRoute` |
| `src/features/auth/hooks/useAuth.tsx` | Sessão, redirect por papel |
| `src/features/auth/types/auth.types.ts` | `ProfileRole`, tipos de perfil |
| `src/features/auth/api/auth.api.ts` | Operações Supabase Auth |
| `src/features/auth/api/profile.api.ts` | Perfil, bloqueio de promoção admin |
| `src/features/auth/hooks/useSignupForm.ts` | reCAPTCHA no cadastro |
| Componentes `Login`, `ClientSignup`, `ProviderSignup`, `ForgotPassword`, `ResetPassword` | Jornadas de auth |

## Features por pasta (`src/features/*`)

| Pasta | APIs / hooks representativos | UI principal |
|-------|------------------------------|--------------|
| `addresses/` | `api/addresses.api.ts`, `api/statesAndCities.api.ts` | `AddressSelectionStep`, `AddressesSection`, `AddressFormDialog` |
| `my-services/` | hooks page/list/filters/cancel (delegam a `view-services`); `pendingPaymentHighlight.ts`, `clientServiceCardPresentation.ts`, `providerServiceCardPresentation.ts` | `ClientMyServicesPage` / `ProviderMyServicesPage`, cards com highlight `PENDING_PAYMENT`, `ReceivedBudgetDetailsSheet` via `negotiation-proposals` |
| `view-services/` | `api/services.api.ts` (RPC `get_service`, `list_services`, `cancel_service_request`, `republish_cancelled_service_request`); hooks list/detail/cancel/republish | `ServiceDetailPage`, `ServiceDetailClientActions` (CTA republicar), `ServiceListCard`, `ServiceSections` |
| `dynamic-form/` | — | `DynamicForm`, `FormDemoPage` |
| `my-account/` | `api/*Profile*.api.ts`, `portfolio.api.ts`, `offeredServices.api.ts` | `MyAccountPage`, `MyAccountClientPage`, `MyAccountProviderPage`, `ServiceAreaField` |
| `provider-jobs/` | `api/providerJobs.api.ts`, `dismissOpportunity.api.ts`; propostas via `negotiation-proposals` | `ProviderJobsPage`, `JobCard`; detalhe via `view-services` |
| `provider-profile/` | hooks + componentes públicos | `ProviderProfilePage` |
| `request-quote/` | `api/createRequestQuoteOrder.api.ts`, `smartDescription.api.ts`, `services.api.ts`, `forms.api.ts`; hooks submit/navigation/draft/IA | `RequestQuote.tsx`, passos 1–5, `ConfirmEmailScreen`, `TrustSidebar`; rascunho `requestQuoteDraft.persistence.ts` |
| `chats/` | `api/chats.api.ts`, `chats.rpc.ts`; hooks lista, thread, mensagens, Realtime | `ChatListPage`, `ChatScreen`, `ChatsLayout` |
| `negotiation-proposals/` | `api/proposals.api.ts`, `api/serviceRequestBudgetCompare.api.ts`, `proposals.rpc.ts`; RPCs `create_provider_proposal`, `get_proposal_detail_for_provider`, `get_proposal_detail_for_participant`; countdown `useProposalCountdown`, `ProposalCountdownBanner` | `ProposalComposerDialog`, `AcceptProposalDialog`, `ReceivedBudgetDetailsSheet`, composer em jobs |
| `service-reschedule/` | `api/serviceReschedule.api.ts`; hooks mutações/detalhe; `deriveRescheduleDateMode`, `mapRescheduleSnapshot` | `ProposeRescheduleDialog` (inclui lembrete dispensável `ProposeRescheduleFlowReminder`), `RequestRescheduleDialog`, cards/ações no chat e no serviço contratado |
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
| `supabase/functions/create-request-quote-order/index.ts` (+ módulos) | Criação atômica de pedido, fotos, rate limit |
| `supabase/functions/generate-smart-description/*` | IA, prompts, uso |
| `supabase/functions/match-provider-jobs/index.ts` | *(Legado — removido)* Lista aberta de jobs |
| `supabase/functions/list-provider-opportunities/*` | Feed progressivo do prestador (visibilidade + cursor) |
| `supabase/functions/verify-recaptcha/index.ts` | Validação Google |
| `supabase/functions/_shared/*` | CORS, rate limit, tipos |
| `supabase/functions/message-dispatcher-worker/*` | Worker de entrega multicanal (Resend/FCM) |
| `supabase/functions/message-dispatcher-webhook-resend/*` | Webhook Resend (delivered, bounce, opened) |
| `supabase/functions/chat-upload-media/*` | Upload de mídia em conversa CNS |
| `supabase/functions/cns_process_domain_events/*` | Processamento de `domain_events` → MMD |

## CNS — conversas e negociação

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/chats/design.md`, `requirements.md` | Especificação normativa; slots §3.3.1 |
| `docs/business/modulos/chats/` | README + [conversas-e-negociacao](./modulos/chats/features/conversas-e-negociacao.md) |
| `supabase/migrations/20260701100000`–`20260701103900` (e correlatas) | Schema CNS, RPCs, RLS, crons, templates MMD |
| `supabase/tests/chats/*.sql` | pgTAP FSM, mensagem livre, concorrência |
| `supabase/migrations/20260705207000`–`20260705209000` | Rename `contracted_services`; RPCs `get_service`, `list_services` |
| `supabase/tests/view-services/view_services_rpcs_test.sql` | pgTAP acesso cliente/prestador, filtros e paginação |
| `supabase/tests/view_services/republish_cancelled_service_request_test.sql` | pgTAP republicação de pedido cancelado (ownership, elegibilidade, idempotência) |
| `src/router.tsx` | Rotas `/chats`, `/chats/:chatId` |
| `e2e/tests/chats.spec.ts` | E2E com mocks (`e2e/mocks/chats.mock.ts`) |
| `docs/chats/wave-a-rollout-checklist.md`, `wave-bf-rollout-runbook.md` | Cutover operacional |

## Message Dispatcher (backend)

| Artefato | Uso na documentação |
|----------|---------------------|
| `supabase/migrations/20260621100100_create_message_dispatcher_fsm_functions.sql` | FSM, RPCs core (ingest, cancel, checkout, report, reconcile), quiet hours, quotas |
| `supabase/tests/message_dispatcher/quiet_hours_helpers_test.sql` | Testes pgTAP dos helpers de horário silencioso |
| `supabase/tests/message_dispatcher/quiet_hours_ingest_reschedule_test.sql` | Testes pgTAP do reagendamento no ingest |
| `supabase/tests/message_dispatcher/quiet_hours_evaluate_pending_test.sql` | Testes pgTAP da rede de segurança no evaluate_pending |
| `src/features/notifications/api/engagementTracking.api.ts` | API client-side para registro de push click |

## Bibliotecas transversais

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/lib/recaptcha.ts` | Cliente reCAPTCHA v3 |
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
| `src/lib/capacitor/constants.ts` | Cor de marca `#0F2F3A` (splash / tema) |
| `capacitor.config.ts` | `appId` `br.com.renovi.orbit`, plugins `SystemBars`, `SplashScreen`, `Keyboard`; `server.url` aponta para dev local (evidência de ambiente de desenvolvimento) |
| `src/features/device-beacon/hooks/useProviderLocationTracking.ts` | Beacon + background geo (Android) → `user_device_beacons` |
| `src/features/device-beacon/utils/locationSync.ts` | Debounce sync de localização operacional |
| `src/features/device-beacon/utils/syncSchedule.ts` | Snapshots de sync em Preferences (`orbit_device_beacon_last_sync_v1`) |
| `src/features/push-permission/utils/pushPermissionPrompt.storage.ts` | Cooldown do prompt de push (`orbit_push_permission_prompt_dismissed_at`) |
| `e2e/fixtures/auth.fixture.ts`, `e2e/helpers/preferencesStorage.ts` | `seedSession` grava em `localStorage` com prefixo `CapacitorStorage.` (espelho do fallback web do plugin) |
| `src/index.css` | `padding-top` com `--safe-area-inset-top` injetado pelo SystemBars no Android WebView |
| `android/app/src/main/res/values/colors.xml`, `drawable/splash.xml` | Splash nativo Android alinhado à cor de marca |
| `package.json` | Dependências `@capacitor/app`, `keyboard`, `splash-screen`, `preferences`, `haptics` — **haptics** instalado, **sem import** em `src/` |

## Reagendamento de serviço contratado

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/service-reschedule/` | README (elegibilidade cliente/prestador em `PENDING_PAYMENT`/`CONFIRMED`; mensagem SYSTEM ao solicitar) + feature propor nova data |
| `docs/cancelamento-reagendamento-servicos/CONTEXT.md` | Glossário de domínio (inclui modo de data na proposta; reagendamento iniciado pelo prestador em `PENDING_PAYMENT` ou `CONFIRMED`) |
| `docs/cancelamento-reagendamento-servicos/details.md` | Fluxo de produto; exemplos de mensagem automática no pedido (com/sem `Observação:`); regra do prestador sem janela de 48h |
| `src/features/service-reschedule/utils/deriveRescheduleDateMode.ts` | Data única vs período a partir de `duration_unit`/`duration_value` |
| `src/features/service-reschedule/types/serviceReschedule.forms.ts` | Validação Zod + `matchesProposalDayDurationISO` |
| `src/features/service-reschedule/components/ProposeRescheduleDialog.tsx` | Duração: “Medido em” → “Tempo estimado”; datas: “Data de execução” / “Data de início” + “Data de fim”; exibe lembrete do fluxo no topo do formulário |
| `src/features/service-reschedule/components/ProposeRescheduleFlowReminder.tsx` | Banner “Como funciona o reagendamento?” (dispensável; visibilidade local à abertura do dialog) |
| `src/features/service-reschedule/utils/mapRescheduleSnapshot.ts` | Lê `duration_unit`/`duration_value` do snapshot |
| `src/features/service-reschedule/utils/rescheduleCardCopy.ts`, `formatRescheduleSlot.ts` | “Data proposta” / “Período proposto”; oculta range se fim nulo ou = início |
| `supabase/migrations/20260802020000_service_reschedule_helpers.sql` | `_cns_validate_reschedule_slot(slot, duration_unit, duration_value)` |
| `supabase/migrations/20260802030000_service_reschedule_rpcs_core.sql` | `cns_request_service_reschedule`: elegibilidade `PENDING_PAYMENT`/`CONFIRMED` (cliente com janela 48h; prestador sem); mensagem SYSTEM; observação opcional com `\n\nObservação: ` |
| `supabase/migrations/20260802130000_service_reschedule_supersede_rounds.sql` (e correlatas `20260802*`) | `_cns_reschedule_snapshot_action_flags` e `cns_propose_service_reschedule`: prestador solicita/propõe em `PENDING_PAYMENT` ou `CONFIRMED`; snapshot com `duration_unit`/`duration_value` |

## Matching progressivo (backend + feed)

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/matching-dispatch/` | README + feature dispatch/visibilidade |
| `docs/matching-algorithm/` | Design técnico e tasks de implementação |
| `docs/matching-algorithm/qa/staging-*-checklist.md` | QA staging geo/batch/MMD |
| `supabase/migrations/202607110*`–`20260711230000_*` | Schema dispatch, discovery, cron, visibilidade, ratings |
| `supabase/functions/list-provider-opportunities/` | Edge feed prestador |
| `supabase/tests/matching/*.sql` | pgTAP matching |
| `e2e/matching/*.spec.ts` | E2E feed + lifecycle |

## Pagamentos (checkout, histórico, reembolso)

| Artefato | Uso na documentação |
|----------|---------------------|
| `docs/business/modulos/payments/` | README + checkout + [historico-e-reembolso](./modulos/payments/features/historico-e-reembolso.md) |
| `docs/payment-system/design.md` | Design normativo (§3.13 views de histórico; §4.8 reembolso) |
| `src/features/payments/components/CheckoutStepper/CardForm.tsx` + `AddCardSheetDialog.tsx` | Tokenização/cadastro de cartão: coleta CPF do titular (enviado à NetCred) e alerta não bloqueante quando o primeiro nome no cartão difere do perfil |
| `src/features/payments/utils/cardholderIdentity.ts` | Conferência auxiliar do primeiro nome (soft check) |
| `src/features/payments/utils/mapPaymentUserMessage.ts` | Mapeamento código → mensagem amigável pt-BR; nunca texto bruto do backend |
| `src/features/payments/utils/manualPaymentErrors.ts` / `paymentApiErrors.ts` | Falhas de cobrança manual e RPC usam o mapper (por código) |
| `src/features/payments/components/ManualPaymentDialog.tsx` + `hooks/useManualPaymentDialog.ts` | Dialog de recuperação (ShellDialog / `useMobileDialogViewport`); fluxo cartão → `InstallmentSelector` → confirmar |
| `src/features/payments/api/cards.api.ts` (`updatePaymentMethod`) | Invoca RPC `payment_update_method` com token, HMAC e `p_installment_number` opcional |
| `supabase/migrations/20260801210000_payment_update_method.sql` | RPC: `p_installment_number` opcional; estados `SCHEDULED`/`FAILED`/`FAILED_PERMANENT`; HMAC ao mudar bandeira/parcelas |
| `supabase/functions/manual-charge-payment/` | Cobrança manual após atualização do método |
| `src/features/payments/components/PaymentHistory/*` | UI histórico cliente/prestador em Minha conta |
| `src/features/payments/utils/clientPaymentHistoryAmounts.ts` | Breakdown: original riscado, líquido, “Reembolsado: …” |
| `src/features/payments/api/history.api.ts` | Leitura das views de histórico |
| `supabase/migrations/20260801140000_create_payment_history_views.sql` | `client_payment_transactions_v`; `provider_payment_receivables_v` (clawback só com `refunded_at`) |
| `payment_begin_refund_request` (migrations `20260801360000_*` / supersedidas) | `REFUND_REQUESTED` + `refunded_amount` esperado sem `refunded_at` |
| `supabase/functions/process-refund/` | Edge de estorno |
| `supabase/functions/netcred-webhook/` + `payment_process_webhook_event` | Confirma reembolso e define `refunded_at` |

## Documentação pré-existente (planos legados)

| Artefato | Nota |
|----------|------|
| `docs/payment-system-implementation-plan.md` | Plano legado; preferir `docs/payment-system/design.md` + código |
| `docs/payment-system-plan.md` | Idem |
