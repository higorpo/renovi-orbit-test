# Renovi Dispatch & Progressive Matching Algorithm Requirements

## Context

Este documento descreve os requisitos funcionais iniciais do algoritmo de dispatch e matching progressivo da Renovi.

O objetivo do sistema é distribuir pedidos de serviço de forma inteligente, escalável e progressiva, priorizando:

- proximidade geográfica em relação ao cliente;
- qualidade do prestador (avaliações);
- liquidez do marketplace;
- taxa de conversão;
- tempo de resposta;
- equilíbrio de distribuição de demanda;redução de spam e fadiga de notificações.

O sistema opera primeiramente via dispatch fechado, utilizando um mural aberto apenas como último recurso de fallback.

O sistema deve operar através de:

- ranking de prestadores;
- batches/lotes progressivos;
- expansão gradual de visibilidade através de batches progressivos dentro de um raio geográfico fixo de 20 km;
- controle temporal de exposição
- esolução dinâmica de candidatos elegíveis por batch.

# Assumptions

O sistema atualmente assume:

- utilização de Supabase;    
- utilização de PostgreSQL;    
- utilização de PostGIS para geolocalização;    
- utilização de H3 Index como mecanismo de particionamento e otimização de buscas geoespaciais;    
- backend baseado em Edge Functions;    
- notificações push para prestadores;    
- existência de categorias e especialidades de prestadores;    
- existência de avaliações de prestadores;    
- existência de status de Service Requests;    
- existência de status de Providers.
- utilização de filas persistidas em PostgreSQL;
- utilização de execução assíncrona baseada em scheduling;
- utilização de mecanismos de locking transacional do PostgreSQL;
- utilização de execução resumível baseada em dispatch state persistido.

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
- DISPATCH_EXHAUSTED
- DISPATCH_MATCHED
- DISPATCH_FALLBACK_OPEN_MARKET
- DISPATCH_CANCELLED
- DISPATCH_EXPIRED

### State Definitions

- DISPATCH_PENDING:
  Service Request criada aguardando início do dispatch.

- DISPATCH_ACTIVE:
  Dispatch em execução com batches ativos ou futuros batches pendentes.

- DISPATCH_PAUSED:
  Dispatch temporariamente pausado devido a excesso de interações ativas ou condições operacionais temporárias.

- DISPATCH_STOPPED:
  Dispatch interrompido devido ao atingimento de condições de parada.

- DISPATCH_EXHAUSTED:
  Todos os batches elegíveis foram processados sem match.

- DISPATCH_MATCHED:
  Service Request possui proposta aceita pelo cliente.

- DISPATCH_FALLBACK_OPEN_MARKET:
  Service Request exposta publicamente através do marketplace fallback.

- DISPATCH_CANCELLED:
  Service Request cancelada antes da conclusão do dispatch.

- DISPATCH_EXPIRED:
  Dispatch encerrado devido ao atingimento do tempo máximo permitido de exposição ou lifecycle operacional da Service Request.

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

# Requirements

## Requirement 1: Dynamic Candidate Resolution

_User Story_: Como sistema da Renovi, eu quero resolver candidatos dinamicamente no momento da abertura de cada batch para garantir que o dispatch utilize informações atualizadas de disponibilidade, localização e capacidade operacional dos prestadores.

### Acceptance Criteria

1.  GIVEN a new Service Request is created WHEN the dispatch process starts THEN the system SHALL persist the dispatch state without generating a static candidate snapshot.
2.  GIVEN a batch is about to open WHEN candidate discovery starts THEN the system SHALL dynamically renew a search window of up to 200 closest eligible Providers.    
3.  GIVEN candidate discovery occurs WHEN Providers are evaluated THEN the system SHALL use the most recent Provider availability data.    
4.  GIVEN candidate discovery occurs WHEN Providers are evaluated THEN the system SHALL use the most recent Provider geolocation data.
5.  GIVEN candidate discovery occurs WHEN Providers are evaluated THEN the system SHALL use the most recent Provider workload and active Service Request data.
6.  GIVEN a Provider was already notified in previous batches WHEN candidate resolution occurs THEN the system SHALL exclude the Provider from future candidate searches for the same Service Request.
7.  GIVEN candidate resolution occurs WHEN Providers are searched THEN the system SHALL only include Providers that satisfy current eligibility rules.
8.  GIVEN batch candidate resolution completes WHEN ranking is calculated THEN the system SHALL rank candidates using real-time operational data.
9.  GIVEN future batches are opened WHEN candidate resolution occurs THEN the system SHALL recalculate eligibility and ranking instead of reusing stale candidate snapshots.

