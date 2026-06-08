# Meus serviços (`my-services`)

## 1. Leitura para negócio

- **Para que serve:** lista unificada de **pedidos em acompanhamento** para **cliente** e **prestador** na mesma rota `/dashboard/services`, com UI por papel.
- **Cliente:** vê pedidos solicitados; busca, filtros, abas por fase, deep link `?serviceRequestId=`, sheet comparar/histórico de orçamentos, cancelamento.
- **Prestador:** pipeline de propostas/contratos enviados (descoberta permanece em **Trabalhos**); card pipeline com status da proposta, conversa e detalhe.
- **Dados:** `view-services` (`list_services`, `get_service`, `cancel_service_request`); detalhe em `/dashboard/services/:id`.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rota lista | `/dashboard/services` — `MyServicesRouteSlot` (cliente ou prestador por `profile.role`) |
| Detalhe | `/dashboard/services/:id` — `ServiceDetailShell` (`view-services`) |
| Cliente | `ClientMyServicesPage` → `MyServicesPageShell` + `ServiceListCard` |
| Prestador | `ProviderMyServicesPage` → `MyServicesPageShell` + `ProviderServiceListCard` |
| Dados lista | `useMyServicesList` → `useServicesList` → RPC `list_services` |
| Deep link (cliente) | `?serviceRequestId=` — `getMyServicesPageUrlWithFocus` |
| Orçamentos (cliente) | `ReceivedBudgetDetailsSheet` (`negotiation-proposals`) |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md) | Fluxo cliente (abas, filtros, card, sheet) |
| [Comparar orçamentos / histórico](../chats/features/comparar-orcamentos-meus-servicos.md) | Sheet `ReceivedBudgetDetailsSheet` |
| [Visualização de serviços (RPC)](../view-services/features/visualizacao-de-servicos.md) | Contrato `ServiceModel`, RPCs, fases |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| Roteamento | `components/MyServicesRouteSlot.tsx` |
| Shell compartilhado | `components/MyServicesPageShell.tsx`, `components/shared/*` |
| Cliente | `components/client/ClientMyServicesPage.tsx`, hooks `useClientMyServicesPage.ts` |
| Prestador | `components/provider/ProviderMyServicesPage.tsx`, `ProviderServiceListCard.tsx`, `useProviderMyServicesPage.ts` |
| Core | `hooks/useMyServicesPageCore.ts`, `useMyServicesList.ts`, `useMyServicesFilters.ts` |
| Tipos / rotas | `types/my-services.types.ts`, `constants/routes.ts` |

## 5. Integrações

- **`view-services`** — lista, detalhe, cancelamento (cliente), fases, `ServiceModel` enriquecido (`myProposal`, `chatSummary`, `lastActivityAt` para prestador).
- **`negotiation-proposals`** — sheet compare/history (cliente).
- **`chats`** — ação primária no card prestador.
- **`provider-jobs`** — descoberta de oportunidades (fora desta lista).

## 6. API pública (`index.ts`)

Exporta: `MyServicesRouteSlot`, `ClientMyServicesPage`, `ProviderMyServicesPage`, `ROUTE_MY_SERVICES_LIST`, `getMyServicesPageUrlWithFocus`, `SERVICE_REQUEST_FOCUS_QUERY`.

## 7. Migração / schema

- RPCs `get_service`, `list_services` — enriquecimento `my_proposal` / `chat` / ordenação por `last_activity_at` (migration `20260710120000_enrich_project_service_row_provider_list.sql`).
