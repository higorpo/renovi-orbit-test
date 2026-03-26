# Renovi — Plano de Implementação do Sistema de Pagamentos
## Processador: Asaas | Modelo: Escrow
### Versão 4.0 — 2026-03-26 (parcelamento, taxas dinâmicas, decisões finais)

---

## AVISO CRÍTICO DE SCHEMA (Leia antes de tudo)

O modelo de precificação atual em `provider_proposals` calcula:

```
final_amount = proposed_amount - tax_amount   (= proposed_amount * 0.85)
```

Ou seja, `final_amount` é o **VALOR LÍQUIDO DO PRESTADOR**, não o que o cliente paga.
O cliente atualmente paga `proposed_amount`.

O novo sistema introduz uma **taxa do cliente** — mas essa taxa **não é persistida em `provider_proposals`**.
Ela é calculada dinamicamente sob demanda, separada do fluxo de precificação do prestador:

```
provider_net_amount  = proposed_amount - provider_fee_amount  ← armazenado na proposta (= atual final_amount)
client_charge_amount = proposed_amount + client_fee_amount    ← calculado sob demanda via RPC; congelado no checkout
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
| `client_charge_amount` em `provider_proposals`? | **NÃO** | Preço do cliente é dinâmico; calculado via RPC sob demanda; congelado apenas no `service_payments` |
| `pricing_signature` cobre campos do cliente? | **NÃO** | Assinatura protege somente precificação do prestador (4 campos); cliente é domínio separado |
| Quem paga taxa mensal escrow (R$9,90)? | **Plataforma (Renovi)** | `isFeePayer: false` — a Renovi absorve o custo operacional do escrow como custo da plataforma |
| `daysToExpire` do escrow? | **45 dias** (máximo suportado pelo Asaas) | Máximo buffer antes da liberação automática; garante proteção ao cliente |
| Cartão parcelado em V1? | **SIM — Pix + Cartão 1x + Cartão parcelado desde o dia 1** | Cliente paga TODAS as taxas financeiras adicionais do parcelamento |
| Quem paga taxas de gateway/cartão/antecipação? | **Cliente paga TUDO** | Renovi e prestador recebem valores líquidos sem dedução de taxas Asaas |

---

## 2. AVALIAÇÃO DO SCHEMA ATUAL

### 2.1 `provider_proposals` — Problemas Encontrados

| Coluna | Estado Atual | Avaliação |
|--------|-------------|-----------|
| `proposed_amount` | Valor cotado pelo prestador (pré-taxa) | Reutilizar — base bruta |
| `tax_rate` | Taxa do prestador (0.15) | Reutilizar — taxa do lado provedor |
| `tax_amount` | `proposed_amount * tax_rate` | Reutilizar — taxa deduzida do prestador |
| `final_amount` | `proposed_amount - tax_amount` | Reutilizar — **é o líquido do prestador** |
| `pricing_signature` | HMAC dos 4 campos acima | Manter cobrindo exatamente estes 4 campos |
| `status` | 4 valores | **Expandir para 7 valores** |
| `client_response_deadline_at` | created_at + 48h | Manter; trigger atualizado |

**Colunas ausentes (apenas colunas operacionais de lock):**
- `checkout_locked_until` — timestamp de expiração do lock de concorrência durante checkout ativo
- `locked_payment_id` — FK para `service_payments.id` ativo

> **Nota arquitetural:** `client_fee_rate`, `client_fee_amount` e `client_charge_amount` **não pertencem a `provider_proposals`**.
> O preço do cliente é dinâmico e calculado sob demanda via RPC `get_client_proposal_pricing`.
> Estas colunas existem em `service_payments` como snapshot congelado no momento do checkout, não como dados da proposta.

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
-- Lock de checkout (únicas adições nesta tabela)
-- NÃO adicionar colunas de precificação do cliente aqui
ALTER TABLE public.provider_proposals
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
O HMAC cobre **exatamente os mesmos 4 campos atuais** — sem alteração:
```
proposed_amount|tax_rate|tax_amount|final_amount
```

A precificação do cliente é um domínio separado, calculado sob demanda. Não integra a assinatura do prestador.

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
  ('escrow_days_to_expire',         '45'),       -- UPDATED: máximo suportado pelo Asaas
  ('asaas_environment',             '"sandbox"'),
  -- // ADDED: Constantes de taxas de gateway para cálculo dinâmico de parcelamento
  ('card_processing_fee_1x_percent',      '0.0299'),   -- 2,99% cartão à vista
  ('card_processing_fee_2_6x_percent',    '0.0349'),   -- 3,49% cartão 2-6x
  ('card_processing_fee_7_12x_percent',   '0.0399'),   -- 3,99% cartão 7-12x
  ('card_processing_fee_13_21x_percent',  '0.0429'),   -- 4,29% cartão 13-21x (Visa/Master apenas)
  ('card_fixed_fee_per_transaction',      '0.49'),     -- R$0,49 por transação
  ('anticipation_fee_per_month_percent',  '0.0170'),   -- 1,70%/mês antecipação parcelado
  ('anticipation_fee_cash_percent',       '0.0125'),   -- 1,25%/mês antecipação à vista
  ('max_installments',                    '12'),       -- Máximo de parcelas (conservador; Visa/Master suporta 21)
  ('pix_processing_fee_percent',          '0.0099'),   -- 0,99% Pix (taxa Asaas padrão)
  ('pix_fixed_fee_per_transaction',       '0.00')      -- R$0,00 taxa fixa Pix
ON CONFLICT (key) DO NOTHING;
```

