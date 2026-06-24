# Payment System — Glossário

Termos canônicos do domínio de **pagamentos e cobrança** do marketplace Renovi (Orbit). Sem detalhes de implementação.

**Requisitos:** [`payment-system-requirements.md`](./payment-system-requirements.md) · Fluxo NetCred: [`netcred-payments-flow.md`](./netcred-payments-flow.md)

## Language

### Agregados e identidade

**Contracted Service**:
O compromisso comercial firmado quando o cliente aceita uma proposta — vincula cliente, prestador, data agendada e proposta aceita. Agregado de negócio do serviço contratado.
_Avoid_: Service, Job, Order (no sentido de pedido de orçamento)

**Payment Schedule**:
Registro 1:1 de orquestração da cobrança de um Contracted Service — agenda T-2, retries, integração com gateway, ClearSale e estados de cobrança. Sub-recurso do Contracted Service; não existe sem ele.
_Avoid_: Payment, Charge job, Billing record

**contracted_service_id**:
Identificador canônico (`contracted_services.id`) usado em `referenceCode`, `idempotency_key`, logs e correlação entre domínio de serviço e domínio de pagamento.
_Avoid_: service_id (ambíguo com `service_requests`)

### Estados e fontes da verdade

**Contracted Service status**:
Ciclo operacional do serviço. Enum: `PENDING_PAYMENT` → `CONFIRMED` → `EXECUTED` → `COMPLETED` | `CANCELLED`. Fonte da verdade para execução e visibilidade na agenda.
_Avoid_: Payment status (para o serviço em si); `SCHEDULED` neste enum (colide com `payment_schedules.state`)

**PENDING_PAYMENT**:
Serviço aceito e compromisso firmado, mas cobrança ainda **não capturada** (`payment_schedules.state` ∉ `PAID`). Cliente vê o serviço; prestador **não** vê na agenda. Prestador **pode** receber notificação de trabalho confirmado (aceite).
_Avoid_: Interpretar como "pagamento falhou"

**CONFIRMED** (contracted service):
Cobrança capturada (`payment_schedules.state = PAID`); serviço aguardando execução na data acordada. Prestador vê na agenda e executa o trabalho.
_Avoid_: `SCHEDULED` (reservado para agendamento de cobrança no Payment Schedule); confundir com "aceite da proposta"

**EXECUTED** (contracted service):
Prestador marcou o serviço como executado; aguardando confirmação do cliente. `executed_at` registrado. Auto-promoção para `COMPLETED` após 24h sem ação do cliente.
_Avoid_: Confundir com `COMPLETED`; pular etapa de confirmação do cliente

**COMPLETED** (contracted service):
Serviço encerrado. Transição via confirmação explícita do cliente **ou** auto-conclusão 24h após `executed_at`. Pagamento não revalida nesta transição.
_Avoid_: Marcar `COMPLETED` direto pelo prestador sem passo `EXECUTED`

**Service completion flow**:
Conclusão em duas etapas: (1) prestador → `EXECUTED`; (2) cliente confirma → `COMPLETED`. Se cliente não confirmar em 24h → cron promove automaticamente para `COMPLETED`. Pré-condição para `EXECUTED`: `payment_schedules.state = PAID`.
_Avoid_: Conclusão unilateral só pelo prestador; bloquear `COMPLETED` por chargeback em andamento

**Provider calendar visibility**:
Prestador enxerga o serviço na agenda quando `contracted_services.status ∈ {CONFIRMED, EXECUTED, COMPLETED}`. Em `PENDING_PAYMENT`, prestador **não** vê na agenda.
_Avoid_: Filtrar agenda apenas por `status <> CANCELLED`

**Work confirmed notification**:
Notificação ao prestador no aceite da proposta — independe do estado de cobrança. Comunica que o compromisso foi firmado; não implica pagamento capturado nem visibilidade na agenda.
_Avoid_: Tratar como equivalente a "pagamento confirmado"

**Payment under review (IN_ANALYSIS)**:
Estado exclusivo do Payment Schedule quando o antifraude (ClearSale) analisa a cobrança. O Contracted Service **permanece** `PENDING_PAYMENT`; agenda do prestador **oculta**; auto-cancel T-12h **suspenso**. Transição para `CONFIRMED` somente quando `payment_schedules.state = PAID` (via webhook).
_Avoid_: Criar status intermediário no Contracted Service; tratar `IN_ANALYSIS` como pagamento confirmado

### Antifraude (ClearSale)

