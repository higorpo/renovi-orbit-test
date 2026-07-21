# Checkout e cobrança

## Objetivo

Permitir que o **cliente** pague o serviço aceito via cartão de crédito (NetCred), com parcelamento, tokenização segura (PCI no gateway) e cobrança automática **T-2** (48h antes do início do serviço).

## Fluxo do cliente (checkout)

1. Após aceitar proposta, o cliente acessa checkout (steps: telefone, CPF, cartão, confirmação).
2. Cartão é tokenizado via Edge `tokenize-payment-card` — dados sensíveis não persistem no app.
3. `accept_proposal` (evoluído) cria `payment_schedules` com parcelas e datas de cobrança.
4. Disclosure de timing: cobrança automática antes do serviço; cliente pode tentar cobrança manual em falha.

### CPF e telefone da conta (aceite)

O servidor exige CPF e telefone no perfil/checkout antes de `accept_proposal`. Se faltarem, a RPC falha com **`PROFILE_INCOMPLETE`** (mensagem amigável na UI: completar CPF e telefone antes de confirmar). Não é só validação de formulário no cliente.

### ClearSale (sessão antifraude)

- A sessão ClearSale é **emitida pelo servidor** (`payment_issue_clearsale_session` / API `issueClearSaleSession`) e ligada ao usuário + proposta (aceite) ou parcela (cobrança manual). O cliente não inventa o UUID.
- Em **produção**, falha ao carregar/inicializar o SDK ClearSale é **fail-closed**: o checkout/cobrança não segue sem sessão válida.
- O cron T-2 (`schedule-netcred-charges`) **não chama** `createCharge` em produção se a parcela estiver sem `clearsale_session_id`.

### CPF do titular do cartão

Ao cadastrar ou tokenizar um cartão, o formulário exige o campo **“CPF do titular do cartão”**. Esse CPF é enviado à Edge `tokenize-payment-card` e repassado à NetCred como documento do pagador; **não** precisa ser igual ao CPF da conta Renovi (coletado no step de CPF do checkout / perfil).

- Como conferência auxiliar, a UI compara apenas o primeiro nome do nome impresso no cartão com o primeiro nome do perfil. Quando forem diferentes, exibe o aviso: **“O primeiro nome no cartão parece diferente do nome da sua conta. Confira se digitou exatamente como está impresso.”** Esse aviso não bloqueia o envio.

### Tokens vinculados à empresa NetCred da plataforma

Cartões são **sempre** tokenizados sob a company NetCred da **Renovi** (`NETCRED_PLATFORM_COMPANY_ID` / Vault `netcred_platform_company_id`), no perfil e no checkout. A **cobrança** (`chargeCreate`) usa a company NetCred do **prestador** (para o split bancário ser válido); o token só precisa ser da platform.

No aceite/cobrança, token cujo `netcred_company_id` ≠ platform gera **`PAYMENT_TOKEN_COMPANY_MISMATCH`**: o cliente precisa **adicionar o cartão de novo**. Cartão salvo no perfil serve para qualquer prestador, desde que tenha sido tokenizado sob a platform company vigente.

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
- **Drift checkout → T-2 (intencional):** a estimativa no aceite/checkout pode diferir levemente do valor debitado na cobrança (MDR/taxas vigentes no momento da cobrança). A UI divulga isso em `PaymentTrustDisclosure` (“taxas de cartão podem ser recalculadas no momento da cobrança…”).

### O que não muda nesta regra

- Split do prestador continua **`FIXED_AMOUNT = provider_payout`** (congelado no aceite: `base_amount × (1 − commission_rate_pct/100)`).
- A plataforma recebe o restante (`charge_amount − provider_payout`) via `PERCENTAGE` 100%.
- Detalhe normativo de engenharia: `docs/payment-system/design.md` e `docs/adr/0001-payment-split-commission-model.md`.

### Settlement no webhook

Em captura (`TRANSACTION_CAPTURE`), o `paid_amount` gravado na parcela é o valor **calculado pelo servidor** (`payment_calculate_charge_amount`), não o valor informado no payload do gateway (esse fica só em metadados de auditoria se divergir).

## Prestador (KYC / onboarding NetCred)

- Prestador submete dados bancários/documentos (`payment_submit_provider_kyc`).
- Onboarding NetCred detectado por cron (`detect-netcred-onboarding`). Status **`ACTIVE`** exige `netcred_company_id` **e** `netcred_bank_account_id` preenchidos.
- **Sem onboarding `ACTIVE` não há cobrança** (nem aceite de proposta com pagamento): gate `PROVIDER_NOT_CREDENTIALED` / `provider_not_credentialed`. Não existe fluxo de “cobrar sem o prestador no split”.

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
   - em seguida Edge Function `manual-charge-payment` com **sessão ClearSale fresca** (UUID novo ≠ sessão anterior da parcela).

A RPC `payment_update_method` aceita `p_installment_number` opcional, permite schedules em `SCHEDULED` / `FAILED` / `FAILED_PERMANENT`, e pode atualizar `installment_number` com validação HMAC quando a bandeira muda, o número de parcelas muda ou o cliente envia parcelas explicitamente.

### Segurança anti double-charge (manual)

