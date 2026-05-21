# Multichannel Message Dispatcher Requirements

## Context

O objetivo do sistema Multichannel Message Dispatcher é fornecer uma infraestrutura centralizada, resiliente e escalável para o orquestramento e envio de notificações transacionais e de engajamento aos usuários finais da plataforma. O sistema resolve o problema operacional de fragmentação de comunicação, garantindo que o envio de mensagens multicanal (inicialmente E-mail via Resend e Push Notifications via Firebase Cloud Messaging - FCM) seja unificado sob um único workflow de execução controlada. 

Os objetivos de negócio incluem assegurar a entrega confiável de comunicações críticas, melhorar a retenção através de push notifications agendadas e proteger os usuários contra fadiga de notificações via políticas rigorosas de rate-limiting. Tecnicamente, o objetivo é orquestrar esse processo através de um modelo *database-centric*, minimizando a dependência de serviços externos stateful de orquestração e maximizando o uso nativo do PostgreSQL (Supabase) via RPCs e Row Level Security, delegando a camada de I/O de rede (chamadas a APIs de terceiros) para as Edge Functions de forma stateless e temporária.

As restrições operacionais impõem que o sistema opere exclusivamente na stack existente (Supabase, PostgreSQL, Edge Functions, pg_cron), exigindo estratégias de *queueing* dentro do próprio banco de dados (ex: table-based queues com `SKIP LOCKED`). O comportamento esperado do sistema é ser estritamente determinístico, lidando com picos de requisições de forma elástica, assegurando garantias *at-least-once* de processamento (com safe fallbacks para *at-most-once* baseados em expiração de lease), tolerância a falhas parciais, mecanismos de *retry* com *exponential backoff* e cancelamento seguro de execuções pendentes. 

## Assumptions

*   A infraestrutura principal operacional e transacional é baseada no Supabase (PostgreSQL 15+).
*   A execução de processos pesados, validação de regras de negócios, controle de concorrência e *state transitions* ocorrem via PostgreSQL RPCs (PL/pgSQL).
*   A comunicação com provedores externos (FCM, Resend) ocorre exclusivamente via Supabase Edge Functions (Deno).
*   O controle de workers e invocação assíncrona é gerenciado via `pg_cron` no Supabase e Supabase Edge Functions (e.g., webhook de trigger ou pg_net).
*   Mecanismos de fila são implementados no PostgreSQL utilizando tabelas transacionais combinadas com `SELECT ... FOR UPDATE SKIP LOCKED` para garantir isolamento concorrente sem gargalos de concorrência e race conditions.
*   O mecanismo transacional padrão obedece ao isolamento *Read Committed* do PostgreSQL, utilizando lock pessimista a nível de linha nas fases de *checkout* da fila de envio.
*   A arquitetura é *stateless* na camada de Edge Functions; todo o estado da execução (inclusive *leases* e metadados de *retry*) é persistido no banco de dados.
*   Os provedores externos fornecem garantias de webhook ou endpoints de consulta para reconciliação do status de entrega (delivery status/bounces).
*   O sistema adota UUIDs (v4 ou v7) como chaves primárias e *idempotency keys* obrigatórias nas transições de estado para evitar execuções duplicadas.
*   Mecanismos de *rate limiting* e limites de envio (ex: 20 push/dia, 5 emails/dia, *cool-down period* de 20 min) são validados a nível de banco de dados *antes* do agendamento ou inserção na fila de processamento ativo.
*   O processamento e compilação de templates dinâmicos de HTML ou payloads de push ocorrem preferencialmente na camada de Edge Functions (em runtime de execução), operando sob dados serializados enviados a partir do DB.

## Operational Phases

1.  **Ingestion & Validation Phase**: Recebimento do request de notificação, validação do payload multicanal e geração da *Idempotency Key*.
2.  **Eligibility & Rate-Limiting Phase**: Avaliação transacional temporal das cotas do usuário, checagem de restrições globais ou diárias e *cool-down periods*.
3.  **Scheduling Phase**: Cálculo do tempo de disparo e persistência na base no estado apropriado para agendamento temporal (se agendamento no futuro).
4.  **Queue Dispatching Phase**: Transição de mensagens elegíveis no domínio de tempo atual para o estado pronto para fila de captação.
5.  **Execution Checkout Phase**: Aquisição concorrente exclusiva (*pessimistic locking*) da mensagem na fila por um *worker* instanciado da Edge Function.
6.  **Delivery & Compile Phase**: Resolução do *template*, substituição de variáveis e execução da requisição HTTP(S) para o destino alvo (Resend ou FCM).
7.  **Reconciliation Phase**: Captura da resposta da API externa (síncrona) ou webhook de *report* (assíncrona), efetuando auditoria transacional de sucessos.
8.  **Retry & Fallback Phase**: Manipulação de códigos de falha para transição baseada em erro operacionais de *backoff* exponencial e/ou descarte definitivo de falhas terminais.

