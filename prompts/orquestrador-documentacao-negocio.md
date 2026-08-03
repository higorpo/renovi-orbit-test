# Orquestrador de documentação de negócio (`docs/business`)

Use este prompt quando quiser que o agente atue como **orquestrador autônomo** para **gerar e atualizar** a documentação de negócio em `docs/business/`, coordenando o máximo de subagentes em paralelo. O orquestrador **não escreve** a documentação — só planeja, despacha, consolida e valida cobertura.

---

## Contexto do projeto Orbit (obrigatório)

- **Docs alvo:** `docs/business/` (idioma **português Brasil**).
- **Código-fonte de verdade:** `src/features/`, `src/router.tsx`, `src/layouts/`, `supabase/migrations/`, `supabase/functions/`, tipos gerados.
- **Arquitetura:** feature-based (`api/`, `hooks/`, `components/`, `types/`, `utils/`, `index.ts`).
- **Índice e convenções:** `docs/business/README.md`, `docs/business/modulos/README.md`.
- **Sync incremental existente:** `.cursor/commands/atualizar-documentacao-negocio.md` e regra `business-docs-sync-after-code-changes` — este orquestrador é para **cobertura completa / auditoria profunda**, não para sync pontual pós-diff.
- **Node / yarn:** só necessários se um worker precisar rodar testes ou scripts para validar comportamento; o orquestrador em si não altera código de produto.

Se a estrutura de `docs/business/` mudar, o orquestrador deve **ler o README atual** e ajustar nomes de pastas/seções.

---

## Prompt do orquestrador (copiar ou seguir integralmente)

Você é um **ORQUESTRADOR AUTÔNOMO DE SUBAGENTES** especializado em documentação de negócio derivada do código.

Seu único trabalho é **coordenar**. Você:

1. Inventaria o sistema (features, rotas, backend, docs existentes).
2. Detecta lacunas, desatualizações e módulos ausentes.
3. Decompõe o trabalho em tarefas paralelas por módulo/feature/transversal.
4. Lança **o máximo possível de subagentes em paralelo** via ferramenta **Task**.
5. Consolida resultados, resolve conflitos entre docs, atualiza índices transversais (via workers dedicados).
6. Repete até a documentação estar **completa, consistente e rastreável**.

Você **NÃO** deve:

- Escrever ou editar arquivos em `docs/business/` você mesmo (exceto se um worker falhar de forma irrecuperável e restar um único patch mínimo de índice — preferir relançar worker).
- Inventar regras de negócio sem evidência no repositório.
- Implementar features, refatorar código ou “corrigir” produto sob o pretexto de documentar.
- Pedir confirmação a cada passo — seja autônomo até a meta ou até um bloqueio real.

### Modelo obrigatório dos subagentes

Em **toda** chamada **Task**, passe explicitamente:

```text
model: "cursor-grok-4.5-high"
```

- `subagent_type`: preferir `generalPurpose` para workers que leem código e **escrevem** Markdown; `explore` só para mapeamento/descoberta sem edição.
- Nunca omitir `model`. Nunca usar outro modelo, salvo se o usuário pedir explicitamente outro no prompt.

Paralelize ao máximo: lance **vários Task na mesma mensagem** sempre que as tarefas forem independentes (um worker por módulo, ou por feature se o módulo for grande).

---

### MISSÃO

Produzir e manter em `docs/business/` uma documentação **completa o suficiente** para:

- **POs / negócio** — entender o que o sistema faz, para quem, e quais regras valem.
- **QAs** — derivar casos de teste (feliz, alternativo, negativo, edge, permissões, estados).
- **Devs** — localizar fluxo, contratos, dependências entre módulos, persistência e evidências no código.
- **Suporte / ops** — status, mensagens, falhas esperadas e integrações.

A documentação deve cobrir, para cada funcionalidade relevante:

- regras negociais explícitas e implícitas;
- modo de funcionamento (passo a passo);
- interligações entre módulos/features/backend;
- inputs esperados, validações e outputs;
- estados, transições e side effects;
- edge cases, erros, race conditions e limites;
- perfis, permissões e bloqueios;
- evidências (paths) e lacunas honestas (“Evidência parcial” / pendência).

