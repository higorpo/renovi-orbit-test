# Trabalhos e propostas do prestador

Documentação baseada em `src/features/provider-jobs/`, Edge **`list-provider-opportunities`**, RPC `list_provider_opportunities` / `dismiss_provider_opportunity`, integração de detalhe em `view-services`, propostas via `negotiation-proposals` / chats, e localização de feed via `device-beacon`. Backend de matching: [matching-dispatch](../../matching-dispatch/README.md) (fora do escopo de edição deste documento).

---

## 1. Resumo executivo

- **O que é:** feed de **oportunidades** liberadas pelo matching progressivo (lote ou mercado aberto) para o **prestador**, com ordenação, dismiss e navegação ao detalhe unificado.
- **Problema que resolve:** o prestador só vê pedidos para os quais o dispatch concedeu **visibilidade** — liquidez controlada, sem “mercado aberto ilimitado” na UI.
- **Quem usa:** apenas **prestador** autenticado (`ProtectedRoute allowedRoles={['provider']}`).
- **Resultado de sucesso:** lista paginada por cursor; card abre `/dashboard/services/:id` (sheet ou full-page); no detalhe pode **iniciar/abrir chat** e, via módulos de negociação, **criar/editar orçamento**.
- **Impacto se falhar:** prestador sem demanda na app; dismiss/listagem quebrados; proposta/chat dependem de outros módulos mas o discovery some.

---

## 2. Objetivo de negócio

- Expor o lado *supply* do marketplace: descobrir pedidos compatíveis (serviço + área + grant de visibilidade).
- Separar **dois papéis de localização**: beacon (elegibilidade em lote) vs GPS de feed (só ordenação *Mais próximos* / distância no card).
- Encaminhar o prestador ao detalhe (`view-services`) e à negociação (chat + `create_provider_proposal`), sem reinventar o detalhe dentro de `provider-jobs`.

---

## 3. Localização na plataforma

| Superfície | Path / mecanismo | Evidência |
|------------|------------------|-----------|
| Lista (tab) | **`/dashboard/jobs`** | `router.tsx` → `ProviderJobsRouteSlot` (outlet vazio); conteúdo em `ProviderJobsPersistentSlot` no `DashboardLayout` |
| Menu | Item **Trabalhos** | `dashboardMenu.ts` → `/dashboard/jobs` |
| Detalhe | **`/dashboard/services/:id`** (`view-services`) | `JobCard` → `getServiceDetailPath` + `createProviderJobsServiceDetailState` |
| Sheet | Mesma URL com `serviceDetailPresentation: "sheet"`, `returnTo: "/dashboard/jobs"`, `background` | Lista permanece montada (`ProviderJobsPersistentSlot`) |
| Full-page / deep link | `:id` sem state sheet | Chrome mobile **stack** “Detalhes do serviço” (`mobileNavigation.config.ts`); backFallback default `/dashboard/services` |
| Chat | `/dashboard/chats/:chatId` após FAB no detalhe | `useServiceDetailChatNavigation` → `initiateConversation` ou navigate se já existe |
| Guards | `allowedRoles={['provider']}` só em `jobs` | Detalhe `services/:id` aceita `client` \| `provider` |
| Query params | **Nenhum** na lista de trabalhos | — |

**Não existe** rota `/dashboard/jobs/:jobId` no router atual (doc antiga desatualizada).

---

## 4. Perfis envolvidos

| Papel | Usa? | Detalhe |
|-------|------|---------|
| **Prestador** (`profiles.role = provider`) | Sim | Lista, dismiss, detalhe, chat, proposta |
| Prestador **`operational_status = suspended`** | Feed **vazio** (200) | Edge retorna `EMPTY_FEED_RESPONSE` sem chamar RPC |
| **Cliente** | Não | Sem item de menu Trabalhos; rota `jobs` bloqueada |
| Visitante | Não | Redirect login |
| Admin plataforma | Sem UI dedicada neste módulo | — |

**Quem não usa:** cliente; prestador sem grant de visibilidade (vê empty state, não “todos os pedidos abertos”).

---

## 5. Fluxo funcional principal