Antes de rotacionar referência ou chamar `createCharge`, a Edge **consulta o gateway** com a `gateway_reference_code` anterior. Se a transação já estiver `PAID` / `IN_ANALYSIS` (ex.: timeout após sucesso ambíguo), **reconcilia** esse resultado e **não** cria nova cobrança. Nova referência só quando a anterior está ausente/rejeitada/void.

## Mensagens de erro na UI (pt-BR)

Nos fluxos de **checkout**, **cartão** (tokenizar, atualizar método, remover cartão salvo) e **cobrança manual**, a UI exibe apenas mensagens amigáveis em português (Brasil), mapeadas a partir de **códigos de erro** conhecidos.

- Textos desconhecidos ou texto bruto do backend **não** são mostrados ao usuário; cai em mensagem genérica de retry.
- Em falha de cobrança manual, a UI usa o **código** de falha (`failureCode` / `payment_schedules.failure_code`), não o `failureReason` textual do backend.
- Na **tokenização** (cadastro de cartão), rejeições finas do gateway chegam ao cliente como código opaco **`CARD_REJECTED`** (cópia genérica de “não foi possível cadastrar”), sem expor motivos detalhados do emissor/ClearSale na resposta da Edge.
- Tokenização pelo perfil (Minha conta) tem **rate limit mais restrito** (por minuto + teto diário); excesso → HTTP 429 / `rate_limited`.
- Superfícies cobertas: stepper de checkout (`CardForm`), dialog de cobrança manual (`ManualPaymentDialog` — erro terminal), alerta **“Pagamento falhou”** (`ManualPaymentFailureAlert`), lista de cartões salvos (também em Minha conta) e APIs/hooks de cartão e cobrança da feature `payments`.

Evidência: `mapPaymentUserMessage.ts`, `manualPaymentErrors.ts`, `paymentApiErrors.ts`; APIs `cards.api.ts`, `charges.api.ts`, `paymentApiClient.ts`; Edge `tokenize-payment-card`; componentes `ManualPaymentDialog`, `ManualPaymentFailureAlert`, `CardForm`, `SavedCardsList`, `InstallmentSelector`.

### Rejeição por análise de risco (ClearSale / NetCred)

Quando a NetCred rejeita a transação com `transactions.node.rejectedReason` começando por **“Análise de Risco: …”** (texto da ClearSale), o backend **não** grava esse texto como código estável. Em vez disso:

1. A mutation GraphQL `chargeCreate` solicita `transactions.node.rejectedReason`.
2. O adapter mapeia a string para um **código Renovi** estável (prefixo `RISK_ANALYSIS_*`) e persiste em `payment_schedules.failure_code`.
3. A mensagem bruta NetCred/ClearSale fica em `payment_schedules.failure_reason` **só para diagnóstico** — a UI **nunca** a exibe ao cliente.
4. Na cobrança manual, o alerta e o dialog de erro terminal mostram a cópia pt-BR de `mapPaymentUserMessage` a partir do `failure_code`.

| Código Renovi (`failure_code`) | Quando (resumo do motivo ClearSale) | Mensagem ao usuário (pt-BR) |
|--------------------------------|-------------------------------------|-----------------------------|
| `RISK_ANALYSIS_NO_CONTACT` | Falta de contato / reprovado sem suspeita | Não foi possível validar… confira dados de contato ou use outro cartão |
| `RISK_ANALYSIS_FRAUD_SUSPICION` | Suspeita de fraude | Recusado pela análise de segurança… outro cartão ou suporte |
| `RISK_ANALYSIS_CANCELLED_DUPLICATE` | Duplicidade ou solicitação do cliente | Cancelado por duplicidade… tente de novo com outro cartão |
| `RISK_ANALYSIS_CONFIRMED_FRAUD` | Fraude confirmada | Recusado pela análise de segurança… outro cartão ou suporte |
| `RISK_ANALYSIS_BUSINESS_RULE` | Regra de negócio | Recusado pelas regras de segurança… outro cartão |
| `RISK_ANALYSIS_POLICY` | Política estabelecida (cliente/ClearSale) | Recusado pela política de segurança… outro cartão ou suporte |
| `RISK_ANALYSIS_MANUAL_FACILITATOR` | Reprovado manualmente pelo facilitador | Recusado na análise de segurança… outro cartão ou suporte |
| `RISK_ANALYSIS_REJECTED` | Fallback: texto “Análise de Risco: …” sem matcher específico | Recusado pela análise de segurança… outro cartão ou suporte |

Se `rejectedReason` **não** for análise de risco ClearSale, o código continua o fallback genérico de rejeição do gateway (ex.: `REJECTED`), sem inventar um `RISK_ANALYSIS_*`.

Evidência: `supabase/functions/_shared/payment/map-rejected-reason.ts`, `netcred-adapter.ts`, `netcred-graphql.ts` (`chargeCreate` + `rejectedReason`); UI `mapPaymentUserMessage.ts`, `ManualPaymentFailureAlert`, `ManualPaymentDialog`.

## Notificações

- Cobrança próxima, sucesso, falha e cancelamento automático enfileirados via Message Dispatcher.

## Rollout operacional

Crons de pagamento ficam **ativos no deploy**. Runbooks de incidente em `docs/payment-system/`.

## Fora de escopo neste documento

- Detalhes de API NetCred — ver `docs/payment-system/payments-api.md`.
- Matriz de requisitos — ver `docs/payment-system/payment-system-requirements.md`.
