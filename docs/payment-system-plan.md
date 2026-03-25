# Renovi — Plano de Implementação do Sistema de Pagamentos
## Processador: Asaas | Modelo: Escrow
### Versão 2.0 — 2026-03-25 (revisado com documentação oficial Asaas)

---

## AVISO CRÍTICO DE SCHEMA (Leia antes de tudo)

O modelo de precificação atual em `provider_proposals` calcula:

```
final_amount = proposed_amount - tax_amount   (= proposed_amount * 0.85)
```

Ou seja, `final_amount` é o **VALOR LÍQUIDO DO PRESTADOR**, não o que o cliente paga.
O cliente atualmente paga `proposed_amount`.

O novo sistema introduz uma **taxa do cliente** sobre o `proposed_amount`:

```
client_charge_amount = proposed_amount + client_fee_amount   ← o que o cliente paga ao Asaas
provider_net_amount  = proposed_amount - provider_fee_amount ← o que o prestador recebe (= atual final_amount)
```

O cliente **nunca** vê a composição da taxa. Apenas `client_charge_amount`.

---

## 1. RESUMO EXECUTIVO

O fluxo de aprovação de orçamento deve ser **bloqueado por pagamento**:

1. Cliente seleciona proposta de prestador na tela Orçamentos
2. Cliente é redirecionado para tela de checkout "Revisar e Pagar"
3. Plataforma cria cobrança no Asaas **antes** de aceitar a proposta
4. Após confirmação do pagamento: proposta → `accepted`, pedido → `in_progress`, `services` criado
5. Fundos ficam **retidos em escrow** no Asaas até o cliente confirmar a conclusão do serviço
6. Na confirmação do serviço: `POST /v3/escrow/{id}/finish` libera os fundos para o prestador
7. Webhooks Asaas são a **fonte autoritativa** de estado do pagamento

### Decisões Arquiteturais Definitivas

| Decisão | Resposta | Justificativa |
|---------|----------|---------------|
| Quando criar `services`? | `PAYMENT_CONFIRMED` (cartão) / `PAYMENT_RECEIVED` (Pix) | Pix não tem CONFIRMED separado; ambos tratados idempotentemente |
| Split: fixo ou percentual? | **Fixo** (`fixedValue`) | Asaas calcula % sobre `netValue` (pós-taxas Asaas), que é imprevisível |
| Escrow em V1? | **Sim — escrow é o modelo adotado desde V1** | Garante ao cliente que o prestador só recebe após confirmação |
| Expiração do checkout? | Lock de 30 min no proposal + Pix válido por 12 meses a partir do due date | QR Pix não expira em 1h — é dinâmico, válido por 12 meses do due date |
| `client_response_deadline_at` ainda relevante? | Sim para `submitted`; esvaziado quando `payment_pending` | Trigger atualizado para bloquear também `submitted → payment_pending` após 48h |

---

## 2. AVALIAÇÃO DO SCHEMA ATUAL

### 2.1 `provider_proposals` — Problemas Encontrados

| Coluna | Estado Atual | Avaliação |
|--------|-------------|-----------|
| `proposed_amount` | Valor cotado pelo prestador (pré-taxa) | Reutilizar — base bruta |
| `tax_rate` | Taxa do prestador (0.15) | Reutilizar — taxa do lado provedor |
| `tax_amount` | `proposed_amount * tax_rate` | Reutilizar — taxa deduzida do prestador |
| `final_amount` | `proposed_amount - tax_amount` | Reutilizar — **é o líquido do prestador** |
| `pricing_signature` | HMAC dos 4 campos acima | Estender para cobrir 7 campos |
| `status` | 4 valores | **Expandir para 7 valores** |
| `client_response_deadline_at` | created_at + 48h | Manter; trigger atualizado |

**Colunas ausentes:**
- `client_fee_rate` — taxa cobrada do cliente
- `client_fee_amount` — valor absoluto da taxa do cliente
- `client_charge_amount` — valor final que o cliente paga
- `checkout_locked_until` — lock de concorrência durante checkout ativo
- `locked_payment_id` — FK para `service_payments.id` ativo

### 2.2 `service_requests` — Problemas Encontrados

Status check atual tem apenas 4 valores. Faltam: `budget_selected_pending_payment`, `disputed`.

### 2.3 `profiles`

Ausente: `asaas_customer_id text` (para clientes).

### 2.4 `provider_profiles_private`

Ausentes:
- `asaas_wallet_id text` — wallet ID do subaccount Asaas do prestador
- `asaas_subaccount_id text` — ID do subaccount
- `asaas_account_api_key text` — API key do subaccount (**CRÍTICO: só retornado na criação**)
- `asaas_onboarding_status text` — `pending | active | suspended`

### 2.5 `client_profiles_private`

Possui `cpf` — necessário para criar customer no Asaas.

### 2.6 `platform_constants`

Possui: `renovi_tax_provider = 0.15`, `pricing_signature_secret`.

Faltam:
- `renovi_tax_client` — ex.: `0.05` (5% de taxa do cliente — **confirmar com produto**)
- `checkout_lock_duration_minutes` — ex.: `30`
- `escrow_days_to_expire` — ex.: `30` (dias de backup se release manual falhar)
- `asaas_environment` — `sandbox` ou `production`

---

## 3. MUDANÇAS DE SCHEMA PROPOSTAS

### 3.1 ALTER `provider_proposals`

```sql
-- Novos campos financeiros
ALTER TABLE public.provider_proposals
  ADD COLUMN client_fee_rate      numeric(6,4),
  ADD COLUMN client_fee_amount    numeric(10,2),
  ADD COLUMN client_charge_amount numeric(10,2),  -- proposed_amount + client_fee_amount
  -- Lock de checkout
  ADD COLUMN checkout_locked_until timestamptz,
  ADD COLUMN locked_payment_id     uuid;          -- FK sem constraint (evita circular)

-- Expandir status CHECK para 7 valores
ALTER TABLE public.provider_proposals
  DROP CONSTRAINT provider_proposals_status_check;
ALTER TABLE public.provider_proposals
  ADD CONSTRAINT provider_proposals_status_check
  CHECK (status IN (
    'submitted',
    'payment_pending',
    'accepted',
    'rejected',
    'withdrawn',
    'closed_due_to_other_selection',
    'expired'
  ));
```

**Trigger `enforce_provider_proposal_client_response_deadline`:**
Atualizar para bloquear `submitted → payment_pending` após 48h (além de `submitted → accepted`).

**Trigger `sync_provider_proposal_client_response_deadline`:**
Limpar `client_response_deadline_at` também quando status = `payment_pending`.

**Trigger `expire_stale_provider_proposals`:**
- Mudar status de `rejected` para `expired` para propostas auto-expiradas
- **Pular propostas com `status = 'payment_pending'`** — essas têm expiração própria via `checkout_expires_at`

**`pricing_signature`:**
O HMAC deve cobrir todos os 7 campos financeiros:
```
proposed_amount|tax_rate|tax_amount|final_amount|client_fee_rate|client_fee_amount|client_charge_amount
```

### 3.2 ALTER `service_requests`

```sql
ALTER TABLE public.service_requests
  DROP CONSTRAINT service_requests_status_check;
ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN (
    'open',
    'budget_selected_pending_payment',
    'in_progress',
    'closed',
    'cancelled',
    'disputed'
  ));
```

### 3.3 ALTER `profiles`

```sql
ALTER TABLE public.profiles
  ADD COLUMN asaas_customer_id text;

CREATE UNIQUE INDEX profiles_asaas_customer_id_idx
  ON public.profiles (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
```

### 3.4 ALTER `provider_profiles_private`

```sql
ALTER TABLE public.provider_profiles_private
  ADD COLUMN asaas_wallet_id          text,
  ADD COLUMN asaas_subaccount_id      text,
  ADD COLUMN asaas_account_api_key    text,   -- CRÍTICO: só retornado na criação da subconta
  ADD COLUMN asaas_onboarding_status  text DEFAULT 'pending'
    CHECK (asaas_onboarding_status IN ('pending', 'active', 'suspended'));

CREATE UNIQUE INDEX ppp_asaas_wallet_id_idx
  ON public.provider_profiles_private (asaas_wallet_id)
  WHERE asaas_wallet_id IS NOT NULL;
```

> **Segurança:** `asaas_account_api_key` deve ser criptografado em repouso (Vault/pgcrypto) pois concede acesso total ao subaccount do prestador. Nunca expor via RLS para clientes ou para o próprio prestador via API pública.

### 3.5 Novos `platform_constants`

```sql
INSERT INTO public.platform_constants (key, value) VALUES
  ('renovi_tax_client',             '0.05'),
  ('checkout_lock_duration_minutes','30'),
  ('escrow_days_to_expire',         '30'),
  ('asaas_environment',             '"sandbox"')
ON CONFLICT (key) DO NOTHING;
```

---

## 4. NOVAS TABELAS

### 4.1 `services` — Entidade Operacional

```sql
CREATE TABLE public.services (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origem
  service_request_id   uuid NOT NULL REFERENCES public.service_requests(id)  ON DELETE RESTRICT,
  proposal_id          uuid NOT NULL REFERENCES public.provider_proposals(id) ON DELETE RESTRICT,
  provider_id          uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,
  client_id            uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,

  -- Status operacional
  status               text NOT NULL DEFAULT 'awaiting_start'
    CHECK (status IN (
      'awaiting_start',  -- pagamento confirmado, serviço ainda não iniciado
      'in_progress',     -- prestador iniciou o trabalho
      'completed',       -- prestador marcou como concluído
      'confirmed',       -- cliente confirmou a conclusão → dispara liberação do escrow
      'cancelled',       -- cancelado após criação
      'disputed'         -- chargeback ou disputa ativa
    )),

  -- Agendamento
  agreed_slot          jsonb,          -- slot escolhido dos proposal_suggested_slots
  scheduled_start_at   timestamptz,
  scheduled_end_at     timestamptz,

  -- Execução
  started_at           timestamptz,
  completed_at         timestamptz,
  confirmed_at         timestamptz,    -- quando cliente confirmou → trigger de release do escrow
  cancelled_at         timestamptz,
  cancellation_reason  text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Guarda de idempotência: apenas UM service por proposal, para sempre
CREATE UNIQUE INDEX services_proposal_id_unique ON public.services (proposal_id);

CREATE INDEX services_service_request_id_idx ON public.services (service_request_id);
CREATE INDEX services_provider_id_idx        ON public.services (provider_id);
CREATE INDEX services_client_id_idx          ON public.services (client_id);
CREATE INDEX services_status_idx             ON public.services (status);
```