## State Machine

*   `PENDING_EVALUATION`
*   `SCHEDULED`
*   `CANCELED`
*   `QUEUED`
*   `PROCESSING`
*   `DELIVERED`
*   `FAILED_RETRYABLE`
*   `FAILED_TERMINAL`

### State Definitions

*   **PENDING_EVALUATION**: Estado inicial e transitório. A mensagem foi aceita e aguarda validação transacional e liberação através de checagem de *rate limits* e cotas.
*   **SCHEDULED**: Estado de pausa no *timeline*. A mensagem preenche as validações mas possui uma exigência de *delay* ou disparo numa data futura. Permanece adormecida.
*   **CANCELED**: Estado terminal intencional. A mensagem foi abortada e cancelada na plataforma por uma requisição API antes do seu *checkout* executável.
*   **QUEUED**: Estado transitório aberto. A mensagem atendeu todos os critérios temporais e operacionais, tornando-se disponível e elegível para extração concorrente (polling de workers).
*   **PROCESSING**: Estado concorrente de execução. O registro sofreu *lock* e foi adquirido por uma Edge Function. O registro possui temporariamente um *lease/ownership* bloqueando de outras *threads*.
*   **DELIVERED**: Estado terminal de sucesso operacional. As confirmações do provedor (ACK, síncronas ou via webhook assíncronos) atestam envio.
*   **FAILED_RETRYABLE**: Estado de *retry/backoff*. Erro transiente de rede/servidor (timeouts, 503, 429) ocorreu. A notificação aguarda transição da punição exponencial temporal para o retorno a `QUEUED`.
*   **FAILED_TERMINAL**: Estado terminal de erro permanente. O fluxo encontrou *hard bounces*, bad requests irrecuperáveis, *limit max retry* estourado, impossibilitando qualquer nova interação sem intervenção manual.

## Operational Architecture Constraints

*   **Execution Model**: O ciclo de vida e a governança dos dados MUST ser orquestrados unicamente através de PostgreSQL functions. Edge Functions SHALL ser *dumb endpoints*, utilizadas apenas como intermediários I/O (rede).
*   **Persistence Strategy**: Todo pedido de disparo de notificação MUST ser persistido em disco via operação ACID (banco de dados PostgreSQL) originando o ciclo transacional desde o instante zero (Write-Ahead approach).
*   **Concurrency Control**: O mecanismo de consumo de mensagens pendentes pelas Edge Functions MUST utilizar cláusulas SQL `SELECT ... FOR UPDATE SKIP LOCKED` para viabilizar um isolamento concorrente absoluto onde dois ou mais workers executando nunca puxam a mesma mensagem.
*   **Ownership Semantics**: Transições da fase `QUEUED` para a fase `PROCESSING` MUST injetar um `locked_until` (ex: `now() + interval '30 seconds'`), estabelecendo locação/ownership temporal (lease) estrito.
*   **Idempotency**: Transações API iniciadoras MUST exigir um token UUID gerado pelo cliente ou *consumer service* (`idempotency_key`), processado via constraint `UNIQUE`, prevenindo duplicidade de inserção sob condição de falha ou requisição dupla na ingestão.
*   **Restart Safety / Resumable Execution**: O sistema MUST garantir que não haverá perda ou retenção de mensagens se houver crash da Edge Function. O estado é garantido pelo `locked_until` não renovado, o qual ao expirar reabilita o processo (*orphan recovery*).
*   **Retry Mechanisms**: Erros 429 e 5XX nas APIs de Resend e FCM SHALL desencadear fallback para `FAILED_RETRYABLE`. A política arquitetural obedece um algoritmo configurável de *Exponential Backoff* antes de recolocar o *lease* expirado para *QUEUED*.
*   **Rate Limiting Guarantees**: A verificação das regras temporais globais (limites diários, intervalos de resfriamento como 20min de cooldown em push) MUST ser verificada transacionalmente utilizando serialização ou locking adequado na tabela de registros do usuário alvo prevenindo violações causadas por múltiplas transações rodando paralelas.
*   **Stateless Constraints**: Em estrito acordo com design de Edge Functions, não SHALL haver manutenção ou verificação de memória/cache (RAM de funções), devendo sempre resolver informações da origem unificada da verdade (banco relacional).
*   **Atomic Orchestration Semantics**: Toda mudança de estado da máquina (ex. de `PROCESSING` para `DELIVERED` e escrita no arquivo de auditoria) MUST ocorrer atomicamente numa transação PostgreSQL, a fim de assegurar garantias absolutas de sistema distribuído.

