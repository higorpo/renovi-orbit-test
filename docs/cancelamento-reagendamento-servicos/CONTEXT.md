# Cancelamento e Reagendamento de Serviços

Glossário do domínio de alterações em serviços contratados.

## Reagendamento

**Solicitação de Reagendamento**:
Pedido formal para negociar uma nova data de execução de um serviço contratado. Não altera a data oficial do serviço, não suspende a obrigação da data atual e não pausa a cobrança.
_Avoid_: Nova data aceita, suspensão do serviço, cancelamento disfarçado

**Data Oficial do Serviço**:
Data e turno atualmente gravados no serviço contratado. Continua válida até o cliente aceitar formalmente uma nova data.
_Avoid_: Data em negociação, proposta de data

**Data Proposta de Reagendamento**:
Nova data (ou período) e turno enviados formalmente pelo prestador para aprovação do cliente. Só vira Data Oficial do Serviço após aceite do cliente.
_Avoid_: Data oficial, reagendamento confirmado

**Modo de data na proposta de reagendamento**:
Derivado da **duração informada pelo prestador** no dialog “Propor nova data” (`duration_unit` + `duration_value`), pré-preenchida do serviço contratado e editável (máx. 24 h / 7 dias, mesmos limites do composer de proposta). Horas, ou dias com valor 1 → uma **Data de execução** (sem campo de fim na UI; em horas `end_date` fica nulo; em 1 dia `end_date = start_date`). Dias com valor maior que 1 → **Data de início** + **Data de fim**, com a mesma regra de duração da criação de proposta (dias corridos inclusivos **ou** dias úteis seg–sex inclusivos iguais a `duration_value`). O slot proposto embute `duration_unit` e `duration_value`; no aceite, o serviço contratado é atualizado com essa duração. Backend: `_cns_validate_reschedule_slot`, `_cns_apply_service_reschedule_slot`. Na UI, card usa “Data proposta” ou “Período proposto”; formatadores omitem intervalo quando fim é nulo ou igual ao início.
_Avoid_: Escolha livre de “com/sem data de fim” independente da duração informada; tratar duração do contrato como imutável na proposta

**Aceite Formal de Reagendamento**:
Ação do cliente que aprova uma Data Proposta de Reagendamento. Somente nesse momento a Data Oficial do Serviço muda. No backend, o aceite também dispara `payment_reschedule_charge_date` (ajuste de cobrança conforme estado da parcela e distância da nova data).
_Avoid_: Acordo verbal no chat, mensagem de confirmação informal; o cliente invocar Edge Function de dinheiro no aceite

**Reagendamento pós-pagamento perto (≤15 dias)**:
Com parcela `PAID` e serviço `CONFIRMED`, se a nova execução fica a no máximo `far_reschedule_recapture_threshold_days` (padrão 15) à frente: atualiza só o slot; mantém o dinheiro capturado (`paid_no_charge_update`).
_Avoid_: Nova cobrança automática; estorno por mera mudança de agenda perto

**Reagendamento pós-pagamento longe (>15 dias) / Recaptura longe**:
Com parcela `PAID`, se a nova execução fica além do limiar: backend marca `far_recapture_pending_at`, reembolsa integralmente no gateway e cria nova parcela `SCHEDULED` em T-2; o serviço volta a `PENDING_PAYMENT` até a nova captura. Não cancela o serviço nem fecha o chat. Orquestração só no backend (pg_net + cron).
_Avoid_: Cancelamento disfarçado; o app chamar `process-far-reschedule-recapture` / `process-refund` no aceite

**Reagendamento Iniciado pelo Prestador**:
Solicitação aberta pelo prestador para negociar nova data. Pode ser iniciada com o serviço contratado em `PENDING_PAYMENT` (ainda não pago) ou `CONFIRMED` (pago), sem janela mínima de 48h. O prestador também pode propor o novo slot nesses mesmos status.
_Avoid_: Exigir pagamento confirmado para o prestador iniciar; cancelamento pelo prestador

**Reagendamento de Última Hora**:
Reagendamento solicitado pelo prestador com menos de 24 horas até a execução oficial do serviço. Conta para histórico de confiabilidade do prestador.
_Avoid_: Cancelamento de última hora

**Solicitação Expirada de Reagendamento**:
Solicitação que não pode mais receber ações porque o serviço entrou em estado terminal ou porque passou o período operacional definido após a data oficial.
_Avoid_: Cancelamento do serviço, rejeição pelo cliente

**Solicitação Encerrada de Reagendamento**:
Solicitação finalizada manualmente sem alterar a Data Oficial do Serviço. Significa que as partes manterão a data atual, não que o serviço foi cancelado.
_Avoid_: Cancelamento do serviço, expiração automática
