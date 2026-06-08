# Infrastructure Constraints — Orbit

Este documento descreve as **restrições operacionais e arquiteturais** da infraestrutura Orbit (Supabase + Edge Functions + PostgreSQL). Use-o ao desenhar features novas, escolher entre RPC e Edge Function, ou planejar processamento assíncrono.

Documentos relacionados:

- [Technical Stack](./technical-stack.md) — visão geral da stack
- Regra Cursor `server-side-pagination-and-filtering` — paginação e filtros no servidor

---

## 1. Princípio central: database-centric

A **fonte da verdade** do negócio é o **PostgreSQL** (Supabase). Regras de elegibilidade, transições de estado, concorrência, rate limits transacionais e agregações pesadas devem viver no banco — em **RPCs (PL/pgSQL)** ou em SQL transacional — e não em Edge Functions.

**Edge Functions** são camada **stateless e efêmera**: autenticação auxiliar, validação de entrada, chamadas a APIs externas (OpenAI, reCAPTCHA, Resend, FCM), upload de arquivos e montagem de respostas HTTP. Não mantêm estado em memória nem orquestram fluxos longos.

```
[App] ──► PostgREST / RPC (authenticated)     → leitura/escrita com RLS
[App] ──► Edge Function (thin) ──► RPC        → quando precisa de secrets, multipart ou I/O externo
[pg_cron / webhook] ──► Edge Function worker  → dequeue + I/O; estado no Postgres
```

---

## 2. Limites das Supabase Edge Functions

