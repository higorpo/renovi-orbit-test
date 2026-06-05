# Módulos da aplicação Orbit — índice e cobertura documental

Este diretório concentra a **documentação funcional e técnica por módulo**, alinhada ao código em `src/features/`, `src/layouts/`, `src/router.tsx` e backend Supabase (migrations, Edge Functions).

## Inventário de módulos e telas (evidência: `src/router.tsx`, `src/layouts/DashboardLayout/dashboardMenu.ts`)

| # | Módulo | Telas / superfícies principais | Rotas (path) | Caminho no código | Status doc |
|---|--------|--------------------------------|--------------|-------------------|------------|
| 1 | [auth](./auth/README.md) | Login, cadastro cliente/profissional, esqueci senha, redefinir senha | `/login`, `/cadastro/cliente`, `/cadastro/profissional`, `/esqueceu-senha`, `/recuperar-senha` | `src/features/auth/` | Concluída |
| 2 | [request-quote](./request-quote/README.md) | Wizard pedir orçamento | `/pedir-orcamento` | `src/features/request-quote/` | Concluída |
| 3 | [addresses](./addresses/README.md) | Seleção/CRUD endereços (embutido em fluxos) | *Sem rota dedicada funcional*; menu aponta para placeholder | `src/features/addresses/` | Concluída |
| 4 | [my-account](./my-account/README.md) | Minha conta cliente/prestador | `/dashboard/conta` | `src/features/my-account/` | Concluída |
| 5 | [client-my-services](./client-my-services/README.md) | Lista de pedidos (shell); sheet compare/histórico | `/dashboard/requests` | `src/features/client-my-services/` | Concluída |
| 5b | [view-services](./view-services/README.md) | Lista/detalhe unificados (RPC); agnóstico de papel | `/dashboard/services/:id` (+ consumo por client-my-services) | `src/features/view-services/` | Concluída |
| 6 | [provider-jobs](./provider-jobs/README.md) | Trabalhos, detalhe, propostas, perguntas | `/dashboard/jobs`, `/dashboard/jobs/:jobId` | `src/features/provider-jobs/` | Concluída |
| 7 | [provider-budgets](./provider-budgets/README.md) | Orçamentos enviados / minhas perguntas | `/dashboard/budgets`, `/dashboard/budgets/pedido/:serviceRequestId` | `src/features/provider-budgets/` | Concluída |
| 8 | [provider-profile](./provider-profile/README.md) | Perfil público do prestador | `/perfil/:slug` | `src/features/provider-profile/` | Concluída |
| 9 | [dynamic-form](./dynamic-form/README.md) | Motor de formulários + demo DEV | `/demo/form` (somente `import.meta.env.DEV`) | `src/features/dynamic-form/` | Concluída |
| 10 | [dashboard-shell](./dashboard-shell/README.md) | Placeholders do dashboard (visão geral, endereços, config, ajuda, ganhos) | `/dashboard`, `/dashboard/addresses`, `/dashboard/settings`, `/dashboard/help`, `/dashboard/earnings` | `src/layouts/DashboardLayout/` | Concluída |
| 11 | [app-home](./app-home/README.md) | Página inicial mínima | `/` (index) | `src/App.tsx` | Concluída |
| 12 | [message-dispatcher](./message-dispatcher/README.md) | Notificações multicanal (e-mail, push); horário silencioso, quotas, FSM | *Sem rota de UI; backend-only* | `supabase/migrations/`, `supabase/functions/message-dispatcher-*` | Parcial (quiet hours) |
| 13 | [chats](./chats/README.md) | Conversas e negociação (CNS): lista, thread, propostas; sheet compare/history | `/dashboard/chats`, `/dashboard/chats/:chatId` | `src/features/chats/`, `src/features/negotiation-proposals/` | Concluída |

> **Descontinuado:** [client-budgets](./client-budgets/README.md) — rota `/dashboard/orcamentos` removida; ver `client-my-services` + `negotiation-proposals`.

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
| Módulos identificados no escopo do produto (features + shell + home + backend + CNS) | **13** |
| Módulos documentados (critério acima) | **13** |
| **Percentual** | **100%** |

Os diretórios em `src/features/` com produto documentado neste índice incluem **`chats`** e **`negotiation-proposals`** (agrupados em [chats](./chats/README.md)); **`client-budgets` foi removido**. Outras pastas (`device-beacon`, `push-permission`, `notifications`, etc.) aparecem na [rastreabilidade](../rastreabilidade.md) sem README em `modulos/`. Acrescentam-se **dashboard-shell**, **app-home** e **message-dispatcher**.

---

## Dependências entre módulos (visão rápida)

- **auth** → base de sessão e guards para todo o dashboard.
- **dynamic-form** → usado por **request-quote** (passo 2).
- **addresses** → usado por **request-quote** (passo 4) e **my-account** (`AddressesSection`).
- **provider-jobs** → **provider-budgets** reutiliza `JobDetailSheet` / `JobDetailPage`.
- **negotiation-proposals** → sheet `ReceivedBudgetDetailsSheet` consumido por **client-my-services**; composer/propostas também em **provider-jobs** e **chats**.
- **provider-jobs** → URLs assinadas de fotos de proposta via **`negotiation-proposals`** (`useProposalPhotoUrls`).
- **chats** + **negotiation-proposals** → negociação in-app por pedido; integra **message-dispatcher** (notificações), **provider-jobs** (origem do pedido), **client-my-services** (lista + sheet compare/history).

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
3. **provider-jobs + provider-budgets** — RPCs, edge `match-provider-jobs`, filtros, composição de proposta/pergunta.
4. **client-my-services, my-account, provider-profile** — shells, sheets, RPCs cliente, storage buckets.
5. **dynamic-form + DashboardFakePage + App** — demo DEV, placeholders, home.

Consolidação e arquivos novos/atualizados: índice (este README), [dashboard-shell](./dashboard-shell/README.md), [app-home](./app-home/README.md), atualização da [matriz de cobertura documental](../matriz-cobertura-documental.md).

---

## Documentação de negócio relacionada

- [Mapa de módulos e features](../02-mapa-de-modulos-e-features.md)
- [Perfis e permissões](../perfis-e-permissoes.md)
- [Glossário](../glossario-de-negocio.md)
- [Rastreabilidade](../rastreabilidade.md)
- [Pendências e incertezas](../pendencias-e-incertezas.md)
