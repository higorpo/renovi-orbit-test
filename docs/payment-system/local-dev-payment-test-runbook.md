# Runbook — testes de pagamento em desenvolvimento local

Passo a passo para validar o fluxo **checkout → cron de cobrança → webhook → PAID** no Supabase local, usando o sandbox NetCred.

**Relacionado:** [`vault-secrets-runbook.md`](./vault-secrets-runbook.md) · [`netcred-payments-flow.md`](./netcred-payments-flow.md) · [`CONTEXT.md`](./CONTEXT.md)

---

## 1. Pré-requisitos

### 1.1 Stack local

```bash
nvm use 24.13
yarn db:reset          # banco limpo + migrations + seed
yarn dev               # app (outro terminal)
yarn supabase functions serve   # Edge Functions (outro terminal)
```

### 1.2 Secrets (Edge Functions)

Copie `supabase/functions/.env.example` → `supabase/functions/.env` e preencha:

| Variável | Uso |
|----------|-----|
| `NETCRED_USERNAME` / `NETCRED_PASSWORD` | API GraphQL sandbox |
| `NETCRED_API_BASE_URL` | `https://api.sandbox.netcredbrasil.com.br` |
| `NETCRED_PLATFORM_BANK_ACCOUNT_ID` | Conta bancária da Renovi no sandbox (ex.: `2052`) |
| `NETCRED_WEBHOOK_SECRET` | HMAC do webhook |
| `ORBIT_CRON_SECRET` | Mesmo valor do `.env` raiz (pg_cron → EF) |

Reinicie `yarn supabase functions serve` após alterar `.env`.

### 1.3 Vault (HMAC de parcelas)

No `.env` raiz: `INSTALLMENT_SIGNING_SECRET` e `PRICING_SIGNATURE_SECRET` (ver [`vault-secrets-runbook.md`](./vault-secrets-runbook.md)). O `db:reset` recarrega o Vault a partir do `supabase/config.toml`.

### 1.4 Webhook NetCred (opcional, para testar PAID via webhook)

```bash
yarn enable-webhook
# URL: https://pj-orbit-sb.loca.lt/functions/v1/netcred-webhook
```

No painel/API NetCred, cadastre essa URL. Para localtunnel, use `maskUserAgent: false` no `webhookCreate` (evita erro 511).

### 1.5 Acesso ao Postgres local

```bash
# Descobrir o container
docker ps --format '{{.Names}}' | grep supabase_db

# Conectar (substitua o nome do container)
docker exec -it supabase_db_<project_ref> psql -U postgres -d postgres
```

---

## 2. Identificar o prestador de teste

Após o seed, localize o `provider_id` (UUID do usuário prestador):

```sql
SELECT id, email, role, phone
FROM public.profiles
WHERE role = 'provider'
ORDER BY created_at
LIMIT 10;
```

Nos exemplos abaixo usamos o prestador seed **João**:

```
PROVIDER_ID = 5d09e025-20a2-4842-aeef-324d42a431e1
```

Substitua pelo UUID do seu ambiente quando for diferente.

**Dados NetCred sandbox (prestador João LTDA):**

| Campo | Valor |
|-------|-------|
| CNPJ | `49769985000103` (só dígitos na tabela gateway) |
| `netcred_company_id` | `1048` |
| `netcred_bank_account_id` | `2053` |

---

## 3. Ativar prestador como se tivesse concluído onboarding NetCred

Simula KYC completo + conta gateway + ativação via RPC oficial (`payment_activate_provider_from_netcred`).

