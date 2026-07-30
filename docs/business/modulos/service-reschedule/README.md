# Reagendamento de serviço (`service-reschedule`)

## 1. Leitura para negócio

- **Para que serve:** negociar e confirmar uma **nova data (ou período) de execução** de um **serviço já contratado**, sem cancelar a contratação. A data oficial só muda após o **aceite formal** do cliente.
- **Quem usa:** cliente e prestador participantes do serviço/conversa (ações conforme status da solicitação).
- **Quando se pode iniciar (status do serviço contratado):**
  - **Cliente:** `PENDING_PAYMENT` ou `CONFIRMED`, desde que ainda esteja dentro da **janela de 48h** antes da execução (`CLIENT_RESCHEDULE_WINDOW_CLOSED` se fechada).
  - **Prestador:** `PENDING_PAYMENT` (ainda não pago) ou `CONFIRMED` (pago) — **sem** janela mínima de 48h (pode a qualquer momento nesses status). Antes, o prestador só podia iniciar em `CONFIRMED`.
- **Propor nova data:** o prestador envia o slot no fluxo de reagendamento (`cns_propose_service_reschedule`) também com o serviço em `PENDING_PAYMENT` ou `CONFIRMED` (mesma elegibilidade de status).
- **Valor:** formaliza a troca de agenda no chat e no detalhe do serviço; o prestador pode propor nova duração (dentro dos limites do composer de proposta), com validação alinhada ao slot enviado.
- **Domínio de produto (glossário):** [docs/cancelamento-reagendamento-servicos/CONTEXT.md](../../../cancelamento-reagendamento-servicos/CONTEXT.md).

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Feature front | `src/features/service-reschedule/` |
| Superfícies de UI | Dialogs no chat e no detalhe do serviço contratado; cards na timeline |
| Duração no dialog | Pré-preenchida de `contracted_services`; editável pelo prestador (máx. 24 h / 7 dias) |
| Slot proposto | JSON com `duration_unit`, `duration_value`, datas e turno |
| Validação de slot (backend) | `_cns_validate_reschedule_slot` — prefere duração embutida no slot |
| Aceite | `_cns_apply_service_reschedule_slot` atualiza `duration_unit` / `duration_value` do contrato |
| Snapshot JSON | Baseline de duração para pré-preencher o dialog |

## 3. Mensagem de sistema ao solicitar reagendamento

Ao **solicitar** reagendamento (`cns_request_service_reschedule`), o sistema insere uma mensagem `SYSTEM` no chat do serviço contratado.

| Caso | Conteúdo do texto |
|------|-------------------|
| Sem observação do usuário | Apenas a frase automática (cliente: nome + data/turno do slot atual; prestador: nome + convite a negociar no chat). |
| Com `request_note` (observação opcional, até 500 caracteres após trim) | Frase automática, **linha em branco**, depois o prefixo `Observação:` e o texto da nota. |

Formato quando há observação:

```
{frase automática do sistema}

Observação: {texto da observação do usuário}
```

A observação **não** é concatenada na mesma linha da frase automática (evita ambiguidade entre texto do sistema e do usuário).

Evidência: `supabase/migrations/20260802030000_service_reschedule_rpcs_core.sql` (`cns_request_service_reschedule`).

## 4. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/propor-nova-data.md](./features/propor-nova-data.md) | Duração editável; modo data única vs período; slot com duração embutida; aceite atualiza contrato; lembrete dispensável no dialog |
| [features/integracao-pagamento-pos-aceite.md](./features/integracao-pagamento-pos-aceite.md) | Pós-aceite: pré-PAID retarget; pós-PAID perto vs longe (far-recapture); UI de pending |
| [features/integracao-pagamento-pos-aceite.md](./features/integracao-pagamento-pos-aceite.md) | Efeito no pagamento após aceite: pré-`PAID` (retarget T-2); pós-`PAID` perto (mantém captura); pós-`PAID` longe (reembolso + nova parcela T-2); aviso UI `far_recapture_pending` |

## 5. Arquivos-chave (mapa rápido)

