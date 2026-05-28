# Conversational Negotiation & Chat System Requirements

## Context

O **Sistema de Negociação Conversacional Cliente ↔ Prestador** (doravante *Chat & Negotiation System*, CNS) é o subsistema transacional da plataforma **Orbit** (Renovi) responsável por orquestrar comunicação bilateral, descoberta de escopo, envio estruturado de propostas, revisões limitadas, aceite atômico e encerramento coordenado de negociações concorrentes — tudo ancorado a um **Service Request** (`service_request`) em estado `OPEN`.

O CNS resolve o problema operacional de marketplaces de serviços onde múltiplos prestadores competem simultaneamente pela preferência do cliente, sem degradar a experiência do cliente (sobrecarga cognitiva, spam, perda de contexto) nem a eficiência do marketplace (slots de visibilidade, batches de dispatch, cotas de engajamento). O fluxo canônico de negócio está especificado em [`platform-flow.mmd`](../platform-flow.mmd) e constitui a referência normativa para transições entre **Service Request**, **Chat**, **Proposal** e **Service** pós-aceite.

### Objetivos de negócio

- Permitir **negociação pré-proposta** (perguntas, fotos, alinhamento de disponibilidade) antes do envio formal de orçamento.
- Limitar **pressão operacional** sobre o cliente via slots de chats `ACTIVE` por pedido e pausa de dispatch quando a capacidade de negociação simultânea é atingida.
- Garantir **fechamento determinístico** do pedido quando uma proposta é aceita: encerramento automático de chats concorrentes, rejeição automática de propostas pendentes e criação do registro de **Service** em `PENDING_PAYMENT`.
- Preservar **auditabilidade** e rastreabilidade histórica de mensagens, propostas versionadas e motivos de encerramento.
- Integrar comunicação transacional ao **Multichannel Message Dispatcher (MMD)** para push/e-mail sem fragmentar políticas de rate limit.

### Objetivos técnicos

- Modelo **database-centric**: máquinas de estado, invariantes, slots, reciprocidade, expiração de proposta e aceite concorrente MUST residir em **PostgreSQL (RPC PL/pgSQL)** sob transações ACID.
- Camada **stateless** em Edge Functions apenas para I/O (upload de mídia, compilação de template, invocações externas) conforme [`infrastructure-constraints.md`](../infrastructure-constraints.md).
- Cliente **mobile-first** (React 19, Capacitor 8, TanStack Query) com Realtime escopado por conversa, paginação server-side e reconciliação pós-reconexão conforme [`scalability-requirements.md`](../scalability-requirements.md) Req. 9.
- **Idempotência** e controle de concorrência alinhados a [`concurrency-requirements.md`](../concurrency-requirements.md): `SKIP LOCKED` em filas, locks pessimistas em aceite de proposta, sem optimistic update financeiro.

### Como o sistema opera

1. Cliente cria **Service Request** (`OPEN`); plataforma executa elegibilidade, ranking e **batch inicial** de prestadores ([`matching-algorithm/requirements.md`](../matching-algorithm/requirements.md)).
2. Prestador envia **primeira mensagem** → **Chat** criado em `ACTIVE`; SR permanece `OPEN`.
3. Fase de **descoberta/negociação**: mensagens texto/imagem/sistema; reciprocidade bilateral monitorada em janela de **24 horas**.
4. Ausência de reciprocidade por **> 24h** → Chat `INACTIVE` (slot liberado); nova mensagem de qualquer parte → `ACTIVE` (reativação **não** exige slot livre).
5. Prestador envia **proposta** → `PENDING` (preço, escopo, prazo, 1–3 datas sugeridas, observações, fotos opcionais).
6. Cliente decide: **aceitar** (data obrigatória), **recusar**, **solicitar revisão** (máx. 2 por negociação), ou **inércia 24h** → `EXPIRED`.
7. **Aceite** → transação atômica: proposta `ACCEPTED`, SR `COMPLETED`, demais chats `CLOSED`, demais propostas `REJECTED_AUTOMATICALLY`, **Service** `PENDING_PAYMENT`.
8. **Encerramento manual** de chat → `CLOSED` (irreversível), slot liberado, dispatch pode abrir novo batch se elegível.

### Prioridades operacionais

| Prioridade | Regra |
|------------|-------|
| P0 | Integridade transacional de aceite e cancelamento de SR |
| P0 | Isolamento multi-tenant (RLS) e autorização server-side |
| P1 | Prevenção de chats/propostas duplicados e aceites concorrentes |
| P1 | Slot accounting correto (`ACTIVE` only) |
| P2 | Latência de mensagens (Realtime + reconciliação) |
| P2 | UX mobile (teclado, safe areas, scroll) |

### Trade-offs arquiteturais

| Decisão | Benefício | Custo |
|---------|-----------|-------|
| Estado no Postgres vs. Edge | Consistência sob concorrência | Mais RPCs e migrações |
| Timeline com mensagens dinâmicas referenciando entidades | Histórico único, UI evolutiva | Hidratação e sincronização Realtime |
| Reativação sem exigir slot | Retomada de negociação inativa | Pode exceder visualmente o teto configurado até janitor — slot só para **novos** prestadores via dispatch |
| MMD assíncrono para notificações | Escala e rate limit transacional | Entrega at-least-once; UI não depende de push |

### Problemas de escalabilidade endereçados

- Listagem de conversas e histórico de mensagens **paginados** (page size 20, máx. 100).
- Canal Realtime **por `conversation_id`**, não por tabela global.
- Jobs `pg_cron` para reciprocidade, expiração de proposta e recuperação de leases — sem estado em memória da Edge.
- Virtualização de timeline no cliente quando volume de mensagens exceder limiar documentado (SHOULD).

---

## Assumptions

- **Stack:** React 19, Vite 7, TypeScript 5.9, React Router 7, TanStack Query 5, Tailwind 3, Capacitor 8, Supabase (Postgres 15+, Auth, Storage, Realtime, Edge Functions Deno) — ver [`technical-stack.md`](../technical-stack.md).
- **Banco de dados:** PostgreSQL como única fonte de verdade para Chat, Message, Proposal, Service Request e transições; tipos gerados via `yarn generate-supabase-types`.
- **Infraestrutura:** Supabase-managed; sem Redis/SQS/Temporal no escopo atual — ver [`infrastructure-constraints.md`](../infrastructure-constraints.md).
- **Filas:** Table-based queues com `SELECT … FOR UPDATE SKIP LOCKED` e `locked_until` para workers (MMD, jobs de inatividade, expiração).
- **Assíncrono:** `pg_cron` + Edge Functions curtas; notificações via schema `message_dispatcher` — ver [`message-dispatcher/requirements.md`](../message-dispatcher/requirements.md).
- **Locking:** Pessimista em linha (`FOR UPDATE`) em aceite de proposta, contagem de slots e ingestão MMD; `SKIP LOCKED` em dequeue de filas.
- **Serviços externos:** Supabase Storage (imagens), FCM (push web/nativo), Resend (e-mail), OpenAI (fora do escopo CNS exceto se mensagens automáticas futuras).
- **Scheduling:** `pg_cron` para avaliação periódica de reciprocidade (24h), expiração de proposta (24h SLA cliente), janitor de leases.
- **Observabilidade:** Sentry no frontend; logs estruturados (`logger`) em Edge; tabelas de auditoria append-only para transições críticas.
- **Geoespacial:** Dispatch e elegibilidade de prestadores via H3/PostGIS no matching — CNS consome resultado, não recalcula geo.
- **Transacional:** Isolamento Read Committed; transições de estado + audit na mesma transação RPC.
- **Retry:** Mensagens falhadas no cliente com retry manual/ automático limitado; workers com backoff exponencial; MMD at-least-once com `idempotency_key`.
- **Persistência:** WAL/ACID Postgres; anexos em Storage; rascunhos locais apenas para composição de proposta (debounce), não para estado de workflow.
- **Edge stateless / DB stateful:** Toda máquina de estados e slot counter no Postgres.
- **Dependências:** Matching progressivo (`DISPATCH_*`), MMD, feature `provider-jobs` (`ProviderProposalComposerDialog` a extrair para feature isolada), auth/RLS existentes.

### Constantes operacionais (normativas até override em `platform_constants`)

| Constante | Valor | Fonte |
|-----------|-------|-------|
| `RECIPROCITY_WINDOW_HOURS` | 24 | `platform-flow.mmd`, checklist §3 |
| `PROPOSAL_CLIENT_RESPONSE_SLA_HOURS` | 24 | `platform-flow.mmd` (inércia cliente) |
| `MAX_REVISIONS_PER_NEGOTIATION` | 2 | checklist §8, `platform-flow.mmd` |
| `chats.max_active_slots_per_service_request` | **4** (default seed) | `public.platform_constants`; lido em runtime pelos RPCs — ver Requirement 33 |
| `MAX_SUGGESTED_SLOTS_PER_PROPOSAL` | 3 (mín. 1) | migração `harden_provider_proposal_pricing_signature` |
| `MESSAGE_LIST_PAGE_SIZE` | 20 (máx. 100) | scalability Req. 1–2 |

---

## Operational Phases