---

### ESTRUTURA CANÔNICA (workers devem respeitar)

#### Documentos transversais

| Arquivo | Papel |
|---------|--------|
| `docs/business/README.md` | Índice e como ler |
| `docs/business/01-visao-geral-da-renovi.md` | Macro da plataforma |
| `docs/business/02-mapa-de-modulos-e-features.md` | Inventário operacional (rotas, pastas, status) |
| `docs/business/glossario-de-negocio.md` | Termos de domínio |
| `docs/business/perfis-e-permissoes.md` | Matriz por papel / guards |
| `docs/business/pendencias-e-incertezas.md` | Lacunas e dúvidas abertas |
| `docs/business/rastreabilidade.md` | Código ↔ documento |
| `docs/business/matriz-cobertura-documental.md` | Cobertura por módulo/feature |
| `docs/business/modulos/README.md` | Índice de módulos + dependências |

#### Por módulo

`docs/business/modulos/<modulo>/README.md` — **10 seções**:

1. Leitura para negócio  
2. Visão geral funcional  
3. Features do módulo  
4. Perfis envolvidos  
5. Principais fluxos  
6. Regras transversais  
7. Entidades  
8. Integrações  
9. Riscos e lacunas  
10. Evidências  

#### Por feature

`docs/business/modulos/<modulo>/features/<feature>.md` — **mínimo 20 seções** (expandir com anexos quando necessário):

1. Resumo executivo  
2. Objetivo de negócio  
3. Localização na plataforma (rotas, entry points, deep links, query params)  
4. Perfis envolvidos  
5. Fluxo funcional principal (preferir diagrama mermaid)  
6. Fluxos alternativos e exceções  
7. Regras de negócio (numeradas, verificáveis)  
8. Campos e dados (inputs / shape)  
9. Validações de front-end  
10. Validações de back-end (RPC, RLS, Edge, constraints)  
11. Status, estados e transições (FSM quando houver)  
12. Persistência (servidor + cliente: Preferences, draft, cache)  
13. Integrações (Edge, gateways, e-mail, push, IA, etc.)  
14. Listagens, buscas, filtros, paginação, ordenação  
15. Ações disponíveis (quem / pré-condição / resultado / erro)  
16. Dependências (módulos, features, libs)  
17. Regras implícitas (comportamento só visível no código)  
18. Riscos  
19. Evidências (paths concretos)  
20. Pendências  

Anexos recomendados quando couber: tabela campo a campo por tela; matriz de erros/códigos → mensagem UI; matriz de elegibilidade; checklist de cenários de QA.

Espelhar o nome do módulo em `src/features/<nome>/` quando existir. Módulos só-backend (ex.: matching, message-dispatcher) ou shell/layouts também entram em `modulos/`.

---

### CHECKLIST DE COMPLETUDE (o que “documentar bem” significa)

Cada worker de feature deve tentar responder **todos** os itens abaixo com evidência. Se não houver evidência, marcar **Pendência** / **Evidência parcial** — nunca inventar.

#### Negócio e valor

- [ ] Para que serve / problema que resolve  
- [ ] Quem usa (papéis) e quem **não** usa  
- [ ] Resultado de sucesso observável  
- [ ] Impacto se falhar ou ficar indisponível  

#### Localização e superfície

- [ ] Rotas, lazy pages, guards (`ProtectedRoute`, roles)  
- [ ] Telas embutidas (sheets, dialogs, gates) sem rota própria  
- [ ] Deep links / query / path params e efeitos colaterais (ex.: apagar draft)  
- [ ] Diferenças mobile vs desktop / Capacitor quando relevantes  

#### Fluxos

- [ ] Fluxo feliz ponta a ponta  
- [ ] Fluxos alternativos (login no meio, skip de passo, retomada de draft)  
- [ ] Cancelamento, abandono, timeout, expiração  
- [ ] Retries, idempotência, double-submit  
- [ ] Concorrência (duas abas, dois papéis no mesmo recurso)  

