# Meus serviços / pedidos do cliente (`client-my-services`)

## 1. Leitura para negócio

- **Para que serve:** o cliente **vê e organiza os pedidos** que fez na plataforma: busca, filtros, abas por fase (`negotiation`, `in_progress`, `completed`, `cancelled`), deep link `?serviceRequestId=`, sheet de **comparar/histórico de orçamentos** e navegação para **detalhe em página**.
- **Quem usa:** principalmente **cliente**; a rota do dashboard também aparece no menu do **prestador** como “Solicitações” com o mesmo path — a tela é construída para o cliente.
- **Valor:** reduz “cadê meu pedido?” e concentra follow-up de propostas (sheet + Conversas).
- **Dados:** lista e cancelamento delegam para **`view-services`** (RPCs `list_services`, `cancel_service_request`); detalhe em `/dashboard/services/:id` via `ServiceDetailPage` do mesmo módulo base.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Lista | `/dashboard/requests` — `ClientMyServicesPage` |
| Detalhe | `/dashboard/services/:id` — `ServiceDetailPage` (`view-services`) |
| Dados lista | `useClientMyServicesList` → `useServicesList` → RPC `list_services` |
| Deep link | `?serviceRequestId=` — `getServiceRequestsPageUrlWithFocus` |
| Orçamentos | `negotiation-proposals`: `ReceivedBudgetDetailsSheet` |
| Cancelamento | `useClientMyServicesCancel` → `useCancelService` → RPC `cancel_service_request` |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md) | Abas, filtros, busca, foco URL, card, ações, integração view-services |
| [Comparar orçamentos / histórico](../chats/features/comparar-orcamentos-meus-servicos.md) | Sheet `ReceivedBudgetDetailsSheet` |
| [Visualização de serviços (RPC)](../view-services/features/visualizacao-de-servicos.md) | Contrato `ServiceModel`, RPCs, fases |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| Página | `components/ClientMyServicesPage.tsx` |
| Lista UX | `ClientMyServicesHeader.tsx`, `ClientMyServicesSearchBar.tsx`, `ClientMyServicesFiltersBar.tsx`, `ClientMyServicesStatusTabs.tsx`, `ClientMyServicesFocusBanner.tsx`, `ClientMyServicesCardSkeleton.tsx` |
| Estados | `ClientMyServicesEmptyState.tsx`, `ClientMyServicesNoFilterResultsState.tsx`, `ClientMyServicesErrorState.tsx` |
| Hooks | `useClientMyServicesPage.ts`, `useClientMyServicesList.ts`, `useClientMyServicesFilters.ts`, `useClientMyServicesCancel.ts` |
| Tipos / rotas lista | `types/client-my-services.types.ts`, `constants/routes.ts`, `constants/statusTabs.ts` (re-export de `view-services`) |
| Card | `ServiceListCard` importado de `@/features/view-services` |

**Removidos nesta refatoração:** `api/serviceRequests.api.ts`, sheets/placeholder de detalhe local, mappers PostgREST, `ClientMyServicesCard`.

## 5. Integrações

- **`view-services`** — lista, detalhe, cancelamento, card, abas/fases.
- **`negotiation-proposals`** — sheet compare/history; invalida query keys de `view-services`.
- **`chats`** — negociação in-app.
- **`request-quote`** — origem dos pedidos listados.

## 6. API pública do pacote (`index.ts`)

Exporta: `ClientMyServicesPage`, `getServiceRequestsPageUrlWithFocus`, `SERVICE_REQUEST_FOCUS_QUERY`, `ROUTE_SERVICE_REQUESTS_LIST`.

## 7. Migração / schema

- `service_requests` + `contracted_services` (rename de `services`).
- RPCs `get_service`, `list_services` — ver `view-services`.
