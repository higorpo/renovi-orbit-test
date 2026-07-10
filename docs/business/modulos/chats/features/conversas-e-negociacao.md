# Conversas e negociação (CNS)

## 1. Resumo executivo

- **O que é:** sistema de **conversas** (`chats`) ligadas a um **pedido** e a um par cliente–prestador, com mensagens tipadas (texto, proposta, sistema), **propostas** com máquina de estados, e regras de **slot** e **mensagem livre**.
- **Quem usa:** cliente e prestador participantes.
- **Onde na UI:** `/dashboard/chats` (lista) e `/dashboard/chats/:chatId` (tela de conversa).
- **Cutover:** documentação de rollout em `docs/chats/wave-bf-rollout-runbook.md`; habilitação progressiva por ondas A–F.

## 2. Slots de conversa ativa (§3.3.1)

- Cada pedido (`service_request`) admite até **`chats.max_active_slots_per_service_request`** conversas **ACTIVE** simultâneas (contador em `service_request_negotiation_stats.active_chat_count`).
- **Nova conversa:** primeiro envio do prestador (ou criação explícita) consome **+1** slot se ainda houver vaga; caso contrário erro **`NO_ACTIVE_SLOT`**.
- **INACTIVE** por falta de reciprocidade: libera slot (**−1**); reativação **não** consome slot novamente.
- **Aceite de proposta** ou **cancelamento do pedido:** zera contador e **fecha** conversas do pedido.
- **Suporte:** contador é **porta de admissão**, não inventário exato de linhas `ACTIVE` após reativações — pode haver mais linhas ACTIVE que o limite em edge cases documentados no design.

## 3. Estados da conversa

| Status | Significado operacional |
|--------|-------------------------|
| `ACTIVE` | Negociação em andamento; mensagens permitidas conforme regras de proposta |
| `INACTIVE` | Sem reciprocidade bilateral no prazo; pode reativar com nova mensagem válida |
| `CLOSED` | Encerrada (manual, aceite em outra proposta, cancelamento do pedido, etc.) |

## 4. Propostas e mensagens livres (Req. 34)

| Status da proposta | Mensagens de texto/foto livres? |
|--------------------|----------------------------------|
| Nenhuma ou `REJECTED` / `EXPIRED` / `REVISED` | **Sim** (participante, conversa não fechada) |
| `PENDING` | **Não** — cliente/prestador devem usar o card da proposta (aceitar, revisão, recusar) |
| `REVISION_REQUESTED` | **Sim** — janela para alinhar antes de nova proposta |
| Nova `PENDING` após revisão | **Não** novamente |

- **SLA de resposta do cliente:** constante **`chats.proposal_response_sla_hours`** em `platform_constants` (padrão **24h**), lida **somente no servidor** (RPCs, crons, `SECURITY DEFINER`). O app **não** chama `platform_constant_int` / `platform_constant_bool` / `platform_constant_numeric` — EXECUTE revogado para `authenticated`, `anon` e `public`.
- **Prazo exibido na UI:** as RPCs `get_proposal_detail_for_provider` e `get_proposal_detail_for_participant` devolvem **`expires_at`** = `coalesce(submitted_at, created_at)` + SLA (mesma fonte usada por `expire_pending_proposals` e `accept_proposal`). O countdown (`useProposalCountdown` / `ProposalCountdownBanner`) usa esse campo quando disponível (cards na conversa, detalhe de proposta, histórico). Onde a API não envia `expires_at` (ex.: sheet **Comparar orçamentos**), a UI usa fallback local com SLA padrão de **24h** — apenas exibição; a expiração real continua no servidor.
- Após o prazo, proposta **`PENDING`** pode ir para **`EXPIRED`** via job `expire_pending_proposals`.

## 5. Fluxos principais

### 5.1 Iniciar conversa e enviar mensagem

1. Com a timeline vazia, a UI exibe orientação fixa (cliente vs prestador) em `ChatDiscoveryWelcome` — não persiste mensagem `SYSTEM` no banco.
2. Prestador (ou cliente, conforme regra) envia mensagem via RPC **`cns_send_message`** (idempotência por chave).
3. Sistema valida slot, pedido **OPEN**, conversa não **CLOSED**, rate limit, e gate de mensagem livre.
4. Mensagem aparece na timeline; Realtime/polling atualizam a outra parte.

### 5.2 Enviar proposta

1. Prestador envia **`create_provider_proposal`** por `service_request_id` (valores, slots sugeridos, assinatura de preço). Conversa **não** é pré-requisito; se existir, espelha **PROPOSAL** na timeline.
2. Status **`PENDING`**; mensagens livres bloqueadas quando há proposta pendente na conversa.

### 5.3 Cliente responde à proposta

- **Aceitar:** escolhe slot sugerido → **`accept_proposal`** → proposta `ACCEPTED`, linha em `services` (`contracted_service_id` no pedido), pedido permanece **`OPEN`** (só vai a `COMPLETED` quando o serviço contratado for concluído), demais propostas `REJECTED_AUTOMATICALLY`, conversas de **outros** prestadores **CLOSED**; a conversa com o prestador aceito permanece aberta para coordenação/pagamento.
- **Recusar:** **`reject_proposal`** → `REJECTED`; se existir conversa aberta entre cliente e prestador, ela é encerrada (`CLOSED`, `PROPOSAL_REJECTED`).
- **Pedir revisão:** **`request_proposal_revision`** → `REVISION_REQUESTED` (limite de revisões no servidor); depois prestador pode **`create_provider_proposal`** nova versão.

### 5.4 Cancelar pedido

- Cliente: **`cancel_service_request`** → pedido `CANCELLED`, conversas fechadas, propostas pendentes recusadas automaticamente.

## 6. Perfis e permissões

| Papel | Pode |
|-------|------|
| Cliente do pedido | Ler/escrever na conversa; aceitar/recusar/revisão; cancelar pedido |
| Prestador da conversa | Ler/escrever; enviar/revisar propostas |
| Outros prestadores no mesmo pedido | Conversas separadas (cada um com slot próprio) |
| Admin | Políticas RLS específicas (leitura ampla conforme migrations) |

## 7. Notificações

- Eventos gravados em **`domain_events`**; processamento assíncrono dispara templates MMD (push/e-mail).
- Com conversa aberta no app, **supressão** de push duplicado para o mesmo `chat_id` (hook no cliente).

## 8. Evidências (código e testes)

| Tema | Onde verificar |
|------|----------------|
| RPCs | `src/features/chats/api/chats.rpc.ts`, `negotiation-proposals/api/proposals.rpc.ts` |
| Detalhe de proposta / `expires_at` | RPCs `get_proposal_detail_for_provider`, `get_proposal_detail_for_participant`; `negotiation-proposals/hooks/useProposalCountdown.ts`, `components/ProposalCountdownBanner.tsx` |
| Regras de slot / FSM | `docs/chats/design.md` §3.3.1, §4; pgTAP `supabase/tests/chats/` |
| UI | `src/features/chats/components/ChatScreen/` |
| E2E | `e2e/tests/chats.spec.ts` (mocks; opcional `CI_E2E_CHATS=1` no CI) |

## 9. Lacunas / evolução

- Detalhes de typing indicator: ver tarefas 111+ em `docs/chats/tasks.md`.
