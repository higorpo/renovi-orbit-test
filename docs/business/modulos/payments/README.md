# Pagamentos (`payments`)

## 1. Leitura para negócio

- **Para que serve:** checkout com cartão (tokenização NetCred), cobrança automática T-2 antes do serviço, cobrança manual pelo cliente, histórico de pagamentos/recebimentos (com breakdown de reembolso), KYC bancário do prestador e notificações de cobrança.
- **Quem usa:** cliente (checkout, cartões salvos, histórico com reembolsos, cobrança manual); prestador (KYC, histórico de recebimentos líquidos); operação (runbooks em `docs/payment-system/`).
- **Valor:** pagamento protegido integrado ao fluxo de aceite de proposta; repasse ao prestador após execução do serviço. O `charge_amount` no cartão usa **gross-up NetCred** (MDR% + PROCESSING + RISK_ANALYSIS) para o líquido da plataforma ≈ comissão Renovi; o split `FIXED_AMOUNT` do prestador não muda com essa regra.
- **Rollout:** crons de pagamento ativos no deploy; runbooks operacionais em `docs/payment-system/`.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Feature | `src/features/payments/` — checkout stepper, cartões, KYC, histórico, cobrança manual |
| Backend | RPCs `payment_*` + Edge Functions NetCred (tokenização, cobrança, webhook, reembolso, KYC, reconciliação) |
| Histórico (leitura) | Views `client_payment_transactions_v` e `provider_payment_receivables_v` |
| Cobrança automática | pg_cron → `schedule-netcred-charges` → `payment_claim_charge_batch` → NetCred |
| Constantes | `platform_constants` (MDR por bandeira/parcela, `cc_fixed_processing_fee_brl`, `cc_risk_analysis_fee_brl`, tentativas, batch sizes) |
| Fórmula de cobrança | Gross-up: `ROUND_HALF_EVEN((base + PROCESSING + RISK_ANALYSIS) / (1 − MDR%/100), 2)` — ver [checkout-e-cobranca](./features/checkout-e-cobranca.md#valor-cobrado-no-cartão-charge_amount) |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/checkout-e-cobranca.md](./features/checkout-e-cobranca.md) | Checkout, tokenização com CPF do titular enviado à NetCred (independente do CPF da conta) e aviso não bloqueante de primeiro nome, T-2, estados de parcela, **fórmula `charge_amount` (gross-up NetCred)**, KYC, cobrança manual (`ManualPaymentDialog`: cartão → parcelas → `payment_update_method` + `manual-charge-payment`), mensagens de erro amigáveis (pt-BR), notificações |
| [features/historico-e-reembolso.md](./features/historico-e-reembolso.md) | Histórico cliente/prestador; breakdown de reembolso; `REFUND_REQUESTED` vs clawback |
| Engenharia | `docs/payment-system/design.md` (§3.13 histórico; §4.8 reembolso) |

**Erros na UI:** checkout, cartões e cobrança manual nunca exibem texto bruto do backend — só mensagens amigáveis em pt-BR mapeadas por código (ver [checkout-e-cobranca](./features/checkout-e-cobranca.md#mensagens-de-erro-na-ui-pt-br)).

## 4. Relação com outros módulos

- **`negotiation-proposals` / `chats`:** aceite de proposta cria `payment_schedules` e abre checkout.
- **`my-account`:** embute `PaymentHistorySection` (cliente e prestador) em `/dashboard/conta`.
- **`my-services` / `view-services`:** status do serviço contratado reflete ciclo de pagamento; cancelamento pós-pagamento dispara reembolso.
- **`message-dispatcher`:** notificações de cobrança (`payment_enqueue_notifications`).
