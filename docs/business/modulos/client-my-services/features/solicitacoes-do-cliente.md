# Solicitações de serviço do cliente (Meus Serviços)

## 1. Resumo executivo

- **O que é:** lista e gestão dos **pedidos** (`service_requests`) do cliente no dashboard, com busca, filtros, abas por visão de status e atalhos para **orçamentos** e **perguntas**.
- **Problema que resolve:** visibilidade do pipeline após “Pedir orçamento”.
- **Quem usa:** cliente.
- **Resultado esperado:** acompanhamento e ações permitidas (ex.: cancelar) sobre pedidos próprios.

## 2. Objetivo de negócio

- **Finalidade:** retenção e clareza pós-lead.
- **Valor:** reduz chamados de “cadê meu pedido”.
- **Impacto:** liga demanda a propostas.
- **Contexto:** menu cliente rotula como **Meus Serviços** (`dashboardMenu.ts`).

## 3. Localização na plataforma

| Rota | Tela |
|------|------|
| `/dashboard/requests` | `ClientMyServicesPage` |
| `/dashboard/services/:id` | `ClientMyServicesDetailPlaceholder` (**placeholder**) |

Constantes de foco: `SERVICE_REQUEST_FOCUS_QUERY`, `getServiceRequestsPageUrlWithFocus` (deep link).

## 4. Perfis envolvidos

- **Cliente:** único operador.
- **Prestador:** não usa esta rota; vê pedidos via `provider-jobs`.

**Restrição:** layout dashboard exige `client` ou `provider`, mas a **página** é de cliente — ver `perfis-e-permissoes.md` para nuance de layout compartilhado.

## 5. Fluxo funcional principal

1. Cliente abre “Meus Serviços”.
2. Aplica filtros (categoria, cidade, bairro, datas, propostas, imagens, etc. conforme API).
3. Seleciona pedido → detalhe ou sheets de orçamento/perguntas.
4. Opcional: **cancelar** pedido se permitido pela regra implementada.

## 6. Fluxos alternativos e exceções

- **Placeholder de detalhe:** `/dashboard/services/:id` pode não entregar detalhe completo.
- **Foco por query:** abrir lista já destacando um pedido (deep link).

## 7. Regras de negócio

1. Pedido possui `status`: `open`, `in_progress`, `closed`, `cancelled` (CHECK migration).
2. Filtros combinados reduzem o conjunto retornado — critérios exatos na `serviceRequests.api.ts`.
3. Cancelamento: **pré-condições exatas** no front/API (evidência parcial — revisar função de cancelamento na API).

## 8. Campos e dados (pedido — modelo)

| Campo (tabela) | Significado de negócio |
|----------------|------------------------|
| status | Fase do pedido |
| service_id | Tipo de serviço |
| form_data / schema | Respostas do formulário dinâmico |
| description | Texto livre do cliente |
| photos | Metadados + storage |
| urgency, scope_complexity, estimated_duration_hint | Opcionais de priorização |
| geohash / H3 / lat-long | Matching geográfico |

**Labels de UI:** derivadas dos componentes de card — documentação fina pendente.

## 9. Validações de front-end

- Filtros: valores coerentes (datas, selects).
- Ações destrutivas: confirmação modal (inferido por padrão do projeto — confirmar no componente).

## 10. Validações de back-end

- RLS em `service_requests` para isolamento por cliente.
- Updates de status via API Supabase/RPC conforme políticas.

## 11. Status, estados e transições

| Status | Significado operacional (alto nível) |
|--------|--------------------------------------|
| open | Pedido aceito na plataforma, aguardando fluxo |
| in_progress | Em tratativa (propostas/perguntas) — **detalhe exato:** validar uso no app |
| closed | Encerrado positivamente |
| cancelled | Cancelado pelo cliente ou processo |

**Quem altera:** cliente (cancelar), fluxos de proposta/pergunta (transições inferidas).

## 12. Persistência

- **`service_requests`** principal.
- Imagens em bucket `service-requests`.

## 13. Integrações

- Abertura de componentes de `client-budgets` (sheets) para orçamentos/perguntas sem sair do contexto.

## 14. Listagens, buscas e filtros

- Busca textual.
- Filtros múltiplos (categoria, localização, intervalo de datas, presença de propostas/imagens).
- Paginação.
- Abas por agrupamento de status (implementação em página).

## 15. Ações disponíveis

| Ação | Quem | Resultado |
|------|------|-----------|
| Filtrar/buscar | Cliente | Atualiza lista |
| Abrir orçamentos | Cliente | Navegação/sheets |
| Cancelar | Cliente | **Condicionado** — ver API |
| Deep link foco | Cliente | UX de notificação/email futuro |

## 16. Dependências

- Pedido criado em `request-quote`.
- Dados de catálogo (`platform_services`, cidades/bairros) para filtros.

## 17. Regras implícitas

- Query `SERVICE_REQUEST_FOCUS_QUERY` sugere produto preparando **notificações** ou campanhas com retorno à lista.

## 18. Riscos

- Nome “Meus Serviços” vs entidade **pedido**.
- Rota de detalhe placeholder.

## 19. Evidências

- `src/features/client-my-services/components/ClientMyServicesPage.tsx`
- `src/features/client-my-services/api/serviceRequests.api.ts`
- `supabase/migrations/20260226100300_create_service_requests.sql`
- `src/layouts/DashboardLayout/dashboardMenu.ts`

## 20. Pendências

- Mapear **exatamente** quando `cancelled` é permitido e por qual API.
- Completar documentação de detalhe quando `/dashboard/services/:id` for implementado.