1. **Service Request Exposure Phase** — SR `OPEN`; dispatch em batches; elegibilidade e ranking de prestadores.
2. **Chat Initiation Phase** — primeira mensagem do prestador; criação idempotente de Chat `ACTIVE`; consumo de slot se aplicável.
3. **Discovery & Negotiation Phase** — mensagens bilaterais; reciprocidade; anexos; mensagens de sistema e dinâmicas.
4. **Reciprocity Evaluation Phase** — job periódico verifica troca bilateral na janela 24h; transição para `INACTIVE` ou manutenção `ACTIVE`.
5. **Proposal Composition Phase** — prestador estrutura proposta (modal/tela dedicada); validação Zod + RPC.
6. **Proposal Pending Phase** — `PENDING`; SLA 24h; countdown UI; notificações MMD.
7. **Client Decision Phase** — aceitar / recusar / revisão / inércia.
8. **Revision Orchestration Phase** — `REVISION_REQUESTED`; limite de revisões; resposta do prestador; versionamento.
9. **Acceptance Cascade Phase** — transação atômica de aceite, fechamento concorrente, SR `COMPLETED`, Service `PENDING_PAYMENT`.
10. **Closure & Slot Reclamation Phase** — manual `CLOSED`, automático pós-aceite, cancelamento SR; liberação de slot e retomada de dispatch.
11. **Notification Dispatch Phase** — ingestão MMD com `idempotency_key`; rate limits transacionais.
12. **Realtime Delivery Phase** — publicação Realtime; reconciliação por cursor no cliente.
13. **Recovery & Janitor Phase** — leases expirados, mensagens órfãs, reprocessamento seguro.

---

## State Machine

### Service Request

* `OPEN`
* `COMPLETED`
* `CANCELLED`

### Chat

* `ACTIVE`
* `INACTIVE`
* `CLOSED`

### Proposal

* `PENDING`
* `ACCEPTED`
* `REJECTED`
* `EXPIRED`
* `REVISION_REQUESTED`
* `REVISED`
* `REJECTED_AUTOMATICALLY`

### Service (pós-aceite, tabela `services`)

* `PENDING_PAYMENT` (estado inicial documentado em `platform-flow.mmd`)

### Dispatch (integração matching — somente leitura pelo CNS)

* `DISPATCH_ACTIVE`, `DISPATCH_PAUSED`, `DISPATCH_STOPPED`, `DISPATCH_FALLBACK_OPEN_MARKET`, `DISPATCH_EXPIRED` (ver matching)

### State Definitions

#### Service Request

- **`OPEN`** *(transitório operacional)* — Permite criação de chats (sujeito a slots), envio de propostas e negociação. SR MUST NOT aceitar novo chat de prestador externo após transição para terminal.
- **`COMPLETED`** *(terminal)* — Disparado por aceite de proposta (`platform-flow.mmd`: orçamento aprovado). MUST NOT permitir novas negociações, mensagens em chats não encerrados, nem novas propostas.
- **`CANCELLED`** *(terminal)* — Cancelamento manual pelo cliente. MUST encerrar todos os chats (`CLOSED`) e rejeitar propostas relacionadas.

#### Chat

- **`ACTIVE`** *(operacional)* — Negociação viva; **consome slot** operacional do SR. Permite envio de mensagens e propostas (se SR `OPEN` e demais regras).
- **`INACTIVE`** *(pausa)* — Sem reciprocidade bilateral na janela de 24h (ghosting cliente ou prestador). **Não consome slot**; permanece no histórico; reativável por nova mensagem sem exigir slot livre.
- **`CLOSED`** *(terminal)* — Encerramento manual (com confirmação, irreversível) ou automático (aceite de outra proposta / cancelamento SR). MUST NOT aceitar novas mensagens nem reativação.

#### Proposal

- **`PENDING`** *(aguardando cliente)* — Proposta vigente aguardando decisão; SLA 24h para ação do cliente.
- **`ACCEPTED`** *(terminal sucesso)* — Cliente selecionou data; vincula data oficial do serviço.
- **`REJECTED`** *(terminal por cliente)* — Recusa explícita; chat pode continuar em negociação ou encerrar.
- **`EXPIRED`** *(terminal por tempo)* — Cliente não agiu em 24h; chat pode permanecer ativo se houver atividade recente (`platform-flow.mmd`).
- **`REVISION_REQUESTED`** *(transitório)* — Cliente pediu revisão estruturada; prestador deve aceitar/recusar pedido antes de nova proposta.
- **`REVISED`** *(histórico)* — Proposta anterior substituída por nova versão `PENDING`.
- **`REJECTED_AUTOMATICALLY`** *(terminal sistêmico)* — Outra proposta foi aceita ou SR cancelado.

#### Service

- **`PENDING_PAYMENT`** — Criado após aceite; fora do escopo detalhado deste documento (pagamentos Asaas planejados).

### Diagrama de transição (referência)

Fluxo completo: [`platform-flow.mmd`](../platform-flow.mmd).

---

## Operational Architecture Constraints

- **Execution Model:** Transições de Chat, Proposal e efeitos colaterais em SR MUST ser executadas exclusivamente via **RPC PL/pgSQL** invocadas pelo app (`authenticated`) ou por jobs `SECURITY DEFINER`. Edge Functions SHALL NOT manter máquina de estados em memória.
- **Persistence Strategy:** Todo evento que altere slot, status ou versão de proposta MUST ser persistido antes de retornar sucesso HTTP ao cliente (write-ahead no DB).
- **Concurrency Control:** Aceite de proposta MUST usar `SELECT … FOR UPDATE` na linha do SR e das propostas elegíveis na mesma transação; falha de serialização MUST retornar erro mapeável (`409 CONFLICT`) sem efeito parcial.
- **Idempotency:** Criação de chat, envio de mensagem, aceite e ingestão de notificação MUST aceitar `idempotency_key` (UUID) com constraint `UNIQUE`; requisição duplicada MUST retornar o mesmo resultado sem duplicar efeitos.
- **Retry Mechanisms:** Upload de mídia e envio de mensagem MAY retentar no cliente com a mesma `idempotency_key`; workers de expiração MUST ser seguros sob at-least-once (transição condicional `WHERE status = expected`).
- **Scheduling:** Reciprocidade e expiração de proposta MUST ser avaliadas por `pg_cron` (intervalo recomendado: 5–15 min) com RPC idempotente por chat/proposta.
- **Resumable Execution:** Jobs de dispatch após liberação de slot MUST retomar do estado persistido em `dispatch` (matching); CNS MUST NOT depender de memória de sessão.
- **Restart Safety:** Crash após commit DB MUST NOT exigir compensação no cliente; crash antes do commit MUST permitir retry idempotente.
- **Fault Tolerance:** Falha de push/e-mail MUST NOT reverter transição de aceite já commitada (desacoplamento I/O — concurrency G5).
- **Isolation:** RLS MUST garantir que usuário A não leia mensagens/propostas do chat de usuário B; RPCs `SECURITY DEFINER` MUST revalidar `auth.uid()` e papel (`client` | `provider`).
- **Atomicity:** Aceite, cancelamento de SR e encerramento em massa de chats MUST ser uma única transação.
- **Ownership Semantics:** Apenas o participante do chat (cliente ou prestador vinculado) MAY enviar mensagens; apenas o prestador dono da proposta MAY enviar revisão; apenas o cliente do SR MAY aceitar/recusar/solicitar revisão.
- **Locking Semantics:** Slot counter MUST ser atualizado na mesma transação que transiciona chat para/de `ACTIVE`.
- **Polling Constraints:** Listagens MUST NOT ser polled &lt; 5s em estado estável; Realtime é preferido para mensagens ativas.
- **Orchestration Semantics:** Cascata pós-aceite é orquestrada pelo RPC `accept_proposal` (nome ilustrativo), não por corrente de chamadas do cliente.
- **Stateless Constraints:** Edge Functions MUST NOT cache estado de conversa entre invocações.
- **Distributed Guarantees:** At-least-once em notificações e Realtime; exactly-once em efeitos financeiros e aceite via idempotência + transação.

---

# Requirements

## Requirement 1: End-to-End Conversational Negotiation Flow

*User Story*: Como cliente, eu quero negociar com múltiplos prestadores no mesmo pedido de forma organizada, para comparar propostas sem perder contexto de cada conversa.

### Acceptance Criteria

- **GIVEN** um Service Request em status `OPEN` e dispatch elegível
- **WHEN** um prestador visível envia a primeira mensagem textual ou com mídia
- **THEN** o sistema MUST criar exatamente um Chat vinculado ao par `(service_request_id, provider_id)`, definir `chat.status = ACTIVE`, registrar `activated_at`, e manter `service_request.status = OPEN`.

- **GIVEN** múltiplos prestadores em batches distintos do mesmo SR
- **WHEN** cada um envia primeira mensagem em momentos diferentes
- **THEN** o sistema MUST permitir chats paralelos independentes, respeitando o limite de slots `ACTIVE` (Requirement 4).

- **GIVEN** um chat em negociação
- **WHEN** nenhuma proposta foi aceita e o SR permanece `OPEN`
- **THEN** cliente e prestador MUST poder trocar mensagens de texto, imagens múltiplas e mensagens de sistema conforme Requirement 3.

- **GIVEN** fluxo descrito em [`platform-flow.mmd`](../platform-flow.mmd) fase Discovery
- **WHEN** as partes trocam mensagens bilaterais
- **THEN** o sistema MUST permanecer na fase de descoberta até envio de proposta `PENDING` ou encerramento.

- **GIVEN** mobile e desktop
- **WHEN** o usuário alterna dispositivos
- **THEN** o estado exibido MUST refletir a mesma fonte de verdade persistida (sem divergência de status por plataforma).

- **GIVEN** checklist item 6–10 (negociação pré-proposta, estados separados, encerramento auto/manual, reativação, paridade mobile/desktop)
- **WHEN** qualquer transição do fluxo canônico ocorre
- **THEN** o comportamento MUST ser equivalente ao diagrama `platform-flow.mmd` e auditável.

---

## Requirement 2: Service Request Lifecycle & Terminal Invariants

*User Story*: Como plataforma, eu quero estados explícitos do pedido com efeitos colaterais determinísticos, para impedir negociação inválida após fechamento.

### Acceptance Criteria

- **GIVEN** tabela `service_requests` (ou equivalente)
- **WHEN** persistido
- **THEN** `status` MUST ser restrito a `OPEN`, `COMPLETED`, `CANCELLED` via `CHECK` ou enum.

