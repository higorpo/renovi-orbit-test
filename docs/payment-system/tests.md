Checklist de fluxos para cobrir o que o `design.md` (§4) e o `tasks.md` (fases 8–11 + verification) entregaram. Ordem sugerida: do caminho feliz ao edge case.

---

### 1. Credenciamento do prestador (KYC / NetCred)

| # | Fluxo | O que validar |
|---|--------|----------------|
| 1.1 | Submit KYC completo | Upload docs → `payment_submit_provider_kyc` → status `DOCUMENTS_SUBMITTED` → email `dispatch-kyc-email` |
| 1.2 | Retry de email KYC | Falha no envio não reverte status; retry até `email_dispatched_at` |
| 1.3 | Gate sem ACTIVE | Prestador não ACTIVE: matching vazio + não inicia conversa |
| 1.4 | Cron onboarding | `detect-netcred-onboarding`: ACTIVE / UNDER_REVIEW / edges vazios / múltiplos edges (Sentry) |
| 1.5 | UI de status | Telas “aguardando análise”, ACTIVE, bloqueio em Meus Serviços |

---

### 2. Checkout do cliente (aceite + pagamento)

| # | Fluxo | O que validar |
|---|--------|----------------|
| 2.1 | Stepper incompleto | CPF → telefone → cartão → parcelas → confirmação (só steps necessários) |
| 2.2 | Stepper completo | Pula CPF/telefone se já existem; lista cartões via `client_card_tokens_safe_v` |
| 2.3 | Novo cartão | Tokenização PCI; PAN/CVV não persistem; billing address obrigatório |
| 2.4 | Cartão salvo | Seleção + parcelas por bandeira |
| 2.5 | ClearSale | UUID estável na sessão; novo UUID se remonta; falha do SDK não bloqueia |
| 2.6 | Parcelas + HMAC | Opções corretas; HMAC expirado/adulterado rejeitado |
| 2.7 | Aceite happy path | `PENDING_PAYMENT` + schedule `SCHEDULED`; prestador **não** vê calendário |
| 2.8 | Aceite emergência (&lt;48h) | `charge_scheduled_at ≈ now()` + disclosure no checkout |
| 2.9 | Idempotência | Double-submit / retry com mesmo `idempotency_key` → mesmo serviço |
| 2.10 | Prestador não ACTIVE | Aceite bloqueado |
| 2.11 | Push pós-aceite | Prestador: “aguardando confirmação do pagamento” (não “confirmado”) |

Cartões sandbox (do seu `todo.md`): aprovado `4970100000000048` / rejeitado `4970100000000071`; CPF terminando em `1` aprova, outro dígito rejeita.

---

### 3. Cartões salvos (perfil)

| # | Fluxo | O que validar |
|---|--------|----------------|
| 3.1 | Listar / adicionar / revogar | `payment_revoke_client_card_token`; cartão revogado some do checkout |

---

### 4. Cobrança automática T-2

| # | Fluxo | O que validar |
|---|--------|----------------|
| 4.1 | PAID síncrono | Cron → `chargeCreate` → `PAID` → serviço `CONFIRMED` + calendário + push |
| 4.2 | IN_ANALYSIS | Schedule `IN_ANALYSIS`; cliente vê; prestador ainda sem calendário |
| 4.3 | REJECTED / terminal | → `FAILED_PERMANENT` (cartão, CPF inválido, etc.) |
| 4.4 | Retryable | Timeout/5xx → `FAILED` + `next_retry_at`; re-cobrança |
| 4.5 | Fee drift | `charge_amount` recalculado no T-2 (não o do HMAC) |
| 4.6 | Split ADR-0001 | Provider FIXED + Renovi PERCENTAGE |
| 4.7 | PAID &lt;24h | Push urgente ao prestador |
| 4.8 | Notificação pré-cobrança | 24h antes (exceto emergência) |

---

### 5. Recuperação / falhas de cobrança

| # | Fluxo | O que validar |
|---|--------|----------------|
| 5.1 | Orphan lease | `PROCESSING` + lease expirado → janitor → `SCHEDULED`/`FAILED` |
| 5.2 | Reconcile pós-timeout | `getTransaction` antes de novo `chargeCreate`; conflict de `referenceCode` |
| 5.3 | Troca de método | `payment_update_method` em `SCHEDULED`/`FAILED`/`FAILED_PERMANENT` (mesmo brand vs brand nova + HMAC) |
| 5.4 | Cobrança manual | UI “Efetuar Pagamento” + ClearSale **novo** UUID + `gateway_reference_code` rotacionado |
| 5.5 | Race cron × manual | Um ganha; outro `409 PAYMENT_ALREADY_IN_PROGRESS` |
| 5.6 | Gate T-12h | Manual bloqueado perto demais da execução |

