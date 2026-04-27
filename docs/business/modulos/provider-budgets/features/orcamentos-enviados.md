# Orçamentos enviados e perguntas (prestador)

Documentação baseada em `src/features/provider-budgets/`, RPCs em `supabase/migrations/20260322000000_create_provider_budgets_rpcs.sql` e reutilização de UI em `src/features/provider-jobs/`.

---

## 1. Visão geral

| Item | Descrição |
|------|-----------|
| **Objetivo** | Painel **pós-envio**: acompanhar **propostas já enviadas** (`provider_proposals`) e **perguntas** feitas aos clientes (`provider_service_request_questions`), com filtros, busca, paginação e contadores de pendências. |
| **Quem usa** | Prestador autenticado (`profiles.role = 'provider'` exigido nas RPCs). |
| **Contexto** | Complementa **Trabalhos** (`provider-jobs`): descoberta e envio de orçamento/pergunta; aqui o foco é **follow-up**. |
| **Dependências** | `provider-jobs` — `JobDetailSheet`, `JobDetailPage`, tipos `ProviderJobItem`, `jobDetailPathFromBudgets`, `getJobDetailReturnNavigation`; `request-quote` — fotos do pedido e estilo do card de serviço. |

**O módulo não cria** nova proposta nem pergunta: isso permanece em `provider-jobs` no detalhe do pedido.

---

## 2. Telas e rotas

| Rota | Comportamento |
|------|----------------|
| `/dashboard/budgets` | Lista (`ProviderBudgetsPage`) com abas Enviados / Perguntas |
| `/dashboard/budgets/pedido/:serviceRequestId` | Detalhe do pedido: **sheet** se `location.state.jobDetailPresentation === "sheet"` (fluxo normal a partir dos cards); senão **página cheia** |

**Shell:** `ProviderBudgetsShell.tsx` — espelha a lógica de `ProviderJobsShell`: lista visível quando não há `serviceRequestId` ou quando o detalhe é sheet; monta `JobDetailSheet` / `JobDetailPage` de `@/features/provider-jobs`.

**Guard:** `src/router.tsx` — `ProtectedRoute` com `allowedRoles={['provider']}`.

**Link dos cards:** `jobDetailPathFromBudgets(id)` →  
`/dashboard/budgets/pedido/{id}?from=budgets`  
(`JOB_DETAIL_FROM_PARAM` / `JOB_DETAIL_FROM_BUDGETS_VALUE` em `jobDetailReturnNavigation.ts`).  
Isso alimenta **“Voltar para Orçamentos”** e textos de 404 no detalhe.

---

## 3. Estrutura da página principal

### 3.1 Cabeçalho (`BudgetsHeader.tsx`)

- Título: **Orçamentos**
- Subtítulo: *"Acompanhe os orçamentos que você enviou e as perguntas feitas aos clientes"*
- **Contador 1:** orçamentos com status `submitted` (aguardando decisão do cliente) — **independente dos filtros da lista** (`useProviderPendingApprovalBudgetsCount`).
- **Contador 2:** perguntas “pendentes” — `useProviderPendingQuestionsCount` chama a mesma RPC com `questionStatus: "pending"` e `pageSize: 1`; exibe linha em destaque só se `count > 0` ou erro.
- Erro em contador: texto *"— orçamentos (indisponível)"* / *"— perguntas (indisponível)"*.

### 3.2 Abas (`Tabs`)

| Aba | Valor técnico | Badge no trigger |
|-----|---------------|------------------|
| Enviados | `enviados` | `totalCount` da query de orçamentos (primeira página agregada na infinite query) |
| Perguntas | `perguntas` | Idem para perguntas |

**Ao trocar de aba:** `resetFilters()` — volta status de orçamento para **submitted**, pergunta para **pending**, limpa busca (`ProviderBudgetsPage.tsx`).

### 3.3 Filtros e busca (`BudgetsFilterChips` + `useProviderBudgetsFilters`)

| Controle | Detalhe |
|----------|---------|
| Chips de status (Enviados) | `submitted` → *Aguardando*; `accepted` → *Aceitos*; `rejected` → *Recusados*; `withdrawn` → *Retirados* (`BUDGET_STATUS_FILTERS`) |
| Chips de status (Perguntas) | `pending` → *Aguardando*; `answered` → *Respondidas* (`QUESTION_STATUS_FILTERS`) |
| Busca | `Input` placeholder *"Buscar..."*; debounce **400 ms** (`useDebouncedValue`) antes de enviar `p_search` à RPC |
| Padrões | `DEFAULT_BUDGET_STATUS_FILTER = "submitted"`; `DEFAULT_QUESTION_STATUS_FILTER = "pending"` (`provider-budgets.types.ts`) |
| `hasActiveFilters` | Diferente dos defaults **ou** texto de busca não vazio |

**Não há chip “Todos”** no front: sempre um status de orçamento e um de pergunta ativos.