```mermaid
flowchart TD
  A[Prestador abre /dashboard/jobs] --> B[useProviderLocation — GPS feed]
  B --> C{hasFeedLocation?}
  C -->|Não| D[Banner + sort efetivo newest; oculta aba nearest]
  C -->|Sim| E[Default sort nearest disponível]
  D --> F[useProviderJobs]
  E --> F
  F --> G{enabled?}
  G -->|nearest sem coords| H[Query desabilitada]
  G -->|Sim| I[Edge list-provider-opportunities]
  I --> J{operational_status?}
  J -->|suspended| K[200 items vazios]
  J -->|provider ativo| L[RPC list_provider_opportunities]
  L --> M[Cards JobCard]
  M --> N{Ação}
  N -->|Ver detalhes| O[/dashboard/services/:id sheet]
  N -->|Não tenho interesse| P[dismiss_provider_opportunity + optimistic remove]
  O --> Q[get_service + record_provider_opportunity_view]
  Q --> R[FAB: Iniciar/Ver negociação]
  R --> S[Chat CNS]
  S --> T[Composer create_provider_proposal]
```

---

## 6. Fluxos alternativos e exceções

| Cenário | Comportamento observado |
|---------|-------------------------|
| **Suspended** | Edge 200 com `{ items: [], next_cursor: null, has_more: false }` — UI = empty state genérico (sem mensagem específica de suspensão) |
| **Empty feed** (sem visibilidade) | `JobsEmptyState` sem filtros: *“Nenhuma oportunidade na sua região”* |
| Empty com sort ≠ default GPS | `hasFilters` true → *“Nenhum trabalho encontrado”* + limpar filtros (copy ainda cita “raio de busca” — legado de UI) |
| Erro de rede / API | `JobsErrorState` + retry `refetch` |
| GPS negado / indisponível / HTTP inseguro | Banner (`LocationPermissionBanner`); sort `nearest` forçado para `newest`; query sem lat/lng |
| Sort `nearest` sem GPS | Query `enabled: false` até haver coords; UI não mostra aba |
| Cursor inválido | API detecta pattern `/invalid feed cursor/i` → throw `INVALID_PROVIDER_JOBS_CURSOR`; página trata como erro genérico |
| Rate limit Edge | HTTP 429 `rate_limited` → front vê erro de invoke |
| Dismiss falha | Rollback do cache TanStack + toast *“Não foi possível ocultar esta oportunidade…”* |
| Dismiss sucesso | GA `provider_opportunity_dismissed`; invalidate lista |
| Abrir detalhe | `record_provider_opportunity_view` (falha só `logger.warn`) |
| Chat offline | Toast *“Você está offline…”* |
| **DISPATCH_STOPPED** | Nova **proposta** bloqueada no SQL; **iniciar chat** permitido se slot CNS (ver matching-dispatch / chats) |
| Pedido já com proposta própria | Some do feed (filtro RPC); detalhe/histórico via Meus Serviços / view-services |
| Perguntas ao cliente | **Removidas** — migration `20260703170000_remove_service_request_questions.sql` |

---

## 7. Regras de negócio