> **IMPORTANTE — Configuração dinâmica de taxas:** Todas as taxas acima são lidas em tempo de execução pela função `_calculate_client_pricing`. NUNCA devem ser hardcoded no código. Mudanças de taxa Asaas são tratadas atualizando `platform_constants` — sem deploy de código.
>
> **Fallback:** Se uma chave de taxa estiver ausente, `_calculate_client_pricing` DEVE lançar exceção com mensagem descritiva. Não usar valores default silenciosos — isso mascara erros de configuração.
>
> **Atualização segura:** Alterações em `platform_constants` afetam apenas NOVOS checkouts. Checkouts em andamento (snapshot congelado em `service_payments`) não são afetados. Para auditoria retroativa, sempre verificar `service_payments.client_fee_rate` e os novos campos de taxa do snapshot.

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
  -- SNAPSHOT FINANCEIRO — congelado no momento do checkout (IMUTÁVEL)
  -- Calculado no initiate_checkout; nunca derivado de provider_proposals
  -- ────────────────────────────────────────────────────────────────
  -- Lado do prestador (copiado de provider_proposals no momento do lock)
  proposed_amount             numeric(10,2) NOT NULL,   -- valor cotado pelo prestador
  provider_fee_rate           numeric(6,4)  NOT NULL,   -- ex.: 0.15 (tax_rate da proposta)
  provider_fee_amount         numeric(10,2) NOT NULL,   -- proposed_amount * provider_fee_rate (tax_amount)
  provider_net_amount         numeric(10,2) NOT NULL,   -- proposed_amount - provider_fee_amount (final_amount)

  -- Lado do cliente (calculado no initiate_checkout via _calculate_client_pricing)
  -- Fonte: platform_constants.renovi_tax_client vigente no momento do checkout
  client_fee_rate             numeric(6,4)  NOT NULL,   -- taxa Renovi do cliente no momento do checkout
  client_fee_amount           numeric(10,2) NOT NULL,   -- proposed_amount * client_fee_rate (taxa Renovi)
  client_charge_amount        numeric(10,2) NOT NULL,   -- valor TOTAL cobrado do cliente (inclui TODAS as taxas)

  -- // ADDED: Snapshot de taxas de gateway e parcelamento (congelado no checkout)
  -- Estas taxas são calculadas por _calculate_client_pricing e congeladas aqui
  installment_count           integer       NOT NULL DEFAULT 1,    -- 1 = à vista; 2-12 = parcelado
  installment_value           numeric(10,2),                       -- valor de cada parcela (NULL se 1x)
  gateway_fee_percent         numeric(6,4)  NOT NULL DEFAULT 0,    -- taxa do gateway aplicada (varia por método/parcelas)
  gateway_fee_amount          numeric(10,2) NOT NULL DEFAULT 0,    -- valor absoluto da taxa do gateway
  gateway_fixed_fee           numeric(10,2) NOT NULL DEFAULT 0,    -- taxa fixa por transação (R$0,49 cartão, R$0,00 Pix)
  anticipation_fee_percent    numeric(6,4)  NOT NULL DEFAULT 0,    -- taxa de antecipação aplicada (0 se Pix ou 1x)
  anticipation_fee_amount     numeric(10,2) NOT NULL DEFAULT 0,    -- valor absoluto da antecipação
  total_gateway_cost          numeric(10,2) NOT NULL DEFAULT 0,    -- gateway_fee_amount + gateway_fixed_fee + anticipation_fee_amount

  -- Plataforma
  platform_total_fee_amount   numeric(10,2) NOT NULL,   -- provider_fee_amount + client_fee_amount (receita Renovi)

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
  asaas_installment_id        text,            -- // ADDED: ID do plano de parcelamento Asaas (null se 1x)
  asaas_due_date              date,
  asaas_paid_at               timestamptz,
  asaas_credit_date           date,
  asaas_last_status           text,            -- último status bruto do Asaas
  asaas_failure_reason        text,

  -- ────────────────────────────────────────────────────────────────
  -- DADOS DE ESCROW
  -- ────────────────────────────────────────────────────────────────
  asaas_escrow_guarantee_id   text,
  escrow_status               text DEFAULT 'not_applicable'
    CHECK (escrow_status IN (
      'not_applicable',
      'blocked',
      'released',
      'cancelled'
    )),
  escrow_release_triggered_at timestamptz,
  escrow_released_at          timestamptz,

  -- ────────────────────────────────────────────────────────────────
  -- INTEGRIDADE DE PRECIFICAÇÃO DO PRESTADOR
  -- ────────────────────────────────────────────────────────────────
  -- Cópia da pricing_signature da proposta no momento do checkout (4 campos do prestador).
  -- Garante que o provider_net_amount no snapshot corresponde à proposta original assinada.
  -- A precificação do cliente (client_fee_rate/amount/charge_amount) é auditada pelo
  -- contexto da data/hora do checkout e pelo platform_constant vigente — não por assinatura.
  proposal_pricing_signature  text NOT NULL,

  -- ────────────────────────────────────────────────────────────────
  -- TEMPOS DO CHECKOUT
  -- ────────────────────────────────────────────────────────────────
  checkout_initiated_at       timestamptz NOT NULL DEFAULT now(),
  checkout_expires_at         timestamptz NOT NULL,
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

  event_source             text NOT NULL CHECK (event_source IN ('asaas_webhook', 'internal', 'manual_admin')),
  event_type               text NOT NULL,

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

  raw_payload              jsonb,
  processed_at             timestamptz NOT NULL DEFAULT now(),
  processing_error         text,
  is_duplicate             boolean NOT NULL DEFAULT false,

  created_at               timestamptz NOT NULL DEFAULT now()
);

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

### 5.0 Separação de Domínios de Precificação

O sistema adota um modelo de precificação em **três camadas distintas e independentes**:

```
CAMADA 1 — PRECIFICAÇÃO DO PRESTADOR (estática, na criação da proposta)
───────────────────────────────────────────────────────────────────────
Onde: provider_proposals
Quando calculada: ao submeter a proposta (fluxo existente, sem alteração)
Campos: proposed_amount, tax_rate, tax_amount, final_amount (= provider_net_amount)
Proteção: pricing_signature = HMAC-SHA256 dos 4 campos acima
Imutável após criação; jamais inclui dados do lado do cliente


CAMADA 2 — PRECIFICAÇÃO DO CLIENTE (dinâmica, calculada sob demanda)
───────────────────────────────────────────────────────────────────────
Onde: NÃO é armazenada em provider_proposals
Quando calculada: somente quando o cliente acessa a tela de orçamentos
Como calculada: RPC pública get_client_proposal_pricing() invocada pelo frontend
Fonte: platform_constants.renovi_tax_client (taxa vigente no momento da consulta)
Preparada para evolução: aceita p_payment_method desde V1 (parâmetro ignorado
por ora; será usado para taxas diferenciadas por método de pagamento no futuro)


CAMADA 3 — SNAPSHOT FINANCEIRO (congelado no checkout, imutável)
───────────────────────────────────────────────────────────────────────
Onde: service_payments (criado em initiate_checkout)
Quando criado: no exato momento em que o cliente confirma o checkout
Contém: ambos os lados (prestador + cliente), valores fixados para sempre
Autoridade: é o registro definitivo de quanto foi cobrado e quanto é devido
```

**Por que esta separação?**

A taxa do cliente será **dinâmica no futuro**: poderá variar por método de pagamento (ex.: cartão com acréscimo), por região, por cupom de desconto ou por política comercial do produto. Se o `client_charge_amount` fosse armazenado na proposta no momento da criação, qualquer mudança de regra exigiria migração de dados históricos ou criaria inconsistências entre propostas antigas e novas. Ao calcular sob demanda, a lógica de precificação evolui sem tocar em dados persistidos. O snapshot em `service_payments` garante auditabilidade: para qualquer transação financeira passada, sempre é possível saber exatamente qual taxa foi aplicada e quando.

### 5.1 Definição dos Valores

Dado `proposed_amount = R$1.000,00` com as taxas atuais:

```
── CAMADA 1 (armazenada em provider_proposals) ──────────────────────
provider_fee_rate      = 0.15   (platform_constants.renovi_tax_provider)
provider_fee_amount    = R$150,00
provider_net_amount    = R$850,00   (= atual final_amount)
pricing_signature      = HMAC(proposed_amount|tax_rate|tax_amount|final_amount)

── CAMADA 2 (calculada em tempo de acesso via RPC) ───────────────────
client_fee_rate        = 0.05   (platform_constants.renovi_tax_client — vigente no momento)
client_fee_amount      = R$50,00
client_charge_amount   = R$1.050,00  ← único valor mostrado ao cliente (PIX / Cartão 1x)

── CAMADA 3 (congelada em service_payments no initiate_checkout) ─────
Todos os campos acima + método de pagamento + wallet do split + timestamps
platform_total_fee     = R$200,00   (provider_fee + client_fee — fica na plataforma)

── Asaas ─────────────────────────────────────────────────────────────
Cobrança Asaas         = R$1.050,00  (client_charge_amount — PIX / Cartão 1x)
Split ao prestador     = R$850,00    (fixedValue = provider_net_amount)
Plataforma retém       = R$200,00    (menos taxas Asaas — absorvidas pela plataforma)
```

// ADDED: Pipeline de cálculo com parcelamento e taxas de gateway
### 5.1.1 Pipeline Completo de Composição de Preço (CRÍTICO)

O cliente paga **TODAS** as taxas financeiras. O pipeline de cálculo é:

```
ETAPA 1 — Base
  base_price           = proposed_amount                         (ex.: R$1.000,00)

ETAPA 2 — Taxa Renovi (sempre aplicada)
  renovi_fee           = base_price × renovi_tax_client          (ex.: R$50,00)
  subtotal_1           = base_price + renovi_fee                 (ex.: R$1.050,00)

ETAPA 3 — Taxa do gateway (varia por método e parcelas)
  gateway_fee          = subtotal_1 × card_processing_fee_percent  (ex.: R$36,65 para 2-6x a 3,49%)
  gateway_fixed        = card_fixed_fee_per_transaction             (ex.: R$0,49)

ETAPA 4 — Taxa de antecipação (SOMENTE para parcelamento)
  anticipation_fee     = subtotal_1 × anticipation_rate × parcelas_restantes_ponderadas
                        (cálculo detalhado na seção 5.1.2)

ETAPA 5 — Total do cliente
  total_gateway_cost   = gateway_fee + gateway_fixed + anticipation_fee
  client_charge_amount = subtotal_1 + total_gateway_cost

ETAPA 6 — Valor por parcela
  installment_value    = ceil_2(client_charge_amount / installment_count)
  (última parcela ajustada para fechar o total exato)
```

