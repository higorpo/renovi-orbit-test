# Scalability Requirements — Orbit (Renovi)

## Context

O **Orbit** é a plataforma mobile-first da Renovi que conecta clientes e prestadores de serviços de manutenção e reforma. A mesma codebase entrega **web/PWA**, **Android** (Capacitor) e, em breve, **iOS**. O backend transacional é **Supabase** (PostgreSQL, Auth, Storage, RLS, Edge Functions).

Este documento define **requisitos de escalabilidade** — capacidade de crescer em usuários, pedidos, notificações e volume de dados sem degradação inaceitável de latência, custo ou confiabilidade. Ele complementa:

- [`technical-stack.md`](./technical-stack.md) — stack e padrões de código;
- [`matching-algorithm.md`](./matching-algorithm.md) — dispatch progressivo de pedidos;
- [`.cursor/rules/server-side-pagination-and-filtering.mdc`](../.cursor/rules/server-side-pagination-and-filtering.mdc) — paginação obrigatória em listagens.

Os requisitos aqui são **normativos para novas features** e **referência para revisão de gargalos** em código existente. Não substituem capacity planning de infraestrutura Supabase/Vercel/FCM/Resend — mas orientam o que o produto deve suportar e como.

---

## Horizontes de escala

| Fase | Ordem de grandeza (indicativa) | Foco |
|------|--------------------------------|------|
| **MVP / lançamento regional** | 10³ usuários ativos, 10² pedidos/dia, dezenas de notificações/minuto em pico | Paginação server-side, rate limits, índices em RPCs críticas |
| **Crescimento** | 10⁴–10⁵ usuários, 10³ pedidos/dia, matching + dispatcher em produção | Filas no Postgres, particionamento de auditoria, workers horizontais |
| **Escala nacional** | 10⁵+ usuários, picos sazonais (campanhas, feriados) | Retenção/arquivamento, leitura réplica onde couber, CDN para assets estáticos |

Metas numéricas exatas de **DAU/MAU** e orçamento de infra devem ser definidas pelo produto/ops; até lá, os critérios de aceite usam comportamentos verificáveis (paginação, limites, latência alvo) independentes do tamanho absoluto da base.

---

## Assumptions

- A infraestrutura principal permanece **Supabase-managed** (Postgres 15+, Auth, Storage, Edge Functions Deno, `pg_cron` quando habilitado).
- **RLS** continua sendo o mecanismo primário de isolamento multi-tenant; escala não pode depender de desabilitar RLS em produção.
- Listagens de domínio (pedidos, propostas, perguntas, orçamentos, notificações futuras) **crescem sem limite superior conhecido** por usuário.
- Picos de tráfego são **assíncronos e amortizáveis** (notificações, matching em batches, webhooks de pagamento) sempre que possível; caminhos síncronos críticos (login, criar pedido, checkout) devem permanecer previsíveis.
- O cliente é **offline-first** (React Query persistido, SW/PWA, Capacitor Preferences); escalabilidade inclui **volume de cache** e **replays de mutação** ao reconectar.
- Sistemas planejados (**message dispatcher**, **pagamentos Asaas**, **chat realtime**, **painel admin**) herdam as mesmas restrições de stack, salvo decisão explícita de serviço externo stateful.

---

## Objetivos não funcionais (SLOs)

| Dimensão | Alvo (produção) | Notas |
|----------|-----------------|-------|
| **Latência — leitura paginada** | p95 &lt; 500 ms para RPC/listagem com `page_size ≤ 20` e filtros indexados | Medido do cliente à resposta Supabase; exclui cold start de Edge |
| **Latência — escrita crítica** | p95 &lt; 3 s para `create-request-quote-order` (incl. upload de fotos dentro dos limites) | Depende de Storage e rede do usuário |
| **Disponibilidade — app** | Degradação graciosa offline; sem bloqueio total da UI por falha de listagem secundária | Cache TanStack Query + mensagens de erro acionáveis |
| **Consistência — filas e pagamentos** | **At-least-once** com idempotência; estados terminais sem duplicidade de efeito colateral | Ver dispatcher e webhooks |
| **Custo** | Evitar full table scan, N+1 em Edge Functions e payloads &gt; 1 MB em respostas JSON de listagem | Preferir RPC agregada a múltiplas round-trips |