**Regra fundamental:** `services` não armazena dados financeiros. Todo dado de dinheiro vive em `service_payments`.

### 4.2 `service_payments` — Entidade Financeira

```sql
CREATE TABLE public.service_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos
  service_request_id          uuid NOT NULL REFERENCES public.service_requests(id)  ON DELETE RESTRICT,
  proposal_id                 uuid NOT NULL REFERENCES public.provider_proposals(id) ON DELETE RESTRICT,
  service_id                  uuid REFERENCES public.services(id) ON DELETE SET NULL, -- preenchido após criação do service
  client_id                   uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,
  provider_id                 uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,

  -- Status interno do pagamento
  status                      text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created',                  -- registro criado, cobrança Asaas ainda não criada
      'pending',                  -- cobrança Asaas criada, aguardando pagamento
      'awaiting_risk_analysis',   -- cartão em análise de risco
      'confirmed',                -- pagamento confirmado (cartão capturado ou Pix recebido)
      'received',                 -- fundos liquidados na conta da plataforma
      'failed',                   -- falha (cartão recusado, reprovado por risco etc.)
      'expired',                  -- Pix vencido ou timeout do checkout
      'refunded',                 -- estorno total
      'partially_refunded',       -- estorno parcial
      'chargeback',               -- chargeback aberto
      'cancelled'                 -- cancelado antes de qualquer tentativa de pagamento
    )),

  -- Método de pagamento
  billing_type                text NOT NULL CHECK (billing_type IN ('PIX', 'CREDIT_CARD')),

  -- ────────────────────────────────────────────────────────────────
  -- SNAPSHOT FINANCEIRO — congelado na criação do checkout (IMUTÁVEL)
  -- ────────────────────────────────────────────────────────────────
  -- Lado do prestador
  proposed_amount             numeric(10,2) NOT NULL,   -- valor cotado pelo prestador
  provider_fee_rate           numeric(6,4)  NOT NULL,   -- ex.: 0.15
  provider_fee_amount         numeric(10,2) NOT NULL,   -- proposed_amount * provider_fee_rate
  provider_net_amount         numeric(10,2) NOT NULL,   -- proposed_amount - provider_fee_amount

  -- Lado do cliente
  client_fee_rate             numeric(6,4)  NOT NULL,   -- ex.: 0.05
  client_fee_amount           numeric(10,2) NOT NULL,   -- proposed_amount * client_fee_rate
  client_charge_amount        numeric(10,2) NOT NULL,   -- proposed_amount + client_fee_amount (valor cobrado do cliente)

  -- Plataforma
  platform_total_fee_amount   numeric(10,2) NOT NULL,   -- provider_fee_amount + client_fee_amount

  -- Liquidação Asaas
  asaas_net_value             numeric(10,2),            -- preenchido via webhook (netValue após taxas Asaas)

  -- Estorno
  refunded_amount             numeric(10,2) NOT NULL DEFAULT 0,

  -- ────────────────────────────────────────────────────────────────
  -- SNAPSHOT DO SPLIT — congelado no checkout
  -- ────────────────────────────────────────────────────────────────
  split_wallet_id             text,            -- walletId do subaccount Asaas do prestador
  split_fixed_value           numeric(10,2),   -- = provider_net_amount (valor fixo enviado ao prestador)
  split_snapshot              jsonb,           -- array completo enviado ao Asaas

  -- ────────────────────────────────────────────────────────────────
  -- DADOS DO GATEWAY ASAAS
  -- ────────────────────────────────────────────────────────────────
  asaas_payment_id            text UNIQUE,     -- ex.: "pay_abc123"
  asaas_customer_id           text,
  asaas_invoice_url           text,
  asaas_pix_qr_code           text,            -- payload copy-paste do Pix
  asaas_pix_qr_code_image     text,            -- imagem Base64 ou URL do QR code
  asaas_pix_expiration_date   timestamptz,     -- data de expiração do QR (12 meses a partir do due date)
  asaas_due_date              date,
  asaas_paid_at               timestamptz,
  asaas_credit_date           date,
  asaas_last_status           text,            -- último status bruto do Asaas
  asaas_failure_reason        text,

  -- ────────────────────────────────────────────────────────────────
  -- DADOS DE ESCROW
  -- ────────────────────────────────────────────────────────────────
  -- O escrow é configurado no subaccount do prestador.
  -- Quando o split é recebido, o Asaas bloqueia o valor automaticamente.
  -- A garantia (guarantee) está associada à cobrança no subaccount do prestador.
  -- Para liberar: POST /v3/escrow/{asaas_escrow_guarantee_id}/finish
  asaas_escrow_guarantee_id   text,            -- ID da garantia escrow no subaccount do prestador
  escrow_status               text DEFAULT 'not_applicable'
    CHECK (escrow_status IN (
      'not_applicable',   -- escrow não ativo para este prestador
      'blocked',          -- fundos retidos no escrow
      'released',         -- fundos liberados (manual via /finish ou expiração)
      'cancelled'         -- escrow cancelado (ex.: estorno)
    )),
  escrow_release_triggered_at timestamptz,     -- quando o release foi disparado (services.confirmed_at)
  escrow_released_at          timestamptz,     -- quando o Asaas confirmou a liberação

  -- ────────────────────────────────────────────────────────────────
  -- INTEGRIDADE DE PRECIFICAÇÃO
  -- ────────────────────────────────────────────────────────────────
  proposal_pricing_signature  text NOT NULL,   -- cópia da pricing_signature da proposta no momento do checkout

  -- ────────────────────────────────────────────────────────────────
  -- TEMPOS DO CHECKOUT
  -- ────────────────────────────────────────────────────────────────
  checkout_initiated_at       timestamptz NOT NULL DEFAULT now(),
  checkout_expires_at         timestamptz NOT NULL,   -- checkout_initiated_at + lock_duration
  payment_confirmed_at        timestamptz,
  payment_received_at         timestamptz,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sp_asaas_payment_id_idx
  ON public.service_payments (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

CREATE INDEX sp_proposal_id_idx         ON public.service_payments (proposal_id);
CREATE INDEX sp_service_request_id_idx  ON public.service_payments (service_request_id);
CREATE INDEX sp_client_id_idx           ON public.service_payments (client_id);
CREATE INDEX sp_provider_id_idx         ON public.service_payments (provider_id);
CREATE INDEX sp_status_idx              ON public.service_payments (status);
CREATE INDEX sp_checkout_expires_idx    ON public.service_payments (checkout_expires_at)
  WHERE status IN ('created', 'pending');
CREATE INDEX sp_escrow_blocked_idx      ON public.service_payments (escrow_status)
  WHERE escrow_status = 'blocked';
```

### 4.3 `service_payment_events` — Log de Webhooks e Auditoria

```sql
CREATE TABLE public.service_payment_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  service_payment_id       uuid NOT NULL REFERENCES public.service_payments(id) ON DELETE CASCADE,

  -- Origem do evento
  event_source             text NOT NULL CHECK (event_source IN ('asaas_webhook', 'internal', 'manual_admin')),
  event_type               text NOT NULL,   -- ex.: 'PAYMENT_CONFIRMED', 'checkout_expired', 'escrow_released'

  -- Dados Asaas
  asaas_event_id           text,            -- ID único do evento Asaas (para idempotência)
  asaas_payment_id         text,

  -- Transições de estado registradas
  previous_payment_status  text,
  new_payment_status       text,
  previous_proposal_status text,
  new_proposal_status      text,
  previous_request_status  text,
  new_request_status       text,

  -- Dados brutos
  raw_payload              jsonb,           -- corpo completo do webhook

  -- Processamento
  processed_at             timestamptz NOT NULL DEFAULT now(),
  processing_error         text,
  is_duplicate             boolean NOT NULL DEFAULT false,

  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Guarda primária de idempotência: mesmo evento Asaas nunca processado duas vezes
CREATE UNIQUE INDEX spe_asaas_event_id_unique
  ON public.service_payment_events (asaas_event_id)
  WHERE asaas_event_id IS NOT NULL;

CREATE INDEX spe_service_payment_id_idx ON public.service_payment_events (service_payment_id);
CREATE INDEX spe_asaas_payment_id_idx   ON public.service_payment_events (asaas_payment_id);
CREATE INDEX spe_event_type_idx         ON public.service_payment_events (event_type);
CREATE INDEX spe_created_at_idx         ON public.service_payment_events (created_at DESC);
```

---

## 5. MODELO FINANCEIRO

### 5.1 Definição dos Valores

Dado `proposed_amount = R$1.000,00` com as taxas atuais:

```
provider_fee_rate      = 0.15   (renovi_tax_provider — já existe)
client_fee_rate        = 0.05   (renovi_tax_client — NOVO, confirmar com produto)

provider_fee_amount    = R$150,00
provider_net_amount    = R$850,00   (= atual final_amount)

client_fee_amount      = R$50,00
client_charge_amount   = R$1.050,00  ← único valor mostrado ao cliente

platform_total_fee     = R$200,00   (fica na conta principal da plataforma)

Cobrança Asaas         = R$1.050,00
Split ao prestador     = R$850,00 (fixedValue)
Plataforma retém       = R$200,00 (menos taxas Asaas — absorvidas pela plataforma)
```

### 5.2 Estratégia de Split: VALOR FIXO

**Decisão: `fixedValue`, não `percentualValue`.**

Razão: O Asaas calcula splits percentuais sobre o `netValue` (valor após as próprias taxas do Asaas). Como as taxas do Asaas variam e não são conhecidas exatamente no momento da criação da cobrança, um split percentual pode fazer o prestador receber menos do prometido. Com valor fixo, o prestador **sempre recebe exatamente** o `provider_net_amount`. A plataforma absorve as taxas do Asaas do seu próprio share.

**Payload de split enviado ao Asaas:**
```json
{
  "split": [
    {
      "walletId": "<provider_asaas_wallet_id>",
      "fixedValue": 850.00
    }
  ]
}
```

