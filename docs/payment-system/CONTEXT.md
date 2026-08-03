# Payment System

Subsistema de orquestração de pagamentos do marketplace Orbit: cobrança diferida, split com gateway, credenciamento de prestadores e ciclo de vida pós-contratação.

**ADR:** [`0001-payment-split-commission-model`](../adr/0001-payment-split-commission-model.md)

## Agregados

**Contracted Service** (`contracted_services`):
Registro de serviço contratado entre cliente e prestador; expressa o ciclo de vida operacional visível ao produto (pagamento pendente → confirmado → executado → concluído).
_Avoid_: Service, Order, Job

**Payment Schedule** (`payment_schedules`):
Fila autoritativa de cobrança ligada 1:1 a um Contracted Service; expressa orquestração técnica (cron, leases, retries, webhooks, antifraude).
_Avoid_: Payment, Transaction, Charge record

**Separação de agregados**:
Contracted Service e Payment Schedule são dois agregados distintos, acoplados apenas em transições atômicas definidas (ex.: `PAID` → `CONFIRMED`, cancelamento, estorno). Estados operacionais de cobrança não pertencem ao status do serviço.
_Avoid_: Estado único, máquina de estados unificada

## Ciclo de vida do serviço

**PENDING_PAYMENT**:
Serviço aceito, cobrança ainda não capturada. Cliente vê; prestador não vê no calendário.
_Avoid_: Aguardando pagamento (informal), Unpaid

**CONFIRMED**:
Cobrança capturada (`PAID`); serviço entra no calendário do prestador e ambas as partes tratam a execução como garantida.
_Avoid_: Paid service, Active

**Gatilho de confirmação (Opção A)**:
Prestador só recebe notificação de trabalho confirmado e visibilidade no calendário quando `payment_schedules.state` transiciona para `PAID` e `contracted_services.status` vai para `CONFIRMED`. Em `PENDING_PAYMENT` ou `IN_ANALYSIS`, no máximo alerta de aceite com pagamento pendente.
_Avoid_: Confirmação no accept_proposal, Calendário antes do PAID

## Agendamento

**Service Execution At** (`payment_service_execution_at`):
Instante canônico derivado de `scheduled_start_date` + horário do turno (`morning`/`full_day` = 08:00, `afternoon` = 13:00) em `America/Sao_Paulo`. Ancora T-2, T-12h, faixas de estorno e reagendamento. Jobs multi-dia usam só `scheduled_start_date`.
_Avoid_: service_execution_at, service_scheduled_at, horário real de chegada

**Convenção de turno**:
Horários 08:00/13:00 são referência de negócio para janelas de pagamento e penalidade — não representam chegada física do prestador.
_Avoid_: Horário de início real, SLA de chegada

**Marcação EXECUTED (gate por data)**:
Prestador pode marcar serviço como executado quando `scheduled_start_date <= hoje`, independentemente da hora do turno. Pagamento e estorno continuam usando Service Execution At com hora.
_Avoid_: Gate por hora, Bloqueio até o turno

## Valores monetários

**Base Amount**:
Valor da proposta aceita pelo cliente, antes das taxas de cartão/parcelamento. Ancora faixas de estorno ToS §2.2. Distinto de `provider_payout`.
_Avoid_: final_amount, proposed_amount (fora do contexto de pagamento), valor líquido do prestador

**Charge Amount**:
Valor total debitado no cartão (`base_amount` + taxas), recalculado na data da cobrança (T-2) com `platform_constants` vigentes.
_Avoid_: Valor do checkout congelado, paid_amount (antes da captura)

**Paid Amount**:
Valor efetivamente capturado no gateway quando `state = PAID`; normalmente igual ao Charge Amount da tentativa bem-sucedida.
_Avoid_: Valor estimado, valor parcelado unitário

**Fee Drift (Opção A)**:
Taxas de cartão não são congeladas no aceite; recalculadas no T-2. O HMAC do checkout valida integridade da escolha de parcelas, não trava a taxa. Checkout deve informar que taxas serão recalculadas na cobrança.
_Avoid_: Preço congelado, re-aceite por divergência de taxa

## Split no gateway (MVP)

