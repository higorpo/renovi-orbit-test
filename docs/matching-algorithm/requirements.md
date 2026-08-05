# Renovi Dispatch & Progressive Matching Algorithm Requirements

## Context

Este documento descreve os requisitos funcionais iniciais do algoritmo de dispatch e matching progressivo da Renovi.

O objetivo do sistema é distribuir pedidos de serviço de forma inteligente, escalável e progressiva, priorizando:

- proximidade geográfica em relação ao cliente;
- qualidade do prestador (avaliações);
- liquidez do marketplace;
- taxa de conversão;
- tempo de resposta;
- equilíbrio de distribuição de demanda;
- redução de spam e fadiga de notificações.

O sistema opera primeiramente via dispatch fechado, utilizando um mural aberto apenas como último recurso de fallback.

Decisões de arquitetura (grill 2026-06-17): [`adr/0001`](./adr/0001-replace-open-feed-with-progressive-matching.md) feed progressivo; [`0002`](./adr/0002-dual-location-model-batch-vs-feed.md) localização dual; [`0003`](./adr/0003-list-provider-opportunities-rpc.md) RPC do feed; [`0004`](./adr/0004-dispatch-gates-cron-and-scheduling.md) gates/cron; [`0005`](./adr/0005-service-ratings-and-provider-stats.md) avaliações e stats. Glossário e log completo: [`CONTEXT.md`](./CONTEXT.md). **Design técnico (HL + LL):** [`design.md`](./design.md).

O sistema deve operar através de:

- ranking de prestadores;
- batches/lotes progressivos;
- expansão gradual de visibilidade através de batches progressivos dentro de um raio geográfico fixo de 20 km;
- controle temporal de exposição;
- resolução dinâmica de candidatos elegíveis por batch.

# Assumptions

O sistema atualmente assume:

- utilização de Supabase;    
- utilização de PostgreSQL;    
- utilização de PostGIS para geolocalização;    
- utilização de H3 Index como mecanismo de particionamento e otimização de buscas geoespaciais;    
- backend baseado em Edge Functions;    
- notificações push para prestadores;    
- existência de categorias e especialidades de prestadores;    
- existência de avaliações de prestadores como insumo de ranking — schema definido em Requirement 4 (`service_ratings`, `provider_rating_stats`);
- existência de `profiles.operational_status` (`active` \| `suspended`) para elegibilidade de matching;
- substituição de `match_provider_jobs` por `list_provider_opportunities` (feed gated por visibilidade);
- existência de status de Service Requests;    
- existência de status de Providers.
- utilização de filas persistidas em PostgreSQL;
- utilização de execução assíncrona baseada em scheduling;
- utilização de mecanismos de locking transacional do PostgreSQL;
- utilização de execução resumível baseada em dispatch state persistido.
- utilização do **Message Dispatcher** (schema `message_dispatcher`, Edge Function `message-dispatcher-worker`) para entrega multicanal de notificações (push e e-mail);
- utilização de `@capgo/background-geolocation` (Capacitor 8) para coleta periódica de posição de prestadores em apps nativos (Android/iOS);
- persistência da última posição conhecida por instalação de dispositivo em `public.user_device_beacons`;
- distinção de perfil por `profiles.role`: apenas usuários com role `provider` participam da coleta de localização para matching; clientes (`client`) ficam explicitamente fora desse fluxo na fase inicial.

# Provider Geolocation Collection (Overview)

O matching progressivo depende da **última posição conhecida** de cada prestador. Essa posição é coletada no cliente (app nativo, PWA ou web), sincronizada para `public.user_device_beacons` e consumida pelas fases de elegibilidade geoespacial (Requirements 1 e 3).

### Escopo por perfil

| Perfil | Coleta de localização | Pedido de permissão | Background tracking |
| ------ | --------------------- | ------------------- | ------------------- |
| `provider` | Sim | Sim (após dialog explicativa) | Sim (nativo); limitado (web/PWA) |
| `client` | Não | Não | Não |
| `admin` | Não (fase inicial) | Não | Não |

### Plugin e plataformas

- **Android / iOS (Capacitor nativo):** `@capgo/background-geolocation` com `start`/`stop`, notificação persistente no Android quando em background, e `distanceFilter` moderado (baixa frequência; precisão operacional suficiente para raio de 20 km — não é necessária precisão de navegação).
- **Web / PWA:** fallback com APIs de geolocalização do browser enquanto a sessão estiver ativa; **não** há garantia de coleta contínua com aba fechada ou app em background (limitação da plataforma). O mesmo fluxo de sync para `user_device_beacons` se aplica quando houver posição disponível.
- **Envio ao backend:** upsert na linha `(profile_id, device_id)` já usada pelo device beacon (FCM); localização via camada de API da feature, não diretamente do componente.

### Modelo de dados (`user_device_beacons`)

A tabela existente SHALL ser estendida com colunas para permissão e posição atual por instalação:

| Coluna | Tipo (proposto) | Descrição |
| ------ | --------------- | --------- |
| `location_permission_granted` | `boolean not null default false` | `true` quando o usuário concedeu permissão de localização neste dispositivo; `false` quando negada, revogada ou nunca solicitada |
| `location` | `extensions.geography(Point, 4326)` nullable | Última posição conhecida (WGS84) |
| `location_accuracy_meters` | `numeric` nullable | Raio de incerteza horizontal em metros, quando disponível |
| `location_recorded_at` | `timestamptz` nullable | Timestamp da amostra de posição (origem do dispositivo, não apenas do sync) |

O dispatch SHALL tratar `location_recorded_at` e regras configuráveis de freshness (Requirement 3) ao avaliar elegibilidade. Prestadores sem posição recente ou sem permissão concedida SHALL use **neighborhood-based eligibility** and **deprioritized ranking** (see Resolved Design Decisions).

### Dual location model (batch vs feed)

- **Batch / notifications:** `user_device_beacons` aggregated into `provider_latest_locations` (most recent valid device; freshness default 24 h).
- **Feed (`list_provider_opportunities`):** optional lat/lng from Capacitor/browser at screen access; used for sort/display only, **not** batch eligibility. See ADR 0002.

# Dispatch Phases

O dispatch progressivo da Renovi opera através das seguintes fases explícitas:

1. Eligibility Resolution Phase
2. Operational Ranking Phase
3. Batch Generation Phase
4. Visibility Phase
5. Notification Dispatch Phase
6. Interaction Monitoring Phase
7. Fallback Marketplace Phase

Cada fase possui responsabilidades independentes e pode utilizar dados operacionais atualizados no momento de sua execução.

# Dispatch State Machine

O dispatch progressivo da Renovi SHALL operar através dos seguintes estados:

- DISPATCH_PENDING
- DISPATCH_ACTIVE
- DISPATCH_PAUSED
- DISPATCH_STOPPED
- DISPATCH_MATCHED
- DISPATCH_FALLBACK_OPEN_MARKET
- DISPATCH_CANCELLED
- DISPATCH_EXPIRED

### State Definitions

- DISPATCH_PENDING:
  Service Request criada; linha de dispatch existe; **nenhum batch aberto ainda**; aguardando `next_batch_at` (default +5 min).

- DISPATCH_ACTIVE:
  Dispatch em execução — **transita de `PENDING` na abertura do batch #1**; batches ativos ou futuros batches pendentes.