O saldo restante (R$200,00 menos taxas Asaas) fica automaticamente na conta da plataforma.

> **Atenção:** Não inclua o próprio walletId da conta principal no array de split — o Asaas bloqueia isso.

---

## 6. MODELO DE ESCROW (ADOTADO EM V1)

### 6.1 Como o Escrow Funciona no Asaas

O escrow do Asaas opera **no nível do subaccount do prestador**:

1. O prestador tem um subaccount Asaas
2. A plataforma habilita o escrow nesse subaccount: `POST /v3/accounts/{subaccount_id}/escrow`
3. A partir daí, **todos os recebimentos** daquele subaccount ficam retidos pelo período `daysToExpire`
4. Quando o split chega ao subaccount, o valor vai para o saldo — mas fica **bloqueado** pela garantia de escrow
5. A cobrança no subaccount contém um campo `escrow` com o ID da garantia
6. A plataforma armazena esse ID e chama `POST /v3/escrow/{guarantee_id}/finish` quando o cliente confirma o serviço
7. Isso libera os fundos imediatamente para o saldo disponível do prestador

### 6.2 Configuração do Escrow por Subaccount

```
POST /v3/accounts/{subaccount_id}/escrow
{
  "enabled": true,
  "isFeePayer": true,       // prestador paga a taxa de R$9,90/mês
  "daysToExpire": 30        // liberação automática em 30 dias se o release manual não ocorrer
}
```

**Custo:** R$99,90/mês (conta principal) + R$9,90/mês por subaccount com escrow ativo.

### 6.3 Fluxo Completo com Escrow

```
1. Pagamento confirmado → split de R$850,00 vai para subaccount do prestador
2. Subaccount tem escrow ativo → valor é automaticamente bloqueado
3. Asaas retorna campo escrow.id na cobrança do subaccount
4. Plataforma armazena: service_payments.asaas_escrow_guarantee_id = escrow.id
5. service_payments.escrow_status = 'blocked'
6. Prestador executa o serviço
7. Prestador marca services.status = 'completed'
8. Cliente confirma: services.status = 'confirmed'
9. Trigger: chama Edge Function release-escrow
10. Edge Function: POST /v3/escrow/{asaas_escrow_guarantee_id}/finish
    (usando a API key do SUBACCOUNT do prestador: asaas_account_api_key)
11. Fundos liberados imediatamente no saldo do prestador
12. service_payments.escrow_status = 'released'
13. service_payments.escrow_released_at = now()
```

> **Importante:** A chamada `POST /v3/escrow/{id}/finish` deve ser feita usando a **API key do subaccount** do prestador, não a da plataforma. É por isso que `provider_profiles_private.asaas_account_api_key` é obrigatório.

### 6.4 Recuperar o ID da Garantia de Escrow

Após o split ser recebido no subaccount, a plataforma deve consultar:

```
GET /v3/payments/{charge_id_no_subaccount}/escrow
Authorization: {api_key_do_subaccount}
```

Ou a resposta da cobrança no subaccount já inclui o campo `escrow.id`.

**O que armazenar:** `service_payments.asaas_escrow_guarantee_id = response.escrow.id`

### 6.5 Liberação do Escrow

**Manual (gatilho: cliente confirma serviço):**
```
POST /v3/escrow/{guarantee_id}/finish
Authorization: {api_key_do_subaccount_do_prestador}
```
Resposta: `200 OK` → fundos disponíveis imediatamente.
Atualizar: `service_payments.escrow_status = 'released'`, `escrow_released_at = now()`.

**Automática (backup após `daysToExpire`):**
Se o release manual não for chamado dentro de `daysToExpire` dias, o Asaas libera automaticamente.
O cron interno deve monitorar casos onde `escrow_status = 'blocked'` e `services.status = 'confirmed'` por mais de 24h — sinal de falha no release manual.

**Em caso de estorno:**
O estorno cancela o split. O escrow no subaccount é cancelado automaticamente junto com o estorno da cobrança original. Não chamar `/finish`.

### 6.6 Tabela `service_payment_releases`

```sql
CREATE TABLE public.service_payment_releases (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_payment_id      uuid NOT NULL REFERENCES public.service_payments(id),
  service_id              uuid NOT NULL REFERENCES public.services(id),
  provider_id             uuid NOT NULL REFERENCES public.profiles(id),

  -- Tipo de liberação
  release_type            text NOT NULL CHECK (release_type IN (
    'escrow_manual',      -- chamada manual após confirmação do cliente
    'escrow_auto',        -- expiração automática do daysToExpire
    'escrow_cancelled'    -- escrow cancelado por estorno
  )),

  -- Dados do Asaas
  asaas_escrow_guarantee_id text,
  released_amount         numeric(10,2) NOT NULL,

  -- Status
  status                  text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  attempted_at            timestamptz,
  completed_at            timestamptz,
  failure_reason          text,

  created_at              timestamptz NOT NULL DEFAULT now()
);
```

---

## 7. MAPEAMENTO DE ENTIDADES ASAAS

### 7.1 Clientes → Asaas Customers (Criação LAZY)

| Entidade Renovi | Entidade Asaas | Onde Armazenar |
|----------------|---------------|----------------|
| `profiles.id` (role=client) | Customer (`cus_xxx`) | `profiles.asaas_customer_id` |

**Endpoint:** `POST /v3/customers`

**Dados necessários:**
- `name`: `profiles.full_name`
- `cpfCnpj`: `client_profiles_private.cpf` ← **obrigatório; bloquear checkout se nulo**
- `email`: `auth.users.email`
- `phone`: `profiles.phone`

**Fluxo:**
```
1. Cliente inicia checkout
2. Backend verifica profiles.asaas_customer_id IS NULL
3. Se nulo: POST /v3/customers → retorna cus_xxx → salva em profiles
4. Se não nulo: usa customer existente
5. Prossegue com criação da cobrança
```

### 7.2 Prestadores → Asaas Subaccounts (Criação EAGER no onboarding)

| Entidade Renovi | Entidade Asaas | Onde Armazenar |
|----------------|---------------|----------------|
| `profiles.id` (role=provider) | Subaccount + WalletId | `provider_profiles_private` |

**Endpoint:** `POST /v3/accounts`

**Campos obrigatórios para subaccount:**
```json
{
  "name": "Nome do prestador",
  "email": "email@prestador.com",
  "cpfCnpj": "CPF ou CNPJ",
  "birthDate": "YYYY-MM-DD",
  "companyType": "MEI",
  "phone": "xx9xxxxxxxx",
  "mobilePhone": "xx9xxxxxxxx",
  "address": "Rua...",
  "addressNumber": "123",
  "complement": "",
  "province": "Bairro",
  "postalCode": "xxxxxxxx"
}
```

**⚠️ CRÍTICO:** A `apiKey` do subaccount é **retornada apenas uma vez** na criação. Deve ser armazenada imediatamente em `provider_profiles_private.asaas_account_api_key`. Não pode ser recuperada depois via API.

**Resposta:**
- `apiKey` → `asaas_account_api_key` ← armazenar criptografado
- `walletId` → `asaas_wallet_id` ← usado no split
- `id` → `asaas_subaccount_id`

**Após criar o subaccount:**
```
POST /v3/accounts/{id}/escrow
{ "enabled": true, "isFeePayer": true, "daysToExpire": 30 }
Authorization: {api_key_da_PLATAFORMA}  ← configuração de escrow é feita pela conta principal
```

**Bloqueio de checkout:** Se `asaas_onboarding_status != 'active'` ou `asaas_wallet_id IS NULL`, bloquear checkout mostrando: "Este prestador ainda não completou o cadastro financeiro."

### 7.3 Cobrança Asaas

```
POST /v3/payments
{
  "customer": "<asaas_customer_id>",
  "billingType": "PIX" | "CREDIT_CARD",
  "value": <client_charge_amount>,
  "dueDate": "<hoje + 1 dia>",
  "description": "Renovi - <service_title> - <provider_display_name>",
  "externalReference": "<service_payments.id>",   ← CRÍTICO: fallback de lookup no webhook
  "split": [
    { "walletId": "<provider_asaas_wallet_id>", "fixedValue": <provider_net_amount> }
  ]
}
```

---

## 8. MODELOS DE STATUS

### 8.1 `provider_proposals.status`

| Status | Significado | Quem Dispara |
|--------|-------------|-------------|
| `submitted` | Recebida, aguardando decisão do cliente | Prestador cria proposta |
| `payment_pending` | Cliente iniciou checkout; proposta travada | Cliente inicia checkout |
| `accepted` | Pagamento confirmado; serviço criado | Webhook `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` |
| `rejected` | Cliente rejeitou manualmente (com motivo) | Ação do cliente |
| `withdrawn` | Prestador retirou | Ação do prestador |
| `closed_due_to_other_selection` | Outra proposta foi paga no mesmo pedido | Efeito colateral pós-pagamento |
| `expired` | Janela de 48h expirou sem ação do cliente | pg_cron |

**Regras de transição:**
- `submitted → payment_pending`: somente se SR.status=`open`, proposta não expirada e prestador com wallet ativo
- `payment_pending → accepted`: somente via webhook (service_role)
- `payment_pending → submitted`: expiração do checkout ou falha de pagamento
- `payment_pending → withdrawn`: **BLOQUEADO por trigger** (não pode retirar com pagamento pendente)
- `submitted → expired`: pg_cron; **pula** propostas em `payment_pending`

### 8.2 `service_requests.status`

| Status | Quando |
|--------|--------|
| `open` | Recebendo propostas |
| `budget_selected_pending_payment` | Checkout iniciado |
| `in_progress` | Pagamento confirmado, serviço em andamento |
| `closed` | Serviço concluído e confirmado pelo cliente |
| `cancelled` | Cancelado |
| `disputed` | Chargeback ou disputa de pagamento |

### 8.3 `service_payments.status`

Sequência de sucesso: `created → pending → confirmed → received`
Falhas: `pending → failed`, `pending → expired`, `awaiting_risk_analysis → failed`
Pós-confirmação: `confirmed → refunded`, `confirmed → chargeback`

### 8.4 `services.status`

`awaiting_start → in_progress → completed → confirmed` (fluxo normal)
`* → cancelled`, `* → disputed` (exceções)

`confirmed` **dispara o release do escrow**.

---