**ClearSale session**:
Identificador UUID que vincula a coleta de fingerprint do dispositivo à transação no gateway (`orderInput.sessionId`).
_Avoid_: Confundir com sessão de auth do Supabase

**Checkout ClearSale session**:
Sessão gerada no checkout (stepper de cartão), **enquanto o cliente preenche os dados** — requisito NetCred/ClearSale. Persistida em `payment_schedules.clearsale_session_id` para uso na cobrança T-2 (Card on File / MIT).
_Avoid_: Regenerar no cron sem presença do cliente; cobrar sem `sessionId` coletado no preenchimento

**Manual payment ClearSale session**:
Sessão **nova**, gerada na tela de retry manual. Substitui `clearsale_session_id` antes do `chargeCreate`. Obrigatória em toda tentativa manual.
_Avoid_: Reutilizar sessão do checkout em retry manual

### Aceite e orquestração

**Proposal acceptance (accept_proposal)**:
RPC atômica que firma o compromisso: cria `contracted_services` + `payment_schedules` na mesma transação. Tokenização do cartão ocorre **antes**, via Edge Function separada.
_Avoid_: `create_payment_schedule` como passo desacoplado pós-aceite

**Charge retry interval**:
Tempo mínimo entre tentativas automáticas de cobrança após falha retryable. Default de produção: **30 minutos**, configurável via `platform_constants.charge_retry_interval_minutes`.
_Avoid_: Retry a cada 5 minutos em produção (reservado para homologação)

**Payment charge queue**:
A tabela `payment_schedules` é a fila canônica de cobrança — não existe tabela de dispatch separada. Padrões operacionais do Message Dispatcher (`SKIP LOCKED`, lease, janitor) aplicam-se aqui; a estrutura de fila do MMD não é duplicada.
_Avoid_: `payment_charge_dispatches`, enfileirar cobrança em tabela avulsa pós-aceite

**Automatic charge attempt**:
Tentativa de cobrança disparada pelo cron. Contador `automatic_attempt_count`, máximo `max_charge_attempts` (default 3). Esgotado → `FAILED_PERMANENT`.
_Avoid_: Misturar com tentativas manuais do cliente

**Manual charge attempt**:
Tentativa iniciada pelo cliente via "Efetuar Pagamento". Orçamento **separado**, sem limite fixo até T-12h; rate limit na Edge Function. Não reativa retries automáticos.
_Avoid_: Incrementar `automatic_attempt_count` em retry manual

**Installment selection HMAC**:
Assinatura HMAC-SHA256 sobre opções de parcelas + taxas (`expires_at = computed_at + 10 min`). `accept_proposal` valida assinatura e expiração server-side.
_Avoid_: Confiar em `installment_number` enviado pelo cliente sem verificação

**Installment signature expiry (UX)**:
Se HMAC expirar no submit → erro `INSTALLMENT_SIGNATURE_EXPIRED`; app reabre passo de parcelas com recálculo automático (novo HMAC). Token do cartão, endereço e demais dados do stepper **persistem**.
_Avoid_: Heartbeat que renova HMAC silenciosamente; perder todo o checkout por expiração

**Payment method update (pre-charge)**:
Cliente troca cartão em serviço `PENDING_PAYMENT` (`payment_schedules.state ∈ {SCHEDULED, FAILED}`) sem cancelar/reaceitar. Atualiza `payment_token_id`; se banda mudar → novo HMAC de parcelas; preços e `charge_scheduled_at` inalterados.
_Avoid_: Exigir cancelamento para trocar cartão; permitir troca após `PAID`

**Payment Schedule state**:
Ciclo da cobrança (`SCHEDULED`, `PAID`, `FAILED`, etc.). Fonte da verdade exclusiva para o pipeline de pagamento e gateway.
_Avoid_: Usar o mesmo enum em `contracted_services`

**Cancellation reason**:
Metadado que qualifica um `CANCELLED` — ex.: `NON_PAYMENT`, `CLIENT_INITIATED`, `PROVIDER_INITIATED`, `PROVIDER_SUSPENDED`. Não é um status separado.
_Avoid_: `SERVICE_CANCELLED_NON_PAYMENT` como status de `contracted_services`; usar `NON_PAYMENT` quando a culpa é do cliente

**Service rescheduling**:
Alteração de `scheduled_at` do Contracted Service. Pré-`PAID`: recalcula `charge_scheduled_at`; pós-`PAID` (`CONFIRMED`): só atualiza data do serviço, sem nova cobrança.
_Avoid_: Bloquear reagendamento antes do pagamento; criar novo Payment Schedule a cada mudança de data

