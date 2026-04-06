# Orçamentos do prestador (`provider-budgets`)

## 1. Leitura para negócio

- **Para que serve:** o prestador **acompanha orçamentos já enviados** e **perguntas** feitas aos clientes, com filtros e indicadores de pendências.
- **Quem usa:** prestador autenticado.
- **Processo:** pós-envio de proposta — follow-up e clareza antes da decisão do cliente.
- **Valor:** reduz perda de contexto em negociações simultâneas.
- **Riscos:** sincronização mental com o módulo “Trabalhos” (origem das propostas).

## 2. Visão geral funcional

- **Objetivo:** abas, busca, paginação, contadores; rota com parâmetro de pedido para contexto.
- **Escopo:** RPCs `list_provider_sent_budgets`, `list_provider_own_questions`, etc.
- **Limites:** não cria proposta (isso é `provider-jobs` em geral).
- **Relação:** `provider-jobs`, `client-budgets` (lado cliente).

## 3. Features

| Feature | Documento |
|---------|-----------|
| Orçamentos enviados | [features/orcamentos-enviados.md](./features/orcamentos-enviados.md) |

## 4. Perfis

- Somente **prestador** na rota.

## 5. Fluxos

- Abrir “Orçamentos” → aba enviados ou perguntas → aprofundar por pedido quando aplicável.

## 6. Regras transversais

- Dados limitados ao `provider_id` autenticado.

## 7. Entidades

- `provider_proposals`, `provider_service_request_questions`.

## 8. Integrações

- RPCs definidas em `20260322000000_create_provider_budgets_rpcs.sql` e relacionadas.

## 9. Riscos

- **Evidência parcial:** todas as combinações de filtro e mensagens de retorno RPC.

## 10. Evidências

- `src/features/provider-budgets/`
- `src/router.tsx` (`/dashboard/budgets`)