**Regra de resultado garantido:**
- Renovi SEMPRE recebe `provider_fee_amount + client_fee_amount` (R$200 no exemplo) — líquido, sem dedução de taxas Asaas
- Prestador SEMPRE recebe `provider_net_amount` (R$850 no exemplo) — via split fixo
- Cliente paga o `client_charge_amount` que já embute TODAS as taxas
- Taxas Asaas são cobertas pelo spread entre `client_charge_amount` e `provider_net_amount + platform_total_fee`

### 5.1.2 Exemplos Concretos de Parcelamento

Dado `proposed_amount = R$1.000,00`:

```
── PIX ───────────────────────────────────────────────────────────────
base_price           = R$1.000,00
renovi_fee           = R$50,00       (5%)
subtotal_1           = R$1.050,00
gateway_fee          = R$10,40       (0,99%)
gateway_fixed        = R$0,00
anticipation_fee     = R$0,00
client_charge_amount = R$1.060,40
Resultado: Cliente paga R$1.060,40

── CARTÃO 1x (à vista) ──────────────────────────────────────────────
base_price           = R$1.000,00
renovi_fee           = R$50,00       (5%)
subtotal_1           = R$1.050,00
gateway_fee          = R$31,40       (2,99%)
gateway_fixed        = R$0,49
anticipation_fee     = R$0,00        (sem antecipação à vista)
client_charge_amount = R$1.081,89
Resultado: Cliente paga R$1.081,89

── CARTÃO 6x ─────────────────────────────────────────────────────────
base_price           = R$1.000,00
renovi_fee           = R$50,00       (5%)
subtotal_1           = R$1.050,00
gateway_fee          = R$36,65       (3,49%)
gateway_fixed        = R$0,49
anticipation_fee     = R$62,48       (1,70%/mês × média ponderada de 3,5 meses)
client_charge_amount = R$1.149,62
installment_value    = R$191,60      (6 × R$191,60 = R$1.149,60; última parcela R$191,62)
Resultado: Cliente vê "6x de R$191,60"

── CARTÃO 12x ────────────────────────────────────────────────────────
base_price           = R$1.000,00
renovi_fee           = R$50,00       (5%)
subtotal_1           = R$1.050,00
gateway_fee          = R$41,90       (3,99%)
gateway_fixed        = R$0,49
anticipation_fee     = R$116,03      (1,70%/mês × média ponderada de 6,5 meses)
client_charge_amount = R$1.208,42
installment_value    = R$100,70      (12 × R$100,70 = R$1.208,40; última parcela R$100,72)
Resultado: Cliente vê "12x de R$100,70"
```

> **Fórmula de antecipação ponderada:** A antecipação é calculada sobre o número médio ponderado de meses.
> Para N parcelas: `anticipation_fee = subtotal_1 × anticipation_rate × ((N+1)/2)`
> Isso porque a parcela 1 é recebida imediatamente, a parcela 2 em 1 mês, ..., parcela N em (N-1) meses.
> Média = (0 + 1 + 2 + ... + (N-1)) / N = (N-1)/2 meses.
> Portanto: `anticipation_fee = subtotal_1 × rate_per_month × (N-1)/2`
>
> **Nota sobre Pix:** O Pix também tem taxa Asaas (0,99%). Para manter a garantia de que a Renovi e o prestador recebem seus valores líquidos, o cliente paga esta taxa também. Sem esta inclusão, a Renovi absorveria ~1% de cada transação Pix.

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

### 5.3 RPC `get_client_proposal_pricing` — Precificação Dinâmica do Cliente

Esta RPC é o **ponto central** da Camada 2. Toda lógica de precificação do cliente passa por ela.

**Responsabilidade:** Receber um `proposal_id` e retornar o valor que o cliente pagará, calculado com a taxa vigente naquele momento.

**Quando é chamada:**
- Ao renderizar a lista de orçamentos (`list_client_received_budgets`) — em bulk inline
- Ao renderizar o detalhe de uma proposta
- Na tela de checkout ("Revisar e Pagar") — para exibir o total antes de confirmar
- Internamente em `initiate_checkout` — para popular o snapshot financeiro

**Não persiste nada.** É pura leitura + cálculo.

#### 5.3.1 Função interna `_calculate_client_pricing`

Esta função é a **única implementação** do cálculo de precificação do cliente. Tanto a RPC pública quanto o `initiate_checkout` a chamam, garantindo consistência:

```sql
-- // UPDATED: Função interna agora calcula TODAS as taxas financeiras (Renovi + gateway + antecipação)
-- O cliente paga TODAS as taxas. Nenhuma taxa é hardcoded — todas vêm de platform_constants.
-- Retorna todos os campos necessários ao snapshot financeiro, incluindo parcelamento.
CREATE OR REPLACE FUNCTION public._calculate_client_pricing(
  p_proposed_amount    numeric,
  p_payment_method     text DEFAULT 'PIX',
  p_installment_count  integer DEFAULT 1           -- // ADDED: número de parcelas (1 = à vista)
) RETURNS TABLE (
  client_fee_rate           numeric,
  client_fee_amount         numeric,
  client_charge_amount      numeric,
  installment_count         integer,                -- // ADDED
  installment_value         numeric,                -- // ADDED: valor de cada parcela (NULL se 1x)
  gateway_fee_percent       numeric,                -- // ADDED
  gateway_fee_amount        numeric,                -- // ADDED
  gateway_fixed_fee         numeric,                -- // ADDED
  anticipation_fee_percent  numeric,                -- // ADDED
  anticipation_fee_amount   numeric,                -- // ADDED
  total_gateway_cost        numeric                 -- // ADDED
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_fee_rate         numeric(6,4);
  v_client_fee_amount       numeric(10,2);
  v_subtotal                numeric(10,2);
  v_gateway_fee_percent     numeric(6,4) := 0;
  v_gateway_fee_amount      numeric(10,2) := 0;
  v_gateway_fixed_fee       numeric(10,2) := 0;
  v_anticipation_rate       numeric(6,4) := 0;
  v_anticipation_fee_amount numeric(10,2) := 0;
  v_total_gateway_cost      numeric(10,2) := 0;
  v_client_charge_amount    numeric(10,2);
  v_installment_value       numeric(10,2);
  v_max_installments        integer;

  -- Helper para buscar constante com validação
  FUNCTION _get_const(p_key text) RETURNS numeric AS $inner$
  DECLARE v numeric;
  BEGIN
    SELECT (value::text)::numeric INTO v FROM public.platform_constants WHERE key = p_key;
    IF v IS NULL THEN
      RAISE EXCEPTION 'Configuração "%" não encontrada em platform_constants', p_key;
    END IF;
    RETURN v;
  END;
  $inner$ LANGUAGE plpgsql;
BEGIN
  -- Validar installment_count
  v_max_installments := _get_const('max_installments')::integer;
  IF p_installment_count < 1 OR p_installment_count > v_max_installments THEN
    RAISE EXCEPTION 'Número de parcelas inválido: %. Permitido: 1 a %', p_installment_count, v_max_installments;
  END IF;
  IF p_payment_method = 'PIX' AND p_installment_count > 1 THEN
    RAISE EXCEPTION 'PIX não suporta parcelamento';
  END IF;

  -- ETAPA 1+2: Taxa Renovi
  v_client_fee_rate := _get_const('renovi_tax_client');
  v_client_fee_amount := round(p_proposed_amount * v_client_fee_rate, 2);
  v_subtotal := p_proposed_amount + v_client_fee_amount;

  -- ETAPA 3: Taxa do gateway (varia por método e faixa de parcelas)
  IF p_payment_method = 'PIX' THEN
    v_gateway_fee_percent := _get_const('pix_processing_fee_percent');
    v_gateway_fixed_fee   := _get_const('pix_fixed_fee_per_transaction');
  ELSIF p_payment_method = 'CREDIT_CARD' THEN
    v_gateway_fixed_fee := _get_const('card_fixed_fee_per_transaction');
    IF p_installment_count = 1 THEN
      v_gateway_fee_percent := _get_const('card_processing_fee_1x_percent');
    ELSIF p_installment_count BETWEEN 2 AND 6 THEN
      v_gateway_fee_percent := _get_const('card_processing_fee_2_6x_percent');
    ELSIF p_installment_count BETWEEN 7 AND 12 THEN
      v_gateway_fee_percent := _get_const('card_processing_fee_7_12x_percent');
    ELSE
      v_gateway_fee_percent := _get_const('card_processing_fee_13_21x_percent');
    END IF;
  END IF;

  v_gateway_fee_amount := round(v_subtotal * v_gateway_fee_percent, 2);

  -- ETAPA 4: Taxa de antecipação (SOMENTE parcelamento cartão, N >= 2)
  IF p_payment_method = 'CREDIT_CARD' AND p_installment_count >= 2 THEN
    v_anticipation_rate := _get_const('anticipation_fee_per_month_percent');
    -- Fórmula: subtotal × rate × (N-1)/2 (média ponderada dos meses)
    v_anticipation_fee_amount := round(v_subtotal * v_anticipation_rate * (p_installment_count - 1)::numeric / 2, 2);
  END IF;

  -- ETAPA 5: Total
  v_total_gateway_cost := v_gateway_fee_amount + v_gateway_fixed_fee + v_anticipation_fee_amount;
  v_client_charge_amount := v_subtotal + v_total_gateway_cost;

  -- ETAPA 6: Valor por parcela
  IF p_installment_count > 1 THEN
    v_installment_value := round(v_client_charge_amount / p_installment_count, 2);
  END IF;

  RETURN QUERY SELECT
    v_client_fee_rate,
    v_client_fee_amount,
    v_client_charge_amount,
    p_installment_count,
    v_installment_value,
    v_gateway_fee_percent,
    v_gateway_fee_amount,
    v_gateway_fixed_fee,
    v_anticipation_rate,
    v_anticipation_fee_amount,
    v_total_gateway_cost;
END;
$$;

-- Revogar acesso público; somente funções SECURITY DEFINER a chamam
REVOKE ALL ON FUNCTION public._calculate_client_pricing FROM PUBLIC;
```