- **GIVEN** SR em `COMPLETED`
- **WHEN** prestador tenta criar chat ou enviar primeira mensagem
- **THEN** o RPC MUST falhar com erro de negócio documentado e MUST NOT criar chat.

- **GIVEN** SR em `COMPLETED` por aceite de proposta
- **WHEN** a transação de aceite commita
- **THEN** `completed_at`, `accepted_proposal_id`, `scheduled_service_date` (data escolhida) MUST ser persistidos atomicamente.

- **GIVEN** cliente autenticado dono do SR
- **WHEN** solicita cancelamento manual
- **THEN** SR MUST transicionar para `CANCELLED`, todos os chats para `CLOSED`, todas as propostas não terminais para `REJECTED` (ou `REJECTED_AUTOMATICALLY` conforme política única documentada na migração), conforme `platform-flow.mmd` nós `AU`–`AX`.

- **GIVEN** cancelamento em andamento
- **WHEN** outra transação tenta aceitar proposta simultaneamente
- **THEN** exatamente uma MUST vencer; a outra MUST falhar com `409` sem estado parcial.

- **GIVEN** SR cancelado ou completado
- **WHEN** dispatch é avaliado
- **THEN** estado de dispatch MUST ser `DISPATCH_STOPPED` ou equivalente (integração matching Req. 5.15).

- **GIVEN** necessidade operacional de métricas
- **WHEN** SR transiciona
- **THEN** timestamps `created_at`, `updated_at`, `completed_at`, `cancelled_at` MUST ser registrados e imutáveis após terminal.

- **GIVEN** checklist §2 itens 11–20
- **WHEN** implementado
- **THEN** cada item MUST possuir correspondência neste requirement ou em Requirement 9/10.

---

## Requirement 3: Chat Entity, Messaging & Media

*User Story*: Como participante da negociação, eu quero enviar mensagens em tempo quase real com histórico confiável, para alinhar escopo antes e depois da proposta.

### Acceptance Criteria

- **GIVEN** chat com `status IN (ACTIVE, INACTIVE)`
- **WHEN** participante autorizado envia mensagem
- **THEN** mensagem MUST ser persistida com `sender_user_id`, `message_type`, `payload` jsonb, `created_at` monotônico.

- **GIVEN** chat `INACTIVE`
- **WHEN** qualquer participante envia mensagem válida
- **THEN** chat MUST transicionar para `ACTIVE` antes ou na mesma transação de insert da mensagem, **sem** verificar disponibilidade de slot (checklist item 37).

- **GIVEN** chat `CLOSED`
- **WHEN** tentativa de envio
- **THEN** MUST falhar; UI MUST exibir motivo de encerramento (`closure_reason`, `closed_by_role`).

- **GIVEN** tipos suportados inicialmente
- **WHEN** `message_type` é `text`, `image`, `system`, `proposal`, `workflow_action`
- **THEN** renderer MUST rotear para componente adequado (Requirement 16).

- **GIVEN** envio de imagens
- **WHEN** 1..N arquivos são anexados
- **THEN** upload MUST usar Storage com validação de tamanho/contagem alinhada a política de fotos; URLs MUST ser entregues via signed URL ou path RLS-protegido.

- **GIVEN** mensagem em voo
- **WHEN** usuário aguarda confirmação
- **THEN** UI MUST exibir loading state; falha MUST permitir retry com mesma `idempotency_key` (checklist 47–48).

- **GIVEN** histórico longo
- **WHEN** usuário abre conversa
- **THEN** mensagens MUST carregar paginadas (`list_chat_messages(p_cursor, p_limit)`), ordenação `created_at DESC` na RPC, exibição ASC no cliente.

- **GIVEN** `last_interaction_at` no chat
- **WHEN** qualquer mensagem é confirmada
- **THEN** campo MUST atualizar para `max(created_at)` da conversa.

- **GIVEN** indicador unread
- **WHEN** destinatário abre chat ou marca como lido
- **THEN** posição de leitura MUST persistir (`last_read_at` ou tabela `chat_read_receipts`) por usuário.

- **GIVEN** proteção anti-spam
- **WHEN** taxa de mensagens excede limiar (ex.: 30/min por usuário por chat)
- **THEN** RPC MUST retornar `429` com `retry_after_seconds`.

- **GIVEN** checklist §3 itens 21–50
- **WHEN** verificados em QA
- **THEN** todos MUST passar nos cenários GIVEN/WHEN/THEN mapeados neste e nos Requirements 13–15 (UI).

---

## Requirement 4: Operational Slot Limits & Reciprocity Scheduling

*User Story*: Como marketplace, eu quero limitar chats simultaneamente ativos por pedido e liberar capacidade quando negociações esfriam, para equilibrar oferta e demanda.

### Acceptance Criteria

- **GIVEN** contagem de chats com `status = ACTIVE` para um `service_request_id`
- **WHEN** prestador **novo** (sem chat prévio) tenta enviar primeira mensagem
- **THEN** se contagem &gt;= valor de `chats.max_active_slots_per_service_request` em `platform_constants` (default **4**), RPC MUST rejeitar criação até slot disponível, exceto reativação de chat existente (checklist 51–53; Requirement 33).

- **GIVEN** chat transiciona `ACTIVE` → `INACTIVE` por falta de reciprocidade
- **WHEN** job de reciprocidade commita
- **THEN** slot MUST ser decrementado atomicamente e dispatch MAY avaliar abertura de novo batch (`platform-flow.mmd` `I` → `AP`).

- **GIVEN** reciprocidade definida como troca bilateral
- **WHEN** na janela `RECIPROCITY_WINDOW_HOURS` (24h) existir ao menos uma mensagem do cliente e uma do prestador (ordem irrelevante)
- **THEN** chat MUST permanecer ou tornar-se `ACTIVE` na próxima avaliação.

- **GIVEN** apenas mensagens unilaterais por &gt; 24h (ghosting prestador **ou** cliente — nós `AS`, `AT`)
- **WHEN** job executa
- **THEN** chat MUST transicionar para `INACTIVE`, registrar `inactivated_at` e motivo `NO_RECIPROCITY`.

- **GIVEN** chat `INACTIVE` visível no histórico
- **WHEN** listado
- **THEN** MUST aparecer com indicação visual reduzida (Requirement 20, checklist 34–35).

- **GIVEN** número de chats `ACTIVE` no SR &gt;= `chats.max_active_slots_per_service_request` (lido de `platform_constants`, default 4)
- **WHEN** novo batch está para abrir
- **THEN** dispatch MUST ir para `DISPATCH_PAUSED` — integração obrigatória com matching; ambos os subsistemas MUST usar a **mesma chave** (Requirement 33).

- **GIVEN** duplicata `(service_request_id, provider_id)`
- **WHEN** prestador tenta criar segundo chat
- **THEN** MUST retornar chat existente (idempotente) e MUST NOT consumir slot adicional.

- **GIVEN** SR com proposta aceita
- **WHEN** prestador tenta iniciar novo chat
- **THEN** MUST falhar (checklist 56–57).

- **GIVEN** checklist §4 itens 51–60
- **WHEN** testado sob concorrência de dois prestadores disputando último slot
- **THEN** apenas um MUST obter slot; o outro MUST receber erro previsível.

---

## Requirement 5: Discovery & Pre-Proposal Negotiation

*User Story*: Como prestador, eu quero esclarecer escopo e disponibilidade antes de enviar proposta formal, para aumentar taxa de conversão e qualidade do orçamento.

### Acceptance Criteria

- **GIVEN** chat `ACTIVE` sem proposta `PENDING` vigente
- **WHEN** prestador envia perguntas
- **THEN** sistema MUST permitir mensagens longas/multiline e múltiplas imagens (checklist 61–68).

- **GIVEN** contexto do SR
- **WHEN** participante abre detalhes pelo header
- **THEN** painel MUST exibir dados do pedido (categoria, endereço mascarado conforme política, fotos do SR) — design spec chat-screen §Details.

- **GIVEN** início de conversa
- **WHEN** configurado em produto
- **THEN** sistema MAY inserir mensagem automática orientativa (tipo `system`) sugerindo perguntas estruturadas.

- **GIVEN** typing indicator
- **WHEN** suportado via Realtime presence com TTL
- **THEN** MUST expirar em &lt;= 10s sem heartbeat e MUST NOT gerar tráfego &gt; 1 evento/2s por usuário.

- **GIVEN** revisões posteriores de proposta
- **WHEN** cliente negocia alterações
- **THEN** histórico de mensagens MUST permanecer íntegro e contextualizar versões (checklist 66).

- **GIVEN** checklist §5
- **WHEN** validado
- **THEN** itens 61–70 MUST estar cobertos.

---

## Requirement 6: Structured Proposal Creation & Versioning

*User Story*: Como prestador, eu quero enviar proposta formal com preço, escopo, prazo e datas, para que o cliente decida com informação completa.

### Acceptance Criteria

- **GIVEN** prestador autenticado participante do chat
- **WHEN** submete proposta via composer (extraído de `ProviderProposalComposerDialog` para feature isolada)
- **THEN** RPC MUST validar: valor &gt; 0, descrição de escopo obrigatória, prazo estimado, `proposal_suggested_slots` jsonb array com 1–3 datas, observações opcionais, fotos opcionais.

- **GIVEN** proposta enviada com sucesso
- **WHEN** transação commita
- **THEN** `proposal.status = PENDING`, `version = 1` (ou `revision_number = 0`), timestamps `submitted_at`/`updated_at` registrados.

- **GIVEN** proposta já enviada
- **WHEN** prestador tenta editar campos in-place
- **THEN** MUST falhar; alteração só via nova versão após fluxo de revisão ou reenvio pós-expiração (checklist 84).

- **GIVEN** nova versão após revisão aceita pelo prestador
- **WHEN** nova proposta é submetida
- **THEN** proposta anterior MUST transicionar para `REVISED`, nova linha ou nova versão com `PENDING`, `revision_count` incrementado (platform-flow `AI`–`AK`).