**Charge schedule recalculation**:
Ao reagendar com `payment_schedules.state ∉ {PAID, REFUNDED, PARTIALLY_REFUNDED, ...}`: `charge_scheduled_at = max(now(), scheduled_at − 48h)`. Se o novo T-2 cair no passado → cobrança no próximo tick do cron (regra de emergência). Auto-cancel T-12h usa a **nova** `scheduled_at`.
_Avoid_: Manter `charge_scheduled_at` antigo após reagendamento; ignorar reagendamento em `FAILED` ou `IN_ANALYSIS`

**Emergency scheduling**:
Serviço aceito com menos de 48h até a data: `charge_scheduled_at = now()` no aceite ou após reagendamento que encurte o prazo abaixo de T-2.
_Avoid_: Agendar cobrança no futuro quando o serviço é em menos de 48h

### Credenciamento do prestador

**Provider credentialing gate**:
Prestador com `provider_accounts.onboarding_status ≠ 'ACTIVE'` fica **fora do marketplace operacional**: não vê pedidos de serviço, não inicia chat, não recebe aceite de proposta. Pré-requisito: `netcred_company_id` + `netcred_bank_account_id` persistidos.
_Avoid_: Permitir aceite ou interação com cliente sem split possível; filtrar só no cron de cobrança

**Provider marketplace access**:
Conjunto de capacidades liberadas somente em `onboarding_status = 'ACTIVE'`: listagem de oportunidades/pedidos, envio de propostas, chat com clientes, visibilidade na agenda pós-`CONFIRMED`. Enquanto pendente: tela bloqueante de credenciamento KYC.
_Avoid_: Lista vazia sem explicar motivo; permitir chat antes do credenciamento

**Proposal acceptance credentialing check**:
`accept_proposal` rejeita com `PROVIDER_NOT_CREDENTIALED` se prestador não estiver `ACTIVE` com IDs NetCred válidos — validação no aceite, não só no cron.
_Avoid_: Aceitar compromisso e descobrir impossibilidade de cobrança depois

**Provider suspension (pre-charge)**:
Prestador `SUSPENDED` após aceite, antes de `PAID`: cron não cobra; serviço permanece `PENDING_PAYMENT`; cliente informado; ops alertados. Se ainda suspenso no T-12h → `CANCELLED` + `cancellation_reason = PROVIDER_SUSPENDED` (não `NON_PAYMENT`).
_Avoid_: Auto-cancel imediato na suspensão; tratar como falha de pagamento do cliente

**Provider suspension (post-charge)**:
Prestador `SUSPENDED` com serviços já `CONFIRMED`: compromissos existentes são honrados — agenda, execução e chat **somente** desses serviços permanecem. Suspensão bloqueia novos pedidos, propostas e chats. Cancelamento manual por ops com reembolso integral em casos graves.
_Avoid_: Congelar agenda inteira; cancelar automaticamente serviços já pagos

### Preços e repasse

**Service price (base_amount)**:
Valor bruto do serviço acordado na proposta aceita — igual a `proposed_amount`. Congelado no aceite; base para cálculo de comissão e repasse ao prestador, **sem** taxas de cartão.
_Avoid_: charge_amount, paid_amount (para o preço do serviço em si)

**Platform commission (tax_amount)**:
Comissão da Renovi sobre o service price, já calculada e assinada na proposta (`pricing_signature`). Parte do repasse que fica com a Renovi após o split.
_Avoid_: platform fee genérico sem vínculo à proposta

**Provider payout (final_amount)**:
Valor líquido garantido ao prestador sobre o service price — `proposed_amount − tax_amount`. Congelado na proposta aceita.
_Avoid_: split amount, net receivable

**Card processing fee**:
Taxa de processamento/parcelamento do cartão, calculada sobre `base_amount` via `platform_constants`. Paga pelo **cliente** (somada ao débito no cartão). No gateway, descontada do valor total da transação; repasses `isLiable` recebem valores **líquidos** (já descontada a taxa proporcionalmente entre contas liable).
_Avoid_: tax_amount (comissão Renovi), installment fee misturado com comissão; assumir que só a Renovi absorve a taxa no split

**Charge amount**:
Valor total debitado no cartão do cliente = `service price + card processing fee`. Usado em `chargeCreate.amount` e como `paid_amount` após captura.
_Avoid_: base_amount, proposed_amount (quando se refere ao total no cartão)

**Payout split (modelo invertido)**:
Regra de repasse no gateway: prestador `FIXED_AMOUNT = final_amount`; Renovi `PERCENTAGE 100%` do **saldo** (`charge_amount − final_amount`). Ambos com `isLiable = true` — taxa de cartão descontada proporcionalmente do líquido de cada parte.
_Avoid_: Renovi FIXED + prestador PERCENTAGE (modelo legado do spec inicial); `isLiable = false` na Renovi

