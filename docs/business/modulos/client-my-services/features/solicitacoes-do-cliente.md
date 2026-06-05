# Solicitações do cliente (Meus Serviços)

Documentação baseada em `src/features/client-my-services/` e integração com `view-services`, `negotiation-proposals` e `request-quote`.

---

## 1. Visão geral

| Item | Descrição |
|------|-----------|
| **Objetivo** | Listar e gerenciar **pedidos** do cliente autenticado: filtros, busca, abas por fase, deep link, sheet de orçamentos e navegação para detalhe em página. |
| **Rotas** | **`/dashboard/requests`** — `ClientMyServicesPage`. **`/dashboard/services/:id`** — `ServiceDetailPage` (`view-services`). |
| **Menu** | Cliente: **“Meus Serviços”**. Prestador: **“Solicitações”** (mesmo path; UI voltada ao cliente). |
| **Dados** | RPCs `list_services` e `get_service` via `view-services`; cancelamento via `cancel_service_request`. |

---

## 2. Arquitetura da página

| Camada | Responsável |
|--------|-------------|
| Página | `ClientMyServicesPage.tsx` — header, busca, filtros, abas, lista, sheet de orçamentos. |
| Orquestração | `useClientMyServicesPage.ts` — search params, foco, opções de filtro, scroll, navegação para detalhe. |
| Lista | `useClientMyServicesList.ts` → `useServicesList` (RPC `list_services`). |
| Filtros | `useClientMyServicesFilters.ts` — estado local + busca debounced. |
| Cancelamento | `useClientMyServicesCancel.ts` → `useCancelService`. |
| Card | `ServiceListCard` de `view-services`. |

---

## 3. Lista e paginação (RPC)

- **Delegação:** `listServices` em `view-services/api/services.api.ts`.
- **Escopo:** servidor filtra por `auth.uid()` + `profiles.role` (cliente vê só seus SR).
- **Paginação:** `useInfiniteQuery`, página **20**, `total_count` do RPC.
- **Fase:** campo `list_phase` no JSON (`negotiation`, `in_progress`, `completed`, `cancelled`) — sem lógica duplicada no front.

**Modo foco (`serviceRequestId` na URL):** a lista chama `get_service` para o ID focado e retorna um único item (demais filtros de aba não restringem o foco na API).

---

## 4. Abas de status (`StatusTabId`)

Re-export de `view-services/constants/statusTabs.ts`:

| Tab id | Label UI | Filtro RPC |
|--------|----------|------------|
| `all` | Todos | `p_list_phase` null |
| `negotiation` | Em negociação | `negotiation` |
| `in_progress` | Em andamento | `in_progress` |
| `completed` | Concluídos | `completed` |
| `cancelled` | Cancelados | `cancelled` |
| `dispute` | Disputas | Sem linhas (reservado) |

---

## 5. Busca e filtros

| Filtro | Parâmetro RPC |
|--------|---------------|
| Busca | `p_search` |
| Categoria | `p_category_title` |
| Cidade | `p_city_name` |
| Bairro | `p_neighborhood` |
| Datas | `p_date_from` / `p_date_to` |
| Com orçamentos | `p_has_proposals` |
| Com imagens | `p_has_images` |

**Debounce da busca:** 300 ms.

**Opções dos dropdowns:** derivadas dos `items` já carregados — podem ficar incompletas com paginação (lacuna de UX).

---

## 6. Deep link e foco

- **Query:** `SERVICE_REQUEST_FOCUS_QUERY` = `serviceRequestId`.
- **Helper:** `getServiceRequestsPageUrlWithFocus(id)`.
- **Banner:** `ClientMyServicesFocusBanner`.
- **Aba:** sincronizada com `statusToTabId(focusedService.listPhase)`.

---

## 7. Ações por card

### Ver detalhes

- **Todas as fases:** `navigate(getServiceDetailPath(id))` → `/dashboard/services/:id`.

### Comparar orçamentos / Histórico (`negotiation-proposals`)

- Sheet `ReceivedBudgetDetailsSheet` quando `proposalCount > 0`.
- Modo compare vs history conforme fase do pedido.

### Cancelar

- RPC `cancel_service_request` via `useCancelService`.
- Aplicável na fase `negotiation` (pedido ainda aberto).

---

## 8. Diagrama

```mermaid
flowchart LR
  P[ClientMyServicesPage] --> VS[view-services]
  VS --> LS[list_services RPC]
  VS --> GS[get_service RPC]
  P --> B[ReceivedBudgetDetailsSheet]
  P --> D[ServiceDetailPage]
  B --> NP[negotiation-proposals]
  LS --> SR[(service_requests)]
  LS --> CS[(contracted_services)]
```

---

## 9. Evidências

- `src/features/client-my-services/**/*`
- `src/features/view-services/**/*`
- `supabase/migrations/20260705208000_create_view_services_rpcs.sql`
- `src/router.tsx`