- **GIVEN** UI de listagem de datas
- **WHEN** cliente visualiza proposta
- **THEN** cada data sugerida MUST ser exibida distintamente (checklist 79–80).

- **GIVEN** envio em andamento
- **WHEN** rede falha
- **THEN** UI MUST suportar retry idempotente; estado local MUST NOT marcar sucesso sem confirmação server (concurrency Req. 3).

- **GIVEN** mensagem dinâmica na timeline
- **WHEN** proposta é criada
- **THEN** MUST inserir `chat_message` com `message_type = proposal`, `linked_entity_type = proposal`, `linked_entity_id` apontando para entidade autoritativa (Requirement 16).

- **GIVEN** checklist §6 itens 71–90
- **WHEN** auditoria de requisitos
- **THEN** cobertura MUST ser 100%.

---

## Requirement 7: Proposal Acceptance — Atomic Cascade

*User Story*: Como cliente, eu quero aceitar uma proposta escolhendo a data de execução, encerrando automaticamente as demais negociações, para contratar sem ambiguidade.

### Acceptance Criteria

- **GIVEN** proposta `PENDING` não expirada e SR `OPEN`
- **WHEN** cliente inicia aceite
- **THEN** UI MUST exibir resumo completo e exigir seleção obrigatória de uma das datas em `proposal_suggested_slots` (checklist 91–93).

- **GIVEN** confirmação explícita do cliente (sem etapa bilateral posterior — checklist 94)
- **WHEN** RPC `accept_proposal` executa com `proposal_id`, `selected_slot`, `idempotency_key`
- **THEN** em uma transação: proposta → `ACCEPTED`; SR → `COMPLETED`; demais chats do SR → `CLOSED` com motivo `PROPOSAL_ACCEPTED_ELSEWHERE`; demais propostas pendentes → `REJECTED_AUTOMATICALLY`; criar `services` row com `PENDING_PAYMENT` (`platform-flow.mmd` `O`–`BA`).

- **GIVEN** duas abas tentam aceitar propostas diferentes simultaneamente
- **WHEN** ambas chamam RPC
- **THEN** exatamente uma MUST suceder; a outra MUST falhar com `409` (checklist 99).

- **GIVEN** aceite bem-sucedido
- **WHEN** outros prestadores visualizam chat
- **THEN** input de mensagem MUST estar desabilitado e mensagem de sistema MUST indicar encerramento (checklist 103).

- **GIVEN** aceite
- **WHEN** notificações são enfileiradas
- **THEN** MMD MUST receber eventos com `idempotency_key` derivada de `proposal_id` + event type para fechamento (checklist 102).

- **GIVEN** proposta expirada
- **WHEN** cliente tenta aceitar
- **THEN** MUST falhar (Requirement 9).

- **GIVEN** checklist §7
- **WHEN** teste de integração pgTAP ou RPC
- **THEN** rollback de qualquer passo intermediário MUST ser impossível após commit.

---

## Requirement 8: Proposal Rejection & Continuation

*User Story*: Como cliente, eu quero recusar uma proposta mantendo ou encerrando a conversa, para controlar com quem sigo negociando.

### Acceptance Criteria

- **GIVEN** proposta `PENDING`
- **WHEN** cliente recusa explicitamente
- **THEN** `proposal.status = REJECTED`, `rejected_at` persistido (`platform-flow.mmd` `U`).

- **GIVEN** proposta `REJECTED`
- **WHEN** ambas as partes desejam continuar
- **THEN** chat MAY permanecer `ACTIVE`/`INACTIVE` e negociação retorna à fase Discovery (`V` → `F`).

- **GIVEN** proposta `REJECTED`
- **WHEN** cliente ou prestador escolhe encerrar
- **THEN** chat → `CLOSED` manual (`W`).

- **GIVEN** recusa
- **WHEN** mensagem dinâmica na timeline
- **THEN** componente MUST atualizar estado visual para Declined sem duplicar card (Requirement 16).

- **GIVEN** checklist §10 implícito (rejeição entre expiração e revisão)
- **WHEN** mapeado
- **THEN** comportamento MUST seguir `platform-flow.mmd` nó `N` → `U`.

---

## Requirement 9: Proposal Expiration & SLA Temporal

*User Story*: Como marketplace, eu quero expirar propostas sem resposta do cliente em 24h, para manter urgência e liberar decisão do prestador.

### Acceptance Criteria

- **GIVEN** proposta `PENDING` com `submitted_at`
- **WHEN** `now() - submitted_at >= PROPOSAL_CLIENT_RESPONSE_SLA_HOURS` (24h) sem ação do cliente
- **THEN** job MUST transicionar para `EXPIRED`, registrar `expired_at` (platform-flow `X`).

- **GIVEN** proposta `EXPIRED`
- **WHEN** cliente tenta aceitar
- **THEN** MUST falhar com erro claro (checklist 133).

- **GIVEN** proposta expirada
- **WHEN** chat possui atividade de mensagem recente (&lt; 24h)
- **THEN** negociação MAY continuar em Discovery (`Y` → `F`); chat não é encerrado automaticamente (checklist 128).

- **GIVEN** proposta expirada e chat sem atividade recente
- **WHEN** job avalia
- **THEN** chat MAY transicionar para `INACTIVE` (`Y` → `I`).

- **GIVEN** proposta `EXPIRED`
- **WHEN** prestador reenvia proposta
- **THEN** nova proposta `PENDING` MUST ser permitida com novo `id`/`version` (checklist 132).

- **GIVEN** proposta próxima do SLA
- **WHEN** faltam &lt;= 4h
- **THEN** sistema SHOULD enfileirar notificação MMD de lembrete (se política de produto ativa) e UI MUST exibir countdown (checklist 129–130).

- **GIVEN** expiração
- **WHEN** UI renderiza card
- **THEN** estado visual desabilitado distinto de `PENDING` (checklist 134).

---

## Requirement 10: Revision Request Orchestration (Max 2)

*User Story*: Como cliente, eu quero solicitar até duas revisões estruturadas da proposta, para negociar preço, escopo, datas ou prazo sem ciclo infinito.

### Acceptance Criteria

- **GIVEN** proposta `PENDING` e `revision_count < 2`
- **WHEN** cliente solicita revisão
- **THEN** proposta MUST → `REVISION_REQUESTED`, MUST persistir motivo em enum: `PRICE_TOO_HIGH`, `REDUCE_SCOPE`, `DATE_NOT_AVAILABLE`, `CHANGE_TIMELINE`, `CLARIFY_DETAILS`, `OTHER` + `custom_notes` opcional (checklist 108–110).

- **GIVEN** solicitação de novas datas
- **WHEN** submetida
- **THEN** MUST ser tratada como revisão (checklist 111).

- **GIVEN** `revision_count >= 2`
- **WHEN** cliente tenta nova revisão
- **THEN** MUST falhar; UI MUST oferecer apenas aceitar, recusar ou encerrar chat (`AB`–`AC`).

- **GIVEN** revisão permitida
- **WHEN** UI exibe formulário
- **THEN** contador visual de revisões restantes MUST ser exibido (checklist 116).

- **GIVEN** `REVISION_REQUESTED`
- **WHEN** prestador aceita revisão
- **THEN** prestador MUST poder enviar nova proposta; anterior → `REVISED`; nova → `PENDING`; `revision_count` incrementado (`AH`–`AK`).

- **GIVEN** `REVISION_REQUESTED`
- **WHEN** prestador recusa revisão
- **THEN** cliente MUST poder aceitar proposta atual, recusar ou encerrar (`AL`).

- **GIVEN** nova proposta após revisão
- **WHEN** entra em `PENDING`
- **THEN** SLA de 24h MUST reiniciar (`submitted_at` atualizado) — checklist 123.

- **GIVEN** histórico
- **WHEN** cliente expande detalhes
- **THEN** versões anteriores MUST ser consultáveis (checklist 86–88, 121).

- **GIVEN** checklist §8
- **WHEN** validado
- **THEN** todos os caminhos `AA`–`AG` do platform-flow MUST ser cobertos.

---

## Requirement 11: Manual Chat Closure

*User Story*: Como participante, eu quero encerrar definitivamente uma negociação que não avançará, liberando slot para outros prestadores.

### Acceptance Criteria

- **GIVEN** chat `ACTIVE` ou `INACTIVE`
- **WHEN** cliente ou prestador solicita encerramento manual
- **THEN** UI MUST exigir confirmação explícita (checklist 42).

- **GIVEN** confirmação
- **WHEN** RPC executa
- **THEN** `status = CLOSED`, `closure_type = MANUAL`, `closed_by_user_id`, `closure_reason` opcional, `closed_at`; MUST NOT permitir reativação (checklist 43).

- **GIVEN** chat `CLOSED` manual
- **WHEN** slot era consumido (`ACTIVE` anterior)
- **THEN** slot MUST ser liberado na mesma transação (`AN` → `AO`).

- **GIVEN** slot liberado e dispatch elegível
- **WHEN** condições de matching satisfeitas
- **THEN** plataforma MAY executar próximo batch (`AP`–`AR`).

- **GIVEN** encerramento
- **WHEN** UI lista conversas
- **THEN** estado `CLOSED` MUST ser claramente identificado (checklist 40, 151).

---

## Requirement 12: Multichannel Notifications via MMD

*User Story*: Como usuário, eu quero ser notificado de novas mensagens e marcos de proposta sem excesso de comunicação.

### Acceptance Criteria

- **GIVEN** nova mensagem em chat com destinatário offline
- **WHEN** mensagem é persistida
- **THEN** produtor MUST chamar `message_dispatcher_ingest` com `idempotency_key` única, canais permitidos (`push`, `email`), respeitando limites 20 push/dia e 5 e-mail/dia e cooldown 20 min (MMD Req. 1).