> **Nota sobre inner function:** PostgreSQL 14+ suporta funções internas em PL/pgSQL via `CREATE FUNCTION` dentro do `DECLARE`. Se a versão do Supabase não suportar, extrair `_get_const` como função SQL auxiliar separada.

#### 5.3.2 RPC pública `get_client_proposal_pricing`

```sql
-- RPC pública chamada pelo frontend na tela de orçamentos e checkout.
-- Retorna SOMENTE client_charge_amount ao cliente — nunca o breakdown de taxas.
-- O parâmetro p_payment_method já está presente para evolução futura.
CREATE OR REPLACE FUNCTION public.get_client_proposal_pricing(
  p_proposal_id    uuid,
  p_payment_method text DEFAULT 'PIX'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposed_amount   numeric(10,2);
  v_pricing           record;
BEGIN
  -- Validar que a proposta existe e está em estado visível ao cliente
  SELECT proposed_amount
  INTO v_proposed_amount
  FROM public.provider_proposals
  WHERE id = p_proposal_id
    AND status NOT IN ('withdrawn', 'expired', 'closed_due_to_other_selection');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada ou não disponível: %', p_proposal_id;
  END IF;

  -- RLS: verificar que o chamador é o cliente do pedido vinculado
  IF NOT EXISTS (
    SELECT 1 FROM public.provider_proposals pp
    JOIN public.service_requests sr ON sr.id = pp.service_request_id
    WHERE pp.id = p_proposal_id
      AND sr.client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- // UPDATED: Calcular PIX + todas as opções de parcelamento de uma vez
  -- Retornar opções de pagamento com taxas embutidas — jamais expor o breakdown
  DECLARE
    v_result       jsonb;
    v_options      jsonb := '[]'::jsonb;
    v_pricing      record;
    v_max          integer;
    i              integer;
  BEGIN
    -- PIX (sempre disponível)
    SELECT * INTO v_pricing FROM public._calculate_client_pricing(v_proposed_amount, 'PIX', 1);
    v_options := v_options || jsonb_build_array(jsonb_build_object(
      'method', 'PIX', 'installments', 1,
      'total', v_pricing.client_charge_amount,
      'installment_value', v_pricing.client_charge_amount
    ));

    -- Cartão 1x
    SELECT * INTO v_pricing FROM public._calculate_client_pricing(v_proposed_amount, 'CREDIT_CARD', 1);
    v_options := v_options || jsonb_build_array(jsonb_build_object(
      'method', 'CREDIT_CARD', 'installments', 1,
      'total', v_pricing.client_charge_amount,
      'installment_value', v_pricing.client_charge_amount
    ));

    -- Cartão parcelado (2x até max_installments)
    SELECT (value::text)::integer INTO v_max FROM platform_constants WHERE key = 'max_installments';
    FOR i IN 2..COALESCE(v_max, 12) LOOP
      SELECT * INTO v_pricing FROM public._calculate_client_pricing(v_proposed_amount, 'CREDIT_CARD', i);
      v_options := v_options || jsonb_build_array(jsonb_build_object(
        'method', 'CREDIT_CARD', 'installments', i,
        'total', v_pricing.client_charge_amount,
        'installment_value', v_pricing.installment_value
      ));
    END LOOP;

    RETURN jsonb_build_object(
      'proposal_id', p_proposal_id,
      'payment_options', v_options
      -- Intencionalmente omitido: client_fee_rate, gateway_fee, anticipation_fee
      -- O cliente vê APENAS o total e o valor por parcela — nunca a composição
    );
  END;
END;
$$;
```

> **Nota sobre performance:** Esta RPC calcula N+2 opções (PIX + 1x + 2x..Nx). Para `max_installments=12`, são 13 chamadas a `_calculate_client_pricing`. Cada chamada faz 1 SELECT em `platform_constants`. Para otimizar, uma versão futura pode buscar todas as constantes uma vez e passar como parâmetros.
>
> **Formato de retorno para o frontend:**
> ```json
> {
>   "proposal_id": "uuid",
>   "payment_options": [
>     { "method": "PIX", "installments": 1, "total": 1060.40, "installment_value": 1060.40 },
>     { "method": "CREDIT_CARD", "installments": 1, "total": 1081.89, "installment_value": 1081.89 },
>     { "method": "CREDIT_CARD", "installments": 2, "total": 1100.53, "installment_value": 550.27 },
>     { "method": "CREDIT_CARD", "installments": 6, "total": 1149.62, "installment_value": 191.60 },
>     { "method": "CREDIT_CARD", "installments": 12, "total": 1208.42, "installment_value": 100.70 }
>   ]
> }
> ```

#### 5.3.3 Uso em bulk na listagem de orçamentos

A RPC `list_client_received_budgets` não chama `get_client_proposal_pricing` individualmente para cada proposta (evita N+1). Em vez disso, busca a taxa uma vez e aplica a todas:

```sql
-- Trecho dentro de list_client_received_budgets:
DECLARE
  v_client_fee_rate numeric(6,4);
BEGIN
  -- Buscar taxa vigente UMA vez para toda a query
  SELECT (value::text)::numeric INTO v_client_fee_rate
  FROM public.platform_constants WHERE key = 'renovi_tax_client';

  -- Calcular client_charge_amount inline no SELECT para cada proposta:
  -- proposed_amount + round(proposed_amount * v_client_fee_rate, 2) AS client_charge_amount
  -- NUNCA retornar client_fee_rate ou client_fee_amount ao frontend
```

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
  "isFeePayer": false,      // UPDATED: plataforma (Renovi) paga a taxa de R$9,90/mês — NÃO o prestador
  "daysToExpire": 45        // UPDATED: máximo suportado pelo Asaas (45 dias); liberação automática como backup
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

  release_type            text NOT NULL CHECK (release_type IN (
    'escrow_manual',
    'escrow_auto',
    'escrow_cancelled'
  )),

  asaas_escrow_guarantee_id text,
  released_amount         numeric(10,2) NOT NULL,

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
{ "enabled": true, "isFeePayer": false, "daysToExpire": 45 }    // UPDATED: plataforma paga; 45 dias máximo Asaas
Authorization: {api_key_da_PLATAFORMA}  ← configuração de escrow é feita pela conta principal
```

**Bloqueio de checkout:** Se `asaas_onboarding_status != 'active'` ou `asaas_wallet_id IS NULL`, bloquear checkout mostrando: "Este prestador ainda não completou o cadastro financeiro."

### 7.3 Cobrança Asaas

```
POST /v3/payments

