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
4. Rótulo de estado permanece visível (ex.: “Reembolso solicitado”, “Reembolso parcial”, “Reembolsado”).

Sem `refundedAmount` (ou valor ≤ 0), mostra só o valor cobrado, sem breakdown.

Evidência: `ClientPaymentHistoryList.tsx`, `clientPaymentHistoryAmounts.ts`, `formatPaymentHistoryState.ts`.

### Persistência do valor esperado em `REFUND_REQUESTED`

Ao iniciar o reembolso, `payment_begin_refund_request`:

- transiciona a parcela para **`REFUND_REQUESTED`**;
- grava o **`refunded_amount` esperado** (cálculo ToS / política de cancelamento);
- **não** define `refunded_at` nessa etapa.

Assim o histórico do cliente já pode mostrar o breakdown enquanto o gateway ainda não confirmou. O webhook (ou reconciliação) **sobrescreve** `refunded_amount` com o valor confirmado e define `refunded_at`.

### Retry até ACK do gateway

Enquanto o estorno **não** estiver ACK’d (`refund_submit_status` ainda não `SUBMITTED`/`CONFIRMED`), um novo disparo de `process-refund` **pode chamar de novo** a NetCred (`refundTransaction`). Só quando já submetido com sucesso a Edge trata como idempotente (`already_submitted`) e **não** reenvia.

> **BUG CRÍTICO (aberto):** hoje o cancelamento do serviço/chat é commitado **antes** da chamada ao gateway. Se `refundTransaction` falhar, o cliente vê erro na UI, o serviço já está `CANCELLED`, a parcela fica `REFUND_REQUESTED` e **não há cron/fila que reenvie o estorno** — só intervenção manual / reinvocação de `process-refund`. O invariante desejado é all-or-nothing. Detalhe, impacto e opções de correção: [`docs/payment-system/critical-bug-refund-partial-commit.md`](../../../../payment-system/critical-bug-refund-partial-commit.md) (pendência **P-12**).

### Faixa ToS após reagendamento pós-PAID

Cancelamento/reembolso pós-pagamento calcula a faixa ToS de multa/estorno com o **`payment_service_execution_at` atual** do `contracted_services` (slot vigente após reagendamento). Assim, janelas de reembolso/T-12h acompanham a nova data — alinhado à estimativa da UI.

No primeiro `PAID`, a parcela ainda grava **`refund_anchor_execution_at`** como **snapshot de auditoria** (horário de execução na captura). Esse campo **não** alimenta o cálculo de faixa ToS.

### Webhook: `PAID` → `REFUNDED`

Além do caminho clássico `PAID` → `REFUND_REQUESTED` → `REFUNDED`/`PARTIALLY_REFUNDED`, o processamento de `TRANSACTION_REFUND` pode aplicar o reembolso também a partir de **`PAID`** (ex.: estorno iniciado fora do fluxo app / confirmação direta do gateway).

### Webhook: assinatura inválida

Evento com assinatura HMAC inválida vai para estado terminal (**`DEAD_LETTER`** / não retentável). Não há retry que “promova” captura forjada sem `signature_validated`.

Evidência: migration/RPC `payment_begin_refund_request`; Edge `process-refund`; webhook `payment_process_webhook_event` (`TRANSACTION_REFUND` / captura); design técnico em `docs/payment-system/design.md` §3.13 (não reeditado aqui).

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
| `REFUND_REQUESTED` | Reembolso solicitado |
| `PARTIALLY_REFUNDED` | Reembolso parcial |
| `REFUNDED` | Reembolsado |

## Fora de escopo neste documento

- Matriz completa de cancelamento / faixas de multa (ToS) — ver `docs/payment-system/` e fluxos de cancelamento do serviço contratado.
- Detalhe de API NetCred e runbooks operacionais.