- **GIVEN** eventos críticos (proposta recebida, revisão solicitada, aceite, encerramento)
- **WHEN** transição commita
- **THEN** ingestão MMD MUST ocorrer após commit (desacoplamento).

- **GIVEN** `idempotency_key` duplicada
- **WHEN** segunda ingestão
- **THEN** MUST NOT duplicar notificação entregue.

- **GIVEN** falha FCM terminal
- **WHEN** MMD marca `FAILED_TERMINAL`
- **THEN** token MUST ser invalidado conforme scalability Req. 7.

- **GIVEN** checklist item 45
- **WHEN** verificado
- **THEN** integração MUST usar MMD exclusivamente, não envio ad-hoc.

---

## Requirement 13: Realtime, Reconciliation & Message Delivery States

*User Story*: Como usuário em conversa ativa, eu quero ver mensagens quase instantaneamente e recuperar gaps após reconexão.

### Acceptance Criteria

- **GIVEN** Supabase Realtime habilitado
- **WHEN** cliente assina canal
- **THEN** `channel` MUST ser `conversation:{conversation_id}` (ou equivalente), filtrando apenas inserts/updates autorizados por RLS.

- **GIVEN** mensagem enviada
- **WHEN** persistida
- **THEN** metadata MUST suportar `delivery_status` (`pending`, `sent`, `delivered`, `read`) atualizável.

- **GIVEN** desconexão &gt; 5s
- **WHEN** app reconecta
- **THEN** cliente MUST buscar mensagens com `created_at > last_seen_cursor` paginado, mesclando sem duplicar `id`.

- **GIVEN** envio otimista no UI
- **WHEN** confirmação chega
- **THEN** mensagem temporária MUST ser substituída pela confirmada ou marcada falha com retry.

- **GIVEN** checklist chat-requirements-list 87, 13–14
- **WHEN** nova mensagem chega na lista
- **THEN** lista MUST reordenar por `last_interaction_at` e atualizar preview.

- **GIVEN** volume alto
- **WHEN** &gt; 500 mensagens
- **THEN** cliente SHOULD ativar virtualização de lista (checklist dinâmico 105).

---

## Requirement 14: Idempotency, Concurrency & Duplicate Prevention

*User Story*: Como engenheiro, eu quero garantias sob retentativas e corrida entre usuários, para não duplicar chats, mensagens ou aceites.

### Acceptance Criteria

- **GIVEN** header ou body `Idempotency-Key`
- **WHEN** `create_chat`, `send_message`, `accept_proposal`, `submit_proposal` são chamados
- **THEN** constraint `UNIQUE (idempotency_key)` ou `(user_id, idempotency_key, operation)` MUST garantir resposta repetível.

- **GIVEN** aceite concorrente
- **WHEN** duas transações bloqueiam SR
- **THEN** segunda MUST falhar após primeira commitar.

- **GIVEN** política de concorrência global ([`concurrency-requirements.md`](../concurrency-requirements.md))
- **WHEN** implementado CNS
- **THEN** MUST NOT usar lock em memória na Edge; MUST NOT optimistic update em aceite.

- **GIVEN** fila de jobs de inatividade
- **WHEN** dois workers processam mesmo chat
- **THEN** transição `ACTIVE`→`INACTIVE` MUST ser condicional `WHERE status = 'ACTIVE'`; linhas afetadas 0 ou 1.

---

## Requirement 15: Persistence Schema & Source of Truth

*User Story*: Como arquiteto, eu quero separação clara entre timeline conversacional e entidades de workflow, para evolução sem refatoração massiva.

### Acceptance Criteria

- **GIVEN** tabela `conversations` (ou `chats`)
- **WHEN** definida
- **THEN** MUST incluir: `id`, `service_request_id`, `client_id`, `provider_id`, `status`, `last_interaction_at`, timestamps de ciclo de vida, `UNIQUE(service_request_id, provider_id)`.

- **GIVEN** tabela `chat_messages`
- **WHEN** definida
- **THEN** MUST incluir: `id`, `conversation_id`, `sender_user_id`, `message_type`, `payload jsonb`, `linked_entity_type`, `linked_entity_id`, `idempotency_key`, `created_at`, `updated_at` (design spec §Suggested Database Structure).

- **GIVEN** tabela `proposals` com versionamento
- **WHEN** consultada
- **THEN** MUST ser fonte autoritativa de preço, escopo, status; `chat_messages` MUST NOT duplicar dados autoritativos além de snapshot leve para render offline.

- **GIVEN** políticas RLS
- **WHEN** cliente ou prestador acessa
- **THEN** apenas participantes do chat e dono do SR MUST ler/escrever conforme papel.

- **GIVEN** auditoria
- **WHEN** transição crítica ocorre
- **THEN** append em `chat_audit` / `proposal_audit` com `from_status`, `to_status`, `actor_id`, `metadata jsonb`.

---

## Requirement 16: Dynamic Operational Messages (Timeline Cards)

*User Story*: Como usuário, eu quero ver propostas e eventos de workflow dentro do histórico, com ações embutidas, sem sair da conversa.

### Acceptance Criteria

- **GIVEN** `message_type = proposal`
- **WHEN** renderizado
- **THEN** componente MUST hidratar da entidade `proposals` via `linked_entity_id` e re-renderizar em mudança de status Realtime (design spec dynamic message).

- **GIVEN** transição para `ACCEPTED`, `REJECTED`, `EXPIRED`, `REVISION_REQUESTED`
- **WHEN** estado muda
- **THEN** mesmo registro de mensagem MUST atualizar UI (evitar duplicata) salvo quando workflow exigir novo evento distinto.

- **GIVEN** tipos iniciais
- **WHEN** documentados
- **THEN** MUST suportar: proposal sent/updated/revision requested/accepted/rejected/expired/cancelled.

- **GIVEN** tipo desconhecido
- **WHEN** renderizado
- **THEN** fallback MUST NOT quebrar timeline (checklist 19–20).

- **GIVEN** papel do visualizador
- **WHEN** cliente vs prestador
- **THEN** CTAs MUST respeitar permissões (Accept/Reject/Request Revision vs Edit/Resend).

- **GIVEN** expansão de detalhes
- **WHEN** usuário expande card
- **THEN** scroll position MUST ser preservado (design spec §Expansion).

- **GIVEN** entidade vinculada deletada ou inacessível
- **WHEN** hidratação falha
- **THEN** fallback “Unable to load proposal information” MUST exibir.

- **GIVEN** checklist dynamic §1–111
- **WHEN** auditoria
- **THEN** cobertura completa.

---

## Requirement 17: Chat List Screen & List Item Component

*User Story*: Como usuário, eu quero listar conversas ativas e históricas com contexto do serviço e última mensagem, para retomar negociações rapidamente.

### Acceptance Criteria

- **GIVEN** usuário autenticado
- **WHEN** abre lista de chats
- **THEN** RPC paginada MUST retornar conversas ordenadas por `last_interaction_at DESC` (page size 20).

- **GIVEN** cada item (design `chat-list-item-component-design-spec.md`)
- **WHEN** renderizado
- **THEN** MUST exibir: ícone do serviço, avatar da contraparte (cliente vê prestador e vice-versa), nome, nome do serviço, preview da última mensagem, timestamp.

- **GIVEN** preview
- **WHEN** última mensagem é imagem/sistema/proposta
- **THEN** MUST exibir indicador (`📷 Photo`, `Proposal submitted`, etc.).

- **GIVEN** conversa não lida
- **WHEN** `last_message_at > last_read_at`
- **THEN** item MUST exibir destaque unread (fundo/badge).

- **GIVEN** textos longos
- **WHEN** excedem largura
- **THEN** ellipsis em uma linha para nome, serviço e preview.

- **GIVEN** item inteiro
- **WHEN** toque/clique
- **THEN** MUST navegar para chat screen.

- **GIVEN** zero conversas
- **WHEN** lista carrega
- **THEN** empty state MUST exibir.

- **GIVEN** desktop
- **WHEN** layout amplo
- **THEN** sidebar persistente 320–420px com painel de conversa à direita (chat-requirements-list 70–74).

- **GIVEN** checklist chat-requirements-list 1–15
- **WHEN** QA visual
- **THEN** conformidade com design spec.

---

## Requirement 18: Chat Screen, Header, Input & Keyboard Safety

*User Story*: Como usuário mobile, eu quero uma tela de chat legível com teclado que não oculte mensagens ou o campo de envio.

### Acceptance Criteria

- **GIVEN** chat screen (design `chat-screen-component-design-spec.md`)
- **WHEN** renderizada
- **THEN** layout MUST ter header fixo, área scrollável, input fixo inferior.

- **GIVEN** header
- **WHEN** exibido
- **THEN** MUST conter: back, avatar circular, nome participante, nome do serviço, botão Details.

- **GIVEN** abertura da conversa
- **WHEN** histórico carrega
- **THEN** scroll MUST posicionar na mensagem mais recente.

- **GIVEN** mensagens
- **WHEN** agrupadas por remetente e proximidade temporal
- **THEN** avatar incoming MUST aparecer só no primeiro do grupo; bolhas distintas incoming/outgoing; separadores de data centrados.

- **GIVEN** input area
- **WHEN** usuário digita multiline
- **THEN** campo expande até altura máxima segura; botão enviar circular desabilitado se vazio.

- **GIVEN** teclado virtual (Capacitor Keyboard)
- **WHEN** abre
- **THEN** viewport MUST redimensionar; última mensagem e input MUST permanecer visíveis (regra `mobile-first-ux`).

- **GIVEN** safe areas
- **WHEN** iOS notch ou gesture nav
- **THEN** padding `env(safe-area-inset-*)` MUST aplicar.

- **GIVEN** checklist chat-requirements-list 16–69
- **WHEN** teste em mobile-safari Playwright
- **THEN** MUST passar.

---

## Requirement 19: Chat Action Banner (Contextual CTA)