── PIX ou Cartão 1x ──────────────────────────────────────────────────
{
  "customer": "<asaas_customer_id>",
  "billingType": "PIX" | "CREDIT_CARD",
  "value": <client_charge_amount>,          ← vem do snapshot em service_payments
  "dueDate": "<hoje + 1 dia>",
  "description": "Renovi - <service_title> - <provider_display_name>",
  "externalReference": "<service_payments.id>",   ← CRÍTICO: fallback de lookup no webhook
  "split": [
    { "walletId": "<provider_asaas_wallet_id>", "fixedValue": <provider_net_amount> }
  ]
}

── Cartão Parcelado (2x+) ── // ADDED ────────────────────────────────
{
  "customer": "<asaas_customer_id>",
  "billingType": "CREDIT_CARD",
  "totalValue": <client_charge_amount>,     ← ATENÇÃO: usar totalValue, NÃO value (que é só para 1x)
  "installmentCount": <installment_count>,  ← do snapshot em service_payments
  "installmentValue": <installment_value>,  ← do snapshot em service_payments
  "dueDate": "<hoje>",
  "description": "Renovi - <service_title> - <provider_display_name>",
  "externalReference": "<service_payments.id>",
  "split": [
    { "walletId": "<provider_asaas_wallet_id>", "fixedValue": <provider_net_amount> }
  ],
  "creditCard": { /* token */ },
  "creditCardHolderInfo": { ... }
}
```

> **REGRA CRÍTICA DE PARCELAMENTO:** Para 1x, usar `"value"`. Para 2x+, usar `"totalValue"` + `"installmentCount"` + `"installmentValue"`. Misturar os dois formatos causa erro na API Asaas.
>
> **Split em parcelamentos:** O split é aplicado **por parcela individual**, não sobre o total. O Asaas distribui proporcionalmente. O `fixedValue` do split se refere ao valor que o prestador recebe **no total** (soma de todas as parcelas). Verificar na documentação Asaas mais recente se o comportamento mudou.
>
> **Endpoint de simulação (recomendado antes de criar):**
> ```
> POST /v3/payments/simulate
> { "value": <total>, "billingType": "CREDIT_CARD", "installmentCount": <N> }
> ```
> Retorna `netValue` e breakdown de taxas sem criar a cobrança. Usar para validar que o `netValue` cobre o split.

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

4.  // UPDATED: Tela de Orçamento — exibir APENAS valor base + taxa Renovi
    Para cada proposta, exibir:
    - Valor do serviço (proposed_amount): "Valor do orçamento: R$1.000,00"
    - Taxa Renovi (+5%): "Taxa da plataforma: R$50,00"
    - Total base: "Total: R$1.050,00"
    NÃO exibir taxas de cartão, parcelamento, ou valores por parcela nesta tela.
    O cálculo inline em list_client_received_budgets usa renovi_tax_client vigente.

    O detalhamento de taxas de gateway e opções de parcelamento aparece
    SOMENTE na tela de checkout (passo 8), após o cliente clicar "Quero contratar".

5.  Cliente clica "Quero contratar" em uma proposta

6.  ──── BACKEND: RPC initiate_checkout() ─────────────────────────────────
    Validações:
    a. proposal.status = 'submitted'
    b. service_request.status = 'open'
    c. proposal.checkout_locked_until IS NULL OR <= now()
    d. proposal.created_at + 48h > now() (não expirou)
    e. Verificar pricing_signature da proposta (HMAC dos 4 campos do prestador)
    f. provider_profiles_private.asaas_wallet_id IS NOT NULL
    g. provider_profiles_private.asaas_onboarding_status = 'active'
    h. client_profiles_private.cpf IS NOT NULL (necessário para customer Asaas)

    Cálculo de precificação do cliente (dentro da transação):
    → Chamar _calculate_client_pricing(proposal.proposed_amount, 'PIX')
    → Obter: client_fee_rate, client_fee_amount, client_charge_amount (calculados com taxa VIGENTE)

    Transação atômica:
    - SET proposal.status = 'payment_pending'
    - SET proposal.checkout_locked_until = now() + 30min
    - SET service_request.status = 'budget_selected_pending_payment'
    - INSERT service_payments com snapshot completo:
        proposed_amount     = proposal.proposed_amount
        provider_fee_rate   = proposal.tax_rate
        provider_fee_amount = proposal.tax_amount
        provider_net_amount = proposal.final_amount
        client_fee_rate     = (resultado de _calculate_client_pricing)
        client_fee_amount   = (resultado de _calculate_client_pricing)
        client_charge_amount= (resultado de _calculate_client_pricing)
        platform_total_fee_amount = provider_fee_amount + client_fee_amount
        proposal_pricing_signature = proposal.pricing_signature
        split_wallet_id     = provider_profiles_private.asaas_wallet_id
        split_fixed_value   = proposal.final_amount
        checkout_expires_at = now() + 30min
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
    - Total: service_payments.client_charge_amount  ← lido do snapshot
    - Seletor de método: PIX (recomendado) | Cartão de crédito
    - Countdown: "Esta proposta está reservada por 28 min."

9.  Cliente seleciona PIX → clica "Pagar com PIX"

10. ──── BACKEND: Edge Function create-asaas-charge ───────────────────────
    a. Criar/obter Asaas customer para o cliente
    b. POST /v3/payments (billingType=PIX, value=service_payments.client_charge_amount,
       split=[{walletId: split_wallet_id, fixedValue: split_fixed_value}])
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
  - `payment`: **client_charge_amount** (somente este campo financeiro — vem do snapshot)
  - `checkout_expires_at`

### 10.3 Seções da Tela

**1. Resumo do pedido:** ícone + tipo de serviço, título do pedido, bairro/cidade

**2. Sobre o prestador:** foto assinada (signed URL), nome, bio, link "Ver perfil completo"

**3. Detalhes do orçamento:** descrição completa, duração estimada, fotos (carrossel), slots sugeridos

**4. Garantia e pagamento:**
> "Seu pagamento fica protegido. O prestador só recebe o valor após a conclusão do serviço confirmada por você."

**5. Valor e método:** // UPDATED: agora com opções de parcelamento
- Seletor de método de pagamento:
  - **PIX** (badge "Aprovação imediata") → exibe total Pix (ex.: R$1.060,40)
  - **Cartão de crédito** → abre seletor de parcelas:
    - 1x de R$1.081,89 (à vista)
    - 2x de R$550,27
    - 3x de R$370,18
    - ...até Nx de R$X
    - Cada opção mostra: valor por parcela + total entre parênteses
    - Ex.: "6x de R$191,60 (total R$1.149,62)"
- O valor exibido em CADA opção já inclui TODAS as taxas (Renovi + gateway + antecipação)
- O cliente NUNCA vê o breakdown das taxas — apenas o total e o valor por parcela
- Aviso: "Esta proposta está reservada por 28 min."

**Dados das opções:** Vindos de `get_client_proposal_pricing(proposal_id)` que retorna `payment_options[]`.

**6. CTA:** "Pagar com PIX" / "Pagar com Cartão" + estado de carregamento

> // ADDED: Regra de UX — Resumo de valores na tela
> **Na tela de orçamento (ANTES de clicar "Quero contratar"):**
> - Mostrar: Valor do serviço + Taxa Renovi (5%) = Total base
> - NÃO mostrar: taxas de cartão, opções de parcelamento
>
> **Na tela de checkout (APÓS clicar "Quero contratar"):**
> - Mostrar: opções de pagamento com valores finais por método
> - PIX: valor total (com taxa gateway Pix embutida)
> - Cartão: lista de parcelas com valores finais (todas as taxas embutidas)
> - O total varia por método/parcelas — isso é esperado e correto

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

---

## 11. FLUXO PIX

### 11.1 Criação da Cobrança Pix

Chamado pela Edge Function `create-asaas-charge` após o cliente selecionar PIX na tela de checkout:

```
POST /v3/payments
{
  "customer": "<asaas_customer_id>",
  "billingType": "PIX",
  "value": <service_payments.client_charge_amount>,
  "dueDate": "<hoje + 1 dia>",
  "externalReference": "<service_payments.id>",
  "split": [{ "walletId": "...", "fixedValue": <service_payments.provider_net_amount> }]
}
```

### 11.2 Expiração do QR Pix

O QR code dinâmico do Asaas é válido por **12 meses a partir do `dueDate`**. Não por 60 minutos.

Isso significa:
- O `checkout_locked_until` deve ser estendido para `asaas_pix_expiration_date` após criar o QR
- O cliente pode pagar o mesmo QR code por até 12 meses
- A expiração relevante do ponto de vista do **checkout** é a expiração interna (`checkout_expires_at`), não a do QR

### 11.3 Falha de Pagamento Pix

Se `PAYMENT_OVERDUE` (Pix não pago até o `dueDate`):
```
→ service_payments.status = 'expired'
→ proposal.status = 'submitted' (se ainda dentro de 48h) ou 'expired'
→ proposal.checkout_locked_until = NULL
→ proposal.locked_payment_id = NULL
→ service_requests.status = 'open'
→ INSERT service_payment_events
```

O cliente volta para a tela de orçamentos. A proposta fica disponível para nova tentativa de checkout (se ainda dentro de 48h).

---

## 12. FLUXO CARTÃO DE CRÉDITO (INCLUI PARCELAMENTO)

### 12.1 Tokenização (PCI-DSS)

**A plataforma NUNCA deve tocar em dados brutos de cartão.**

Usar tokenização do Asaas:
1. Frontend coleta dados do cartão via `Asaas.js` ou form nativo
2. Frontend tokeniza via `POST /v3/credit-card/tokenize`
3. Backend recebe apenas o token, sem PAN
4. Backend cria cobrança com token

```
── Cartão 1x (à vista) ──────────────────────────────────────────────
POST /v3/payments
{
  billingType: "CREDIT_CARD",
  customer, value: <client_charge_amount>, dueDate, externalReference, split,
  creditCard: { /* tokenizado */ },
  creditCardHolderInfo: { name, email, cpfCnpj, postalCode, phone }
}

