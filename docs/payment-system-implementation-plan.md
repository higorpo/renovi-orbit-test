# Renovi — Plano de Implementação: Sistema de Pagamentos
## Referência: payment-system-plan.md v4.0
### Última atualização: 2026-03-26

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Premissas e Decisões Confirmadas](#2-premissas-e-decisões-confirmadas)
3. [Mapa de Dependências entre Fases](#3-mapa-de-dependências-entre-fases)
4. [Fase 1 — Fundação do Schema](#fase-1--fundação-do-schema)
5. [Fase 2 — Onboarding Financeiro do Prestador](#fase-2--onboarding-financeiro-do-prestador)
6. [Fase 3 — Checkout e Pagamento Pix](#fase-3--checkout-e-pagamento-pix)
7. [Fase 4 — Pagamento com Cartão de Crédito](#fase-4--pagamento-com-cartão-de-crédito)
8. [Fase 5 — Fluxo do Serviço e Liberação do Escrow](#fase-5--fluxo-do-serviço-e-liberação-do-escrow)
9. [Fase 6 — Cobertura Completa de Webhooks e Resiliência](#fase-6--cobertura-completa-de-webhooks-e-resiliência)
10. [Pontos Críticos e Riscos Transversais](#pontos-críticos-e-riscos-transversais)
11. [Preparação para Evolução Futura](#preparação-para-evolução-futura)
12. [Checklist de Setup de Ambiente](#checklist-de-setup-de-ambiente)

---

## 1. Visão Geral

### Sistema
Integração de pagamentos da plataforma Renovi usando Asaas como processador. O modelo central é **aprovação de orçamento bloqueada por pagamento com escrow**: o cliente paga antes da proposta ser aceita, e os fundos ficam retidos até a confirmação do serviço pelo cliente.

### Objetivo da implementação
Transformar o fluxo atual — onde a proposta é aceita diretamente pelo cliente sem pagamento — em um fluxo completo de checkout com Pix, cartão de crédito, split automático, escrow e liberação condicional dos fundos ao prestador.

### Stack envolvida
- **Database:** Supabase Postgres com RLS, migrations SQL, pg_cron
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Frontend:** React/TypeScript + Vite
- **Pagamentos:** Asaas (subaccounts, cobrança, split, escrow, webhooks)

### Escopo das 6 fases

| Fase | Entregável Principal | Pré-requisito |
|------|---------------------|---------------|
| 1 | Schema completo + funções de precificação | Nenhum |
| 2 | Onboarding financeiro do prestador + subaccount Asaas | Fase 1 |
| 3 | Checkout funcional com Pix end-to-end | Fases 1 + 2 |
| 4 | Pagamento com cartão de crédito (1x + parcelado até 12x) | Fase 3 |
| 5 | Acompanhamento do serviço + release do escrow | Fases 3 + 4 |
| 6 | Cobertura total de webhooks + resiliência operacional | Fases 3 + 4 + 5 |

---

## 2. Premissas e Decisões Confirmadas

As decisões abaixo foram definidas na arquitetura. Antes de iniciar qualquer fase, confirme os itens marcados como **PENDENTE**:

| # | Decisão | Status |
|---|---------|--------|
| D1 | Split por valor fixo (`fixedValue`), não percentual | Confirmado |
| D2 | Escrow ativo desde V1; configurado no subaccount do prestador | Confirmado |
| D3 | `client_charge_amount` calculado sob demanda, nunca armazenado em `provider_proposals` | Confirmado |
| D4 | `pricing_signature` cobre apenas os 4 campos do prestador (sem alteração) | Confirmado |
| D5 | Pix com QR válido por 12 meses a partir do `dueDate` | Confirmado |
| D6 | Idempotência via `UNIQUE(asaas_event_id)` nos eventos e `UNIQUE(proposal_id)` nos services | Confirmado |
| D7 | Webhook sempre retorna 200 ao Asaas; erros são logados internamente | Confirmado |
| D8 | `renovi_tax_client` = 5% | **Confirmado** — taxa de 5% aplicada sobre o `proposed_amount` |
| D9 | `isFeePayer`: plataforma paga os R$9,90/mês do escrow | **Confirmado** — `isFeePayer: false`; Renovi absorve como custo operacional |
| D10 | `daysToExpire` = 45 dias (máximo Asaas) para liberação automática do escrow | **Confirmado** — máximo suportado pela API Asaas |
| D11 | Cartão parcelado: suportado desde V1 (PIX + Cartão 1x + Cartão parcelado até 12x) | **Confirmado** — cliente paga TODAS as taxas financeiras (gateway + antecipação) |
| D12 | Cliente paga TODAS as taxas financeiras (Renovi + gateway + antecipação) | **Confirmado** — pipeline completo em `_calculate_client_pricing` |
| D13 | Taxas de gateway configuráveis via `platform_constants` (nunca hardcoded) | **Confirmado** — fallback com exceção se chave ausente |

> ✅ Todas as decisões confirmadas. A Fase 1 pode ser iniciada.

---

## 3. Mapa de Dependências entre Fases

```
FASE 1 (Schema)
    ├── Tarefa 1.1  platform_constants
    ├── Tarefa 1.2  ALTER provider_proposals
    ├── Tarefa 1.3  triggers atualizados (provider_proposals)
    ├── Tarefa 1.4  ALTER service_requests
    ├── Tarefa 1.5  ALTER profiles
    ├── Tarefa 1.6  ALTER provider_profiles_private
    ├── Tarefa 1.7  CREATE services
    ├── Tarefa 1.8  CREATE service_payments
    │       └── Tarefa 1.9  trigger imutabilidade snapshot
    ├── Tarefa 1.10 CREATE service_payment_events
    ├── Tarefa 1.11 CREATE service_payment_releases
    ├── Tarefa 1.12 CREATE _calculate_client_pricing
    │       └── Tarefa 1.13 CREATE get_client_proposal_pricing
    └── Tarefa 1.14 ATUALIZAR list_client_received_budgets
                        ↓
FASE 2 (Onboarding)
    ├── Tarefa 2.1  Edge Function create-provider-subaccount
    └── Tarefa 2.2  Frontend onboarding financeiro
                        ↓
FASE 3 (Checkout + Pix)
    ├── Tarefa 3.1  RPC initiate_checkout
    ├── Tarefa 3.2  RPC get_checkout_details
    ├── Tarefa 3.3  Edge Function create-asaas-charge (Pix)
    ├── Tarefa 3.4  Edge Function asaas-webhook (handler básico)
    ├── Tarefa 3.5  Cron expire_stale_checkouts
    ├── Tarefa 3.6  RLS: service_payments, services, events
    ├── Tarefa 3.7  Frontend tela checkout
    └── Tarefa 3.8  Teste end-to-end Pix sandbox
                ↓               ↓
FASE 4 (Cartão+Parcelamento)  FASE 5 (Serviço + Escrow)
    ├── 4.1 tokenização FE       ├── 5.1 Frontend tela servico
    ├── 4.2 extend               ├── 5.2 completed/confirmed actions
    │   create-asaas-charge      ├── 5.3 Edge Function release-escrow
    │   (1x + parcelado)         └── 5.4 Cron monitor escrow bloqueado
    ├── 4.3 webhook handlers
    └── 4.4 UI estados + seletor parcelas
                        ↓
FASE 6 (Webhooks + Resiliência)
    ├── 6.1 handlers overdue/deleted/refunded
    ├── 6.2 handlers chargeback
    ├── 6.3 handler split divergence
    ├── 6.4 sistema de alertas admin
    ├── 6.5 ferramenta reprocessamento manual
    └── 6.6 monitoramento saúde webhook queue
```

---

## Fase 1 — Fundação do Schema

**Objetivo:** Criar toda a estrutura de banco de dados necessária para as fases seguintes. Nenhuma lógica de negócio visível ao usuário é entregue nesta fase — apenas o alicerce.

**Formato de migration:** Todos os arquivos de migration devem seguir o padrão `YYYYMMDDHHMMSS_descricao.sql`. Os timestamps sugeridos abaixo são sequenciais e começam após a última migration existente (`20260323120000`).

> **Estratégia de deploy:** Todas as tarefas 1.1 a 1.14 podem ir em uma única migration grande ou em migrations separadas por domínio. Recomendado: uma migration por grupo lógico (tabelas novas, alterações de tabelas existentes, funções), para facilitar rollback granular.

---

### Tarefa 1.1 — Inserir novos `platform_constants`

**Arquivo:** `supabase/migrations/20260325100000_payment_platform_constants.sql`

**O que fazer:**
Inserir as 4 novas constantes de configuração do sistema de pagamentos na tabela `platform_constants` existente.

**SQL:**
```sql
-- // UPDATED: valores confirmados + novas constantes de taxas de gateway e parcelamento
INSERT INTO public.platform_constants (key, value) VALUES
  ('renovi_tax_client',                     '0.05'),       -- ✅ Confirmado (D8): 5%
  ('checkout_lock_duration_minutes',        '30'),
  ('escrow_days_to_expire',                 '45'),         -- ✅ Confirmado (D10): máximo suportado pelo Asaas
  ('asaas_environment',                     '"sandbox"'),
  -- // ADDED: Taxas de gateway (fonte: https://www.asaas.com/precos-e-taxas — taxas padrão pós-promocional)
  ('card_processing_fee_1x_percent',        '0.0299'),     -- 2,99% cartão à vista
  ('card_processing_fee_2_6x_percent',      '0.0349'),     -- 3,49% cartão 2-6x
  ('card_processing_fee_7_12x_percent',     '0.0399'),     -- 3,99% cartão 7-12x
  ('card_processing_fee_13_21x_percent',    '0.0429'),     -- 4,29% cartão 13-21x (Visa/Master apenas)
  ('card_fixed_fee_per_transaction',        '0.49'),       -- R$0,49 por transação
  ('anticipation_fee_per_month_percent',    '0.0170'),     -- 1,70%/mês antecipação parcelado
  ('anticipation_fee_cash_percent',         '0.0125'),     -- 1,25%/mês antecipação à vista
  ('max_installments',                      '12'),         -- Máximo de parcelas (conservador; Visa/Master suporta 21)
  ('pix_processing_fee_percent',            '0.0099'),     -- 0,99% Pix
  ('pix_fixed_fee_per_transaction',         '0.00')        -- R$0,00 taxa fixa Pix
ON CONFLICT (key) DO NOTHING;
```

**Resultado esperado:** 14 linhas inseridas em `platform_constants`.

**Validação:**
```sql
SELECT key, value FROM platform_constants
WHERE key LIKE 'renovi_%' OR key LIKE 'checkout_%' OR key LIKE 'escrow_%'
   OR key LIKE 'asaas_%' OR key LIKE 'card_%' OR key LIKE 'anticipation_%'
   OR key LIKE 'pix_%' OR key = 'max_installments';
-- Deve retornar 14 linhas
```

**Dependências:** Nenhuma.
**Impacto:** Somente database. Nenhuma alteração de código necessária neste ponto.

**Ponto crítico:** `renovi_tax_client` é a base da taxa Renovi do cliente. As constantes de gateway (`card_processing_fee_*`, `anticipation_fee_*`) são a base do cálculo de taxas financeiras. Se qualquer valor estiver errado, o `client_charge_amount` será incorreto.

**Atualização de taxas:** As taxas Asaas podem mudar (ex.: fim do período promocional de 3 meses). Para atualizar:
1. Alterar o `value` da constante via `UPDATE platform_constants SET value = '0.0199' WHERE key = 'card_processing_fee_1x_percent'`
2. Checkouts em andamento NÃO são afetados (snapshot congelado)
3. Apenas NOVOS checkouts usarão a nova taxa

**Fallback:** Se uma chave estiver ausente, `_calculate_client_pricing` lança exceção com nome da chave faltante. NUNCA usar valores default silenciosos.

---

### Tarefa 1.2 — ALTER `provider_proposals`: lock de checkout + status expandido

**Arquivo:** `supabase/migrations/20260325100100_alter_provider_proposals_payment.sql`

**O que fazer:**
1. Adicionar 2 colunas de lock de checkout
2. Substituir o CHECK constraint de status de 4 para 7 valores

**SQL:**
```sql
-- Adicionar colunas de lock
ALTER TABLE public.provider_proposals
  ADD COLUMN checkout_locked_until timestamptz,
  ADD COLUMN locked_payment_id     uuid;
-- Nota: locked_payment_id é UUID sem FK constraint (evita referência circular com service_payments)
-- A integridade é garantida pela lógica da RPC initiate_checkout

-- Índice para acelerar consultas de lock ativo
CREATE INDEX provider_proposals_checkout_lock_idx
  ON public.provider_proposals (checkout_locked_until)
  WHERE checkout_locked_until IS NOT NULL;

-- Expandir status CHECK
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

**Resultado esperado:**
- `provider_proposals` com 2 novas colunas nullable
- Constraint de status aceita os 7 valores

**Validação:**
```sql
-- Verificar colunas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'provider_proposals'
  AND column_name IN ('checkout_locked_until', 'locked_payment_id');

-- Verificar constraint
SELECT conname, consrc FROM pg_constraint
WHERE conrelid = 'public.provider_proposals'::regclass AND contype = 'c';
-- Deve mostrar a constraint com 7 valores
```

**Dependências:** Nenhuma.
**Impacto:** Database. Não quebra nenhum código existente (colunas nullable, status novos apenas adicionados).

---

### Tarefa 1.3 — Atualizar triggers de `provider_proposals`

**Arquivo:** `supabase/migrations/20260325100200_update_provider_proposals_triggers.sql`

**O que fazer:**
Atualizar 3 funções/triggers existentes para contemplar o novo status `payment_pending`:

**3a. Trigger `enforce_provider_proposal_client_response_deadline`**

Atualmente bloqueia `submitted → accepted` após 48h. Deve também bloquear `submitted → payment_pending` após 48h:

```sql
CREATE OR REPLACE FUNCTION public.enforce_provider_proposal_client_response_deadline()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Bloquear transições de decisão após expiração da janela de 48h
  IF OLD.status = 'submitted'
    AND NEW.status IN ('accepted', 'payment_pending')
    AND OLD.client_response_deadline_at IS NOT NULL
    AND OLD.client_response_deadline_at < now()
  THEN
    RAISE EXCEPTION 'Janela de resposta expirada para esta proposta';
  END IF;
  RETURN NEW;
END;
$$;
-- O trigger já existe; apenas a função foi substituída.
```

**3b. Trigger `sync_provider_proposal_client_response_deadline`**

Deve também limpar `client_response_deadline_at` quando status muda para `payment_pending`:

```sql
CREATE OR REPLACE FUNCTION public.sync_provider_proposal_client_response_deadline()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Limpar prazo quando proposta sai do estado "aguardando decisão"
  IF NEW.status IN ('accepted', 'rejected', 'withdrawn', 'payment_pending',
                    'closed_due_to_other_selection', 'expired') THEN
    NEW.client_response_deadline_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

**3c. Função `expire_stale_provider_proposals` (pg_cron)**

Deve usar status `expired` (não `rejected`) e pular propostas em `payment_pending`:

```sql
CREATE OR REPLACE FUNCTION public.expire_stale_provider_proposals()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.provider_proposals
  SET status = 'expired'
  WHERE status = 'submitted'                          -- apenas submitted
    AND status <> 'payment_pending'                   -- nunca expirar payment_pending
    AND client_response_deadline_at IS NOT NULL
    AND client_response_deadline_at < now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
```

**3d. Trigger `prevent_withdrawal_during_checkout` (NOVO)**

Impede que o prestador retire a proposta enquanto há checkout ativo:

```sql
CREATE OR REPLACE FUNCTION public.prevent_withdrawal_during_checkout()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'payment_pending' AND NEW.status = 'withdrawn' THEN
    RAISE EXCEPTION 'Não é possível retirar uma proposta com pagamento pendente. Aguarde a expiração do checkout.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_proposals_prevent_withdrawal_during_checkout
  BEFORE UPDATE OF status ON public.provider_proposals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_withdrawal_during_checkout();
```

**Resultado esperado:** 4 funções atualizadas/criadas; comportamento dos triggers cobrindo o novo status.

**Validação manual:**
```sql
-- Tentar mudar status para payment_pending em proposta expirada deve falhar
-- Tentar retirar proposta em payment_pending deve falhar
```

**Dependências:** Tarefa 1.2 (novo status `payment_pending` no CHECK).
**Impacto:** Database. Sem impacto de breaking change no frontend (novas regras adicionam restrições que antes não existiam).

---

### Tarefa 1.4 — ALTER `service_requests`: expandir status

**Arquivo:** `supabase/migrations/20260325100300_alter_service_requests_status.sql`

**O que fazer:**
Adicionar `budget_selected_pending_payment` e `disputed` ao CHECK constraint de status.

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

**Resultado esperado:** Constraint aceita 6 valores.
**Dependências:** Nenhuma.
**Impacto:** Database apenas. Não quebra código existente.

---

### Tarefa 1.5 — ALTER `profiles`: campo Asaas

**Arquivo:** `supabase/migrations/20260325100400_alter_profiles_asaas.sql`

**O que fazer:**
Adicionar `asaas_customer_id` à tabela `profiles` para armazenar o ID do customer no Asaas (criado lazily no primeiro checkout).

```sql
ALTER TABLE public.profiles
  ADD COLUMN asaas_customer_id text;

CREATE UNIQUE INDEX profiles_asaas_customer_id_idx
  ON public.profiles (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;
```

**Validação:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'asaas_customer_id';
```

**Dependências:** Nenhuma.
**Impacto:** Database. Coluna nullable — nenhum dado existente quebra.

**RLS:** A coluna `asaas_customer_id` deve estar coberta pela policy existente de `profiles`. Verificar se a policy de SELECT inclui este campo apenas para o próprio usuário e para `service_role`. O cliente **não precisa** ler seu próprio `asaas_customer_id` via frontend — ele é lido apenas internamente pelas Edge Functions com `service_role`.

---

### Tarefa 1.6 — ALTER `provider_profiles_private`: campos Asaas

**Arquivo:** `supabase/migrations/20260325100500_alter_provider_profiles_private_asaas.sql`

**O que fazer:**
Adicionar 4 colunas para integração com subaccounts Asaas.

```sql
ALTER TABLE public.provider_profiles_private
  ADD COLUMN asaas_wallet_id         text,
  ADD COLUMN asaas_subaccount_id     text,
  ADD COLUMN asaas_account_api_key   text,
  ADD COLUMN asaas_onboarding_status text DEFAULT 'pending'
    CHECK (asaas_onboarding_status IN ('pending', 'active', 'suspended'));

CREATE UNIQUE INDEX ppp_asaas_wallet_id_idx
  ON public.provider_profiles_private (asaas_wallet_id)
  WHERE asaas_wallet_id IS NOT NULL;
```

**Resultado esperado:** 4 novas colunas. Todos os prestadores existentes ficam com `asaas_onboarding_status = 'pending'` por default.

**Ponto crítico de segurança:** `asaas_account_api_key` é a API key do subaccount Asaas do prestador. Ela concede controle total sobre o subaccount, incluindo criar cobranças e mover dinheiro. **Nunca deve aparecer em policies de SELECT para o prestador ou para o cliente.** Verificar que a RLS de `provider_profiles_private` não expõe esta coluna. Se a policy usa `SELECT *`, trocar para projeção explícita excluindo `asaas_account_api_key`.

**Dependências:** Nenhuma.
**Impacto:** Database. Nenhum dado existente quebra.

---

### Tarefa 1.7 — CREATE tabela `services`

**Arquivo:** `supabase/migrations/20260325100600_create_services_table.sql`

**O que fazer:**
Criar a tabela `services` — entidade operacional que representa um serviço ativo (criado apenas após pagamento confirmado).

> **Atenção:** já existe uma tabela `platform_services` (criada em `20260226100100_create_services.sql`) que é o catálogo de tipos de serviço. A tabela a ser criada aqui é diferente — é a entidade operacional de execução do serviço.

```sql
CREATE TABLE public.services (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  service_request_id   uuid NOT NULL REFERENCES public.service_requests(id)  ON DELETE RESTRICT,
  proposal_id          uuid NOT NULL REFERENCES public.provider_proposals(id) ON DELETE RESTRICT,
  provider_id          uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,
  client_id            uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,

  status               text NOT NULL DEFAULT 'awaiting_start'
    CHECK (status IN (
      'awaiting_start',
      'in_progress',
      'completed',
      'confirmed',
      'cancelled',
      'disputed'
    )),

  agreed_slot          jsonb,
  scheduled_start_at   timestamptz,
  scheduled_end_at     timestamptz,

  started_at           timestamptz,
  completed_at         timestamptz,
  confirmed_at         timestamptz,
  cancelled_at         timestamptz,
  cancellation_reason  text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- CRÍTICO: garante idempotência — apenas UM service por proposal, para sempre
CREATE UNIQUE INDEX services_proposal_id_unique ON public.services (proposal_id);

CREATE INDEX services_service_request_id_idx ON public.services (service_request_id);
CREATE INDEX services_provider_id_idx        ON public.services (provider_id);
CREATE INDEX services_client_id_idx          ON public.services (client_id);
CREATE INDEX services_status_idx             ON public.services (status);
```

**Resultado esperado:** Tabela `services` criada com 6 status, constraint de unicidade por proposal.

**RLS (definir nesta migration):**
```sql
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Cliente: lê apenas seus próprios serviços
CREATE POLICY services_client_select ON public.services
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Prestador: lê e atualiza status dos seus serviços
CREATE POLICY services_provider_select ON public.services
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid());

CREATE POLICY services_provider_update ON public.services
  FOR UPDATE TO authenticated
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

-- service_role: acesso total (webhooks, crons)
CREATE POLICY services_service_role ON public.services
  FOR ALL TO service_role USING (true);
```

**Dependências:** Tarefas 1.2 (provider_proposals com novos status), 1.4 (service_requests com novos status).

---

### Tarefa 1.8 — CREATE tabela `service_payments`

**Arquivo:** `supabase/migrations/20260325100700_create_service_payments_table.sql`

**O que fazer:**
Criar a tabela central financeira do sistema. Esta é a tabela mais complexa da implementação.

```sql
CREATE TABLE public.service_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos
  service_request_id          uuid NOT NULL REFERENCES public.service_requests(id)  ON DELETE RESTRICT,
  proposal_id                 uuid NOT NULL REFERENCES public.provider_proposals(id) ON DELETE RESTRICT,
  service_id                  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  client_id                   uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,
  provider_id                 uuid NOT NULL REFERENCES public.profiles(id)           ON DELETE RESTRICT,

  -- Status
  status                      text NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created', 'pending', 'awaiting_risk_analysis', 'confirmed', 'received',
      'failed', 'expired', 'refunded', 'partially_refunded', 'chargeback', 'cancelled'
    )),

  billing_type                text NOT NULL CHECK (billing_type IN ('PIX', 'CREDIT_CARD')),

  -- Snapshot financeiro — IMUTÁVEL após criação
  proposed_amount             numeric(10,2) NOT NULL,
  provider_fee_rate           numeric(6,4)  NOT NULL,
  provider_fee_amount         numeric(10,2) NOT NULL,
  provider_net_amount         numeric(10,2) NOT NULL,
  client_fee_rate             numeric(6,4)  NOT NULL,   -- taxa Renovi (5%)
  client_fee_amount           numeric(10,2) NOT NULL,   -- valor da taxa Renovi
  client_charge_amount        numeric(10,2) NOT NULL,   -- total cobrado (inclui TODAS as taxas)

  -- // ADDED: Snapshot de taxas de gateway e parcelamento (congelado no checkout)
  installment_count           integer       NOT NULL DEFAULT 1,    -- 1 = à vista; 2-12 = parcelado
  installment_value           numeric(10,2),                       -- valor de cada parcela (NULL se 1x)
  gateway_fee_percent         numeric(6,4)  NOT NULL DEFAULT 0,    -- taxa % do gateway aplicada
  gateway_fee_amount          numeric(10,2) NOT NULL DEFAULT 0,    -- valor absoluto da taxa do gateway
  gateway_fixed_fee           numeric(10,2) NOT NULL DEFAULT 0,    -- taxa fixa por transação
  anticipation_fee_percent    numeric(6,4)  NOT NULL DEFAULT 0,    -- taxa de antecipação (0 se PIX/1x)
  anticipation_fee_amount     numeric(10,2) NOT NULL DEFAULT 0,    -- valor absoluto da antecipação
  total_gateway_cost          numeric(10,2) NOT NULL DEFAULT 0,    -- soma: gateway + fixo + antecipação

  platform_total_fee_amount   numeric(10,2) NOT NULL,   -- receita Renovi: provider_fee + client_fee

  -- Liquidação
  asaas_net_value             numeric(10,2),
  refunded_amount             numeric(10,2) NOT NULL DEFAULT 0,

  -- Split
  split_wallet_id             text,
  split_fixed_value           numeric(10,2),
  split_snapshot              jsonb,

  -- Dados Asaas
  asaas_payment_id            text UNIQUE,
  asaas_customer_id           text,
  asaas_invoice_url           text,
  asaas_pix_qr_code           text,
  asaas_pix_qr_code_image     text,
  asaas_pix_expiration_date   timestamptz,
  asaas_installment_id        text,            -- // ADDED: ID do plano de parcelamento Asaas (null se 1x)
  asaas_due_date              date,
  asaas_paid_at               timestamptz,
  asaas_credit_date           date,
  asaas_last_status           text,
  asaas_failure_reason        text,

  -- Escrow
  asaas_escrow_guarantee_id   text,
  escrow_status               text DEFAULT 'not_applicable'
    CHECK (escrow_status IN ('not_applicable', 'blocked', 'released', 'cancelled')),
  escrow_release_triggered_at timestamptz,
  escrow_released_at          timestamptz,

  -- Integridade
  proposal_pricing_signature  text NOT NULL,

  -- Tempos
  checkout_initiated_at       timestamptz NOT NULL DEFAULT now(),
  checkout_expires_at         timestamptz NOT NULL,
  payment_confirmed_at        timestamptz,
  payment_received_at         timestamptz,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE UNIQUE INDEX sp_asaas_payment_id_idx   ON public.service_payments (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX sp_proposal_id_idx               ON public.service_payments (proposal_id);
CREATE INDEX sp_service_request_id_idx        ON public.service_payments (service_request_id);
CREATE INDEX sp_client_id_idx                 ON public.service_payments (client_id);
CREATE INDEX sp_provider_id_idx               ON public.service_payments (provider_id);
CREATE INDEX sp_status_idx                    ON public.service_payments (status);
CREATE INDEX sp_checkout_expires_idx          ON public.service_payments (checkout_expires_at)
  WHERE status IN ('created', 'pending');
CREATE INDEX sp_escrow_blocked_idx            ON public.service_payments (escrow_status)
  WHERE escrow_status = 'blocked';
```

**RLS:**
```sql
ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;

-- Cliente: lê apenas seus próprios pagamentos (projeção controlada via RPC, não via RLS direta)
CREATE POLICY sp_client_select ON public.service_payments
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Prestador: lê os pagamentos dos seus serviços
CREATE POLICY sp_provider_select ON public.service_payments
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid());

-- service_role: acesso total
CREATE POLICY sp_service_role ON public.service_payments
  FOR ALL TO service_role USING (true);
```

**Resultado esperado:** Tabela `service_payments` criada com todos os campos e índices.

**Dependências:** Tarefa 1.7 (FK para `services`).

---

### Tarefa 1.9 — Trigger de imutabilidade do snapshot financeiro

**Arquivo:** Pode ser incluído na migration 1.8 ou em arquivo separado `20260325100750_service_payments_immutable_trigger.sql`

**O que fazer:**
Criar trigger que impede qualquer atualização nos campos do snapshot financeiro após a criação do registro:

```sql
CREATE OR REPLACE FUNCTION public.prevent_financial_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
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
    RAISE EXCEPTION 'Os campos do snapshot financeiro de service_payments são imutáveis após criação. payment_id=%', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_payments_immutable_snapshot
  BEFORE UPDATE ON public.service_payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_snapshot_mutation();
```

**Resultado esperado:** Qualquer tentativa de atualizar os 9 campos do snapshot levanta exceção.

**Por que usar `IS DISTINCT FROM` em vez de `<>`:**
`IS DISTINCT FROM` trata NULL corretamente. `NULL <> NULL` retorna NULL (falso), o que poderia deixar um campo null ser modificado silenciosamente.

**Dependências:** Tarefa 1.8.

---

### Tarefa 1.10 — CREATE tabela `service_payment_events`

**Arquivo:** `supabase/migrations/20260325100800_create_service_payment_events_table.sql`

**O que fazer:**
Criar a tabela de log de eventos de pagamento — usada para auditoria completa e para garantir idempotência de processamento de webhooks.

```sql
CREATE TABLE public.service_payment_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  service_payment_id       uuid NOT NULL REFERENCES public.service_payments(id) ON DELETE CASCADE,
  event_source             text NOT NULL CHECK (event_source IN ('asaas_webhook', 'internal', 'manual_admin')),
  event_type               text NOT NULL,

  asaas_event_id           text,
  asaas_payment_id         text,

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

-- CRÍTICO: garante que o mesmo evento Asaas nunca é processado duas vezes
CREATE UNIQUE INDEX spe_asaas_event_id_unique ON public.service_payment_events (asaas_event_id)
  WHERE asaas_event_id IS NOT NULL;

CREATE INDEX spe_service_payment_id_idx ON public.service_payment_events (service_payment_id);
CREATE INDEX spe_asaas_payment_id_idx   ON public.service_payment_events (asaas_payment_id);
CREATE INDEX spe_event_type_idx         ON public.service_payment_events (event_type);
CREATE INDEX spe_created_at_idx         ON public.service_payment_events (created_at DESC);
```

**RLS:**
```sql
ALTER TABLE public.service_payment_events ENABLE ROW LEVEL SECURITY;

-- Clientes e prestadores: SEM ACESSO (dados sensíveis de auditoria interna)
-- service_role: acesso total
CREATE POLICY spe_service_role ON public.service_payment_events
  FOR ALL TO service_role USING (true);
```

**Dependências:** Tarefa 1.8.

---

### Tarefa 1.11 — CREATE tabela `service_payment_releases`

**Arquivo:** `supabase/migrations/20260325100900_create_service_payment_releases_table.sql`

**O que fazer:**
Criar tabela de rastreamento de releases de escrow — cada tentativa de liberação de fundos é registrada.

```sql
CREATE TABLE public.service_payment_releases (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_payment_id        uuid NOT NULL REFERENCES public.service_payments(id),
  service_id                uuid NOT NULL REFERENCES public.services(id),
  provider_id               uuid NOT NULL REFERENCES public.profiles(id),

  release_type              text NOT NULL CHECK (release_type IN (
    'escrow_manual',    -- chamada após confirmação do cliente
    'escrow_auto',      -- expiração automática do daysToExpire
    'escrow_cancelled'  -- cancelamento por estorno
  )),

  asaas_escrow_guarantee_id text,
  released_amount           numeric(10,2) NOT NULL,

  status                    text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  attempted_at              timestamptz,
  completed_at              timestamptz,
  failure_reason            text,

  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spr_service_payment_id_idx ON public.service_payment_releases (service_payment_id);
CREATE INDEX spr_provider_id_idx        ON public.service_payment_releases (provider_id);
CREATE INDEX spr_status_idx             ON public.service_payment_releases (status);
```

**RLS:**
```sql
ALTER TABLE public.service_payment_releases ENABLE ROW LEVEL SECURITY;

-- Prestador: lê os seus releases
CREATE POLICY spr_provider_select ON public.service_payment_releases
  FOR SELECT TO authenticated USING (provider_id = auth.uid());

-- service_role: acesso total
CREATE POLICY spr_service_role ON public.service_payment_releases
  FOR ALL TO service_role USING (true);
```

**Dependências:** Tarefas 1.7, 1.8.

---

### Tarefa 1.12 — CREATE função interna `_calculate_client_pricing`

**Arquivo:** `supabase/migrations/20260325101000_create_client_pricing_functions.sql`

**O que fazer:**
Criar a função interna que centraliza toda a lógica de precificação do cliente. Esta é a **única implementação** do cálculo — nenhum outro lugar replica esta fórmula.

```sql
-- // UPDATED: Função interna agora calcula TODAS as taxas financeiras
-- Pipeline: taxa Renovi + taxa gateway (por método/parcelas) + antecipação (parcelado)
-- O cliente paga TUDO. Nenhuma taxa é hardcoded — todas vêm de platform_constants.
CREATE OR REPLACE FUNCTION public._calculate_client_pricing(
  p_proposed_amount    numeric,
  p_payment_method     text DEFAULT 'PIX',
  p_installment_count  integer DEFAULT 1           -- // ADDED: 1 = à vista; 2-12 = parcelado
) RETURNS TABLE (
  client_fee_rate           numeric,
  client_fee_amount         numeric,
  client_charge_amount      numeric,
  installment_count         integer,                -- // ADDED
  installment_value         numeric,                -- // ADDED
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
  v_const_value             numeric;
BEGIN
  -- Helper: buscar constante com validação
  -- (Nota: se PG < 14, extrair como função separada)

  -- Validar installment_count
  SELECT (value::text)::numeric INTO v_const_value FROM platform_constants WHERE key = 'max_installments';
  IF v_const_value IS NULL THEN RAISE EXCEPTION 'max_installments não encontrada'; END IF;
  v_max_installments := v_const_value::integer;

  IF p_installment_count < 1 OR p_installment_count > v_max_installments THEN
    RAISE EXCEPTION 'Parcelas inválido: %. Permitido: 1 a %', p_installment_count, v_max_installments;
  END IF;
  IF p_payment_method = 'PIX' AND p_installment_count > 1 THEN
    RAISE EXCEPTION 'PIX não suporta parcelamento';
  END IF;

  -- ETAPA 1+2: Taxa Renovi
  SELECT (value::text)::numeric INTO v_client_fee_rate FROM platform_constants WHERE key = 'renovi_tax_client';
  IF v_client_fee_rate IS NULL THEN RAISE EXCEPTION 'renovi_tax_client não encontrada'; END IF;

  v_client_fee_amount := round(p_proposed_amount * v_client_fee_rate, 2);
  v_subtotal := p_proposed_amount + v_client_fee_amount;

  -- ETAPA 3: Taxa do gateway
  IF p_payment_method = 'PIX' THEN
    SELECT (value::text)::numeric INTO v_gateway_fee_percent FROM platform_constants WHERE key = 'pix_processing_fee_percent';
    SELECT (value::text)::numeric INTO v_gateway_fixed_fee FROM platform_constants WHERE key = 'pix_fixed_fee_per_transaction';
  ELSIF p_payment_method = 'CREDIT_CARD' THEN
    SELECT (value::text)::numeric INTO v_gateway_fixed_fee FROM platform_constants WHERE key = 'card_fixed_fee_per_transaction';
    IF p_installment_count = 1 THEN
      SELECT (value::text)::numeric INTO v_gateway_fee_percent FROM platform_constants WHERE key = 'card_processing_fee_1x_percent';
    ELSIF p_installment_count BETWEEN 2 AND 6 THEN
      SELECT (value::text)::numeric INTO v_gateway_fee_percent FROM platform_constants WHERE key = 'card_processing_fee_2_6x_percent';
    ELSIF p_installment_count BETWEEN 7 AND 12 THEN
      SELECT (value::text)::numeric INTO v_gateway_fee_percent FROM platform_constants WHERE key = 'card_processing_fee_7_12x_percent';
    ELSE
      SELECT (value::text)::numeric INTO v_gateway_fee_percent FROM platform_constants WHERE key = 'card_processing_fee_13_21x_percent';
    END IF;
  END IF;
  -- Validar que nenhuma taxa veio nula
  IF v_gateway_fee_percent IS NULL THEN RAISE EXCEPTION 'Taxa de gateway não encontrada para método=%', p_payment_method; END IF;
  IF v_gateway_fixed_fee IS NULL THEN RAISE EXCEPTION 'Taxa fixa de gateway não encontrada para método=%', p_payment_method; END IF;

  v_gateway_fee_amount := round(v_subtotal * v_gateway_fee_percent, 2);

  -- ETAPA 4: Taxa de antecipação (SOMENTE parcelamento cartão)
  IF p_payment_method = 'CREDIT_CARD' AND p_installment_count >= 2 THEN
    SELECT (value::text)::numeric INTO v_anticipation_rate FROM platform_constants WHERE key = 'anticipation_fee_per_month_percent';
    IF v_anticipation_rate IS NULL THEN RAISE EXCEPTION 'anticipation_fee_per_month_percent não encontrada'; END IF;
    -- Fórmula: subtotal × rate × (N-1)/2
    v_anticipation_fee_amount := round(v_subtotal * v_anticipation_rate * (p_installment_count - 1)::numeric / 2, 2);
  END IF;

  -- ETAPA 5: Total
  v_total_gateway_cost := v_gateway_fee_amount + v_gateway_fixed_fee + v_anticipation_fee_amount;
  v_client_charge_amount := v_subtotal + v_total_gateway_cost;

  -- ETAPA 6: Valor por parcela
  IF p_installment_count > 1 THEN
    v_installment_value := round(v_client_charge_amount / p_installment_count, 2);
  END IF;

  -- V1: pipeline completo — taxa Renovi + gateway + antecipação.
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

-- CRÍTICO: revogar acesso público — somente funções SECURITY DEFINER internas podem chamar
REVOKE ALL ON FUNCTION public._calculate_client_pricing(numeric, text, integer) FROM PUBLIC;
```

**Resultado esperado:** Função criada com 11 campos de retorno, sem acesso via RLS.

**Teste manual:**
```sql
-- Executar como service_role

-- PIX (taxa Renovi + taxa gateway Pix)
SELECT * FROM public._calculate_client_pricing(1000.00, 'PIX', 1);
-- Esperado: client_fee_rate=0.05, client_fee_amount=50.00,
--           gateway_fee_percent=0.0099, gateway_fee_amount=10.40,
--           gateway_fixed_fee=0.00, anticipation_fee_amount=0.00,
--           total_gateway_cost=10.40,
--           client_charge_amount=1060.40, installment_count=1

-- Cartão 1x
SELECT * FROM public._calculate_client_pricing(1000.00, 'CREDIT_CARD', 1);
-- Esperado: gateway_fee_percent=0.0299, gateway_fee_amount=31.40,
--           gateway_fixed_fee=0.49, anticipation_fee_amount=0.00,
--           client_charge_amount=1081.89

-- Cartão 6x
SELECT * FROM public._calculate_client_pricing(1000.00, 'CREDIT_CARD', 6);
-- Esperado: gateway_fee_percent=0.0349, gateway_fee_amount=36.65,
--           gateway_fixed_fee=0.49,
--           anticipation_fee_percent=0.0170, anticipation_fee_amount=44.63,
--           total_gateway_cost=81.77,
--           client_charge_amount=1131.77, installment_value=188.63

-- Cartão 12x
SELECT * FROM public._calculate_client_pricing(1000.00, 'CREDIT_CARD', 12);
-- Esperado: gateway_fee_percent=0.0399, gateway_fee_amount=41.90,
--           anticipation_fee_percent=0.0170, anticipation_fee_amount=98.18,
--           client_charge_amount=1190.57, installment_value=99.21

-- PIX com parcelamento: DEVE falhar
SELECT * FROM public._calculate_client_pricing(1000.00, 'PIX', 6);
-- Esperado: EXCEPTION 'PIX não suporta parcelamento'

-- Parcelas além do máximo: DEVE falhar
SELECT * FROM public._calculate_client_pricing(1000.00, 'CREDIT_CARD', 13);
-- Esperado: EXCEPTION 'Parcelas inválido: 13. Permitido: 1 a 12'
```

**Dependências:** Tarefa 1.1 (TODAS as constantes de taxas em platform_constants).

---

### Tarefa 1.13 — CREATE RPC pública `get_client_proposal_pricing`

**Arquivo:** Incluir na mesma migration 1.12 (`20260325101000_create_client_pricing_functions.sql`)

**O que fazer:**
Criar a RPC pública que o frontend usa para obter o preço do cliente. Retorna **apenas** `client_charge_amount` — jamais o breakdown.

```sql
CREATE OR REPLACE FUNCTION public.get_client_proposal_pricing(
  p_proposal_id    uuid,
  p_payment_method text DEFAULT 'PIX'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposed_amount   numeric(10,2);
  v_pricing           record;
BEGIN
  -- Verificar que o chamador é o cliente do pedido vinculado à proposta
  IF NOT EXISTS (
    SELECT 1 FROM public.provider_proposals pp
    JOIN public.service_requests sr ON sr.id = pp.service_request_id
    WHERE pp.id = p_proposal_id
      AND sr.client_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado ou proposta não encontrada';
  END IF;

  -- Buscar proposed_amount da proposta (apenas estados visíveis ao cliente)
  SELECT proposed_amount
  INTO v_proposed_amount
  FROM public.provider_proposals
  WHERE id = p_proposal_id
    AND status NOT IN ('withdrawn', 'expired', 'closed_due_to_other_selection');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não disponível para precificação: %', p_proposal_id;
  END IF;

  -- // UPDATED: Calcular TODAS as opções de pagamento de uma vez
  -- Retornar payment_options[] — nunca o breakdown de taxas internas
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
    );
  END;
END;
$$;
```

**Resultado esperado:** RPC chamável pelo frontend; retorna `{ proposal_id, payment_options: [...] }` com todas as opções de pagamento.

**Formato de retorno:**
```json
{
  "proposal_id": "uuid",
  "payment_options": [
    { "method": "PIX", "installments": 1, "total": 1060.40, "installment_value": 1060.40 },
    { "method": "CREDIT_CARD", "installments": 1, "total": 1081.89, "installment_value": 1081.89 },
    { "method": "CREDIT_CARD", "installments": 2, "total": 1100.53, "installment_value": 550.27 },
    { "method": "CREDIT_CARD", "installments": 6, "total": 1131.77, "installment_value": 188.63 },
    { "method": "CREDIT_CARD", "installments": 12, "total": 1190.57, "installment_value": 99.21 }
  ]
}
```

**Teste manual:**
```sql
-- Simular como cliente autenticado (via service_role com SET LOCAL role)
SELECT get_client_proposal_pricing('<uuid-proposta-existente>');
-- Deve retornar payment_options com 13 entradas (PIX + Cartão 1x-12x)
```

**Dependências:** Tarefa 1.12, Tarefa 1.2 (status novos na proposta).

---

### Tarefa 1.14 — Atualizar RPC `list_client_received_budgets`

**Arquivo:** `supabase/migrations/20260325101100_update_list_client_received_budgets.sql`

**O que fazer:**
A RPC `list_client_received_budgets` atualmente retorna `proposed_amount` no campo `budgets_preview`. Ela deve ser atualizada para retornar `client_charge_amount` calculado dinamicamente, sem usar `get_client_proposal_pricing` individualmente (evitar N+1).

**Estratégia:** Buscar `renovi_tax_client` uma vez no início da função e calcular inline no SELECT.

**Mudança crítica no contrato de retorno:** O campo que antes retornava `proposed_amount` deve retornar `client_charge_amount`. O frontend deve ser atualizado em conjunto para usar o novo campo.

**Trecho relevante a alterar na função:**
```sql
-- ANTES (dentro do SELECT de list_client_received_budgets):
-- pp.proposed_amount AS display_amount

-- DEPOIS:
-- Declarar no DECLARE da função:
--   v_client_fee_rate numeric(6,4);
-- Buscar antes do SELECT principal:
--   SELECT (value::text)::numeric INTO v_client_fee_rate
--   FROM platform_constants WHERE key = 'renovi_tax_client';
-- No SELECT:
--   (pp.proposed_amount + round(pp.proposed_amount * v_client_fee_rate, 2)) AS client_charge_amount
```

**Resultado esperado:** `list_client_received_budgets` retorna `client_charge_amount` (preço total do cliente) no lugar de `proposed_amount`.

**Impacto de breaking change:** O contrato da RPC muda. O frontend deve atualizar o campo usado para exibição do valor das propostas. **Coordenar deploy da migration com o deploy do frontend.**

**Dependências:** Tarefa 1.1 (renovi_tax_client), Tarefa 1.12 (_calculate_client_pricing).

---

### Checklist de Conclusão da Fase 1

- [ ] Todos os arquivos de migration criados e testados em banco local
- [x] D8 confirmado: `renovi_tax_client` = 0.05 (5%) ✅
- [x] D9 confirmado: `isFeePayer` = false (plataforma paga) ✅
- [x] D10 confirmado: `daysToExpire` = 45 (máximo Asaas) ✅
- [x] D11 confirmado: Parcelamento suportado em V1 ✅
- [ ] Trigger de imutabilidade testado (tentativa de UPDATE nos 17 campos do snapshot deve falhar)
- [ ] `_calculate_client_pricing` testada com PIX, Cartão 1x, 6x, 12x
- [ ] `get_client_proposal_pricing` retornando `payment_options[]` correto
- [ ] `list_client_received_budgets` retornando `client_charge_amount` correto (apenas taxa Renovi, sem taxas de gateway)
- [ ] Frontend atualizado para usar `client_charge_amount` da listagem
- [ ] Todas as 14 constantes de `platform_constants` inseridas e validadas
- [ ] Deploy em banco de staging verificado antes de produção

---

## Fase 2 — Onboarding Financeiro do Prestador

**Objetivo:** Criar subaccount Asaas para cada prestador e habilitar escrow, tornando-os aptos a receber pagamentos via split.

---

### Tarefa 2.1 — Edge Function `create-provider-subaccount`

**Arquivo:** `supabase/functions/create-provider-subaccount/index.ts`

**O que fazer:**
Edge Function chamada pelo backend (ou pelo próprio prestador no fluxo de onboarding) que:

1. Coleta dados do prestador de `provider_profiles_private` + `profiles`
2. Chama `POST /v3/accounts` na Asaas para criar o subaccount
3. **Armazena imediatamente** `apiKey`, `walletId`, `id` na `provider_profiles_private`
4. Chama `POST /v3/accounts/{id}/escrow` para habilitar escrow no subaccount
5. Marca `asaas_onboarding_status = 'active'`

**Fluxo detalhado:**
```typescript
// 1. Buscar dados do prestador (service_role)
const { data: provider } = await supabaseAdmin
  .from('profiles').select('full_name, phone, email')
  .eq('id', provider_id).single();

const { data: private_data } = await supabaseAdmin
  .from('provider_profiles_private')
  .select('cpf, birth_date, address, ...')
  .eq('profile_id', provider_id).single();

// 2. Criar subaccount Asaas
const subaccountResponse = await fetch(`${ASAAS_BASE_URL}/v3/accounts`, {
  method: 'POST',
  headers: { Authorization: ASAAS_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, cpfCnpj, birthDate, companyType: 'MEI', ... })
});
const subaccount = await subaccountResponse.json();

// CRÍTICO: armazenar apiKey IMEDIATAMENTE — não pode ser recuperada depois
await supabaseAdmin.from('provider_profiles_private').update({
  asaas_subaccount_id: subaccount.id,
  asaas_wallet_id:     subaccount.walletId,
  asaas_account_api_key: subaccount.apiKey,  // <- armazenar aqui; nunca logar
}).eq('profile_id', provider_id);

// 3. Habilitar escrow (usando API key da PLATAFORMA, não do subaccount)
await fetch(`${ASAAS_BASE_URL}/v3/accounts/${subaccount.id}/escrow`, {
  method: 'POST',
  headers: { Authorization: ASAAS_API_KEY },
  body: JSON.stringify({ enabled: true, isFeePayer: false, daysToExpire: 45 })  // ✅ D9/D10 confirmados: plataforma paga; 45 dias máximo Asaas
});

// 4. Marcar como ativo
await supabaseAdmin.from('provider_profiles_private').update({
  asaas_onboarding_status: 'active'
}).eq('profile_id', provider_id);
```

**Pontos críticos:**
- Se o `UPDATE` após criar o subaccount falhar (ex.: timeout), a `apiKey` é perdida para sempre. Usar `try/catch` agressivo e logar o payload bruto da resposta antes de qualquer processamento.
- Se a criação do escrow falhar, o prestador fica com subaccount mas sem escrow. Marcar `asaas_onboarding_status = 'active'` apenas após AMBAS as chamadas terem sucesso.
- Limite sandbox: 20 subcontas/dia — testar de forma frugal.

**Resultado esperado:** `provider_profiles_private.asaas_onboarding_status = 'active'` para o prestador; `asaas_wallet_id` preenchido.

**Dependências:** Tarefa 1.6 (colunas Asaas em provider_profiles_private).

---

### Tarefa 2.2 — Frontend: tela de onboarding financeiro do prestador

**O que fazer:**
Criar o fluxo de UI para que o prestador complete seu cadastro financeiro. Pode ser uma modal ou uma tela dedicada acionada quando o prestador tenta enviar uma proposta sem onboarding completo.

**Dados coletados:**
- CPF/CNPJ (se não houver em `provider_profiles_private`)
- Data de nascimento
- Tipo de empresa (MEI, LTDA, etc.)
- Endereço completo (já pode existir parcialmente no perfil)
- Telefone comercial

**Comportamento:**
- Ao submeter, chamar a Edge Function `create-provider-subaccount`
- Mostrar estado de "Processando cadastro financeiro..." enquanto aguarda
- Em sucesso: redirecionar para lista de propostas/jobs com badge "Pronto para receber pagamentos"
- Em erro: mostrar mensagem amigável e opção de tentar novamente

**Estado "aguardando":** Se `asaas_onboarding_status = 'pending'`, todas as propostas enviadas pelo prestador mostram badge "Aguardando cadastro financeiro" (não bloqueia envio da proposta, apenas bloqueia que o cliente inicie checkout desta proposta).

**Dependências:** Tarefa 2.1.

---

### Checklist de Conclusão da Fase 2

- [ ] Edge Function testada no sandbox Asaas (criar subaccount real)
- [ ] `apiKey` armazenada corretamente em `asaas_account_api_key`
- [ ] Escrow habilitado no subaccount (verificar via dashboard Asaas sandbox)
- [ ] `asaas_onboarding_status = 'active'` após fluxo completo
- [ ] Frontend mostra badge correto para prestadores não-onboarded
- [ ] Checkout bloqueia prestadores não-onboarded (validado na Tarefa 3.1)

---

## Fase 3 — Checkout e Pagamento Pix

**Objetivo:** Implementar o fluxo completo de checkout end-to-end com Pix: do clique em "Quero contratar" até a criação do `services` após confirmação do pagamento.

---

### Tarefa 3.1 — RPC `initiate_checkout`

**Arquivo:** `supabase/migrations/20260325102000_create_initiate_checkout_rpc.sql`

**O que fazer:**
Esta é a RPC mais complexa do sistema. Realiza o lock atômico da proposta, calcula o preço do cliente e cria o `service_payments`.

**Assinatura:**
```sql
-- // UPDATED: agora aceita p_installment_count para parcelamento
CREATE OR REPLACE FUNCTION public.initiate_checkout(
  p_proposal_id      uuid,
  p_billing_type     text DEFAULT 'PIX',
  p_installment_count integer DEFAULT 1       -- // ADDED: 1 = à vista; 2-12 = parcelado
) RETURNS uuid -- retorna service_payments.id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
```

**Lógica completa:**

```
1. VALIDAÇÕES INICIAIS (falham com RAISE EXCEPTION):
   a. p_billing_type IN ('PIX', 'CREDIT_CARD')
   b. auth.uid() IS NOT NULL (autenticado)
   c. Buscar proposta: status = 'submitted', não expirada (created_at + 48h > now())
   d. Buscar SR: status = 'open'
   e. Verificar que auth.uid() = SR.client_id (é o cliente certo)
   f. Verificar pricing_signature da proposta:
      generate_provider_pricing_signature(proposed_amount, tax_rate, tax_amount, final_amount)
      = proposal.pricing_signature
   g. provider_profiles_private.asaas_wallet_id IS NOT NULL
   h. provider_profiles_private.asaas_onboarding_status = 'active'
   i. client_profiles_private.cpf IS NOT NULL

2. VERIFICAR SE JÁ EXISTE CHECKOUT ATIVO PARA ESTE CLIENTE:
   Se proposal.checkout_locked_until > now() AND proposal.locked_payment_id IS NOT NULL:
     Verificar se service_payments WHERE id = proposal.locked_payment_id AND client_id = auth.uid() EXISTS
     Se sim: retornar o service_payments.id existente (múltiplas abas do mesmo cliente)
     Se não: é outro cliente — o checkout já está bloqueado para este proposal

3. CALCULAR PRECIFICAÇÃO DO CLIENTE:
   -- // UPDATED: agora passa p_installment_count
   SELECT * INTO v_pricing FROM _calculate_client_pricing(proposal.proposed_amount, p_billing_type, p_installment_count)

4. LOCK ATÔMICO (UPDATE ... WHERE ... RETURNING):
   UPDATE provider_proposals SET
     status = 'payment_pending',
     checkout_locked_until = now() + (checkout_lock_duration_minutes || ' minutes')::interval,
     locked_payment_id = gen_random_uuid()  -- será preenchido abaixo
   WHERE id = p_proposal_id
     AND status = 'submitted'
     AND (checkout_locked_until IS NULL OR checkout_locked_until <= now())
     AND created_at + interval '48 hours' > now()
   RETURNING id
   -- Se 0 linhas: proposta foi travada por concorrência — RAISE EXCEPTION

5. ATUALIZAR SERVICE REQUEST:
   UPDATE service_requests SET status = 'budget_selected_pending_payment'
   WHERE id = v_service_request_id AND status = 'open'

6. INSERT service_payments COM SNAPSHOT COMPLETO:
   INSERT INTO service_payments (
     service_request_id, proposal_id, client_id, provider_id,
     billing_type,
     -- Snapshot do prestador (copiado da proposta)
     proposed_amount     = proposal.proposed_amount,
     provider_fee_rate   = proposal.tax_rate,
     provider_fee_amount = proposal.tax_amount,
     provider_net_amount = proposal.final_amount,
     -- Snapshot do cliente (calculado agora)
     client_fee_rate     = v_pricing.client_fee_rate,
     client_fee_amount   = v_pricing.client_fee_amount,
     client_charge_amount= v_pricing.client_charge_amount,
     -- // ADDED: Snapshot de parcelamento e taxas de gateway
     installment_count        = v_pricing.installment_count,
     installment_value        = v_pricing.installment_value,
     gateway_fee_percent      = v_pricing.gateway_fee_percent,
     gateway_fee_amount       = v_pricing.gateway_fee_amount,
     gateway_fixed_fee        = v_pricing.gateway_fixed_fee,
     anticipation_fee_percent = v_pricing.anticipation_fee_percent,
     anticipation_fee_amount  = v_pricing.anticipation_fee_amount,
     total_gateway_cost       = v_pricing.total_gateway_cost,
     -- Plataforma
     platform_total_fee_amount = proposal.tax_amount + v_pricing.client_fee_amount,
     -- Split
     split_wallet_id  = provider_profiles_private.asaas_wallet_id,
     split_fixed_value= proposal.final_amount,
     split_snapshot   = jsonb_build_array(jsonb_build_object(
       'walletId', provider_profiles_private.asaas_wallet_id,
       'fixedValue', proposal.final_amount
     )),
     -- Integridade
     proposal_pricing_signature = proposal.pricing_signature,
     -- Tempo
     checkout_expires_at = now() + (checkout_lock_duration_minutes || ' minutes')::interval
   ) RETURNING id INTO v_payment_id

7. ATUALIZAR LOCKED_PAYMENT_ID NA PROPOSTA:
   UPDATE provider_proposals SET locked_payment_id = v_payment_id
   WHERE id = p_proposal_id

8. RETORNAR v_payment_id
```

**Resultado esperado:**
- `provider_proposals.status = 'payment_pending'`
- `service_requests.status = 'budget_selected_pending_payment'`
- `service_payments` criado com snapshot financeiro completo
- Retorno: `uuid` do `service_payments`

**Dependências:** Tarefas 1.2, 1.3, 1.4, 1.8, 1.12, 2.1 (prestador onboarded).

---

### Tarefa 3.2 — RPC `get_checkout_details`

**Arquivo:** `supabase/migrations/20260325102100_create_get_checkout_details_rpc.sql`

**O que fazer:**
RPC chamada pela tela de checkout para buscar todos os dados necessários para exibição. Retorna uma projeção segura — sem nenhum dado financeiro interno.

**Assinatura:**
```sql
CREATE OR REPLACE FUNCTION public.get_checkout_details(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
```

**Validações:**
- `service_payments.client_id = auth.uid()`
- `service_payments.status IN ('created', 'pending')`
- `service_payments.checkout_expires_at > now()`

**Retorno:**
```json
{
  "payment": {
    "id": "uuid",
    "status": "created",
    "billing_type": "PIX",
    "client_charge_amount": 1060.40,
    "installment_count": 1,                      // ADDED
    "installment_value": null,                    // ADDED (null se 1x)
    "checkout_expires_at": "...",
    "asaas_pix_qr_code": null,
    "asaas_pix_qr_code_image": null
  },
  "service_request": {
    "title": "...",
    "description": "...",
    "service_type": "...",
    "neighborhood": "..."
  },
  "provider": {
    "display_name": "...",
    "slug": "...",
    "profile_image_path": "...",
    "bio": "..."
  },
  "proposal": {
    "description": "...",
    "duration_value": 2,
    "duration_unit": "hours",
    "photos": [],
    "suggested_slots": []
  }
}
```

**O que NÃO retornar:** `provider_fee_*`, `client_fee_rate`, `client_fee_amount`, `provider_net_amount`, `platform_total_fee_amount`, `split_*`, `proposal_pricing_signature`.

**Dependências:** Tarefas 3.1.

---

### Tarefa 3.3 — Edge Function `create-asaas-charge` (Pix)

**Arquivo:** `supabase/functions/create-asaas-charge/index.ts`

**O que fazer:**
Edge Function chamada após o cliente escolher o método de pagamento na tela de checkout. Para Pix:

```typescript
// 1. Validar: service_payment existe, client_id = auth.uid(), status = 'created'

// 2. Criar/obter Asaas customer (lazy creation)
//    Se profiles.asaas_customer_id IS NULL:
//      POST /v3/customers com name, email, cpfCnpj, phone
//      Salvar response.id em profiles.asaas_customer_id
//    Else: usar customer existente

// 3. Criar cobrança Pix no Asaas
const charge = await fetch(`${ASAAS_BASE_URL}/v3/payments`, {
  method: 'POST',
  body: JSON.stringify({
    customer: asaas_customer_id,
    billingType: 'PIX',
    value: service_payment.client_charge_amount,  // do snapshot — nunca recalcular
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // hoje + 1 dia
    description: `Renovi - ${service_type} - ${provider_name}`,
    externalReference: service_payment.id,         // CRÍTICO: fallback de lookup no webhook
    split: [{
      walletId: service_payment.split_wallet_id,
      fixedValue: service_payment.split_fixed_value  // do snapshot
    }]
  })
});

// 4. Obter QR Code Pix
const qrCode = await fetch(`${ASAAS_BASE_URL}/v3/payments/${charge.id}/pixQrCode`);

// 5. Atualizar service_payments
await supabaseAdmin.from('service_payments').update({
  asaas_payment_id: charge.id,
  asaas_customer_id: customer_id,
  asaas_due_date: dueDate,
  asaas_pix_qr_code: qrCode.payload,
  asaas_pix_qr_code_image: qrCode.encodedImage,
  asaas_pix_expiration_date: qrCode.expirationDate,  // 12 meses
  status: 'pending',
  // Estender o lock da proposta para durar até a expiração do QR
  // (feito via UPDATE na provider_proposals também)
}).eq('id', payment_id);

// 6. Estender checkout_locked_until na proposta para = asaas_pix_expiration_date
await supabaseAdmin.from('provider_proposals').update({
  checkout_locked_until: qrCode.expirationDate
}).eq('id', proposal_id);

// 7. Retornar { qrCodeImage, qrCodePayload, expirationDate }
```

**Pontos críticos:**
- O `value` enviado ao Asaas vem **do snapshot** (`service_payments.client_charge_amount`), nunca recalculado
- O `split.fixedValue` também vem do snapshot (`service_payments.split_fixed_value`)
- `externalReference` é o `service_payments.id` — fundamental para o webhook encontrar o pagamento por este campo quando `asaas_payment_id` ainda não está no banco
- Validar: `split_fixed_value < client_charge_amount * 0.95` antes de criar a cobrança (previne divergência de split)

**Dependências:** Tarefas 3.1, 2.1.

---

### Tarefa 3.4 — Edge Function `asaas-webhook` (handler básico — Pix)

**Arquivo:** `supabase/functions/asaas-webhook/index.ts`

**O que fazer:**
Handler básico cobrindo os eventos necessários para o fluxo Pix funcionar end-to-end.

**Estrutura geral:**
```typescript
export default async function handler(req: Request) {
  // 1. Validar token: req.headers.get('asaas-access-token') === ASAAS_WEBHOOK_SECRET
  //    Se inválido: return 403

  // 2. Parsear e logar payload bruto ANTES de qualquer processamento
  const { event, payment } = await req.json();
  console.log(JSON.stringify({ event, asaas_payment_id: payment?.id }));

  // 3. Lookup do service_payment
  let sp = await lookup_by_asaas_payment_id(payment.id);
  if (!sp) sp = await lookup_by_external_reference(payment.externalReference);
  if (!sp) {
    console.log(`Cobrança desconhecida: ${payment.id}`);
    return new Response('OK', { status: 200 });  // sempre 200
  }

  // 4. Roteamento por evento
  try {
    switch (event) {
      case 'PAYMENT_RECEIVED':      await handle_success(sp, payment); break;
      case 'PAYMENT_CONFIRMED':     await handle_success(sp, payment); break;
      case 'PAYMENT_OVERDUE':       await handle_overdue(sp, payment); break;
      case 'PAYMENT_DELETED':       await handle_deleted(sp, payment); break;
      // ... fases posteriores
      default: await log_unhandled(sp, event, payment);
    }
  } catch (err) {
    // Logar erro — MAS retornar 200 de qualquer forma
    console.error({ event, error: err.message, payment_id: sp.id });
  }

  return new Response('OK', { status: 200 });  // SEMPRE 200 após auth check
}
```

**`handle_success` — fluxo completo de pagamento confirmado:**
```typescript
async function handle_success(sp, payment) {
  // Idempotência: tentar inserir evento
  const { data: event_insert } = await supabaseAdmin
    .from('service_payment_events')
    .insert({ asaas_event_id: payment.eventId, event_type: event, service_payment_id: sp.id, ... })
    .select('is_duplicate').single();

  if (event_insert.is_duplicate) return; // já processado

  // Idempotência: service já existe?
  const existing_service = await supabaseAdmin
    .from('services').select('id').eq('proposal_id', sp.proposal_id).maybeSingle();
  if (existing_service.data) return; // já criado

  // Executar fluxo completo em sequência (não em transação SQL única — Edge Function)
  await supabaseAdmin.from('service_payments').update({
    status: 'confirmed',
    payment_confirmed_at: new Date().toISOString(),
    asaas_paid_at: payment.paymentDate,
    asaas_net_value: payment.netValue,
    asaas_last_status: payment.status,
  }).eq('id', sp.id);

  await supabaseAdmin.from('provider_proposals')
    .update({ status: 'accepted' }).eq('id', sp.proposal_id);

  await supabaseAdmin.from('service_requests')
    .update({ status: 'in_progress' }).eq('id', sp.service_request_id);

  const { data: new_service } = await supabaseAdmin
    .from('services')
    .insert({
      service_request_id: sp.service_request_id,
      proposal_id: sp.proposal_id,
      provider_id: sp.provider_id,
      client_id: sp.client_id,
    })
    .select('id')
    .onConflict('proposal_id')  // idempotência
    .ignoreDuplicates()
    .single();

  if (new_service) {
    await supabaseAdmin.from('service_payments')
      .update({ service_id: new_service.id }).eq('id', sp.id);
  }

  // Fechar outras propostas do mesmo pedido
  await supabaseAdmin.from('provider_proposals').update({
    status: 'closed_due_to_other_selection'
  })
  .eq('service_request_id', sp.service_request_id)
  .neq('id', sp.proposal_id)
  .in('status', ['submitted', 'payment_pending']);

  // Buscar guarantee ID do escrow (async — após commit das atualizações acima)
  await fetch_and_store_escrow_guarantee_id(sp);
}
```

**`fetch_and_store_escrow_guarantee_id`:**
```typescript
async function fetch_and_store_escrow_guarantee_id(sp) {
  // Buscar api_key do subaccount do prestador
  const { data: private_data } = await supabaseAdmin
    .from('provider_profiles_private')
    .select('asaas_account_api_key')
    .eq('profile_id', sp.provider_id).single();

  // Buscar cobrança no subaccount para obter escrow.id
  const escrow_response = await fetch(
    `${ASAAS_BASE_URL}/v3/payments/${sp.asaas_payment_id}/escrow`,
    { headers: { Authorization: private_data.asaas_account_api_key } }
  );
  const escrow = await escrow_response.json();

  if (escrow?.id) {
    await supabaseAdmin.from('service_payments').update({
      asaas_escrow_guarantee_id: escrow.id,
      escrow_status: 'blocked'
    }).eq('id', sp.id);
  }
}
```

**Configuração do webhook no Asaas (sandbox):**
```bash
curl -X POST https://api-sandbox.asaas.com/v3/webhooks \
  -H "Authorization: $ASAAS_SANDBOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Renovi Payments Dev",
    "url": "https://{ngrok-url}/functions/v1/asaas-webhook",
    "enabled": true,
    "authToken": "seu-webhook-secret",
    "sendType": "SEQUENTIALLY",
    "events": ["PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_OVERDUE","PAYMENT_DELETED"]
  }'
```

**Dependências:** Tarefas 1.7, 1.8, 1.10, 3.3.

---

### Tarefa 3.5 — Cron `expire_stale_checkouts`

**Arquivo:** `supabase/migrations/20260325102200_create_expire_stale_checkouts_cron.sql`

**O que fazer:**
Criar a função e agendar o pg_cron que expira checkouts abandonados a cada 5 minutos.

```sql
CREATE OR REPLACE FUNCTION public.expire_stale_checkouts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated integer := 0;
  r record;
BEGIN
  -- 1. Marcar payments expirados
  UPDATE service_payments SET status = 'expired', updated_at = now()
  WHERE status IN ('created', 'pending')
    AND checkout_expires_at < now();

  -- 2. Para cada payment recém-expirado, reverter proposta e SR
  FOR r IN
    SELECT sp.id, sp.proposal_id, sp.service_request_id
    FROM service_payments sp
    WHERE sp.status = 'expired'
      AND sp.updated_at >= now() - interval '6 minutes'
  LOOP
    UPDATE provider_proposals SET
      status = CASE
        WHEN created_at + interval '48 hours' > now() THEN 'submitted'
        ELSE 'expired'
      END,
      checkout_locked_until = NULL,
      locked_payment_id = NULL
    WHERE id = r.proposal_id AND status = 'payment_pending';

    UPDATE service_requests SET status = 'open'
    WHERE id = r.service_request_id AND status = 'budget_selected_pending_payment';

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- Agendar: a cada 5 minutos
SELECT cron.schedule('expire-stale-checkouts', '*/5 * * * *',
  'SELECT public.expire_stale_checkouts()');
```

**Dependências:** Tarefas 1.2, 1.4, 1.8.

---

### Tarefa 3.6 — RLS completo: service_payments, services, events

**O que fazer:**
Revisar e finalizar as RLS policies para as 3 novas tabelas (já esboçadas nas tarefas 1.7, 1.8, 1.10). Garantir que:

- Clientes nunca veem `provider_fee_*`, `client_fee_rate`, `client_fee_amount`
- Clientes não têm acesso direto a `service_payment_events`
- `asaas_account_api_key` nunca aparece em nenhuma query via RLS de usuário
- Prestadores não veem `client_fee_*` do lado do cliente

**Recomendação:** Criar views ou usar RPCs para expor dados aos usuários em vez de expor as tabelas diretamente via RLS. As RPCs `get_checkout_details` e futuras RPCs de acompanhamento já implementam essa projeção.

---

### Tarefa 3.7 — Frontend: tela de checkout "Revisar e Pagar"

**Rota:** `/orcamentos/checkout/:payment_id`

**O que fazer:**
Implementar a tela completa de checkout com:

**Dados:** Chamar `get_checkout_details(payment_id)` ao montar a tela.

**Sections:**
1. Header com countdown até `checkout_expires_at`
2. Resumo do pedido (ícone, tipo de serviço, título, localização)
3. Sobre o prestador (foto, nome, bio)
4. Detalhes do orçamento (descrição, duração, fotos carrossel, slots sugeridos)
5. Garantia escrow: texto explicando proteção ao cliente
6. Valor total: `client_charge_amount` em destaque — único valor financeiro visível
7. Seletor de método: PIX (recomendado) | Cartão (Fase 4)
8. Botão CTA

**Fluxo Pix ao clicar "Pagar com PIX":**
1. Chamar Edge Function `create-asaas-charge`
2. Mostrar spinner enquanto processa
3. Em sucesso: exibir QR code + código copy-paste + data de expiração
4. Subscrever Supabase Realtime em `service_payments` WHERE id = payment_id
5. Quando `status` mudar para `'confirmed'`: mostrar tela de sucesso e redirecionar para `/servicos/:service_id`

**Estados da tela:**
- `loading`: buscando dados
- `ready`: formulário de seleção de método
- `pix_pending`: QR code exibido, aguardando pagamento
- `confirmed`: sucesso, redirecionando
- `expired`: countdown zerado, mostrar opção de voltar
- `error`: falha na criação da cobrança

**Comportamento do countdown:**
- Calcular segundos restantes: `checkout_expires_at - now()`
- Quando chegar a 0: mostrar mensagem "Tempo esgotado" e desabilitar pagamento
- Redirecionar para `/orcamentos` após 5 segundos

**Dependências:** Tarefas 3.2, 3.3, 3.6.

---

### Tarefa 3.8 — Teste end-to-end Pix sandbox

**O que fazer:**
Executar o fluxo completo manualmente no sandbox antes de considerar a Fase 3 concluída:

```bash
# Pré-requisito: chave Pix cadastrada na conta sandbox (ver Seção 20 do arquitetural)

# 1. Fluxo via frontend:
#    - Prestador: criar proposta para um service_request
#    - Cliente: acessar orçamentos → selecionar proposta → iniciar checkout
#    - Verificar: provider_proposals.status = 'payment_pending'
#    - Verificar: service_payments criado com snapshot correto
#    - Verificar: client_charge_amount = proposed_amount * 1.05

# 2. Simular pagamento Pix no sandbox:
curl -X POST https://api-sandbox.asaas.com/v3/payments/{asaas_payment_id}/receiveInCash \
  -H "Authorization: $SANDBOX_API_KEY" -d '{}'

# 3. Verificar no banco:
SELECT pp.status, sr.status, sp.status, sp.escrow_status, s.id AS service_id
FROM provider_proposals pp
JOIN service_requests sr ON sr.id = pp.service_request_id
JOIN service_payments sp ON sp.proposal_id = pp.id
LEFT JOIN services s ON s.proposal_id = pp.id
WHERE pp.id = '<uuid>';
-- Esperado: accepted | in_progress | confirmed | blocked | <uuid-service>

# 4. Verificar que o frontend redirecionou para /servicos/:service_id
```

---

### Checklist de Conclusão da Fase 3

- [ ] `initiate_checkout` testada com lock concorrente (2 requests simultâneos — apenas 1 deve vencer)
- [ ] QR code Pix exibido corretamente no frontend
- [ ] Webhook `PAYMENT_RECEIVED` processado e `services` criado
- [ ] `escrow_status = 'blocked'` após pagamento confirmado
- [ ] Cron de expiração testado (simular abandono de checkout)
- [ ] Múltiplas abas do mesmo cliente convergem para o mesmo checkout
- [ ] Frontend redireciona para `/servicos/:service_id` após confirmação

---

## Fase 4 — Pagamento com Cartão de Crédito (Inclui Parcelamento) // UPDATED

**Objetivo:** Estender o checkout para suportar cartão de crédito (1x e parcelado até 12x) com tokenização PCI-compliant. O cliente paga TODAS as taxas financeiras (gateway + antecipação).

---

### Tarefa 4.1 — Tokenização no frontend

**O que fazer:**
Adicionar o formulário de dados de cartão à tela de checkout e tokenizar via Asaas antes de enviar ao backend.

```typescript
// Nunca enviar dados brutos ao backend
// Opção A: usar endpoint de tokenização
const tokenResponse = await fetch(`${ASAAS_BASE_URL}/v3/credit-card/tokenize`, {
  method: 'POST',
  body: JSON.stringify({
    customer: asaas_customer_id,
    creditCard: { holderName, number, expiryMonth, expiryYear, ccv },
    creditCardHolderInfo: { name, email, cpfCnpj, postalCode, phone }
  })
});
const { creditCardToken } = await tokenResponse.json();
// Enviar apenas o token para a Edge Function
```

**Dados coletados do usuário:**
- Nome no cartão
- Número do cartão (não armazenado — apenas tokenizado)
- Validade (mês/ano)
- CVV

---

### Tarefa 4.2 — Estender Edge Function `create-asaas-charge` para CREDIT_CARD (1x e parcelado)

**O que fazer:**
Adicionar branch de cartão de crédito na Edge Function existente. // UPDATED: agora com suporte a parcelamento

```typescript
if (billing_type === 'CREDIT_CARD') {
  // // UPDATED: Montar payload correto baseado em installment_count
  const isInstallment = sp.installment_count > 1;

  const paymentPayload: any = {
    customer: asaas_customer_id,
    billingType: 'CREDIT_CARD',
    dueDate: today,
    externalReference: sp.id,
    split: [{ walletId: sp.split_wallet_id, fixedValue: sp.split_fixed_value }],
    creditCard: { /* token */ },
    creditCardHolderInfo: { ... }
  };

  if (isInstallment) {
    // // ADDED: Parcelado — usar totalValue + installmentCount + installmentValue
    // REGRA: Para 2x+, NUNCA usar "value" — usar "totalValue"
    paymentPayload.totalValue = sp.client_charge_amount;        // do snapshot
    paymentPayload.installmentCount = sp.installment_count;     // do snapshot
    paymentPayload.installmentValue = sp.installment_value;     // do snapshot
  } else {
    // 1x — usar value (campo simples)
    paymentPayload.value = sp.client_charge_amount;             // do snapshot
  }

  // // ADDED: Simulação pré-criação (recomendado) — valida que netValue cobre o split
  const simulation = await fetch(`${ASAAS_BASE_URL}/v3/payments/simulate`, {
    method: 'POST',
    headers: { Authorization: ASAAS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: sp.client_charge_amount,
      billingType: 'CREDIT_CARD',
      installmentCount: isInstallment ? sp.installment_count : undefined
    })
  });
  const simResult = await simulation.json();
  if (simResult.netValue < sp.split_fixed_value) {
    // ALERTA: netValue menor que o split — divergência vai ocorrer
    console.error({ alert: 'SPLIT_DIVERGENCE_RISK', netValue: simResult.netValue, splitValue: sp.split_fixed_value });
    throw new Error('Risco de divergência de split: netValue insuficiente');
  }

  const charge = await fetch(`${ASAAS_BASE_URL}/v3/payments`, {
    method: 'POST',
    headers: { Authorization: ASAAS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentPayload)
  });
  const chargeResult = await charge.json();

  // Cartão pode ser: CONFIRMED, AWAITING_RISK_ANALYSIS, ou falha síncrona
  if (chargeResult.status === 'CONFIRMED') {
    await handle_immediate_card_confirmation(sp, chargeResult);
  } else if (chargeResult.status === 'AWAITING_RISK_ANALYSIS') {
    await supabaseAdmin.from('service_payments').update({
      asaas_payment_id: chargeResult.id,
      asaas_installment_id: chargeResult.installment || null,  // // ADDED
      status: 'awaiting_risk_analysis'
    }).eq('id', sp.id);
    return { status: 'awaiting_risk_analysis' };
  } else {
    await revert_proposal_and_sr(sp);
    throw new Error(chargeResult.failReason || 'Cartão recusado');
  }
}
```

---

### Tarefa 4.3 — Handlers de webhook para cartão

**O que fazer:**
Adicionar cases ao switch do `asaas-webhook`:

```typescript
case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
  await handle_success(sp, payment);
  break;

case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
  await handle_failed(sp, payment, 'Aprovação de risco negada');
  break;

case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
  await handle_failed(sp, payment, 'Captura recusada pela operadora');
  // Alertar admin
  break;

case 'PAYMENT_AUTHORIZED':
  // Apenas log — aguardar CONFIRMED
  await log_event(sp, event, payment);
  break;
```

**`handle_failed`:** reverter `provider_proposals.status = 'submitted'`, `service_requests.status = 'open'`, limpar lock.

---

### Tarefa 4.4 — Estados de UI para cartão (inclui seletor de parcelas) // UPDATED

**O que fazer:**
Adicionar estados adicionais e seletor de parcelas à tela de checkout:

// ADDED: Seletor de parcelas na tela de checkout
**Seletor de opções de pagamento:**
- Dados: usar `payment_options[]` retornado por `get_client_proposal_pricing(proposal_id)`
- **Seção PIX:**
  - Badge "Aprovação imediata"
  - Exibir total PIX (ex.: "R$1.060,40")
- **Seção Cartão de Crédito:**
  - Lista de opções de parcelamento:
    - "1x de R$1.081,89"
    - "2x de R$550,27 (total R$1.100,53)"
    - "6x de R$188,63 (total R$1.131,77)"
    - "12x de R$99,21 (total R$1.190,57)"
  - Cada opção mostra valor por parcela + total entre parênteses (exceto 1x)
- Ao selecionar uma opção de cartão e clicar "Pagar":
  - Chamar `initiate_checkout(proposal_id, 'CREDIT_CARD', installment_count)`
  - O snapshot é congelado com as taxas e parcelas selecionadas
  - Se o cliente quiser trocar o número de parcelas após o lock: novo checkout

**Estados de tela:**
- `card_processing`: spinner após submissão
- `risk_analysis`: "Seu pagamento está em análise. Você será notificado em breve."
- `card_declined`: "[Motivo do decline]. Tente com Pix."
- `card_capture_refused`: "Erro ao processar o pagamento. Tente novamente ou use Pix."

**Realtime:** subscrição em `service_payments` funciona para cartão também — o webhook atualiza `status` e o frontend reage.

// ADDED: Regra de UX para tela de orçamento vs checkout
**Tela de orçamento (ANTES de clicar "Quero contratar"):**
- Mostrar SOMENTE: valor do serviço + taxa Renovi = total base
- Ex.: "R$1.000,00 + R$50,00 (taxa plataforma) = R$1.050,00"
- NÃO mostrar opções de parcelamento ou taxas de cartão

**Tela de checkout (APÓS clicar "Quero contratar"):**
- Mostrar TODAS as opções: PIX, Cartão 1x, Cartão 2x-12x
- Cada opção com valor final já incluindo todas as taxas

---

### Checklist de Conclusão da Fase 4

- [ ] Tokenização testada (número do cartão nunca chega ao backend)
- [ ] Cartão de sucesso `4444 4444 4444 4444` completa o fluxo (1x)
- [ ] Cartão de falha `5184 0197 4037 3151` reverte proposta e SR
- [ ] Análise de risco: frontend permanece na tela de "em análise" e reage ao webhook
- [ ] // ADDED: Parcelamento 6x testado no sandbox — verificar que totalValue/installmentCount são enviados corretamente
- [ ] // ADDED: Parcelamento 12x testado — verificar split proporcional entre parcelas
- [ ] // ADDED: Simulação pré-criação (`POST /v3/payments/simulate`) valida netValue vs split
- [ ] // ADDED: Seletor de parcelas exibe todas as opções com valores corretos
- [ ] // ADDED: `_calculate_client_pricing` retorna valores consistentes para todas as faixas (1x, 2-6x, 7-12x)
- [ ] // ADDED: Tela de orçamento mostra APENAS valor base + taxa Renovi (sem taxas de cartão)
- [ ] // ADDED: Tela de checkout mostra opções com taxas embutidas (sem breakdown)

---

## Fase 5 — Fluxo do Serviço e Liberação do Escrow

**Objetivo:** Implementar o ciclo de vida do serviço após o pagamento, culminando na liberação dos fundos ao prestador.

---

### Tarefa 5.1 — Frontend: tela de acompanhamento do serviço

**Rota:** `/servicos/:service_id`

**O que fazer:**
Tela que mostra o progresso do serviço para ambos os lados (cliente e prestador veem perspectivas diferentes).

**Para o prestador:**
- Status atual + botão "Iniciar serviço" (`awaiting_start → in_progress`)
- Botão "Marcar como concluído" (`in_progress → completed`)
- Dados do pedido e do cliente

**Para o cliente:**
- Status atual
- Botão "Confirmar conclusão" (`completed → confirmed`) — aparece apenas quando prestador marcou como concluído
- Valor protegido em escrow (mensagem tranquilizadora)

---

### Tarefa 5.2 — RPCs de atualização de status do serviço

**Arquivo:** `supabase/migrations/20260325103000_create_service_status_rpcs.sql`

**RPCs a criar:**

```sql
-- Prestador inicia o serviço
CREATE OR REPLACE FUNCTION public.start_service(p_service_id uuid)
RETURNS void SECURITY DEFINER ...
-- Valida: services.provider_id = auth.uid()
-- Valida: services.status = 'awaiting_start'
-- UPDATE services SET status = 'in_progress', started_at = now()

-- Prestador marca como concluído
CREATE OR REPLACE FUNCTION public.complete_service(p_service_id uuid)
RETURNS void SECURITY DEFINER ...
-- Valida: services.provider_id = auth.uid()
-- Valida: services.status = 'in_progress'
-- UPDATE services SET status = 'completed', completed_at = now()

-- Cliente confirma conclusão (DISPARA O ESCROW RELEASE)
CREATE OR REPLACE FUNCTION public.confirm_service_completion(p_service_id uuid)
RETURNS void SECURITY DEFINER ...
-- Valida: services.client_id = auth.uid()
-- Valida: services.status = 'completed'
-- UPDATE services SET status = 'confirmed', confirmed_at = now()
-- A Edge Function release-escrow é chamada por trigger ou pelo frontend após UPDATE
```

---

### Tarefa 5.3 — Edge Function `release-escrow`

**Arquivo:** `supabase/functions/release-escrow/index.ts`

**O que fazer:**
Chamada quando `services.status = 'confirmed'` (via trigger de database ou chamada direta do frontend após RPC `confirm_service_completion`):

```typescript
// 1. Buscar service_payment via proposal_id
const sp = await supabaseAdmin
  .from('service_payments')
  .select('asaas_escrow_guarantee_id, escrow_status, provider_id')
  .eq('proposal_id', service.proposal_id).single();

// 2. Idempotência: já foi liberado?
if (sp.escrow_status === 'released') return { already_released: true };

// 3. Verificar que tem o guarantee ID
if (!sp.asaas_escrow_guarantee_id) {
  // Logar; alertar admin; não pode liberar sem o ID
  throw new Error('escrow_guarantee_id ausente — release manual necessário via dashboard Asaas');
}

// 4. Buscar api_key do subaccount do prestador
const { data: private_data } = await supabaseAdmin
  .from('provider_profiles_private')
  .select('asaas_account_api_key')
  .eq('profile_id', sp.provider_id).single();

// 5. Chamar POST /v3/escrow/{id}/finish com API KEY DO SUBACCOUNT
const release_response = await fetch(
  `${ASAAS_BASE_URL}/v3/escrow/${sp.asaas_escrow_guarantee_id}/finish`,
  { method: 'POST', headers: { Authorization: private_data.asaas_account_api_key } }
);

// 6. Atualizar service_payments e criar release record
await supabaseAdmin.from('service_payments').update({
  escrow_status: 'released',
  escrow_release_triggered_at: service.confirmed_at,
  escrow_released_at: new Date().toISOString()
}).eq('id', sp.id);

await supabaseAdmin.from('service_payment_releases').insert({
  service_payment_id: sp.id,
  service_id: service.id,
  provider_id: sp.provider_id,
  release_type: 'escrow_manual',
  asaas_escrow_guarantee_id: sp.asaas_escrow_guarantee_id,
  released_amount: sp.provider_net_amount,
  status: 'completed',
  attempted_at: new Date().toISOString(),
  completed_at: new Date().toISOString()
});
```

**Dependências:** Tarefas 1.8, 1.11, 2.1 (api key armazenada), 3.4 (escrow guarantee ID coletado após pagamento).

---

### Tarefa 5.4 — Cron para detectar escrow preso

**Arquivo:** Adicionar job ao pg_cron

```sql
-- A cada 1 hora: detectar escrow 'blocked' com service 'confirmed' há mais de 24h
SELECT cron.schedule('monitor-stuck-escrow', '0 * * * *', $$
  SELECT id, asaas_escrow_guarantee_id
  FROM service_payments sp
  JOIN services s ON s.proposal_id = sp.proposal_id
  WHERE sp.escrow_status = 'blocked'
    AND s.status = 'confirmed'
    AND s.confirmed_at < now() - interval '24 hours';
  -- Em produção: este SELECT deve gerar um alerta via pg_notify ou tabela de alertas admin
$$);
```

---

### Checklist de Conclusão da Fase 5

- [ ] Prestador consegue iniciar e marcar serviço como concluído
- [ ] Cliente vê botão "Confirmar conclusão" apenas após prestador marcar completed
- [ ] Release do escrow testado no sandbox (verificar via dashboard Asaas que fundos foram desbloqueados)
- [ ] `service_payment_releases` registra o release corretamente
- [ ] Cron de alerta testado com escrow artificialmente preso

---

## Fase 6 — Cobertura Completa de Webhooks e Resiliência

**Objetivo:** Cobrir todos os eventos do Asaas, criar sistema de alertas para eventos críticos e dar ao admin ferramentas de intervenção manual.

---

### Tarefa 6.1 — Handlers de vencimento e cancelamento

Adicionar ao `asaas-webhook`:

```typescript
case 'PAYMENT_OVERDUE':
  // Expirar checkout: revert proposal + SR
  await expire_payment(sp, 'Pix vencido');
  break;

case 'PAYMENT_DELETED':
  if (['created','pending'].includes(sp.status)) {
    await expire_payment(sp, 'Cobrança deletada no Asaas');
  } else {
    await log_event(sp, event, payment);
  }
  break;

case 'PAYMENT_RESTORED':
  // Log apenas + alerta admin
  await log_event(sp, event, payment, 'admin_alert');
  break;
```

---

### Tarefa 6.2 — Handlers de estorno e chargeback

```typescript
case 'PAYMENT_REFUNDED':
  await supabaseAdmin.from('service_payments').update({
    status: 'refunded', escrow_status: 'cancelled'
  }).eq('id', sp.id);
  // Cancelar service e SR
  await supabaseAdmin.from('services').update({ status: 'cancelled' })
    .eq('proposal_id', sp.proposal_id);
  await supabaseAdmin.from('service_requests').update({ status: 'cancelled' })
    .eq('id', sp.service_request_id);
  await alert_admin('PAYMENT_REFUNDED', sp);
  break;

case 'PAYMENT_CHARGEBACK_REQUESTED':
  await supabaseAdmin.from('service_payments').update({ status: 'chargeback' })
    .eq('id', sp.id);
  await supabaseAdmin.from('service_requests').update({ status: 'disputed' })
    .eq('id', sp.service_request_id);
  await supabaseAdmin.from('services').update({ status: 'disputed' })
    .eq('proposal_id', sp.proposal_id);
  // NÃO liberar escrow — manter fundos retidos durante disputa
  await alert_admin('CHARGEBACK', sp, 'URGENT');
  break;
```

---

### Tarefa 6.3 — Handler de divergência de split

```typescript
case 'PAYMENT_SPLIT_DIVERGENCE_BLOCK':
  // Bloqueio por Asaas — split maior que netValue
  await alert_admin('SPLIT_DIVERGENCE_BLOCK', sp, 'CRITICAL');
  // Ação manual do admin necessária; fundos bloqueados por 2 dias úteis
  break;
```

**Prevenção (já implementar desde a Fase 3):**
```typescript
// Em create-asaas-charge, antes de criar cobrança:
if (sp.split_fixed_value >= sp.client_charge_amount * 0.95) {
  throw new Error(`Split risk: fixedValue ${sp.split_fixed_value} muito próximo de value ${sp.client_charge_amount}`);
}
```

---

### Tarefa 6.4 — Sistema de alertas admin

**O que fazer:**
Criar uma tabela `admin_alerts` e uma função `alert_admin` que registra eventos críticos:

```sql
CREATE TABLE public.admin_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level        text NOT NULL CHECK (level IN ('info', 'warning', 'urgent', 'critical')),
  event_type   text NOT NULL,
  payload      jsonb,
  resolved     boolean NOT NULL DEFAULT false,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Em V1, alerta pode ser apenas registro na tabela. Fase posterior pode integrar com email/Slack.

---

### Tarefa 6.5 — Consultas de monitoramento diário

Registrar estas queries como parte do runbook operacional:

```sql
-- 1. Pagamentos confirmados sem service criado (inconsistência crítica)
SELECT sp.id, sp.proposal_id, sp.payment_confirmed_at
FROM service_payments sp
LEFT JOIN services s ON s.proposal_id = sp.proposal_id
WHERE sp.status = 'confirmed' AND s.id IS NULL
ORDER BY sp.payment_confirmed_at DESC;

-- 2. Propostas aceitas com SR em estado incorreto
SELECT pp.id, pp.status, sr.status AS sr_status
FROM provider_proposals pp
JOIN service_requests sr ON sr.id = pp.service_request_id
WHERE pp.status = 'accepted'
  AND sr.status NOT IN ('in_progress', 'closed', 'cancelled', 'disputed');

-- 3. Escrow bloqueado com serviço confirmado há mais de 24h (release falhou)
SELECT sp.id, sp.asaas_escrow_guarantee_id, s.confirmed_at
FROM service_payments sp
JOIN services s ON s.proposal_id = sp.proposal_id
WHERE sp.escrow_status = 'blocked'
  AND s.status = 'confirmed'
  AND s.confirmed_at < now() - interval '24 hours';

-- 4. Fila de webhooks Asaas com erros de processamento recentes
SELECT event_type, count(*), max(processed_at)
FROM service_payment_events
WHERE processing_error IS NOT NULL
  AND created_at > now() - interval '24 hours'
GROUP BY event_type ORDER BY count DESC;

-- 5. Auditoria de snapshot financeiro (todos devem bater)
-- // UPDATED: inclui validação de taxas de gateway e parcelamento
SELECT id FROM service_payments
WHERE round(proposed_amount * client_fee_rate, 2) <> client_fee_amount
   OR (proposed_amount - provider_fee_amount) <> provider_net_amount
   OR (client_fee_amount + proposed_amount + total_gateway_cost) <> client_charge_amount
   OR (gateway_fee_amount + gateway_fixed_fee + anticipation_fee_amount) <> total_gateway_cost;
-- Deve retornar 0 linhas

-- 6. Auditoria de parcelas (installment_value * count ≈ client_charge_amount)
-- // ADDED
SELECT id, installment_count, installment_value, client_charge_amount
FROM service_payments
WHERE installment_count > 1
  AND abs(installment_value * installment_count - client_charge_amount) > 0.10;
-- Tolerância de R$0,10 por arredondamento — deve retornar 0 linhas
```

---

### Checklist de Conclusão da Fase 6

- [ ] Handler `PAYMENT_OVERDUE` testado (simular via `POST /overdue` no sandbox)
- [ ] Handler `PAYMENT_REFUNDED` testado
- [ ] Handler `PAYMENT_CHARGEBACK_REQUESTED` testado (NÃO deve liberar escrow)
- [ ] Alerta de `SPLIT_DIVERGENCE_BLOCK` registrado em `admin_alerts`
- [ ] Fila de webhooks Asaas sendo monitorada (webhook de saúde configurado)
- [ ] Consultas de monitoramento executadas sem resultados anômalos

---

## Pontos Críticos e Riscos Transversais

### R1 — Perda da `asaas_account_api_key`
**Severidade:** Crítica. Sem a API key do subaccount, o escrow release é impossível — fundos ficam retidos indefinidamente.

**Mitigação:**
- Logar o JSON bruto da resposta de criação do subaccount em uma tabela de audit antes de qualquer processamento
- Double-write: tentar salvar em `provider_profiles_private` E em uma tabela de backup segura
- Monitorar `provider_profiles_private` WHERE `asaas_onboarding_status = 'active' AND asaas_account_api_key IS NULL`

### R2 — Divergência de split
**Severidade:** Alta. `PAYMENT_SPLIT_DIVERGENCE_BLOCK` bloqueia os fundos por 2 dias úteis.

**Prevenção:** Validar `split_fixed_value < client_charge_amount * 0.95` antes de criar qualquer cobrança.

**Causa típica:** `provider_net_amount` (split) muito próximo ou maior que `client_charge_amount` (cobrança total). Isso acontece se as taxas Asaas reduzirem o `netValue` abaixo do `fixedValue` do split.

### R3 — Fila de webhooks pausada
**Severidade:** Alta. Após 15 falhas consecutivas, o Asaas para de enviar webhooks. Pagamentos confirmados não processados = `services` não criados, escrow não detectado.

**Mitigação:** Verificar `GET /v3/webhooks/{id}` periodicamente. Se `interrupted: true`, reenfileirar via `PUT /v3/webhooks/{id}` com `"interrupted": false`. Reprocessar eventos dos últimos 14 dias via `service_payment_events` (identificar gaps por `asaas_payment_id`).

### R4 — Pix tardio após expiração interna
**Severidade:** Média. Se o `expire_stale_checkouts` cron expirar um checkout e depois o `PAYMENT_RECEIVED` chegar, o `service_payment` estará em `expired` mas o pagamento foi recebido.

**Tratamento (Tarefa 3.4 / 6.x):** No handler `PAYMENT_RECEIVED`, verificar se `sp.status = 'expired'`. Se sim, reverter para `confirmed`, criar service, alertar admin, registrar o evento como `late_payment`.

### R5 — Breaking change em `list_client_received_budgets`
**Severidade:** Média. O contrato da RPC muda (campo `proposed_amount` → `client_charge_amount`).

**Mitigação:** Coordenar o deploy da migration com o deploy do frontend. Não fazer deploy da migration sem o frontend preparado para o novo campo.

### R6 — `renovi_tax_client` alterado em produção
**Severidade:** Baixa. Checkouts já iniciados (com snapshot em `service_payments`) não são afetados. Apenas novos checkouts usarão a nova taxa.

**Monitoramento:** Auditoria do snapshot (query 5 em Tarefa 6.5) deve continuar retornando 0 linhas após qualquer mudança de taxa.

// ADDED: Riscos relacionados a parcelamento e taxas de gateway

### R7 — Taxas Asaas promocionais expiram sem atualização
**Severidade:** Média. Nos primeiros 3 meses, as taxas de cartão são menores (ex.: 1,99% vs 2,99% para 1x). Se as constantes em `platform_constants` não forem atualizadas após o período promocional, o `client_charge_amount` será menor que o necessário para cobrir as taxas reais do Asaas, e a Renovi absorverá a diferença.

**Mitigação:** Criar alerta/reminder para a data de expiração da promoção Asaas. Atualizar `platform_constants` ANTES da mudança de taxa entrar em vigor.

### R8 — Split em parcelamento: distribuição proporcional
**Severidade:** Média. Em cobranças parceladas, o Asaas distribui o split proporcionalmente entre as parcelas. Se o `fixedValue` total do split for maior que o `netValue` total (após taxas Asaas de todas as parcelas), ocorre `PAYMENT_SPLIT_DIVERGENCE_BLOCK`.

**Mitigação:** Usar `POST /v3/payments/simulate` antes de criar a cobrança para validar que `netValue >= split_fixed_value`. Se não, alertar admin e bloquear criação.

### R9 — Parcela intermediária falha (cartão vencido, limite insuficiente)
**Severidade:** Média. Se uma parcela individual de um parcelamento falha, o serviço já pode estar em andamento ou concluído.

**Tratamento:** Webhook `PAYMENT_OVERDUE` para parcela individual → NÃO cancelar o serviço automaticamente. Alertar admin para ação manual. Definir política de tolerância a parcelas inadimplentes em versão futura.

### R10 — Arredondamento em parcelas causa divergência
**Severidade:** Baixa. Divisão inexata do `client_charge_amount` por `installment_count` pode gerar diferença de centavos.

**Mitigação:** Usar `totalValue` na API Asaas (não `installmentValue`) para que o Asaas faça o ajuste automático na última parcela. No frontend, exibir o `installment_value` do snapshot (que é o valor arredondado para baixo) — a última parcela pode ser ligeiramente maior.

---

## Preparação para Evolução Futura

### F1 — Taxa diferenciada por método de pagamento
A função `_calculate_client_pricing(p_proposed_amount, p_payment_method)` já aceita o parâmetro `p_payment_method` desde V1 (ignorado por ora). Para adicionar surcharge no cartão: apenas alterar o corpo da função.

A RPC `get_client_proposal_pricing` e o `initiate_checkout` já passam `p_billing_type` — sem mudança de interface necessária.

### F2 — Cupons de desconto
Adicionar `p_promo_code` a `_calculate_client_pricing`. Lógica de validação interna; resultado congelado no snapshot com campo `promo_code_applied` em `service_payments`.

### F3 — Escrow com período de retenção configurável por categoria de serviço
`daysToExpire` atualmente é único para todos. Para diferenciar: mover para `platform_services` (por tipo de serviço) e consultar ao criar o subaccount ou ao configurar o escrow.

### F4 — Múltiplos prestadores por serviço (subcontratação)
A tabela `services` tem FK `provider_id` (singular). Se no futuro houver mais de um prestador, criar tabela `service_participants` com split configurável. O split array no Asaas já suporta múltiplos `walletId`.

### F5 — ~~Parcelamento no cartão~~ ✅ IMPLEMENTADO EM V1
// UPDATED: Parcelamento faz parte do V1 (Fase 4). Campos `installment_count`, `installment_value`, taxas de gateway e antecipação já estão no schema de `service_payments` e no pipeline `_calculate_client_pricing`.

### F6 — Histórico de mudanças em `renovi_tax_client`
Criar tabela `platform_constants_history` com trigger de audit em `platform_constants`. Permite auditoria retroativa de qual taxa estava vigente em qualquer momento — complementa o `client_fee_rate` já armazenado no snapshot.

---

## Checklist de Setup de Ambiente

Antes de começar qualquer desenvolvimento:

```bash
# 1. Criar conta Asaas sandbox
# Acessar: https://sandbox.asaas.com
# Completar aprovação da conta (upload de qualquer imagem como documento)
# Gerar API key em: Configurações → Integrações → Chave da API

# 2. Registrar chave Pix no sandbox (OBRIGATÓRIO para cobranças Pix)
# Acessar: Minhas Finanças → Pix → Minhas Chaves → Nova Chave
# SEM chave Pix: cobranças Pix retornam erro 404

# 3. Configurar variáveis de ambiente
cat > supabase/functions/.env << 'EOF'
ASAAS_API_KEY=your_sandbox_key
ASAAS_API_BASE_URL=https://api-sandbox.asaas.com
ASAAS_WEBHOOK_SECRET=gere-um-token-aleatorio-aqui
ASAAS_ENVIRONMENT=sandbox
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_URL=http://localhost:54321
EOF

# 4. Instalar e iniciar ngrok (para webhooks em desenvolvimento local)
ngrok http 54321
# Copiar o URL https gerado

# 5. Registrar webhook no sandbox Asaas
curl -X POST https://api-sandbox.asaas.com/v3/webhooks \
  -H "Authorization: $ASAAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Renovi Dev\",
    \"url\": \"https://{ngrok-url}/functions/v1/asaas-webhook\",
    \"enabled\": true,
    \"authToken\": \"$ASAAS_WEBHOOK_SECRET\",
    \"sendType\": \"SEQUENTIALLY\",
    \"events\": [\"PAYMENT_CONFIRMED\",\"PAYMENT_RECEIVED\",\"PAYMENT_OVERDUE\",\"PAYMENT_DELETED\",\"PAYMENT_REFUNDED\",\"PAYMENT_CHARGEBACK_REQUESTED\"]
  }"

# 6. Verificar que pg_cron está habilitado
SELECT * FROM cron.job;
# Se não existir a extensão: habilitar em Supabase dashboard → Extensions

# 7. Confirmar decisões pendentes (D8, D9, D10, D11) com produto antes de rodar migrations
```

---

## Resumo das Migrations por Fase

| Fase | Arquivo | Conteúdo |
|------|---------|----------|
| 1 | `20260325100000` | platform_constants (14 entradas: taxa Renovi + taxas gateway + antecipação + max_installments) |
| 1 | `20260325100100` | ALTER provider_proposals (lock + status) |
| 1 | `20260325100200` | Triggers provider_proposals atualizados |
| 1 | `20260325100300` | ALTER service_requests (status) |
| 1 | `20260325100400` | ALTER profiles (asaas_customer_id) |
| 1 | `20260325100500` | ALTER provider_profiles_private (campos Asaas) |
| 1 | `20260325100600` | CREATE services + RLS |
| 1 | `20260325100700` | CREATE service_payments + RLS |
| 1 | `20260325100750` | Trigger imutabilidade snapshot |
| 1 | `20260325100800` | CREATE service_payment_events + RLS |
| 1 | `20260325100900` | CREATE service_payment_releases + RLS |
| 1 | `20260325101000` | CREATE _calculate_client_pricing (pipeline completo: Renovi + gateway + antecipação) + get_client_proposal_pricing (retorna payment_options[]) |
| 1 | `20260325101100` | UPDATE list_client_received_budgets |
| 3 | `20260325102000` | CREATE initiate_checkout RPC |
| 3 | `20260325102100` | CREATE get_checkout_details RPC |
| 3 | `20260325102200` | CREATE expire_stale_checkouts + cron |
| 5 | `20260325103000` | CREATE start/complete/confirm_service RPCs |
| 6 | `20260325104000` | CREATE admin_alerts + alertas admin |

---

## Resumo das Edge Functions

| Função | Fase | Responsabilidade |
|--------|------|-----------------|
| `create-provider-subaccount` | 2 | Criar subaccount Asaas + habilitar escrow |
| `create-asaas-charge` | 3 / 4 | Criar cobrança Pix (Fase 3) e cartão (Fase 4) |
| `asaas-webhook` | 3 → 6 | Handler central de todos os eventos Asaas |
| `release-escrow` | 5 | Chamar POST /escrow/{id}/finish com API key do subaccount |