*User Story*: Como usuário, eu quero orientação clara sobre a próxima ação na negociação, sem poluir a conversa.

### Acceptance Criteria

- **GIVEN** chat screen carregada
- **WHEN** existe ação pendente prioritária
- **THEN** banner abaixo do header MUST exibir texto contextual + CTA primário + dismiss (design `chat-action-banner-component-design-spec.md`).

- **GIVEN** múltiplas condições
- **WHEN** avaliadas
- **THEN** apenas a ação de maior prioridade MUST aparecer (ex.: revisão &gt; enviar proposta &gt; continuar conversa).

- **GIVEN** estados prestador sem proposta
- **WHEN** critérios atendidos
- **THEN** CTA “Send Proposal” e copy orientativa (spec §Provider — Proposal Not Yet Sent).

- **GIVEN** `REVISION_REQUESTED`
- **WHEN** prestador visualiza
- **THEN** CTA “Review Proposal” (spec §Provider — Revision Requested).

- **GIVEN** cliente com proposta `PENDING`
- **WHEN** visualiza
- **THEN** CTA “View Proposal” (spec §Client — Proposal Received).

- **GIVEN** dismiss
- **WHEN** usuário fecha banner
- **THEN** MUST ocultar apenas na sessão atual; ao reabrir chat, banner MUST reaparecer se condição persistir.

- **GIVEN** CTA acionado
- **WHEN** tap
- **THEN** MUST abrir fluxo correto (modal proposta, painel de aceite, etc.).

- **GIVEN** acessibilidade
- **WHEN** leitor de tela
- **THEN** botões MUST ter labels descritivos; contraste WCAG.

---

## Requirement 20: Visual States, UX Feedback & Accessibility

*User Story*: Como usuário com diferentes dispositivos e necessidades de acessibilidade, eu quero estados visuais claros e feedback imediato após ações críticas.

### Acceptance Criteria

- **GIVEN** chat `ACTIVE`, `INACTIVE`, `CLOSED`
- **WHEN** exibidos na lista e no header
- **THEN** destaque visual MUST seguir checklist §11 (149–151): ACTIVE destacado, INACTIVE reduzido, CLOSED identificado.

- **GIVEN** proposta `PENDING`, `ACCEPTED`, `EXPIRED`
- **WHEN** exibida
- **THEN** CTA principal, sucesso, ou desabilitado respectivamente (152–154).

- **GIVEN** badges de status
- **WHEN** renderizados
- **THEN** cor MUST NOT ser único indicador (WCAG — checklist 176).

- **GIVEN** ação crítica (aceite, encerramento)
- **WHEN** completa
- **THEN** toast ou feedback visual imediato MUST ocorrer (156).

- **GIVEN** carregamento
- **WHEN** dados async
- **THEN** skeletons MUST exibir (157).

- **GIVEN** erro
- **WHEN** falha de rede
- **THEN** error state acionável (159).

- **GIVEN** checklist §12–13 (responsividade e acessibilidade 163–180)
- **WHEN** validação
- **THEN** touch targets &gt;= 44px, foco visível desktop, suporte screen reader em mudanças de estado.

---

## Requirement 21: Observability, Audit & Operational Analytics

*User Story*: Como operador, eu quero rastrear transições e métricas de negociação para debugging e melhoria de produto.

### Acceptance Criteria

- **GIVEN** qualquer transição de status em chat/proposta/SR
- **WHEN** commita
- **THEN** audit log imutável MUST registrar actor, timestamps, from/to.

- **GIVEN** Sentry no frontend
- **WHEN** erro em hook de chat
- **THEN** MUST incluir `conversation_id`, `service_request_id` em contexto.

- **GIVEN** métricas de produto (checklist §14)
- **WHEN** eventos ocorrem
- **THEN** sistema MUST registrar: tempo até primeira resposta, tempo até proposta, taxa de aceite, revisão, expiração, motivos de encerramento (analytics events com schema versionado).

- **GIVEN** suporte operacional
- **WHEN** consulta audit por `conversation_id`
- **THEN** resposta MUST permitir replay ordenado de transições (checklist 191).

- **GIVEN** SLA de proposta
- **WHEN** monitorado
- **THEN** alerta SHOULD disparar se job de expiração atrasar &gt; 30 min (métrica operacional).

---

## Requirement 22: Scalability & Performance Constraints

*User Story*: Como engenheiro de plataforma, eu quero que o chat escale com usuários e mensagens sem degradar p95 nem custo Supabase.

### Acceptance Criteria

- **GIVEN** listagem de conversas e mensagens
- **WHEN** implementadas
- **THEN** MUST seguir paginação server-side ([`scalability-requirements.md`](../scalability-requirements.md) Req. 1–2).

- **GIVEN** Realtime
- **WHEN** configurado
- **THEN** MUST seguir Req. 9 (canal por conversa, reconciliação por cursor).

- **GIVEN** índices
- **WHEN** migração criada
- **THEN** MUST existir índice em `(service_request_id, status)` para chats, `(conversation_id, created_at DESC)` para mensagens, `(service_request_id, status)` para propostas.

- **GIVEN** payload de lista
- **WHEN** retornado
- **THEN** JSON MUST NOT exceder 1 MB; projeção mínima de colunas.

- **GIVEN** dynamic cards
- **WHEN** hidratação
- **THEN** lazy load de detalhes expandidos SHOULD usar query separada.

---

## Requirement 23: Post-Acceptance Service Creation

*User Story*: Como plataforma, eu quero instanciar o serviço contratado imediatamente após aceite, para iniciar fluxo de pagamento.

### Acceptance Criteria

- **GIVEN** aceite commitado (`Requirement 7`)
- **WHEN** transação completa
- **THEN** registro em `services` MUST ser criado com `status = PENDING_PAYMENT`, vinculado a `service_request_id`, `proposal_id`, `client_id`, `provider_id`, `scheduled_date` = data escolhida.

- **GIVEN** falha na criação de service após aceite
- **WHEN** detectada
- **THEN** transação de aceite MUST rollback — MUST NOT haver SR `COMPLETED` sem service row.

- **GIVEN** `platform-flow.mmd` nó `BA`
- **WHEN** documentado
- **THEN** pagamentos detalhados ficam em `payment-system-plan.md` (fora de escopo CNS além da criação).

---

## Requirement 24: Integration with Dispatch & Matching

*User Story*: Como sistema de dispatch, eu quero pausar e retomar batches conforme slots e propostas, para não sobrecarregar clientes.

### Acceptance Criteria

- **GIVEN** liberação de slot (inatividade ou fechamento manual)
- **WHEN** contagem de ativos &lt; `chats.max_active_slots_per_service_request` e dispatch `DISPATCH_PAUSED` por slot
- **THEN** sistema SHOULD avaliar retomada de batches conforme matching Req. 5.

- **GIVEN** &gt;= 4 propostas pendentes não rejeitadas OU proposta aceita
- **WHEN** avaliado
- **THEN** dispatch → `DISPATCH_STOPPED` (matching Req. 5.15).

- **GIVEN** prestador já tem chat ou proposta no SR
- **WHEN** feed é montado
- **THEN** SR MAY ser ocultado ou despriorizado (matching Req. 5.8).

---

## Requirement 25: Scheduled Jobs — Reciprocity, Expiration & Batch Processing

*User Story*: Como operador, eu quero que regras temporais (24h) sejam aplicadas de forma confiável e escalável sem depender da sessão do usuário.

### Acceptance Criteria

- **GIVEN** job `chat_evaluate_reciprocity` agendado via `pg_cron` (intervalo 10 min recomendado)
- **WHEN** executa
- **THEN** MUST processar chats `ACTIVE` em lotes de até 500 linhas por invocação com `FOR UPDATE SKIP LOCKED`, transicionando elegíveis para `INACTIVE`.

- **GIVEN** job `proposal_expire_pending`
- **WHEN** executa
- **THEN** MUST transicionar propostas `PENDING` com `submitted_at + 24h < now()` para `EXPIRED` condicionalmente (`WHERE status = 'PENDING'`).

- **GIVEN** mesmo chat elegível para reciprocidade e expiração na mesma janela
- **WHEN** jobs concorrentes rodam
- **THEN** ordem MUST NOT produzir estado inválido; cada RPC MUST ser independente e idempotente.

- **GIVEN** falha parcial no lote (ex.: 3 de 500 falham constraint)
- **WHEN** transação por chat usa savepoint ou transação individual
- **THEN** falhas isoladas MUST NOT abortar lote inteiro (SHOULD usar processamento per-row em subtransação).

- **GIVEN** métricas operacionais
- **WHEN** job termina
- **THEN** MUST registrar `processed_count`, `transitioned_count`, `duration_ms` em log estruturado ou tabela `job_runs`.

- **GIVEN** carga nacional (10⁵ chats)
- **WHEN** job executa
- **THEN** MUST completar varredura em &lt; 15 min via índice `(status, last_interaction_at)` e paginação de candidatos.

- **GIVEN** SR `COMPLETED` ou `CANCELLED`
- **WHEN** jobs avaliam chats do SR
- **THEN** MUST pular processamento de reciprocidade (chat já terminal ou encerrado).

- **GIVEN** checklist temporal (24h reciprocidade, 24h proposta)
- **WHEN** validado em staging com relógio controlado
- **THEN** transições MUST ocorrer dentro de janela `scheduled_interval + 10 min` do SLA operacional.

---

## Requirement 26: Recovery Semantics, Orphan Handling & Fault Tolerance

*User Story*: Como SRE, eu quero recuperação automática de trabalho parcial e estados inconsistentes após falha de worker ou cliente.

### Acceptance Criteria

- **GIVEN** mensagem com `delivery_status = pending` há &gt; 5 min sem confirmação
- **WHEN** job de reconciliação executa
- **THEN** MUST marcar como `failed` ou reenfileirar envio conforme política; MUST NOT duplicar mensagem visível se `idempotency_key` já commitada.