## Requirement 2: Dispatch State Persistence

_User Story_: Como sistema da Renovi, eu quero persistir o estado do dispatch entre batches para garantir consistência operacional durante dispatches de longa duração.

### Acceptance Criteria

1.  GIVEN a Service Request enters dispatch mode WHEN the dispatch process starts THEN the system SHALL persist dispatch state information.
2.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track previously notified Providers.
3.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track previously rejected Providers.
4.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track opened batches.
5.  GIVEN dispatch state is persisted WHEN future batches are processed THEN the system SHALL track explored geospatial search regions.
6.  GIVEN a dispatch resumes after delays or retries WHEN a new batch opens THEN the system SHALL continue from the latest persisted dispatch state.
7.  GIVEN dispatch execution is interrupted due to retries, failures, restarts, or asynchronous resumptions WHEN dispatch processing resumes THEN the system SHALL continue execution using the latest persisted dispatch state without requiring in-memory execution continuity.

## Requirement 3: Provider Eligibility Resolution

_User Story_: Como sistema da Renovi, eu quero resolver a elegibilidade de prestadores utilizando filtros progressivos e geoespaciais otimizados para minimizar processamento desnecessário e reduzir queries de alto custo.

### Acceptance Criteria

1.  GIVEN a new batch is about to be generated WHEN candidate eligibility resolution starts THEN the system SHALL exclude Providers that have already been notified in previous batches for the same Service Request.
2.  GIVEN candidate eligibility resolution starts WHEN Provider availability is evaluated THEN the system SHALL only consider Providers whose accounts are currently active and not banned or operationally disabled.
3.  GIVEN candidate eligibility resolution starts WHEN Provider operational status is evaluated THEN the system SHALL only consider Providers currently accepting new Service Requests.
4.  GIVEN active Providers are filtered WHEN geospatial filtering begins THEN the system SHALL use H3 indexing exclusively as a coarse candidate space reduction mechanism prior to precise geospatial filtering execution.
5.  GIVEN geospatial filtering occurs WHEN nearby Providers are searched THEN the system SHALL filter Providers whose latest known geolocation is strictly fixed within a 20 kilometers radius from the Service Request location.
6.  GIVEN Provider geolocation data is evaluated WHEN geographic eligibility is calculated THEN the system SHALL support configurable freshness validation rules for latest known Provider geolocation data.
7.  GIVEN Provider geolocation freshness evaluation occurs WHEN latest known locations are validated THEN the system SHALL tolerate operationally acceptable geolocation staleness windows compatible with mobile location update frequency constraints.
8.  GIVEN geospatial filtering occurs WHEN nearby Providers are searched THEN the system SHALL use H3 only as a coarse filtering mechanism.
9.  GIVEN geographic eligibility is evaluated WHEN Providers are filtered THEN the system SHALL exclude Providers whose latest known location is outside the configured search radius.
10. GIVEN Providers are located near geospatial partition boundaries WHEN geographic filtering occurs THEN the system SHALL avoid relying exclusively on H3 cell membership.
11. GIVEN geographic filtering completes WHEN service eligibility validation begins THEN the system SHALL validate whether the Provider explicitly offers and operates within the specific service type, specialty, or subcategory required by the Service Request.
12. GIVEN service eligibility validation occurs WHEN Provider capabilities are evaluated THEN the system SHALL support querying auxiliary service capability tables and Provider specialization relationships.
13. GIVEN all eligibility filters complete WHEN candidate ordering begins THEN the system SHALL calculate the real-world geospatial distance between the latest known Provider location and the Service Request location.
14. GIVEN candidate ordering occurs WHEN Providers are sorted THEN the system SHALL order eligible Providers from nearest to farthest relative to the Service Request.
15. GIVEN geographic and eligibility filtering completes WHEN candidate discovery finalizes THEN the system SHALL limit the eligible Provider candidate pool to a maximum of 200 Providers before operational ranking and batch generation.
16. GIVEN more than 200 eligible Providers are available WHEN the candidate pool is generated THEN the system SHALL prioritize the closest eligible Providers based on real-world proximity before applying operational ranking.
17. GIVEN candidate pool limiting occurs WHEN Providers are selected for ranking THEN the system SHALL preserve only the highest proximity eligible Providers relative to the Service Request location.
18. GIVEN candidate discovery completes WHEN operational ranking begins THEN the system SHALL deliver the filtered eligible Provider pool to the ranking and batch generation phase.

## Requirement 4: Provider Ranking Calculation

