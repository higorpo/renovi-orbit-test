# Rastreabilidade (código ↔ documentação)

Mapeamento dos principais artefatos analisados para gerar `/docs/business`. Linhas podem referir-se a múltiplos documentos derivados.

## Núcleo de aplicação e roteamento

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/router.tsx` | Rotas, lazy loading, guards, placeholders |
| `src/main.tsx` | Montagem do `RouterProvider` |
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
| `client-my-services/` | `api/serviceRequests.api.ts` | `ClientMyServicesPage` |
| `dynamic-form/` | — | `DynamicForm`, `FormDemoPage` |
| `my-account/` | `api/*Profile*.api.ts`, `portfolio.api.ts`, `offeredServices.api.ts` | `MyAccountPage`, `MyAccountClientPage`, `MyAccountProviderPage`, `ServiceAreaField` |
| `provider-budgets/` | `api/providerBudgets.api.ts` | `ProviderBudgetsShell`, página |
| `provider-jobs/` | `api/providerJobs.api.ts`, `providerProposals.api.ts`, `providerJobQuestions.api.ts` | `ProviderJobsShell`, `JobDetailPage` |
| `provider-profile/` | hooks + componentes públicos | `ProviderProfilePage` |
| `request-quote/` | `api/createRequestQuoteOrder.api.ts`, `smartDescription.api.ts`, `services.api.ts`, `forms.api.ts` | `RequestQuote.tsx`, steps |
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

## Bibliotecas transversais

| Artefato | Uso na documentação |
|----------|---------------------|
| `src/lib/recaptcha.ts` | Cliente reCAPTCHA v3 |
| `src/lib/logger.ts` / `src/lib/sentry.ts` | Observabilidade (mencionado onde impacta fluxo) |

## Documentação pré-existente (não como fonte de comportamento)

| Artefato | Nota |
|----------|------|
| `docs/payment-system-implementation-plan.md` | Plano; não confundir com implementação atual |
| `docs/payment-system-plan.md` | Idem |