## 9. FLUXO COMPLETO DO USUÁRIO

```
1.  Cliente em /orcamentos → aba "Recebidos"
2.  Cliente clica em um pedido de serviço para ver detalhes
3.  Tela mostra propostas dos prestadores
4.  Para cada proposta: exibir SOMENTE client_charge_amount (ex.: "R$1.050,00")
5.  Cliente clica "Quero contratar" em uma proposta
6.  ──── BACKEND: RPC initiate_checkout() ─────────────────────────────────
    Validações:
    a. proposal.status = 'submitted'
    b. service_request.status = 'open'
    c. proposal.checkout_locked_until IS NULL OR <= now()
    d. proposal.created_at + 48h > now() (não expirou)
    e. pricing_signature confere (recomputar HMAC dos 7 campos)
    f. provider_profiles_private.asaas_wallet_id IS NOT NULL
    g. provider_profiles_private.asaas_onboarding_status = 'active'
    h. client_profiles_private.cpf IS NOT NULL (necessário para customer Asaas)

    Transação:
    - SET proposal.status = 'payment_pending'
    - SET proposal.checkout_locked_until = now() + 30min
    - SET service_request.status = 'budget_selected_pending_payment'
    - INSERT service_payments (snapshot financeiro congelado, checkout_expires_at definido)
    - SET proposal.locked_payment_id = service_payments.id
    - RETURN service_payments.id

7.  Frontend redireciona para /orcamentos/checkout/{service_payment_id}
8.  ──── TELA "Revisar e Pagar" ────────────────────────────────────────────
    Dados exibidos:
    - Resumo do pedido (serviço, título, bairro/cidade)
    - Sobre o prestador (foto, nome, bio)
    - Detalhes da proposta (descrição, duração, fotos, slots sugeridos)
    - Garantia escrow: "Seu pagamento fica protegido. O prestador recebe
      apenas após a conclusão confirmada por você."
    - Total: "R$1.050,00" ← SOMENTE ESTE VALOR
    - Seletor de método: PIX (recomendado) | Cartão de crédito
    - Countdown: "Esta proposta está reservada por 28 min."

9.  Cliente seleciona PIX → clica "Pagar com PIX"
10. ──── BACKEND: Edge Function create-asaas-charge ───────────────────────
    a. Criar/obter Asaas customer para o cliente
    b. POST /v3/payments (billingType=PIX, value=client_charge_amount, split=[...])
    c. GET /v3/payments/{id}/pixQrCode → encodedImage, payload, expirationDate
    d. UPDATE service_payments: asaas_payment_id, status='pending', dados do QR
    e. Estender checkout_locked_until = asaas_pix_expiration_date (o QR dura 12 meses)
    f. Return: { qrCodeImage, qrCodePayload, expirationDate }

11. Frontend exibe QR code + código copy-paste + data de vencimento
    Frontend subscreve Supabase Realtime em service_payments.id

12. Cliente paga via app bancário

13. Asaas envia webhook: PAYMENT_RECEIVED
14. ──── WEBHOOK HANDLER ────────────────────────────────────────────────────
    Transação única:
    a. Idempotência: INSERT service_payment_events(asaas_event_id)
       ON CONFLICT → is_duplicate=true → return 200 sem processar
    b. UPDATE service_payments: status='confirmed', payment_confirmed_at=now()
    c. UPDATE provider_proposals: status='accepted'
    d. UPDATE service_requests: status='in_progress'
    e. INSERT services (status='awaiting_start') ON CONFLICT(proposal_id) DO NOTHING
    f. UPDATE service_payments: service_id = novo service id
    g. Buscar escrow guarantee ID:
       GET /v3/payments/{charge_id_subaccount}/escrow → armazenar asaas_escrow_guarantee_id
       SET escrow_status = 'blocked'
    h. UPDATE outras propostas do mesmo pedido → 'closed_due_to_other_selection'
    i. COMMIT
    j. Return 200 ao Asaas

15. Frontend recebe atualização via Realtime
16. Redireciona para /servicos/{service_id}
```

---

## 10. TELA DE CHECKOUT — "Revisar e Pagar"

### 10.1 Rota
`/orcamentos/checkout/{service_payment_id}`

### 10.2 RPC `get_checkout_details(p_payment_id)`
- Valida: `service_payments.client_id = auth.uid()`
- Valida: `status IN ('created', 'pending')`
- Valida: `checkout_expires_at > now()`
- Retorna (projeção segura — sem breakdown de taxas):
  - `service_request`: title, description, service_title, icon_key
  - `provider`: display_name, slug, profile_image_path, bio
  - `proposal`: proposal_description, photos, duration_value, duration_unit, proposed_slots
  - `payment`: **client_charge_amount** (somente este campo financeiro)
  - `checkout_expires_at`

### 10.3 Seções da Tela

**1. Resumo do pedido:** ícone + tipo de serviço, título do pedido, bairro/cidade

**2. Sobre o prestador:** foto assinada (signed URL), nome, bio, link "Ver perfil completo"

**3. Detalhes do orçamento:** descrição completa, duração estimada, fotos (carrossel), slots sugeridos

**4. Garantia e pagamento:**
> "Seu pagamento fica protegido. O prestador só recebe o valor após a conclusão do serviço confirmada por você."

**5. Valor e método:**
- Destaque: `Total: R$ 1.050,00`
- Cards de seleção: PIX (badge "Aprovação imediata") | Cartão de crédito
- Aviso: "Esta proposta está reservada por 28 min."

**6. CTA:** "Pagar com PIX" / "Pagar com Cartão" + estado de carregamento

### 10.4 Mobile vs Desktop

**Mobile:**
- Coluna única com scroll
- Barra inferior sticky com preço + CTA
- Pix: tela dedicada com QR + botão "Copiar código Pix" em destaque
- Carrossel de fotos em largura total

**Desktop:**
- Duas colunas: esquerda (detalhes) + direita (painel de pagamento sticky)
- QR Pix inline no painel direito
- Modal de confirmação ao tentar navegar para fora do checkout

### 10.5 Estados da Tela

| Estado | O que o cliente vê |
|--------|-------------------|
| Checkout ativo | Formulário normal |
| Checkout expirado | "Este orçamento expirou. Volte aos orçamentos para tentar novamente." + CTA |
| PIX pendente | QR code + countdown + "Aguardando pagamento via Pix..." |
| PIX confirmado | "Pagamento confirmado! Redirecionando..." |
| Cartão processando | Spinner "Processando pagamento..." |
| Cartão em análise de risco | "Seu pagamento está em análise. Você será notificado em breve." |
| Cartão recusado | "Pagamento recusado: [motivo]. Tente outro cartão ou use Pix." |

---

## 11. FLUXO PIX

### 11.1 Criação da Cobrança

```
POST /v3/payments
{ billingType: "PIX", customer, value, dueDate, externalReference, split }

→ Retorna: payment.id (asaas_payment_id)

GET /v3/payments/{id}/pixQrCode
→ Retorna: encodedImage (Base64), payload (copy-paste), expirationDate
```

**Sobre a expiração:**
O QR code Pix dinâmico é válido por **12 meses a partir do `dueDate`**, não expira em horas. O `dueDate` marca quando a cobrança vence (fica overdue), mas o QR continua válido por 12 meses. O lock do checkout deve ser estendido para `asaas_pix_expiration_date` após criar a cobrança.

**Registro em sandbox:** É necessário registrar uma chave Pix no sandbox antes de criar cobranças Pix. Sem chave cadastrada → erro 404.

### 11.2 Estado de Espera

Frontend: subscrição Supabase Realtime em `service_payments WHERE id = current_payment_id`.
Fallback: polling a cada 5s em `GET /checkout-status/{id}` (Edge Function RLS-safe).

### 11.3 Webhook: `PAYMENT_RECEIVED` (Pix)

Para Pix, `PAYMENT_RECEIVED` é o evento de sucesso terminal. Disparar o fluxo completo de sucesso.

### 11.4 PIX Nunca Pago (Overdue)

```
Webhook PAYMENT_OVERDUE (quando dueDate passa) ou cron interno:
→ service_payments.status = 'expired'
→ proposal.status = IF (created_at + 48h > now()) THEN 'submitted' ELSE 'expired'
→ proposal.checkout_locked_until = NULL
→ proposal.locked_payment_id = NULL
→ service_requests.status = 'open'
→ INSERT service_payment_events
```

O cliente volta para a tela de orçamentos. A proposta fica disponível para nova tentativa de checkout (se ainda dentro de 48h).

---

## 12. FLUXO CARTÃO DE CRÉDITO

### 12.1 Tokenização (PCI-DSS)

**A plataforma NUNCA deve tocar em dados brutos de cartão.**

Usar tokenização do Asaas:
1. Frontend coleta dados do cartão via `Asaas.js` ou form nativo
2. Frontend tokeniza via `POST /v3/credit-card/tokenize`
3. Backend recebe apenas o token, sem PAN
4. Backend cria cobrança com token

```
POST /v3/payments
{
  billingType: "CREDIT_CARD",
  customer, value, dueDate, externalReference, split,
  creditCard: { /* tokenizado */ },
  creditCardHolderInfo: { name, email, cpfCnpj, postalCode, phone }
}
```

### 12.2 Cenários de Resposta Imediata

| Resultado | Ação |
|-----------|------|
| `status: CONFIRMED` | Fluxo completo de sucesso |
| `status: AWAITING_RISK_ANALYSIS` | `service_payments.status = 'awaiting_risk_analysis'`; mostrar "Em análise" |
| Resposta 4xx / decline | `service_payments.status = 'failed'`; reverter proposta + SR; mostrar erro |

### 12.3 Webhooks de Cartão

| Webhook | Ação Renovi |
|---------|-------------|
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | Fluxo completo de sucesso |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | Marcar failed; reverter proposta e SR |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | Marcar failed; reverter; alertar admin |
| `PAYMENT_AUTHORIZED` | Log apenas; aguardar CONFIRMED |

---

## 13. TRATAMENTO COMPLETO DE EVENTOS ASAAS

### 13.1 Tabela Completa de Eventos