---

## Requirement 1: Aplicação cliente (Web, PWA, nativo)

*User Story*: Como usuário em dispositivo móvel ou conexão instável, quero que o app continue utilizável e não baixe dados desnecessários, para que o crescimento da plataforma não torne a experiência lenta ou instável.

### Acceptance Criteria

- **GIVEN** uma listagem que pode crescer indefinidamente (ex.: orçamentos, trabalhos, pedidos)
- **WHEN** o usuário navega ou busca itens
- **THEN** o frontend MUST usar **paginação server-side** (`useInfiniteQuery` ou equivalente) com **page size padrão 20** (máximo documentado por API, ex.: clamp em 100 onde já existir) e MUST NOT carregar a coleção inteira para filtrar em memória.

- **GIVEN** dados já exibidos em cache (React Query `staleTime`, persistência IDB)
- **WHEN** o usuário reabre a tela dentro do período de stale
- **THEN** a UI SHOULD renderizar cache imediatamente e refetch em background, limitando round-trips repetidos ao mesmo endpoint na mesma sessão.

- **GIVEN** o bundle principal da SPA
- **WHEN** novas dependências pesadas forem adicionadas (ex.: ML, mapas)
- **THEN** MUST permanecer **code-splitting / import dinâmico** (padrão atual: TensorFlow/nsfwjs, Leaflet) para não inflar o first load além do orçamento de performance mobile.

- **GIVEN** mutações enfileiradas offline (quando implementadas)
- **WHEN** o dispositivo reconectar
- **THEN** o replay MUST ser **idempotente** no servidor (chaves de idempotência ou deduplicação por estado) para evitar pedidos ou propostas duplicados sob retentativas.

---

## Requirement 2: Acesso a dados, RLS e paginação

*User Story*: Como engenheiro, quero que consultas ao Postgres escalem com volume de linhas por usuário e por tabela global, sem violar isolamento entre tenants.

### Acceptance Criteria

- **GIVEN** nova listagem exposta via PostgREST ou RPC
- **WHEN** a entidade puder ter mais de ~50 linhas por usuário ao longo do tempo
- **THEN** MUST existir função `list_<entidade>(p_page, p_page_size, filtros…)` retornando `{ items, total_count, page, page_size }` com `LIMIT`/`OFFSET` (ou keyset pagination documentada) e `COUNT` com os **mesmos filtros**.

- **GIVEN** políticas RLS em tabelas sensíveis
- **WHEN** queries forem planejadas para alto volume
- **THEN** predicates de RLS MUST ser **sargáveis** (`auth.uid() = user_id` / `client_id` / `provider_id`) e MUST existir **índices** alinhados às colunas usadas nas políticas e nos `WHERE` das RPCs.

- **GIVEN** agregações em listagens (ex.: subselects de perguntas, limite de propostas por pedido)
- **WHEN** o número de joins ou subqueries por linha crescer
- **THEN** MUST avaliar **denormalização controlada**, views materializadas ou campos contadores atualizados por trigger, em vez de correlacionar N registros filhos por item da página.

- **GIVEN** busca textual em listagens
- **WHEN** `p_search` for suportado
- **THEN** MUST documentar se usa `ILIKE` (aceitável em volume moderado) ou índice full-text; para tabelas &gt; 10⁶ linhas, MUST migrar para **FTS ou serviço de busca** antes de degradar p95.

---

## Requirement 3: Edge Functions e camada serverless

*User Story*: Como operador, quero que funções stateless escalem horizontalmente em picos sem estado compartilhado em memória e com proteção contra abuso.

### Acceptance Criteria

- **GIVEN** qualquer Edge Function exposta publicamente ou com `verify_jwt` desabilitado por decisão de produto
- **WHEN** receber tráfego
- **THEN** MUST aplicar **rate limiting** via `platform_rate_limits` (padrão `_shared/rateLimiter.ts`) ou mecanismo equivalente documentado por função.

