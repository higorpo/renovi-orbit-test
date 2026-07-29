# BUG CRÍTICO — Cancelamento pós-pagamento com commit parcial (serviço cancelado sem estorno garantido)

**Severidade:** Crítica (financeira + integridade + UX)  
**Status:** **Corrigido / Resolved** (2026-07-29) — Opção A (gateway first) + recovery via reconcile/webhook  
**Data do relato:** 2026-07-21  
**Data da correção:** ~2026-07-29  
**Aliases / rastreio:** CHK-008 / CHK-S7-001 (`checkout-security-remediation-pack.md`); design.md §4.8 / §8.1  
**Invariant de produto (obrigatório):** *ou o cliente solicita o reembolso e o sistema de fato encaminha o estorno ao gateway, ou nada é alterado* (serviço, chat e parcela permanecem como estavam). Estado intermediário “serviço cancelado + dinheiro não estornado e sem retry automático” é **bug grave**.

---

## 1. O que aconteceu (incidente observado)

Cenário: cliente cancela serviço **já cobrado** (`payment_schedules.state = PAID`), com faixa ToS de multa 10% (mensagem de chat: reembolso de 90% do valor do serviço; taxas de cartão não reembolsadas).

### Sintomas no produto (pré-fix)

| Observação | Resultado |
|------------|-----------|
| Toast / mensagem no frontend | Erro: não foi possível cancelar o serviço |
| `contracted_services` | Já `CANCELLED` |
| Chat | Encerrado; mensagem SYSTEM informando cancelamento + política de reembolso 90% |
| `payment_schedules.state` | `REFUND_REQUESTED` |
| Estorno na NetCred | **Não garantido** (falha na chamada `refundTransaction` após o commit no banco) |
| Dinheiro no cartão do cliente | Pode permanecer capturado enquanto o produto já prometeu/comunicou cancelamento e estorno |

O cliente via **falha** na UI, mas o domínio de serviço/chat já avançava como se o cancelamento tivesse sucesso. A parcela ficava em limbo financeiro.

---

## 2. Causa raiz (pré-fix — cancel first)

### 2.1 Ordem antiga do fluxo `process-refund` (pós-`PAID`)

```
UI  →  Edge process-refund
         │
         ├─(1) RPC (cancel-first)  ── COMMIT no Postgres ──┐
         │       • payment_schedules → REFUND_REQUESTED      │
         │       • refunded_amount = valor esperado (ToS)    │
         │       • contracted_services → CANCELLED           │ IRREVERSÍVEL
         │       • fecha chat + mensagem de cancelamento     │ neste passo
         │       • refund_submit_status ainda sem ACK        │
         │                                                    │
         └─(2) NetCred refundTransaction  ←── só depois ─────┘
                 │
                 ├─ sucesso → mark SUBMITTED → HTTP 200 → UI sucesso
                 │
                 └─ falha    → mark FAILED → HTTP 500 → UI erro
                                MAS passo (1) já commitado
```

### 2.2 Consequência

Se o passo (2) falhasse, **não havia** worker que reenviasse o estorno de forma confiável. O cron de reconciliação só alinhava estado se o gateway **já** estivesse reembolsado. Retry pelo app quase não acontecia (serviço já `CANCELLED`).

---

## 3. Correção implementada (2026-07-29) — Opção A + recovery

### 3.1 Ordem atual (gateway first) — caminho `PAID`

```
UI  →  Edge process-refund
         │
         ├─(1) RPC payment_prepare_refund_request  (somente leitura / validação)
         │       • calcula ToS / refund_amount
         │       • NÃO cancela serviço/chat
         │       • NÃO muda state da parcela (permanece PAID)
         │
         ├─(2) NetCred refundTransaction
         │       │
         │       ├─ falha → HTTP 500; zero mutações irreversíveis
         │       │
         │       └─ sucesso / ALREADY_REFUNDED ↓
         │
         └─(3) RPC payment_commit_refund_after_gateway
                 • REFUND_REQUESTED + refund_submit_status = SUBMITTED
                 • CANCELLED serviço + fecha chat + mensagem
                 • refunded_amount esperado
```