| Área | Caminhos |
|------|----------|
| UI propor | `components/ProposeRescheduleDialog.tsx`, `components/ProposeRescheduleFlowReminder.tsx` |
| Formulário / Zod | `types/serviceReschedule.forms.ts` |
| Modo de data | `utils/deriveRescheduleDateMode.ts` |
| Snapshot | `utils/mapRescheduleSnapshot.ts` |
| Cópias do card | `utils/rescheduleCardCopy.ts`, `utils/formatRescheduleSlot.ts` |
| API / hooks | `api/serviceReschedule.api.ts`, `hooks/useServiceRescheduleMutations.ts` |
| SQL | `supabase/migrations/20260802020000_service_reschedule_helpers.sql` (validação); `20260802030000_service_reschedule_rpcs_core.sql` (solicitar + mensagem SYSTEM); snapshots com duração em migrations `20260802*` |

## 6. Relação com outros módulos

- **`chats`:** cards e dialogs de reagendamento na conversa do serviço contratado.
- **`view-services` / `my-services`:** ação de solicitar/acompanhar reagendamento no detalhe do serviço.
- **`negotiation-proposals`:** regra de duração em dias reutiliza `matchesProposalDayDurationISO` (mesma lógica do slot da proposta).
- **`payments`:** ao confirmar reagendamento, o slot oficial do serviço é atualizado e `payment_reschedule_charge_date` roda no backend.
  - Pré-captura: retarget de `charge_scheduled_at` (T-2 / emergency).
  - Pós-`PAID` perto (≤15 dias): mantém captura (`paid_no_charge_update`).
  - Pós-`PAID` longe (>15 dias): marca `far_recapture_pending_at` e a EF interna `process-far-reschedule-recapture` (pg_net + cron) faz reembolso integral + nova parcela T-2; o app **não** invoca EF de dinheiro no aceite. Após o commit, o serviço fica `PENDING_PAYMENT` até a nova captura.

## 7. Escopo documental desta pasta

Documentado com evidência direta neste ciclo: **elegibilidade de status** para cliente e prestador iniciarem (e para o prestador propor slot), **como o prestador informa duração e datas na proposta**, como o slot embute `duration_unit` / `duration_value`, como o aceite atualiza o serviço contratado, o **formato da mensagem SYSTEM** ao solicitar (incluindo observação opcional com prefixo `Observação:`), e a **integração com pagamento pós-aceite** (pré-`PAID`, pós-`PAID` perto/longe e aviso `far_recapture_pending`).

### Expiração e cancelamento de solicitações abertas

- **Proposta vencida:** se existir `proposed_slot` e `start_date` ≤ hoje (calendário `America/Sao_Paulo` / `cns_business_today`), o janitor `expire_stale_service_reschedule_requests` marca a solicitação como `EXPIRED` (alinha com o gate de aceite `SLOT_START_DATE_TOO_SOON`). Também expira em serviço `EXECUTED`/`COMPLETED` ou após grace de 24h da execução original com serviço `CONFIRMED`.
- **Cancelamento do serviço:** ao cancelar o serviço contratado, requests abertas (`REQUESTED` / `PROPOSED` / `ADJUSTMENT_REQUESTED`) passam a `CANCELLED` via `cns_cancel_active_service_reschedule_requests` (incluindo o caminho `cancelled_no_schedule` em `cns_confirm_service_cancellation`). O janitor é safety-net: se o serviço já estiver `CANCELLED` e ainda houver request aberta, marca `CANCELLED` (não `EXPIRED`).

Não reescreve aqui o ciclo completo de estados da solicitação (pedido, ajuste, aceite, cancelamento, expiração, supersede) — ver glossário de domínio e código/RPCs `cns_*_service_reschedule*`. Detalhe de cobrança pós-aceite: [integracao-pagamento-pos-aceite.md](./features/integracao-pagamento-pos-aceite.md).

Evidência de elegibilidade: `cns_request_service_reschedule`, snapshot/action flags e `cns_propose_service_reschedule` em `supabase/migrations/20260802030000_service_reschedule_rpcs_core.sql` e `20260802130000_service_reschedule_supersede_rounds.sql`.
Evidência de expiração/cancelamento: `supabase/migrations/20260802080000_service_reschedule_expiration_janitor.sql`, `20260802020000_service_reschedule_helpers.sql` (`cns_cancel_active_service_reschedule_requests`), `20260801670000_payment_cns_confirm_service_cancellation.sql`.