- **GIVEN** `create-request-quote-order`, `generate-smart-description`, `match-provider-jobs`
- **WHEN** forem estendidas com mais I/O
- **THEN** MUST minimizar **round-trips sequenciais** ao banco; paralelizar leituras independentes (como em `match-provider-jobs`) e consolidar escritas em transações/RPC únicas quando possível.

- **GIVEN** timeout de Edge Function (limite da plataforma)
- **WHEN** o trabalho exceder o orçamento (upload massivo, IA longa, matching pesado)
- **THEN** MUST **deslocar orquestração** para Postgres (estado + `pg_cron`) ou fila table-based, deixando a Edge apenas como conector I/O — alinhado ao message dispatcher e matching progressivo.

- **GIVEN** integrações externas (OpenAI, reCAPTCHA, FCM, Resend, Asaas)
- **WHEN** retornarem 429/503
- **THEN** MUST classificar erro como **retryable** ou **terminal**, persistir decisão no banco e MUST NOT bloquear indefinidamente o worker sem backoff documentado.

---

## Requirement 4: PostgreSQL — transações, filas e concorrência

*User Story*: Como Principal Engineer, quero processar trabalho concorrente no próprio Postgres sem race conditions, para escalar workers sem orquestrador externo stateful.

### Acceptance Criteria

- **GIVEN** consumo de fila por múltiplos workers (message dispatcher, jobs de matching, webhooks reconciliadores)
- **WHEN** mais de uma instância fizer checkout de itens
- **THEN** MUST usar `SELECT … FOR UPDATE SKIP LOCKED` (ou equivalente documentado) para garantir **exclusividade por mensagem/job** sem lock global na tabela.

- **GIVEN** processamento com lease (`locked_until`)
- **WHEN** um worker morrer sem commit final
- **THEN** MUST existir **janitor** (cron/RPC) que devolve itens órfãos a estado reprocessável após expiração do lease.

- **GIVEN** transições de máquina de estados (dispatch, notificação, pagamento)
- **WHEN** atualizar status e auditoria
- **THEN** MUST ocorrer em **uma transação** (RPC PL/pgSQL) para evitar estados inconsistentes visíveis a outros workers.

- **GIVEN** tabelas de auditoria de alto volume (`message_dispatcher_audit`, logs de webhook futuros)
- **WHEN** ultrapassarem milhões de linhas
- **THEN** MUST definir política de **retenção, particionamento por tempo** ou arquivamento, e índices que suportem consultas de suporte em **&lt; 1 s** nos filtros documentados (usuário, `dispatch_id`, intervalo de datas).

- **GIVEN** `platform_rate_limits` e contadores por usuário (cotas de notificação)
- **WHEN** requisições concorrentes competirem pela última unidade de cota
- **THEN** MUST serializar via lock pessimista ou constraint + retry na camada de avaliação transacional.

---

## Requirement 5: Storage e mídia

*User Story*: Como plataforma, quero armazenar fotos de pedidos e portfólio sem explodir custo de egress nem tempo de upload das Edge Functions.

### Acceptance Criteria

- **GIVEN** upload de fotos em pedido de orçamento
- **WHEN** o cliente enviar arquivos
- **THEN** MUST respeitar limites server-side documentados (`MAX_PHOTOS`, `MAX_PHOTO_BYTES` em `uploadPhotos.ts`) e MUST alinhar limites exibidos no cliente para evitar rejeição tardia.

- **GIVEN** bucket Supabase Storage
- **WHEN** servir imagens em listagens e detalhes
- **THEN** SHOULD usar URLs com **transformação/tamanho adequado** (thumbnails) onde o produto exibir grids, reduzindo payload em mobile.

- **GIVEN** crescimento de objetos por `service_request` e portfólio
- **WHEN** definir lifecycle
- **THEN** MUST documentar política de **retenção** (pedidos cancelados, contas inativas) compatível com LGPD e custo de storage.

---

## Requirement 6: Geolocalização, matching e marketplace

*User Story*: Como marketplace local, quero encontrar prestadores relevantes em raio fixo sem varrer toda a base a cada pedido.

### Acceptance Criteria

