# Pagamentos (`payments`)

## 1. Leitura para negócio

- **Para que serve:** checkout com cartão (tokenização NetCred), cobrança automática T-2 antes do serviço, cobrança manual pelo cliente, histórico de parcelas, KYC bancário do prestador e notificações de cobrança.
- **Quem usa:** cliente (checkout, cartões salvos, histórico, cobrança manual); prestador (KYC, histórico de recebimentos); operação (runbooks em `docs/payment-system/`).
- **Valor:** pagamento protegido integrado ao fluxo de aceite de proposta; repasse ao prestador após execução do serviço.
- **Rollout:** crons registrados inativos; habilitação sequencial por operador (sem feature flags de produto).

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Feature | `src/features/payments/` — checkout stepper, cartões, KYC, histórico, cobrança manual |
| Backend | RPCs `payment_*` + 7 Edge Functions (NetCred I/O only) |
| Cobrança automática | pg_cron → `schedule-netcred-charges` → `payment_claim_charge_batch` → NetCred |
| Constantes | `platform_constants` (taxas, tentativas, batch sizes) |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/checkout-e-cobranca.md](./features/checkout-e-cobranca.md) | Checkout, T-2, estados de parcela, KYC, notificações |
| Engenharia | `docs/payment-system/design.md`, deploy em `phased-cron-enablement-plan.md` |

## 5. Relação com outros módulos

- **`negotiation-proposals` / `chats`:** aceite de proposta cria `payment_schedules` e abre checkout.
- **`my-services` / `view-services`:** status do serviço contratado reflete ciclo de pagamento.
- **`message-dispatcher`:** notificações de cobrança (`payment_enqueue_notifications`).
