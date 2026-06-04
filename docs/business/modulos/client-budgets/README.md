# Módulo descontinuado — `client-budgets`

> **Removido do código.** A pasta `src/features/client-budgets/` não existe mais; a rota `/dashboard/orcamentos` e o item de menu **Orçamentos** (cliente) foram retirados.

## Onde está a funcionalidade agora

| Antes | Agora |
|-------|-------|
| Página `/dashboard/orcamentos` | **Meus Serviços** (`/dashboard/requests`) — ações no card de cada pedido |
| Sheet de orçamentos recebidos | [`negotiation-proposals`](../chats/features/comparar-orcamentos-meus-servicos.md) — `ReceivedBudgetDetailsSheet` via Public API |
| Menu **Orçamentos** (cliente) | Removido; negociação ativa em **Conversas** (`/dashboard/chats`) |

## Documentação atual

- [Meus serviços / pedidos do cliente](../client-my-services/README.md)
- [Comparar orçamentos / histórico (sheet)](../chats/features/comparar-orcamentos-meus-servicos.md)
- [Conversas e negociação (CNS)](../chats/README.md)