── Cartão Parcelado (2x+) ── // ADDED ────────────────────────────────
POST /v3/payments
{
  billingType: "CREDIT_CARD",
  customer,
  totalValue: <client_charge_amount>,      // ATENÇÃO: usar totalValue, não value
  installmentCount: <installment_count>,   // do snapshot
  installmentValue: <installment_value>,   // do snapshot
  dueDate, externalReference, split,
  creditCard: { /* tokenizado */ },
  creditCardHolderInfo: { name, email, cpfCnpj, postalCode, phone }
}
```

> // ADDED: Regras de parcelamento
> - Para 1x: usar campo `value`. Campos `installmentCount`/`installmentValue`/`totalValue` NÃO devem estar presentes.
> - Para 2x+: usar `totalValue` + `installmentCount` + `installmentValue`. Campo `value` NÃO deve estar presente.
> - O `installmentValue` e `installmentCount` vêm do snapshot congelado em `service_payments` — NUNCA recalcular no momento da criação da cobrança.
> - A API Asaas retorna o ID do plano de parcelamento (`installment`) na resposta. Armazenar em `service_payments.asaas_installment_id` para consultas futuras.
> - Consultar parcelas individuais: `GET /v3/installments/{installment_id}/payments`

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

### 16.1 Escopo da Assinatura

A `pricing_signature` em `provider_proposals` cobre **exclusivamente** os 4 campos de precificação do prestador:

```
proposed_amount | tax_rate | tax_amount | final_amount
```

**Por que apenas 4 campos?**

A assinatura protege a integridade do combinado financeiro entre prestador e plataforma: o prestador submete uma proposta, a plataforma calcula os valores do prestador e os assina. Esta assinatura garante que, no momento do checkout, o `provider_net_amount` que será enviado ao Asaas via split é exatamente o que estava na proposta original — nenhum ator consegue alterar os valores do prestador sem invalidar a assinatura.

O preço do cliente é calculado *depois*, com base em `platform_constants.renovi_tax_client` vigente no momento do checkout. Ele não pode ser "forjado" via assinatura falsa porque é calculado pelo backend (nunca pelo cliente), diretamente de uma tabela interna. Sua auditabilidade vem do snapshot em `service_payments` (que registra `client_fee_rate` e o timestamp do checkout), não de uma assinatura na proposta.

### 16.2 Função de Assinatura (sem alteração de V1)

A função `generate_provider_pricing_signature` existente já cobre os 4 campos corretos. **Não precisa ser alterada.** O que muda é que deixamos de considerar a ideia de extendê-la para 7 campos:

```sql
-- Função existente — NÃO alterar
-- Cobre: proposed_amount | tax_rate | tax_amount | final_amount
-- Isso é suficiente e correto. Não adicionar campos do cliente aqui.
```

### 16.3 Validação no Checkout

```sql
-- Dentro de initiate_checkout():
-- 1. Verificar integridade do lado do prestador
SELECT generate_provider_pricing_signature(
  pp.proposed_amount, pp.tax_rate, pp.tax_amount, pp.final_amount
) AS expected_sig
FROM provider_proposals pp WHERE pp.id = $proposal_id;

IF expected_sig <> pp.pricing_signature THEN
  RAISE EXCEPTION 'Falha na verificação de integridade da precificação do prestador';
END IF;

-- 2. Calcular preço do cliente (domínio separado, não assinado na proposta)
SELECT * INTO v_client_pricing
FROM _calculate_client_pricing(pp.proposed_amount, $billing_type);
-- v_client_pricing.client_fee_rate, .client_fee_amount, .client_charge_amount
-- Estes valores são congelados em service_payments — nunca ficam em provider_proposals
```

### 16.4 Cadeia de Integridade

```
provider_proposals.pricing_signature
    ↓ validado em initiate_checkout
    ↓ provider_net_amount (final_amount) é confiável
    ↓ copiado em
service_payments.proposal_pricing_signature  (imutável — prova do que estava na proposta)
service_payments.provider_net_amount         → split_fixed_value → enviado ao Asaas

platform_constants.renovi_tax_client (taxa vigente no momento do checkout)
    ↓ calculado por _calculate_client_pricing(proposed_amount)
    ↓ congelado em
service_payments.client_fee_rate             (rastreabilidade da taxa aplicada)
service_payments.client_charge_amount        → value enviado ao Asaas
```

Auditoria de qualquer transação:
- **Provider side:** verificar `service_payments.proposal_pricing_signature` contra proposta original
- **Client side:** verificar `service_payments.client_fee_rate` × `proposed_amount` = `client_fee_amount`; confirmar que `client_fee_rate` era a taxa vigente em `platform_constants` no `checkout_initiated_at`

### 16.5 Imutabilidade do Snapshot

O snapshot em `service_payments` é **imutável** após o INSERT. Adicionar trigger:

```sql
CREATE OR REPLACE FUNCTION prevent_financial_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Campos do snapshot financeiro jamais podem ser alterados após criação
  IF (
    NEW.proposed_amount             IS DISTINCT FROM OLD.proposed_amount            OR
    NEW.provider_fee_rate           IS DISTINCT FROM OLD.provider_fee_rate          OR
    NEW.provider_fee_amount         IS DISTINCT FROM OLD.provider_fee_amount        OR
    NEW.provider_net_amount         IS DISTINCT FROM OLD.provider_net_amount        OR
    NEW.client_fee_rate             IS DISTINCT FROM OLD.client_fee_rate            OR
    NEW.client_fee_amount           IS DISTINCT FROM OLD.client_fee_amount          OR
    NEW.client_charge_amount        IS DISTINCT FROM OLD.client_charge_amount       OR
    NEW.split_fixed_value           IS DISTINCT FROM OLD.split_fixed_value          OR
    NEW.proposal_pricing_signature  IS DISTINCT FROM OLD.proposal_pricing_signature OR
    -- // ADDED: campos de parcelamento e taxas de gateway também são imutáveis
    NEW.installment_count           IS DISTINCT FROM OLD.installment_count          OR
    NEW.installment_value           IS DISTINCT FROM OLD.installment_value          OR
    NEW.gateway_fee_percent         IS DISTINCT FROM OLD.gateway_fee_percent        OR
    NEW.gateway_fee_amount          IS DISTINCT FROM OLD.gateway_fee_amount         OR
    NEW.gateway_fixed_fee           IS DISTINCT FROM OLD.gateway_fixed_fee          OR
    NEW.anticipation_fee_percent    IS DISTINCT FROM OLD.anticipation_fee_percent   OR
    NEW.anticipation_fee_amount     IS DISTINCT FROM OLD.anticipation_fee_amount    OR
    NEW.total_gateway_cost          IS DISTINCT FROM OLD.total_gateway_cost
  ) THEN
    RAISE EXCEPTION 'Snapshot financeiro de service_payments é imutável';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_payments_immutable_snapshot
  BEFORE UPDATE ON public.service_payments
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_snapshot_mutation();
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
- `client_charge_amount` ✓ — o único número financeiro que o cliente vê
- `billing_type` ✓
- `status` ✓
- `checkout_expires_at` ✓
- `asaas_pix_qr_code`, `asaas_pix_qr_code_image` ✓