```sql
BEGIN;

-- Telefone do prestador (usado no KYC / tokenização)
UPDATE public.profiles
SET phone = '(48) 99645-3859'
WHERE id = '5d09e025-20a2-4842-aeef-324d42a431e1';

-- Perfil privado PJ + dados bancários/KYC
UPDATE public.provider_profiles_private
SET
  entity_type = 'pj',
  cpf = null,
  cnpj = '49.769.985/0001-03',
  razao_social = 'João LTDA',
  nome_fantasia = 'João Eletricista',
  legal_representative_name = 'João Pedro Eletricista',
  legal_representative_cpf = '987.654.321-00',
  legal_representative_phone = '(48) 99645-3859',
  commercial_contact = 'joao@prestway.com',
  bank_institution_code = '84',
  bank_branch = '1410',
  bank_account = '303939',
  pix_key = 'joao@prestway.com',
  identity_doc_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/identity/doc.pdf',
  address_proof_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/address-proof/doc.pdf',
  corporate_charter_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/corporate-charter/doc.pdf',
  legal_rep_doc_storage_path = 'providers/5d09e025-20a2-4842-aeef-324d42a431e1/kyc/legal-rep-id/doc.pdf',
  updated_at = now()
WHERE provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1';

-- Conta gateway: DOCUMENTS_SUBMITTED (pré-requisito da ativação)
INSERT INTO public.provider_gateway_accounts (
  provider_id,
  gateway_slug,
  document,
  onboarding_status,
  onboarding_submitted_at,
  email_dispatched_at
)
VALUES (
  '5d09e025-20a2-4842-aeef-324d42a431e1',
  'netcred',
  '49769985000103',
  'DOCUMENTS_SUBMITTED',
  now(),
  now()
)
ON CONFLICT (provider_id, gateway_slug) DO UPDATE
SET
  document = excluded.document,
  onboarding_status = CASE
    WHEN provider_gateway_accounts.onboarding_status = 'ACTIVE'
      THEN provider_gateway_accounts.onboarding_status
    ELSE 'DOCUMENTS_SUBMITTED'
  END,
  onboarding_submitted_at = COALESCE(
    provider_gateway_accounts.onboarding_submitted_at,
    excluded.onboarding_submitted_at
  ),
  email_dispatched_at = COALESCE(
    provider_gateway_accounts.email_dispatched_at,
    excluded.email_dispatched_at
  ),
  updated_at = now();

-- Simula service_role para o RPC de ativação
SELECT set_config('request.jwt.claim.role', 'service_role', true);

-- Ativa com IDs reais do sandbox NetCred
SELECT public.payment_activate_provider_from_netcred(
  (
    SELECT id
    FROM public.provider_gateway_accounts
    WHERE provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'
      AND gateway_slug = 'netcred'
  ),
  '1048',
  '2053'
)
WHERE EXISTS (
  SELECT 1
  FROM public.provider_gateway_accounts
  WHERE provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1'
    AND gateway_slug = 'netcred'
    AND onboarding_status IN ('DOCUMENTS_SUBMITTED', 'UNDER_NETCRED_REVIEW')
);

COMMIT;
```

**Conferir ativação:**

```sql
SELECT
  pga.provider_id,
  pga.document,
  pga.onboarding_status,
  pga.netcred_company_id,
  pga.netcred_bank_account_id,
  pga.onboarding_activated_at
FROM public.provider_gateway_accounts pga
WHERE pga.provider_id = '5d09e025-20a2-4842-aeef-324d42a431e1';
```

Esperado: `onboarding_status = ACTIVE`, `netcred_company_id = 1048`, `netcred_bank_account_id = 2053`.

> **Atalho (só dev):** se a conta já existir em `ACTIVE`, o bloco de ativação é ignorado pelo `WHERE EXISTS`. Para reativar após reset, o `ON CONFLICT` mantém `ACTIVE` se já estiver ativo.

---

## 4. Taxas de cartão (sandbox NetCred)

Após `db:reset`, os seeds em `platform_constants` podem estar desatualizados em relação ao sandbox. Para o exemplo **R$ 600 em 12x Visa** o valor correto é **R$ 633,70**.

```sql
UPDATE public.platform_constants SET value = '3.10'::jsonb WHERE key = 'cc_visa_master_1x_rate';
UPDATE public.platform_constants SET value = '3.80'::jsonb WHERE key = 'cc_visa_master_2_6x_rate';
UPDATE public.platform_constants SET value = '4.80'::jsonb WHERE key = 'cc_visa_master_7_12x_rate';
UPDATE public.platform_constants SET value = '3.80'::jsonb WHERE key = 'cc_elo_other_1x_rate';
UPDATE public.platform_constants SET value = '4.20'::jsonb WHERE key = 'cc_elo_other_2_6x_rate';
UPDATE public.platform_constants SET value = '5.20'::jsonb WHERE key = 'cc_elo_other_7_12x_rate';
UPDATE public.platform_constants SET value = '4.90'::jsonb WHERE key = 'cc_fixed_processing_fee_brl';

-- Conferir charge_amount para base 600, 12x, Visa
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT public.payment_total_with_card_fees(600::numeric, 'VCC', 12::smallint);
-- Esperado: 633.70
```

Fórmula atual (repasse ao cliente):