| Evento Asaas | Significado | Ação Renovi |
|-------------|-------------|-------------|
| `PAYMENT_CREATED` | Cobrança criada no Asaas | Confirmar `asaas_payment_id`; status permanece 'pending' |
| `PAYMENT_UPDATED` | Due date ou valor alterado | Log; verificar integridade |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | Cartão em análise manual | `service_payments → awaiting_risk_analysis` |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | Análise aprovada | Fluxo completo de sucesso |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | Análise reprovada | Marcar failed; reverter entidades |
| `PAYMENT_AUTHORIZED` | Cartão pré-autorizado | Log; aguardar CONFIRMED |
| `PAYMENT_CONFIRMED` | Pagamento confirmado (cartão capturado) | **Fluxo completo de sucesso** |
| `PAYMENT_RECEIVED` | Fundos recebidos e disponíveis | **Fluxo completo de sucesso** para Pix; atualizar `received_at` para cartão |
| `PAYMENT_OVERDUE` | Due date passou sem pagamento | Marcar expired; desbloquear proposta; reabrir SR |
| `PAYMENT_DELETED` | Cobrança removida | Marcar cancelled; desbloquear entidades se pending |
| `PAYMENT_RESTORED` | Cobrança deletada restaurada | Log; revisão do admin |
| `PAYMENT_REFUNDED` | Estorno total | `→ refunded`; cancelar serviço; cancelar SR; escrow → cancelled |
| `PAYMENT_PARTIALLY_REFUNDED` | Estorno parcial | Atualizar `refunded_amount`; alertar admin |
| `PAYMENT_REFUND_IN_PROGRESS` | Estorno agendado/liquidando | Log; aguardar REFUNDED |
| `PAYMENT_REFUND_DENIED` | Estorno negado (boleto only) | Log; alertar admin |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | Captura recusada | Marcar failed; reverter |
| `PAYMENT_CHARGEBACK_REQUESTED` | Chargeback iniciado | `→ chargeback`; SR `→ disputed`; services `→ disputed`; NÃO liberar escrow; alertar admin |
| `PAYMENT_CHARGEBACK_DISPUTE` | Disputa em andamento | Log; ação do admin |
| `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` | Disputa ganha; aguardando reversal | Log; admin |
| `PAYMENT_DUNNING_REQUESTED` | Negativação iniciada | Log |
| `PAYMENT_DUNNING_RECEIVED` | Negativação recebida | Log |
| `PAYMENT_SPLIT_CANCELLED` | Split cancelado | Alertar admin; verificar integridade |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK` | Valor bloqueado por divergência de split | Alertar admin imediatamente |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED` | Divergência resolvida | Log |
| `PAYMENT_ANTICIPATED` | Cobrança antecipada | Log |
| `PAYMENT_BANK_SLIP_CANCELLED` | Boleto vencido | N/A (não usamos boleto) |
| `PAYMENT_CHECKOUT_VIEWED` | Cliente visualizou checkout | Log de analytics |
| `PAYMENT_RECEIVED_IN_CASH_UNDONE` | Reversão de recebimento em dinheiro | Log; alertar admin |

### 13.2 Fluxo Completo de Sucesso (chamado por PAYMENT_CONFIRMED e PAYMENT_RECEIVED)

```sql
-- Tudo dentro de UMA transação
BEGIN;

-- 1. Idempotência via unique constraint
INSERT INTO service_payment_events (asaas_event_id, event_type, service_payment_id, ...)
ON CONFLICT (asaas_event_id) DO UPDATE SET is_duplicate = true
RETURNING is_duplicate;
-- Se is_duplicate = true → ROLLBACK; return 200

-- 2. Idempotência: serviço já criado?
SELECT id FROM services WHERE proposal_id = $proposal_id;
-- Se já existe → log; ROLLBACK; return 200

-- 3. Update service_payments
UPDATE service_payments SET
  status = 'confirmed', payment_confirmed_at = now(),
  asaas_paid_at = $paid_at, asaas_net_value = $net_value, asaas_last_status = 'CONFIRMED'
WHERE id = $payment_id;

-- 4. Update proposal
UPDATE provider_proposals SET status = 'accepted' WHERE id = $proposal_id;

-- 5. Update service_request
UPDATE service_requests SET status = 'in_progress' WHERE id = $service_request_id;

-- 6. Criar service
INSERT INTO services (service_request_id, proposal_id, provider_id, client_id, ...)
ON CONFLICT (proposal_id) DO NOTHING
RETURNING id INTO $service_id;

-- 7. Vincular service ao payment
UPDATE service_payments SET service_id = $service_id WHERE id = $payment_id;

-- 8. Buscar guarantee ID do escrow (chamada externa ao Asaas, fora desta transação)
-- Feito como passo assíncrono após commit:
-- GET /v3/payments/{asaas_charge_id_subaccount}/escrow
-- UPDATE service_payments SET asaas_escrow_guarantee_id = ..., escrow_status = 'blocked'

-- 9. Fechar outras propostas do mesmo pedido
UPDATE provider_proposals
SET status = 'closed_due_to_other_selection'
WHERE service_request_id = $service_request_id
  AND id <> $proposal_id
  AND status IN ('submitted', 'payment_pending');

COMMIT;
```

> **Nota sobre busca do escrow guarantee ID:** A cobrança criada pela plataforma é na conta principal. O split vai para o subaccount do prestador. Para obter o `escrow.id`, a plataforma usa a API key do subaccount para consultar a cobrança recebida nele. Isso pode ser feito como chamada async após o commit principal.

---

## 14. ESTRATÉGIA DE CONCORRÊNCIA E LOCK DE CHECKOUT

### 14.1 Mecanismo de Lock

Lock atômico via `UPDATE ... WHERE ... RETURNING`:

```sql
UPDATE provider_proposals
SET
  status = 'payment_pending',
  checkout_locked_until = now() + interval '30 minutes',
  locked_payment_id = $new_payment_id
WHERE id = $proposal_id
  AND status = 'submitted'
  AND (checkout_locked_until IS NULL OR checkout_locked_until <= now())
  AND created_at + interval '48 hours' > now()
RETURNING id;
-- 0 linhas retornadas = lock falhou (tentativa concorrente)
```

Se 0 linhas: verificar se o `locked_payment_id` existente pertence ao mesmo cliente → retornar esse ID existente. Assim múltiplas abas do mesmo cliente convergem para o mesmo checkout.

### 14.2 Extensão do Lock Após Criar Pix

Quando a cobrança Pix é criada com sucesso:
```sql
UPDATE provider_proposals
SET checkout_locked_until = $asaas_pix_expiration_date  -- 12 meses a partir do due date
WHERE id = $proposal_id;
```

Isso garante que o lock não expire enquanto o QR Pix ainda é válido.

### 14.3 Proteção Contra Retirada Durante Checkout

```sql
CREATE OR REPLACE FUNCTION prevent_withdrawal_during_checkout()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'payment_pending' AND NEW.status = 'withdrawn' THEN
    RAISE EXCEPTION 'Não é possível retirar uma proposta com pagamento pendente';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_proposals_prevent_withdrawal_during_checkout
  BEFORE UPDATE OF status ON public.provider_proposals
  FOR each row EXECUTE FUNCTION prevent_withdrawal_during_checkout();
```

### 14.4 O que Permanece Disponível Durante o Lock

- Outras propostas do **mesmo pedido**: permanecem `submitted` e visíveis
- O cliente **não pode** iniciar checkout de outra proposta enquanto uma está locked (validado no `initiate_checkout`)
- O prestador vê sua proposta como `payment_pending`
- A cron job de expiração de 48h **ignora** propostas em `payment_pending`

---

## 15. EXPIRAÇÃO DO CHECKOUT E RECUPERAÇÃO

### 15.1 Cron: `expire_stale_checkouts()` — a cada 5 minutos

```sql
CREATE OR REPLACE FUNCTION public.expire_stale_checkouts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated integer := 0;
  r record;
BEGIN
  -- 1. Marcar payments expirados
  UPDATE service_payments SET status = 'expired'
  WHERE status IN ('created', 'pending')
    AND checkout_expires_at < now();

  -- 2. Para cada payment recém-expirado, reverter proposta e SR
  FOR r IN
    SELECT sp.id, sp.proposal_id, sp.service_request_id
    FROM service_payments sp
    WHERE sp.status = 'expired'
      AND sp.updated_at >= now() - interval '6 minutes'  -- só os recém-expirados
  LOOP
    -- Reverter proposta
    UPDATE provider_proposals
    SET
      status = CASE
        WHEN created_at + interval '48 hours' > now() THEN 'submitted'
        ELSE 'expired'
      END,
      checkout_locked_until = NULL,
      locked_payment_id = NULL
    WHERE id = r.proposal_id AND status = 'payment_pending';

    -- Reabrir pedido
    UPDATE service_requests
    SET status = 'open'
    WHERE id = r.service_request_id AND status = 'budget_selected_pending_payment';

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;
```

### 15.2 Fontes de Expiração por Cenário

| Cenário | Driver Principal | Backup |
|---------|----------------|--------|
| Checkout abandonado antes de criar cobrança Asaas | Cron interno | — |
| Pix vencido (dueDate passou) | Webhook `PAYMENT_OVERDUE` | Cron interno |
| Análise de risco pendente longa (dias) | Ação do admin | — |
| Cartão recusado sincronamente | Resposta síncrona | — |

---

## 16. INTEGRIDADE DE PRECIFICAÇÃO E PRICING SIGNATURE

### 16.1 Nova Função de Assinatura (7 Campos)

```sql
CREATE OR REPLACE FUNCTION public.generate_provider_pricing_signature_v2(
  p_proposed_amount numeric,
  p_provider_fee_rate numeric,
  p_provider_fee_amount numeric,
  p_provider_net_amount numeric,
  p_client_fee_rate numeric,
  p_client_fee_amount numeric,
  p_client_charge_amount numeric
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret jsonb;
BEGIN
  SELECT value INTO v_secret FROM public.platform_constants WHERE key = 'pricing_signature_secret';
  RETURN encode(
    extensions.hmac(
      concat_ws('|',
        round(p_proposed_amount::numeric, 2)::text,
        round(p_provider_fee_rate::numeric, 4)::text,
        round(p_provider_fee_amount::numeric, 2)::text,
        round(p_provider_net_amount::numeric, 2)::text,
        round(p_client_fee_rate::numeric, 4)::text,
        round(p_client_fee_amount::numeric, 2)::text,
        round(p_client_charge_amount::numeric, 2)::text
      )::text,
      trim(both '"' from v_secret::text)::text,
      'sha256'::text
    ),
    'hex'
  );
END;
$$;
```