- DISPATCH_PAUSED:
  Batches suspensos por excesso de chats ativos (≥1 msg em `matching.dispatch_active_chat_window_hours`, default 24 h) ≥ `matching.dispatch_pause_active_chat_threshold` (default **10**, #84). **Não** bloqueia novas propostas/chats via link. Subordinado a `DISPATCH_STOPPED` na escada de prioridade (#82).

- DISPATCH_STOPPED:
  Cap global quando propostas **`PENDING` + `REVISION_REQUESTED`** ≥ `chats.max_active_slots_per_service_request` (default **4**); novos batches suspensos; **novas propostas bloqueadas** (inclusive via link). **Novos chats** não são bloqueados por este status — seguem slots CNS; discovery sem proposta permitido se houver slot (#88). Estado **mais restritivo** na escada `STOPPED` > `PAUSED` > `ACTIVE` (#82).

### Dispatch gate priority (non-terminal)

When both pause gates apply, the system SHALL persist exactly one operational state using this ladder (**#82**):

1. **`DISPATCH_STOPPED`** — if in-flight proposals (`PENDING` + `REVISION_REQUESTED`) ≥ `chats.max_active_slots_per_service_request`; set **`next_batch_at = NULL`** (#108)
2. Else **`DISPATCH_PAUSED`** — if active chats (≥1 message within `matching.dispatch_active_chat_window_hours`, default 24 h) ≥ `matching.dispatch_pause_active_chat_threshold` (default 10, #84, #87); set **`next_batch_at = NULL`** (#108)
3. Else **`DISPATCH_FALLBACK_OPEN_MARKET`** — if `fallback_opened_at IS NOT NULL` (#85); set **`next_batch_at = NULL`** (#109)
4. Else **`DISPATCH_ACTIVE`** — set `next_batch_at = now()` when resuming from `STOPPED`/`PAUSED` (#106); otherwise schedule/resume batches per lifecycle rules

`STOPPED` and `PAUSED` **MAY replace** a prior `DISPATCH_FALLBACK_OPEN_MARKET` status when their gates fire; `fallback_opened_at` is **not** cleared until match, cancel, or lifecycle terminal events.

**Resume re-evaluation:** exiting `STOPPED` or `PAUSED` → re-apply the full ladder (may land on the other gate state, `FALLBACK_OPEN_MARKET`, or `ACTIVE`). When landing on `DISPATCH_ACTIVE`, set **`next_batch_at = now()`** — do **not** defer by `matching.batch_interval_minutes` or bootstrap delay (#106). When landing on `DISPATCH_FALLBACK_OPEN_MARKET`, set **`next_batch_at = NULL`** — progressive batches SHALL NOT resume (#109). **Batch open, visibility persistence, and Message Dispatcher enqueue SHALL occur only in `cron_process_service_request_dispatches()` phase 2** — inline gate evaluation (RPCs, `expire_pending_proposals`) updates dispatch state only (#107). Terminal lifecycle states (`MATCHED`, `CANCELLED`, `EXPIRED`) are **immutable** — gate evaluation is a **no-op** once reached (#86).

**Post-`EXPIRED` proposal/chat cap (#86):** when `status = DISPATCH_EXPIRED`, the system SHALL **not** transition dispatch status for gate conditions; proposal and chat admission limits SHALL be enforced **only** by existing CNS RPCs (`create_provider_proposal`, `initiate_conversation`) via `chats.max_active_slots_per_service_request`.

**Gate evaluation (#83, #105, #107):** shared function `evaluate_service_request_dispatch_gates(service_request_id)` SHALL be invoked:
- **Inline** at the end of proposal-mutating RPCs (same transaction): `create_provider_proposal`, revision request/response/decline flows, `accept_proposal`, `reject_proposal`, and SR cancel paths that change proposal counts.
- **Inline** from `expire_pending_proposals` **for each distinct `service_request_id`** whose proposals transition to `EXPIRED` in that job run — so a freed in-flight slot can resume dispatch from `DISPATCH_STOPPED`/`DISPATCH_PAUSED` **without** waiting for cron phase 2 (#81, #105).
- **From** `cron_process_service_request_dispatches()` phase 2: **before** batch discovery/open on due rows (#112), and on **`DISPATCH_PAUSED` / `DISPATCH_STOPPED`** rows (gate-only pass, #104).
- **Inline callers SHALL NOT** open batches, persist visibility, or enqueue notifications — those side effects are **exclusive** to cron phase 2 (#107).
- **Not** on every `send_message` — chat-activity threshold decay is picked up by the ~2-minute cron cadence.
- **Not** when dispatch `status` is `DISPATCH_MATCHED`, `DISPATCH_CANCELLED`, or `DISPATCH_EXPIRED` — return immediately without status change (#86).

**Lifecycle expiration (#91, #103):** `cron_process_service_request_dispatches()` SHALL run in **two phases** within the same pg_cron invocation (~2 min):
1. **Lifecycle sweep** — transition **all** non-terminal dispatches (`status` NOT IN `MATCHED`, `CANCELLED`, `EXPIRED`) where `created_at + matching.dispatch_lifecycle_hours < now()` to `DISPATCH_EXPIRED` and record `dispatch_expired` — **independent of** `next_batch_at` (covers `STOPPED`/`PAUSED`/`FALLBACK` with paused schedules).
2. **Batch/gate processing** — lease and process:
   - rows with due `next_batch_at`: **gate re-evaluation first** (#112); batch discovery/open **only if** status is `DISPATCH_PENDING` or `DISPATCH_ACTIVE` after evaluation,
   - rows in `DISPATCH_PAUSED` or `DISPATCH_STOPPED` (gate re-evaluation only — no batch open) (#104).
   After a **successful** batch open while dispatch remains `DISPATCH_ACTIVE`, set **`next_batch_at = now() + matching.batch_interval_minutes`** (#110).

- DISPATCH_MATCHED:
  Terminal de sucesso: proposta aceita pelo cliente (transição atômica dentro de `accept_proposal`).

- DISPATCH_FALLBACK_OPEN_MARKET:
  Pool de batches esgotado; marketplace aberto por bairro exato (lazy no feed). `fallback_opened_at` setado na transição. **`next_batch_at = NULL`** — sem batches progressivos (#109). **Pode ser temporariamente substituído** por `STOPPED`/`PAUSED` quando gates disparam; lazy fallback no feed usa **`fallback_opened_at IS NOT NULL`**, não só este status (#85).

- DISPATCH_CANCELLED:
  Service Request cancelada antes da conclusão do dispatch.

- DISPATCH_EXPIRED:
  Lifecycle de 48 h atingido: **para** novos batches, notificações e novas concessões de visibilidade; **mantém** visibilidade batch já concedida no feed; prestadores com visibilidade **podem continuar interagindo** (chat, proposta) enquanto SR `OPEN` (#66, #67). Status **imutável** — gates `STOPPED`/`PAUSED` não substituem `EXPIRED`; cap pós-expiração via CNS apenas (#86).

# Operational Architecture Constraints

O dispatch progressivo da Renovi SHALL operar utilizando uma arquitetura orientada a persistência de estado, execução assíncrona resumível e coordenação transacional baseada em PostgreSQL.

O sistema SHALL assumir:

- execução assíncrona através de Edge Functions;
- persistência transacional em PostgreSQL;
- coordenação concorrente através de mecanismos transacionais do banco;
- processamento resumível baseado em estado persistido;
- filas operacionais persistidas em PostgreSQL;
- agendamento temporal baseado em tarefas persistidas;
- execução idempotente de batches e notificações;
- isolamento concorrente entre dispatches.

O sistema SHALL evitar dependência de processos persistentes em memória ou workers continuamente ativos.

Dispatch executions SHALL be resumable and restart-safe.

Dispatch execution steps SHALL remain computationally bounded and individually resumable.

The system SHALL avoid long-running dispatch execution flows within a single Edge Function invocation.

Operational ranking, candidate resolution, dispatch state transitions, and concurrency coordination SHOULD preferentially execute through database-level transactional operations whenever possible.

Edge Functions SHOULD primarily orchestrate asynchronous execution and external side effects rather than maintain long-lived operational state.

Dispatch operations SHALL be safely retryable without producing duplicated batches, duplicated notifications, or inconsistent dispatch state transitions.

The system SHALL support database-driven scheduling orchestration compatible with stateless execution environments.

Dispatch scheduling mechanisms SHOULD support coarse-grained polling or scheduled execution strategies compatible with database-backed task scheduling.

The system SHOULD avoid high-frequency global dispatch polling strategies.

### Database triggers for side effects

Side effects triggered by dispatch lifecycle events (batch opened, visibility granted, notification intent created, audit events) SHALL prefer **PostgreSQL triggers** on the relevant tables whenever a trigger-based approach is the best fit — i.e. when the effect is tightly coupled to a persisted state transition, must run in the same transactional boundary, and does not require long-running I/O.

Exceptions are expected when the side effect is a better fit outside the database transaction, including:

- delivery of push/e-mail through the Message Dispatcher worker (Edge Function + external providers);
- HTTP calls to vendors (FCM, Resend);
- any operation whose latency or failure mode should not block or roll back the core dispatch transaction.

When a trigger is not used, the implementation SHALL document why (e.g. external I/O, cross-service orchestration, resumable async scheduling).

### Scalability and runtime constraints

The matching and dispatch implementation SHALL be designed to operate at scale with **many Providers online simultaneously** and **many open Service Requests in active dispatch** at the same time, without degrading into full-table scans, unbounded in-memory state, or single-threaded bottlenecks.

The full solution SHALL run **entirely within the platform's available runtime**: **PostgreSQL** (schema `public`, PostGIS/H3, triggers, RPCs, persisted queues/scheduling, transactional locking) and **Supabase Edge Functions** (orchestration, cron entrypoints, Message Dispatcher worker). No additional always-on worker infrastructure beyond what the project already uses for Supabase is assumed.

Implementations SHALL remain compatible with stateless, short-lived Edge Function invocations and database-backed resumable execution (see Operational Architecture Constraints above).

# Resolved Design Decisions (Grill 2026-06-17)

Decisions captured during product/technical grill. Canonical glossary and full decision log: [`docs/matching-algorithm/CONTEXT.md`](./CONTEXT.md). Architecture ADRs: [`docs/matching-algorithm/adr/`](./adr/) (0001–0005).

| Area | Decision summary |
|------|------------------|
| Feed replacement | Progressive matching **replaces open feed listing** (`match_provider_jobs` → `list_provider_opportunities`). Detail/actions ungated via `get_service` + CNS (#76–#77). ADR 0001, 0003. |
| Location | **Dual model:** beacon/`provider_latest_locations` for batches; optional Capacitor lat/lng for feed sort only (ADR 0002). |
| No beacon | Neighborhood **exact match** + deprioritized ranking (−20%, proximity = 0); not excluded. |
| Discovery caps | **20 km** radius and **200** candidate pool — **hardcoded in SQL** (#126); not `platform_constants`. |
| Ratings | RPC-only writes; `overall_score` in RPC (#121); stats bootstrap on provider create (#122, #130); trigger refresh (#127, #132); 48 h edit hardcoded (#123, #134). ADR 0005. |
| Load / accepting work | Derived from scheduled `contracted_services` (14d window, max 28); no manual toggle. |
| Suspension | `profiles.operational_status` (`active` \| `suspended`) **in scope**; admin change mechanism **out of MVP** (all `active` until admin tooling). |
| Dispatch persistence | Normalized tables: dispatches, batches, batch_providers, **batch visibility** (persisted), dispatch_events. Fallback **lazy** in RPC (#75). |
| Dispatch gates | Ladder `STOPPED` > `PAUSED` > `FALLBACK` > `ACTIVE` (#82); `evaluate_service_request_dispatch_gates` (#83, #105); `STOPPED` blocks proposals only (#88). ADR 0004. |
| Cron / scheduling | 2-phase cron (#103); phase 2 gates-before-batch (#112); `next_batch_at` NULL on pause/fallback, `now()` on resume, `+interval` after batch (#106–#110). ADR 0004. |
| Scheduling | `next_batch_at` on dispatch row; pg_cron every **2 min** + `job_runs`; start delay **5 min**; batch interval **60 min**; lifecycle **48 h** from `created_at` → `EXPIRED`; **batch visibility persists** (#66, #90). |
| Fallback | Neighborhood exact; **lazy** in feed when `fallback_opened_at IS NOT NULL` (#75, #85); no mass notifications (#14). No batch cap (#62). Partial batches OK (#111). |
| Feed exclusions | Hide: dismissed; in-flight proposal; ACTIVE chat; any prior proposal row (#95–#96). Dismiss feed-only (#102). |
| Notifications | MMD `matching.new_opportunity` (push + email, no bypass); trigger on batch_provider insert. |
| Feed pagination | **Cursor-based** (`cursor` + `limit`); replaces offset pagination of legacy RPC (decision #58). |
| Ranking tie-break | Lower batch exposure count (24 h window) then `provider_id ASC` (#113). |
| Client API | Feed/dismiss → `provider-jobs/api/` (#118, #120); view audit → `view-services` hook + api (#115–#119). |
| Platform constants | 22 `matching.*` seeds + `platform_constant_numeric` (#98, #124, #131); shared CNS key `chats.max_active_slots_per_service_request`. |
| H3 | `provider_latest_locations.h3_index`; resolution **7**; explored cells **audit only**. |

# platform_constants (matching)

**Shared with CNS (already seeded):**

| Key | Default | Purpose |
|-----|---------|---------|
| `chats.max_active_slots_per_service_request` | 4 | Cap for `DISPATCH_STOPPED` (#78–#80), new chat admission, and proposal limit in CNS RPCs — single source of truth (CNS Req. 24/33) |

**Matching-only (documented; seed in single migration #98):**

All keys below SHALL be seeded in one migration file (`*_matching_platform_constants_seeds.sql`) using `insert … on conflict (key) do update` (same pattern as `20260701100900_cns_platform_constants_seeds.sql`). That migration SHALL contain **only** the numeric helper and `matching.*` seed rows — **no** table/RPC/trigger DDL (#98, #131). The same migration SHALL introduce **`platform_constant_numeric(p_key text, p_default numeric)`** for fractional keys (#124) with **`GRANT EXECUTE` to `service_role` and `authenticated`** — mirroring `platform_constant_int` (#129); integer keys continue using **`platform_constant_int`**.

**Not seeded (hardcoded in RPC/migration/SQL):** rating edit window **48 h** (#123); beacon search radius **20 km** and discovery candidate pool cap **200** (#126).

| Key | Default | Purpose |
|-----|---------|---------|
| `matching.dispatch_start_delay_minutes` | 5 | Delay before first batch after **matching bootstrap** (enrichment `READY` handoff) — **not** after SR `OPEN` insert alone (supersedes historical “after SR creation”; see [service-completion design §3.7 / §4.1](../service-completion/design.md)) |
| `matching.batch_interval_minutes` | 60 | Minimum time between batches |
| `matching.batch_size` | 10 | Max Providers per progressive batch (#89) |
| `matching.dispatch_lifecycle_hours` | 48 | Max dispatch duration → `DISPATCH_EXPIRED`; clock starts at `service_request_dispatches.created_at` (#90) |
| `matching.beacon_location_max_age_hours` | 24 | Beacon freshness for GPS eligibility |
| `matching.no_beacon_score_penalty` | 0.20 | Ranking penalty without valid beacon — read via `platform_constant_numeric` (#124) |
| `matching.h3_resolution` | 7 | H3 cell resolution |
| `matching.provider_load_lookforward_days` | 14 | Scheduled load window |
| `matching.provider_max_scheduled_load` | 28 | Max scheduled `PENDING_PAYMENT` services in window |
| `matching.ranking_weight_proximity` | 0.40 | Primary ranking weight — read via `platform_constant_numeric` (#124) |
| `matching.ranking_weight_quality` | 0.35 | Primary ranking weight — read via `platform_constant_numeric` (#124) |
| `matching.ranking_weight_conversion` | 0.25 | Primary ranking weight — read via `platform_constant_numeric` (#124) |
| `matching.ranking_exploration_max_boost` | 0.10 | Max secondary exploration boost — read via `platform_constant_numeric` (#124) |
| `matching.ranking_tiebreak_exposure_lookback_hours` | 24 | Rolling window for final ranking tie-break exposure count (#113) |
| `matching.rating_dimension_weight_quality` | 0.40 | Per-rating overall score — read via `platform_constant_numeric` (#124) |
| `matching.rating_dimension_weight_punctuality` | 0.25 | Per-rating overall score — read via `platform_constant_numeric` (#124) |
| `matching.rating_dimension_weight_communication` | 0.20 | Per-rating overall score — read via `platform_constant_numeric` (#124) |
| `matching.rating_dimension_weight_value` | 0.15 | Per-rating overall score — read via `platform_constant_numeric` (#124) |
| `matching.rating_min_count_for_ranking` | 3 | Real quality score in ranking threshold |
| `matching.conversion_min_resolved_for_ranking` | 3 | Real conversion score threshold |
| `matching.conversion_lookback_days` | 90 | Proposal conversion window |
| `matching.dispatch_lease_seconds` | 300 | Cron worker lease TTL on `service_request_dispatches` (default 5 min) |
| `matching.dispatch_pause_active_chat_threshold` | 10 | Active chats (≥1 msg in window) before `DISPATCH_PAUSED` (#84) |
| `matching.dispatch_active_chat_window_hours` | 24 | Rolling window for “active chat” in pause gate and `least_competitive` sort (#87) |

# Persistence Model (PostgreSQL)

| Table | Role |
|-------|------|
| `service_request_dispatches` | 1:1 dispatch FSM per SR; bootstrap via `matching_bootstrap_dispatch_for_service_request` on enrichment `READY` (OPEN-insert trigger **DROPped**); `status`; `next_batch_at`; **`fallback_opened_at`** (#75); lease columns (#68) |
| `service_request_dispatch_batches` | Batch sequence per dispatch |
| `service_request_dispatch_batch_providers` | Providers per batch + ranking score snapshot |
| `service_request_provider_visibility` | **Persisted batch visibility only** (`source = batch`; `granted_at`; `dismissed_at`; `revoked_at`). Fallback visibility is **computed at query time** (#75); dismiss on fallback-only MAY insert a row here to record `dismissed_at`. |
| `service_request_dispatch_events` | Views, explicit declines, execution audit; `event_type` enum `service_request_dispatch_event_type` (#70) |
| `provider_latest_locations` | 1:1 provider operational location + `h3_index` |
| `service_ratings` | Client rating per `contracted_service` (fixed dimension columns) |
| `provider_rating_stats` | Denormalized quality aggregates (trigger-maintained) |
| `provider_proposal_stats` | Denormalized conversion aggregates (trigger-maintained) |

`profiles.operational_status`: enum `active` \| `suspended` (default `active`).

`service_request_dispatch_status`: PostgreSQL enum in `public` with values `DISPATCH_PENDING`, `DISPATCH_ACTIVE`, `DISPATCH_PAUSED`, `DISPATCH_STOPPED`, `DISPATCH_MATCHED`, `DISPATCH_FALLBACK_OPEN_MARKET`, `DISPATCH_CANCELLED`, `DISPATCH_EXPIRED` (column `service_request_dispatches.status`). Pool exhaustion is **not** a persisted status — recorded in `service_request_dispatch_events` only (decision #54).

`service_request_dispatch_event_type`: PostgreSQL enum in `public` for `service_request_dispatch_events.event_type` — MVP values: `state_transition`, `batch_opened`, `pool_exhausted`, `provider_viewed`, `provider_declined`, `dispatch_expired`, `dispatch_paused`, `dispatch_resumed`.

# MVP Out of Scope

The following remain **documented and designed** but are **not required for MVP implementation**:

- Admin RPC, panel, or tooling to change `profiles.operational_status` (all Providers default `active` until admin tooling ships).
- Persisted audit trail for `operational_status` changes.
- Backfill / cutover of existing Service Requests (platform reset; only new SRs after rollout).

# Requirements

## Requirement 1: Dynamic Candidate Resolution

_User Story_: Como sistema da Renovi, eu quero resolver candidatos dinamicamente no momento da abertura de cada batch para garantir que o dispatch utilize informações atualizadas de disponibilidade, localização e capacidade operacional dos prestadores.

### Acceptance Criteria

1.  GIVEN enrichment for a Service Request reaches **`READY`** (AI or `fallback_template`) WHEN no `service_request_dispatches` row exists yet THEN `matching_bootstrap_dispatch_for_service_request(sr_id)` SHALL create the dispatch row (`DISPATCH_PENDING`, `next_batch_at = now() + matching.dispatch_start_delay_minutes`) in the **same transaction** as enrichment finalize (or via READY-without-dispatch sweeper repair), without generating a static candidate snapshot. GIVEN a Service Request becomes **`OPEN` alone** (insert or update) WHEN enrichment is not yet `READY` THEN the system SHALL **NOT** create a dispatch row from that OPEN transition (OPEN-insert trigger `trg_service_request_dispatch_bootstrap` is **DROPped**; supersedes #60/#99 OPEN-trigger wording — [service-completion Req 2 AC8](../service-completion/requirements.md), [design §3.7](../service-completion/design.md)).
2.  GIVEN a batch is about to open WHEN candidate discovery starts THEN the system SHALL dynamically renew a search window of up to **200** closest eligible Providers (**hardcoded cap**, #126).
3.  GIVEN candidate discovery occurs WHEN Providers are evaluated THEN the system SHALL use the most recent Provider availability data.    
4.  GIVEN candidate discovery occurs WHEN Providers are evaluated THEN the system SHALL use the most recent Provider geolocation from **`provider_latest_locations`** (derived from `user_device_beacons`; most recent `location_recorded_at` across permitted devices).
5.  GIVEN candidate discovery occurs WHEN Providers are evaluated THEN the system SHALL use the most recent Provider workload and active Service Request data.
6.  GIVEN a Provider was already notified in previous batches WHEN candidate resolution occurs THEN the system SHALL exclude the Provider from future candidate searches for the same Service Request — **detected by** an existing row in `service_request_provider_visibility` with `source = 'batch'` for `(service_request_id, provider_id)` (#114); explicit decline is audit-only and does **not** add batch exclusion beyond notification (#19).
7.  GIVEN candidate resolution occurs WHEN Providers are searched THEN the system SHALL only include Providers that satisfy current eligibility rules.
8.  GIVEN batch candidate resolution completes WHEN ranking is calculated THEN the system SHALL rank candidates using real-time operational data.
9.  GIVEN future batches are opened WHEN candidate resolution occurs THEN the system SHALL recalculate eligibility and ranking instead of reusing stale candidate snapshots.

## Requirement 2: Dispatch State Persistence

_User Story_: Como sistema da Renovi, eu quero persistir o estado do dispatch entre batches para garantir consistência operacional durante dispatches de longa duração.

### Acceptance Criteria

1.  GIVEN a Service Request enters dispatch mode WHEN the dispatch process starts THEN the system SHALL persist dispatch state information via the `service_request_dispatches` row created by the SR insert trigger (decision #60).
2.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track previously notified Providers.
3.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track explicitly declined Providers in `service_request_dispatch_events` for audit (without additional batch exclusion beyond notification).
4.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track opened batches in `service_request_dispatch_batches`.
5.  GIVEN dispatch state is persisted WHEN batch audit is recorded THEN the system SHALL persist explored H3 cells/metadata **for audit only** (SHALL NOT affect dynamic eligibility).
6.  GIVEN a dispatch resumes after delays or retries WHEN a new batch opens THEN the system SHALL continue from the latest persisted dispatch state.
7.  GIVEN dispatch execution is interrupted due to retries, failures, restarts, or asynchronous resumptions WHEN dispatch processing resumes THEN the system SHALL continue execution using the latest persisted dispatch state without requiring in-memory execution continuity.

## Requirement 3: Provider Eligibility Resolution

_User Story_: Como sistema da Renovi, eu quero resolver a elegibilidade de prestadores utilizando filtros progressivos e geoespaciais otimizados para minimizar processamento desnecessário e reduzir queries de alto custo.

### Acceptance Criteria

1.  GIVEN a new batch is about to be generated WHEN candidate eligibility resolution starts THEN the system SHALL exclude Providers that already have batch visibility for the same Service Request — i.e. a row in `service_request_provider_visibility` with `source = 'batch'` (#114).
2.  GIVEN candidate eligibility resolution starts WHEN Provider availability is evaluated THEN the system SHALL only consider Providers with `profiles.operational_status = active` (suspended Providers SHALL NOT enter batches or fallback).
3.  GIVEN candidate eligibility resolution starts WHEN Provider operational status is evaluated THEN the system SHALL only consider Providers whose **scheduled load** is below `matching.provider_max_scheduled_load` within `matching.provider_load_lookforward_days` (count `contracted_services` with `status = PENDING_PAYMENT` whose `[scheduled_start_date, scheduled_end_date]` intersects the window; rows with NULL schedule dates SHALL NOT count).
4.  GIVEN active Providers are filtered WHEN geospatial filtering begins THEN the system SHALL use H3 indexing on **`provider_latest_locations`** exclusively as a coarse candidate space reduction mechanism (resolution default 7) prior to precise geospatial filtering execution.
5.  GIVEN a Provider has a **valid beacon-derived location** (permission granted, freshness within `matching.beacon_location_max_age_hours`) WHEN geospatial filtering occurs THEN the system SHALL filter Providers strictly within **20 km** PostGIS distance from the Service Request (**hardcoded in discovery SQL**, #126).
6.  GIVEN a Provider has **no valid beacon location** WHEN geospatial filtering occurs THEN the system SHALL require **exact neighborhood match** — Service Request address neighborhood ∈ `provider_service_area_neighborhoods` — instead of the 20 km radius filter.
7.  GIVEN Provider geolocation data is evaluated WHEN geographic eligibility is calculated THEN the system SHALL support configurable freshness validation rules (`matching.beacon_location_max_age_hours`, default 24 h).
8.  GIVEN geospatial filtering occurs WHEN nearby Providers are searched THEN the system SHALL use H3 only as a coarse filtering mechanism.
9.  GIVEN geographic eligibility is evaluated WHEN Providers are filtered THEN the system SHALL exclude Providers who fail **either** the 20 km beacon rule **or** the neighborhood exact-match rule (whichever applies per Provider).
10. GIVEN Providers are located near geospatial partition boundaries WHEN geographic filtering occurs THEN the system SHALL avoid relying exclusively on H3 cell membership.
11. GIVEN geographic filtering completes WHEN service eligibility validation begins THEN the system SHALL validate whether the Provider explicitly offers and operates within the specific service type, specialty, or subcategory required by the Service Request.
12. GIVEN service eligibility validation occurs WHEN Provider capabilities are evaluated THEN the system SHALL support querying auxiliary service capability tables and Provider specialization relationships.
13. GIVEN all eligibility filters complete WHEN candidate ordering begins THEN the system SHALL calculate the real-world geospatial distance between the latest known Provider location and the Service Request location.
14. GIVEN candidate ordering occurs WHEN Providers are sorted THEN the system SHALL order eligible Providers from nearest to farthest relative to the Service Request.
15. GIVEN geographic and eligibility filtering completes WHEN candidate discovery finalizes THEN the system SHALL limit the eligible Provider candidate pool to a maximum of **200** Providers before operational ranking and batch generation (**hardcoded in discovery SQL**, #126).
16. GIVEN more than 200 eligible Providers are available WHEN the candidate pool is generated THEN the system SHALL prioritize the closest eligible Providers based on real-world proximity before applying operational ranking.
17. GIVEN candidate pool limiting occurs WHEN Providers are selected for ranking THEN the system SHALL preserve only the highest proximity eligible Providers relative to the Service Request location.
18. GIVEN candidate discovery completes WHEN operational ranking begins THEN the system SHALL deliver the filtered eligible Provider pool to the ranking and batch generation phase.
19. GIVEN a Provider has no valid beacon location WHEN operational ranking is calculated THEN the system SHALL set proximity score to zero and apply `matching.no_beacon_score_penalty` (default 20%) to the final composed score (unified ranking; not a separate tier).

## Requirement 4: Provider Ranking Calculation

_User Story_: Como sistema da Renovi, eu quero ranquear os prestadores elegíveis para priorizar aqueles com maior probabilidade de aceitar e concluir o serviço.

### Schema side effect — Provider quality / ratings (prerequisite)

The system SHALL introduce:

**`service_ratings`** — one row per `contracted_service_id` (UNIQUE):

- `contracted_service_id`, `client_id`, `provider_id`
- Fixed dimension scores 1–5: `quality_score`, `punctuality_score`, `communication_score`, `value_score`
- `overall_score` computed **in RPC** (`submit_service_rating`, `update_service_rating`) from dimension weights read from `platform_constants` (40% / 25% / 20% / 15%, #6, #121) and persisted on the row — **not** via BEFORE trigger or generated column
- Optional `comment`; editable for **48 h** after submit (hardcoded in RPC — **not** a `platform_constants` key, #123), then immutable
- Eligibility: `contracted_services.status = COMPLETED` **and** `contracted_services.client_id = auth.uid()` (#133); submitting client only

**Visibility / access:**

- **Client:** writes **only via RPC** (`submit_service_rating`, `update_service_rating`); RLS **denies** direct INSERT/UPDATE for `authenticated`; RLS **allows SELECT** when `client_id = auth.uid()` (#125)
- **Provider** (`provider_id`): SELECT individual ratings received (dimensions + optional comment)
- **Public / profile:** aggregated stats via `provider_rating_stats` only (not raw rows); **`anon` and `authenticated` MAY SELECT** any provider's aggregates (#71)

**`provider_rating_stats`** — denormalized per provider (**`AFTER INSERT/UPDATE/DELETE` trigger** on `service_ratings` refreshes aggregates in the same transaction — RPCs do **not** recalculate inline, #127; **bootstrap row on provider profile creation**, #122):

- `rating_count`, `overall_avg`, `ranking_quality_score`
- **Bootstrap:** when `profiles.role` becomes `provider` (insert or role transition), create row with `rating_count = 0`, `overall_avg = NULL`, `ranking_quality_score = 5.0` (#7, #122)
- `ranking_quality_score` = **5.0** when `rating_count < matching.rating_min_count_for_ranking` (default 3); else `overall_avg`

**`provider_proposal_stats`** — denormalized conversion (**trigger on terminal `provider_proposals.status` transitions** refreshes aggregates in the same transaction — CNS RPCs do **not** recalculate inline, #132; **bootstrap row on provider profile creation**, #130):

- `resolved_count`, `accepted_count`, `ranking_conversion_score`
- **Bootstrap:** when `profiles.role` becomes `provider`, create row with `resolved_count = 0`, `accepted_count = 0`, `ranking_conversion_score = 0.5` (#130)
- Conversion over last `matching.conversion_lookback_days` (default 90): `ACCEPTED / (ACCEPTED + REJECTED + REJECTED_AUTOMATICALLY + EXPIRED)`
- `ranking_conversion_score` neutral (0.5 normalized) when `resolved_count < matching.conversion_min_resolved_for_ranking` (default 3)

### Acceptance Criteria

1.  GIVEN eligible Providers WHEN ranking is calculated THEN the system SHALL generate a score for each Provider.
2.  GIVEN score calculation WHEN distance is evaluated THEN closer Providers SHALL receive a higher proximity score, which MUST have one of the highest weights (default primary weight 40%).
3.  GIVEN score calculation WHEN Provider ratings are evaluated THEN the system SHALL use `provider_rating_stats.ranking_quality_score`; Providers with higher scores SHALL receive a higher quality score (default primary weight 35%).
4.  GIVEN score calculation WHEN Provider inactivity duration is evaluated THEN Providers with more time since the last completed Service Request SHALL receive a positive balancing score that acts strictly as a secondary modifier or tie-breaker, never overriding the quality score.
5.  GIVEN score calculation WHEN Provider proposal acceptance history is evaluated THEN the system SHALL use `provider_proposal_stats.ranking_conversion_score` (default primary weight 25%).
6.  GIVEN ranking fairness and marketplace liquidity are evaluated WHEN operational ranking is calculated THEN the system SHALL include controlled exploration factors (up to `matching.ranking_exploration_max_boost`, default +10%) to allow operationally eligible Providers with lower recent exposure or lower historical participation to periodically participate in dispatch opportunities, provided they still maintain reasonable conversion potential.
7.  GIVEN exploration factors are applied WHEN ranking scores are adjusted THEN exploration modifiers SHALL act strictly as secondary balancing modifiers and SHALL never override primary quality, proximity, or conversion-related operational scores.
8.  GIVEN newly onboarded Providers without sufficient historical operational metrics WHEN operational ranking is calculated THEN the system SHALL allow controlled participation of such Providers through exploration balancing mechanisms, provided the Providers satisfy minimum operational eligibility requirements.
9.  GIVEN score calculation completes WHEN Providers are sorted THEN the system SHALL order candidates by descending score.
10. GIVEN a Provider views ratings about their completed work WHEN access is evaluated THEN the system SHALL allow reading individual `service_ratings` rows where `provider_id` matches the authenticated Provider (dimensions + optional comment).
11. GIVEN a Client views a rating they submitted WHEN access is evaluated THEN the system SHALL allow reading the `service_ratings` row where `client_id = auth.uid()` (dimensions + optional comment) — **without** a separate read RPC (#125).
12. GIVEN a Client submits or edits a rating WHEN write access is evaluated THEN the system SHALL allow writes **only** through `submit_service_rating` / `update_service_rating` RPCs; **`submit_service_rating`** SHALL require `contracted_services.status = COMPLETED` **and** `contracted_services.client_id = auth.uid()` (#133); UNIQUE per `contracted_service`; **48 h edit window hardcoded in RPC** (#123); **`submit_service_rating` SHALL reject** when a rating row already exists for the `contracted_service_id` — the client MUST use **`update_service_rating`** to edit within the window (#128); **`update_service_rating` SHALL reject** when `now() > submitted_at + interval '48 hours'` — rating becomes **immutable** with no admin override in MVP (#134); the RPCs SHALL compute and persist **`overall_score`** from dimension scores using weights from `platform_constants` (#6, #121); direct INSERT/UPDATE on `service_ratings` SHALL be denied by RLS for `authenticated`.
13. GIVEN public profile or marketplace display WHEN quality is shown THEN the system SHALL expose aggregates from `provider_rating_stats` (RLS allows **`anon` and `authenticated` SELECT** on all provider rows); raw `service_ratings` rows SHALL NOT be exposed to unrelated users or anonymous visitors.
14. GIVEN a new Provider profile is created WHEN `profiles.role = provider` (on INSERT or role transition) THEN the system SHALL bootstrap **`provider_rating_stats`** with `rating_count = 0`, `overall_avg = NULL`, and `ranking_quality_score = 5.0` — **not** defer row creation until the first rating (#7, #122).
15. GIVEN a `service_ratings` row is inserted, updated, or deleted WHEN the transaction commits THEN an **`AFTER INSERT OR UPDATE OR DELETE` trigger** on `service_ratings` SHALL refresh **`provider_rating_stats`** for the affected `provider_id` in the **same transaction** — `submit_service_rating` / `update_service_rating` SHALL **not** recalculate aggregates inline (#34, #127).
16. GIVEN a new Provider profile is created WHEN `profiles.role = provider` (on INSERT or role transition) THEN the system SHALL bootstrap **`provider_proposal_stats`** with `resolved_count = 0`, `accepted_count = 0`, and `ranking_conversion_score = 0.5` — **not** defer row creation until the first terminal proposal (#130).
17. GIVEN a `provider_proposals` row transitions to a **terminal** status (`ACCEPTED`, `REJECTED`, `REJECTED_AUTOMATICALLY`, `EXPIRED`, etc.) WHEN the transaction commits THEN a trigger on **`provider_proposals`** SHALL refresh **`provider_proposal_stats`** for the affected `provider_id` in the **same transaction** — CNS RPCs SHALL **not** recalculate conversion aggregates inline (#132).

## Requirement 4A: Ranking Score Formalization

_User Story_: Como sistema da Renovi, eu quero formalizar a composição dos scores operacionais de ranking para garantir consistência, auditabilidade e previsibilidade do dispatch.

### Acceptance Criteria

1. GIVEN operational ranking is calculated WHEN Provider scores are generated THEN the system SHALL normalize operational scoring inputs before final score composition.

2. GIVEN operational ranking is calculated WHEN score weights are applied THEN the system SHALL support configurable weight definitions via `platform_constants` (defaults: proximity 40%, quality 35%, conversion 25%; exploration max boost 10%; no-beacon penalty 20%).

3. GIVEN operational ranking is calculated WHEN balancing or exploration modifiers are applied THEN the system SHALL treat proximity, Provider quality, and conversion-related metrics as primary ranking factors.

4. GIVEN operational ranking is calculated WHEN balancing or exploration modifiers are evaluated THEN the system SHALL prevent secondary modifiers from fully overriding primary operational ranking factors.

5. GIVEN operational ranking occurs WHEN exploration balancing or secondary modifiers are evaluated THEN the system SHALL define reasonable conversion potential using minimum operational quality thresholds derived from Provider proximity, Provider quality signals, Provider activity status, and historical proposal acceptance performance.

6. GIVEN operational ranking occurs WHEN score composition is finalized THEN the system SHALL apply deterministic tie-breaking for Providers with equal composed scores (#113): **(1)** ascending count of batch visibility grants (`service_request_provider_visibility` where `source = 'batch'` and `granted_at >= now() − matching.ranking_tiebreak_exposure_lookback_hours`, default 24 h) — **lower exposure first**; **(2)** if still tied, **`provider_id ASC`**.

7. GIVEN operational ranking calculations are audited WHEN operational scores are inspected THEN the system SHALL support decomposing Provider scores into their individual operational scoring components.

## Requirement 5: Progressive Batch Visibility and Dispatch

_User Story_: Como sistema da Renovi, eu quero liberar Service Requests em batches progressivos mantendo visibilidade incremental permanente para prestadores já expostos ao Service Request.

### Acceptance Criteria

1.  GIVEN a ranked candidate list WHEN dispatch starts THEN the system SHALL create progressive batches of Providers; the **first batch** SHALL be scheduled `matching.dispatch_start_delay_minutes` (default 5 min) after **matching bootstrap** (enrichment `READY` handoff — `service_request_dispatches.created_at` / `next_batch_at`), **not** after SR `OPEN` insert alone; **`DISPATCH_PENDING` → `DISPATCH_ACTIVE`** SHALL occur when batch #1 opens (same transaction).
2.  GIVEN batch generation occurs WHEN Providers are grouped for dispatch THEN each batch SHALL contain a maximum of `matching.batch_size` Providers (read from `platform_constants` at runtime, default 10) (#89); GIVEN discovery finds **fewer than `matching.batch_size` but at least one** newly eligible Provider THEN the system SHALL still open the batch with all found Providers, grant visibility, enqueue notifications, and schedule the next attempt per #110 — **not** defer until the batch is full (#111).
3.  GIVEN the first batch WHEN dispatch begins THEN the system SHALL notify only Providers belonging to the first batch.
4.  GIVEN a Provider is included in an active batch WHEN the Provider becomes eligible to view the Service Request THEN the system SHALL persist batch visibility in `service_request_provider_visibility` (`source = batch`, `granted_at = now()`).
5.  GIVEN future batches are opened WHEN previous batch Providers already have visibility of the Service Request THEN the system SHALL maintain visibility for previously exposed Providers.
6.  GIVEN progressive batches are opened WHEN additional Providers become eligible THEN the system SHALL incrementally expand Service Request visibility without removing visibility from previously eligible Providers.
7.  GIVEN a Provider previously received visibility of a Service Request WHEN the Provider accesses the marketplace feed THEN the system SHALL continue displaying the Service Request unless the Service Request already has an accepted proposal or visibility was revoked.
8.  GIVEN a Provider previously received visibility of a Service Request WHEN the Provider has an in-flight proposal (`PENDING` or `REVISION_REQUESTED`), an **ACTIVE** chat, **or any prior submitted proposal** on that Service Request THEN `list_provider_opportunities` SHALL **hide** the Service Request from that Provider's feed (#95, #96); the Provider MAY still access the Service Request via provider-jobs, chat, or direct link. GIVEN the Provider had only discovery chat without ever submitting a proposal WHEN the chat is no longer **ACTIVE** THEN the Service Request MAY reappear in the feed if visibility remains (#96).
9.  GIVEN visibility persistence rules are evaluated WHEN batches progress over time THEN the system SHALL treat Service Request visibility as cumulative rather than temporary.
10. GIVEN a batch is active WHEN the fixed timeout of `matching.batch_interval_minutes` (default 60 min) has not expired THEN the system SHALL prevent future batches from opening; GIVEN cron phase 2 **successfully opens** a batch while dispatch remains `DISPATCH_ACTIVE` THEN the system SHALL set **`next_batch_at = now() + matching.batch_interval_minutes`** before releasing the lease (#110).
11. GIVEN notification delivery is processed for active batches WHEN notification execution occurs THEN notification delivery SHALL be enqueued through the Message Dispatcher (`message_dispatcher` schema) asynchronously and independently from batch persistence transactions (see Requirement 6).
12. GIVEN notification delivery failures occur WHEN notification attempts partially fail THEN notification failures SHALL not invalidate previously persisted batch state transitions.
13. GIVEN batch creation, dispatch state transitions, and notification scheduling metadata are persisted WHEN coordinated dispatch state changes occur THEN the system SHALL support atomic persistence semantics for operationally coupled dispatch transitions.
14. GIVEN the number of active chats related to the Service Request with at least one exchanged message within `matching.dispatch_active_chat_window_hours` (read from `platform_constants` at runtime, default 24 h) is greater than or equal to `matching.dispatch_pause_active_chat_threshold` (default 10) WHEN dispatch gates are evaluated THEN the system SHALL transition to `DISPATCH_PAUSED` **only if** the proposal cap gate for `DISPATCH_STOPPED` is not met, and SHALL set **`next_batch_at = NULL`** to cancel any scheduled batch (#82, #84, #87, #108).
15. GIVEN the dispatch state is `DISPATCH_PAUSED` WHEN active chats (≥1 message within `matching.dispatch_active_chat_window_hours`) drop below `matching.dispatch_pause_active_chat_threshold` THEN the system SHALL re-apply the gate priority ladder (#82, #85): transition to `DISPATCH_STOPPED` if the in-flight proposal cap is still met; else to `DISPATCH_FALLBACK_OPEN_MARKET` if `fallback_opened_at IS NOT NULL` and set **`next_batch_at = NULL`**; else to `DISPATCH_ACTIVE` and set **`next_batch_at = now()`** — **provided** the Service Request remains `OPEN`, dispatch has not reached a terminal state, and lifecycle has not expired (#84, #87, #106, #109).
16. GIVEN the number of submitted Provider proposals with status `PENDING` or `REVISION_REQUESTED` related to the Service Request is greater than or equal to `chats.max_active_slots_per_service_request` (read from `platform_constants` at runtime, default 4) WHEN dispatch gates are evaluated THEN the system SHALL transition to `DISPATCH_STOPPED` (highest priority), set **`next_batch_at = NULL`** to cancel any remaining scheduled batches, preserve existing visibility, and **block new proposals** (global cap — including via direct link/detail) (#78, #80, #81, #82, #88, #108).
17. GIVEN the dispatch state is `DISPATCH_STOPPED` WHEN the count of `PENDING` + `REVISION_REQUESTED` proposals drops below `chats.max_active_slots_per_service_request` THEN the system SHALL re-apply the gate priority ladder (#82, #85): transition to `DISPATCH_PAUSED` if active chats (≥1 message within `matching.dispatch_active_chat_window_hours`) are still ≥ `matching.dispatch_pause_active_chat_threshold`; else to `DISPATCH_FALLBACK_OPEN_MARKET` if `fallback_opened_at IS NOT NULL` and set **`next_batch_at = NULL`**; else to `DISPATCH_ACTIVE` and set **`next_batch_at = now()`** — **provided** the Service Request remains `OPEN`, dispatch has not reached a terminal state (`MATCHED`, `CANCELLED`, `EXPIRED`), and lifecycle has not expired (#84, #87, #106, #109).
18. GIVEN dispatch gate conditions MAY change WHEN proposal status transitions occur or time-based chat-activity windows elapse THEN the system SHALL re-evaluate gates through `evaluate_service_request_dispatch_gates(service_request_id)` — **inline** at the end of proposal-mutating RPCs (same transaction), **inline from `expire_pending_proposals` once per distinct affected `service_request_id`** when proposals expire (#105), and from `cron_process_service_request_dispatches()` phase 2 (#104); the function SHALL **no-op** when dispatch status is `DISPATCH_MATCHED`, `DISPATCH_CANCELLED`, or `DISPATCH_EXPIRED` (#86); the system SHALL **NOT** invoke gate re-evaluation on every `send_message` (#83).
19. GIVEN a Client accepts a proposal WHEN `accept_proposal` runs THEN the RPC SHALL **inline** (same transaction): transition dispatch to `DISPATCH_MATCHED`, revoke `service_request_provider_visibility` for non-winning Providers, cancel pending batch MMD dispatches, and complete the existing cascade (SR → `COMPLETED`, close competing chats, etc.) — **not** via separate triggers on `provider_proposals` or `service_requests`.
20. GIVEN a Client cancels the Service Request WHEN `cancel_service_request` runs THEN the RPC SHALL **inline** (same transaction): transition dispatch to `DISPATCH_CANCELLED`, stop new batches/notifications, cancel pending Message Dispatcher dispatches, revoke feed visibility for visibility-only Providers, and preserve CNS access for Providers with active proposals/chats — **not** via trigger on `service_requests` or lazy cron cleanup.
21. GIVEN the dispatch cron attempts to open a new batch WHEN dynamic candidate discovery finds **zero new eligible Providers** (all already notified or none match) THEN the system SHALL transition directly to `DISPATCH_FALLBACK_OPEN_MARKET`, set `fallback_opened_at = now()` and **`next_batch_at = NULL`** on the dispatch row, and record pool exhaustion in `service_request_dispatch_events` — **without** bulk-inserting visibility rows (#75, #109).
22. GIVEN dispatch remains in progressive batch mode WHEN `next_batch_at` elapses THEN the system SHALL **re-run dynamic discovery** and MAY open another batch — **no fixed cap** on batch count; batches continue until zero new eligible Providers, a terminal state, or lifecycle expiration.
23. GIVEN a Service Request exceeds `matching.dispatch_lifecycle_hours` (default 48 h) from **`service_request_dispatches.created_at`** WHEN `cron_process_service_request_dispatches()` runs **phase 1 (lifecycle sweep)** THEN the worker SHALL transition to `DISPATCH_EXPIRED` regardless of `next_batch_at` or gate state, stop new batches/notifications, and **SHALL NOT** include **new** fallback-eligible Providers via lazy computation; **existing persisted batch visibility** SHALL **remain** in the feed until match or cancel (#66, #91, #103).
24. GIVEN `fallback_opened_at IS NOT NULL` AND dispatch status is **not** `DISPATCH_EXPIRED` WHEN a Provider requests the feed THEN `list_provider_opportunities` SHALL **compute** fallback eligibility at query time (service/category + exact neighborhood; no 20 km filter) and union with persisted batch visibility — **including** when current `status` is `DISPATCH_STOPPED` or `DISPATCH_PAUSED` (#85); **no** mass push/e-mail (#14, #75). GIVEN `DISPATCH_EXPIRED` THEN lazy fallback SHALL **not** apply (#66, #86).
25. GIVEN a Service Request is `DISPATCH_EXPIRED` WHEN a Provider with **persisted batch** visibility accesses the feed THEN the Service Request **SHALL still appear** until visibility is revoked by match or cancel (#66).
26. GIVEN a Service Request is `DISPATCH_EXPIRED` WHEN a Provider with prior visibility initiates chat or submits a proposal THEN the system SHALL allow normal interaction while the Service Request remains `OPEN` (#67).
27. GIVEN a Provider has **only** fallback (lazy) visibility WHEN dispatch transitions to `DISPATCH_EXPIRED` THEN the opportunity **SHALL no longer appear** in the feed (fallback was never persisted).
28. GIVEN a Provider has never been batch-notified and is not fallback-eligible WHEN the Provider accesses the feed THEN the system SHALL hide the Service Request.
29. GIVEN dispatch status is `DISPATCH_EXPIRED` WHEN a Provider attempts a new proposal or new chat THEN the system SHALL enforce admission limits **only** through CNS RPCs (`chats.max_active_slots_per_service_request`); dispatch status SHALL **not** transition to `DISPATCH_STOPPED` or `DISPATCH_PAUSED` (#86).
30. GIVEN lifecycle expiration is due WHEN no separate pg_cron job exists THEN expiration SHALL run as **phase 1** of `cron_process_service_request_dispatches()` (~2 min cadence) — **not** lazily in feed RPCs and **not** gated on `next_batch_at` (#91, #103).
31. GIVEN phase 1 completes WHEN batch/gate work begins THEN **phase 2** SHALL: **(a)** process non-terminal dispatches with due `next_batch_at` (lease + **`evaluate_service_request_dispatch_gates` first**, then batch open **only if** status remains `DISPATCH_PENDING` or `DISPATCH_ACTIVE` after evaluation — #112); **(b)** process dispatches in `DISPATCH_PAUSED` or `DISPATCH_STOPPED` (lease + gate re-evaluation only — no batch open) so time-based chat-activity decay can resume dispatch without waiting for `next_batch_at` (#103, #104).
32. GIVEN `expire_pending_proposals` transitions one or more proposals to `EXPIRED` WHEN the in-flight proposal count for a Service Request drops below `chats.max_active_slots_per_service_request` THEN the job SHALL invoke `evaluate_service_request_dispatch_gates(service_request_id)` **inline in the same transaction**, **once per distinct affected Service Request** — not deferred to cron phase 2 (#81, #105).
33. GIVEN gate re-evaluation transitions dispatch from `DISPATCH_STOPPED` or `DISPATCH_PAUSED` to `DISPATCH_ACTIVE` WHEN scheduling resumes THEN the system SHALL set **`next_batch_at = now()`** — **not** `now() + matching.batch_interval_minutes` and **not** `now() + matching.dispatch_start_delay_minutes` (#106).
34. GIVEN `evaluate_service_request_dispatch_gates` is invoked **inline** (proposal RPCs, `expire_pending_proposals`) WHEN the function transitions dispatch toward `DISPATCH_ACTIVE` THEN it SHALL **only** update dispatch status and scheduling metadata — **batch discovery, visibility persistence, and Message Dispatcher enqueue SHALL occur exclusively** in `cron_process_service_request_dispatches()` phase 2 (~2 min max delay, #107).
35. GIVEN gate evaluation transitions dispatch **into** `DISPATCH_STOPPED` or `DISPATCH_PAUSED` WHEN batches are suspended THEN the system SHALL set **`next_batch_at = NULL`** — phase 2 gate-only processing (#104) resumes dispatch when conditions clear; landing on `DISPATCH_ACTIVE` sets `next_batch_at = now()` (#106, #108).
36. GIVEN gate evaluation or pool exhaustion transitions dispatch to `DISPATCH_FALLBACK_OPEN_MARKET` WHEN progressive batches SHALL NOT resume THEN the system SHALL set **`next_batch_at = NULL`** — whether from gate resume (#85) or initial pool exhaustion in cron phase 2 (#109).
37. GIVEN cron phase 2 opens a batch with at least one newly eligible Provider WHEN dispatch remains `DISPATCH_ACTIVE` and pool is not exhausted THEN the system SHALL schedule the next batch attempt at **`next_batch_at = now() + matching.batch_interval_minutes`** — **not** anchored to batch-open timestamp (#110).
38. GIVEN dynamic discovery returns **1 to `matching.batch_size − 1`** newly eligible Providers WHEN cron phase 2 processes a due dispatch THEN the system SHALL open a **partial batch** with all returned Providers — same visibility, notification, and scheduling semantics as a full batch (#111); GIVEN **zero** newly eligible Providers THEN pool exhaustion / fallback rules apply (#21).
39. GIVEN cron phase 2 processes a dispatch with due `next_batch_at` WHEN gate evaluation runs THEN the worker SHALL invoke **`evaluate_service_request_dispatch_gates` before** candidate discovery and batch open; GIVEN evaluation transitions to `DISPATCH_STOPPED`, `DISPATCH_PAUSED`, or `DISPATCH_FALLBACK_OPEN_MARKET` THEN the worker SHALL **skip** batch open for that tick — **not** open-then-pause (#112).

## Requirement 6: Provider Notification Dispatch (Message Dispatcher)

_User Story_: Como sistema da Renovi, eu quero notificar prestadores apenas quando seus respectivos batches forem liberados, utilizando o Message Dispatcher integrado para entrega multicanal (push e e-mail).

### Acceptance Criteria

1.  GIVEN a batch is opened WHEN eligible Providers are identified THEN the system SHALL enqueue notification delivery for each batch Provider through the **Message Dispatcher** (`message_dispatcher.message_dispatcher_ingest` or an equivalent idempotent ingest RPC), using **both** channels **`push`** and **`email`** for the new Service Request opportunity.
2.  GIVEN a batch notification is ingested WHEN Message Dispatcher quota and scheduling rules are evaluated THEN the notification SHALL **NOT** use limit bypass (`bypass_limits = false`); push and e-mail dispatches for new Service Request batch exposure SHALL count toward the Provider's **daily push and e-mail quotas** and SHALL respect **push cooldown** and **quiet hours** like any other non-bypass notification.
3.  GIVEN a Provider has already been notified for a Service Request WHEN duplicate notifications are evaluated THEN the system SHALL prevent duplicate dispatch notifications for the same Service Request and channel combination using idempotency keys: `dispatch:{service_request_id}:batch:{batch_number}:provider:{provider_id}:{channel}`.
4.  GIVEN a Provider's **daily push quota is exhausted** WHEN the batch opens THEN the system SHALL still grant visibility; push SHALL fail/terminal-skip without next-day retry; **e-mail** SHALL still be enqueued if e-mail quota permits; the Provider discovers the opportunity via e-mail or feed.
5.  GIVEN a Provider is offline or has no eligible push targets WHEN the batch opens THEN the system SHALL still register the notification attempt via Message Dispatcher (terminal failure states such as `no_push_targets` are acceptable; e-mail MAY still deliver when available).
6.  GIVEN batch visibility is persisted WHEN notification intents are created THEN notification ingest SHOULD be triggered by an **`AFTER INSERT` trigger** on `service_request_dispatch_batch_providers` enqueuing push + e-mail via `message_dispatcher_ingest` in the same transaction; actual delivery (FCM, Resend) SHALL remain in the Message Dispatcher worker Edge Function.
7.  GIVEN Message Dispatcher processes a batch notification WHEN templates are rendered THEN the system SHALL use template key **`matching.new_opportunity`** (push + e-mail), with variables at minimum: `service_request_id`, `title`, `service_name`, `neighborhood`, `urgency`, `deep_link_path` (no `distance_km` in notification payload).
8.  GIVEN notification delivery completes or fails WHEN operational audit is evaluated THEN delivery outcomes SHALL be observable through Message Dispatcher audit/status tables (`message_dispatches`, `message_dispatcher_audit`) without requiring duplicate notification state on dispatch tables beyond correlation identifiers.

## Requirement 7: Marketplace Load Balancing

_User Story_: Como sistema da Renovi, eu quero distribuir oportunidades de forma equilibrada para evitar concentração excessiva de demanda e fadiga de notificações.

### Acceptance Criteria

1. GIVEN multiple operationally qualified Providers with similar conversion potential WHEN ranking is calculated THEN the system SHALL consider time since last completed Service Request strictly as a secondary modifier or tie-breaker.
2. GIVEN a Provider recently completed multiple Service Requests WHEN ranking is calculated THEN the system SHALL reduce the Provider dispatch priority.
3. GIVEN Providers have long inactivity periods WHEN ranking is calculated THEN the system SHALL increase their balancing priority.
4. GIVEN a Provider has participated in recent batches WHEN a new batch ranking is calculated THEN the system SHALL reduce the Provider dispatch priority.
5. GIVEN a Provider has not participated in any batch within the last 30 minutes WHEN candidate ranking is calculated THEN the system SHALL prioritize the Provider over similarly ranked Providers with recent batch participation, provided the Provider still maintains reasonable operational conversion potential.
6. GIVEN the system evaluates Provider exposure frequency WHEN ranking is calculated THEN the system SHALL consider recent notification frequency as part of the operational ranking score.
7. GIVEN batch participation history is evaluated WHEN dispatch ranking occurs THEN the system SHALL use historical batch participation timestamps to reduce excessive Provider exposure.
8. GIVEN multiple eligible Providers have equal composed operational scores WHEN final ranking tie-breaking occurs THEN the system SHALL order by **ascending recent batch exposure count** (same window as #113), then **`provider_id ASC`** (#113).
9. GIVEN exploration balancing is applied WHEN secondary modifiers are finalized THEN the total exploration boost SHALL NOT exceed `matching.ranking_exploration_max_boost` (default +10%).

## Requirement 8: Dispatch Auditability

_User Story_: Como sistema da Renovi, eu quero registrar eventos de dispatch para permitir auditoria e análise operacional.

### Acceptance Criteria

1.  GIVEN a dispatch event occurs WHEN the system processes a Service Request THEN the system SHALL persist dispatch logs in `service_request_dispatch_events` with typed `event_type` (`service_request_dispatch_event_type` enum).
2.  GIVEN a batch opens WHEN Providers are notified THEN the system SHALL register notification timestamps (via Message Dispatcher audit correlation and/or dispatch_events).
3.  GIVEN a Provider interacts with a Service Request WHEN the interaction occurs THEN the system SHALL persist interaction events in `service_request_dispatch_events`.
4.  GIVEN a Provider explicitly declines a Service Request (“Não tenho interesse”) WHEN the client invokes **`dismiss_provider_opportunity(p_service_request_id)`** from the **opportunities feed UI in `provider-jobs`** (card/list action — **not** from `ServiceDetailPage` / detail screen, #117) THEN the system SHALL persist `provider_declined` in `service_request_dispatch_events`, set `dismissed_at` on the Provider's visibility row (batch: update existing row; fallback-only: insert dismiss row per #75), hide the opportunity from that Provider's feed, and SHALL NOT affect other Providers or batch eligibility beyond prior notification (#19, #74, #100). GIVEN the Provider already dismissed the opportunity WHEN the RPC is called again THEN the system SHALL return success as a **no-op** without inserting a duplicate event (#101). GIVEN a dismissed Provider WHEN accessing the Service Request via **`get_service`**, direct link, or CNS actions THEN the system SHALL **not** block access solely because of `dismissed_at` — dismiss affects **feed listing only** (#102).
5.  GIVEN operational ranking calculations occur WHEN Provider ranking decisions are evaluated THEN the system SHALL support auditing operational score composition and ranking factors (score snapshot on `service_request_dispatch_batch_providers`).
6.  GIVEN dispatch state transitions occur WHEN operational events are persisted THEN the system SHALL support historical inspection of dispatch lifecycle transitions.
7.  GIVEN asynchronous dispatch execution occurs WHEN retries, resumptions, or scheduling events are processed THEN the system SHALL persist operational execution events for debugging and operational observability purposes.
8.  GIVEN historical dispatch operational data accumulates over time WHEN operational storage growth is evaluated THEN the system SHOULD support archival, retention, or cleanup policies for operational dispatch data.

## Requirement 9: Geospatial Indexing and Spatial Partitioning

_User Story_: Como sistema da Renovi, eu quero utilizar indexação geoespacial eficiente para suportar dispatch em larga escala com baixa latência.

### Acceptance Criteria

1.  GIVEN geolocation queries are executed WHEN Provider proximity is calculated THEN the system SHALL use geospatial indexing on **`provider_latest_locations`** (maintained by trigger on `user_device_beacons` upsert).
2.  GIVEN dispatch candidate searches are executed WHEN nearby Providers are searched THEN the system SHALL support H3-based spatial indexing at resolution `matching.h3_resolution` (default 7).
3.  GIVEN large metropolitan regions WHEN dispatch queries are executed THEN the system SHALL avoid full-table geospatial scans whenever possible.
4.  GIVEN high dispatch concurrency WHEN multiple Service Requests are processed simultaneously THEN the system SHALL support scalable geospatial lookup strategies.
5.  GIVEN a Provider uses multiple devices WHEN operational location is resolved THEN the system SHALL use the row with the most recent `location_recorded_at` among devices with permission and valid freshness; audit MAY record originating `device_id`.

## Requirement 10: Dispatch Scalability

_User Story_: Como sistema da Renovi, eu quero minimizar processamento redundante para garantir escalabilidade operacional.

### Acceptance Criteria

1.  GIVEN future batches are processed WHEN candidate discovery occurs THEN the system SHALL dynamically resolve candidates without relying on stale global snapshots.
2.  GIVEN dispatch scheduling occurs WHEN future batches are pending THEN the system SHALL support asynchronous execution.
3.  GIVEN the dispatch system processes multiple Service Requests simultaneously WHEN concurrency increases THEN the system SHALL maintain isolation between Service Request dispatch flows.
4.  GIVEN asynchronous dispatch execution occurs WHEN future dispatch steps are scheduled THEN the system SHALL support persisted dispatch scheduling through database-backed task persistence mechanisms.
5.  GIVEN dispatch orchestration occurs WHEN asynchronous execution is coordinated THEN the system SHALL avoid requiring continuously running in-memory dispatch processes.
6.  GIVEN dispatch jobs are processed asynchronously WHEN concurrent workers consume pending dispatch tasks THEN the system SHALL support safe concurrent task acquisition mechanisms.
7.  GIVEN dispatch processing is resumed asynchronously WHEN pending scheduled executions are evaluated THEN the system SHALL support restart-safe dispatch continuation semantics.

## Requirement 10A: Dispatch Idempotency and Concurrency Control

_User Story_: Como sistema da Renovi, eu quero garantir execução idempotente e isolamento concorrente do dispatch para evitar batches duplicados, notificações duplicadas e inconsistências operacionais durante retries ou execução paralela.

### Acceptance Criteria

1. GIVEN dispatch execution retries or asynchronous reprocessing WHEN batch generation occurs THEN the system SHALL guarantee idempotent batch creation for the same Service Request dispatch state.

2. GIVEN concurrent dispatch workers or asynchronous executions WHEN dispatch state transitions occur THEN the system SHALL prevent overlapping batch generation for the same Service Request.

3. GIVEN notification dispatch retries or duplicated execution attempts WHEN Provider notifications are processed THEN the system SHALL prevent duplicate notifications for the same Provider and Service Request combination.

4. GIVEN dispatch state updates occur WHEN batches are opened, paused, resumed, stopped, exhausted, or matched THEN the system SHALL persist dispatch state transitions atomically.

5. GIVEN concurrent dispatch state modifications WHEN dispatch persistence occurs THEN the system SHALL support optimistic concurrency control or equivalent dispatch version validation mechanisms.

6. GIVEN asynchronous dispatch execution occurs WHEN dispatch ownership is evaluated THEN the system SHALL ensure that only one active execution flow controls batch progression for a given Service Request at any point in time.

7. GIVEN dispatch execution ownership is coordinated WHEN concurrent execution attempts occur THEN the system SHALL support transactional locking or equivalent database-level execution coordination mechanisms to guarantee dispatch isolation.

8. GIVEN dispatch execution ownership is acquired WHEN execution coordination occurs THEN the system SHALL use **lease-based ownership** on `service_request_dispatches` (`lease_owner`, `lease_expires_at`); expired leases SHALL allow recovery by a subsequent cron worker.

9. GIVEN dispatch execution ownership leases are evaluated WHEN execution workers fail or become unavailable THEN expired execution ownership leases SHALL allow future dispatch execution recovery.

10. GIVEN dispatch execution retries occur WHEN partially completed operations are reprocessed THEN the system SHALL support safe retry semantics for dispatch continuation.

## Requirement 10B: Dispatch Operational Scheduling

_User Story_: Como sistema da Renovi, eu quero suportar scheduling operacional persistido para permitir progressão temporal de dispatches sem depender de processos continuamente ativos.

### Acceptance Criteria

1. GIVEN dispatch batches require delayed progression WHEN future dispatch execution is scheduled THEN the system SHALL persist future execution scheduling state on `service_request_dispatches.next_batch_at`.

2. GIVEN dispatch scheduling occurs WHEN delayed execution timestamps are evaluated THEN the system SHALL support database-backed scheduling semantics.

3. GIVEN asynchronous dispatch scheduling occurs WHEN pending executions become eligible for processing THEN the system SHALL support resumable execution through persisted scheduling state; **`pg_cron` every 2 minutes** SHALL invoke `cron_process_service_request_dispatches()` with `job_runs` observability; the worker SHALL run **phase 1 lifecycle sweep** then **phase 2** (due batches + gate re-evaluation on `PAUSED`/`STOPPED`, #104), acquiring a **lease** before processing each row in phase 2 (decision #68, #103).

4. GIVEN dispatch execution resumes after scheduling delays WHEN dispatch orchestration continues THEN the system SHALL continue from the latest persisted dispatch state.

5. GIVEN scheduling retries or transient failures occur WHEN dispatch scheduling is reprocessed THEN the system SHALL guarantee idempotent processing with transactional locking.

6. GIVEN dispatch scheduling mechanisms are evaluated WHEN pending dispatch executions are processed THEN the system SHOULD avoid high-frequency global polling beyond the 2-minute cron cadence.

## Requirement 11: Provider Response Tracking

_User Story_: Como sistema da Renovi, eu quero rastrear respostas dos prestadores para melhorar futuros rankings.

### Acceptance Criteria

1.  GIVEN a Provider opens a Service Request opportunity detail WHEN **`ServiceDetailPage`** or **`ServiceDetailSheet`** mounts/opens in **`view-services`** — from any entry path (feed, push, e-mail link, direct URL, dashboard sheet) — THEN a dedicated hook in **`view-services`** (e.g. `useRecordProviderOpportunityView`) SHALL call **`record_provider_opportunity_view(p_service_request_id)`** via **`view-services/api/`** on **mount** as soon as `serviceRequestId` is defined and the authenticated user is a Provider — **without** waiting for `get_service` to succeed (#116, #119); **`get_service`** SHALL remain read-only with no dispatch side effects (#92, #94, #115).
2.  GIVEN **`record_provider_opportunity_view`** is invoked WHEN a `provider_viewed` event already exists for the same `(service_request_id, provider_id)` THEN the RPC SHALL succeed as a **no-op** without inserting a duplicate row (#93).
3.  GIVEN **`get_service`** is invoked WHEN any authenticated user reads service detail THEN the RPC SHALL **not** insert dispatch audit events as a side effect (#92).
4.  GIVEN a Provider accepts a Service Request WHEN ranking metrics are updated THEN the system SHALL update acceptance statistics via `provider_proposal_stats` (trigger on terminal proposal transitions).

## Requirement 12: Provider Geolocation Tracking and Device Beacon Sync

_User Story_: Como prestador logado na Renovi, eu quero que o app atualize periodicamente minha posição aproximada para receber oportunidades de serviço próximas, entendendo por que a localização é necessária e podendo controlar essa permissão no dispositivo.

_User Story (sistema)_: Como sistema da Renovi, eu quero persistir a última posição conhecida de cada prestador por instalação de dispositivo em `user_device_beacons`, com indicação explícita de permissão concedida, para alimentar o matching geoespacial sem coletar localização de clientes.

### Acceptance Criteria — Escopo e gating por perfil

1.  GIVEN a user is authenticated WHEN the client evaluates whether to initialize location tracking THEN the system SHALL only activate location collection, background tasks, and permission flows for users whose `profiles.role` is `provider`.
2.  GIVEN a user is authenticated with role `client` WHEN the app loads or syncs device beacons THEN the system SHALL NOT request location permission, SHALL NOT start `@capgo/background-geolocation` (or equivalent), and SHALL NOT write location fields on `user_device_beacons`.
3.  GIVEN a user is authenticated with role `client` WHEN device beacon sync runs THEN the system SHALL continue to sync only device/push metadata (FCM, platform, etc.) without location columns populated for matching purposes.
4.  GIVEN a Provider uses multiple devices or reinstallations WHEN location is synced THEN the system SHALL store location independently per `(profile_id, device_id)` row in `user_device_beacons`.
5.  GIVEN dispatch eligibility resolution runs WHEN Provider geolocation is needed THEN the system SHALL resolve the Provider's latest known location from **`provider_latest_locations`** (derived from `user_device_beacons`; most recent `location_recorded_at` among permitted devices with valid freshness).

### Acceptance Criteria — UX de permissão (somente prestador)

6.  GIVEN a Provider is logged in and has not yet been prompted for location WHEN the app determines location is needed for matching THEN the system SHALL display an explanatory dialog **before** invoking the OS permission prompt, describing why location is used (ex.: receber trabalhos próximos, matching dentro de ~20 km), que updates são periódicos e de baixa frequência, e que clientes não passam por esse fluxo.
7.  GIVEN the explanatory dialog is shown WHEN the Provider dismisses or declines THEN the system SHALL NOT call the native/browser permission API and SHALL persist `location_permission_granted = false` on the device beacon row on the next sync.
8.  GIVEN the explanatory dialog is shown WHEN the Provider confirms THEN the system SHALL request location permission through the platform APIs (`@capgo/background-geolocation` / browser geolocation).
9.  GIVEN the OS permission result is known WHEN device beacon sync occurs THEN the system SHALL persist `location_permission_granted` accurately (`true` if granted, `false` if denied or restricted).
10. GIVEN a Provider previously granted permission WHEN permission is revoked in OS settings THEN the system SHALL detect the denial on subsequent collection attempts, set `location_permission_granted = false`, stop background tracking when applicable, and MAY surface a non-blocking prompt to re-enable via settings (`openSettings` no nativo quando apropriado).

### Acceptance Criteria — Coleta no cliente

11. GIVEN a Provider with granted location permission on a native Capacitor app WHEN location tracking is active THEN the system SHALL use `@capgo/background-geolocation` to receive updates em background com configuração de **baixa frequência** e **precisão operacional moderada** (ex.: `distanceFilter` elevado; sem exigir alta precisão contínua).
12. GIVEN a Provider on web or PWA WHEN location tracking is active THEN the system SHALL collect location only through browser geolocation while the app/session is usable in foreground (ou conforme APIs disponíveis), without assuming background tracking equivalente ao nativo.
13. GIVEN a new location sample is obtained WHEN accuracy and timestamp are available THEN the client SHALL debounce/throttle uploads para evitar sync excessivo ao backend (compatível com freshness tolerável do matching).
14. GIVEN a Provider logs out WHEN logout cleanup runs THEN the system SHALL stop location tracking on the device and SHALL NOT leave `@capgo/background-geolocation` running for that session.
15. GIVEN a Provider is not accepting new Service Requests or is operationally inactive WHEN product rules define tracking pause THEN the system SHOULD stop or reduce location collection to preserve battery (detalhe de implementação; não substitui elegibilidade no dispatch).

### Acceptance Criteria — Persistência em `user_device_beacons`

16. GIVEN a location sample is ready to sync WHEN the client upserts `user_device_beacons` THEN the system SHALL write `location`, `location_accuracy_meters`, and `location_recorded_at` together with existing device/push fields for the same `(profile_id, device_id)`.
17. GIVEN location permission is not granted WHEN beacon sync runs THEN the system SHALL upsert `location_permission_granted = false` and SHALL NOT populate `location` with fabricated coordinates.
18. GIVEN location fields are updated WHEN sync succeeds THEN the system SHALL refresh `updated_at` on the beacon row (mantendo compatibilidade com purge de instalações stale).
19. GIVEN RLS on `user_device_beacons` WHEN a Provider syncs location THEN only the authenticated Provider (`auth.uid() = profile_id`) SHALL be allowed to insert/update their own beacon rows.

### Acceptance Criteria — Integração com matching

20. GIVEN Requirement 3 geospatial filtering WHEN nearby Providers are searched THEN eligibility SHALL use **`provider_latest_locations`** subject to freshness rules (`matching.beacon_location_max_age_hours`).
21. GIVEN a Provider has `location_permission_granted = false`, stale/missing `location_recorded_at`, or no valid beacon WHEN eligibility is evaluated THEN the system SHALL apply **neighborhood exact-match eligibility** and **deprioritized ranking** (proximity = 0, penalty `matching.no_beacon_score_penalty`); the Provider SHALL NOT be excluded solely for lacking beacon.
22. GIVEN the 20 km search radius WHEN distance is calculated THEN moderate GPS accuracy and low-frequency updates SHALL be considered acceptable; the system SHALL NOT require sub-meter precision for dispatch eligibility.

### Acceptance Criteria — Plataforma nativa (Capacitor)

23. GIVEN Android background tracking WHEN `@capgo/background-geolocation` runs THEN the app SHALL show the required persistent notification (`backgroundMessage` / `backgroundTitle`) and SHALL configure `android.useLegacyBridge: true` no Capacitor config para mitigar interrupção após ~5 minutos em background.
24. GIVEN location updates are sent to Supabase from background on Android WHEN HTTP is performed THEN the client SHOULD use native HTTP (`@capacitor/http`) to avoid WebView throttling após período prolongado em background.
25. GIVEN iOS background tracking WHEN configured THEN the app SHALL declare `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, and `UIBackgroundModes` → `location` conforme documentação do plugin.

## Requirement 13: Provider Opportunities Feed (`list_provider_opportunities`)

_User Story_: Como prestador da Renovi, eu quero ver apenas oportunidades de serviço às quais tenho direito de acesso, com ordenação útil conforme minha localização atual, sem expor todos os pedidos abertos no raio.

### Acceptance Criteria

1. GIVEN a Provider requests their opportunities feed WHEN `list_provider_opportunities` is invoked THEN the system SHALL return Service Requests from **(a)** persisted batch visibility (`revoked_at` NULL, `dismissed_at` NULL) **union (b)** lazy fallback eligibility when `fallback_opened_at IS NOT NULL` **and** dispatch status is **not** `DISPATCH_EXPIRED` (service + exact neighborhood; excludes Providers with batch visibility or fallback dismiss row) — **including** when current status is `DISPATCH_FALLBACK_OPEN_MARKET`, `DISPATCH_STOPPED`, or `DISPATCH_PAUSED` (#75, #85, #86) — **excluding** Service Requests where the requesting Provider has an in-flight proposal (`PENDING`/`REVISION_REQUESTED`), an **ACTIVE** chat, or **any prior submitted proposal row** on that Service Request (#95, #96).
2. GIVEN the legacy open feed WHEN progressive matching is deployed THEN the system SHALL **remove** RPC `match_provider_jobs` and Edge Function `match-provider-jobs`; the client feature `provider-jobs` and routes SHALL remain, calling the new RPC via Edge **`list-provider-opportunities`** through **`provider-jobs/api/`** (ADR 0001, 0003, #120).
3. GIVEN a Provider supplies optional lat/lng from Capacitor/browser at feed access WHEN sort mode is evaluated THEN the system SHALL support **`nearest`** (default), **`newest`**, and **`least_competitive`**; lat/lng SHALL **NOT** filter out visible opportunities and SHALL **NOT** affect batch eligibility. When `sort_mode = nearest`, lat/lng is required for ordering; `distance_km` MAY still be displayed when other sort modes are selected.
4. GIVEN a Provider does **not** supply feed lat/lng WHEN sort mode is evaluated THEN the system SHALL default to **`newest`** and also support **`least_competitive`** (lowest count of **active chats** on the SR — conversations with ≥1 message within `matching.dispatch_active_chat_window_hours`, default 24 h); **`nearest`** SHALL be hidden/disabled; the UI MAY show a non-blocking prompt that location permission improves the experience (#87).
5. GIVEN feed GPS is available WHEN opportunities are listed THEN **`nearest`** SHOULD be the default sort; all three modes (`nearest`, `newest`, `least_competitive`) SHALL remain available (#73).
6. GIVEN a Service Request reaches DISPATCH_MATCHED or DISPATCH_CANCELLED WHEN visibility is evaluated THEN revoked opportunities SHALL NOT appear in the feed. GIVEN DISPATCH_EXPIRED WHEN visibility was granted before expiration THEN opportunities **SHALL remain** in the feed until match or cancel.
7. GIVEN a Provider has `profiles.operational_status = suspended` WHEN the feed is requested THEN the system SHALL return an empty opportunities list (suspended Providers do not receive new opportunities).
8. GIVEN the opportunities feed is paginated WHEN `list_provider_opportunities` is invoked THEN the system SHALL use **cursor-based** pagination (`cursor` opaque token + `limit`, default 20, max 50) instead of offset `page`/`page_size`.
9. GIVEN a cursor is supplied WHEN the next page is fetched THEN results SHALL be stable under concurrent visibility changes (no duplicate/skipped rows within the same sort order).
10. GIVEN the RPC response WHEN a page is returned THEN the payload SHALL include `next_cursor` (nullable) and `has_more` for infinite-scroll clients.
11. GIVEN cursor pagination WHEN sort mode is active THEN the opaque cursor SHALL encode **sort-mode-specific** tie-break keys: `newest` → `(granted_at DESC, service_request_id)` — batch rows use `visibility.granted_at`; fallback rows use `dispatch.fallback_opened_at`; `nearest` → `(distance_km ASC, service_request_id)`; `least_competitive` → `(active_chat_count_in_window ASC, service_request_id)` where the window is `matching.dispatch_active_chat_window_hours` (#72, #75, #87). Changing `sort_mode` SHALL invalidate a prior cursor.
12. GIVEN a Provider previously submitted a proposal on a Service Request WHEN the proposal reaches a terminal state THEN the Service Request SHALL **remain hidden** from that Provider's opportunities feed — **not** reappear (#96). GIVEN terminal state **`EXPIRED`** WHEN the Provider resubmits a new proposal THEN feed visibility SHALL **still not** return; access is via provider-jobs, chat, or direct link (#96, #97). GIVEN **`REJECTED`** or **`REJECTED_AUTOMATICALLY`** THEN the Provider SHALL NOT submit further proposals — enforcement via existing CNS RPCs (chat closed) (#97).

### Service detail and provider actions (not gated by batch visibility)

14. GIVEN an authenticated Provider has a `service_request_id` or direct link WHEN **`get_service`** is invoked THEN the system SHALL return the service detail **without** requiring batch visibility, fallback eligibility, or feed presence (#76) — consistent with `service_viewer_has_access` (any provider may read an existing SR); **`get_service` SHALL NOT** record `provider_viewed` (#92).
15. GIVEN an authenticated Provider opens an opportunity detail WHEN **`ServiceDetailPage`** or **`ServiceDetailSheet`** loads in **`view-services`** — regardless of navigation source — THEN **`useRecordProviderOpportunityView`** SHALL invoke **`record_provider_opportunity_view(p_service_request_id)`** through **`view-services/api/`** on mount (Provider role + defined `serviceRequestId`) — **not** gated on `get_service` success (#116) — **idempotent**: at most one event per `(service_request_id, provider_id)` (#92, #93, #94, #115, #119).
16. GIVEN an authenticated Provider WHEN submitting a **proposal** on a Service Request THEN the system SHALL allow the action for any SR in **`OPEN`** status **without** requiring batch/fallback visibility (#77), **except** when dispatch is `DISPATCH_STOPPED` (≥ `chats.max_active_slots_per_service_request` in-flight proposals: `PENDING` + `REVISION_REQUESTED`) — then **new proposals** SHALL be rejected (#78, #80, #81, #88). GIVEN the Provider's **latest** proposal on that SR is **`REJECTED`** or **`REJECTED_AUTOMATICALLY`** THEN **new proposals SHALL NOT** be permitted — CNS closes the chat and blocks further negotiation (#97). GIVEN the Provider's latest terminal proposal is **`EXPIRED`** THEN a **new** proposal MAY be submitted via CNS resubmit rules while the SR remains `OPEN` (#97); the opportunity **SHALL remain hidden** from the feed (#96).
17. GIVEN an authenticated Provider WHEN **starting a new chat** on a Service Request THEN the system SHALL allow the action for any SR in **`OPEN`** status **without** requiring batch/fallback visibility (#77) and **without** an extra `DISPATCH_STOPPED` gate — admission SHALL follow **CNS slot rules only** (`initiate_conversation` / `active_chat_count` vs `chats.max_active_slots_per_service_request`); a Provider MAY open a discovery chat without a proposal even when four in-flight proposals exist, **provided** a chat slot remains (#88).
18. GIVEN visibility gates WHEN evaluated THEN **only** `list_provider_opportunities` (feed discovery) SHALL require batch visibility or lazy fallback eligibility — not detail read via `get_service`.
19. GIVEN dispatch is `DISPATCH_STOPPED` WHEN a Provider attempts a **new proposal** via direct link THEN the system SHALL reject the action (global proposal cap); existing conversations and discovery chats remain active (#88).
20. GIVEN a Provider previously dismissed an opportunity WHEN they access the Service Request via direct link or notification THEN `get_service` and CNS actions (chat/proposal per #77, #97) SHALL remain available — **`dismissed_at` blocks feed listing only** (#102).
21. GIVEN a Provider wants to decline an opportunity from the feed WHEN the **`provider-jobs`** UI exposes “Não tenho interesse” on the opportunity card/list THEN the client SHALL call **`dismiss_provider_opportunity`** via **`provider-jobs/api/`** — the action SHALL **NOT** be offered on **`ServiceDetailPage`** / detail screen (#117, #118).

# Implementation Guidance

As implementações do dispatch progressivo SHALL priorizar:

- coordenação transacional baseada em PostgreSQL;
- **triggers no banco de dados para efeitos colaterais acoplados a transições de estado**, exceto quando I/O externo ou orquestração assíncrona for claramente superior (ver *Database triggers for side effects*);
- execução resumível baseada em estado persistido;
- processamento assíncrono orientado a scheduling;
- isolamento concorrente entre Service Requests;
- **escalabilidade para muitos prestadores e muitos dispatches simultâneos**, dentro exclusivamente de PostgreSQL + Edge Functions;
- minimização de scans geoespaciais amplos;
- redução de processamento redundante;
- idempotência operacional;
- observabilidade operacional;
- execução restart-safe;
- mecanismos de locking transacional;
- filas persistidas em banco de dados;
- coleta de localização apenas para `profiles.role = provider`, com sync em `user_device_beacons` e agregação em `provider_latest_locations`;
- feed de oportunidades via RPC **`list_provider_opportunities`** (substitui `match_provider_jobs`);
- entrega de notificações de batch via **Message Dispatcher** (push + e-mail, sem bypass de limites).

O sistema SHOULD evitar:

- dependência de processos continuamente ativos;
- dependência de estado mantido exclusivamente em memória;
- geração de snapshots globais persistentes de candidatos;
- polling agressivo de alta frequência;
- scans geoespaciais completos sem pré-filtragem;
- pedir permissão de localização ou iniciar background geolocation para usuários `client`;
- alta frequência de GPS ou precisão desnecessária para matching em raio de 20 km;
- envio direto de push/e-mail fora do Message Dispatcher ou com `bypass_limits` para oportunidades de novo serviço em batch;
- infraestrutura de workers persistentes além do modelo Supabase (Postgres + Edge Functions + crons).

Dispatch executions SHOULD remain short-lived, resumable, and independently restartable

### Provider location — client vs server

| Responsabilidade | Local |
| ---------------- | ----- |
| Dialog explicativa + OS permission (provider only) | Client (feature hook) |
| `@capgo/background-geolocation` start/stop (native) | Client |
| Throttle/debounce de amostras | Client |
| Upsert `user_device_beacons` (location + permission flag) | Client → API layer → Supabase |
| Freshness / elegibilidade geoespacial | PG (Requirement 3) |
| `provider_latest_locations` maintenance | PG (trigger on beacon upsert) |
| Purge de beacons stale (30 dias) | PG (cron existente) |
| Feed opportunities RPC | PG (`list_provider_opportunities`) |
| Service detail RPC | PG (`get_service` — ungated read for providers) |
| Proposal/chat actions | PG (CNS RPCs — SR `OPEN` only; no visibility gate) |

## O que deve ficar no PostgreSQL

| Responsabilidade       | Local |
| ---------------------- | ----- |
| H3 filtering           | PG    |
| PostGIS filtering      | PG    |
| eligibility rules      | PG    |
| ranking score          | PG    |
| batch generation       | PG    |
| concurrency locking    | PG    |
| lease acquisition      | PG    |
| scheduling persistence | PG    |
| state transitions      | PG    |
| idempotency            | PG    |
| visibility persistence | PG    |
| retry-safe logic       | PG    |
| provider location freshness (eligibility) | PG |
| latest provider location read for matching | PG (`provider_latest_locations`) |
| provider ratings (per completed service) and quality aggregates | PG |
| `submit_service_rating` / `update_service_rating` RPCs (#121–#134) | PG |
| provider proposal conversion aggregates | PG |
| bootstrap `provider_rating_stats` / `provider_proposal_stats` on provider profile | PG (trigger, #122, #130) |
| refresh stats triggers on `service_ratings` / terminal `provider_proposals` | PG (#127, #132) |
| `platform_constant_numeric` helper + `matching.*` seeds | PG (migration #98, #124, #131) |
| `evaluate_service_request_dispatch_gates` helper | PG (#83, #105, #107) |
| gate re-evaluation hook in `expire_pending_proposals` | PG (#105) |
| trigger-based enqueue of Message Dispatcher ingest on batch open | PG (trigger on `service_request_dispatch_batch_providers`) |
| dispatch cron worker (`cron_process_service_request_dispatches`) | PG (`pg_cron` + `job_runs`) |
| dispatch row bootstrap on enrichment `READY` | PG (`matching_bootstrap_dispatch_for_service_request`, called from enrichment finalize / repair sweeper; OPEN-insert trigger DROPped — [service-completion §3.7](../service-completion/design.md)) |
| dispatch → `MATCHED` on accept | PG (`accept_proposal` RPC inline) |
| dispatch → `CANCELLED` on SR cancel | PG (`cancel_service_request` RPC inline) |
| `list_provider_opportunities` feed query | PG |
| `dismiss_provider_opportunity` decline RPC | PG (#100–#101) |
| `record_provider_opportunity_view` audit RPC | PG (#92) |

## O que deve ficar nas Edge Functions

| Responsabilidade          | Local |
| ------------------------- | ----- |
| disparar scheduler / cron entrypoint | Edge (thin wrapper) ou PG (`pg_cron`) |
| **`list-provider-opportunities`** Edge (auth + RPC proxy) | Edge |
| Message Dispatcher worker (push + e-mail via FCM/Resend) | Edge |
| chamar providers externos | Edge |
| observabilidade           | Edge |
| retries externos          | Edge |

## O que deve ficar no client (app / PWA / web)

| Responsabilidade | Local |
| ---------------- | ----- |
| Gating por `profiles.role === 'provider'` | Client hook |
| Dialog explicativa antes da permissão | Client UI |
| `@capgo/background-geolocation` (Android/iOS) | Client |
| Geolocation browser (web/PWA, foreground) | Client |
| Sync location → `user_device_beacons` | Client API layer |
| Feed sort modes (`newest`, `nearest`, `least_competitive`) | Client (`provider-jobs` feature) |
| `list_provider_opportunities` feed RPC | Client **`provider-jobs/api/`** → Edge `list-provider-opportunities` (#120) |
| `dismiss_provider_opportunity` RPC | Client **`provider-jobs/api/`** (#118) |
| `record_provider_opportunity_view` RPC | Client **`view-services/api/`** + `useRecordProviderOpportunityView` on detail mount (#115–#119) |
| Optional feed lat/lng (Capacitor/browser) | Client |
| “Não tenho interesse” dismiss action | Client **`provider-jobs`** feed card only (#117) |
| Stop tracking on logout | Client |
