# Checkout e cobrança

## Objetivo

Permitir que o **cliente** pague o serviço aceito via cartão de crédito (NetCred), com parcelamento, tokenização segura (PCI no gateway) e cobrança automática **T-2** (48h antes do início do serviço).

## Fluxo do cliente (checkout)

1. Após aceitar proposta, o cliente acessa checkout (steps: telefone, CPF, cartão, confirmação).
2. Cartão é tokenizado via Edge `tokenize-payment-card` — dados sensíveis não persistem no app.
3. `accept_proposal` (evoluído) cria `payment_schedules` com parcelas e datas de cobrança.
4. Disclosure de timing: cobrança automática antes do serviço; cliente pode tentar cobrança manual em falha.

### CPF do titular do cartão

Ao cadastrar ou tokenizar um cartão, o formulário exige o campo **“CPF do titular do cartão”**. Esse CPF é enviado à Edge `tokenize-payment-card` e repassado à NetCred como documento do pagador; **não** precisa ser igual ao CPF da conta Renovi (coletado no step de CPF do checkout / perfil).

- Como conferência auxiliar, a UI compara apenas o primeiro nome do nome impresso no cartão com o primeiro nome do perfil. Quando forem diferentes, exibe o aviso: **“O primeiro nome no cartão parece diferente do nome da sua conta. Confira se digitou exatamente como está impresso.”** Esse aviso não bloqueia o envio.

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

## Valor cobrado no cartão (`charge_amount`)

O cliente paga o **preço do serviço** (`base_amount`, valor da proposta aceita) **mais** o repasse das taxas de cartão da NetCred. O valor debitado no cartão (`charge_amount` / `total_with_fees`) usa **gross-up NetCred**, para que, após MDR percentual e taxas fixas do gateway, o líquido da plataforma fique ≈ à **comissão Renovi**.

### Fórmula

```
fixed_fees    = cc_fixed_processing_fee_brl + cc_risk_analysis_fee_brl
charge_amount = ROUND_HALF_EVEN((base_amount + fixed_fees) / (1 - MDR%/100), 2)
```

- **MDR%** (`applicable_rate_pct`): percentual conforme bandeira (Visa/Master vs Elo/outras) e faixa de parcelas (1x, 2–6x, 7–12x), lido de `platform_constants` (`cc_visa_master_*_rate`, `cc_elo_other_*_rate`).
- **Taxas fixas:** `cc_fixed_processing_fee_brl` (PROCESSING) e `cc_risk_analysis_fee_brl` (RISK_ANALYSIS). Default de produção: R$ 0,39 e R$ 0,49; no seed/sandbox local a RISK_ANALYSIS sobe para R$ 5,00 (e PROCESSING para R$ 4,90) para espelhar tarifas de teste NetCred.
- **Arredondamento:** `ROUND_HALF_EVEN` (banker's rounding) em 2 casas decimais.
- **Antecipação:** não entra na fórmula padrão — cobranças enviadas com `automaticAdvance: false`.
- **Onde calcula:** `fee-calculator` (Edge compartilhado) e RPCs `payment_total_with_card_fees` / `payment_calculate_charge_amount` / `payment_calculate_installment_options` (seletor de parcelas, cobrança T-2 e manual). Mesma fórmula nos dois lados.

### O que não muda nesta regra

- Split do prestador continua **`FIXED_AMOUNT = provider_payout`** (congelado no aceite: `base_amount × (1 − commission_rate_pct/100)`).
- A plataforma recebe o restante (`charge_amount − provider_payout`) via `PERCENTAGE` 100%.
- Detalhe normativo de engenharia: `docs/payment-system/design.md` e `docs/adr/0001-payment-split-commission-model.md`.

## Prestador (KYC)

- Prestador submete dados bancários/documentos (`payment_submit_provider_kyc`).
- Onboarding NetCred detectado por cron; sem KYC ativo, cobrança não inclui o prestador.

## Cobrança manual (recuperação)

- Cliente pode disparar tentativa manual quando o schedule está em `FAILED` ou `FAILED_PERMANENT` (elegibilidade de UI) e dentro das regras da Edge `manual-charge-payment` (ex.: janela T-12h).
- No **detalhe do serviço**, a seção “Serviço contratado” exibe alerta **“Pagamento falhou”** (`ManualPaymentFailureAlert`) e o botão **“Ajustar pagamento”** (`ManualPaymentButton` / `ManualPaymentRecovery`).
- No **card de Meus serviços** (cliente), o mesmo dialog abre via CTA **“Ajustar pagamento”** quando `PENDING_PAYMENT` + `FAILED_PERMANENT` (ver [solicitacoes-do-cliente](../../my-services/features/solicitacoes-do-cliente.md)).

### Dialog `ManualPaymentDialog`

Componente canônico: `ManualPaymentDialog` (`ShellDialog` + `useMobileDialogViewport` — full-screen no mobile, footer sticky acima do teclado). Alias deprecado `ManualPaymentModal` ainda pode existir nos exports da feature.

Fluxo na UI (views do hook `useManualPaymentDialog`):

1. **Cartão** — selecionar cartão salvo ou cadastrar novo (mesmo padrão do checkout: `SavedCardSelector` / formulário de cartão + ClearSale).
2. **Parcelas** — escolher parcelamento com taxas via `InstallmentSelector` (mesmo seletor do aceite de proposta), com HMAC da opção.
3. **Confirmar** — revisar cartão e parcelas; ao confirmar:
   - RPC `payment_update_method` com novo token de cartão, `p_installment_number` e HMAC da seleção;
   - em seguida Edge Function `manual-charge-payment` (sessão ClearSale fresca).

A RPC `payment_update_method` aceita `p_installment_number` opcional, permite schedules em `SCHEDULED` / `FAILED` / `FAILED_PERMANENT`, e pode atualizar `installment_number` com validação HMAC quando a bandeira muda, o número de parcelas muda ou o cliente envia parcelas explicitamente.

## Mensagens de erro na UI (pt-BR)

Nos fluxos de **checkout**, **cartão** (tokenizar, atualizar método, remover cartão salvo) e **cobrança manual**, a UI exibe apenas mensagens amigáveis em português (Brasil), mapeadas a partir de **códigos de erro** conhecidos.

- Textos desconhecidos ou texto bruto do backend **não** são mostrados ao usuário; cai em mensagem genérica de retry.
- Em falha de cobrança manual, a UI usa o **código** de falha (`failureCode`), não o `failureReason` textual do backend.
- Superfícies cobertas: stepper de checkout (`CardForm`), dialog de cobrança manual (`ManualPaymentDialog`), lista de cartões salvos (também em Minha conta) e APIs/hooks de cartão e cobrança da feature `payments`.

Evidência: `mapPaymentUserMessage.ts`, `manualPaymentErrors.ts`, `paymentApiErrors.ts`; APIs `cards.api.ts`, `charges.api.ts`, `paymentApiClient.ts`; componentes `ManualPaymentDialog`, `CardForm`, `SavedCardsList`, `InstallmentSelector`.

## Notificações

- Cobrança próxima, sucesso, falha e cancelamento automático enfileirados via Message Dispatcher.

## Rollout operacional

Crons de pagamento ficam **ativos no deploy**. Runbooks de incidente em `docs/payment-system/`.

## Fora de escopo neste documento

- Detalhes de API NetCred — ver `docs/payment-system/payments-api.md`.
- Matriz de requisitos — ver `docs/payment-system/payment-system-requirements.md`.