_User Story_: Como sistema da Renovi, eu quero ranquear os prestadores elegíveis para priorizar aqueles com maior probabilidade de aceitar e concluir o serviço.

### Acceptance Criteria

1.  GIVEN eligible Providers WHEN ranking is calculated THEN the system SHALL generate a score for each Provider.
2.  GIVEN score calculation WHEN distance is evaluated THEN closer Providers SHALL receive a higher proximity score, which MUST have one of the highest weights.
3.  GIVEN score calculation WHEN Provider ratings are evaluated THEN Providers with higher ratings SHALL receive a higher quality score, which MUST have one of the highest weights.
4.  GIVEN score calculation WHEN Provider inactivity duration is evaluated THEN Providers with more time since the last completed Service Request SHALL receive a positive balancing score that acts strictly as a secondary modifier or tie-breaker, never overriding the quality score.
5.  GIVEN score calculation WHEN Provider proposal acceptance history is evaluated THEN Providers with higher proposal acceptance rates, based on the ratio of submitted proposals that were accepted by Clients, SHALL receive a higher dispatch score.
6.  GIVEN ranking fairness and marketplace liquidity are evaluated WHEN operational ranking is calculated THEN the system SHALL include controlled exploration factors to allow operationally eligible Providers with lower recent exposure or lower historical participation to periodically participate in dispatch opportunities, provided they still maintain reasonable conversion potential.
7.  GIVEN exploration factors are applied WHEN ranking scores are adjusted THEN exploration modifiers SHALL act strictly as secondary balancing modifiers and SHALL never override primary quality, proximity, or conversion-related operational scores.
8.  GIVEN newly onboarded Providers without sufficient historical operational metrics WHEN operational ranking is calculated THEN the system SHALL allow controlled participation of such Providers through exploration balancing mechanisms, provided the Providers satisfy minimum operational eligibility requirements.
9.  GIVEN score calculation completes WHEN Providers are sorted THEN the system SHALL order candidates by descending score.

## Requirement 4A: Ranking Score Formalization

_User Story_: Como sistema da Renovi, eu quero formalizar a composição dos scores operacionais de ranking para garantir consistência, auditabilidade e previsibilidade do dispatch.

### Acceptance Criteria

1. GIVEN operational ranking is calculated WHEN Provider scores are generated THEN the system SHALL normalize operational scoring inputs before final score composition.

2. GIVEN operational ranking is calculated WHEN score weights are applied THEN the system SHALL support configurable weight definitions for proximity, quality, conversion, balancing, and exploration factors.

3. GIVEN operational ranking is calculated WHEN balancing or exploration modifiers are applied THEN the system SHALL treat proximity, Provider quality, and conversion-related metrics as primary ranking factors.

4. GIVEN operational ranking is calculated WHEN balancing or exploration modifiers are evaluated THEN the system SHALL prevent secondary modifiers from fully overriding primary operational ranking factors.

5. GIVEN operational ranking occurs WHEN exploration balancing or secondary modifiers are evaluated THEN the system SHALL define reasonable conversion potential using minimum operational quality thresholds derived from Provider proximity, Provider quality signals, Provider activity status, and historical proposal acceptance performance.

6. GIVEN operational ranking occurs WHEN score composition is finalized THEN the system SHALL support deterministic tie-breaking rules for Providers with similar operational scores.

7. GIVEN operational ranking calculations are audited WHEN operational scores are inspected THEN the system SHALL support decomposing Provider scores into their individual operational scoring components.

## Requirement 5: Progressive Batch Visibility and Dispatch

_User Story_: Como sistema da Renovi, eu quero liberar Service Requests em batches progressivos mantendo visibilidade incremental permanente para prestadores já expostos ao Service Request.

### Acceptance Criteria