# Requirements

## Requirement 1: Rate Limiting & User Eligibility Policies

*User Story*: Como Product Manager, eu quero que o sistema impeça que usuários recebam notificações excessivamente, obedecendo regras estritas por dia e por canal, para evitar irritação do cliente ou punições nos provedores de envios.

### Acceptance Criteria

*   GIVEN um processo de *evaluation* em execução para um novo agendamento de e-mail (limitado a 5 por dia)
*   WHEN o PostgreSQL checa e contabiliza envios `DELIVERED` e `QUEUED` do usuário nas últimas 24 horas transacionalmente e o valor for `>= 5`
*   THEN o sistema MUST transitar essa solicitação transacional específica para estado `CANCELED` ou `FAILED_TERMINAL` e logar o bloqueio sob metadado restritivo.
*   GIVEN o limite definido de distanciamento temporal (cooldown) de 20 minutos para *push notifications*
*   WHEN um usuário receber um push válido às `10:00:00Z` e o sistema for avaliar o envio para um outro disparo solicitado para ele logo em seguida `10:05:00Z`
*   THEN o sistema SHALL rejeitar o disparo imediato e redefinir o estado internamente (e tempo do *scheduled_for*) para execução após `10:20:00Z`, suportando os atrasos requeridos para segurança de engajamento do cliente (*temporal rules*).
*   GIVEN duas requisições simultâneas para um push do mesmo usuário que possui apenas 1 de sua cota restante para o dia.
*   WHEN processado concorrentemente pelo sistema
*   THEN o mecanismo transacional MUST efetuar serialização, processando a primeira com sucesso e abortando/limitando a segunda, para respeitar *stale state prevention* rigoroso.

## Requirement 2: Template Injection & Channel Definition

*User Story*: Como engenheiro, eu quero ter a capacidade de despachar cargas dinâmicas associadas a canais de entrega sem escrever código específico de parsing no servidor de banco de dados, utilizando uma integração ágil baseada em metadados injetados.

### Acceptance Criteria

*   GIVEN uma solicitação despachada para e-mail com identificador de template (ex: `welcome_template`)
*   WHEN acompanhada por JSON metadata `{"name": "Higor", "coupon": "RENOVI2026"}`
*   THEN o sistema na Edge Function MUST renderizar ativamente o formato esperado pelo Resend utilizando estes metadados fornecidos via Payload de contexto transacionalmente protegido.
*   GIVEN uma mensagem de *Push Notification* formatada.
*   WHEN enviada aos canais operacionais.
*   THEN o mapeamento MUST garantir que o título e corpo possuam as strings parametrizadas validadas antes de se transpor dados para o *contract HTTP* estabelecido para o Google FCM.
*   GIVEN a inclusão de um canal de mensagem não configurado nos módulos ativos do workflow (ex: `SMS`).
*   WHEN recebido no momento da avaliação inicial
*   THEN o registro MUST retornar erro de persistência em status de rejeição sem comprometer recursos computacionais das funções Edge.

## Requirement 3: Multi-Worker Concurrent Orchestration

*User Story*: Como Principal Engineer, eu quero que múltiplas instâncias de Edge Functions (em escalabilidade horizontal) possam processar centenas de notificações da fila subjacente simultaneamente, sem enviar dois emails da mesma transação por acidente.

### Acceptance Criteria

*   GIVEN 5 instâncias de Deno Edge Functions de orquestração chamadas no mesmo milissegundo de pico (spikes) de tráfego.
*   WHEN ambas executam o RPC principal de verificação e retirada de fila (checkout)
*   THEN o uso de `SELECT ... FOR UPDATE SKIP LOCKED` MUST proteger que os sub-conjuntos capturados de X registros por requisição sejam desassociados e 100% únicos por *thread*, sem contenção do banco.
*   GIVEN a aquisição de uma tupla transacional por uma Edge Function em processo
*   WHEN operando o status do processamento.
*   THEN o *ownership lease* (`locked_until`) do registro MUST refletir um carimbo temporal válido de posse provisória de forma *atômica*, bloqueando repetição da seleção subjacente enquanto executa as validações com os provedores *downstreams*.
*   GIVEN que uma Edge function sofreu um *timeout/OOM Kill* e não sinalizou sucesso
*   WHEN o cron do PostgreSQL rodar o verificador de falhas
*   THEN a tupla transacional deve obrigatoriamente perder o estado de lease `locked_until` caduco, sendo devolvido para estado de retentativa ou re-disponibilizada no *polling*, assumindo modelo *fault tolerance*.

