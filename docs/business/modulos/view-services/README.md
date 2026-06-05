# Visualização de serviços (`view-services`)

## 1. Leitura para negócio

- **Para que serve:** módulo **agnóstico de papel** que expõe lista e detalhe unificados de um **pedido** (`service_request_id`) para cliente e prestador. O escopo (quais pedidos aparecem e o que cada um vê) é resolvido no servidor via `auth.uid()` + `profiles.role`.
- **Quem usa:** hoje o **cliente** consome via `client-my-services` (lista) e rota de detalhe; o **prestador** pode consumir os mesmos hooks/RPCs em telas futuras sem mudar contrato.
- **Valor:** um único shape (`ServiceModel`) para lista e detalhe, evitando drift entre telas; fase de produto (`list_phase`) calculada no SQL.
- **ID canônico:** `service_request_id` — rota `/dashboard/services/:id`.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Lista | RPC `list_services(...)` — paginação, filtros, `list_phase` |
| Detalhe | RPC `get_service(p_service_request_id)` |
| Cancelamento (cliente) | RPC `cancel_service_request` via `cancelService` na API TS |
| Tabela de contrato | `contracted_services` (antes `services`) |
| Modelo front | `ServiceModel` + `ServiceListPhase` |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/visualizacao-de-servicos.md](./features/visualizacao-de-servicos.md) | RPCs, fases, escopo por papel, API/hooks, componentes |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| API | `api/services.api.ts` (somente `supabase.rpc()`) |
| Tipos | `types/service.types.ts` |
| Hooks | `hooks/useServicesList.ts`, `useService.ts`, `useCancelService.ts` |
| Página detalhe | `components/ServiceDetailPage.tsx`, `ServiceSections.tsx`, … |
| Card lista | `components/ServiceListCard.tsx` |
| Constantes | `constants/queryKeys.ts`, `routes.ts`, `statusTabs.ts`, `statusBadge.ts` |
| SQL | `supabase/migrations/20260705207000_*`, `20260705208000_*`, `20260705209000_*` |
| Testes pgTAP | `supabase/tests/view-services/view_services_rpcs_test.sql` |

## 5. Integrações

- **`client-my-services`** — shell de listagem do cliente; delega para `useServicesList` / navega para detalhe.
- **`negotiation-proposals`** — invalida `SERVICES_LIST_QUERY_KEY` e `SERVICE_DETAIL_QUERY_KEY` após mutações de proposta.
- **`chats`** — negociação in-app; prestador com proposta ou contrato enxerga o pedido nas RPCs.

## 6. API pública (`index.ts`)

Exporta: `ServiceDetailPage`, `ServiceListCard`, `getServiceById`, `listServices`, `cancelService`, hooks, tipos, query keys, rotas, helpers de status/abas.

## 7. Fora de escopo (nesta entrega)

- UI de listagem para prestador (RPC já suporta).
- Pool geográfico `match_provider_jobs` na listagem.
- Unificação com `provider-budgets` / `provider-jobs`.