**Provider Net Payout**:
Valor exato que o prestador recebe no split (ex.: R$ 850 = R$ 1.000 − 15% comissão). Exibido ao prestador na plataforma **antes** do aceite. Enviado como parcela fixa no `chargeCreate`.
_Avoid_: base_amount integral, Estimativa pós-MDR

**Renovi Payout (split)**:
Renovi retém 100% do restante após `provider_payout` (ex.: R$ 180 = R$ 1.030 − R$ 850). Inclui comissão (R$ 150) + repasse bruto das taxas de cartão (R$ 30). A NetCred desconta MDR proporcionalmente (`isLiable`); Renovi fica com o líquido ≈ comissão (R$ 150).
_Avoid_: Remainder = só taxas, Comissão fora do split

**Exemplo canônico**:
Prestador cota R$ 1.000 → vê R$ 850 na plataforma → cliente paga R$ 1.030 → split: prestador R$ 850 fixo, Renovi R$ 180 bruto → após MDR (~R$ 30), Renovi líquido ~R$ 150.
_Avoid_: Interpretações alternativas do remainder

**Comissão congelada no aceite (Opção A)**:
`provider_payout` e taxa de comissão são persistidos no `accept_proposal` e não mudam até a cobrança. Taxas de cartão (`charge_amount`) continuam recalculadas no T-2 (fee drift). O split usa o `provider_payout` congelado.
_Avoid_: Recalcular comissão no T-2, Alterar payout prometido ao prestador

## Estornos

**Refund Base (Opção A)**:
Faixas ToS §2.2 (>48h / 48–12h / <12h) aplicam-se sobre `base_amount` (preço da proposta ao cliente). Taxas de cartão nunca reembolsáveis. Clawback no gateway distribuído proporcionalmente entre prestador e Renovi conforme split original (`isLiable`).
_Avoid_: Penalidade sobre provider_payout, Estorno sobre charge_amount integral

## Histórico de pagamentos

**Payment History Views (Opção A)**:
Cliente vê `paid_amount` (total cobrado) e `base_amount` como valor do serviço. Prestador vê `provider_payout` (recebido no split) e net após estorno proporcional. Nunca expor `paid_amount` ao prestador nem `provider_payout` como valor da proposta ao cliente.
_Avoid_: Prestador vendo base_amount como recebimento, Cliente vendo split interno

## Antifraude e limites de tempo

**IN_ANALYSIS (Opção D)**:
Enquanto antifraude analisa, auto-cancelamento T-12h e cancelamento manual ficam suspensos. Após cruzar T-12h ainda em `IN_ANALYSIS`, o sistema auto-cancela o serviço, reconcilia com o gateway (`chargeVoid` se não capturado; webhook se já capturado) e libera cancelamento manual do cliente.
_Avoid_: Isenção indefinida, Bloqueio permanente do cliente

## Reagendamento

**Reagendamento pós-pagamento (Opção D + far-recapture):**
Com `PAID`, cliente/prestador podem reagendar enquanto `status = CONFIRMED` (antes de `EXECUTED`). Atualiza slot do serviço; faixas de estorno e T-12h recalculam com o novo Service Execution At.
- **Perto (≤15 dias):** sem nova cobrança; dinheiro permanece capturado (`paid_no_charge_update`).
- **Longe (`exec_at > paid_at + far_reschedule_recapture_threshold_days`, padrão 15):** reembolso integral no gateway + nova parcela `SCHEDULED` em T-2; serviço volta a `PENDING_PAYMENT` até a nova captura. Limiar ancorado em `paid_at` (relógio de liquidação), não em `now()`. Orquestração 100% backend (`far_recapture_pending_at` + pg_net wake + cron safety-net); o app **não** invoca a EF de dinheiro no aceite.
Liquidação D+30 continua a partir do `paid_at` da captura **vigente**.
_Avoid_: Reagendamento pós-EXECUTED (MVP), Estorno congelado na data original, Dependência do client `functions.invoke` para refund pós-aceite

## Credenciamento do prestador