```
charge_amount = ROUND(base_amount × (1 + taxa%/100) + tarifa_fixa, 2)
```

---

## 5. Fluxo feliz na aplicação

1. **Cliente** aceita proposta com cartão (checkout no app).
2. `accept_proposal` cria `contracted_services` + `payment_schedules` em `SCHEDULED`.
3. `charge_scheduled_at` = T-2 antes da execução do serviço (normalmente ~48h no futuro).
4. No T-2 (ou forçado via SQL abaixo), o cron chama `schedule-netcred-charges` → NetCred `chargeCreate`.
5. Webhook confirma captura (ou o cron commita `PAID` direto no sucesso síncrono).

**Conferir schedule criado:**

```sql
SELECT
  ps.id AS schedule_id,
  ps.state,
  ps.base_amount,
  ps.provider_payout,
  ps.commission_rate_pct,
  ps.installment_number,
  ps.charge_scheduled_at,
  ps.charge_scheduled_at <= now() AS charge_due,
  cs.id AS service_id,
  cs.status AS service_status
FROM public.payment_schedules ps
JOIN public.contracted_services cs ON cs.id = ps.contracted_service_id
ORDER BY ps.created_at DESC
LIMIT 5;
```

---

## 6. Comandos por cenário

### 6.1 Forçar cobrança imediata (sem esperar T-2)

```sql
-- Substitua SCHEDULE_ID
UPDATE public.payment_schedules
SET charge_scheduled_at = now()
WHERE id = '<SCHEDULE_ID>'
  AND state IN ('SCHEDULED', 'FAILED');
```

Depois dispare o cron (com `yarn supabase functions serve` rodando):

```sql
SELECT public.payment_cron_schedule_netcred_charges();
```

### 6.2 Ver resultado da cobrança

```sql
SELECT
  ps.id,
  ps.state,
  ps.paid_amount,
  ps.gateway_charge_id,
  ps.gateway_transaction_id,
  ps.failure_code,
  ps.failure_reason,
  ps.automatic_attempt_count,
  cs.status AS service_status
FROM public.payment_schedules ps
JOIN public.contracted_services cs ON cs.id = ps.contracted_service_id
WHERE ps.id = '<SCHEDULE_ID>';

SELECT
  attempt_number,
  initiator,
  outcome,
  charge_amount,
  failure_code,
  failure_reason,
  completed_at
FROM public.payment_attempts
WHERE schedule_id = '<SCHEDULE_ID>'
ORDER BY attempt_number;

SELECT event_type, from_state, to_state, actor, created_at
FROM public.payment_audit_log
WHERE schedule_id = '<SCHEDULE_ID>'
ORDER BY created_at DESC
LIMIT 10;
```

### 6.3 Schedule preso em `PROCESSING` (órfão)

Lease expirou sem commit (EF caiu, RPC falhou, etc.):

```sql
SELECT public.payment_cron_recover_orphaned_schedules();
```

| Situação | Estado após recover |
|----------|---------------------|
| Sem `gateway_charge_id`, sem linha em `payment_attempts` | `IN_ANALYSIS` ou `FAILED` (incerto) |
| Com `gateway_charge_id` | `IN_ANALYSIS` → reconciliar |

### 6.4 Retentar após `FAILED` (sem charge na NetCred)

**Importante:** não defina `automatic_attempt_count` para um número que **já tenha** linha em `payment_attempts` — o commit trata como idempotente e não grava de novo.

```sql
-- 1. Recuperar órfãos
SELECT public.payment_cron_recover_orphaned_schedules();

-- 2. Liberar retentativa
UPDATE public.payment_schedules
SET
  state = 'FAILED',
  locked_until = null,
  next_retry_at = now(),
  failure_code = null,
  failure_reason = null
WHERE id = '<SCHEDULE_ID>'
  AND gateway_charge_id IS NULL;

-- 3. Cobrar (functions serve rodando)
SELECT public.payment_cron_schedule_netcred_charges();
```

O claim incrementa `automatic_attempt_count` automaticamente (+1 por tentativa).

### 6.5 Schedule em `IN_ANALYSIS` (charge pode existir na NetCred)

```sql
SELECT public.payment_cron_reconcile_netcred_payments();
```

Use quando há `gateway_charge_id` ou suspeita de cobrança criada mas estado local inconsistente.

### 6.6 Diagnosticar elegibilidade do cron

O `payment_claim_charge_batch` só pega schedules que atendem **todos** os critérios:

```sql
SELECT
  ps.id,
  ps.state,
  ps.charge_scheduled_at <= now() AS charge_due,
  ps.locked_until,
  ps.next_retry_at,
  ps.automatic_attempt_count,
  ps.max_attempts,
  cct.state AS card_state,
  pga.onboarding_status,
  pga.netcred_company_id,
  pga.netcred_bank_account_id,
  cs.status AS service_status
FROM public.payment_schedules ps
JOIN public.contracted_services cs ON cs.id = ps.contracted_service_id
JOIN public.client_card_tokens cct ON cct.id = ps.client_card_token_id
JOIN public.provider_gateway_accounts pga
  ON pga.provider_id = ps.provider_id AND pga.gateway_slug = ps.gateway_slug
WHERE ps.id = '<SCHEDULE_ID>';
```

Checklist:

- [ ] `state` ∈ `SCHEDULED`, `FAILED`
- [ ] `charge_scheduled_at <= now()`
- [ ] `locked_until` nulo ou expirado
- [ ] `next_retry_at` nulo ou `<= now()`
- [ ] `automatic_attempt_count < max_attempts` (default 3)
- [ ] Cartão `ACTIVE` e não expirado
- [ ] Prestador `onboarding_status = ACTIVE` com IDs NetCred
- [ ] Serviço não `CANCELLED` / `COMPLETED`

### 6.7 Ver logs do cron / Edge Function

```sql
SELECT
  job_name,
  started_at,
  finished_at,
  error_count,
  metadata->>'pg_net_request_id' AS pg_net_request_id,
  metadata->>'fatal_error' AS fatal_error
FROM public.job_runs
WHERE job_name LIKE '%netcred%' OR job_name LIKE '%payment%'
ORDER BY started_at DESC
LIMIT 10;
```

No terminal onde roda `yarn supabase functions serve`, acompanhe os logs de `schedule-netcred-charges` (eventos `charge_attempt_started`, `gateway_charge_create_rejected`, etc.).

### 6.8 Webhook — reprocessar fila

```sql
SELECT public.payment_cron_process_webhook_retry();
```

### 6.9 Limpar token NetCred em cache (auth stale)

```sql
DELETE FROM public.payment_gateway_tokens WHERE gateway_slug = 'netcred';
```

Útil se credenciais mudaram e a EF reutiliza JWT expirado.

---

## 7. Split esperado na cobrança

Para cada schedule (ADR-0001):

| Destino | Tipo | Valor |
|---------|------|-------|
| Prestador | `FIXED_AMOUNT` | `provider_payout` (ex.: 510 sobre base 600) |
| Plataforma | `PERCENTAGE` 100% | `charge_amount − provider_payout` |

Exemplo validado no sandbox (base 600, 12x, após correção NetCred de antecipação):

```
charge_amount   = 633,70
provider_payout = 510,00
plataforma      = 123,70  (90 comissão + 33,70 taxas repassadas ao cliente)
```

---

## 8. Sequência rápida pós-`db:reset`

```text
1. yarn supabase functions serve
2. SQL §3 — ativar prestador (1048 / 2053)
3. SQL §4 — taxas sandbox (633,70 para 600/12x)
4. App — aceitar proposta com cartão
5. SQL §6.1 — charge_scheduled_at = now()
6. SQL §6.1 — payment_cron_schedule_netcred_charges()
7. SQL §6.2 — conferir PAID + CONFIRMED
8. §11 — cancelamento pelo cliente + estorno (`process-refund`)
```

---

## 11. Cancelamento pelo cliente e estorno

### 11.1 Importante: UI vs API de pagamento

O botão de cancelar em **Meus serviços** (`cancel_service_request`) cancela o **pedido** (`service_request_id`) na fase de negociação.

Para serviço **já contratado e pago** (`contracted_services` + `payment_schedules.state = PAID`), o estorno passa pela Edge Function **`process-refund`**, com o UUID do **serviço contratado** (`contracted_services.id`), não o do pedido.

```
POST /functions/v1/process-refund
Authorization: Bearer <JWT do cliente>
{ "service_id": "<contracted_service_id>", "cancellation_reason": "CLIENT_INITIATED" }
```

### 11.2 Pré-requisitos

- Serviço em `PAID` com `gateway_transaction_id` preenchido (fluxo §5–§6).
- `yarn supabase functions serve` rodando.
- Secrets NetCred configurados (mesmos da cobrança).