## Requirement 4: Delayed Dispatch (Scheduling) & Cancellation Guarantee

*User Story*: Como administrador da base, eu quero inserir comunicações proativas definidas para despachar em datas estritas futuras e cancelar proativamente na ausência de necessidade.

### Acceptance Criteria

*   GIVEN um *input payload* onde `scheduled_for` está explícito a 24 horas no futuro
*   WHEN salva via ingestão do serviço
*   THEN a etapa de avaliação garantirá a inserção em formato transacional inerte (estado `SCHEDULED`), ignorada completamente em operações de *polling* do *worker* central até o vencimento exato do timestamp.
*   GIVEN um processo na fila com estado `SCHEDULED` e temporalmente não vencido.
*   WHEN um request assíncrono executa cancelamento (`/v1/dispatch/cancel`) via referenciamento do UUID central
*   THEN o RPC correspondente MUST anular a execução definindo no campo transitivo de estado a flag final `CANCELED`, salvando rastro em tabelas de auditoria (Auditoring Semantics) provando a intervenção intencional.
*   GIVEN a tentativa de cancelar um Dispatch em que a máquina de status relata `PROCESSING` ou `DELIVERED`
*   WHEN invocado o serviço
*   THEN a API e o RPC de banco de dados MUST negar a efetivação, emitindo falha lógica `409 CONFLICT` apontando violação de transição, validando robustez da state machine.

## Requirement 5: Idempotency Semantics

*User Story*: Como integrador externo, eu quero evitar duplicatas absolutas nas notificações caso reenvie requisições múltiplas por causa de timeout na minha conexão na hora do agendamento.

### Acceptance Criteria

*   GIVEN o protocolo central de registro
*   WHEN o caller despachar requisição a notificação obrigatória fornecendo `idempotency_key` via request.
*   THEN as construções transacionais MUST rejeitar (ou retornar 200 OK sem duplicação de side-effect) o evento *replay*, consultando chave única ou cache e salvaguardando a estabilidade e previsibilidade de saídas do sistema.
*   GIVEN que o provedor não informou id de idempotência
*   WHEN da tentativa
*   THEN o gateway principal falha e declina o processamento imediato (erro rigoroso da API: `400 BAD REQUEST`, mandatório), forçando implementadores originais a respeitarem tolerância ao *retry* do serviço.
*   GIVEN tentativas repetidas via cron job central para efetivar um registro para FCM.
*   WHEN em fase de processamento final
*   THEN a Edge Function usa o transaction_id imutável no mapeamento interno da notificação pra validar idêntica carga do *worker* anterior de timeout, agindo de forma previsível e isolada contra erros residuais.

## Requirement 6: Comprehensive Observability and Execution Trace

*User Story*: Como analista de suporte, eu quero verificar precisamente o instante da aceitação, bloqueio de fila, recebimento e erro no provedor de terceiros da comunicação.

### Acceptance Criteria

*   GIVEN qualquer modificação na estrutura original (Estado transitório para executório).
*   WHEN o PostgreSQL submete a atualização
*   THEN os mecanismos de Trigger MUST copiar de forma transacional imutável essa atualização de estados, payloads e transações ativadoras numa base de auditoria (`message_dispatcher_audit`).
*   GIVEN uma mensagem de e-mail enviada e finalizada no Resend
*   WHEN o Edge recebe via webhook *delivery confirmation* do provedor com a referência (`vendor_id`) atrelada ao UUID do dispatch.
*   THEN este evento MUST inserir a referência identificadora externa como parte da execução no histórico operacional da máquina de estados, e validar a integridade transacional de `DELIVERED` no sistema (*Auditability and Recoverability Constraints*).
*   GIVEN uma necessidade de checagem técnica a partir de falha de envios maciços
*   WHEN requisitada nos dashs.
*   THEN os índices geolocalizados nas queries devem possuir eficiência que garantem respostas sub-segundo mesmo cruzando milhões de registros históricos gerados pelo serviço nas tabelas `message_dispatcher_audit`.

## Requirement 7: Failover, Backoff and Terminal Exceptions