1. Só **prestador** autentica a lista (router + Edge `role !== "provider"` → 403).
2. Prestador **suspended** recebe feed vazio sem erro (Edge), não lista oportunidades.
3. Item do feed exige **visibilidade ativa** (`service_request_provider_visibility`): `source` no JSON = `batch` \| `fallback`.
4. Badge **Mercado aberto** quando `source === "fallback"`.
5. **Sem** filtro de raio nem de tipo de serviço na barra atual (cutover matching progressivo).
6. Paginação **cursor** opaco; página default **20** (`FEED_DEFAULT_LIMIT`); clamp API/Edge **1–50** (`FEED_MAX_LIMIT`).
7. Sort permitido: `newest` \| `nearest` \| `least_competitive`; `nearest` **exige** lat/lng (Edge + front `enabled`).
8. Default sort: **nearest** com GPS feed; **newest** sem GPS (`getDefaultSortMode`).
9. GPS de feed **nunca fabrica** coordenadas para a API (`hasFeedLocation`; sem fallback Florianópolis/Brasil na lista).
10. Beacon/`provider_latest_locations` alimenta **lotes/discovery** (device-beacon), **não** o sort do feed.
11. Dismiss: RPC `dismiss_provider_opportunity` — batch seta `dismissed_at`; fallback insere `source = fallback_dismiss`; **idempotente** (success mesmo se nada a dismissar).
12. Dismiss **não** impede deep link de detalhe se o prestador ainda tiver acesso por outro critério (`get_service`).
13. Detalhe canônico é **`service_request_id`** em `/dashboard/services/:id`, não rota filha de `jobs`.
14. Criar proposta: RPC **`create_provider_proposal`** (feature `negotiation-proposals`); gate **`DISPATCH_STOPPED`** no servidor.
15. Iniciar conversa: **sem** gate STOPPED (só capacidade de slot CNS) — evidência matching M14f / COMMENT SQL.
16. `staleTime` da lista: **60 s**; `refetchOnWindowFocus: false`.
17. Rate limit Edge: **60 req/min** por IP+usuário (`list-provider-opportunities`).
18. Urgência no card: badge só se `urgency` ∈ `{high, medium}` (`getJobCardPresentation`).

---

## 8. Campos e dados (inputs / shape)

### 8.1 Item do feed (`ListProviderOpportunityItem`)

| Campo | Tipo / origem | Uso na UI |
|-------|---------------|-----------|
| `service_request_id` | uuid | Key, dismiss, path detalhe |
| `title` | text | Título do card |
| `description` | string \| null | Linha secundária (trim; omitida se vazia) |
| `service_name` | text | Badge de categoria |
| `service_icon_key` / `service_color_key` | string \| null | Estilo via `getServiceCardStyle` (request-quote) |
| `neighborhood` | text | Linha de local |
| `urgency` | string | Badge Alta/Média se high/medium |
| `granted_at` | ISO | “Publicado …” (`formatRelativeDate`) |
| `distance_km` | number \| null | “· X de você” se presente |
| `active_chat_count_24h` | number | Critério de sort `least_competitive` (não exibido no card) |
| `source` | `batch` \| `fallback` | Badge Mercado aberto |

### 8.2 Body Edge / fetch

| Campo | Default / regra |
|-------|-----------------|
| `sort_mode` | `newest` se inválido |
| `cursor` | null |
| `limit` | 20; clamp 1–50 |
| `lat` / `lng` | opcionais; ambos ou nenhum; ranges −90..90 / −180..180 |

### 8.3 Proposta (contrato em `negotiation-proposals` — entrada a partir do detalhe/chat)

Campos do composer (evidência em hooks/constants da feature de propostas; **não** em `provider-jobs`): valor BRL, descrição máx. **1200**, duração hours/days, **1–3** slots, fotos máx. **5**, pricing assinado. Detalhe completo: [propostas-negociacao.md](../../chats/features/propostas-negociacao.md).

---

## 9. Validações de front-end

| Área | Validação |
|------|-----------|
| Lista | Query só com `nearest` se `latitude` e `longitude` não nulos |
| Sort tabs | `getVisibleSortModes` esconde `nearest` sem GPS |
| Effect | Se sort = nearest e perde GPS → `setSortMode("newest")` |
| Dismiss | ID trim; vazio → erro API *“ID da oportunidade é obrigatório”* |
| Banner | Ramos: insecure HTTPS, permission denied (web vs native), fallback “localização aproximada” |
| Composer proposta | Fora deste pacote — Zod/máscaras em `negotiation-proposals` |
| Chat | Bloqueio offline antes de `initiateConversation` |

---

## 10. Validações de back-end