1.  GIVEN a ranked candidate list WHEN dispatch starts THEN the system SHALL create progressive batches of Providers.
2.  GIVEN batch generation occurs WHEN Providers are grouped for dispatch THEN each batch SHALL contain a maximum of 10 Providers.
3.  GIVEN the first batch WHEN dispatch begins THEN the system SHALL notify only Providers belonging to the first batch.
4.  GIVEN a Provider is included in an active batch WHEN the Provider becomes eligible to view the Service Request THEN the system SHALL persist Service Request visibility for the Provider.
5.  GIVEN future batches are opened WHEN previous batch Providers already have visibility of the Service Request THEN the system SHALL maintain visibility for previously exposed Providers.
6.  GIVEN progressive batches are opened WHEN additional Providers become eligible THEN the system SHALL incrementally expand Service Request visibility without removing visibility from previously eligible Providers.
7.  GIVEN a Provider previously received visibility of a Service Request WHEN the Provider accesses the marketplace feed THEN the system SHALL continue displaying the Service Request unless the Service Request already has an accepted proposal.
8.  GIVEN a Provider previously received visibility of a Service Request WHEN the Provider already submitted a proposal or initiated a chat for the Service Request THEN the system MAY hide or deprioritize the Service Request from the Provider feed.
9.  GIVEN visibility persistence rules are evaluated WHEN batches progress over time THEN the system SHALL treat Service Request visibility as cumulative rather than temporary.
10. GIVEN a batch is active WHEN the fixed timeout of 60 minutes has not expired THEN the system SHALL prevent future batches from opening.
11. GIVEN notification delivery is processed for active batches WHEN notification execution occurs THEN notification delivery SHOULD be processed asynchronously and independently from batch persistence transactions.
12. GIVEN notification delivery failures occur WHEN notification attempts partially fail THEN notification failures SHALL not invalidate previously persisted batch state transitions.
13. GIVEN batch creation, dispatch state transitions, and notification scheduling metadata are persisted WHEN coordinated dispatch state changes occur THEN the system SHALL support atomic persistence semantics for operationally coupled dispatch transitions.
14. GIVEN the number of active chats related to the Service Request with at least one exchanged message within the last 24 hours is greater than or equal to 10 WHEN a new batch is about to open THEN the system SHALL transition the dispatch state to DISPATCH_PAUSED and prevent new batches from being generated.

15. GIVEN the number of submitted Provider proposals pending evaluation (not yet rejected) related to the Service Request is greater than or equal to 4, OR a Client accepts a proposal WHEN evaluated THEN the system SHALL transition the dispatch state to DISPATCH_STOPPED and cancel any remaining batches.

16. GIVEN all batches are exhausted WHEN the Client has not accepted any submitted Provider proposal THEN the system SHALL transition the dispatch state to DISPATCH_FALLBACK_OPEN_MARKET, mark the Service Request as unmatched, and make the Service Request publicly visible ONLY to eligible Providers in the marketplace that match the same category/specialty and operate within the same neighborhood/city of the Service Request.

17. GIVEN a Service Request exceeds the maximum configured dispatch lifecycle duration WHEN dispatch lifecycle expiration is evaluated THEN the system SHALL transition the dispatch state to DISPATCH_EXPIRED and stop generating new batches or marketplace exposure.

18. GIVEN a Service Request enters the DISPATCH_EXPIRED state WHEN Provider visibility is evaluated THEN the system MAY progressively remove or deprioritize the Service Request from Provider marketplace feeds.

19. GIVEN a Provider has never been included in any batch related to the Service Request WHEN the Provider accesses the marketplace feed THEN the system SHALL hide the Service Request.

## Requirement 6: Provider Notification Dispatch

_User Story_: Como sistema da Renovi, eu quero notificar prestadores apenas quando seus respectivos batches forem liberados.

### Acceptance Criteria

1.  GIVEN a batch is opened WHEN eligible Providers are identified THEN the system SHALL send push notifications to batch Providers.
2.  GIVEN a Provider has already been notified WHEN duplicate notifications are evaluated THEN the system SHALL prevent duplicate dispatch notifications for the same Service Request.
3.  GIVEN a Provider is offline WHEN the batch opens THEN the system SHALL still register the notification attempt.

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
8. GIVEN multiple eligible Providers have similar operational scores WHEN ranking tie-breaking occurs THEN the system SHALL prioritize Providers with lower recent batch exposure.

## Requirement 8: Dispatch Auditability

_User Story_: Como sistema da Renovi, eu quero registrar eventos de dispatch para permitir auditoria e análise operacional.

### Acceptance Criteria

1.  GIVEN a dispatch event occurs WHEN the system processes a Service Request THEN the system SHALL persist dispatch logs.
2.  GIVEN a batch opens WHEN Providers are notified THEN the system SHALL register notification timestamps.
3.  GIVEN a Provider interacts with a Service Request WHEN the interaction occurs THEN the system SHALL persist interaction events.
4.  GIVEN a Provider accepts or rejects a Service Request WHEN the action occurs THEN the system SHALL persist the action history.
5.  GIVEN operational ranking calculations occur WHEN Provider ranking decisions are evaluated THEN the system SHALL support auditing operational score composition and ranking factors.
6.  GIVEN dispatch state transitions occur WHEN operational events are persisted THEN the system SHALL support historical inspection of dispatch lifecycle transitions.
7.  GIVEN asynchronous dispatch execution occurs WHEN retries, resumptions, or scheduling events are processed THEN the system SHALL persist operational execution events for debugging and operational observability purposes.
8.  GIVEN historical dispatch operational data accumulates over time WHEN operational storage growth is evaluated THEN the system SHOULD support archival, retention, or cleanup policies for operational dispatch data.

