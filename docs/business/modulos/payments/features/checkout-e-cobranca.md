# Checkout e cobrança

## Objetivo

Permitir que o **cliente** pague o serviço aceito via cartão de crédito (NetCred), com parcelamento, tokenização segura (PCI no gateway) e cobrança automática **T-2** (48h antes do início do serviço).

## Fluxo do cliente (checkout)

1. Após aceitar proposta, o cliente acessa checkout (steps: telefone, CPF, cartão, confirmação).
2. Cartão é tokenizado via Edge `tokenize-payment-card` — dados sensíveis não persistem no app.
3. `accept_proposal` (evoluído) cria `payment_schedules` com parcelas e datas de cobrança.
4. Disclosure de timing: cobrança automática antes do serviço; cliente pode tentar cobrança manual em falha.

## Estados da parcela (`payment_schedules`)

| Estado | Significado para negócio |
|--------|--------------------------|
| `SCHEDULED` | Aguardando data T-2 |
| `PROCESSING` | Cobrança em andamento (lease temporário) |
| `PAID` | Cobrada com sucesso |
| `FAILED` | Falha retentável |
| `FAILED_PERMANENT` | Esgotou tentativas — cliente deve pagar manualmente |
| `IN_ANALYSIS` | Análise antifraude / gateway |
| `REFUND_REQUESTED` | Reembolso solicitado; valor esperado já pode estar em `refunded_amount` (sem `refunded_at` até o gateway) |
| `PARTIALLY_REFUNDED` / `REFUNDED` | Reembolso confirmado (parcial ou total) via webhook/reconciliação |

Histórico na conta e regras de exibição de reembolso: [historico-e-reembolso.md](./historico-e-reembolso.md).

## Prestador (KYC)

- Prestador submete dados bancários/documentos (`payment_submit_provider_kyc`).
- Onboarding NetCred detectado por cron; sem KYC ativo, cobrança não inclui o prestador.

## Cobrança manual

- Cliente pode disparar tentativa manual (`manual-charge-payment`) quando elegível (ex.: falha permanente, dentro da janela T-12h).

## Notificações

- Cobrança próxima, sucesso, falha e cancelamento automático enfileirados via Message Dispatcher.

## Rollout operacional

Crons de pagamento ficam **ativos no deploy**. Runbooks de incidente em `docs/payment-system/`.

## Fora de escopo neste documento

- Detalhes de API NetCred — ver `docs/payment-system/payments-api.md`.
- Matriz de requisitos — ver `docs/payment-system/payment-system-requirements.md`.
