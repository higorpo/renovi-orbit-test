# Visualização de serviços (RPC + ServiceModel)

Documentação baseada em `src/features/view-services/` e migrations `20260705207000`–`20260705209000`.

---

## 1. Visão geral

| Item | Descrição |
|------|-----------|
| **Objetivo** | Lista e detalhe unificados de pedidos (`service_requests`) com contrato JSON estável para cliente e prestador. |
| **Rotas** | **`/dashboard/services/:id`** — `ServiceDetailPage` (lazy no router). Lista do cliente permanece em `my-services` (`/dashboard/services`). |
| **Backend** | RPCs `get_service`, `list_services`; helper SQL `project_service_row`; tabela `contracted_services`. |
| **Sem PostgREST** | A API TS não usa `.from()` nem embeds para listagem/detalhe. |

---

## 2. Fases de produto (`ServiceListPhase` / `list_phase`)

Calculadas em SQL (`derive_service_list_phase`):

| Fase | Cliente (dono do SR) | Prestador (com envolvimento) |
|------|----------------------|------------------------------|
| `negotiation` | `sr.status = OPEN` | `sr.status = OPEN` e tem proposta, contrato ou chat com ele |
| `in_progress` | `sr COMPLETED` + `contracted_services` ativo | `cs.provider_id = viewer` + status ativo |
| `completed` | `sr COMPLETED` + `cs.status = COMPLETED` | idem |
| `cancelled` | `sr CANCELLED` ou contrato cancelado | cancelamento do SR onde participou ou `cs CANCELLED` dele |

**Escopo do prestador na listagem:** pedidos em que já tem `provider_proposals`, `chats` (conversa iniciada) ou é `contracted_services.provider_id`. Não inclui pool de `match_provider_jobs`.

---

## 3. RPCs

### `get_service(p_service_request_id uuid) → jsonb`

- Exige `auth.uid()`.
- Valida acesso via `service_viewer_has_access` (cliente dono, prestador com proposta/contrato, ou admin).
- Retorna payload montado por `project_service_row`.

### `list_services(...) → jsonb`

Parâmetros espelham filtros da antiga listagem PostgREST:

| Parâmetro | Uso |
|-----------|-----|
| `p_page`, `p_page_size` | Paginação (1–100) |
| `p_list_phase` | Filtro de aba (`negotiation`, `in_progress`, …) |
| `p_search` | ILIKE em título/descrição |
| `p_category_title`, `p_city_name`, `p_neighborhood` | Filtros de barra |
| `p_date_from`, `p_date_to` | `created_at` |
| `p_has_images`, `p_has_proposals` | Filtros booleanos (escopo do viewer) |

Retorno: `{ items, total_count, page, page_size }` — cada item com o mesmo shape de `get_service`.

### Cancelamento

`cancelService` na API TS chama RPC existente **`cancel_service_request`** (somente cliente).

---

## 4. Frontend

| Camada | Responsável |
|--------|-------------|
| API | `services.api.ts` — `getServiceById`, `listServices`, `cancelService` |
| Mapper | `serviceMapper.ts` — RPC JSON → `ServiceModel` |
| Lista | `useServicesList` + `ServiceListCard` |
| Detalhe | `useService` + `ServiceDetailPage` + seções condicionais por `listPhase` |
| Query keys | `["view-services", "list"]`, `["view-services", "detail"]` |

---

## 5. Shape `ServiceModel` (resumo)

- `id` — `service_request_id`
- `listPhase` — fase de produto
- `request` — título, descrição, fotos, endereço, `platform_service`, …
- `negotiation` — `proposalCount`, `hasPendingProposal`
- `contracted` — dados do contrato + provider (quando existir)
- `counterparty` — cliente vê prestador; prestador vê cliente mascarado

---

## 6. Evidências no código

- `src/features/view-services/**/*`
- `supabase/migrations/20260705207000_rename_services_to_contracted_services.sql`
- `supabase/migrations/20260705208000_create_view_services_rpcs.sql`
- `supabase/migrations/20260705209000_fix_list_services_cte_scope.sql`
- `supabase/tests/view-services/view_services_rpcs_test.sql`