| Camada | Regras |
|--------|--------|
| **Edge** | Bearer JWT; perfil `provider`; suspended → 200 vazio; 429 rate limit; JSON body; coords pares e ranges; nearest exige coords; RPC validation → 400 |
| **RPC `list_provider_opportunities`** | `auth.uid()` = `p_provider_id` (exceto service_role); cursor inválido → erro 22023 / mensagem; filtros OPEN + visibilidade + exclusões (proposta/chat próprio — ver matching) |
| **RPC `dismiss_provider_opportunity`** | Auth; role provider; batch dismiss ou `fallback_dismiss`; evento `provider_declined` quando dismiss efetivo |
| **RPC `record_provider_opportunity_view`** | Prestador; auditoria `provider_viewed` |
| **`create_provider_proposal`** | Gate `DISPATCH_STOPPED` ao criar proposta in-flight; credentialing / pricing / SR OPEN etc. (SQL CNS + matching) |
| **`cns_initiate_conversation`** | Sem gate STOPPED; limite de slots ativos |

---

## 11. Status, estados e transições

### 11.1 UI da lista

| Estado | UI |
|--------|-----|
| Loading | 4× `JobCardSkeleton` |
| Erro | `JobsErrorState` |
| Vazio | `JobsEmptyState` (com/sem filtros) |
| Dados | Cards + `LoadMoreButton` se `hasNextPage` |

### 11.2 Source / dispatch (impacto no prestador)

| Situação | Feed | Nova proposta | Iniciar chat |
|----------|------|---------------|--------------|
| ACTIVE / FALLBACK / PAUSED | Visibilidade conforme grant | Permitida se elegível | Slot CNS |
| **DISPATCH_STOPPED** | Cards já visíveis podem permanecer | **Bloqueada** (`DISPATCH_STOPPED`) | **Permitido** se slot |
| MATCHED / CANCELLED / EXPIRED | Remoção / exclusão conforme RPC | Conforme status SR | Conforme CNS |
| Prestador suspended | Feed vazio | N/A neste módulo | N/A feed |

FSM completa de dispatch: [dispatch-e-visibilidade.md](../../matching-dispatch/features/dispatch-e-visibilidade.md).

### 11.3 Status de proposta (labels no detalhe)

Reutiliza `negotiation-proposals`: `PENDING`, `ACCEPTED`, `REJECTED`, `REVISION_REQUESTED`, `REVISED`, `EXPIRED`, `REJECTED_AUTOMATICALLY`. Edição UI (`canEditServiceRequestProposal`): só `PENDING` e `REVISION_REQUESTED`.

---

## 12. Persistência

| Onde | O quê |
|------|--------|
| **Servidor** | Visibilidade, dismiss, eventos de dispatch; propostas/chats em tabelas CNS |
| **Cliente — React Query** | Key `["provider-jobs", sortMode, lat, lng]`; infinite pages; optimistic remove no dismiss |
| **Cliente — filtros** | Estado React local (`useProviderJobsFilters`); **não** Preferences |
| **Cliente — GPS feed** | Estado do hook; nativo pode ler sample de `device-beacon` (`getLatestProviderLocationSample` / subscribe) |
| **Beacon** | `user_device_beacons` → `provider_latest_locations` (módulo device-beacon) |
| **Draft de proposta** | Fora de `provider-jobs` (composer negotiation) |

---

## 13. Integrações

| Sistema | Contrato |
|---------|----------|
| **Edge `list-provider-opportunities`** | Proxy JWT + RPC `list_provider_opportunities` |
| **matching-dispatch** | Concede/revoga visibilidade; gates STOPPED/PAUSED; crons de lote |
| **device-beacon** | Tracking + samples para feed nativo; elegibilidade geográfica de lote |
| **view-services** | Detalhe `get_service`, sheet, `record_provider_opportunity_view`, FAB chat |
| **chats** | `initiateConversation` / abrir thread |
| **negotiation-proposals** | Composer / `create_provider_proposal` / resumo no detalhe (`ServiceProviderProposalSection`) |
| **request-quote** | `getServiceCardStyle` no card |
| **message-dispatcher** | Push/e-mail `matching.new_opportunity` após lote (não invocado pelo front jobs) |
| **settings** | Serviços ofertados e bairros (elegibilidade discovery/fallback) |
| **Sentry** | Span `provider_jobs.fetch_list` |
| **GA** | `provider_opportunity_dismissed` |

---

## 14. Listagens, buscas, filtros, paginação, ordenação

