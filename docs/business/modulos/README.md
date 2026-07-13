# Módulos da aplicação Orbit — índice e cobertura documental

Este diretório concentra a **documentação funcional e técnica por módulo**, alinhada ao código em `src/features/`, `src/layouts/`, `src/router.tsx` e backend Supabase (migrations, Edge Functions).

## Inventário de módulos e telas (evidência: `src/router.tsx`, `src/layouts/DashboardLayout/dashboardMenu.ts`)

| # | Módulo | Telas / superfícies principais | Rotas (path) | Caminho no código | Status doc |
|---|--------|--------------------------------|--------------|-------------------|------------|
| 1 | [auth](./auth/README.md) | Login, cadastro cliente/profissional, esqueci senha, redefinir senha | `/login`, `/cadastro/cliente`, `/cadastro/profissional`, `/esqueceu-senha`, `/recuperar-senha` | `src/features/auth/` | Concluída |
| 2 | [request-quote](./request-quote/README.md) | Wizard pedir orçamento | `/pedir-orcamento` | `src/features/request-quote/` | Concluída |
| 3 | [addresses](./addresses/README.md) | Seleção/CRUD endereços (embutido em fluxos) | *Sem rota dedicada funcional*; menu aponta para placeholder | `src/features/addresses/` | Concluída |
| 4 | [my-account](./my-account/README.md) | Minha conta cliente/prestador | `/dashboard/conta` | `src/features/my-account/` | Concluída |
| 5 | [my-services](./my-services/README.md) | Lista de pedidos (shell); sheet compare/histórico | `/dashboard/services` | `src/features/my-services/` | Concluída |
| 5b | [view-services](./view-services/README.md) | Lista/detalhe unificados (RPC); agnóstico de papel | `/dashboard/services/:id` (+ consumo por my-services) | `src/features/view-services/` | Concluída |
| 6 | [provider-jobs](./provider-jobs/README.md) | Trabalhos, detalhe, propostas, perguntas | `/dashboard/jobs`, `/dashboard/jobs/:jobId` | `src/features/provider-jobs/` | Concluída |
| 7 | [provider-profile](./provider-profile/README.md) | Perfil público do prestador | `/perfil/:slug` | `src/features/provider-profile/` | Concluída |
| 8 | [dynamic-form](./dynamic-form/README.md) | Motor de formulários + demo DEV | `/demo/form` (somente `import.meta.env.DEV`) | `src/features/dynamic-form/` | Concluída |
| 9 | [dashboard-shell](./dashboard-shell/README.md) | Placeholders do dashboard (visão geral, endereços, config, ajuda, ganhos) | `/dashboard`, `/dashboard/addresses`, `/dashboard/settings`, `/dashboard/help`, `/dashboard/earnings` | `src/layouts/DashboardLayout/` | Concluída |
| 10 | [app-home](./app-home/README.md) | Página inicial mínima | `/` (index) | `src/App.tsx` | Concluída |
| 11 | [message-dispatcher](./message-dispatcher/README.md) | Notificações multicanal (e-mail, push); horário silencioso, quotas, FSM | *Sem rota de UI; backend-only* | `supabase/migrations/`, `supabase/functions/message-dispatcher-*` | Parcial (quiet hours) |
| 12 | [chats](./chats/README.md) | Conversas e negociação (CNS): lista, thread, propostas; sheet compare/history | `/dashboard/chats`, `/dashboard/chats/:chatId` | `src/features/chats/`, `src/features/negotiation-proposals/` | Concluída |
| 13 | [matching-dispatch](./matching-dispatch/README.md) | Dispatch progressivo, lotes, visibilidade, gates; feed via Edge | *Sem rota de UI; backend + Edge `list-provider-opportunities`* | `supabase/migrations/202607110*`, `supabase/functions/list-provider-opportunities/` | Concluída |
| 14 | [service-reschedule](./service-reschedule/README.md) | Reagendamento de serviço contratado (`PENDING_PAYMENT`/`CONFIRMED`); propor nova data/período conforme duração | Embutido em chats e detalhe do serviço | `src/features/service-reschedule/`, migrations `20260802*` | Parcial (propor nova data + elegibilidade) |
| 15 | [payments](./payments/README.md) | Checkout, cobrança T-2 (gross-up NetCred), KYC; histórico cliente/prestador e reembolso | Checkout pós-aceite; histórico em `/dashboard/conta` | `src/features/payments/`, RPCs `payment_*`, EFs NetCred | Concluída (checkout + histórico/reembolso) |

> **Descontinuado:** [client-budgets](./client-budgets/README.md) — rota `/dashboard/orcamentos` removida; ver `my-services` + `negotiation-proposals`.

### Rotas adicionais fora da tabela (evidência direta)

| Rota | Elemento | Observação |
|------|----------|------------|
| `/example` | `div` estático | `ProtectedRoute` apenas `client`; não é módulo em `src/features/` |
| `/dashboard/settings` | `DashboardFakePage` | Ver [dashboard-shell](./dashboard-shell/README.md) |