**Suspensão com pagamento pendente (Opção D)**:
Se prestador vai para `SUSPENDED` com serviço em `PENDING_PAYMENT`, cron não cobra; cliente recebe notificação imediata e pode cancelar sem penalidade. Se permanecer pendente, auto-cancel em T-12h com `PROVIDER_SUSPENDED`. Reativação não retoma cobrança automaticamente — ops descongela caso a caso.
_Avoid_: Cancelamento imediato ao suspender, Retomada automática pós-reativação, Cliente sem visibilidade

## Agendamento de cobrança

**Emergency Scheduling (Opção D)**:
Aceite permitido com menos de 48h até o serviço; `charge_scheduled_at = now()`. Checkout informa cobrança iminente. Sem lembrete 24h antes. Quando `PAID → CONFIRMED` faltando menos de 24h para Service Execution At, prestador recebe push urgente (prioridade bypass no MMD).
_Avoid_: Bloqueio de aceite urgente, Flag opt-in de prestador (MVP), Lembrete 24h em emergency

## Liquidação e conclusão

**Payout Timing**:
Liquidação bancária ao prestador ocorre no calendário NetCred (~D+30 após `paid_at`), independente de `EXECUTED` ou `COMPLETED`. Split é definido no `chargeCreate`; marcos operacionais não gateiam transferência.
_Avoid_: Pagamento ao marcar EXECUTED, Escrow até COMPLETED (MVP)

**Provider Payout Disclosure (Opção B)**:
UI do prestador exibe recebimento estimado calculado a partir de `paid_at` (ex.: "Recebimento estimado: D+30 da confirmação do pagamento"). `COMPLETED` não altera a data de liquidação.
_Avoid_: Implicar que COMPLETED libera pagamento, Ocultar expectativa de recebimento

## Falhas de pagamento

**Notificação ao prestador em FAILED_PERMANENT (Opção C)**:
Prestador recebe push informando que o cliente aceitou a proposta mas o pagamento não foi concluído; serviço ainda não confirmado; sem ação necessária. Sem entrada no calendário até `PAID`. Retry manual é exclusivo do cliente.
_Avoid_: "Trabalho confirmado em risco", Silêncio total ao prestador, Retry manual pelo prestador

## Disputas

**Chargeback (Opção B)**:
Webhook `TRANSACTION_DISPUTE` seta `is_disputed = true`, alerta CRITICAL para ops, status do serviço inalterado. Cliente e prestador recebem badge "Chargeback em análise" + push neutro. Valores históricos só atualizam após reconciliação de estorno. Resolução automática fora do MVP.
_Avoid_: Auto-cancel por chargeback, Reverter COMPLETED, Silêncio total ao usuário

## Credenciamento — invariantes

**REJECTED (pré-ACTIVE apenas)**:
Estado terminal de credenciamento que ocorre **antes** de `ACTIVE`. Um prestador que já está `ACTIVE` **não** transiciona para `REJECTED`. Pós-ativação, a sanção aplicável é `SUSPENDED`.
_Avoid_: Rejeição pós-ativação, Decredenciamento via REJECTED

**Implicação para pagamentos**:
Serviços em `PENDING_PAYMENT` só existem com prestador que passou por `ACTIVE` no aceite. Não há cenário de cancelamento por `PROVIDER_REJECTED` mid-flight — apenas `PROVIDER_SUSPENDED` (Opção D) ou `NON_PAYMENT` (T-12h).
_Avoid_: Cancelamento imediato por REJECTED, Handler REJECTED em serviço aceito

## Cancelamento

**Cancelamento pré-cobrança (Opção A)**:
Cliente pode cancelar a qualquer momento antes de `PAID` (estados `SCHEDULED`, `FAILED`, `FAILED_PERMANENT`), sem penalidade e sem chamada ao gateway. Exceção: bloqueado em `IN_ANALYSIS` até T-12h (Opção D). Prestador recebe push informativo; serviço nunca esteve no calendário.
_Avoid_: Penalidade pré-cobrança, Bloqueio nas últimas 24h, Motivo obrigatório (MVP)

## Antifraude (ClearSale)

**ClearSale Session (Opção A)**:
Cron T-2 reutiliza `clearsale_session_id` persistido no aceite (~48h). Retry manual exige SDK fresh (UUID novo) na tela de confirmação de pagamento.
_Avoid_: Session fresh no cron, Push de refresh pré-cobrança (MVP), Bloqueio por idade da session