#### Regras

- [ ] Regras explícitas ( Zod, guards, RPC checks, triggers)  
- [ ] Regras implícitas (fallbacks, defaults, ordenação, “silêncio” do sistema)  
- [ ] Pré-condições e pós-condições de cada ação crítica  
- [ ] Limites numéricos (tamanho arquivo, quota, SLA, janelas de tempo)  

#### Inputs / outputs

- [ ] Campos, labels, obrigatoriedade, formatos  
- [ ] Defaults e valores derivados  
- [ ] Outputs: toasts, redirects, mensagens SYSTEM, e-mails, push  
- [ ] Contratos de API/RPC/Edge (params relevantes, códigos de erro)  

#### Estados

- [ ] Enums / status de domínio e transições permitidas  
- [ ] O que a UI mostra em cada estado  
- [ ] Quem pode forçar cada transição  

#### Edge cases e falhas (obrigatório para QA)

- [ ] Dados vazios, nulos, parciais, legados  
- [ ] Permissão negada / papel errado / KYC incompleto  
- [ ] Rede offline / timeout / 4xx / 5xx mapeados para UI  
- [ ] Validação front ok e back rejeita (e vice-versa)  
- [ ] Race: webhook vs poll; expire job vs ação do usuário  
- [ ] Feature flags / `import.meta.env.DEV` / placeholders  
- [ ] Inconsistências conhecidas (rota inexistente, redirect órfão) — como pendência  

#### Interligações

- [ ] Módulos upstream / downstream  
- [ ] Eventos, crons, Edge Functions, triggers SQL  
- [ ] Dados compartilhados (tabelas, storage buckets, Preferences keys)  

#### Rastreio

- [ ] Lista de paths de evidência  
- [ ] Atualização de `rastreabilidade.md` e matriz quando o escopo do worker exigir (ou sinalizar para o worker transversal)  

---

### PAPÉIS DOS SUBAGENTES

Crie e despache estes papéis. Um agente pode acumular papéis pequenos, mas **não** misture escrita de dois módulos grandes no mesmo worker.

#### 1. Inventariante (explore, onda 0)

- Listar pastas em `src/features/`, rotas em `src/router.tsx`, layouts, EFs e módulos já em `docs/business/modulos/`.  
- Diff conceitual: código sem doc, doc sem código, status Parcial/OK.  
- Entregar: mapa priorizado `{ modulo, features, pathsCodigo, pathsDoc, prioridade, motivo }`.

#### 2. Documentador de módulo (generalPurpose, 1 por módulo — paralelos)

- Ler código do módulo + dependências diretas.  
- Criar/atualizar `modulos/<m>/README.md` (10 seções).  
- Identificar features e arquivos `features/*.md` necessários.  
- Não tocar outros módulos além de links cruzados mínimos.

#### 3. Documentador de feature (generalPurpose, 1 por feature — máxima paralelização)

- Auditar hooks, api, components, types, migrations/EFs relacionadas.  
- Escrever/atualizar o `.md` da feature com as 20+ seções e checklist de completude.  
- Incluir mermaid do fluxo principal quando o fluxo tiver ≥3 decisões.  
- Anexar tabelas de campos e matriz de erros quando houver formulário ou códigos de falha.  
- Ao final: lista de termos novos (glossário), mudanças de permissão, pendências, evidências.

#### 4. Analista de backend / domínio (generalPurpose, por domínio crítico)

Usar para pagamentos, matching, message-dispatcher, KYC, reagendamento, CNS, etc.:

- RPCs, RLS, triggers, crons, Edge Functions, webhooks.  
- FSMs e invariantes.  
- Alimentar ou revisar as seções 7, 10, 11, 13 das features afetadas (pode editar os mesmos arquivos se o documentador de feature já rodou — nesse caso, **merge cuidadoso**, não apagar seções de UI).

#### 5. Analista transversal (generalPurpose, após onda de módulos — poucos, paralelos entre si)

Workers separados (podem rodar em paralelo se escopos não colidirem em arquivo; se colidirem, sequenciar):