- **GIVEN** busca de prestadores/trabalhos por proximidade
- **WHEN** escalar número de prestadores ativos
- **THEN** MUST usar **indexação geoespacial** (H3 em `client_addresses` / pedidos; evolução para PostGIS conforme [`matching-algorithm.md`](./matching-algorithm.md)) e MUST NOT depender de cálculo de distância em memória sobre conjunto completo.

- **GIVEN** dispatch progressivo (batches, raio 20 km, fallback marketplace)
- **WHEN** um pedido entrar em `DISPATCH_ACTIVE`
- **THEN** estado do dispatch MUST persistir no banco; expansão de batches MUST ser **retomável** após falha; notificações aos prestadores MUST respeitar **rate limits de engajamento** (dispatcher + regras de negócio).

- **GIVEN** listagem de trabalhos para prestador (`match_provider_jobs`, página 20)
- **WHEN** filtros geo + elegibilidade forem aplicados
- **THEN** RPC MUST permanecer index-friendly; aumentos de `p_page_size` acima de 20 MUST ser exceção justificada e testada sob carga.

---

## Requirement 7: Mensagens, push e e-mail

*User Story*: Como produto, quero comunicar em escala sem spam, sem duplicatas e sem saturar APIs de terceiros.

### Acceptance Criteria

- **GIVEN** o Multichannel Message Dispatcher (quando implementado)
- **WHEN** picos de ingestão ocorrerem
- **THEN** o sistema MUST cumprir integralmente [`message-dispatcher/requirements.md`](./message-dispatcher/requirements.md), em especial: fila no Postgres, `SKIP LOCKED`, idempotency key obrigatória, backoff exponencial, limites 5 e-mail/dia e 20 push/dia com cooldown 20 min.

- **GIVEN** FCM na web (Service Worker) e push nativo (Capacitor)
- **WHEN** tokens forem inválidos
- **THEN** MUST marcar falha **terminal** no dispatcher e MUST limpar/desativar token no perfil do dispositivo para não retentar indefinidamente.

- **GIVEN** templates renderizados na Edge
- **WHEN** volume de compilação crescer
- **THEN** compilação MUST permanecer **stateless**; variáveis vêm do payload persistido, sem cache RAM entre invocações.

---

## Requirement 8: Pagamentos (planejado)

*User Story*: Como plataforma com escrow, quero processar webhooks e checkouts em volume sem aceitar proposta duas vezes ou liberar fundos inconsistentemente.

### Acceptance Criteria

- **GIVEN** webhooks Asaas como fonte autoritativa ([`payment-system-plan.md`](./payment-system-plan.md))
- **WHEN** o mesmo evento for entregue mais de uma vez
- **THEN** handlers MUST ser **idempotentes** (chave única por `event_id` ou equivalente) e MUST transicionar `service_payments` / proposta apenas se a transição for válida.

- **GIVEN** checkout com lock de proposta (~30 min)
- **WHEN** múltiplas abas ou retentativas ocorrerem
- **THEN** MUST retornar conflito previsível (`409`) ou estado atual sem criar segunda cobrança ativa.

- **GIVEN** cálculo dinâmico de taxas do cliente
- **WHEN** exibir checkout
- **THEN** valores MUST ser obtidos via **RPC sob demanda** e congelados no registro de pagamento no momento da criação da cobrança, não recalculados ad hoc em listagens históricas.

---

## Requirement 9: Realtime e chat (planejado)

*User Story*: Como cliente e prestador em serviço ativo, quero mensagens em tempo real sem sobrecarregar o cliente com subscriptions amplas.

### Acceptance Criteria

- **GIVEN** chat por `service_id` ou thread equivalente
- **WHEN** implementar Supabase Realtime
- **THEN** channels MUST ser **escopados por conversa** (não por tabela inteira); histórico MUST ser paginado server-side; presença opcional MUST ter TTL.

- **GIVEN** reconexão mobile
- **WHEN** o socket cair
- **THEN** MUST reconciliar gap via **cursor de mensagem** (`created_at` / `id`) e merge idempotente, não replay completo do canal.

---

## Requirement 10: Observabilidade, testes de carga e operações

