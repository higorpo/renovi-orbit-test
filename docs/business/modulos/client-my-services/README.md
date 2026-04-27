# Meus serviços / pedidos do cliente (`client-my-services`)

## 1. Leitura para negócio

- **Para que serve:** o cliente **vê e organiza os pedidos** que fez na plataforma (`service_requests`): busca, filtros, abas (aguardando orçamentos, em negociação, em andamento, concluídos, cancelados), abre **orçamentos** e **perguntas** em sheets e pode **cancelar** pedidos ainda abertos.
- **Quem usa:** principalmente **cliente**; a rota do dashboard também aparece no menu do **prestador** como “Solicitações” com o mesmo path — a tela é construída para o cliente.
- **Valor:** reduz “cadê meu pedido?” e concentra follow-up antes/paralelo ao módulo de orçamentos recebidos.
- **Riscos:** nome **“Meus serviços”** vs entidade **pedido**; **detalhe em página** (`/dashboard/services/:id`) ainda placeholder; **detalhe em sheet** só para status **`open`**; opções de filtro limitadas ao que já foi carregado na lista.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Lista | `/dashboard/requests` — `ClientMyServicesPage` |
| Detalhe rota | `/dashboard/services/:id` — `ClientMyServicesDetailPlaceholder` |
| Dados | Supabase client: `listServiceRequests` com joins, paginação **20**, `useInfiniteQuery` |
| Deep link | `?serviceRequestId=` — `getServiceRequestsPageUrlWithFocus` exportado no `index.ts` |
| Orçamentos / perguntas | `client-budgets`: `ReceivedBudgetDetailsSheet` (compare), `QuestionThreadSheet` |
| Cancelamento | `update` em `service_requests` → `cancelled` + checagem de usuário na API |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md) | Abas, filtros, busca, foco URL, card, ações, sheets, lacunas (detalhe só open, dropdowns, código cancelamento), evidências |

## 4. Mapa de arquivos

| Área | Caminhos |
|------|----------|
| Página | `components/ClientMyServicesPage.tsx` |
| Lista / cartões | `ClientMyServicesCard.tsx`, `ClientMyServicesCardSkeleton.tsx`, `ClientMyServicesHeader.tsx`, `ClientMyServicesSearchBar.tsx`, `ClientMyServicesFiltersBar.tsx`, `ClientMyServicesStatusTabs.tsx`, `ClientMyServicesFocusBanner.tsx` |
| Estados vazios/erro | `ClientMyServicesEmptyState.tsx`, `ClientMyServicesNoFilterResultsState.tsx`, `ClientMyServicesErrorState.tsx` |
| Detalhe | `OpenServiceDetailsSheet.tsx`, `ClientMyServicesSections.tsx`, `ClientMyServicesPhotoGallery.tsx`, `ClientMyServicesDetailPlaceholder.tsx` |
| Hooks | `hooks/useClientMyServicesPage.ts`, `useClientMyServicesList.ts`, `useClientMyServicesFilters.ts`, `useClientMyServicesCancel.ts` |
| API | `api/serviceRequests.api.ts` |
| Tipos / constantes | `types/client-my-services.types.ts`, `constants/statusTabs.ts`, `statusTabDisplay.ts`, `statusBadge.ts`, `constants/routes.ts` |
| Mappers / utils | `utils/serviceRequestCardMapper.ts`, `descriptionPreview.ts`, `formatDate.ts`, `locationDisplay.ts`, `normalizeForSearch.ts`, `filterServiceRequests.ts` (só testes no fluxo atual) |

## 5. Integrações

- **`client-budgets`** — sheets de orçamentos e perguntas sem sair da lista.
- **`request-quote`** — URLs assinadas de fotos e estilo visual do serviço nos cards.
- **`dynamic-form`** — resumo legível das respostas do pedido no sheet de detalhe.
- **`request-quote` (origem)** — criação dos registros listados aqui.

## 6. API pública do pacote (`index.ts`)

Exporta: `ClientMyServicesPage`, `ClientMyServicesDetailPlaceholder`, `getServiceRequestsPageUrlWithFocus`, `SERVICE_REQUEST_FOCUS_QUERY`, `ROUTE_SERVICE_REQUESTS_LIST`.

## 7. Migração / schema

- Referência típica: criação de `service_requests` e políticas — ver migrações em `supabase/migrations/` (ex.: arquivo que define a tabela e RLS para `client_id`).

## 8. Nomenclatura no produto

- Menu cliente: **Meus Serviços** → rota `requests`.
- Cópias da página falam em “serviços” no sentido de **solicitações**; a entidade de dados é **pedido / service_request**.