---

### 6. Webhooks NetCred

| # | Fluxo | O que validar |
|---|--------|----------------|
| 6.1 | CAPTURE → PAID | Confirma captura / promove a `CONFIRMED` |
| 6.2 | UPDATE (heavy) | Enfileira; cron processa |
| 6.3 | REFUND / VOID / EXPIRED | Transições corretas |
| 6.4 | DISPUTE | `is_disputed` + badge + push; status do serviço **não** muda |
| 6.5 | Profile tokenize/update/delete/expiring | Estado do cartão + notificação |
| 6.6 | Assinatura inválida | HTTP 401; evento marcado failed |
| 6.7 | Duplicata | HTTP 200; `is_duplicate` |
| 6.8 | Dead letter | 3 falhas → `DEAD_LETTER` → reset operador |

---

### 7. Cancelamento e estorno

| # | Fluxo | O que validar |
|---|--------|----------------|
| 7.1 | Pré-T2 (não cobrado) | Cancel sem gateway → `CANCELLED` |
| 7.2 | Pós-PAID cliente &gt;48h | Full refund (`charge_amount`) |
| 7.3 | Pós-PAID 12–48h | `PENALTY_10` (90% do `base_amount`) |
| 7.4 | Pós-PAID &lt;12h | `PENALTY_30` (70% do `base_amount`) |
| 7.5 | Cancel pelo prestador | Full refund (inclui taxas) |
| 7.6 | Bloqueio em IN_ANALYSIS | Cliente recebe `PAYMENT_IN_ANALYSIS` até T-12h |
| 7.7 | Webhook confirma refund | `REFUND_REQUESTED` → `REFUNDED` / `PARTIALLY_REFUNDED` |

---

### 8. Auto-cancel T-12h e suspensão

| # | Fluxo | O que validar |
|---|--------|----------------|
| 8.1 | Não pago no T-12h | `NON_PAYMENT` + notificação |
| 8.2 | IN_ANALYSIS no T-12h | Cancel + void/reconcile gateway |
| 8.3 | IN_ANALYSIS antes do T-12h | **Não** auto-cancela |
| 8.4 | Prestador SUSPENDED | Cron não cobra; notifica cliente; auto-cancel `PROVIDER_SUSPENDED`; reativação **não** retoma sozinha |

---

### 9. Reagendamento

| # | Fluxo | O que validar |
|---|--------|----------------|
| 9.1 | Pré-PAID | Recalcula `charge_scheduled_at`, T-12h, pré-cobrança |
| 9.2 | Pós-PAID (CONFIRMED) | Só slot; sem nova cobrança; tiers de refund usam nova data |
| 9.3 | Após EXECUTED | Reagendamento bloqueado |

---

### 10. Conclusão do serviço

| # | Fluxo | O que validar |
|---|--------|----------------|
| 10.1 | Prestador marca EXECUTED | Só em `CONFIRMED` e na/após data; push ao cliente |
| 10.2 | Cliente confirma COMPLETED | `payment_confirm_service_completed` |
| 10.3 | Auto-complete 24h | Cron → `completed_by = system` |
| 10.4 | Dispute não bloqueia | `is_disputed` ainda permite COMPLETED |

---

### 11. Históricos e settlement

| # | Fluxo | O que validar |
|---|--------|----------------|
| 11.1 | Histórico cliente | `paid_amount` / `base_amount` / estornos; sem `provider_payout` |
| 11.2 | Recebíveis prestador | `provider_payout` + disclosure D+30 a partir de `paid_at` |
| 11.3 | Badge de dispute | Cliente e prestador no detalhe/lista |

---

### 12. Segurança / regressão (rápido)

| # | Fluxo | O que validar |
|---|--------|----------------|
| 12.1 | HMAC adulterado / expirado | Aceite e `update_method` rejeitam |
| 12.2 | Rate limit | Webhook e manual charge |
| 12.3 | RLS | Cliente/prestador não leem tabelas `payment_*` cruas indevidas |

---

### Ordem mínima se o tempo for curto

1. KYC → ACTIVE (ou seed do [runbook local](docs/payment-system/local-dev-payment-test-runbook.md))  
2. Checkout happy path → schedule  
3. Forçar T-2 → PAID → calendário prestador  
4. Cartão rejeitado / CPF rejeitado → `FAILED_PERMANENT` → cobrança manual  
5. Cancel pré-cobrança + 1 estorno pós-PAID (tier de multa)  
6. Auto-cancel T-12h  
7. EXECUTED → COMPLETED (manual + auto)  
8. Históricos + D+30  

Referência operacional local: `docs/payment-system/local-dev-payment-test-runbook.md`.