*User Story*: Como mantenedor das operações do sistema, quero ter a garantia da reiteração escalonada quando recursos externos como FCM e Resend caem e recusam conexão ou efetuam throttlings temporais na minha API Key.

### Acceptance Criteria

*   GIVEN um request HTTPS partindo da Edge Function para Resend para e-mails críticos.
*   WHEN do retorno status 429 API Limiting HTTP ou 503 Service Unavailable na origem.
*   THEN o código na submissão MUST alterar a tupla via chamada RPC final para `FAILED_RETRYABLE` e configurar um offset com modelo computacional de exponencialidade via `pow(2, retries) * 60` no atributo de reinício (*retry semantics*).
*   GIVEN retorno restritivo (Ex: FCM Bad Tokens, E-mails Unreachable originando Erro de 400 Bad Request lógico na payload).
*   WHEN a Edge function parseia este corpo.
*   THEN a notificação ignora todo o buffer de tentativa global do agendamento e transita sua árvore determinística diretamente a `FAILED_TERMINAL` e bloqueando a máquina de estado definitivamente a este fim e persistindo as *reasons*.
*   GIVEN a limitação restritiva limite das configurações de tentativa (Ex: Configurado 3 *max_retries*)
*   WHEN do evento falho 4.
*   THEN não existindo mais tolerância perante a premissa base, MUST marcar o terminal de interrupção *FAILED_TERMINAL* definindo de modo categórico esgotamento sistêmico *Orchestrational Limits*.

# Implementation Guidance

A arquitetura orientada à orquestração assíncrona proposta foca em estabilidade a longo prazo. Toda lógica que requer atomicidade, travamento síncrono ou verificação transacional rígida de variáveis da plataforma deve permear exclusividade às diretrizes internas e ferramentas nativas de persistência no postgres. As *Edges Functions* agem em estrito conformismo como os "conectores brutos sem dependências internas" sob demanda.

## O que deve ficar no PostgreSQL

| Responsabilidade | Local |
| :--- | :--- |
| Queue Storage & Atomic Locks | Tabela base de despacho com `SELECT ... FOR UPDATE SKIP LOCKED`. |
| Event Lifecycle (State Machine) | Controle atômico via restrição com PL/pgSQL transacionais e triggers de validação de campo transacional `status`. |
| Auditability Control / Trace | `AFTER UPDATE` triggers preenchendo automaticamente a `message_dispatcher_audit`. |
| Rate-Limiting Semantics / Cooldown checks | Procedures RPC rodando de antemão em concorrência na inserção original dos despachos no repositório. |
| Job Scheduler Worker Triggering | `pg_cron` no Supabase atuando como gatilho da invocação das Edges via endpoints em lote. |
| Janitor/Garbage Collection | Processo ativado periodicamente restaurando os *leases* abandonados na `locked_until` para recuperar as funções moribundas (*orphan re-queued failures*). |
| Idempotency Protection | `UNIQUE INDEX` na chave nativa injetada como ID (`idempotency_key`) para contenção a requisições múltiplas duplicantes nas views originadoras. |

## O que deve ficar na camada de aplicação

| Responsabilidade | Local |
| :--- | :--- |
| Message Ingestion & JSON Payloading | SDK ou Client Web gerando UUID (Idempotency Key) e formulando os requests originais via API do Supabase (REST `insert`). |
| Resumo / Dashboards Auditáveis | Front-end e relatórios gerenciais consultando passivamente as tabelas de `message_dispatcher_audit`. |
| Cancellation Intent Request | Interface enviando ID nativo da requisição a RPC específico requisitando interrupção de ciclo via `CANCELED` State Change. |

## O que deve ficar em Workers/Edge Functions

| Responsabilidade | Local |
| :--- | :--- |
| Integração API Resend e FCM | Chamada I/O vinculativa efetuando despachos em massa a terceiros. Operação orientada na Deno Network Layer (Edge HTTP/S). |
| Compilação e Templating Substitutivo | Deno executando validação da string final do email/push através do payload das variáveis recebidas e compilação do output real das views (por evitar estressar a CPU do DB). |
| Error Backoff Definition (Calculation) | Tradução do código HTTP e corpo JSON (Ex. 429 vs 404) retornando a decisão via chamada do RPC como "Terminal" ou "Retryable" de volta para persistência na base relacional. |
| Processamento Assíncrono | Webhook Receiver passivo capturando assinaturas de retorno do provedor (confirmação `DELIVERED`, `bounces` duros) efetuando as requisições de Update Reconciliador no BD. |