- **GIVEN** upload de imagem concluído em Storage mas insert de mensagem falhou
- **WHEN** janitor executa
- **THEN** objetos órfãos MUST ser identificados por `upload_session_id` expirado (&gt; 24h) e MAY ser removidos após política de retenção.

- **GIVEN** aceite de proposta com commit parcial impossível por design
- **WHEN** qualquer sub-passo falha
- **THEN** transação inteira MUST rollback — nenhum chat parcialmente fechado.

- **GIVEN** Realtime desconectado por &gt; 1 h
- **WHEN** usuário retorna
- **THEN** full sync via paginação MUST reconciliar gap sem perda; mensagens duplicadas por `id` MUST ser deduplicadas no cliente.

- **GIVEN** MMD falhou após aceite
- **WHEN** operador reinsere manualmente
- **THEN** re-ingestão com mesma `idempotency_key` MUST NOT reprocessar efeito de negócio.

- **GIVEN** crash de Edge durante upload
- **WHEN** cliente retenta com mesma key
- **THEN** servidor MUST retornar mensagem existente ou completar insert pendente.

- **GIVEN** `platform-flow.mmd` caminhos de retomada pós-`INACTIVE`
- **WHEN** nova mensagem chega
- **THEN** estado MUST ser `ACTIVE` independentemente de falhas anteriores de job.

---

## Requirement 27: Timeout Handling & Ownership Leasing (Internal Jobs)

*User Story*: Como engenheiro de backend, eu quero leases em processamento assíncrono interno para evitar bloqueio permanente de recursos.

### Acceptance Criteria

- **GIVEN** fila interna `chat_maintenance_queue` (se adotada)
- **WHEN** worker faz checkout
- **THEN** MUST definir `locked_until = now() + interval '30 seconds'` na mesma transação que marca `processing = true`.

- **GIVEN** worker morre com lease ativo
- **WHEN** `locked_until &lt; now()`
- **THEN** janitor MUST retornar item a `queued` para reprocessamento.

- **GIVEN** RPC de longa duração (aceite)
- **WHEN** excede timeout PostgREST
- **THEN** cliente MUST poder consultar status por `idempotency_key` (resposta idempotente do resultado commitado).

- **GIVEN** typing presence
- **WHEN** TTL expira (10s)
- **THEN** indicador MUST desaparecer sem job adicional (expiração client-side + server TTL).

- **GIVEN** sessão de composição de proposta abandonada
- **WHEN** &gt; 7 dias sem submit
- **THEN** rascunho local MAY ser expurgado pelo cliente; servidor MUST NOT depender de rascunho.

---

## Requirement 28: Domain Event Processing & Async Boundaries

*User Story*: Como arquiteto, eu quero desacoplar efeitos colaterais (notificação, analytics, dispatch) das transações críticas sem perder consistência.

### Acceptance Criteria

- **GIVEN** transação de aceite
- **WHEN** commit bem-sucedido
- **THEN** eventos `PROPOSAL_ACCEPTED`, `SERVICE_REQUEST_COMPLETED`, `CHATS_CLOSED_BULK` MUST ser registrados em `domain_events` (outbox) na mesma transação ou via trigger `AFTER COMMIT` para consumo assíncrono.

- **GIVEN** consumidor de outbox
- **WHEN** processa evento
- **THEN** MUST usar `SKIP LOCKED` e MUST marcar `processed_at` atomicamente.

- **GIVEN** falha no consumidor de analytics
- **WHEN** evento permanece não processado
- **THEN** negócio transacional MUST permanecer válido — analytics é best-effort (SHOULD).

- **GIVEN** evento `SLOT_RELEASED`
- **WHEN** consumido pelo subsistema de matching
- **THEN** MAY disparar avaliação de `DISPATCH_PAUSED` → retomada sem bloquear RPC de chat.

- **GIVEN** ordenação de eventos por `conversation_id`
- **WHEN** múltiplos eventos enfileirados
- **THEN** processamento MAY ser paralelo entre conversas; dentro da mesma conversa SHOULD preservar ordem por `created_at`.

- **GIVEN** checklist observabilidade item 191 (replay)
- **WHEN** suporte consulta `domain_events` por `service_request_id`
- **THEN** ordem causal MUST ser reconstruível.

---

## Requirement 29: Exposure Control & Provider Re-Entry

*User Story*: Como prestador previamente inativo, eu quero reentrar na negociação quando houver slot, sem duplicar chat.

### Acceptance Criteria

- **GIVEN** prestador com chat `INACTIVE` existente
- **WHEN** envia nova mensagem
- **THEN** MUST reutilizar mesmo `conversation_id` e transicionar para `ACTIVE` (checklist 58).

- **GIVEN** prestador com chat `CLOSED` manual
- **WHEN** tenta enviar mensagem
- **THEN** MUST falhar; nova negociação só via novo ciclo de dispatch/batch se política permitir novo par (produto: geralmente não — chat fechado é terminal).

- **GIVEN** slot liberado após `INACTIVE` (`platform-flow.mmd` `I` → `AP`)
- **WHEN** dispatch abre novo batch
- **THEN** prestador ainda não exposto MAY receber visibilidade e iniciar chat via nó `AR` → `D`.

- **GIVEN** prestador já exposto com proposta `REJECTED`
- **WHEN** acessa feed
- **THEN** SR MAY permanecer visível para nova proposta conforme matching Req. 5.8.

- **GIVEN** SR em marketplace fallback
- **WHEN** prestador elegível inicia chat
- **THEN** mesmas regras de slot e reciprocidade MUST aplicar.

- **GIVEN** tentativa de criar chat duplicado
- **WHEN** `UNIQUE(service_request_id, provider_id)` violado
- **THEN** MUST retornar chat existente com HTTP 200 e corpo idempotente.

---

## Requirement 30: Fallback Strategies & Degraded Operation

*User Story*: Como usuário em condições degradadas, quero continuar lendo histórico e enviar mensagens quando possível, com falhas explícitas.

### Acceptance Criteria

- **GIVEN** Realtime indisponível
- **WHEN** usuário está em chat ativo
- **THEN** app MUST fazer polling de fallback a cada 15s (máx.) apenas na conversa aberta; listagem global MUST NOT pollar agressivamente.

- **GIVEN** MMD indisponível
- **WHEN** mensagem é enviada
- **THEN** persistência de mensagem MUST suceder; notificação é perdida com log `NOTIFICATION_SKIPPED` — MUST NOT falhar envio.

- **GIVEN** hidratação de proposta falhou
- **WHEN** card dinâmico renderiza
- **THEN** fallback estático com `linked_entity_id` e link “Tentar novamente” MUST exibir.

- **GIVEN** Storage temporariamente indisponível
- **WHEN** upload de imagem
- **THEN** UI MUST permitir retry; mensagem de texto MUST permanecer disponível.

- **GIVEN** modo offline (`navigator.onLine === false`)
- **WHEN** usuário tenta aceitar proposta
- **THEN** MUST bloquear com mensagem clara — aceite MUST NOT ser otimista (concurrency Req. 3).

- **GIVEN** rate limit 429 em envio de mensagem
- **WHEN** recebido
- **THEN** UI MUST exibir `retry_after` e desabilitar envio temporariamente.

---

## Requirement 31: Security, Authorization & Data Leakage Prevention

*User Story*: Como participante, eu quero garantia de que apenas as partes da negociação acessam mensagens e propostas.

### Acceptance Criteria

- **GIVEN** política RLS em `chat_messages`
- **WHEN** usuário não participante consulta
- **THEN** zero linhas MUST retornar.

- **GIVEN** ação em card dinâmico (Accept)
- **WHEN** RPC executa
- **THEN** MUST revalidar que `auth.uid()` é o `client_id` do SR.

- **GIVEN** prestador A
- **WHEN** tenta ler chat do prestador B no mesmo SR
- **THEN** MUST falhar.

- **GIVEN** payload de mensagem com PII
- **WHEN** logado em Sentry
- **THEN** MUST ser scrubbed (sem conteúdo de mensagem em breadcrumbs).

- **GIVEN** signed URL de imagem
- **WHEN** expira
- **THEN** MUST retornar 403; cliente MUST refrescar URL via RPC.

- **GIVEN** dynamic message checklist §Permissions 88–91
- **WHEN** testado
- **THEN** todos MUST passar.

---

## Requirement 32: Transaction Coordination & Distributed Locking Summary

*User Story*: Como Principal Engineer, eu quero um mapa explícito de fronteiras transacionais para implementação correta.

### Acceptance Criteria

- **GIVEN** operação `send_message`
- **WHEN** executada
- **THEN** transação MUST incluir: insert mensagem, atualizar `last_interaction_at`, opcionalmente `ACTIVE` se `INACTIVE`, sem alterar SR.

- **GIVEN** operação `accept_proposal`
- **WHEN** executada
- **THEN** transação MUST incluir: lock SR, validar proposta, atualizar proposta, SR, todos chats concorrentes, todas propostas concorrentes, insert service, outbox events.

- **GIVEN** operação `submit_proposal`
- **WHEN** executada
- **THEN** transação MUST incluir: insert/update proposta, insert mensagem timeline, atualizar chat `last_interaction_at`.

- **GIVEN** duas transações competindo por slot
- **WHEN** contador atinge o limite configurado em `platform_constants` (`chats.max_active_slots_per_service_request`)
- **THEN** lock em linha `service_request_dispatch_slots` (ou contagem materializada) MUST serializar.

- **GIVEN** documentação de anti-padrões ([`concurrency-requirements.md`](../concurrency-requirements.md))
- **WHEN** revisão de código CNS
- **THEN** MUST NOT introduzir lock distribuído em Edge nem segunda fonte de verdade de status.

- **GIVEN** isolamento Read Committed
- **WHEN** aceite concorrente
- **THEN** `FOR UPDATE` no SR MUST prevenir double acceptance.