**Split liability (isLiable)**:
Flag NetCred por item do `payoutRuleInput`. Contas `isLiable = true` participam do desconto de taxas de processamento e do estorno proporcional em `transactionRefund`. Renovi e prestador são **ambos** liable.
_Avoid_: Apenas prestador liable; assumir que estorno debita só uma conta

**Proportional refund (split reversal)**:
Em `transactionRefund` parcial, o gateway reparte o estorno proporcionalmente entre **todas** as contas liable, respeitando a regra de divisão original (FIXED + PERCENTAGE). Débito ocorre em liquidações futuras se o repasse já tiver ocorrido.
_Avoid_: Assumir que prestador mantém 100% do `final_amount` em cancelamento com multa; estorno integral só da conta Renovi

**Payment dispute (chargeback)**:
Webhook `TRANSACTION_DISPUTE`: flag `is_disputed = true` no registro de pagamento; alerta ops. Serviço `CONFIRMED` **permanece** em execução; resolução manual no MVP. Clawback financeiro proporcional entre liable (NetCred).
_Avoid_: Auto-cancelar serviço no chargeback; criar status `DISPUTED` no Contracted Service

**Cancellation penalty**:
Multa por cancelamento tardio do cliente, calculada sobre `base_amount` (valor do serviço), não sobre `charge_amount`. Faixas ToS §2.2: >48h = 0%; 48h–12h = 10%; <12h = 30%.
_Avoid_: Aplicar multa sobre taxas de cartão

**Refund amount**:
Valor devolvido ao cliente em cancelamento pós-cobrança. `refund_amount = base_amount × (1 − penalty_rate)`; taxa de cartão **não reembolsável**. Cancelamento por prestador: `refund_amount = charge_amount` (integral). O gateway estorna proporcionalmente entre contas liable; a multa retida fica com a plataforma (não devolvida ao cliente).
_Avoid_: `refund_amount = charge_amount × 0,90` (penaliza taxa de cartão além da multa do serviço); assumir clawback só da Renovi

## Decisões registradas