| Aspecto | Comportamento |
|---------|---------------|
| Paginação | Cursor (`next_cursor` / `has_more`); `useInfiniteQuery`; botão Carregar mais |
| Busca textual | **Não há** |
| Filtro serviço/raio | **Não há** na UI |
| Ordenação | Tabs: Mais recentes / Mais próximos / Menos concorridos |
| Critério server | `newest` → `granted_at` DESC; `nearest` → `distance_km` ASC; `least_competitive` → `active_chat_count_24h` ASC |
| Distância no card | Só se RPC devolve `distance_km` (tipicamente com lat/lng no request) |

---

## 15. Ações disponíveis

| Ação | Quem | Pré-condição | Resultado | Erro típico |
|------|------|--------------|-----------|-------------|
| Ver lista | Prestador | JWT + não (ou suspended→vazio) | Página de items | 401/403/429/5xx |
| Mudar sort | Prestador | nearest só com GPS | Refetch key | — |
| Carregar mais | Prestador | `has_more` | Append | Cursor inválido |
| Ver detalhes | Prestador | Card / link | Navigate sheet ou stack | Serviço não encontrado (`get_service`) |
| Não tenho interesse | Prestador | Confirma AlertDialog | Some do feed | Toast dismiss |
| Registrar view | Prestador | Abriu detalhe | Evento audit | Log warn |
| Iniciar / ver negociação | Prestador | Detalhe | Chat (cria ou abre) | Offline; `NO_ACTIVE_SLOT`; etc. |
| Enviar / editar orçamento | Prestador | Chat e/ou seção proposta no detalhe se já existe latest | `create_provider_proposal` | `DISPATCH_STOPPED`, `PROVIDER_NOT_CREDENTIALED`, pricing, … |
| Perguntar ao cliente | — | — | **Removido** do produto | — |

**Nota de superfície:** `ServiceProviderProposalSection` **só renderiza** se já existe latest proposal; a **primeira** proposta tipicamente nasce no fluxo de **chat** / composer de `negotiation-proposals`. FAB do detalhe é **só chat** (“Iniciar negociação” / “Ver negociação”).

---

## 16. Dependências

| Upstream | Uso |
|----------|-----|
| `matching-dispatch` | Visibilidade e gates |
| `device-beacon` | Beacon + samples GPS nativo |
| `view-services` | Detalhe, navegação sheet, view audit, FAB |
| `chats` | Iniciar/abrir conversa |
| `negotiation-proposals` | Orçamento (indireto via view-services) |
| `auth` | Sessão / role |
| `request-quote` | Estilo do card de serviço |

| Downstream / consumidores | Uso |
|---------------------------|-----|
| Menu dashboard | Entrada Trabalhos |
| Empty de Meus Serviços (prestador) | CTA “Ver trabalhos” → `/dashboard/jobs` |

---

## 17. Regras implícitas

- `ProviderJobsRouteSlot` retorna **null** — a lista vive no persistent slot para não remountar ao abrir sheet.
- Copy do empty **com filtros** ainda menciona “aumentar o raio de busca”, embora o filtro de raio tenha sido removido.
- Prestador suspended vê o **mesmo** empty de “região”, sem copy de suspensão.
- `isUsingDefault` no location hook = `!hasFeedLocation` (nome legado; não implica centróide inventado na API).
- Código `DISPATCH_STOPPED` **não** está em `PROPOSAL_BUSINESS_ERROR_CODES` — toast pode exibir mensagem crua do Postgres se a proposta falhar por esse gate (evidência parcial de UX).
- JSON feed `source: "fallback"` ≠ coluna DB `fallback_dismiss` (marcador de dismiss).
- Gate NetCred em RPC legado `match_provider_jobs` **não** é evidenciado na Edge viva do feed.
- Histórico: perguntas (`create_provider_service_request_question`) e rota detalhe em `jobs/:id` **não** existem mais no app.

---

## 18. Riscos

