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
- **`payments`:** ao confirmar reagendamento, o slot oficial do serviço é atualizado; cobrança/âncora de execução seguem o subsistema de pagamentos (fora do escopo deste README).

## 7. Escopo documental desta pasta

Documentado com evidência direta neste ciclo: **elegibilidade de status** para cliente e prestador iniciarem (e para o prestador propor slot), **como o prestador informa duração e datas na proposta**, como o slot embute `duration_unit` / `duration_value`, como o aceite atualiza o serviço contratado, e o **formato da mensagem SYSTEM** ao solicitar (incluindo observação opcional com prefixo `Observação:`).

Não reescreve aqui o ciclo completo de estados da solicitação (pedido, ajuste, aceite, cancelamento, expiração, supersede) — ver glossário de domínio e código/RPCs `cns_*_service_reschedule*`.

Evidência de elegibilidade: `cns_request_service_reschedule`, snapshot/action flags e `cns_propose_service_reschedule` em `supabase/migrations/20260802030000_service_reschedule_rpcs_core.sql` e `20260802130000_service_reschedule_supersede_rounds.sql`.
