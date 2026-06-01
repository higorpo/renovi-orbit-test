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
| `client-budgets/` | `api/clientBudgets.api.ts` | `ClientBudgetsPage`, sheets |
| `client-my-services/` | `api/serviceRequests.api.ts` (list + cancel); hooks page/list/filters/cancel | `ClientMyServicesPage`, cards, sheets (`OpenServiceDetailsSheet`), `client-budgets` sheets, placeholder detalhe |
| `dynamic-form/` | — | `DynamicForm`, `FormDemoPage` |
| `my-account/` | `api/*Profile*.api.ts`, `portfolio.api.ts`, `offeredServices.api.ts` | `MyAccountPage`, `MyAccountClientPage`, `MyAccountProviderPage`, `ServiceAreaField` |
| `provider-budgets/` | `api/providerBudgets.api.ts`, hooks `useProviderSentBudgets` / `useProviderOwnQuestions`, contadores pendentes | `ProviderBudgetsShell`, `ProviderBudgetsPage`, cards; RPCs em `20260322000000_create_provider_budgets_rpcs.sql` |
| `provider-jobs/` | `api/providerJobs.api.ts`, `providerProposals.api.ts`, `providerJobQuestions.api.ts` | `ProviderJobsShell`, `JobDetailPage` |
| `provider-profile/` | hooks + componentes públicos | `ProviderProfilePage` |
| `request-quote/` | `api/createRequestQuoteOrder.api.ts`, `smartDescription.api.ts`, `services.api.ts`, `forms.api.ts`; hooks submit/navigation/draft/IA | `RequestQuote.tsx`, passos 1–5, `ConfirmEmailScreen`, `TrustSidebar`; rascunho `requestQuoteDraft.persistence.ts` |
| `chats/` | `api/chats.api.ts`, `chats.rpc.ts`; hooks lista, thread, mensagens, Realtime | `ChatListPage`, `ChatScreen`, `ChatsLayout` |
| `negotiation-proposals/` | `api/proposals.rpc.ts`; hooks mutações cliente/prestador | `ProposalCard`, `AcceptProposalDialog`, composer em jobs |
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
| `supabase/functions/match-provider-jobs/index.ts` | Lista de jobs |
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
| `src/features/device-beacon/utils/syncSchedule.ts` | Snapshots de sync em Preferences (`orbit_device_beacon_last_sync_v1`) |
| `src/features/push-permission/utils/pushPermissionPrompt.storage.ts` | Cooldown do prompt de push (`orbit_push_permission_prompt_dismissed_at`) |
| `e2e/fixtures/auth.fixture.ts`, `e2e/helpers/preferencesStorage.ts` | `seedSession` grava em `localStorage` com prefixo `CapacitorStorage.` (espelho do fallback web do plugin) |
| `src/index.css` | `padding-top` com `--safe-area-inset-top` injetado pelo SystemBars no Android WebView |
| `android/app/src/main/res/values/colors.xml`, `drawable/splash.xml` | Splash nativo Android alinhado à cor de marca |
| `package.json` | Dependências `@capacitor/app`, `keyboard`, `splash-screen`, `preferences`, `haptics` — **haptics** instalado, **sem import** em `src/` |

## Documentação pré-existente (não como fonte de comportamento)

| Artefato | Nota |
|----------|------|
| `docs/payment-system-implementation-plan.md` | Plano; não confundir com implementação atual |
| `docs/payment-system-plan.md` | Idem |
