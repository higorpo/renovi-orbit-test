# BUG CRÍTICO — Cancelamento pós-pagamento com commit parcial (serviço cancelado sem estorno garantido)

**Severidade:** Crítica (financeira + integridade + UX)  
**Status:** Aberto — comportamento atual inaceitável para produção  
**Data do relato:** 2026-07-21  
**Aliases / rastreio:** CHK-008 / CHK-S7-001 (`checkout-security-remediation-pack.md`); design.md §8.1 (`transactionRefund` failure)  
**Invariant de produto (obrigatório):** *ou o cliente solicita o reembolso e o sistema de fato encaminha o estorno ao gateway, ou nada é alterado* (serviço, chat e parcela permanecem como estavam). Estado intermediário “serviço cancelado + dinheiro não estornado e sem retry automático” é **bug grave**.

---

## 1. O que aconteceu (incidente observado)

Cenário: cliente cancela serviço **já cobrado** (`payment_schedules.state = PAID`), com faixa ToS de multa 10% (mensagem de chat: reembolso de 90% do valor do serviço; taxas de cartão não reembolsadas).

### Sintomas no produto

| Observação | Resultado |
|------------|-----------|
| Toast / mensagem no frontend | Erro: não foi possível cancelar o serviço |
| `contracted_services` | Já `CANCELLED` |
| Chat | Encerrado; mensagem SYSTEM informando cancelamento + política de reembolso 90% |
| `payment_schedules.state` | `REFUND_REQUESTED` |
| Estorno na NetCred | **Não garantido** (falha na chamada `refundTransaction` após o commit no banco) |
| Dinheiro no cartão do cliente | Pode permanecer capturado enquanto o produto já prometeu/comunicou cancelamento e estorno |

O cliente vê **falha** na UI, mas o domínio de serviço/chat já avançou como se o cancelamento tivesse sucesso. A parcela fica em limbo financeiro.

---

## 2. Comportamento atual (como o código funciona hoje)

### 2.1 Ordem real do fluxo `process-refund` (pós-`PAID`)

```
UI  →  Edge process-refund
         │
         ├─(1) RPC payment_begin_refund_request  ── COMMIT no Postgres ──┐
         │       • payment_schedules → REFUND_REQUESTED                   │
         │       • refunded_amount = valor esperado (ToS)                 │
         │       • contracted_services → CANCELLED                        │ IRREVERSÍVEL
         │       • fecha chat + mensagem de cancelamento/reembolso        │ neste passo
         │       • refund_submit_status ainda sem ACK do gateway          │
         │                                                               │
         └─(2) NetCred refundTransaction  ←── só depois do commit ───────┘
                 │
                 ├─ sucesso → mark SUBMITTED → HTTP 200 → UI sucesso
                 │              (confirmação final REFUNDED ainda é async: webhook)
                 │
                 └─ falha    → mark FAILED → HTTP 500 → UI erro
                                MAS passo (1) já commitado
```

Evidência: `supabase/functions/process-refund/handleRequest.ts` (chama `submitRefundRequest` / RPC **antes** de `refundTransaction`); RPC `payment_begin_refund_request` (migrations de refund + cancel chat).

### 2.2 O que `REFUND_REQUESTED` significa hoje

Estado **transicional** no banco:

- Serviço e chat já tratados como cancelados.
- `refunded_amount` = valor **esperado** (histórico do cliente pode mostrar breakdown).
- `refunded_at` permanece `null` até webhook/`TRANSACTION_REFUND` ou reconciliação ver `REFUNDED` no gateway.
- `refund_submit_status` distingue se a NetCred ACK’d o pedido (`FAILED` | `PENDING_GATEWAY` | `SUBMITTED` | `CONFIRMED`).

### 2.3 Quem “consome” o estorno depois

| Ator | Envia `refundTransaction` à NetCred? | Confirma `REFUNDED`? |
|------|--------------------------------------|----------------------|
| Edge `process-refund` (ação do usuário no cancelamento) | **Sim — único caminho** | Não (só SUBMITTED) |
| Webhook `netcred-webhook` (`TRANSACTION_REFUND`) | Não | Sim |
| Cron `reconcile-netcred-payments` | **Não** — só `getTransaction` e alinha estado se o gateway **já** estiver reembolsado | Só se NetCred já tiver o refund |
| Outro cron / fila de retry de estorno | **Não existe** | — |

Consequência: se o passo (2) falhar, **não há worker automático** que reenvie o estorno. O cron de reconciliação **não cria** refund na NetCred; se o gateway ainda estiver `PAID`, a parcela permanece `REFUND_REQUESTED` indefinidamente (ops via Sentry / runbook manual).

### 2.4 Por que o retry pelo app quase não acontece

Após o passo (1):

