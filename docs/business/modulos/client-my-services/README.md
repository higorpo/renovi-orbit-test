# Meus serviços / pedidos do cliente (`client-my-services`)

## 1. Leitura para negócio

- **Para que serve:** o cliente **lista e gerencia pedidos** (`service_requests`) já criados.
- **Quem usa:** cliente.
- **Processo:** acompanhamento operacional do pedido até conclusão ou cancelamento.
- **Valor:** histórico e reentrada em fluxos de orçamento/perguntas.
- **Riscos:** placeholder de detalhe em `/dashboard/services/:id` pode limitar suporte de primeiro nível.

## 2. Visão geral funcional

- **Objetivo:** listagem paginada, busca, filtros, abas por status, deep link de foco.
- **Escopo:** front + API `serviceRequests.api.ts`.
- **Limites:** não substitui o módulo de orçamentos (complementar).
- **Relação:** `client-budgets` (sheets), `request-quote` (origem do pedido).

## 3. Features

| Feature | Documento |
|---------|-----------|
| Solicitações do cliente | [features/solicitacoes-do-cliente.md](./features/solicitacoes-do-cliente.md) |

## 4. Perfis

- Cliente no dashboard; prestador usa `provider-jobs` para a mesma entidade sob outra ótica.

## 5. Fluxos

- Lista → filtro → abrir detalhe/orçamentos → cancelar quando permitido.

## 6. Regras transversais

- Estados do pedido (`open`, `in_progress`, `closed`, `cancelled`) condicionam ações.

## 7. Entidades

- `service_requests` e campos derivados (localização, fotos, formulário).

## 8. Integrações

- Storage `service-requests` para imagens; RPCs cliente onde aplicável.

## 9. Riscos

- Nomenclatura “Meus Serviços” vs entidade “pedido”.

## 10. Evidências

- `src/features/client-my-services/`
- `supabase/migrations/20260226100300_create_service_requests.sql`
- `src/layouts/DashboardLayout/dashboardMenu.ts`