| Risco | Detalhe |
|-------|---------|
| Confundir GPS feed × beacon | Prestador acha que sem GPS some do matching; na verdade some sort nearest / distância |
| Suspended silencioso | Empty state genérico mascara bloqueio operacional |
| STOPPED vs chat | Suporte pode achar que chat também está bloqueado |
| Mensagem STOPPED no composer | Sem map amigável em `proposalApiErrors` |
| Copy “raio” no empty filtrado | Confunde QA/usuário pós-cutover |
| Detalhe full-page backFallback | Default `/dashboard/services`, não `/dashboard/jobs`, se abrir sem state sheet |
| Legado SQL `match_provider_jobs` | Ainda no schema; app não chama — risco de docs/ops desatualizados |

---

## 19. Evidências

| Área | Paths |
|------|-------|
| Feature | `src/features/provider-jobs/**` |
| Router / menu / layout | `src/router.tsx`, `dashboardMenu.ts`, `DashboardLayout.tsx`, `mobileNavigation.config.ts` |
| Edge | `supabase/functions/list-provider-opportunities/` |
| Contract | `supabase/functions/_shared/contracts/list-provider-opportunities/types.ts` |
| RPC list/dismiss/view | `supabase/migrations/20260711110000_matching_feed_audit_rpcs.sql` (+ republicações feed) |
| STOPPED / chat | `20260711130000_matching_integrate_cns_dispatch.sql`, `20260711180000_matching_initiate_conversation_no_stopped_gate.sql`, `20260801880000_cns_slot_minimum_start_date_tomorrow.sql` |
| Remoção perguntas | `20260703170000_remove_service_request_questions.sql` |
| Detalhe / nav | `src/features/view-services/` (`JobCard` imports, `ServiceDetailFloatingActions`, `ServiceProviderProposalSection`) |
| Beacon | `src/features/device-beacon/` |
| Matching docs | `docs/business/modulos/matching-dispatch/` |

---

## 20. Pendências

| Item | Observação |
|------|------------|
| UX dedicada para prestador suspended no feed | Hoje indistinguível de empty regional |
| Mapear `DISPATCH_STOPPED` em `proposalApiErrors` | Código SQL existe; UI message amigável não evidenciada |
| Copy empty com filtros (“raio”) | Alinhar produto ou aceitar como dívida |
| Credentialing no feed vivo | Gate NetCred está no legado `match_provider_jobs`; confirmar se deveria valer em `list_provider_opportunities` |
| DROP RPC / pasta Edge `match-provider-jobs` | Planejado; pasta pode existir vazia; RPC ainda no schema |
| backFallback do detalhe aberto sem sheet a partir de jobs | Pode ir para Meus Serviços em vez de Trabalhos |
| Glossário / matriz transversal | Atualização por worker transversal se necessário |

---

## 21. Anexo — legado feed aberto (estado real)

| Camada | Estado (evidência) |
|--------|-------------------|
| Front `provider-jobs` | Só `list-provider-opportunities` |
| Edge `match-provider-jobs` | Código removido; pasta pode estar vazia; sem entry `config.toml` |
| RPC `match_provider_jobs` | Ainda no schema (ex.: `20260801240000_payment_match_provider_jobs_onboarding_gate.sql`) |
| Migration drop M15 citada em docs antigos | **Ausente** no repo |

Detalhe: [dispatch-e-visibilidade — legado](../../matching-dispatch/features/dispatch-e-visibilidade.md#legado-feed-aberto-vs-estado-real).

---

## 22. Anexo — checklist QA (cenários)

- [ ] Prestador ativo com grants: lista + infinite scroll + sorts
- [ ] Sem GPS: banner; sem aba Mais próximos; lista newest/least_competitive
- [ ] HTTP não seguro (web): copy HTTPS no banner
- [ ] Suspended: lista vazia 200, sem 403
- [ ] Empty sem grants; empty com sort ≠ default + limpar filtros
- [ ] Dismiss batch e fallback; card some; retry em falha restaura
- [ ] Sheet: lista permanece; fechar volta ao background jobs
- [ ] Deep link `/dashboard/services/:id` full-page
- [ ] FAB inicia chat sob STOPPED (slot livre); proposta nova falha sob STOPPED
- [ ] Erro Edge 429 / 500 → ErrorState + retry
- [ ] Confirmar ausência de UI de “perguntas ao cliente”
