# Conversas e negociação (CNS — `chats` + `negotiation-proposals`)

## 1. Leitura para negócio

- **Para que serve:** canal **in-app** de negociação entre **cliente** e **prestador** por pedido (`service_request`), com **timeline** de mensagens, **propostas** versionadas, aceite com **data/turno**, e notificações via Message Dispatcher (sem bypass da fila).
- **Quem usa:** cliente e prestador autenticados participantes da conversa.
- **Valor:** substitui negociação fragmentada (só sheets de orçamento) por thread única auditável; limita **slots** de conversas ativas por pedido.
- **Riscos de suporte:** mensagens bloqueadas com proposta **PENDING**; reciprocidade inativa conversa sem resposta; aceite encerra **todas** as conversas do pedido e cria serviço contratado.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Rotas | `/chats`, `/chats/:chatId` (`ProtectedRoute` client + provider) |
| Lista / thread | Feature `chats`: `ChatListPage`, `ChatScreen`, RPCs `list_conversations`, `list_chat_messages`, `cns_send_message` |
| Propostas | Feature `negotiation-proposals`: `submit_proposal`, `accept_proposal`, `reject_proposal`, `request_proposal_revision` |
| Mídia | Edge `chat-upload-media` + sessão `chat_media_upload_sessions` |
| Async | `domain_events` → `cns_process_domain_events` → MMD; crons reciprocidade e expiração de proposta (24h) |
| Constantes | `chats.max_active_slots_per_service_request` (padrão 4), `chats.proposal_response_sla_hours` (padrão 24) |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/conversas-e-negociacao.md](./features/conversas-e-negociacao.md) | Slots §3.3.1, FSM conversa/proposta, mensagens livres vs PENDING, aceite, cancelamento, notificações |

## 4. Arquivos-chave (mapa rápido)

| Área | Caminhos |
|------|----------|
| UI conversas | `src/features/chats/components/`, `hooks/`, `api/chats.api.ts` |
| UI propostas | `src/features/negotiation-proposals/` |
| Router | `src/router.tsx` (lazy `ChatsLayout`) |
| SQL / testes | `supabase/migrations/202606*`, `supabase/tests/chats/` |
| Rollout | `docs/chats/wave-a-rollout-checklist.md`, `docs/chats/wave-bf-rollout-runbook.md` |
| Especificação | `docs/chats/design.md`, `docs/chats/requirements.md` |

## 5. Relação com outros módulos

- **`client-budgets` / `provider-budgets`:** fluxos legados de orçamento; CNS é o caminho preferencial após cutover Wave F.
- **`provider-jobs`:** origem do pedido e envio de proposta (composer migra para `negotiation-proposals`).
- **`message-dispatcher`:** entrega e-mail/push de eventos CNS.
- **`client-my-services`:** status do pedido passa a `COMPLETED` / `CANCELLED` via RPCs CNS.

## 6. Lacunas conhecidas (produto)

- Item de menu do dashboard para `/chats` pode ainda não estar exposto — rota existe no router.
- Indicador de digitação (typing) e algumas integrações de banner → proposta: ver `docs/chats/tasks.md` pós-106.
