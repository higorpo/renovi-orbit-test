# Pagamentos (`payments`)

## 1. Leitura para negócio

- **Para que serve:** checkout com cartão (tokenização NetCred), cobrança automática T-2 antes do serviço, cobrança manual pelo cliente, histórico de pagamentos/recebimentos **na captura** (com breakdown de reembolso), **requisito de KYC `ACTIVE` para cobrança** e notificações de cobrança. Ops: auto-cancel T-12h, void pós-`IN_ANALYSIS`, reconciliação stale e sync de liquidações. Liquidações bancárias do prestador (Ganhos) são UI em [`provider-earnings`](../provider-earnings/README.md); este módulo mantém a persistência (`payment_settlement_movements`, webhooks `PAYOUT_*`, enrich GraphQL pós-CAPTURE/REFUND, cron `sync-netcred-settlements`).
- **Quem usa:** cliente (checkout, cartões salvos, histórico com reembolsos, cobrança manual); prestador (histórico de recebimentos líquidos na captura em Configurações; **UI/gate de KYC** em `provider-kyc`; Ganhos em `provider-earnings`); operação (crons/Edges de reconcile/void/webhook; runbooks em `docs/payment-system/`).
- **Valor:** pagamento protegido integrado ao fluxo de aceite de proposta; repasse ao prestador após execução do serviço. O `charge_amount` no cartão usa **gross-up NetCred** (MDR% + PROCESSING + RISK_ANALYSIS) para o líquido da plataforma ≈ comissão Prestway; o split `FIXED_AMOUNT` do prestador não muda com essa regra.
- **Rollout:** crons de pagamento ativos no deploy (incl. auto-cancel, reconcile, void IN_ANALYSIS, sync settlements, webhook retry); runbooks operacionais em `docs/payment-system/`.

## 2. Visão geral funcional

