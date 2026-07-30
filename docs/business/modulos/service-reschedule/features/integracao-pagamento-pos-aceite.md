# Integração com pagamento após aceite do reagendamento

## 1. Resumo executivo

Quando o cliente **aceita formalmente** uma Data Proposta de Reagendamento, o slot oficial do serviço contratado é atualizado e o backend chama `payment_reschedule_charge_date`. O efeito sobre a cobrança depende do estado da parcela e de quão longe está a nova data de execução.

O app **não** invoca Edge Function de dinheiro no aceite — a orquestração de reembolso/recaptura (quando necessária) é 100% backend (pg_net + cron).

## 2. Pré-captura (antes de `PAID`)

Se a parcela ainda está em estado pré-captura (`SCHEDULED`, `FAILED` ou `IN_ANALYSIS`):

- apenas **retarget** de `charge_scheduled_at` para T-2 da nova execução (ou `now()` em emergência);
- o serviço permanece no status de pagamento já vigente (ex.: `PENDING_PAYMENT`).

## 3. Pós-`PAID` — perto (≤15 dias)

Limiar: `far_reschedule_recapture_threshold_days` (padrão **15**).

Quando a nova data de execução está a **≤15 dias** à frente e o serviço está `CONFIRMED` (não após `EXECUTED`):

- outcome `paid_no_charge_update`;
- **mantém** o dinheiro já capturado;
- atualiza só o slot (datas/turno);
- faixas de estorno/T-12h passam a usar o novo `payment_service_execution_at`.

## 4. Pós-`PAID` — longe (>15 dias)

Quando a nova data está a **>15 dias** à frente:

1. Backend marca `far_recapture_pending_at` na parcela (`paid_far_recapture_required`).
2. Acorda a Edge Function interna `process-far-reschedule-recapture` via pg_net (`orbit_invoke_edge_function`); cron de safety-net reclama órfãos.
3. Reembolso **integral** no gateway, depois commit atômico: parcela antiga → `REFUNDED` (`FAR_RESCHEDULE_RECAPTURE`); nova parcela `SCHEDULED` em T-2.
4. Status do serviço contratado → `PENDING_PAYMENT` até a nova captura.
5. **Não** cancela o serviço nem fecha o chat.

## 5. Aviso discreto na UI

Enquanto `far_recapture_pending` for verdadeiro no modelo do serviço contratado (derivado de `payment_schedules.far_recapture_pending_at`), o detalhe do serviço (`ServiceContractedSection`) exibe cópia discreta:

> Estamos reajustando a cobrança para a nova data. Isso pode levar alguns minutos.

## 6. Evidências

| Tema | Onde |
|------|------|
| RPC de retarget / ramificação perto vs longe | `payment_reschedule_charge_date` (`20260801220000_*`, reforço em `20260802200000_payment_far_reschedule_recapture.sql`) |
| Prepare / commit / claim / cron | `payment_prepare_far_reschedule_recapture`, `payment_commit_far_reschedule_after_gateway`, `payment_claim_far_reschedule_recapture_batch`, `cron_payment_far_reschedule_recapture` |
| Edge Function | `supabase/functions/process-far-reschedule-recapture/` |
| Constante de limiar | `platform_constants.far_reschedule_recapture_threshold_days` |
| Flag na row do serviço | `project_service_row` → `far_recapture_pending`; mapper `farRecapturePending` |
| Aviso na UI | `ServiceContractedSection.tsx` |
| Design técnico | `docs/payment-system/CONTEXT.md` § Reagendamento; `design.md` §1.7.8 |

## 7. Fora de escopo deste documento

- Ciclo completo de estados da solicitação de reagendamento (ajuste, cancelamento, expiração, supersede).
- Detalhe de faixas ToS de multa no cancelamento (ver `payments` / `docs/payment-system/`).