### 3.4 Listagem e paginação

- Hooks: `useProviderSentBudgets`, `useProviderOwnQuestions` — `useInfiniteQuery`, **page size 20**, `staleTime` 60s, `refetchOnWindowFocus: false`.
- **As duas queries rodam sempre** na montagem da página (não há `enabled` por aba), para alimentar badges e contadores de header.
- **Erro / vazio / load more:** apenas da aba ativa (`BudgetsTabContent`).
- **Carregar mais:** `LoadMoreButton`.

---

## 4. RPCs e parâmetros (evidência SQL + API)

### 4.1 `list_provider_sent_budgets`

| Parâmetro (app → RPC) | Nome SQL | Uso no front |
|------------------------|----------|--------------|
| `page` | `p_page` | `pageParam` da infinite query |
| `pageSize` | `p_page_size` | Fixo **20** |
| `status` | `p_status` | Sempre um dos: `submitted`, `accepted`, `rejected`, `withdrawn` |
| `search` | `p_search` | `null` se busca vazia após trim |

**Filtro SQL:** `(p_status IS NULL OR pp.status = p_status)` — o app hoje **sempre** envia status (nunca `null`).

**Busca textual (LOWER LIKE):** título do pedido (`sr.title`), título do serviço (`ps.title`), bairro (`ca.neighborhood`), cidade (`pc.name`), primeiro nome derivado do cliente (mesma lógica de máscara).

**Ordenação:** `pp.created_at DESC`.

**Segurança:** `SECURITY DEFINER`; `auth.uid()` = prestador; exige `profiles.role = 'provider'`; senão exceção *"Apenas prestadores podem listar orçamentos enviados"*.

**Resposta:** `{ items, total_count, page, page_size }` como `jsonb` (parseado no cliente como `PaginatedResponse`).

### 4.2 `list_provider_own_questions`

| Parâmetro | Nome SQL | Uso no front |
|-----------|----------|--------------|
| `page` | `p_page` | Idem |
| `pageSize` | `p_page_size` | **20** |
| `questionStatus` | `p_question_status` | `pending` ou `answered` |
| `search` | `p_search` | Idem |

**Mapeamento de status derivado (comentário + SQL):**

| `p_question_status` | Condição |
|---------------------|----------|
| `pending` | `client_response IS NULL` **e** `sr.status = 'open'` |
| `answered` | `client_response IS NOT NULL` **e** `sr.status = 'open'` |
| `closed` | `sr.status IN ('in_progress', 'closed', 'cancelled')` |

**UI:** só expõe **pending** e **answered**. O filtro **`closed` existe na RPC mas não tem chip** — perguntas cujo pedido saiu de `open` **não aparecem** nas abas *Aguardando* nem *Respondidas* (a menos que o front passasse `closed` ou `NULL`, o que não faz).

**Busca:** inclui também `LOWER(q.question)`.

**Campo `has_proposal`:** `EXISTS` em `provider_proposals` para o mesmo prestador e pedido com `status != 'withdrawn'`.

**Ordenação:** `q.created_at DESC`.

---

## 5. Tipos retornados (campos úteis na UI)

### `ProviderSentBudget`

Orçamento + contexto do pedido: `proposed_amount`, `proposal_description`, `status`, taxas, `final_amount`, `photos`, `client_rejection_response`, ids e metadados de `service_request_*`, `service_*`, localização, `masked_client_name`.

### `ProviderOwnQuestion`

`question`, `client_response`, datas, mesmo bloco de pedido/serviço/localização, `has_proposal`.

Definição completa: `types/provider-budgets.types.ts`.

---

## 6. Cards e navegação

### `BudgetCard`

- Link principal + botão **Ver detalhes** → rota `jobDetailPathFromBudgets` com `state`: `job: initialProviderJobItemFromSentBudget(budget)`, `jobDetailPresentation: "sheet"`.
- Exibe: serviço, título do pedido, descrição (clamp), local, cliente mascarado, *"Enviado {data relativa}"*, valor proposto (BRL), strip de fotos do pedido, badge de status (`BUDGET_STATUS_CONFIG`).

### `QuestionCard`

- **Ver pedido** + área clicável — mesma rota/state com `initialProviderJobItemFromOwnQuestion`.
- Blocos *"Sua pergunta"*, opcional *"Resposta do cliente"*, aviso se `has_proposal`, fotos do pedido.
- Badge via `getQuestionStatusLabel` (combina `service_request_status` e presença de resposta — ver `budgetStatus.ts`).

### Mapeamento para o detalhe (`initialProviderJobItem.ts`)

- Preenche `ProviderJobItem` com placeholders para campos que a RPC de orçamentos/perguntas não traz (`form_data`/`form_schema` nulos, `distance_km: 0`, etc.).
- Orçamento: `proposal_count` fixo `MAX_PROPOSALS_PER_REQUEST` (3), `is_latest_provider_proposal: true`.
- Pergunta sem proposta: `provider_proposal_id` e campos de proposta nulos.