Se o gateway ACK’d e o commit DB falhar: `payment_mark_refund_gateway_acked` marca `PAID` + `SUBMITTED` (sem cancelar) para crash recovery; reconcile/webhook completam o cancel via `payment_complete_refund_domain_side_effects`.

### 3.2 RPCs — papel

| RPC | Papel |
|-----|--------|
| `payment_prepare_refund_request` | Validação + cálculo ToS **sem** cancelar |
| `payment_commit_refund_after_gateway` | Após ACK do gateway: cancel + chat + `REFUND_REQUESTED` + `SUBMITTED` |
| `payment_mark_refund_gateway_acked` | Recovery: `PAID` + `SUBMITTED` quando gateway ACK’d mas commit falhou |
| `payment_complete_refund_domain_side_effects` | Completa cancel de serviço/chat (usado por commit, reconcile e webhook) |

### 3.3 Reconcile e webhook

- **Reconcile** (`reconcile-netcred-payments`):
  - Claim inclui `PAID` + `SUBMITTED` (sem `refunded_at`) para crash recovery.
  - Se gateway já `REFUNDED`/`PARTIALLY_REFUNDED`: aplica confirmação e completa cancel de domínio se o serviço ainda estiver aberto.
- **Webhook** (`TRANSACTION_REFUND`): se o serviço ainda estiver aberto, completa side effects de cancelamento de domínio.

### 3.4 UX

| Situação | Comportamento |
|----------|----------------|
| Gateway falhou e nada foi cancelado | “Não foi possível processar o cancelamento/reembolso. Tente novamente.” |
| Sucesso do envio ao gateway | Toast de cancelamento + prazo 30–60 dias na fatura |
| `REFUND_REQUESTED` sem `refunded_at` | Histórico: “Reembolso solicitado / em processamento” |

### 3.5 Invariante pós-fix

- **Sucesso:** gateway aceita o pedido (ou `ALREADY_REFUNDED`) **e então** o sistema cancela serviço/chat e marca `REFUND_REQUESTED` + `SUBMITTED`.
- **Falha no caminho `PAID`:** zero mutação irreversível — permanece `PAID` + serviço ativo; UI permite nova tentativa.
- Confirmação final `REFUNDED` / `PARTIALLY_REFUNDED` continua assíncrona (webhook/reconcile).

---

## 4. Referências de código e docs

| Artefato | Papel |
|----------|--------|
| `supabase/functions/process-refund/handleRequest.ts` | Opção A: prepare → gateway → commit |
| `payment_prepare_refund_request` / `payment_commit_refund_after_gateway` / `payment_mark_refund_gateway_acked` / `payment_complete_refund_domain_side_effects` | RPCs Opção A + recovery |
| `payment_set_refund_submit_status` | ACK machine do envio ao gateway |
| `supabase/functions/reconcile-netcred-payments/` | Confirma REFUNDED; claim PAID+SUBMITTED; completa cancel de domínio |
| `src/features/payments/api/refund.api.ts` | Mapeia `refund_failed`; toast de sucesso com prazo 30–60 dias |
| `docs/business/modulos/payments/features/historico-e-reembolso.md` | Comportamento de negócio pós-fix |
| `checkout-security-remediation-pack.md` → CHK-008 | Idempotência / ACK; supersedido pela Opção A |

---

## 5. Encerramento

1. ~~Bloqueador de go-live~~ — invariante §3.5 implementado (Opção A) com recovery (reconcile/webhook) e cobertura de teste (pgTAP + Deno).
2. Documentação de design (§4.8 / §8.1) e feature de reembolso atualizadas para gateway-first.
3. Pendência de negócio **P-12** encerrada como resolvida.