**NUNCA retornar** ao cliente: `provider_fee_rate`, `provider_fee_amount`, `provider_net_amount`, `platform_total_fee_amount`, `client_fee_rate`, `client_fee_amount`.

Esta regra aplica tanto a queries diretas em `service_payments` quanto à RPC `get_client_proposal_pricing` (que retorna somente `client_charge_amount`).

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
| Cliente inicia checkout | service_payments | — | created (INSERT) | Snapshot financeiro congelado (inclui client pricing calculado) |
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

### 23.12 Mudança de `renovi_tax_client` com Checkouts Ativos
- Checkouts em andamento não são afetados: seu `client_charge_amount` já está congelado em `service_payments`
- Apenas novos checkouts iniciados após a mudança usarão a nova taxa
- A taxa aplicada a cada transação é sempre auditável via `service_payments.client_fee_rate`

// ADDED: Edge cases de parcelamento e taxas de gateway

### 23.13 Mudança de Taxas Asaas (gateway/antecipação)
- As taxas Asaas podem mudar (ex.: fim do período promocional de 3 meses)
- Checkouts em andamento NÃO são afetados — todas as taxas estão congeladas no snapshot (`gateway_fee_percent`, `anticipation_fee_percent`)
- Para atualizar: modificar os valores em `platform_constants` (ex.: `card_processing_fee_1x_percent`)
- Criar alerta para datas de mudança de taxa conhecidas (ex.: fim da promoção Asaas)

### 23.14 Recálculo de Parcelas (Troca de Método de Pagamento no Checkout)
- Se o cliente seleciona "6x Cartão", o `initiate_checkout` congela o snapshot com 6 parcelas
- Se o cliente quer trocar para PIX ou para 12x: **deve iniciar um novo checkout**
- O checkout anterior expira naturalmente (ou é cancelado), e o novo `initiate_checkout` cria um novo snapshot
- Isso garante que o snapshot é SEMPRE consistente com o método/parcelas efetivamente escolhidos
- **Alternativa mais fluida:** O `initiate_checkout` pode aceitar o `billing_type` e `installment_count` como parâmetros, e o snapshot é criado apenas quando o cliente confirma a opção. Neste caso, a tela de checkout exibe as opções (via `get_client_proposal_pricing`) ANTES do lock, e o lock + snapshot acontecem no momento do "Pagar"

### 23.15 Pagamento Parcial de Parcelamento (Parcela Individual Falha)
- Se uma parcela intermediária falha (ex.: cartão vencido na parcela 4 de 12):
  - Asaas envia webhook `PAYMENT_OVERDUE` para a parcela individual
  - A cobrança do parcelamento como um todo NÃO é cancelada automaticamente
  - Asaas pode enviar `PAYMENT_DUNNING_REQUESTED` para tentativa de cobrança
  - Ação Renovi: alertar admin; NÃO cancelar o serviço automaticamente (parcelas anteriores já foram pagas)
  - Escrow: manter bloqueado até resolução
  - Ação futura: definir política de tolerância a parcelas inadimplentes

### 23.16 Arredondamento em Parcelas
- `client_charge_amount / installment_count` pode não dar divisão exata
- Regra: arredondar cada parcela para baixo (2 casas decimais)
- Diferença é adicionada à ÚLTIMA parcela
- Ex.: R$1.149,62 / 6 = R$191,60 × 5 + R$191,62 × 1
- Usar `totalValue` no Asaas (não `installmentValue`) para que o Asaas faça este ajuste automaticamente

### 23.17 Pagamento Expirado com Parcelas
- Se o checkout expira antes do pagamento: todas as parcelas são canceladas
- Proposta volta a `submitted`, SR volta a `open`
- Comportamento idêntico ao checkout 1x — sem tratamento especial

---

## 24. FASES DE IMPLEMENTAÇÃO

### Fase 1 — Fundação do Schema

**Escopo:**
- Migration: ALTER provider_proposals (+`checkout_locked_until`, +`locked_payment_id`, expandir status CHECK para 7 valores)
- Migration: ALTER service_requests (novos status)
- Migration: ALTER profiles (+`asaas_customer_id`) e provider_profiles_private (+campos Asaas)
- Migration: CREATE `service_payments`
- Migration: CREATE `services`
- Migration: CREATE `service_payment_events`
- Migration: CREATE `service_payment_releases`
- Migration: Novos platform_constants (`renovi_tax_client`, `checkout_lock_duration_minutes`, `escrow_days_to_expire`, `asaas_environment`)
- Migration: CREATE `_calculate_client_pricing(p_proposed_amount, p_payment_method)`
- Migration: CREATE `get_client_proposal_pricing(p_proposal_id, p_payment_method)`
- Migration: Trigger `prevent_financial_snapshot_mutation` em service_payments
- Atualizar `expire_stale_provider_proposals` para usar status `expired` e pular `payment_pending`
- Atualizar `list_client_received_budgets` para calcular e retornar `client_charge_amount` (via `renovi_tax_client` inline — não mais `proposed_amount`)
- **NÃO alterar** `calculate_provider_service_pricing`, `generate_provider_pricing_signature`, nem `validate_provider_proposal_pricing` — estes continuam cobrindo apenas os 4 campos do prestador, exatamente como hoje
- **NÃO fazer backfill** de campos de precificação do cliente em `provider_proposals` — eles não pertencem lá

**Risco principal:** Atualizar `list_client_received_budgets` para retornar `client_charge_amount` calculado dinamicamente, sem quebrar a interface existente do frontend.

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
- RPC `initiate_checkout`: lock atômico + cálculo de client pricing via `_calculate_client_pricing` + criação de service_payments com snapshot completo
- RPC `get_checkout_details`: dados da tela de pagamento (projeção segura — retorna `client_charge_amount` do snapshot)
- Edge Function `create-asaas-charge`: criação lazy de customer + cobrança Pix (usando `client_charge_amount` e `split_fixed_value` do snapshot) + QR code
- Tela frontend "Revisar e Pagar" (completa)
- Supabase Realtime subscription em service_payments
- Edge Function `asaas-webhook` (handler básico: PAYMENT_RECEIVED → fluxo completo de sucesso)
- Fluxo completo de sucesso: proposal accepted + SR in_progress + services criado + escrow guarantee ID coletado
- Cron `expire_stale_checkouts` (a cada 5 min)
- Cron `expire_stale_provider_proposals` atualizado

**Risco:** Webhook dev local requer ngrok. Testar Pix sandbox com `/receiveInCash`.

**Dependências:** Fases 1 + 2.

---

### Fase 4 — Pagamento com Cartão de Crédito (Inclui Parcelamento) // UPDATED

**Escopo:**
- Tokenização do cartão no frontend (Asaas.js ou endpoint de tokenização)
- Edge Function `create-asaas-charge` estendida para CREDIT_CARD (1x e parcelado)
- `_calculate_client_pricing` com cálculo completo de taxas de gateway + antecipação por faixa de parcelas
- `get_client_proposal_pricing` retornando `payment_options[]` com todas as opções de parcelamento
- Seletor de parcelas no frontend (tela de checkout)
- `initiate_checkout` recebendo `p_installment_count` e congelando snapshot com parcelas
- Payload Asaas: `totalValue` + `installmentCount` + `installmentValue` para 2x+
- Endpoint de simulação `POST /v3/payments/simulate` para validação pré-criação
- Webhook handlers: PAYMENT_AWAITING_RISK_ANALYSIS, PAYMENT_APPROVED_BY_RISK_ANALYSIS, PAYMENT_REPROVED_BY_RISK_ANALYSIS, PAYMENT_CREDIT_CARD_CAPTURE_REFUSED
- UI states: análise de risco, recusado, captura recusada, seletor de parcelas
- Fluxo de retry (recusado → trocar para Pix ou tentar outro cartão)