### 11.3 Localizar o serviço contratado

```sql
SELECT
  cs.id AS contracted_service_id,
  cs.client_id,
  cs.status AS service_status,
  cs.scheduled_start_date,
  cs.scheduled_shift,
  cs.service_execution_at,
  ps.id AS schedule_id,
  ps.state AS schedule_state,
  ps.base_amount,
  ps.paid_amount,
  ps.gateway_transaction_id,
  ps.gateway_charge_id,
  sr.id AS service_request_id
FROM public.contracted_services cs
JOIN public.payment_schedules ps ON ps.contracted_service_id = cs.id
JOIN public.service_requests sr ON sr.contracted_service_id = cs.id
WHERE cs.client_id = (
  SELECT id FROM public.profiles WHERE email = 'cliente@renovi.com.br'
)
ORDER BY cs.created_at DESC
LIMIT 5;
```

Guarde `contracted_service_id` e `schedule_id`.

### 11.4 Simular faixa de penalidade (opcional)

`FULL_REFUND` estorna o **`charge_amount`** (valor pago, com taxas). Penalidades (`PENALTY_*`) incidem sobre **`base_amount`** (taxas de cartão não reembolsadas). Tiers (ToS §2.2):

| Tempo até execução | `penalty_tier` | Estorno (base R$ 600 / charge R$ 633,70) |
|--------------------|----------------|------------------------------------------|
| **> 48 h** | `FULL_REFUND` | R$ 633,70 |
| **12 h – 48 h** | `PENALTY_10` | R$ 540,00 |
| **< 12 h** | `PENALTY_30` | R$ 420,00 |

Pré-visualizar sem cancelar:

```sql
SELECT set_config('request.jwt.claim.role', 'service_role', true);

SELECT public.payment_calculate_refund_amount(
  633.70,   -- paid_amount / charge_amount
  600.00,   -- base_amount
  (SELECT service_execution_at FROM public.contracted_services WHERE id = '<CONTRACTED_SERVICE_ID>'),
  'client',
  now()
);
```

Para forçar estorno integral (> 48 h), ajuste a data do serviço **antes** de cancelar:

```sql
UPDATE public.contracted_services
SET
  scheduled_start_date = (current_date + interval '7 days')::date,
  scheduled_shift = 'morning'
WHERE id = '<CONTRACTED_SERVICE_ID>'
  AND status = 'CONFIRMED';
```

### 11.5 Obter JWT do cliente (seed)

```bash
# Chaves locais
npx supabase status -o env | grep -E 'ANON_KEY|API_URL'

# Login (senha seed: Abc123)
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@renovi.com.br","password":"Abc123"}' \
  | jq -r '.access_token'
```

### 11.6 Disparar cancelamento + estorno (pós-PAID)

```bash
export CLIENT_JWT="<access_token>"
export SERVICE_ID="<contracted_service_id>"

curl -s -X POST 'http://127.0.0.1:54321/functions/v1/process-refund' \
  -H "Authorization: Bearer $CLIENT_JWT" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"service_id\":\"$SERVICE_ID\",\"cancellation_reason\":\"CLIENT_INITIATED\"}" \
  | jq .
```

**Resposta esperada (sucesso):**

```json
{
  "schedule_id": "...",
  "refund_amount": "633.70",
  "penalty_tier": "FULL_REFUND",
  "expected_days": "30-60"
}
```

A EF chama `payment_begin_refund_request` (RPC) e em seguida `transactionRefund` na NetCred.

### 11.7 Conferir no banco

```sql
SELECT
  cs.id,
  cs.status AS service_status,
  cs.cancellation_reason,
  ps.state AS schedule_state,
  ps.refunded_amount,
  ps.cancellation_reason AS schedule_cancel_reason
FROM public.contracted_services cs
JOIN public.payment_schedules ps ON ps.contracted_service_id = cs.id
WHERE cs.id = '<CONTRACTED_SERVICE_ID>';

SELECT event_type, from_state, to_state, actor, metadata, created_at
FROM public.payment_audit_log
WHERE schedule_id = '<SCHEDULE_ID>'
ORDER BY created_at DESC
LIMIT 10;
```

Após a EF:

| Campo | Esperado |
|-------|----------|
| `contracted_services.status` | `CANCELLED` |
| `payment_schedules.state` | `REFUND_REQUESTED` (imediatamente) |
| Audit | `REFUND_SUBMITTED` |