### 16.2 Validação no Checkout

```sql
-- Dentro de initiate_checkout():
SELECT generate_provider_pricing_signature_v2(
  pp.proposed_amount, pp.tax_rate, pp.tax_amount, pp.final_amount,
  pp.client_fee_rate, pp.client_fee_amount, pp.client_charge_amount
) AS expected_sig
FROM provider_proposals pp WHERE pp.id = $proposal_id;

IF expected_sig <> pp.pricing_signature THEN
  RAISE EXCEPTION 'Falha na verificação de integridade da precificação';
END IF;
```

### 16.3 Snapshot no Pagamento

```sql
-- No INSERT de service_payments:
proposal_pricing_signature = proposal.pricing_signature  -- congelado para sempre
```

A cadeia de integridade:
```
proposal.pricing_signature (HMAC de 7 campos)
    ↓ copiado em
service_payments.proposal_pricing_signature (imutável)
    ↓ determina
service_payments.client_charge_amount → valor cobrado do Asaas
service_payments.split_fixed_value   → valor do split para prestador
```

---

## 17. ARQUITETURA DE WEBHOOKS

### 17.1 Endpoint

```
POST /functions/v1/asaas-webhook
```

Implementado como Supabase Edge Function.

### 17.2 Autenticação

Asaas envia header `asaas-access-token` com o token configurado:
```typescript
const token = req.headers.get('asaas-access-token');
if (token !== Deno.env.get('ASAAS_WEBHOOK_SECRET')) {
  return new Response('Unauthorized', { status: 403 });
}
```

**Regra crítica:** Retornar **sempre 200** ao Asaas (exceto auth fail). Erros de processamento devem ser logados internamente — nunca retornar 5xx ao Asaas (provoca backoff da fila).

### 17.3 Estrutura do Handler

```typescript
export default async function handler(req: Request) {
  // 1. Validar token
  // 2. Parsear payload: { event, payment }
  // 3. Logar payload bruto ANTES de qualquer processamento
  // 4. Lookup: service_payments por asaas_payment_id
  //    Fallback: por payment.externalReference (= service_payments.id)
  //    Se não encontrado: log + return 200 (cobrança desconhecida)
  // 5. Roteamento por event type
  // 6. Return 200 SEMPRE após auth check
}
```

### 17.4 Configuração do Webhook no Asaas

```json
POST /v3/webhooks
{
  "name": "Renovi Payments",
  "url": "https://{project}.supabase.co/functions/v1/asaas-webhook",
  "email": "pagamentos@renovi.com.br",
  "enabled": true,
  "interrupted": false,
  "authToken": "<ASAAS_WEBHOOK_SECRET>",
  "sendType": "SEQUENTIALLY",
  "events": [
    "PAYMENT_CREATED", "PAYMENT_AWAITING_RISK_ANALYSIS",
    "PAYMENT_APPROVED_BY_RISK_ANALYSIS", "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
    "PAYMENT_AUTHORIZED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_RESTORED",
    "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    "PAYMENT_SPLIT_CANCELLED", "PAYMENT_SPLIT_DIVERGENCE_BLOCK",
    "PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED"
  ]
}
```

### 17.5 Gestão da Fila

- Asaas pausa a fila após **15 tentativas consecutivas sem retorno 2xx**
- Retenção de eventos: **14 dias**
- Reativar: `PUT /v3/webhooks/{id}` com `"interrupted": false`
- Monitorar: alertar se a fila pausar (verificar via `GET /v3/webhooks/{id}`)
- IPs oficiais Asaas: consultar `https://docs.asaas.com/docs/ips-oficiais-do-asaas` para configurar allowlist

---

## 18. IDEMPOTÊNCIA

| O Quê | Guarda | Como |
|-------|--------|------|
| Criar `services` | `UNIQUE(proposal_id)` | `INSERT ... ON CONFLICT DO NOTHING` |
| Processar evento Asaas | `UNIQUE(asaas_event_id)` em `service_payment_events` | Verificar antes de processar |
| Fechar outras propostas | `WHERE status IN ('submitted', 'payment_pending')` | Cláusula WHERE |
| Criar customer Asaas | Checar `asaas_customer_id IS NULL` antes da API call | Check atômico + update |
| Lock de checkout | `UPDATE ... WHERE ... RETURNING` | Atômico no Postgres |
| Release do escrow | Verificar `escrow_status = 'blocked'` antes de chamar `/finish` | Check + idempotent API |

---

## 19. RLS E CONTROLE DE ACESSO

### 19.1 Matriz de Acesso

| Tabela | Cliente | Prestador | Admin | service_role |
|--------|---------|-----------|-------|-------------|
| `service_payments` | Lê próprios (projeção sem breakdown) | Lê os seus | Todos | Tudo |
| `services` | Lê próprios | Lê os seus; atualiza status | Todos | Tudo |
| `service_payment_events` | Sem acesso | Sem acesso | Lê todos | Tudo |
| `service_payment_releases` | Sem acesso | Lê os seus | Todos | Tudo |

### 19.2 Regra de Projeção para Clientes

Em todas as RPCs e queries voltadas ao cliente, projetar **apenas**:
- `client_charge_amount` ✓
- `billing_type` ✓
- `status` ✓
- `checkout_expires_at` ✓
- `asaas_pix_qr_code`, `asaas_pix_qr_code_image` ✓

**NUNCA retornar** ao cliente: `provider_fee_rate`, `provider_fee_amount`, `provider_net_amount`, `platform_total_fee_amount`, `client_fee_rate`, `client_fee_amount`.

### 19.3 Segurança do Webhook

```typescript
// Usar supabaseAdmin (service_role) dentro do handler
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

`asaas_account_api_key` dos prestadores **nunca** deve ser exposta via RLS. Deve ser lida apenas por Edge Functions com service_role.

---

## 20. SANDBOX ASAAS — GUIA COMPLETO

### 20.1 Ambientes

| Ambiente | URL da API | Dashboard |
|----------|-----------|-----------|
| Sandbox | `https://api-sandbox.asaas.com` | `https://sandbox.asaas.com` |
| Produção | `https://api.asaas.com` | `https://app.asaas.com` |

### 20.2 Configuração Inicial da Conta Sandbox

**Passo 1:** Criar conta em `https://sandbox.asaas.com`

**Passo 2:** Aprovação automática — contas sandbox são aprovadas automaticamente. Basta completar o fluxo de aprovação enviando qualquer imagem como documento.

**Passo 3:** Gerar API key em `Configurações → Integrações → Chave da API`

**Passo 4 (crítico para Pix):** Registrar uma chave Pix na conta sandbox:
- `Minhas Finanças → Pix → Minhas Chaves → Nova Chave`
- Sem chave Pix cadastrada → cobranças Pix retornam erro 404

**Passo 5:** Configurar webhook:
```
POST https://api-sandbox.asaas.com/v3/webhooks
Authorization: {sandbox_api_key}
{ "url": "https://{seu-ngrok}.ngrok.io/functions/v1/asaas-webhook", ... }
```

**Para desenvolvimento local com webhooks:** Usar [ngrok](https://ngrok.com/):
```bash
ngrok http 54321
# Use o URL gerado como webhook URL no Asaas sandbox
```

### 20.3 Variáveis de Ambiente para Sandbox

```env
# supabase/functions/.env (para desenvolvimento local)
ASAAS_API_KEY=your_sandbox_key
ASAAS_API_BASE_URL=https://api-sandbox.asaas.com
ASAAS_WEBHOOK_SECRET=your_webhook_token_here
ASAAS_ENVIRONMENT=sandbox
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 20.4 Testando Pagamento Pix (Sandbox)

**1. Criar cobrança Pix:**
```bash
curl -X POST https://api-sandbox.asaas.com/v3/payments \
  -H "Authorization: your_sandbox_key" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "cus_xxx",
    "billingType": "PIX",
    "value": 100.00,
    "dueDate": "2026-03-26",
    "externalReference": "uuid-do-service-payment"
  }'
```

**2. Obter QR Code:**
```bash
GET https://api-sandbox.asaas.com/v3/payments/{id}/pixQrCode
```

**3. Simular pagamento Pix (sandbox-only):**
```bash
curl -X POST https://api-sandbox.asaas.com/v3/payments/{id}/receiveInCash \
  -H "Authorization: your_sandbox_key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Isso simula o recebimento do Pix e aciona o webhook `PAYMENT_RECEIVED`.

### 20.5 Testando Pagamento Cartão de Crédito (Sandbox)

**Cartão de sucesso:**
```
Número: 4444 4444 4444 4444
Validade: qualquer data futura
CVV: 123 (ou qualquer 3 dígitos)
```

**Cartões de falha:**
```
Mastercard (decline): 5184 0197 4037 3151
Visa (decline):        4916 5613 5824 0741
```

**Criar cobrança com cartão:**
```bash
curl -X POST https://api-sandbox.asaas.com/v3/payments \
  -H "Authorization: your_sandbox_key" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "cus_xxx",
    "billingType": "CREDIT_CARD",
    "value": 100.00,
    "dueDate": "2026-03-26",
    "creditCard": {
      "holderName": "John Doe",
      "number": "4444444444444444",
      "expiryMonth": "12",
      "expiryYear": "2030",
      "ccv": "123"
    },
    "creditCardHolderInfo": {
      "name": "John Doe",
      "email": "test@test.com",
      "cpfCnpj": "00000000000",
      "postalCode": "00000000",
      "phone": "11999999999"
    }
  }'
```

### 20.6 Testando Criação de Subaccount (Sandbox)

```bash
curl -X POST https://api-sandbox.asaas.com/v3/accounts \
  -H "Authorization: your_sandbox_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prestador Teste",
    "email": "prestador@test.com",
    "cpfCnpj": "00000000000",
    "birthDate": "1990-01-01",
    "companyType": "MEI",
    "phone": "11999999999",
    "mobilePhone": "11999999999",
    "address": "Rua Teste",
    "addressNumber": "100",
    "complement": "",
    "province": "Centro",
    "postalCode": "01310100"
  }'
# ARMAZENAR IMEDIATAMENTE: response.apiKey e response.walletId
```