- Serviço já está `CANCELLED` → UI bloqueia novo cancelamento (`canCancelContractedService` / `SERVICE_NOT_CANCELLABLE`).
- O cliente **não** tem um botão óbvio de “tentar estorno de novo”.
- Retry técnico existiria só reinvocando `process-refund` (ops / suporte / chamada manual), enquanto `refund_submit_status` ≠ ACK.

### 2.5 UX inconsistente (agrava o incidente)

- Backend: domínio de serviço/chat = sucesso de cancelamento.
- Frontend: trata `refund_failed` / HTTP 500 como “não foi possível cancelar”.
- Chat: mensagem afirmativa de cancelamento + política de reembolso.

Três verdades conflitantes ao mesmo tempo.

---

## 3. Por que isso é gravíssimo

1. **Quebra do invariante all-or-nothing:** o cliente pediu reembolso; o sistema cancelou o serviço e comunicou o estorno, mas o gateway pode nunca ter recebido o `transactionRefund`.
2. **Risco financeiro direto:** captura permanece; cliente pode cobrar na justiça / chargeback; plataforma fica com obrigação moral e operacional sem estado confiável.
3. **Ops cego se Sentry/alerta falhar:** sem fila de retry, cada falha de NetCred vira ticket manual; escala mal.
4. **Confiança e suporte:** cliente vê erro, tenta de novo, não consegue (serviço já cancelado), e o histórico mostra “Reembolso solicitado” sem `refunded_at`.
5. **Parcialmente conhecido e ainda aberto:** CHK-008 cobriu o caso “retry retorna sucesso sem reenviar gateway”; o caso “primeira falha + commit irreversível + sem consumer” é o mesmo núcleo de desenho e permanece crítico.

---

## 4. O que deveria ser o comportamento correto

### 4.1 Invariante de produto (não negociável)

Para cancelamento **pós-cobrança** (`PAID`):

- **Sucesso:** gateway aceita o pedido de estorno (ou responde `ALREADY_REFUNDED`) **e** então o sistema cancela serviço/chat e marca a parcela de forma coerente (`REFUND_REQUESTED` + `refund_submit_status = SUBMITTED`, ou equivalente).
- **Falha:** **nenhuma** mutação irreversível de serviço/chat/parcela — permanece `PAID` + serviço ativo; UI mostra erro e permite nova tentativa.
- Confirmação final `REFUNDED` / `PARTIALLY_REFUNDED` continua podendo ser assíncrona (webhook), **desde que** o envio ao gateway tenha sido ACK’d de forma durável e haja recovery automático se o ACK falhar após envio.

Nunca: “serviço cancelado + mensagem de reembolso no chat + parcela `REFUND_REQUESTED` sem garantia de envio ao gateway e sem retry automático”.

### 4.2 Direções de correção (engenharia)

Escolher e implementar uma estratégia (ou combinação) — a ordem abaixo prioriza segurança financeira:

#### Opção A — Gateway first, depois commit de cancelamento (preferida para all-or-nothing)

1. Validar elegibilidade (auth, estado `PAID`, cálculo ToS) **sem** cancelar serviço.
2. Chamar `refundTransaction` na NetCred.
3. Só em sucesso / `ALREADY_REFUNDED`: em **uma** TX, `REFUND_REQUESTED` + cancel serviço + fechar chat + `refund_submit_status = SUBMITTED`.
4. Em falha: zero efeito colateral; HTTP erro; usuário tenta de novo.

**Cuidados:** idempotência (mesmo `referenceCode` / valor); se NetCred aceitar e o commit DB falhar depois, precisar de reconciliação que detecte refund no gateway e complete o cancel (ver Opção C).

#### Opção B — Commit “intenção” sem cancelar serviço até ACK

1. TX: marca intenção (`refund_submit_status = PENDING_GATEWAY`, schedule ainda `PAID` ou estado explícito `REFUND_PENDING` **sem** cancelar serviço/chat).
2. Chama gateway.
3. Sucesso → segunda TX: `REFUND_REQUESTED` + cancel + chat + `SUBMITTED`.
4. Falha → reverte intenção ou marca `FAILED` mantendo serviço ativo; UI permite retry.

#### Opção C — Se mantiver ordem atual (cancel first): fila obrigatória de retry

Só aceitável com **todas** as salvaguardas:

1. Worker/cron dedicado que seleciona `REFUND_REQUESTED` + `refund_submit_status IN (FAILED, PENDING_GATEWAY)` e reenvia `refundTransaction` com backoff.
2. Alertas CRITICAL + painel ops para idade > N minutos sem `SUBMITTED`/`CONFIRMED`.
3. UI: se cancelamento DB ok e gateway falhou, **não** mentir “não cancelou”; dizer “serviço cancelado; estorno pendente — tentaremos de novo” + suporte.
4. Botão/ação de retry acessível (ou automático) enquanto gateway não ACK’d.
5. Reconcile deve, se gateway ainda `PAID` e intenção de refund ativa, **re-disparar** refund (hoje não faz isso).