*User Story*: Como time de engenharia, quero detectar regressões de escala antes de produção e agir em incidentes com dados objetivos.

### Acceptance Criteria

- **GIVEN** erros e transações lentas no frontend
- **WHEN** ocorrerem em produção
- **THEN** MUST ser reportados ao **Sentry** com contexto de rota/feature; novas RPCs críticas SHOULD ter spans ou tags de negócio quando instrumentadas.

- **GIVEN** preparação de release ou mudança em RPC/Edge crítica
- **WHEN** possível
- **THEN** SHOULD executar seed/cenários de carga documentados (`supabase/snippets/seed-load-test.sql`, `yarn` scripts de imagens de load test) e medir p95 de endpoints alterados.

- **GIVEN** limites do plano Supabase (conexões, Edge invocations, Storage)
- **WHEN** métricas de uso se aproximarem de 70% do tier
- **THEN** MUST abrir revisão de arquitetura (connection pooling, batching de cron, upgrade de plano ou decomposição de função).

---

## Restrições e anti-padrões

| Anti-padrão | Motivo | Alternativa |
|-------------|--------|-------------|
| Listar todas as linhas no cliente e filtrar/paginar em JS | Memória e tempo linear no dispositivo | RPC paginada + `useInfiniteQuery` |
| Estado de fila ou matching só em memória da Edge | Perda em crash/scale-to-zero | Postgres + lease + cron |
| Desabilitar RLS “temporariamente” para performance | Risco de vazamento multi-tenant | Índices + RPC `SECURITY DEFINER` auditada |
| Polling agressivo (&lt; 5 s) em listagens estáveis | Custo e bateria mobile | `staleTime` 60s+, refetch on focus seletivo |
| N+1 queries na Edge por item da página | Latência multiplica com page size | Join/RPC agregada |
| Payload JSON &gt; 1 MB em listagem | Timeout mobile e custo | Projeção mínima de colunas; lazy load de detalhe |
| Full table scan em auditoria | Suporte lento em escala | Índices compostos + particionamento |

---

## Matriz de responsabilidade (resumo)

| Camada | Escala como | Referência |
|--------|-------------|------------|
| **React / Capacitor** | Paginação, cache, code-split, offline replay idempotente | Req. 1 |
| **API feature (`src/features/*/api`)** | Contratos paginados; sem Supabase direto em UI | `api-layer`, Req. 2 |
| **Postgres / RPC / RLS** | Índices, transações, filas, contadores | Req. 2, 4 |
| **Edge Functions** | I/O stateless, rate limit, classificação de erro | Req. 3, 7 |
| **Storage** | Limites de upload, thumbnails, retenção | Req. 5 |
| **Dispatcher / Matching** | Filas, batches, geo index | Req. 6, 7 + docs dedicados |
| **Pagamentos / Realtime** | Idempotência, escopo de canal | Req. 8, 9 |

---

## Documentos relacionados

| Documento | Relação |
|-----------|---------|
| [`technical-stack.md`](./technical-stack.md) | Stack e padrões offline-first |
| [`message-dispatcher/requirements.md`](./message-dispatcher/requirements.md) | Escalabilidade de notificações |
| [`matching-algorithm.md`](./matching-algorithm.md) | Escalabilidade de dispatch e geo |
| [`payment-system-plan.md`](./payment-system-plan.md) | Escalabilidade de pagamentos e webhooks |
| [`docs/business/`](./business/) | Comportamento de produto (não-NFR) |
| [`.cursor/rules/server-side-pagination-and-filtering.mdc`](../.cursor/rules/server-side-pagination-and-filtering.mdc) | Regra de implementação para listagens |

---

## Revisão deste documento

Atualizar este arquivo quando:

1. Novos subsistemas de alto volume entrarem em produção (chat, admin, pagamentos).
2. SLOs forem medidos em produção e precisarem de ajuste realista.
3. Limites numéricos (page size, cotas, retenção) forem alterados no código ou nas migrações.

**Última atualização:** 2026-05-21 — alinhado ao estado do repositório (paginação 20, rate limits em Edge, dispatcher e matching especificados, pagamentos planejados).