**Limite sandbox:** máximo 20 subcontas por dia.

### 20.7 Habilitando Escrow em Subaccount (Sandbox)

```bash
curl -X POST https://api-sandbox.asaas.com/v3/accounts/{subaccount_id}/escrow \
  -H "Authorization: your_sandbox_key" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "isFeePayer": true,
    "daysToExpire": 30
  }'
```

### 20.8 Testando Release do Escrow (Sandbox)

```bash
# 1. Após receber pagamento, buscar o guarantee ID:
curl https://api-sandbox.asaas.com/v3/payments/{charge_id}/escrow \
  -H "Authorization: {subaccount_api_key}"
# → response.id = guarantee ID

# 2. Liberar o escrow:
curl -X POST https://api-sandbox.asaas.com/v3/escrow/{guarantee_id}/finish \
  -H "Authorization: {subaccount_api_key}"
```

### 20.9 Forçar Expiração (Sandbox)

```bash
# Simular vencimento de uma cobrança
POST https://api-sandbox.asaas.com/v3/payments/{id}/overdue
```

### 20.10 Atenção com Notificações no Sandbox

O sandbox envia emails e SMS reais. **Não criar clientes com dados reais de terceiros**. Use seus próprios dados de contato para testes de notificação.

---

## 21. MATRIZ DE REAÇÃO DA UI

| Cenário | Tela Checkout | Proposta (Orçamentos) | Pedido de Serviço |
|---------|--------------|----------------------|-------------------|
| Checkout iniciado | "Revisar e Pagar" | "Pagamento pendente" | "Aguardando pagamento" |
| QR Pix exibido | QR + countdown | "Aguardando Pix" | "Aguardando pagamento" |
| Pix confirmado | "Pago! Redirecionando..." | "Aceito" | Vai para "Serviços" |
| Pix vencido | "PIX vencido. Tente novamente." | Volta a "Aguardando avaliação" | Volta a "Aberto" |
| Cartão processando | Spinner | "Pagamento pendente" | "Aguardando pagamento" |
| Cartão em análise | "Em análise de risco" | "Análise de pagamento" | "Aguardando pagamento" |
| Cartão aprovado | Redireciona → sucesso | "Aceito" | Vai para "Serviços" |
| Cartão recusado | "[Motivo]. Tente Pix." | Volta a "Aguardando avaliação" | Volta a "Aberto" |
| Estorno total | — | "Aceito" (histórico) | "Cancelado" |
| Chargeback | — | "Aceito" | "Disputado" |
| Outras propostas | — | "Não selecionado" | — |

---

## 22. MATRIZ DE TRANSIÇÃO DE ESTADOS

| Evento | Entidade | Estado Anterior | Próximo Estado | Efeitos Colaterais |
|--------|---------|----------------|---------------|-------------------|
| Cliente inicia checkout | provider_proposals | submitted | payment_pending | Lock + checkout_expires_at |
| Cliente inicia checkout | service_requests | open | budget_selected_pending_payment | — |
| Cliente inicia checkout | service_payments | — | created (INSERT) | Snapshot financeiro congelado |
| Cobrança Asaas criada | service_payments | created | pending | asaas_payment_id armazenado |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | service_payments | pending | awaiting_risk_analysis | — |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | service_payments | awaiting_risk_analysis | confirmed | Fluxo completo de sucesso |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | service_payments | awaiting_risk_analysis | failed | Reverter proposta + SR |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | provider_proposals | payment_pending | submitted | Limpar lock |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | service_requests | budget_selected_pending_payment | open | — |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | service_payments | pending/awaiting | confirmed | Fluxo completo de sucesso |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | provider_proposals | payment_pending | accepted | — |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | service_requests | budget_selected_pending_payment | in_progress | — |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | services | — | awaiting_start (INSERT) | — |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | service_payments | — | escrow_status = 'blocked' | Buscar guarantee ID |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | outras propostas | submitted | closed_due_to_other_selection | — |
| `PAYMENT_RECEIVED` (cartão pós-confirmação) | service_payments | confirmed | received | Atualizar received_at |
| `PAYMENT_OVERDUE` | service_payments | pending | expired | Reverter proposta + SR |
| `PAYMENT_OVERDUE` | provider_proposals | payment_pending | submitted/expired | Limpar lock |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | service_payments | pending | failed | Reverter |
| `PAYMENT_REFUNDED` | service_payments | confirmed/received | refunded | Cancelar service + SR; escrow → cancelled |
| `PAYMENT_CHARGEBACK_REQUESTED` | service_payments | confirmed/received | chargeback | Alertar admin; NÃO liberar escrow |
| `PAYMENT_CHARGEBACK_REQUESTED` | service_requests | in_progress | disputed | — |
| `PAYMENT_CHARGEBACK_REQUESTED` | services | any | disputed | — |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK` | service_payments | any | (alerta admin) | Admin action urgente |
| Cliente confirma serviço | services | completed | confirmed | Trigger escrow release |
| Escrow release | service_payments | — | escrow_status = 'released' | Fundos liberados ao prestador |
| Cron expiração | service_payments | created/pending | expired | Reverter proposta + SR |
| Cliente rejeita proposta | provider_proposals | submitted | rejected | — |
| Prestador retira | provider_proposals | submitted | withdrawn | Bloqueado se payment_pending |
| Cron 48h | provider_proposals | submitted | expired | Pula payment_pending |

---

## 23. CENÁRIOS DE FALHA E EXCEÇÃO

### 23.1 Cliente Abandona Checkout (Nunca Paga)
- Driver: cron + `PAYMENT_OVERDUE`
- Proposta volta a `submitted` (se 48h ainda válido)
- SR volta a `open`

### 23.2 Múltiplas Abas / Double Checkout
- Lock atômico: só uma thread consegue o lock
- Múltiplas abas do mesmo cliente: retornam o mesmo `service_payment_id`

### 23.3 Prestador Retira Durante Checkout
- Bloqueado por trigger: não pode retirar se `payment_pending`

### 23.4 Cartão em Análise de Risco — Cliente Fecha App
- Estado preservado: proposta `payment_pending`, SR `budget_selected_pending_payment`
- Cliente pode reabrir a tela de checkout (payment_id ainda válido)
- Webhook dispara quando análise conclui

### 23.5 Webhook Chega Duas Vezes
- `UNIQUE(asaas_event_id)`: segundo evento marcado como `is_duplicate = true`
- Zero processamento duplicado

### 23.6 Evento Fora de Ordem (ex.: PAYMENT_RECEIVED antes de PAYMENT_CONFIRMED)
- Máquina de estados: se já `confirmed`, skip de PAYMENT_CONFIRMED subsequente
- Transições regressivas bloqueadas

### 23.7 Pix Tardio Após Expiração Interna
- Se `PAYMENT_RECEIVED` chega após marcarmos como `expired`: processar assim mesmo (o pagamento foi feito)
- Reverter a expiração: proposta volta a `accepted`, criar service, alertar admin
- Caso raro mas deve ser tratado

### 23.8 Estorno Após Criação do Serviço
- `PAYMENT_REFUNDED`: service → `cancelled`, SR → `cancelled`
- Escrow no subaccount: cancelado automaticamente com o estorno
- Alertar admin para review manual

### 23.9 Chargeback com Serviço em Andamento
- `PAYMENT_CHARGEBACK_REQUESTED`: SR → `disputed`, services → `disputed`
- **NÃO** chamar `/finish` no escrow — manter fundos retidos
- Admin medeia disputa
- Se chargeback revertido: liberar escrow manualmente

### 23.10 Divergência de Split (`PAYMENT_SPLIT_DIVERGENCE_BLOCK`)
- Ocorre quando o `fixedValue` do split é maior que o `netValue` da cobrança
- Asaas bloqueia o valor por 2 dias úteis para ajuste
- Alertar admin urgentemente
- Prevenir: validar `split_fixed_value < client_charge_amount * 0.95` (com buffer) antes de criar cobrança

### 23.11 Subaccount Sem API Key Armazenada
- Se `asaas_account_api_key IS NULL`: escrow release impossível
- Alertar admin; realizar release manual via dashboard Asaas
- Prevenir: validar `asaas_account_api_key IS NOT NULL` no checkout

---

## 24. FASES DE IMPLEMENTAÇÃO

### Fase 1 — Fundação do Schema

**Escopo:**
- Migration: ALTER provider_proposals (novos campos financeiros + lock + status expandido)
- Migration: ALTER service_requests (novos status)
- Migration: ALTER profiles + provider_profiles_private (campos Asaas)
- Migration: CREATE service_payments
- Migration: CREATE services
- Migration: CREATE service_payment_events
- Migration: CREATE service_payment_releases
- Migration: Novos platform_constants
- Atualizar `calculate_provider_service_pricing` para incluir taxa do cliente
- Atualizar `pricing_signature` para 7 campos
- Atualizar `validate_provider_proposal_pricing` trigger
- Atualizar `create_provider_proposal` para aceitar novos campos
- Atualizar `expire_stale_provider_proposals` para usar status `expired` e pular `payment_pending`
- Backfill: preencher client_fee_* para propostas existentes com client_fee_rate=0 e recalcular signature
- Atualizar `list_client_received_budgets` para retornar `client_charge_amount`

**Risco principal:** Backfill das propostas existentes antes do deploy da nova trigger de validação.

**Dependências:** Nenhuma (primeira fase).

---

### Fase 2 — Onboarding Financeiro do Prestador

**Escopo:**
- Tela de onboarding financeiro do prestador (coleta de CPF/CNPJ, endereço etc.)
- Edge Function `create-provider-subaccount`:
  - `POST /v3/accounts` → armazenar apiKey + walletId + subaccount_id
  - `POST /v3/accounts/{id}/escrow` → habilitar escrow
  - Marcar `asaas_onboarding_status = 'active'`
- Badge "Aguardando cadastro financeiro" na proposta se não onboarded
- Validação no `initiate_checkout` para bloquear checkout de prestadores não onboarded

**Risco:** Fluxo de aprovação da subconta Asaas pode demorar. Testar no sandbox primeiro.

**Dependências:** Fase 1.

---

### Fase 3 — Checkout e Pagamento Pix

**Escopo:**
- RPC `initiate_checkout`: lock atômico + criação de service_payments
- RPC `get_checkout_details`: dados da tela de pagamento (projeção segura)
- Edge Function `create-asaas-charge`: criação lazy de customer + cobrança Pix + QR code
- Tela frontend "Revisar e Pagar" (completa)
- Supabase Realtime subscription em service_payments
- Edge Function `asaas-webhook` (handler básico: PAYMENT_RECEIVED → fluxo completo de sucesso)
- Fluxo completo de sucesso: proposal accepted + SR in_progress + services criado + escrow guarantee ID coletado
- Cron `expire_stale_checkouts` (a cada 5 min)
- Cron `expire_stale_provider_proposals` atualizado

**Risco:** Webhook dev local requer ngrok. Testar Pix sandbox com `/receiveInCash`.

**Dependências:** Fases 1 + 2.

---

### Fase 4 — Pagamento com Cartão de Crédito

**Escopo:**
- Tokenização do cartão no frontend (Asaas.js ou endpoint de tokenização)
- Edge Function `create-asaas-charge` estendida para CREDIT_CARD
- Webhook handlers: PAYMENT_AWAITING_RISK_ANALYSIS, PAYMENT_APPROVED_BY_RISK_ANALYSIS, PAYMENT_REPROVED_BY_RISK_ANALYSIS, PAYMENT_CREDIT_CARD_CAPTURE_REFUSED
- UI states: análise de risco, recusado, captura recusada
- Fluxo de retry (recusado → trocar para Pix)

**Risco:** Conformidade PCI — nunca tocar no PAN; usar tokenização.

**Dependências:** Fase 3.

---

### Fase 5 — Fluxo do Serviço e Release do Escrow

**Escopo:**
- Tela de acompanhamento do serviço (services screen)
- Prestador marca `services.status = 'completed'`
- Cliente confirma `services.status = 'confirmed'`
- Edge Function `release-escrow`:
  - Trigger: `services.status = 'confirmed'`
  - `POST /v3/escrow/{guarantee_id}/finish` usando subaccount api key
  - Atualizar: `service_payments.escrow_status = 'released'`
  - INSERT `service_payment_releases`
- Cron de verificação: detectar escrow 'blocked' com service 'confirmed' > 24h

**Risco:** API key do subaccount deve ser tratada com máxima segurança.

**Dependências:** Fases 3 + 4.

---

### Fase 6 — Cobertura Completa de Webhooks + Resiliência

**Escopo:**
- Handlers: PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_RESTORED
- Handlers de estorno: PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED
- Handlers de chargeback: PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_AWAITING_CHARGEBACK_REVERSAL
- Handler: PAYMENT_SPLIT_DIVERGENCE_BLOCK (alerta urgente)
- Sistema de alertas admin para eventos críticos
- Ferramenta de reprocessamento manual para admin
- Monitoramento de saúde da fila de webhooks
- Relatório diário de inconsistências (pagamentos confirmados sem service, etc.)

**Dependências:** Fases 3 + 4 + 5.

---

## 25. OBSERVABILIDADE E AUDITORIA

### 25.1 Log Estruturado (cada evento de webhook)

```json
{
  "level": "info",
  "event": "webhook_processed",
  "asaas_event": "PAYMENT_RECEIVED",
  "asaas_payment_id": "pay_xxx",
  "service_payment_id": "uuid",
  "proposal_id": "uuid",
  "service_request_id": "uuid",
  "client_id": "uuid",
  "provider_id": "uuid",
  "amount": 1050.00,
  "provider_net": 850.00,
  "platform_fee": 200.00,
  "escrow_status": "blocked",
  "processing_duration_ms": 45,
  "result": "success" | "duplicate" | "error"
}
```

### 25.2 Inconsistências a Monitorar Diariamente

```sql
-- Pagamentos confirmados sem service criado
SELECT sp.id FROM service_payments sp
LEFT JOIN services s ON s.proposal_id = sp.proposal_id
WHERE sp.status = 'confirmed' AND s.id IS NULL;