---

## Critério de “módulo documentado”

Um módulo conta como documentado quando o conjunto **README do módulo + arquivo(s) em `features/`** cobre, com referência a arquivos de código:

- visão geral e contexto de negócio;
- telas/rotas (ou ausência de rota quando o módulo é biblioteca);
- ações principais e integrações (API, RPC, Edge, storage);
- campos/validações **onde existem formulários** (ou referência explícita ao schema);
- regras de negócio verificáveis no código;
- perfis com acesso (guards / router);
- entidades/tabelas ou contratos de API envolvidos;
- evidências (paths) e lacunas sinalizadas.

---

## Cobertura

| Métrica | Valor |
|---------|------:|
| Módulos identificados no escopo do produto (features + shell + home + backend + CNS + reagendamento + pagamentos) | **15** |
| Módulos documentados (critério acima) | **15** |
| **Percentual** | **100%** (cobertura do critério; `service-reschedule` ainda **parcial** no ciclo completo de estados) |

Os diretórios em `src/features/` com produto documentado neste índice incluem **`chats`** e **`negotiation-proposals`** (agrupados em [chats](./chats/README.md)), **`service-reschedule`** e **`payments`**; **`client-budgets` foi removido**. Acrescentam-se **dashboard-shell**, **app-home**, **message-dispatcher** e **matching-dispatch** (backend). Outras pastas (`device-beacon`, `push-permission`, `notifications`, etc.) aparecem na [rastreabilidade](../rastreabilidade.md) sem README em `modulos/`.

---

## Dependências entre módulos (visão rápida)

- **auth** → base de sessão e guards para todo o dashboard.
- **dynamic-form** → usado por **request-quote** (passo 2).
- **addresses** → usado por **request-quote** (passo 4) e **my-account** (`AddressesSection`).
- **provider-jobs** → propostas e negociação via **chats** / **negotiation-proposals**; detalhe unificado em **view-services**; feed via **matching-dispatch** (`list-provider-opportunities`).
- **negotiation-proposals** → sheet `ReceivedBudgetDetailsSheet` consumido por **my-services**; composer/propostas também em **provider-jobs** e **chats**.
- **chats** + **negotiation-proposals** → negociação in-app por pedido; integra **message-dispatcher** (notificações), **provider-jobs** (origem do pedido), **my-services** (lista + sheet compare/history).
- **service-reschedule** → propor/aceitar nova data de serviço contratado; UI embutida em **chats** e **view-services**; duração alinhada à proposta aceita (**negotiation-proposals**).
- **payments** → checkout pós-aceite (**negotiation-proposals** / **chats**); histórico embutido em **my-account**; cancelamento pós-pagamento via **view-services** / CNS.

---

## Principais lacunas conhecidas (produto vs código)

1. **`/dashboard/addresses`** renderiza `DashboardFakePage` (“Página em construção”) enquanto a gestão real de endereços está em **Minha conta** e no wizard — evidência: `src/router.tsx`, `MyAccountClientPage.tsx`.
2. **`/dashboard/services/:id`** é placeholder (`ClientMyServicesDetailPlaceholder`) — evidência: `src/router.tsx`.
3. **Pós-sucesso do pedido de orçamento (logado):** há menção em documentação de rota de navegação possivelmente inconsistente com o router; validar em `useRequestQuoteSubmit` / `RequestQuote` (pendência de QA).
4. **Papel `admin`:** existe no tipo de perfil; **sem** área administrativa mapeada no `router.tsx` para este repositório.
5. **`/example`:** rota de exemplo, não documentada como módulo de negócio.
6. **`/dashboard/chats`:** rota CNS ativa no router e item **Conversas** no menu cliente e prestador (`dashboardMenu.ts`).

---

## Subagentes utilizados nesta rodada de orquestração

Análise em paralelo (exploração baseada em código):

1. **Auth + guards** — rotas guest, `ProtectedRoute` / `GuestOnlyRoute`, telas, APIs `auth.api` / `profile.api`, schemas Zod.
2. **request-quote + addresses** — passos do wizard, Edge `create-request-quote-order`, `generate-smart-description`, rascunho local, analytics.
3. **provider-jobs** — RPCs, edge `match-provider-jobs`, filtros, composição de proposta.
4. **my-services, my-account, provider-profile** — shells, sheets, RPCs cliente, storage buckets.
5. **dynamic-form + DashboardFakePage + App** — demo DEV, placeholders, home.

Consolidação e arquivos novos/atualizados: índice (este README), [dashboard-shell](./dashboard-shell/README.md), [app-home](./app-home/README.md), atualização da [matriz de cobertura documental](../matriz-cobertura-documental.md).

---

## Documentação de negócio relacionada

- [Mapa de módulos e features](../02-mapa-de-modulos-e-features.md)
- [Perfis e permissões](../perfis-e-permissoes.md)
- [Glossário](../glossario-de-negocio.md)
- [Rastreabilidade](../rastreabilidade.md)
- [Pendências e incertezas](../pendencias-e-incertezas.md)