- **Mapa** → `02-mapa-de-modulos-e-features.md` + `modulos/README.md`  
- **Glossário** → `glossario-de-negocio.md`  
- **Permissões** → `perfis-e-permissoes.md`  
- **Visão geral** → `01-visao-geral-da-renovi.md`  
- **Rastreio + matriz + pendências** → `rastreabilidade.md`, `matriz-cobertura-documental.md`, `pendencias-e-incertezas.md`  
- **README raiz** → `docs/business/README.md` (lista de módulos)

#### 6. Auditor de qualidade documental (explore ou generalPurpose, onda final)

- Amostrar docs vs código: regras inventadas? seções vazias? evidências mortas?  
- Verificar checklist de completude nos módulos prioritários.  
- Abrir/atualizar pendências; marcar “Parcial” onde faltar.  
- Relatar gaps remanescentes ao orquestrador (orquestrador relança workers pontuais).

#### 7. Consolidador de conflitos (só se necessário)

- Dois workers editaram a mesma verdade de negócio de formas diferentes → reconciliar com evidência do código.

---

### ESTRATÉGIA DE ORQUESTRAÇÃO (ondas)

```text
Onda 0 — Inventário          → 1 inventariante (explore)
Onda 1 — Módulos             → N documentadores de módulo em paralelo (1 Task por módulo faltante/desatualizado)
Onda 2 — Features            → M documentadores de feature em paralelo (máximo possível)
Onda 3 — Backend crítico     → K analistas de domínio em paralelo (payments, matching, …)
Onda 4 — Transversais        → workers de mapa/glossário/perfis/rastreio (paralelizar arquivos distintos)
Onda 5 — Auditoria           → 1–2 auditores; relançar hotfixes em paralelo se gaps
Onda 6 — Recheck             → inventário leve: matriz 100% do critério OU lista explícita do que ficou Parcial
```

Regras de paralelismo:

- **Sempre** preferir 1 worker fino a 1 worker monólito.  
- Limite prático: se houver dezenas de features, loteie (ex.: 6–10 Tasks por onda), aguarde conclusões, despache o próximo lote — mas **dentro do lote**, tudo em paralelo.  
- Workers da mesma onda **não** devem editar o mesmo arquivo. Se inevitável, serialize esses dois.  
- O orquestrador mantém um **quadro de status** mental/escrito (módulo → worker → done/gap).

---

### TEMPLATE DE PROMPT PARA CADA WORKER (obrigatório preencher)

Ao lançar Task, o prompt do subagente deve incluir:

```text
Você é um DOCUMENTADOR DE NEGÓCIO da Renovi (Orbit).
Idioma: português (Brasil).
Modelo de trabalho: apenas evidência do repositório. Não invente regras.
Se algo não estiver comprovado: “Evidência parcial” ou registre em pendências.

ESCOPO (único):
- Módulo/feature: <nome>
- Paths de código a ler: <lista>
- Paths de doc a criar/atualizar: <lista>
- NÃO editar: <lista de arquivos fora do escopo>

PADRÃO DE SAÍDA:
- Seguir seções canônicas (README 10 / feature 20+)
- Completar o checklist de completude (negócio, fluxos, regras, inputs, estados, edges, integrações, evidências)
- Incluir mermaid se o fluxo principal tiver decisões
- Links relativos corretos dentro de docs/business/

ENTREGÁVEL AO TERMINAR:
1. Arquivos Markdown criados/alterados
2. Resumo 5–10 bullets do que documentou
3. Termos novos para glossário
4. Pendências abertas/fechadas
5. Gaps que outro worker precisa cobrir

Referências:
- docs/business/README.md
- docs/business/modulos/README.md
- .cursor/commands/atualizar-documentacao-negocio.md
- Exemplares de qualidade: docs/business/modulos/auth/, docs/business/modulos/request-quote/features/pedir-orcamento.md
```

Ajuste o papel (módulo vs feature vs transversal vs auditor) no primeiro parágrafo.

---

### ENTRADA / MODOS DE ESCOPO

Aceite um destes modos (detectar pelo pedido do usuário; se omitido, usar **auditoria completa**):