**Risco:** Conformidade PCI — nunca tocar no PAN; usar tokenização. Split em parcelamento — testar no sandbox para validar distribuição proporcional.

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
- Relatório diário de inconsistências

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
  "client_fee_rate_applied": 0.05,
  "escrow_status": "blocked",
  "processing_duration_ms": 45,
  "result": "success | duplicate | error"
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

-- Auditoria de taxas aplicadas (verificar consistência)
SELECT
  sp.id,
  sp.checkout_initiated_at,
  sp.client_fee_rate,
  sp.proposed_amount,
  sp.client_fee_amount,
  sp.client_charge_amount,
  round(sp.proposed_amount * sp.client_fee_rate, 2) AS expected_fee_amount
FROM service_payments sp
WHERE round(sp.proposed_amount * sp.client_fee_rate, 2) <> sp.client_fee_amount;
-- Deve retornar 0 linhas; qualquer resultado indica inconsistência no snapshot
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
| `renovi_tax_client` alterado enquanto `get_client_proposal_pricing` é chamada e `initiate_checkout` usa outro valor | Baixa | Ambos usam `_calculate_client_pricing` (mesma fonte); risco real apenas se alterado *durante* a transação de checkout — janela de microsegundos |
| `client_fee_rate` não confirmada pelo produto | Média | Aguardar confirmação antes da Fase 1 |
| Emails/SMS reais disparados no sandbox | Média | Não usar emails/telefones reais de terceiros no sandbox |
| Custo de escrow (R$9,90/prestador/mês) | Média | Considerar no modelo financeiro; pode ser repassado ao prestador |

### 26.2 Questões Resolvidas e Abertas

// UPDATED: Questões 1-3 e 5 resolvidas; novas questões adicionadas

**Resolvidas:**
1. ~~**Taxa do cliente:**~~ ✅ Confirmado: 5% (`renovi_tax_client`).
2. ~~**Quem paga o escrow:**~~ ✅ Plataforma (Renovi) paga R$9,90/mês por prestador. `isFeePayer: false`.
3. ~~**`daysToExpire` do escrow:**~~ ✅ 45 dias (máximo suportado pelo Asaas).
5. ~~**Cartão parcelado:**~~ ✅ Suportado desde V1. PIX + Cartão 1x + Cartão parcelado (até 12x). Cliente paga todas as taxas.

**Ainda abertas:**
4. **Política de cancelamento pós-service:** Após `services` criado, sob quais condições o cliente pode cancelar e receber estorno?
6. **Aprovação da subconta Asaas:** O fluxo de aprovação pode demorar. O que mostrar ao prestador enquanto aguarda?
7. **Verificar IPs oficiais do Asaas:** Configurar allowlist em Supabase para aceitar webhooks apenas de IPs Asaas.

// ADDED: Novas questões de parcelamento
8. **Taxas Asaas promocionais vs padrão:** Nos primeiros 3 meses, as taxas de cartão são menores (ex.: 1,99% vs 2,99% para 1x). Os valores em `platform_constants` devem ser atualizados após o período promocional. Criar alerta/reminder para atualização.
9. **Split em parcelamento:** Verificar comportamento exato do split quando a cobrança é parcelada — se o `fixedValue` é dividido entre parcelas ou aplicado ao total. Testar no sandbox antes de V1.
10. **Antecipação automática vs manual:** Definir se a Renovi vai usar antecipação automática de recebíveis no Asaas ou se vai aguardar o recebimento natural de cada parcela. Impacta o cálculo da taxa de antecipação cobrada do cliente.
11. **Valor mínimo por parcela:** Definir valor mínimo por parcela (ex.: R$20,00) para evitar parcelas muito pequenas. Implementar como `min_installment_value` em `platform_constants`.

---

## 27. RECOMENDAÇÕES ANTES DE CODIFICAR

1. **Confirmar a taxa do cliente** (5%?) com o produto. É o valor de `renovi_tax_client` em `platform_constants`. Toda precificação do cliente deriva desta constante.

2. **Testar o fluxo Pix completo no sandbox antes da Fase 3:**
   Criar conta sandbox → gerar API key → registrar chave Pix → criar customer → criar cobrança Pix → obter QR code → simular com `/receiveInCash` → verificar webhook.

3. **Proteger a `asaas_account_api_key`:** Criptografar com pgcrypto ou armazenar no Vault do Supabase. Nunca expor via RLS.

4. **Não há backfill de campos de cliente em `provider_proposals`:** A Fase 1 não exige migration de dados em propostas existentes para campos de precificação do cliente — porque estes campos não existem mais nessa tabela. Propostas existentes continuam válidas sem alteração.

5. **Configurar ngrok imediatamente** para desenvolvimento de webhooks local. Sem isso, o ciclo de teste da Fase 3 é muito lento.

6. **Testar o lock de concorrência:** Escrever um teste que dispara dois checkouts simultâneos para a mesma proposta e verifica que apenas um retorna sucesso.

7. **Verificar IPs oficiais do Asaas** e configurar no Supabase para aceitar requisições de webhook apenas desses IPs.

8. **Sempre retornar 200 ao Asaas** — mesmo em erros de processamento. Nunca retornar 5xx (pausa a fila).

9. **Usar `externalReference = service_payments.id`** em todas as cobranças Asaas. É o fallback de lookup quando `asaas_payment_id` não bate.

10. **Não usar dados reais de terceiros no sandbox** — notificações são enviadas de verdade.

11. **`_calculate_client_pricing` é a única implementação do cálculo do cliente:** Nunca duplicar a fórmula. Toda lógica de precificação do cliente passa por essa função interna. Se a fórmula mudar, muda em um único lugar.

---

## APÊNDICE A — Schema Resumido Antes/Depois

| Tabela | Antes | Depois |
|--------|-------|--------|
| `provider_proposals` | 4 status, 9 campos principais | 7 status, +2 campos de lock (`checkout_locked_until`, `locked_payment_id`); sem campos de precificação do cliente |
| `service_requests` | 4 status | 6 status |
| `profiles` | sem Asaas | +`asaas_customer_id` |
| `provider_profiles_private` | dados legais apenas | +`asaas_wallet_id`, `asaas_subaccount_id`, `asaas_account_api_key`, `asaas_onboarding_status` |
| `services` | não existe | NOVA (operacional) |
| `service_payments` | não existe | NOVA (financeira + escrow; contém snapshot de ambos os lados de precificação + taxas de gateway + parcelamento, congelado no checkout) |
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

## APÊNDICE C — Funções SQL do Modelo de Precificação

| Função | Tipo | Responsabilidade |
|--------|------|-----------------|
| `calculate_provider_service_pricing` | existente, sem alteração | Calcula provider_fee, tax_amount, final_amount ao criar proposta |
| `generate_provider_pricing_signature` | existente, sem alteração | HMAC-SHA256 dos 4 campos do prestador |
| `validate_provider_proposal_pricing` | existente, sem alteração | Trigger de validação na INSERT/UPDATE de provider_proposals |
| `_calculate_client_pricing(proposed_amount, payment_method, installment_count)` | NOVA, interna | // UPDATED: Única implementação do cálculo do lado do cliente; inclui taxas de gateway, antecipação e parcelamento; usada por get_client_proposal_pricing e initiate_checkout |
| `get_client_proposal_pricing(proposal_id, payment_method)` | NOVA, pública | // UPDATED: RPC chamada pelo frontend; retorna `payment_options[]` com todas as opções de parcelamento (PIX + Cartão 1x-12x) — nunca o breakdown de taxas |
| `prevent_financial_snapshot_mutation` | NOVA, trigger | Impede alteração de qualquer campo do snapshot em service_payments |
