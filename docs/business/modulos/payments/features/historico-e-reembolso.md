# Histórico de pagamentos e reembolso

## Objetivo

Exibir ao **cliente** o histórico de cobranças no cartão (incluindo reembolsos) e ao **prestador** o histórico de recebimentos na plataforma, com valores líquidos após clawback confirmado pelo gateway.

## Onde aparece na UI

| Perfil | Superfície | Componente |
|--------|------------|------------|
| Cliente | Minha conta (`/dashboard/conta`) | `PaymentHistorySection` → `ClientPaymentHistoryList` |
| Prestador | Minha conta (`/dashboard/conta`) | `PaymentHistorySection` → `ProviderPaymentHistoryList` |

Evidência: `MyAccountClientPage.tsx`, `MyAccountProviderPage.tsx`; API `history.api.ts` (views `client_payment_transactions_v` / `provider_payment_receivables_v`).

## Histórico do cliente

Lista parcelas em estados pós-captura: `PAID`, `REFUND_REQUESTED`, `REFUNDED`, `PARTIALLY_REFUNDED`.

### Exibição de valores (quando há reembolso)

Se `refundedAmount` está presente e é **> 0**, a UI mostra o breakdown:

1. **Valor original cobrado no cartão** (`amountPaid`) com riscado (strikethrough).
2. **Valor líquido cobrado** = `amountPaid − refundedAmount`.
3. Linha explícita **“Reembolsado: R$ …”** com `refundedAmount`.
4. Rótulo de estado permanece visível (ex.: “Reembolso solicitado / em processamento”, “Reembolso parcial”, “Reembolsado”).

Sem `refundedAmount` (ou valor ≤ 0), mostra só o valor cobrado, sem breakdown.

Evidência: `ClientPaymentHistoryList.tsx`, `clientPaymentHistoryAmounts.ts`, `formatPaymentHistoryState.ts`.

### Ordem do cancelamento pós-`PAID` (gateway first)

Fluxo atual da Edge `process-refund` quando a parcela está **`PAID`**:

1. **`payment_prepare_refund_request`** — valida elegibilidade e calcula o valor ToS **sem** cancelar serviço/chat e **sem** mudar o estado da parcela.
2. **`refundTransaction`** na NetCred — se falhar: **zero** mutações irreversíveis; UI permite nova tentativa (“Não foi possível processar o cancelamento/reembolso…”).
3. Só após ACK / `ALREADY_REFUNDED`: **`payment_commit_refund_after_gateway`** — em uma TX: `REFUND_REQUESTED` + `refund_submit_status = SUBMITTED` + `refunded_amount` esperado + cancela serviço + fecha chat.

Recovery: se o gateway ACK’d e o commit falhar, `payment_mark_refund_gateway_acked` deixa `PAID`+`SUBMITTED`; reconcile/webhook completam o cancel via `payment_complete_refund_domain_side_effects`. Detalhe histórico do bug e do fix: [`critical-bug-refund-partial-commit.md`](../../../../payment-system/critical-bug-refund-partial-commit.md) (P-12 resolvido).

### Persistência do valor esperado em `REFUND_REQUESTED`

Ao **commitar** o reembolso após o ACK do gateway (`payment_commit_refund_after_gateway`):

- transiciona a parcela para **`REFUND_REQUESTED`**;
- grava o **`refunded_amount` esperado** (cálculo ToS / política de cancelamento);
- **não** define `refunded_at` nessa etapa (`refunded_at` vem do webhook/reconciliação).

Assim o histórico do cliente já pode mostrar o breakdown enquanto o gateway ainda não confirmou o crédito. O webhook (ou reconciliação) **sobrescreve** `refunded_amount` com o valor confirmado e define `refunded_at`.

### Faixa ToS após reagendamento pós-PAID

Cancelamento/reembolso pós-pagamento calcula a faixa ToS de multa/estorno com o **`payment_service_execution_at` atual** do `contracted_services` (slot vigente após reagendamento). Assim, janelas de reembolso/T-12h acompanham a nova data — alinhado à estimativa da UI.

No primeiro `PAID`, a parcela ainda grava **`refund_anchor_execution_at`** como **snapshot de auditoria** (horário de execução na captura). Esse campo **não** alimenta o cálculo de faixa ToS.

### Webhook: `PAID` → `REFUNDED`

Além do caminho clássico `PAID` → `REFUND_REQUESTED` → `REFUNDED`/`PARTIALLY_REFUNDED`, o processamento de `TRANSACTION_REFUND` pode aplicar o reembolso também a partir de **`PAID`** (ex.: estorno iniciado fora do fluxo app / confirmação direta do gateway).

### Webhook: assinatura inválida

Evento com assinatura HMAC inválida vai para estado terminal (**`DEAD_LETTER`** / não retentável). Não há retry que “promova” captura forjada sem `signature_validated`.

Evidência: RPCs `payment_prepare_refund_request` / `payment_commit_refund_after_gateway` / `payment_mark_refund_gateway_acked` / `payment_complete_refund_domain_side_effects`; Edge `process-refund`; webhook `payment_process_webhook_event` (`TRANSACTION_REFUND` / captura); design técnico em `docs/payment-system/design.md` §4.8.

## Histórico / recebimentos do prestador

A view `provider_payment_receivables_v` expõe:

- `amount_received_at_capture` — `provider_payout` na captura;
- `net_amount_received` — líquido após clawback **proporcional** ao reembolso.

### Quando o clawback reduz o líquido

`net_amount_received` só aplica a redução quando **`refunded_at IS NOT NULL`** (confirmação do gateway). Em `REFUND_REQUESTED`, mesmo com `refunded_amount` esperado já gravado para o histórico do cliente, o líquido do prestador **permanece** o valor da captura — evita reduzir o recebimento exibido antes da confirmação.

Na UI, se líquido ≠ valor na captura, mostra “Valor original: …”.

Evidência: `provider_payment_receivables_v` em `20260801140000_create_payment_history_views.sql`; `ProviderPaymentHistoryList.tsx`.

## Rótulos de estado (histórico)

| Estado | Rótulo (pt-BR) |
|--------|----------------|
| `PAID` | Pago |
| `REFUND_REQUESTED` | Reembolso solicitado / em processamento |
| `PARTIALLY_REFUNDED` | Reembolso parcial |
| `REFUNDED` | Reembolsado |

## Fora de escopo neste documento

- Matriz completa de cancelamento / faixas de multa (ToS) — ver `docs/payment-system/` e fluxos de cancelamento do serviço contratado.
- Detalhe de API NetCred e runbooks operacionais.