Após webhook `TRANSACTION_REFUND` da NetCred (ou reconciliação):

| Campo | Esperado |
|-------|----------|
| `payment_schedules.state` | `REFUNDED` ou `PARTIALLY_REFUNDED` |
| `payment_schedules.refunded_amount` | valor estornado |

### 11.8 Se o webhook não chegar

```sql
SELECT public.payment_cron_reconcile_netcred_payments();
SELECT public.payment_cron_process_webhook_retry();
```

Monitore `yarn supabase functions serve` (logs de `reconcile-netcred-payments` e `netcred-webhook`).

### 11.9 Cancelamento pré-PAID (sem estorno no gateway)

Se o schedule ainda está `SCHEDULED` / `FAILED` / `FAILED_PERMANENT` (cobrança não capturada), a mesma EF retorna `PRE_CHARGE_CANCELLED` — **sem** chamar a NetCred:

```bash
# Mesmo curl §11.6; schedule deve estar SCHEDULED/FAILED
```

Ou via RPC encadeado (como o app fará no futuro):

```sql
-- Autenticado como cliente no SQL editor não funciona diretamente;
-- use a EF process-refund ou, em dev com service_role:
SELECT set_config('request.jwt.claim.role', 'service_role', true);

SELECT public.payment_pre_charge_cancel(
  p_service_id := '<CONTRACTED_SERVICE_ID>',
  p_actor_id := (SELECT client_id FROM public.contracted_services WHERE id = '<CONTRACTED_SERVICE_ID>'),
  p_cancellation_reason := 'CLIENT_INITIATED',
  p_initiator := 'client'
);
```

Esperado: `payment_schedules.state = CANCELLED`, serviço `CANCELLED`, sem `transactionRefund`.

### 11.10 Bloqueios conhecidos

| Condição | Erro | O que fazer |
|----------|------|-------------|
| `schedule.state = IN_ANALYSIS` | `PAYMENT_IN_ANALYSIS` | Aguardar antifraude ou reconciliar |
| Schedule `PROCESSING` | `INVALID_SCHEDULE_STATE` | §6.3 recover orphan |
| Sem `gateway_transaction_id` em PAID | `TRANSACTION_NOT_FOUND` | Cobrança incompleta — refazer fluxo §6 |
| JWT de outro usuário | `FORBIDDEN` | Usar token do `client_id` do serviço |
| Estorno já solicitado | `already_submitted: true` | Idempotente; conferir NetCred |

### 11.11 Sequência rápida (estorno pós-PAID)

```text
1. Fluxo §8 — serviço PAID (paid_amount 633,70, base 600)
2. SQL §11.3 — contracted_service_id
3. SQL §11.4 — (opcional) ajustar data para FULL_REFUND
4. §11.5 — JWT cliente@renovi.com.br
5. §11.6 — POST process-refund
6. SQL §11.7 — REFUND_REQUESTED + CANCELLED
7. Webhook ou §11.8 — REFUNDED
```

---

## 9. Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Cron não cobra | `charge_scheduled_at` no futuro | §6.1 |
| Cron não cobra | Prestador não `ACTIVE` | §3 |
| `PROVIDER_NOT_CREDENTIALED` nos logs | Sem `netcred_company_id` / `bank_account_id` | §3 |
| `AMOUNT_TOO_GREAT_FOR_FIXED_AMOUNT_PAYOUT_RULE` | `charge_amount` baixo demais para split + parcelas | Conferir taxas §4; validar com NetCred |
| Schedule em `PROCESSING` eterno | Commit falhou / EF parou | §6.3 |
| Retentativa não grava attempt | `attempt_number` duplicado | Não resetar `automatic_attempt_count` para valor já usado §6.4 |
| Webhook 503 / 511 | Tunnel / localtunnel | `yarn enable-webhook`, `maskUserAgent: false` |
| `617,13` em vez de `633,70` | Seeds antigos | §4 |

---

## 10. Referências de IDs (última sessão de teste)

Valores de exemplo — **substitua** após novo `db:reset` / novo fluxo:

| Entidade | UUID |
|----------|------|
| Prestador (João) | `5d09e025-20a2-4842-aeef-324d42a431e1` |
| NetCred company | `1048` |
| NetCred bank (prestador) | `2053` |
| NetCred bank (plataforma) | `2052` (env `NETCRED_PLATFORM_BANK_ACCOUNT_ID`) |
