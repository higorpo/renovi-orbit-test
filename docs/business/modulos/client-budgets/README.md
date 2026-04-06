# Orçamentos do cliente (`client-budgets`)

## 1. Leitura para negócio

- **Para que serve:** centralizar no painel do **cliente** os **orçamentos recebidos** (propostas) e **perguntas** associadas aos pedidos.
- **Quem usa:** cliente autenticado.
- **Processo:** negociação pós-pedido até aceite/rejeição de proposta.
- **Valor:** transparência e acompanhamento sem suporte manual.
- **Riscos:** complexidade de estados de proposta e pedido exige alinhamento com atendimento (ver glossário).

## 2. Visão geral funcional

- **Objetivo:** listas, filtros, busca, detalhes em painéis (sheets), integração com threads de perguntas.
- **Escopo:** leitura e ações permitidas via RPCs do lado cliente.
- **Limites:** não processa pagamento neste módulo.
- **Relação:** depende de `service_requests` e `provider_proposals`; liga a `client-my-services`.

## 3. Features

| Feature | Documento |
|---------|-----------|
| Orçamentos recebidos | [features/orcamentos-recebidos.md](./features/orcamentos-recebidos.md) |

## 4. Perfis

- **Cliente:** único operador da UI.
- **Prestador:** interage pelo módulo próprio (`provider-budgets` / `provider-jobs`).

## 5. Fluxos

- Cliente abre “Orçamentos” → filtra → abre detalhe → responde pergunta ou rejeita proposta (conforme RPCs).

## 6. Regras transversais

- Visibilidade condicionada a ser dono do pedido/proposta no servidor.

## 7. Entidades

- `provider_proposals`, `provider_service_request_questions`, anexos em storage quando aplicável.

## 8. Integrações

- RPCs: `list_client_received_budgets`, `get_client_budget_service_request_detail`, `respond_client_budget_question`, `reject_client_budget_proposal`, `list_client_budget_questions`, etc.

## 9. Riscos

- Mensagens de erro específicas por código RPC devem ser catalogadas em revisões futuras.

## 10. Evidências

- `src/features/client-budgets/`
- `supabase/migrations/20260323090000_create_client_budgets_rpcs.sql`
- `src/router.tsx` (`/dashboard/orcamentos`)