| Aspecto | Detalhe |
|---------|---------|
| Feature UI | `src/features/payments/` — checkout stepper, cartões, histórico, cobrança manual |
| KYC (UI / gate do shell) | Feature dedicada `src/features/provider-kyc/` — ver [provider-kyc](../provider-kyc/README.md) |
| Backend | RPCs `payment_*` + Edge Functions NetCred (tokenização, cobrança, webhook, reembolso, KYC, reconciliação, void, sync settlements) |
| Histórico (leitura) | Views `client_payment_transactions_v` e `provider_payment_receivables_v` (captura); settlements: `provider_settlement_movements_v` / RPC `list_provider_settlement_movements` (UI em `provider-earnings`) |
| Cobrança automática | pg_cron → `schedule-netcred-charges` → `payment_claim_charge_batch` → NetCred |
| Auto-cancel / void | T-12h `payment_auto_cancel_services` → se veio de `IN_ANALYSIS`, EF `reconcile-inanalysis-auto-cancel-voids` |
| Reconciliação | EF `reconcile-netcred-payments` (stale vs gateway); webhook `netcred-webhook` (+ `DEAD_LETTER`) |
| Constantes | `platform_constants` (MDR por bandeira/parcela, `cc_fixed_processing_fee_brl`, `cc_risk_analysis_fee_brl`, **`min_installment_value`** (padrão R$ 150), tentativas, batch sizes, `auto_cancel_hours_before_service`) |
| Fórmula de cobrança | Gross-up: `ROUND_HALF_EVEN((base + PROCESSING + RISK_ANALYSIS) / (1 − MDR%/100), 2)` — ver [checkout-e-cobranca](./features/checkout-e-cobranca.md#anexo-d--valor-cobrado-charge_amount-e-opções-de-parcela) |
| Opções de parcela | RPC `payment_calculate_installment_options`: **1x sempre**; `n > 1` só se valor da parcela ≥ `min_installment_value`; HMAC assina só o conjunto filtrado (bloqueia aceite/update fora da lista) |
| Auditoria de linha (`payment_schedules`) | Tabela append-only `payment_schedules_audit` grava o snapshot completo da parcela em toda INSERT/UPDATE/DELETE de `payment_schedules`, via um trigger de statement (transition tables) com versionamento set-based. Cada linha tem `audit_id`, `audit_op` (`INSERT`/`UPDATE`/`DELETE`), `audited_at`, `row_version` (só no audit; max+1 por parcela) e `audit_txid` (correlação com o mesmo TX). **Distinta** do `payment_audit_log` (eventos de ciclo de vida): esta é histórico técnico de linha, sem escrita pela aplicação. RLS: só admin lê (`SELECT`); sem UPDATE/DELETE/TRUNCATE; `service_role` só `SELECT` (INSERT só pelo trigger DEFINER). Sem uso na UI. |

## 3. Features do módulo

| Documento | Conteúdo |
|-----------|----------|
| [features/checkout-e-cobranca.md](./features/checkout-e-cobranca.md) | **Doc elevado (20+ seções + anexos):** checkout stepper no aceite, ClearSale fail-closed, tokenização (CPF titular; company plataforma), T-2, FSM `payment_schedules`, gross-up `charge_amount`, **mínimo por parcela** (`min_installment_value`), gate KYC `ACTIVE`, cobrança manual (T-12h, anti double-charge), matrizes campo/erro/elegibilidade; reembolso/histórico e UI Ganhos em docs irmãos |
| [features/historico-e-reembolso.md](./features/historico-e-reembolso.md) | Histórico cliente/prestador (**captura**); breakdown de reembolso; **gateway first** pós-`PAID`; faixa ToS pelo slot vigente pós-reagendamento (`refund_anchor` só auditoria); recaptura longe pós-reagendamento distinta de cancelamento ToS; `PAID`→`REFUNDED` via webhook; assinatura inválida terminal |
| [features/reconciliacao-e-voids.md](./features/reconciliacao-e-voids.md) | **Ops/backend:** auto-cancel T-12h, void pós-`IN_ANALYSIS`, reconcile stale, sync settlements, `DEAD_LETTER`/gaps de webhook — sem UI dedicada |
| Engenharia | `docs/payment-system/design.md` (§3.13 histórico captura + settlements; §4.8 reembolso; §4.12 auto-cancel/void) |
| Gate / UI de KYC no dashboard | [provider-kyc — gate](../provider-kyc/features/gate-e-acesso-operacional.md) · [wizard Fase 3](../provider-kyc/features/formulario-credenciamento-wizard.md) |
| Ganhos (liquidação bancária) | [provider-earnings](../provider-earnings/README.md) |

**Erros na UI:** checkout, cartões e cobrança manual nunca exibem texto bruto do backend — só mensagens amigáveis em pt-BR mapeadas por código (ver [checkout-e-cobranca](./features/checkout-e-cobranca.md#mensagens-de-erro-na-ui-pt-br)). Rejeições ClearSale “Análise de Risco: …” viram `RISK_ANALYSIS_*` em `failure_code` (mensagem bruta só em `failure_reason` para diagnóstico). Tokenização rejeitada ao cliente: `CARD_REJECTED`.

## 4. Perfis envolvidos

| Papel | Neste módulo |
|-------|----------------|
| Cliente | Checkout, cartões, cobrança manual, histórico captura, cancelamento ToS (fora de `IN_ANALYSIS`) |
| Prestador | Histórico captura; KYC UI em `provider-kyc`; Ganhos em `provider-earnings` |
| Sistema / ops | Crons e Edges de cobrança, webhook, reconcile, void, sync settlements; reset `DEAD_LETTER` |
| Admin | SELECT em views/audit conforme RLS; sem painel ops de DEAD_LETTER no app |

## 5. Principais fluxos

1. Aceite de proposta → checkout → `payment_schedules` `SCHEDULED` → cobrança T-2 → `PAID` / `IN_ANALYSIS` / falha.
2. Falha permanente → UI “Ajustar pagamento” (manual charge) até T-12h.
3. T-12h unpaid / `IN_ANALYSIS` → auto-cancel serviço+parcela (+ void gateway se veio de análise) — [reconciliacao-e-voids](./features/reconciliacao-e-voids.md).
4. Cancelamento pós-`PAID` → reembolso gateway-first — [historico-e-reembolso](./features/historico-e-reembolso.md).
5. Webhook / reconcile / sync settlements alinham captura e liquidação bancária.

## 6. Regras transversais

- Gross-up NetCred no `charge_amount`; split prestador congelado no aceite.
- Parcelamento: 1x sempre; demais parcelas só se `installment_amount >= min_installment_value` (padrão R$ 150); HMAC só sobre opções filtradas.
- Gate de cobrança: prestador `ACTIVE` + company + bank (`payment_provider_is_credentialed`).
- Mensagens de erro ao usuário só por código mapeado (pt-BR).
- Distinção **captura** (histórico em conta) vs **liquidação bancária** (Ganhos).
- Ops de reconciliação/void **não** têm superfície de produto dedicada.

## 7. Entidades

| Artefato | Papel |
|----------|--------|
| `payment_schedules` | Agenda/FSM da parcela; lease; failure/reconcile counters |
| `payment_schedules_audit` | Snapshot append-only de linha (técnico) |
| `payment_audit_log` | Eventos de ciclo (`AUTO_CANCELLED`, `CHARGE_VOIDED`, reconcile, etc.) |
| `client_card_tokens` / safe view | Tokens de cartão |
| `client_payment_transactions_v` / `provider_payment_receivables_v` | Histórico de captura |
| `payment_settlement_movements` | Liquidações bancárias (UI em provider-earnings) |
| `payment_webhook_events` (+ queue) | Ingress NetCred; estados incl. `DEAD_LETTER` |
| `provider_gateway_accounts` | Credenciamento NetCred do prestador |
| `platform_constants` | Tarifas, `min_installment_value`, T-2, T-12h, batches, retries webhook |

## 8. Integrações

- **NetCred:** tokenização, charge, getTransaction, void, refund, payouts, webhooks.
- **ClearSale:** sessão antifraude no aceite/manual; fail-closed em prod no cron.
- **Edges:** `tokenize-payment-card`, `schedule-netcred-charges`, `manual-charge-payment`, `process-refund`, `netcred-webhook`, `reconcile-netcred-payments`, `reconcile-inanalysis-auto-cancel-voids`, `sync-netcred-settlements`, `detect-netcred-onboarding`, …
- **MMD:** `payment_enqueue_notifications` (cobrança, análise, auto-cancel).
- **CNS / chats:** close no cancelamento (ToS e auto-cancel).
- **provider-earnings / provider-kyc:** fronteiras de UI; dados de settlement e credentialing neste domínio.

## 9. Riscos e lacunas

- Race webhook × cron × manual / void — leases e FSM mitigam; `deferred_captured` (serviço cancelado + captura no gateway) é gap ops documentado em [reconciliacao-e-voids](./features/reconciliacao-e-voids.md).
- `DEAD_LETTER` exige reset service_role (sem UI).
- Settlements atrasados → Ganhos vazios ou só fallback D+30.
- Detalhe normativo completo: `docs/payment-system/`.

## 10. Evidências

- Front: `src/features/payments/`
- Features docs: [checkout-e-cobranca](./features/checkout-e-cobranca.md), [historico-e-reembolso](./features/historico-e-reembolso.md), [reconciliacao-e-voids](./features/reconciliacao-e-voids.md)
- Migrations `20260801*` / `20260802*` payments; EFs sob `supabase/functions/*netcred*`, `reconcile-*`, `sync-netcred-settlements`, `process-refund`, …
- Engenharia: `docs/payment-system/design.md`, `docs/payment-system/payment-job-runs-monitoring.md`

## Relação com outros módulos

- **`negotiation-proposals` / `chats`:** aceite de proposta cria `payment_schedules` e abre checkout.
- **`settings`:** embute `PaymentHistorySection` (cliente em `/dashboard/settings/payments`; prestador em `/dashboard/settings/receivables`) e `SavedCardsList` (cliente, payments).
- **`provider-earnings`:** UI de liquidações bancárias em `/dashboard/settings/earnings`; lê settlements deste domínio; disclosure de previsão importado da Public API (sem re-export em `payments`).
- **`provider-kyc`:** UI (gate + wizard de credenciamento) até onboarding `ACTIVE`; backend de submissão/detecção permanece nas RPCs/EFs NetCred deste domínio.
- **`my-services` / `view-services`:** status do serviço contratado reflete ciclo de pagamento; cancelamento pós-pagamento dispara reembolso; aviso discreto de `far_recapture_pending` no detalhe.
- **`service-completion`:** writers de produto `EXECUTED`/`COMPLETED`/`IN_DISPUTE` (`service_completion_*`) — **fora** deste módulo (ADR-0004 / ADR-0006). Removidos: `payment_mark_service_executed`, `payment_confirm_service_completed`, `payment_cron_auto_complete_*`. Chargeback/`is_disputed` permanece aqui; **Disputa de serviço** (`IN_DISPUTE`) é do service-completion (≠ chargeback).
- **`service-reschedule`:** ao aceitar nova data, `payment_reschedule_charge_date` retarget pré-`PAID`, mantém captura pós-`PAID` perto (≤15d) ou orquestra recaptura longe (EF `process-far-reschedule-recapture`) — ver [integracao-pagamento-pos-aceite](../service-reschedule/features/integracao-pagamento-pos-aceite.md).
- **`message-dispatcher`:** notificações de cobrança e auto-cancel (`payment_enqueue_notifications`).