---

## Requirement 33: Dynamic Operational Limits via `platform_constants`

*User Story*: Como operador de produto, eu quero ajustar limites operacionais do chat (ex.: slots ativos por pedido) sem deploy de código, para calibrar o marketplace conforme aprendizado de conversão.

### Acceptance Criteria

- **GIVEN** tabela `public.platform_constants` (padrão já usado por MMD, ex.: `message_dispatcher.push_daily_limit`)
- **WHEN** o subsistema CNS é implantado
- **THEN** MUST existir seed `on conflict do update` para a chave `chats.max_active_slots_per_service_request` com valor jsonb numérico **4** e `description` em inglês documentando o efeito (máximo de chats `ACTIVE` simultâneos por `service_request_id`).

- **GIVEN** RPC `create_chat` / `initiate_chat` ou função auxiliar de slot
- **WHEN** avalia elegibilidade de novo prestador
- **THEN** MUST ler o limite via `SELECT (value #>> '{}')::int FROM platform_constants WHERE key = 'chats.max_active_slots_per_service_request'` (ou helper SQL compartilhado `platform_constant_int(p_key)`) **dentro da transação**, não via constante hardcoded no PL/pgSQL.

- **GIVEN** RPC de dispatch/matching que pausa batches por capacidade de chat
- **WHEN** compara contagem de chats `ACTIVE`
- **THEN** MUST usar a **mesma chave** `chats.max_active_slots_per_service_request` — MUST NOT duplicar limite em segundo parâmetro divergente.

- **GIVEN** operador atualiza `platform_constants.value` para `6` (via painel admin futuro ou SQL autorizado)
- **WHEN** próxima transação de criação de chat executa **sem redeploy**
- **THEN** o novo limite MUST aplicar imediatamente; RPCs em cache de prepared statement MUST NOT cachear o valor entre invocações (leitura por query a cada transação).

- **GIVEN** valor ausente, nulo, não numérico ou &lt; 1
- **WHEN** RPC lê a constante
- **THEN** MUST aplicar fallback documentado **4** e MUST registrar warning em log/audit operacional (`INVALID_PLATFORM_CONSTANT_FALLBACK`).

- **GIVEN** valor &gt; 50
- **WHEN** RPC lê a constante
- **THEN** SHOULD clampar a 50 com warning (proteção contra configuração acidental) — limite superior configurável por segunda chave opcional `chats.max_active_slots_upper_bound` MAY ser adicionado futuramente.

- **GIVEN** testes pgTAP do domínio chats
- **WHEN** executados
- **THEN** MUST existir cenário com seed `4`, cenário com override temporário para `2`, e assertiva de que a 3ª criação de chat `ACTIVE` falha.

- **GIVEN** documentação de matching ([`matching-algorithm/requirements.md`](../matching-algorithm/requirements.md) Req. 5.14)
- **WHEN** implementação convergir
- **THEN** referência ao número fixo **10** MUST ser substituída por leitura de `chats.max_active_slots_per_service_request` (default 4) para evitar divergência entre subsistemas.

- **GIVEN** checklist §4 item 51 (“limitar quantidade de chats ACTIVE”)
- **WHEN** produto altera política
- **THEN** MUST ser suficiente atualizar `platform_constants` (e documentação de negócio), sem alterar código TypeScript/Deno.

- **GIVEN** constantes relacionadas futuras (`chats.reciprocity_window_hours`, `chats.proposal_response_sla_hours`)
- **WHEN** parametrizadas
- **THEN** SHOULD seguir o mesmo padrão de chave prefixada `chats.*` em `platform_constants` para coesão operacional (MAY nesta fase; reciprocidade/SLA permanecem 24h hardcoded até migração explícita).

### Implementation note (seed SQL ilustrativo)

```sql
insert into public.platform_constants (key, value, description)
values (
  'chats.max_active_slots_per_service_request',
  '4'::jsonb,
  'Maximum concurrent ACTIVE chats per service request; pauses dispatch when reached'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();
```

---

## Traceability Matrix (Checklist → Requirements)

| Checklist § | Requirement(s) |
|-------------|----------------|
| §1 Estrutura geral 1–10 | 1, 2, 4, 11 |
| §2 Service Request 11–20 | 2, 7, 23, 24 |
| §3 Chat 21–50 | 3, 4, 11, 13, 18 |
| §4 Limites 51–60 | 4, 14, 33 |
| §5 Descoberta 61–70 | 5 |
| §6 Proposta 71–90 | 6, 16 |
| §7 Aceite 91–105 | 7, 23 |
| §8 Revisão 106–123 | 10 |
| §9 Expiração 124–134 | 9 |
| §11 Visual 148–162 | 16, 20 |
| §12 Responsividade 163–171 | 17, 18, 20 |
| §13 Acessibilidade 172–180 | 19, 20 |
| §14 Observabilidade 181–192 | 21 |
| chat-requirements-list 1–88 | 13, 17, 18, 19 |
| dynamic message list 1–111 | 16 |
| platform-flow.mmd | 1–11, 23–32 (transições e jobs) |
| Tipos NFR (scheduling, recovery, events, fallback, leasing) | 25–32 |
| Limites dinâmicos (`platform_constants`) | 33 |

---

## Implementation Guidance

A implementação MUST seguir arquitetura feature-based: `src/features/chats/` (nome ilustrativo) com `api/`, `hooks/`, `components/`, `types/`, `utils/`, `index.ts`. Componentes de UI existentes (`ProviderProposalComposerDialog`) MUST migrar para feature de proposta (`provider-proposals` ou similar) consumida pelo chat. Nenhum componente ou hook MUST chamar Supabase diretamente — apenas camada `api/`.

Fluxo de leitura: **TanStack Query** (paginação, Realtime invalidation). Fluxo de escrita crítica: **RPC** com retorno `{ data, error }` tipado. Jobs temporais: **pg_cron** invocando RPC; opcional Edge fina se precisar de métricas externas.

Orquestração visual de próxima ação: **hook** `useChatActionBannerState` derivado de queries de chat + proposta (sem regra de negócio no JSX).

### O que deve ficar no PostgreSQL

| Responsabilidade | Local |
|------------------|-------|
| Máquinas de estado (chat, proposal, SR) | Tabelas + enums + `CHECK` |
| Transições atômicas (aceite, cancelamento, encerramento em massa) | RPC `SECURITY DEFINER` |
| Slot counter / reciprocidade / expiração SLA | RPC + `pg_cron`; limite de slots lido de `platform_constants` |
| Limites operacionais configuráveis | `platform_constants` (`chats.max_active_slots_per_service_request`, default 4) |
| Mensagens e read receipts | Tabelas `chat_messages`, `chat_read_receipts` |
| Idempotency keys | `UNIQUE` constraints |
| Auditoria append-only | `*_audit` tables |
| RLS e isolamento tenant | Policies em todas as tabelas |
| Listagens paginadas | `list_conversations`, `list_chat_messages` |
| Fila de jobs inatividade/expiração | Tabela opcional `chat_scheduled_jobs` com `SKIP LOCKED` ou cron idempotente por `chat_id` |
| Ingestão de notificações | Chamada a `message_dispatcher.*` após commit (via RPC ou trigger controlado) |

### O que deve ficar na camada de aplicação

| Responsabilidade | Local |
|------------------|-------|
| Renderização UI (lista, tela, banner, cards dinâmicos) | `src/features/chats/components/` |
| Estado de tela, debounce, dismiss de banner | `src/features/chats/hooks/` |
| Cache, Realtime subscription, reconciliação | hooks + `src/lib/queryClient` |
| Validação de formulário (composer, revisão) | Zod em `types/` + RHF |
| Envio otimista e retry de mensagem | hooks (sem alterar status de proposta) |
| Navegação e guards de rota | `router.tsx` + auth public API |
| Analytics client-side | wrappers em hooks após confirmação server |

### O que deve ficar em Workers/Edge Functions

| Responsabilidade | Local |
|------------------|-------|
| Upload multipart de imagens de mensagem/proposta | Edge fina → Storage + RPC insert |
| Entrega MMD (push/e-mail) | `message-dispatcher-worker` (existente) |
| Renderização de template de notificação | Edge (CPU) pós-payload do DB |
| **Não** colocar: transições de estado, slot logic, aceite | — |

---

## Documentos relacionados

| Documento | Relação |
|-----------|---------|
| [`platform-flow.mmd`](../platform-flow.mmd) | Fluxo canônico de negócio |
| [`requirements-checklist.md`](./requirements-checklist.md) | Inventário de requisitos de produto |
| [`chat-requirements-list.md`](./chat-requirements-list.md) | UI/UX e comportamento técnico de mensagens |
| [`chat-list-item-component-design-spec.md`](./chat-list-item-component-design-spec.md) | Spec visual lista |
| [`chat-screen-component-design-spec.md`](./chat-screen-component-design-spec.md) | Spec visual tela |
| [`chat-action-banner-component-design-spec.md`](./chat-action-banner-component-design-spec.md) | Spec banner |
| [`chat-dynamic-action-message-component-design-spec.md`](./chat-dynamic-action-message-component-design-spec.md) | Spec mensagens dinâmicas |
| [`technical-stack.md`](../technical-stack.md) | Stack |
| [`scalability-requirements.md`](../scalability-requirements.md) | NFR escala |
| [`concurrency-requirements.md`](../concurrency-requirements.md) | NFR concorrência |
| [`infrastructure-constraints.md`](../infrastructure-constraints.md) | RPC vs Edge |
| [`matching-algorithm/requirements.md`](../matching-algorithm/requirements.md) | Dispatch e pausa por slots (alinhado via `platform_constants`) |
| [`message-dispatcher/requirements.md`](../message-dispatcher/requirements.md) | Notificações |

**Última atualização:** 2026-05-28 — compilado a partir dos checklists, design specs, platform-flow e restrições transversais do repositório.
