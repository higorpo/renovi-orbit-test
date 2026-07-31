# Pagamentos (`payments`)

## 1. Leitura para negócio

- **Para que serve:** checkout com cartão (tokenização NetCred), cobrança automática T-2 antes do serviço, cobrança manual pelo cliente, histórico de pagamentos/recebimentos **na captura** (com breakdown de reembolso), **requisito de KYC `ACTIVE` para cobrança** e notificações de cobrança. Liquidações bancárias do prestador (Ganhos) são UI em [`provider-earnings`](../provider-earnings/README.md); este módulo mantém a persistência (`payment_settlement_movements`, webhooks `PAYOUT_*`).
- **Quem usa:** cliente (checkout, cartões salvos, histórico com reembolsos, cobrança manual); prestador (histórico de recebimentos líquidos na captura em Minha conta; **UI/gate de KYC** em `provider-kyc`; Ganhos em `provider-earnings`); operação (runbooks em `docs/payment-system/`).
- **Valor:** pagamento protegido integrado ao fluxo de aceite de proposta; repasse ao prestador após execução do serviço. O `charge_amount` no cartão usa **gross-up NetCred** (MDR% + PROCESSING + RISK_ANALYSIS) para o líquido da plataforma ≈ comissão Renovi; o split `FIXED_AMOUNT` do prestador não muda com essa regra.
- **Rollout:** crons de pagamento ativos no deploy; runbooks operacionais em `docs/payment-system/`.

## 2. Visão geral técnica

| Aspecto | Detalhe |
|---------|---------|
| Feature | `src/features/payments/` — checkout stepper, cartões, histórico, cobrança manual |
| KYC (UI / gate do shell) | Feature dedicada `src/features/provider-kyc/` — ver [provider-kyc](../provider-kyc/README.md) |
| Backend | RPCs `payment_*` + Edge Functions NetCred (tokenização, cobrança, webhook, reembolso, KYC, reconciliação) |
| Histórico (leitura) | Views `client_payment_transactions_v` e `provider_payment_receivables_v` (captura); settlements: `provider_settlement_movements_v` / RPC `list_provider_settlement_movements` (UI em `provider-earnings`) |
| Cobrança automática | pg_cron → `schedule-netcred-charges` → `payment_claim_charge_batch` → NetCred |
| Constantes | `platform_constants` (MDR por bandeira/parcela, `cc_fixed_processing_fee_brl`, `cc_risk_analysis_fee_brl`, tentativas, batch sizes) |
| Fórmula de cobrança | Gross-up: `ROUND_HALF_EVEN((base + PROCESSING + RISK_ANALYSIS) / (1 − MDR%/100), 2)` — ver [checkout-e-cobranca](./features/checkout-e-cobranca.md#valor-cobrado-no-cartão-charge_amount) |
| Auditoria de linha (`payment_schedules`) | Tabela append-only `payment_schedules_audit` grava o snapshot completo da parcela em toda INSERT/UPDATE/DELETE de `payment_schedules`, via um trigger de statement (transition tables) com versionamento set-based. Cada linha tem `audit_id`, `audit_op` (`INSERT`/`UPDATE`/`DELETE`), `audited_at`, `row_version` (só no audit; max+1 por parcela) e `audit_txid` (correlação com o mesmo TX). **Distinta** do `payment_audit_log` (eventos de ciclo de vida): esta é histórico técnico de linha, sem escrita pela aplicação. RLS: só admin lê (`SELECT`); sem UPDATE/DELETE/TRUNCATE; `service_role` só `SELECT` (INSERT só pelo trigger DEFINER). Sem uso na UI. |

## 3. Documentação da feature

| Documento | Conteúdo |
|-----------|----------|
| [features/checkout-e-cobranca.md](./features/checkout-e-cobranca.md) | Checkout, ClearSale (sessão server-side; fail-closed em prod), tokenização com CPF do titular, vínculo token↔**company da plataforma** Renovi (prestador só no payout), T-2, estados de parcela, **fórmula `charge_amount` (gross-up NetCred)** + disclosure de recálculo na cobrança, KYC backend (`ACTIVE` = company+bank; sem ACTIVE **não cobra**), cobrança manual (reconcilia ref. anterior; sessão ClearSale fresca), `CARD_REJECTED` opaco, `PROFILE_INCOMPLETE`, rejeição ClearSale → `RISK_ANALYSIS_*`, mensagens amigáveis pt-BR |
| [features/historico-e-reembolso.md](./features/historico-e-reembolso.md) | Histórico cliente/prestador (**captura**); breakdown de reembolso; **gateway first** pós-`PAID`; faixa ToS pelo slot vigente pós-reagendamento (`refund_anchor` só auditoria); recaptura longe pós-reagendamento distinta de cancelamento ToS; `PAID`→`REFUNDED` via webhook; assinatura inválida terminal |
| Engenharia | `docs/payment-system/design.md` (§3.13 histórico captura + settlements; §4.8 reembolso) |
| Gate / UI de KYC no dashboard | [provider-kyc — gate](../provider-kyc/features/gate-e-acesso-operacional.md) · [wizard Fase 3](../provider-kyc/features/formulario-credenciamento-wizard.md) |
| Ganhos (liquidação bancária) | [provider-earnings](../provider-earnings/README.md) |

**Erros na UI:** checkout, cartões e cobrança manual nunca exibem texto bruto do backend — só mensagens amigáveis em pt-BR mapeadas por código (ver [checkout-e-cobranca](./features/checkout-e-cobranca.md#mensagens-de-erro-na-ui-pt-br)). Rejeições ClearSale “Análise de Risco: …” viram `RISK_ANALYSIS_*` em `failure_code` (mensagem bruta só em `failure_reason` para diagnóstico). Tokenização rejeitada ao cliente: `CARD_REJECTED`.

## 4. Relação com outros módulos

- **`negotiation-proposals` / `chats`:** aceite de proposta cria `payment_schedules` e abre checkout.
- **`my-account`:** embute `PaymentHistorySection` (cliente e prestador) em `/dashboard/conta`.
- **`provider-earnings`:** UI de liquidações bancárias; lê settlements deste domínio; disclosure de previsão importado da Public API (sem re-export em `payments`).
- **`provider-kyc`:** UI (gate + wizard de credenciamento) até onboarding `ACTIVE`; backend de submissão/detecção permanece nas RPCs/EFs NetCred deste domínio.
- **`my-services` / `view-services`:** status do serviço contratado reflete ciclo de pagamento; cancelamento pós-pagamento dispara reembolso; aviso discreto de `far_recapture_pending` no detalhe.
- **`service-reschedule`:** ao aceitar nova data, `payment_reschedule_charge_date` retarget pré-`PAID`, mantém captura pós-`PAID` perto (≤15d) ou orquestra recaptura longe (EF `process-far-reschedule-recapture`) — ver [integracao-pagamento-pos-aceite](../service-reschedule/features/integracao-pagamento-pos-aceite.md).
- **`message-dispatcher`:** notificações de cobrança (`payment_enqueue_notifications`).