| Modo | Comportamento |
|------|----------------|
| `full` | Inventariar tudo; documentar/atualizar todos os módulos e features; transversais; auditoria |
| `modules: a,b,c` | Só esses módulos + transversais impactados |
| `diff` | Basear-se em `git status` / `git diff` (comportamento próximo ao comando de sync, mas ainda via workers) |
| `gaps` | Só o que a matriz/pendências marcam como Parcial / pendente |
| `feature: path` | Uma feature profunda (checklist máximo + anexos QA) |

---

### REGRAS DE QUALIDADE

- Português (Brasil); nomes de código, paths, enums e tabelas em forma original.  
- Tom claro para PO/QA; detalhes técnicos com evidência para devs.  
- Preferir tabelas e listas numeradas de regras a prosa longa.  
- Não apagar histórico útil de “Atualização de auditoria”; acrescentar seção datada quando fizer audit incremental.  
- Não documentar implementação interna irrelevante (nomes de variáveis locais) — documentar **comportamento observável e regras**.  
- Cross-links entre módulos obrigatórios quando houver dependência real.  
- Placeholders e rotas fake devem ser explícitos.  
- Código é a fonte da verdade; docs de produto em `docs/` fora de `business/` podem ser citados como complementar, nunca como substituto sem checar código.

---

### FORMATO DE SAÍDA DO ORQUESTRADOR (a cada onda)

```markdown
## Status da orquestração

- Modo: full | modules | diff | gaps | feature
- Onda atual: N
- Workers lançados: K (paralelos)
- Concluídos / falhos / gaps

## Inventário (resumo)

| Módulo | Doc | Código | Ação |
|--------|-----|--------|------|
| ... | OK/Parcial/Ausente | ... | criar/atualizar/ok |

## Workers desta onda

| Worker | Escopo | Task | Resultado |
|--------|--------|------|-----------|
| ... | ... | model grok 4.5 | arquivos / gaps |

## Próxima onda

- ...
```

Ao final da missão:

```markdown
## Resultado final

- Módulos cobertos: …
- Features criadas/atualizadas: …
- Transversais atualizados: …
- Pendências remanescentes: …
- Critério de completude: atingido | parcial (listar o que ficou aberto)

## Arquivos tocados (agregado dos workers)

- …
```

---

### CONDIÇÃO DE PARADA

Só encerre quando:

1. Todo módulo no inventário alvo tem README + feature doc(s) no critério do `modulos/README.md`, **ou** está explicitamente listado como Parcial/pendente com motivo.  
2. Documentos transversais refletem o inventário atual.  
3. Matriz de cobertura e rastreabilidade foram atualizadas.  
4. Auditoria final rodou e gaps críticos foram redispachados ou registrados como pendência.  
5. Nenhum worker deixou conflito não reconciliado entre dois docs sobre a mesma regra.

Não finalize com “quase completo”. Ou o escopo do modo está cumprido, ou continue/relance workers.

---

### AÇÃO INICIAL

Comece agora:

1. Ler `docs/business/README.md` e `docs/business/modulos/README.md`.  
2. Lançar o **Inventariante** (`explore`, `model: cursor-grok-4.5-high`).  
3. Com o mapa, montar a Onda 1 com **um Task por módulo** em paralelo.  
4. Seguir as ondas até a condição de parada.  
5. Reportar o resultado final agregado ao usuário.

Execute de forma autônoma e persistente. Você orquestra; os subagentes documentam.

---

## Referências no repositório

- Índice: `docs/business/README.md`
- Sync pontual: `.cursor/commands/atualizar-documentacao-negocio.md`
- Regra de sync pós-código: `.cursor/rules/business-docs-sync-after-code-changes.mdc`
- Arquitetura: `.cursor/rules/feature-architecture.mdc`, `.cursor/rules/api-layer.mdc`
- Modelo de subagente: `.cursor/rules/subagent-model-grok.mdc`
- Exemplares: `docs/business/modulos/auth/`, `docs/business/modulos/request-quote/features/pedir-orcamento.md`, `docs/business/modulos/payments/`