| # | Decisão | Data |
|---|---------|------|
| 1 | **Contracted Service** é o agregado de negócio; **Payment Schedule** é sub-recurso 1:1 de orquestração de cobrança. | 2026-06-24 |
| 2 | `contracted_service_id` substitui `service_id` no vocabulário de pagamentos e em chaves de idempotência/referenceCode. | 2026-06-24 |
| 3 | `payment_schedules.state` governa cobrança; `contracted_services.status` governa operação do serviço — estados não são duplicados entre as duas entidades. | 2026-06-24 |
| 4 | Auto-cancelamento por falta de pagamento → `contracted_services.status = CANCELLED` + `cancellation_reason = NON_PAYMENT`; não criar novo enum de status. | 2026-06-24 |
| 5 | Novo status `CONFIRMED` em `contracted_services`: transição `PENDING_PAYMENT → CONFIRMED` quando `payment_schedules.state = PAID`. Não usar `SCHEDULED` no enum do serviço (colide com cobrança). | 2026-06-24 |
| 6 | Agenda do prestador: visível em `CONFIRMED`, `EXECUTED` ou `COMPLETED`. Em `PENDING_PAYMENT`, prestador **não** vê na agenda. | 2026-06-24 |
| 7 | Notificação de trabalho confirmado ao prestador no aceite é permitida em `PENDING_PAYMENT`; falhas de pagamento seguem fluxo de comunicação separado. | 2026-06-24 |
| 8 | `IN_ANALYSIS`: Contracted Service permanece `PENDING_PAYMENT`; agenda oculta; auto-cancel T-12h suspenso; `CONFIRMED` só após `PAID` definitivo (webhook). | 2026-06-24 |
| 9 | `payment_schedules.base_amount` = `proposed_amount` da proposta aceita, congelado no aceite. | 2026-06-24 |
| 10 | Taxas de cartão são pagas pelo cliente (`charge_amount = base_amount + card processing fee`). | 2026-06-24 |
| 11 | Split invertido no gateway: prestador `FIXED_AMOUNT = final_amount`; Renovi `PERCENTAGE 100%` do saldo (`charge_amount − final_amount`). Ambos `isLiable = true` (taxa de cartão descontada do líquido de cada parte liable). | 2026-06-24 |
| 12 | Decomposição do service price: `proposed_amount = tax_amount + final_amount` (valores da proposta, via `pricing_signature`). | 2026-06-24 |
| 13 | Reembolso parcial: multa sobre `base_amount`; `refund_amount = base_amount × (1 − penalty_rate)`; taxa de cartão não reembolsável. | 2026-06-24 |
| 14 | Cancelamento por prestador pós-cobrança: `refund_amount = charge_amount` (reembolso integral ao cliente). | 2026-06-24 |
| 15 | ClearSale híbrido: cron T-2 reutiliza sessão do checkout; retry manual exige sessão fresca. Push de refresh pré-cobrança = evolução futura (fora MVP). | 2026-06-24 |
| 16 | `accept_proposal` estendido atomicamente: `contracted_services` + `payment_schedules` na mesma transação; tokenização prévia em Edge Function; campos de pagamento incluídos no `request_hash` de idempotência. | 2026-06-24 |
| 17 | Intervalo entre retries automáticos: default **30 min** (`charge_retry_interval_minutes`), configurável. Primeira falha notifica cliente + prestador; retries subsequentes notificam somente cliente. | 2026-06-24 |
| 18 | `payment_schedules` é a fila canônica de cobrança (sem dispatch table separada). Reutiliza padrões MMD: `SKIP LOCKED`, lease, janitor, `job_runs`. | 2026-06-24 |
| 19 | Tentativas automáticas (`automatic_attempt_count`, max 3) separadas de tentativas manuais (ilimitadas até T-12h, rate limit na Edge). `payment_attempts.initiator` = `cron` \| `client`. | 2026-06-24 |
| 20 | ClearSale `sessionId` coletado **durante o preenchimento** dos dados no checkout (confirmado NetCred). Reutilizado na cobrança T-2 (Card on File / MIT); retry manual exige sessão nova. | 2026-06-24 |
| 21 | Estorno parcial (`transactionRefund`): repartição **proporcional** entre todas as contas `isLiable`, independente de FIXED/PERCENTAGE. Débito em liquidações futuras se repasse já ocorreu (confirmado NetCred). | 2026-06-24 |
| 22 | Prestador e Renovi: `isLiable = true` em todo `payoutRuleInput`. Taxas de processamento descontadas do valor total; splits liable recebem líquido (confirmado NetCred). | 2026-06-24 |
| 23 | Reagendamento (Opção A): pré-`PAID` recalcula `charge_scheduled_at = max(now(), scheduled_at − 48h)`; pós-`PAID` só atualiza data. Válido em `SCHEDULED`, `FAILED`, `IN_ANALYSIS`. T-12h usa nova data. Auditoria: `CHARGE_RESCHEDULED`. | 2026-06-24 |
| 24 | Gate de credenciamento (Opção A estendida): prestador `≠ ACTIVE` não vê pedidos, não inicia chat, não recebe aceite. `accept_proposal` valida `ACTIVE` + IDs NetCred. Tela bloqueante KYC até ativação. | 2026-06-24 |
| 25 | HMAC de parcelas expirado (Opção B): submit falha com `INSTALLMENT_SIGNATURE_EXPIRED`; app reabre passo de parcelas com recálculo; restante do checkout preservado. TTL: 10 min. | 2026-06-24 |
| 26 | Troca de cartão pré-cobrança (Opção A): cliente atualiza `payment_token_id` em `PENDING_PAYMENT` / `SCHEDULED` \| `FAILED` sem reaceitar. Nova banda → novo HMAC. Auditoria: `PAYMENT_METHOD_UPDATED`. | 2026-06-24 |
| 27 | Prestador `SUSPENDED` pré-`PAID` (Opção C): cron não cobra; congela até T-12h; ops escalados; auto-cancel `PROVIDER_SUSPENDED` se sem resolução. Não é `NON_PAYMENT`. | 2026-06-24 |
| 28 | Prestador `SUSPENDED` pós-`PAID` (Opção A): serviços `CONFIRMED` honrados — agenda, execução e chat desses serviços ativos. Suspensão bloqueia apenas novas oportunidades. | 2026-06-24 |
| 29 | Chargeback (`TRANSACTION_DISPUTE`, Opção A): `is_disputed = true` no pagamento; serviço `CONFIRMED` segue; ops resolve manualmente no MVP. Sem auto-cancel. | 2026-06-24 |
| 30 | Conclusão em duas etapas: prestador marca `EXECUTED` → cliente confirma `COMPLETED`. Sem confirmação em 24h → auto-`COMPLETED` (cron). Pagamento desacoplado após `PAID`. | 2026-06-24 |