Sem a fila (1), a ordem atual é **inaceitável**.

#### Opção D — Compensating transaction (pior UX, mas honesta)

Se gateway falhar após cancel: **reverter** cancelamento (serviço/chat) até o estorno ser possível — complexo (mensagens já enviadas, notificações) e frágil; só como mitigação temporária.

### 4.3 Correções de UX (obrigatórias em qualquer opção)

| Situação | Mensagem / comportamento |
|----------|---------------------------|
| Gateway falhou e **nada** foi cancelado | “Não foi possível processar o cancelamento/reembolso. Tente novamente.” |
| Gateway falhou e serviço **já** foi cancelado (estado legado até o fix) | Nunca “não foi possível cancelar”; comunicar pendência de estorno + suporte |
| Sucesso do envio ao gateway | Sucesso de cancelamento + prazo 30–60 dias na fatura |
| `REFUND_REQUESTED` sem `refunded_at` | Histórico: “Reembolso solicitado / em processamento” — sem afirmar crédito na fatura |

### 4.4 Testes mínimos de aceite do fix

1. NetCred falha na 1ª tentativa → **serviço permanece não cancelado** (ou intenção reversível); parcela não fica em limbo sem consumer.
2. NetCred sucesso → serviço cancelado + chat + `SUBMITTED` + depois webhook → `REFUNDED`/`PARTIALLY_REFUNDED`.
3. NetCred sucesso, crash antes do commit DB → reconcile/worker completa cancelamento a partir do estado do gateway.
4. Retry idempotente não duplica estorno indevido (`ALREADY_REFUNDED` / ACK machine).
5. UI nunca mostra “cancelamento falhou” quando o serviço já está `CANCELLED`.
6. pgTAP + Deno cobrindo fail-closed e retry até ACK (estender cobertura CHK-008).

---

## 5. Mitigação operacional (enquanto o fix não sobe)

Para cada linha em `payment_schedules` com `state = 'REFUND_REQUESTED'` e `refund_submit_status` ∈ (`FAILED`, `null`, `PENDING_GATEWAY`) e `refunded_at IS NULL`:

1. Verificar na NetCred (`getTransaction`) se já existe refund.
2. Se **não** houver: reinvocar Edge `process-refund` (service role / fluxo ops) ou executar `refundTransaction` com o `refunded_amount` esperado e marcar `SUBMITTED`.
3. Se **já** houver: forçar reconcile / processar webhook para `REFUNDED`/`PARTIALLY_REFUNDED`.
4. Contatar cliente se atraso > SLA interno; não depender só do toast de erro original.

Query de caça (ops):

```sql
select
  ps.id,
  ps.contracted_service_id,
  ps.state,
  ps.refund_submit_status,
  ps.refunded_amount,
  ps.refunded_at,
  ps.updated_at,
  cs.status as service_status
from public.payment_schedules ps
join public.contracted_services cs on cs.id = ps.contracted_service_id
where ps.state = 'REFUND_REQUESTED'
  and ps.refunded_at is null
order by ps.updated_at;
```

---

## 6. Referências de código e docs

| Artefato | Papel |
|----------|--------|
| `supabase/functions/process-refund/handleRequest.ts` | Orquestra RPC → gateway → resposta UI |
| `payment_begin_refund_request` (migrations `20260801360000_*`, `20260802070000_*`, `20260801850000_*`, …) | Commit cancel + `REFUND_REQUESTED` |
| `payment_set_refund_submit_status` | ACK machine do envio ao gateway |
| `supabase/functions/reconcile-netcred-payments/` | Só confirma se gateway já reembolsou; **não** submete refund |
| `src/features/payments/api/refund.api.ts` | Mapeia `refund_failed` → erro de cancelamento na UI |
| `docs/business/modulos/payments/features/historico-e-reembolso.md` | Comportamento documentado de histórico / retry até ACK |
| `checkout-security-remediation-pack.md` → CHK-008 | Idempotência indevida `already_submitted` sem ACK |

---

## 7. Decisão pedida / próximo passo de engenharia

1. Tratar este documento como **bloqueador de go-live** de pagamentos pós-cobrança até o invariante §4.1 estar implementado e testado.
2. Preferir **Opção A** (gateway first) ou **B** (intenção sem cancelar); se permanecer cancel-first, **Opção C completa** (fila de retry) é mandatória.
3. Atualizar `design.md` §4.8 / §8.1 e o feature doc de reembolso após o fix — remover a semântica “falha de gateway → fica `REFUND_REQUESTED` + escalação manual” como caminho feliz de recovery.