---

## 7. Labels de status na UI

### Orçamento (`BUDGET_STATUS_CONFIG`)

| Status | Label |
|--------|--------|
| submitted | Aguardando avaliação |
| accepted | Aceito |
| rejected | Recusado |
| withdrawn | Retirado |

### Pergunta (`getQuestionStatusLabel`)

| Situação | Label |
|----------|--------|
| `sr.cancelled` | Pedido cancelado |
| `sr.closed` | Pedido encerrado |
| `sr.in_progress` | Pedido em andamento |
| Com `client_response` | Respondida |
| Caso contrário | Aguardando resposta |

`resolveQuestionStatus` agrega `pending` | `answered` | `closed` para lógica — usado em testes/constantes; filtros da lista usam apenas pending/answered na prática.

---

## 8. Mensagens e estados de lista

| Estado | Componente | Texto principal |
|--------|------------|-----------------|
| Erro | `BudgetsErrorState` | *"Erro ao carregar dados"* / *"Não foi possível buscar seus orçamentos..."* |
| Vazio com filtros | `BudgetsEmptyState` | *"Nenhum resultado encontrado"* + limpar filtros |
| Vazio Enviados | idem | *"Você ainda não enviou nenhum orçamento"* |
| Vazio Perguntas | idem | *"Você ainda não enviou nenhuma pergunta"* |

Erros de query genéricos nos hooks: *"Erro ao buscar orçamentos"* / *"Erro ao buscar perguntas"* (throw da `queryFn`).

---

## 9. APIs e arquivos

| Camada | Arquivo |
|--------|---------|
| RPC wrapper | `api/providerBudgets.api.ts` — `fetchProviderSentBudgets`, `fetchProviderOwnQuestions` |
| Hooks lista | `hooks/useProviderSentBudgets.ts`, `useProviderOwnQuestions.ts` |
| Hooks contadores | `useProviderPendingApprovalBudgetsCount.ts`, `useProviderPendingQuestionsCount.ts` |
| Filtros | `hooks/useProviderBudgetsFilters.ts` |
| Página | `components/ProviderBudgetsPage.tsx` |
| Shell | `components/ProviderBudgetsShell.tsx` |
| Constantes de label | `constants/budgetStatus.ts` |

---

## 10. Fluxo operacional

1. Prestador abre **Orçamentos** no menu do dashboard.
2. Vê resumo de pendentes no header e escolhe aba.
3. Refina com chips de status e busca (debounced).
4. Abre card → sheet de detalhe reutilizando `provider-jobs` (proposta/perguntas conforme estado do pedido).
5. Volta pela navegação com `from=budgets` para lista de orçamentos.

---

## 11. Tabelas e entidades

- **`provider_proposals`** — linhas do prestador com joins a `service_requests`, `platform_services`, endereço, cliente (máscara).
- **`provider_service_request_questions`** — idem.
- Leitura indireta de **`profiles`**, **`client_addresses`**, **`platform_cities`**, **`platform_states`** via RPCs `SECURITY DEFINER`.

---

## 12. Evidências

- `src/features/provider-budgets/**/*`
- `src/router.tsx` — rotas `budgets` aninhadas
- `src/features/provider-jobs/constants/jobDetailReturnNavigation.ts`
- `supabase/migrations/20260322000000_create_provider_budgets_rpcs.sql`

---

## 13. Lacunas e observações

| Item | Observação |
|------|------------|
| Filtro `closed` em perguntas | Implementado na RPC, **sem** chip na UI — perguntas ligadas a pedidos `in_progress` / `closed` / `cancelled` podem **sumir** das duas abas atuais. |
| Duas queries sempre ativas | Lista de aba inativa também consome rede; intencional para badges. |
| Detalhe “completo” | `initialProviderJobItem` não traz formulário dinâmico do pedido; detalhe pode refetch via RPC de job do `provider-jobs`. |

---

## 14. Diagrama

```mermaid
flowchart LR
  P[ProviderBudgetsPage] --> R1[list_provider_sent_budgets]
  P --> R2[list_provider_own_questions]
  C[BudgetCard / QuestionCard] --> D[/budgets/pedido/:id]
  D --> J[JobDetailSheet JobDetailPage]
```

## 15. Atualização de auditoria (2026-04-27)

- **Filtros padrão da página:** enviados inicia em `submitted` e perguntas em `pending`; trocar de aba reseta filtros e busca.
- **Busca textual com debounce de 400 ms:** só depois desse intervalo o valor é enviado como `p_search` para as RPCs.
- **Paginação operacional do front:** `page_size = 20` em ambas as listas com infinite query.
- **Badge/contadores independem da aba ativa:** as duas queries são executadas na montagem para alimentar contagem e resumo no header.