-- Propostas aceitas com SR não in_progress
SELECT pp.id, sr.status FROM provider_proposals pp
JOIN service_requests sr ON sr.id = pp.service_request_id
WHERE pp.status = 'accepted' AND sr.status NOT IN ('in_progress', 'closed', 'cancelled', 'disputed');

-- Escrow blocked com service confirmed há mais de 24h (release falhou)
SELECT sp.id, sp.asaas_escrow_guarantee_id FROM service_payments sp
JOIN services s ON s.proposal_id = sp.proposal_id
WHERE sp.escrow_status = 'blocked'
  AND s.status = 'confirmed'
  AND s.confirmed_at < now() - interval '24 hours';
```

---

## 26. RISCOS E QUESTÕES ABERTAS

### 26.1 Riscos

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| `asaas_account_api_key` perdida na criação do subaccount | Crítica | Armazenar imediatamente; double-write em variável de ambiente de backup |
| Prestador sem Pix key cadastrado no Asaas sandbox | Alta | Documentar pré-requisito; validar no onboarding |
| Divergência de split (`fixedValue > netValue`) | Alta | Validar antes de criar cobrança; `split_fixed_value < client_charge_amount * 0.95` |
| Fila de webhooks pausada (15 falhas consecutivas) | Alta | Monitor + alerta imediato; recuperação em < 14 dias |
| Cliente sem CPF no perfil | Alta | Bloquear checkout; exigir CPF antes de prosseguir |
| Escrow release falha silenciosamente | Alta | Cron monitor; alertar se 'blocked' + 'confirmed' > 24h |
| `client_fee_rate` não confirmada pelo produto | Média | Aguardar confirmação antes da Fase 1 |
| Emails/SMS reais disparados no sandbox | Média | Não usar emails/telefones reais de terceiros no sandbox |
| Custo de escrow (R$9,90/prestador/mês) | Média | Considerar no modelo financeiro; pode ser repassado ao prestador |

### 26.2 Questões Abertas

1. **Taxa do cliente:** O valor de 5% (`renovi_tax_client`) está confirmado com o produto?
2. **Quem paga o escrow:** A plataforma absorve os R$9,90/mês por prestador ou repassa?
3. **`daysToExpire` do escrow:** 30 dias é adequado como backup? Ou usar valor menor (ex.: 15 dias)?
4. **Política de cancelamento pós-service:** Após `services` criado, sob quais condições o cliente pode cancelar e receber estorno?
5. **Cartão parcelado:** Não planejado no V1. Confirmar se será suportado.
6. **Aprovação da subconta Asaas:** O fluxo de aprovação pode demorar. O que mostrar ao prestador enquanto aguarda?
7. **Verificar IPs oficiais do Asaas:** Configurar allowlist em Supabase para aceitar webhooks apenas de IPs Asaas.

---

## 27. RECOMENDAÇÕES ANTES DE CODIFICAR

1. **Confirmar a taxa do cliente** (5%?) com o produto. Esta é a base de todo o cálculo de `client_charge_amount`.

2. **Testar o fluxo Pix completo no sandbox antes da Fase 3:**
   - Criar conta sandbox → gerar API key → registrar chave Pix → criar customer → criar cobrança Pix → obter QR code → simular com `/receiveInCash` → verificar webhook.

3. **Proteger a `asaas_account_api_key`:** Criptografar com pgcrypto ou armazenar no Vault do Supabase. Nunca expor via RLS.

4. **Backfill das propostas existentes antes do deploy da Fase 1:** Propostas ativas têm `pricing_signature` de 4 campos. Antes de mudar o HMAC, fazer migration para preencher os novos campos com `client_fee_rate = 0` e recalcular a signature.

5. **Configurar ngrok imediatamente** para desenvolvimento de webhooks local. Sem isso, o ciclo de teste da Fase 3 é muito lento.

6. **Testar o lock de concorrência:** Escrever um teste que dispara dois checkouts simultâneos para a mesma proposta e verifica que apenas um retorna sucesso.

7. **Verificar IPs oficiais do Asaas** e configurar no Supabase para aceitar requisições de webhook apenas desses IPs.

8. **Sempre retornar 200 ao Asaas** — mesmo em erros de processamento. Nunca retornar 5xx (pausa a fila).

9. **Usar `externalReference = service_payments.id`** em todas as cobranças Asaas. É o fallback de lookup quando `asaas_payment_id` não bate.

10. **Não usar dados reais de terceiros no sandbox** — notificações são enviadas de verdade.

---

## APÊNDICE A — Schema Resumido Antes/Depois

| Tabela | Antes | Depois |
|--------|-------|--------|
| `provider_proposals` | 4 status, 9 campos principais | 7 status, +5 campos (fees, lock) |
| `service_requests` | 4 status | 6 status |
| `profiles` | sem Asaas | +`asaas_customer_id` |
| `provider_profiles_private` | dados legais apenas | +`asaas_wallet_id`, `asaas_subaccount_id`, `asaas_account_api_key`, `asaas_onboarding_status` |
| `services` | não existe | NOVA (operacional) |
| `service_payments` | não existe | NOVA (financeira + escrow) |
| `service_payment_events` | não existe | NOVA (auditoria + idempotência) |
| `service_payment_releases` | não existe | NOVA (tracking de release escrow) |

## APÊNDICE B — Endpoints Asaas Utilizados

| Operação | Método | Endpoint |
|----------|--------|----------|
| Criar customer | POST | `/v3/customers` |
| Criar subaccount | POST | `/v3/accounts` |
| Configurar escrow subconta | POST | `/v3/accounts/{id}/escrow` |
| Criar cobrança | POST | `/v3/payments` |
| Obter QR Pix | GET | `/v3/payments/{id}/pixQrCode` |
| Buscar cobrança | GET | `/v3/payments/{id}` |
| Estornar | POST | `/v3/payments/{id}/refund` |
| Obter garantia escrow | GET | `/v3/payments/{id}/escrow` (via API do subaccount) |
| Liberar escrow | POST | `/v3/escrow/{id}/finish` (via API do subaccount) |
| Criar webhook | POST | `/v3/webhooks` |
| Reativar fila webhook | PUT | `/v3/webhooks/{id}` → `interrupted: false` |
| [Sandbox] Simular Pix | POST | `/v3/payments/{id}/receiveInCash` |
| [Sandbox] Forçar vencimento | POST | `/v3/payments/{id}/overdue` |
