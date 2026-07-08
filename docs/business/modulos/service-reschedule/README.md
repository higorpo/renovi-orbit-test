# Reagendamento de serviço (`service-reschedule`)

## 1. Leitura para negócio

- **Para que serve:** negociar e confirmar uma **nova data (ou período) de execução** de um **serviço já contratado**, sem cancelar a contratação. A data oficial só muda após o **aceite formal** do cliente.
- **Quem usa:** cliente e prestador participantes do serviço/conversa (ações conforme status da solicitação).
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

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/propor-nova-data.md](./features/propor-nova-data.md) | Duração editável; modo data única vs período; slot com duração embutida; aceite atualiza contrato |

## 4. Arquivos-chave (mapa rápido)

| Área | Caminhos |
|------|----------|
| UI propor | `components/ProposeRescheduleDialog.tsx` |
| Formulário / Zod | `types/serviceReschedule.forms.ts` |
| Modo de data | `utils/deriveRescheduleDateMode.ts` |
| Snapshot | `utils/mapRescheduleSnapshot.ts` |
| Cópias do card | `utils/rescheduleCardCopy.ts`, `utils/formatRescheduleSlot.ts` |
| API / hooks | `api/serviceReschedule.api.ts`, `hooks/useServiceRescheduleMutations.ts` |
| SQL | `supabase/migrations/20260802020000_service_reschedule_helpers.sql` (validação); snapshots com duração em migrations `20260802*` |

## 5. Relação com outros módulos

- **`chats`:** cards e dialogs de reagendamento na conversa do serviço contratado.
- **`view-services` / `my-services`:** ação de solicitar/acompanhar reagendamento no detalhe do serviço.
- **`negotiation-proposals`:** regra de duração em dias reutiliza `matchesProposalDayDurationISO` (mesma lógica do slot da proposta).
- **`payments`:** ao confirmar reagendamento, o slot oficial do serviço é atualizado; cobrança/âncora de execução seguem o subsistema de pagamentos (fora do escopo deste README).

## 6. Escopo documental desta pasta

Documentado com evidência direta neste ciclo: **como o prestador informa duração e datas na proposta**, como o slot embute `duration_unit` / `duration_value`, e como o aceite atualiza o serviço contratado.

Não reescreve aqui o ciclo completo de estados da solicitação (pedido, ajuste, aceite, cancelamento, expiração, supersede) — ver glossário de domínio e código/RPCs `cns_*_service_reschedule*`.