Valores abaixo refletem a [documentação oficial de limites](https://supabase.com/docs/guides/functions/limits) (podem variar por plano; confirmar no dashboard do projeto).

| Limite | Valor típico | Implicação para Orbit |
|--------|--------------|------------------------|
| **Wall-clock (worker)** | 150 s (Free) / 400 s (Paid) | Não usar Edge Function como job batch longo; preferir fila no DB + workers curtos |
| **CPU por request** | ~2 s (tempo de CPU real) | Loops pesados, ranking em memória ou transformações grandes → **RPC no Postgres** |
| **Idle / resposta HTTP** | ~150 s sem resposta → 504 | Fluxos que esperam OpenAI + upload + várias queries devem ser enxutos ou divididos |
| **Memória** | 256 MB | Evitar carregar muitos arquivos ou payloads grandes na RAM da função |
| **Estado** | Nenhum entre invocações | Todo progresso, lease, retry e idempotência → **tabelas + RPCs** |
| **Cold start** | Variável | Funções devem fazer pouco trabalho antes do caminho crítico; RPC direto do app é mais previsível para leituras |

**Background tasks** (`EdgeRuntime.waitUntil`) estendem processamento após a resposta HTTP, mas ainda respeitam o wall-clock do worker — não substituem um worker dedicado ou fila no banco para trabalho pesado ou recorrente.

### O que não colocar em Edge Functions

- Matching geoespacial, ranking de listas grandes, agregações complexas
- Loops sobre milhares de linhas
- Máquinas de estado, filas ou rate limits que dependem só da memória da função
- Processamento que pode ultrapassar dezenas de segundos de CPU ou centenas de segundos de wall-clock
- Jobs agendados recorrentes (usar **`pg_cron`** + RPC/tabela de fila, invocando Edge só para o trecho de I/O)

### O que é aceitável em Edge Functions

- Orquestração fina: validar JWT/body, chamar 1–3 RPCs/queries, montar JSON
- Uma chamada a API externa com timeout explícito (OpenAI, reCAPTCHA, Resend, FCM)
- Upload multipart para Storage + inserts coordenados (ex.: `create-request-quote-order`)
- Renderização de template (email/push) a partir de payload já validado no DB
- Webhooks de provedores que apenas reconciliam estado via RPC

---

## 3. Prioridade: RPC no PostgreSQL

### Por que priorizar RPC

1. **Proximidade dos dados** — joins, PostGIS (`ST_DWithin`, distâncias), contagens e filtros sem serializar grandes volumes para Deno.
2. **RLS e `auth.uid()`** — funções `SECURITY DEFINER` com escopo explícito ao chamador autenticado (padrão em `get_provider_proposal_job_detail`, `list_services`, etc.).
3. **Transações ACID** — invariantes, idempotência (`UNIQUE` em `idempotency_key`), `FOR UPDATE SKIP LOCKED` em filas.
4. **Menos latência** — o app chama `supabase.rpc()` direto, sem hop extra de Edge Function.
5. **Limites de CPU** — Postgres é o lugar certo para trabalho CPU-bound de consulta; Edge Functions têm teto baixo de CPU por request.

### Padrão de RPC no projeto

- Assinatura com paginação: `p_page`, `p_page_size`, filtros opcionais (`p_status`, `p_search`).
- Retorno: `jsonb` com `{ items, total_count, page, page_size }` (ver regra de paginação server-side).
- Segurança interna:
  - `v_caller := (SELECT auth.uid());` — falha se não autenticado
  - Checagem de `profiles.role` quando aplicável
  - Escopo sempre ao `provider_id` / `client_id` do chamador
- `SECURITY DEFINER` + `SET search_path = public` quando a função precisa ler dados de outro papel com mascaramento (ex.: nome do cliente na lista do prestador).
- `GRANT EXECUTE` apenas para `authenticated`; `REVOKE` de `anon` e `public` onde necessário.

Exemplos no repositório:

| RPC | Uso |
|-----|-----|
| `match_provider_jobs` | Elegibilidade + ranking + paginação (PostGIS) |
| `get_provider_proposal_job_detail` | Detalhe de job/proposta |
| `list_services` / `get_service` | Listagem e detalhe unificados (cliente e prestador) |
| `list_client_received_budgets` / `respond_client_budget_question` / … | Fluxo do cliente |

### RPC restrita a `service_role`

Algumas funções são **revogadas** para `authenticated` e `anon` e só podem ser chamadas com **service role** a partir de uma Edge Function:

- Ex.: `match_provider_jobs` — comentário na migração: *"called from Edge Function with service role key"*.

Nesse caso a Edge Function atua como **porta de entrada** (auth do usuário + validação) e delega o trabalho pesado ao RPC. Ainda assim, **toda a lógica de matching permanece no SQL**, não no Deno.

---

## 4. Quando usar Edge Function vs RPC direto

| Critério | Preferir **RPC** (`supabase.rpc`) | Preferir **Edge Function** |
|----------|-----------------------------------|----------------------------|
| Consulta/listagem paginada | Sim | Não |
| Mutação com regras no DB | Sim | Só se precisar de secret/I/O antes |
| Segredos (OpenAI, reCAPTCHA secret) | Não (não expor no client) | Sim |
| `multipart/form-data` / upload de arquivos | Não via PostgREST simples | Sim (`create-request-quote-order`) |
| Chamada a terceiros (email, push, IA) | Não | Sim |
| RPC só com `service_role` + auth custom no handler | — | Sim (`match-provider-jobs`) |
| Guest + JWT opcional no mesmo endpoint | — | Sim (`verify_jwt = false` + validação interna) |

### Padrões já adotados no código

| Fluxo | Camada | Motivo |
|-------|--------|--------|
| Lista de trabalhos do prestador | Edge `match-provider-jobs` → RPC `match_provider_jobs` | RPC bloqueada para client; EF valida provider + enriquece resposta (serviços, área) |
| Detalhe de um trabalho | RPC `get_provider_proposal_job_detail` direto do app | Sem secret; lógica 100% no DB |
| Orçamentos enviados / recebidos | RPC direto | Paginação + RLS via `SECURITY DEFINER` |
| Pedido de orçamento completo | Edge `create-request-quote-order` | FormData, fotos, reCAPTCHA, rate limit, guest |
| Descrição inteligente (IA) | Edge `generate-smart-description` | `OPENAI_API_KEY` |
| reCAPTCHA | Edge `verify-recaptcha` | Secret do Google |

**Regra prática:** se não há secret, multipart nem API externa, **comece com RPC**. Se a RPC precisar ficar fechada ao client, use Edge Function **fina** que só autentica e chama a RPC.

---

## 5. PostgREST, RLS e API

- Tabelas expostas em `public` obedecem **RLS**; o client usa **anon key + JWT** — o frontend nunca é fronteira de confiança.
- `max_rows = 1000` no projeto (`supabase/config.toml`) — evita respostas acidentais gigantes; listagens devem paginar.
- Preferir **RPC** para listagens com filtros complexos em vez de `.from().select()` com joins grandes no client.
- Políticas RLS: usar `(select auth.uid())` em expressões (initplan) e **uma política permissiva por ação** quando possível (ver regra `supabase-rls-performance`).

---

## 6. Processamento assíncrono e filas

Não há filas Redis/SQS nem workers Node dedicados no escopo atual. Padrão aprovado:

1. **Persistir** pedido em tabela (estado, `idempotency_key`, agendamento).
2. **Validar** cotas e transições em **RPC** (transacional).
3. **Despachar** com `pg_cron` e/ou `pg_net` / webhook invocando Edge Function **curta**.
4. **Checkout** da fila com `SELECT … FOR UPDATE SKIP LOCKED` e lease (`locked_until`).
5. Edge Function: compile template + HTTP para Resend/FCM; resultado e retry via **RPC** de volta ao Postgres.

Detalhes: [message-dispatcher/requirements.md](./message-dispatcher/requirements.md) (seções *Operational Architecture Constraints* e *O que deve ficar em Workers/Edge Functions*).

**Orphan recovery:** se a Edge Function cair (timeout/OOM), o lease expira e outro worker pode retomar — estado nunca depende da memória da função.

---

## 7. Rate limiting

| Camada | Uso |
|--------|-----|
| **Postgres** | Limites de negócio (ex.: X push/dia, cooldown 20 min) — **antes** de enfileirar; serialização na linha do usuário |
| **Edge Function** | Proteção por IP/usuário/função (`platform_rate_limits`, janela 60 s) — ex.: `create-request-quote-order` (10 req/min) |

Rate limit “soft” na Edge pode **fail open** em erro de DB (`_shared/rateLimiter.ts`); regras de produto críticas devem estar no **RPC**, não só na Edge.

---

## 8. Storage e payloads

- Upload de fotos de pedido: Edge Function, bucket `service-requests`, validação de magic bytes, **máx. 10 fotos × 5 MB** (ver docs de negócio do request-quote).
- Moderação NSFW: **TensorFlow.js + nsfwjs no browser** — não na Edge (limite de CPU/memória e tamanho de bundle/worker).
- Secrets de Storage e service role: apenas em Edge Functions ou migrações; nunca no bundle Vite.

---

## 9. Paginação e performance de consultas

- Listagens que crescem com o tempo: **sempre** paginação + filtros no servidor (RPC ou EF que chama RPC).
- **Nunca** trazer todos os registros e filtrar no React (`Array.filter` / `useMemo`).
- Busca textual: debounce no client (~400 ms); `queryKey` do TanStack Query inclui todos os filtros.
- PostGIS e índices: manter lógica espacial nas migrações; extensões em schema `extensions` com `search_path` adequado.

Features de referência: `view-services` (RPC direto), `provider-jobs` (EF + RPC).

---

## 10. Segurança e configuração de funções

| Função | `verify_jwt` | Notas |
|--------|--------------|-------|
| `generate-smart-description` | `true` | Usuário autenticado |
| `create-request-quote-order` | `false` | Validação manual (guest + logado); reCAPTCHA + rate limit |
| `verify-recaptcha` | `false` | Endpoint público controlado |

Toda Edge Function que usa `SUPABASE_SERVICE_ROLE_KEY` deve **revalidar** identidade e papel no handler antes de operações privilegiadas.

---

## 11. O que ainda não temos (restrições explícitas)

- **Worker Node/Container** separado para jobs longos
- **Orquestrador externo** (Temporal, BullMQ, etc.) — filas são tabelas Postgres
- **iOS nativo** no repositório (mesmas restrições web/Capacitor quando existir)
- **Processamento de mídia pesado** no servidor (resize em massa, vídeo) — fora do escopo Edge atual

Se um requisito não couber em RPC + fila + Edge curta, a decisão precisa ser explícita (novo serviço, aumento de plano Supabase, ou redesign do fluxo).

---

## 12. Checklist para nova feature

1. A operação é **principalmente leitura/escrita SQL**? → **RPC** + camada `api/` no feature.
2. Precisa de **API externa ou secret**? → **Edge Function** mínima + RPC para persistência/estado.
3. Pode retornar **> 1000 linhas** ou crescer sem limite? → **Paginar** no RPC.
4. Duração estimada **> ~30 s** ou muita CPU? → **Fila + pg_cron**, não Edge síncrona.
5. Concorrência entre workers? → **`SKIP LOCKED` + lease** no Postgres.
6. Duplicata por retry do client? → **`idempotency_key` UNIQUE** + RPC idempotente.
7. Regra de negócio crítica (cota, dinheiro, cancelamento)? → **RPC transacional**, não só UI/Edge.

---

## 13. Referências no repositório

| Área | Caminho |
|------|---------|
| Edge Functions | `supabase/functions/` |
| RPCs de matching | `supabase/migrations/20260318200001_match_provider_jobs_rpc.sql` |
| RPCs de orçamentos (prestador) | `supabase/migrations/20260322000000_create_provider_budgets_rpcs.sql` |
| EF fina de jobs | `supabase/functions/match-provider-jobs/index.ts` |
| App → RPC direto | `src/features/provider-jobs/api/providerJobs.api.ts` (`get_provider_proposal_job_detail`) |
| Config local | `supabase/config.toml` (`max_rows`, `[functions.*]`, `[edge_runtime]`) |