## Requirement 9: Geospatial Indexing and Spatial Partitioning

_User Story_: Como sistema da Renovi, eu quero utilizar indexação geoespacial eficiente para suportar dispatch em larga escala com baixa latência.

### Acceptance Criteria

1.  GIVEN geolocation queries are executed WHEN Provider proximity is calculated THEN the system SHALL use geospatial indexing.
2.  GIVEN dispatch candidate searches are executed WHEN nearby Providers are searched THEN the system SHALL support H3-based spatial indexing.
3.  GIVEN large metropolitan regions WHEN dispatch queries are executed THEN the system SHALL avoid full-table geospatial scans whenever possible.
4.  GIVEN high dispatch concurrency WHEN multiple Service Requests are processed simultaneously THEN the system SHALL support scalable geospatial lookup strategies.

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

8. GIVEN dispatch execution ownership is acquired WHEN execution coordination occurs THEN the system SHALL support lease-based execution ownership semantics with expiration behavior to avoid stale execution ownership retention.

9. GIVEN dispatch execution ownership leases are evaluated WHEN execution workers fail or become unavailable THEN expired execution ownership leases SHALL allow future dispatch execution recovery.

10. GIVEN dispatch execution retries occur WHEN partially completed operations are reprocessed THEN the system SHALL support safe retry semantics for dispatch continuation.

## Requirement 10B: Dispatch Operational Scheduling

_User Story_: Como sistema da Renovi, eu quero suportar scheduling operacional persistido para permitir progressão temporal de dispatches sem depender de processos continuamente ativos.

### Acceptance Criteria

1. GIVEN dispatch batches require delayed progression WHEN future dispatch execution is scheduled THEN the system SHALL persist future execution scheduling state.

2. GIVEN dispatch scheduling occurs WHEN delayed execution timestamps are evaluated THEN the system SHALL support database-backed scheduling semantics.

3. GIVEN asynchronous dispatch scheduling occurs WHEN pending executions become eligible for processing THEN the system SHALL support resumable execution through persisted scheduling state.

4. GIVEN dispatch execution resumes after scheduling delays WHEN dispatch orchestration continues THEN the system SHALL continue from the latest persisted dispatch state.

5. GIVEN scheduling retries or transient failures occur WHEN dispatch scheduling is reprocessed THEN the system SHALL guarantee idempotent scheduling execution behavior.

6. GIVEN dispatch scheduling mechanisms are evaluated WHEN pending dispatch executions are processed THEN the system SHOULD avoid high-frequency global polling strategies incompatible with scalable database-backed scheduling architectures.

## Requirement 11: Provider Response Tracking

_User Story_: Como sistema da Renovi, eu quero rastrear respostas dos prestadores para melhorar futuros rankings.

### Acceptance Criteria

1.  GIVEN a Provider receives a Service Request notification WHEN the Provider views the Service Request THEN the system SHALL record the view event.
2.  GIVEN a Provider accepts a Service Request WHEN ranking metrics are updated THEN the system SHALL update acceptance statistics.

# Implementation Guidance

As implementações do dispatch progressivo SHALL priorizar:

- coordenação transacional baseada em PostgreSQL;
- execução resumível baseada em estado persistido;
- processamento assíncrono orientado a scheduling;
- isolamento concorrente entre Service Requests;
- minimização de scans geoespaciais amplos;
- redução de processamento redundante;
- idempotência operacional;
- observabilidade operacional;
- execução restart-safe;
- mecanismos de locking transacional;
- filas persistidas em banco de dados.

O sistema SHOULD evitar:

- dependência de processos continuamente ativos;
- dependência de estado mantido exclusivamente em memória;
- geração de snapshots globais persistentes de candidatos;
- polling agressivo de alta frequência;
- scans geoespaciais completos sem pré-filtragem.

Dispatch executions SHOULD remain short-lived, resumable, and independently restartable

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

## O que deve ficar nas Edge Functions

| Responsabilidade          | Local |
| ------------------------- | ----- |
| disparar scheduler        | Edge  |
| enviar push               | Edge  |
| chamar providers externos | Edge  |
| observabilidade           | Edge  |
| cron entrypoint           | Edge  |
| retries externos          | Edge  |
