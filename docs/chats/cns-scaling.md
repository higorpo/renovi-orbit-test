# CNS — escalonamento, partições e cron com SKIP LOCKED

Nota de engenharia (design §9.4, Req. 22, 25). Runbook para operações e referência para evolução do schema.

**Normativo:** `docs/chats/design.md` (§1.7, §4.6–4.7, §6.1, §7.2, §9.4), `docs/chats/requirements.md` (R22-AC03, R25-AC06, R28-AC02).

**Implementação:** batch RPCs em `supabase/migrations/20260701106200_instrument_cron_wrappers_job_runs.sql` (re-aplicados com `statement_timeout` em `20260701107300_add_statement_timeout_guards.sql`); índices em `20260701107100_harden_cns_index_coverage.sql`.

---

## Escrita distribuída (hot partition)

| Mecanismo | Por quê |
|-----------|---------|
| **UUID v4** em `chats.id`, `chat_messages.id`, `domain_events.id` | Espalha inserts no B-tree; evita sequência monotônica em uma única faixa de páginas. |
| **Chave de inbox por usuário** | Listagens usam RPCs paginados (`list_conversations`, `list_chat_messages`) com índices parciais por participante — não há fan-out Realtime em tabela inteira. |
| **Contador por SR** | `service_request_negotiation_stats.active_chat_count` concentra leituras de slot em uma linha por pedido (hot row aceitável vs. varrer `chats`). |

**Sintoma de partição quente:** latência P95 alta em inserts de mensagens ou em `domain_events` sem crescimento proporcional de volume global. Mitigação imediata: revisar batch size dos crons, `statement_timeout` (task 82), e índices de candidatos; mitigação futura: particionar tabelas de auditoria (abaixo).

---

## Cron horizontal com `FOR UPDATE SKIP LOCKED`

Vários workers (múltiplas invocações `pg_cron`, réplicas de job, ou execução manual com `service_role`) **podem rodar em paralelo** nos mesmos jobs sem deadlock em linha já reclamada:

| Job (`pg_cron`) | RPC | Batch default | Padrão de lock |
|-----------------|-----|---------------|----------------|
| `chat_evaluate_reciprocity` | `cns_evaluate_reciprocity_batch` | 500 | `FOR UPDATE OF c SKIP LOCKED` |
| `proposal_expire_pending` | `expire_pending_proposals` | 500 | `FOR UPDATE OF pp SKIP LOCKED` |
| (1 min) domain events | `cns_process_domain_events` | 100 | claim + `locked_until` 30s |
| `cns_reconcile_pending_deliveries` | `cns_reconcile_pending_deliveries` | 200 | `FOR UPDATE OF m SKIP LOCKED` |
| `cns_janitor_orphan_media` | `cns_janitor_orphan_media` | 500 | `FOR UPDATE OF s SKIP LOCKED` |

**Garantias (R25-AC06, R28-AC02):**

- Linhas já bloqueadas por outro worker são **puladas**; o próximo tick ou worker pega o restante.
- Reciprocidade e expiração de proposta são **independentes** na mesma janela (R25-AC03): ordem entre jobs não deve produzir estado inválido.
- Falha em uma linha do lote de reciprocidade usa savepoint por chat — não aborta o lote inteiro (R25-AC04).
- `accept_proposal` **não** usa SKIP LOCKED; usa `FOR UPDATE` pessimista no SR e propostas (§7.2).

**Throughput nacional (R25-AC06):** meta operacional — varredura de candidatos `ACTIVE` em **&lt; 15 min** com índice `(status, last_interaction_at)` e paginação por batch. Se `job_runs.duration_ms` ou backlog (`domain_events` não processados) crescer de forma sustentada, aumentar frequência só após validar carga no pool; preferir segundo worker paralelo com mesmo RPC (SKIP LOCKED) a aumentar batch acima de 500.

**Timeouts (task 82):** `accept_proposal` — 5s (replay por idempotency); batch/cron — 120s local via `cns_set_local_statement_timeout`. Timeout em accept retorna `STATEMENT_TIMEOUT` com `retry: true` no DETAIL; cliente deve reenviar com a mesma chave (`src/features/chats/README.md`).

---

## Observabilidade operacional

| Fonte | Uso |
|-------|-----|
| `job_runs` | `processed_count`, `transitioned_count`, `error_count`, `duration_ms` por invocação (task 64). |
| Logs Postgres | `raise log` em transições de reciprocidade, accept, erros por linha no batch. |
| `domain_events` | Backlog = linhas com `processed_at IS NULL AND dead_letter = false`; leases expirados reprocessados pelo consumer. |

**Alertas sugeridos:** fila `domain_events` acima do SLA; `job_run` com `error_count` &gt; 0 sustentado; duração P95 do job &gt; intervalo do cron.

---

## Particionamento futuro (auditoria)

Quando `chat_audit` ou `proposal_audit` ultrapassarem **~10M linhas** (design §9.4):

1. Introduzir particionamento **mensal** por `created_at` (RANGE).
2. Manter políticas RLS e grants por partição pai.
3. Rotina de retenção/arquivamento (detach + cold storage) alinhada a compliance — fora do escopo do MVP CNS.

Até lá, consultas de suporte devem filtrar por `service_request_id` / intervalo de datas para evitar seq scan.

---

## Checklist rápido (ops)

1. Confirmar jobs `pg_cron` ativos (`chat_evaluate_reciprocity`, `proposal_expire_pending`, consumer de domain events).
2. Em pico, verificar se múltiplas execuções simultâneas do mesmo job são intencionais (SKIP LOCKED safe).
3. Se locks longos: checar `statement_timeout` e queries fora dos RPCs batch; não aumentar batch sem medir `duration_ms`.
4. Planejar particionamento de auditoria antes de 10M linhas, não após degradação severa.
